const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 500;

const ANSWER_MODES = new Set(["fixed", "tool_route", "retrieval_model", "fallback"]);
const SOURCES = new Set([
  "deterministic",
  "retrieval_grounded",
  "retrieval_model",
  "no_sources",
  "privacy_guard",
  "error",
  "beta_disabled",
]);
const HANDOFFS = new Set(["none", "contact", "expert_required"]);
const CTA_TYPES = new Set(["contact", "knowledge", "tool", "link"]);

const state = {
  startedAt: Date.now(),
  events: [],
};

function emptyCounters() {
  return {
    requests: 0,
    client_events: 0,
    errors: 0,
    timeouts: 0,
    model_attempts: 0,
    model_failures: 0,
    fixed: 0,
    tool_route: 0,
    retrieval_model: 0,
    fallback: 0,
    no_sources: 0,
    privacy_guard: 0,
    beta_disabled: 0,
    cta_clicks: 0,
    degradation_reasons: {},
    estimated_cost_usd_sum: 0,
    model_luna: 0,
    model_sol: 0,
    latency_sum_ms: 0,
    latency_count: 0,
  };
}

function prune(now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  state.events = state.events.filter((item) => item.at >= cutoff).slice(-MAX_EVENTS);
}

function sanitizeEvent(event = {}) {
  const type = event.type === "cta" ? "cta" : event.type === "client" ? "client" : "request";
  const answerMode = ANSWER_MODES.has(event.answer_mode) ? event.answer_mode : null;
  const source = SOURCES.has(event.source) ? event.source : null;
  const handoff = HANDOFFS.has(event.handoff) ? event.handoff : null;
  const ctaType = CTA_TYPES.has(event.cta_type) ? event.cta_type : null;
  const modelTier = event.model_tier === "luna" || event.model_tier === "sol" ? event.model_tier : null;
  const latency = Number(event.latency_ms);
  return {
    at: Date.now(),
    type,
    answer_mode: answerMode,
    source,
    handoff,
    cta_type: ctaType,
    model_tier: modelTier,
    has_sources: Boolean(event.has_sources),
    model_attempted: Boolean(event.model_attempted),
    model_failed: Boolean(event.model_failed),
    timeout: Boolean(event.timeout),
    degradation_reason: event.degradation_reason ? String(event.degradation_reason).slice(0, 64) : null,
    estimated_cost_usd: Number.isFinite(Number(event.estimated_cost_usd))
      ? Math.max(0, Number(event.estimated_cost_usd))
      : null,
    latency_ms: Number.isFinite(latency) ? Math.max(0, Math.min(120000, Math.round(latency))) : null,
    ok: event.ok !== false,
  };
}

function accumulate(events) {
  const counters = emptyCounters();
  for (const item of events) {
    if (item.type === "cta") {
      counters.cta_clicks += 1;
      continue;
    }
    if (item.type === "client") {
      counters.client_events += 1;
      if (item.timeout) counters.timeouts += 1;
      continue;
    }
    // server request only
    counters.requests += 1;
    if (!item.ok) counters.errors += 1;
    if (item.timeout) counters.timeouts += 1;
    if (item.model_attempted) counters.model_attempts += 1;
    if (item.model_failed) counters.model_failures += 1;
    if (item.answer_mode) counters[item.answer_mode] += 1;
    if (item.source === "no_sources") counters.no_sources += 1;
    if (item.source === "privacy_guard") counters.privacy_guard += 1;
    if (item.source === "beta_disabled") counters.beta_disabled += 1;
    if (item.model_tier === "luna") counters.model_luna += 1;
    if (item.model_tier === "sol") counters.model_sol += 1;
    if (item.degradation_reason) {
      counters.degradation_reasons[item.degradation_reason] = (counters.degradation_reasons[item.degradation_reason] || 0) + 1;
    }
    if (Number.isFinite(item.estimated_cost_usd)) {
      counters.estimated_cost_usd_sum += Number(item.estimated_cost_usd);
    }
    if (item.latency_ms != null) {
      counters.latency_sum_ms += item.latency_ms;
      counters.latency_count += 1;
    }
  }
  return counters;
}

export function recordAdvisorMetric(event = {}) {
  prune();
  const safe = sanitizeEvent(event);
  state.events.push(safe);
  return safe;
}

export function getAdvisorMetricsSummary() {
  prune();
  const counters = accumulate(state.events);
  const total = Math.max(1, counters.requests);
  return {
    window_hours: 24,
    window_note: "Rates are computed from events retained in the last 24 hours on this instance.",
    started_at: new Date(state.startedAt).toISOString(),
    event_count: state.events.length,
    counters,
    rates: {
      no_model_resolution_rate: Number(((counters.fixed + counters.tool_route) / total).toFixed(4)),
      tool_route_rate: Number((counters.tool_route / total).toFixed(4)),
      no_sources_rate: Number((counters.no_sources / total).toFixed(4)),
      error_rate: Number((counters.errors / total).toFixed(4)),
      timeout_rate: Number((counters.timeouts / total).toFixed(4)),
      model_failure_rate: counters.model_attempts
        ? Number((counters.model_failures / counters.model_attempts).toFixed(4))
        : 0,
      avg_latency_ms: counters.latency_count
        ? Number((counters.latency_sum_ms / counters.latency_count).toFixed(1))
        : null,
    },
    note: "In-memory counters for the current serverless instance. Prefer log drains for durable production analytics. Question text is never stored.",
  };
}

export function resetAdvisorMetricsForTests() {
  state.startedAt = Date.now();
  state.events = [];
}
