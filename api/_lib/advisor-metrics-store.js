const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 500;

const state = {
  startedAt: Date.now(),
  events: [],
  counters: {
    requests: 0,
    errors: 0,
    fixed: 0,
    tool_route: 0,
    retrieval_model: 0,
    fallback: 0,
    no_sources: 0,
    privacy_guard: 0,
    cta_clicks: 0,
    latency_sum_ms: 0,
    latency_count: 0,
  },
};

function prune(now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  state.events = state.events.filter((item) => item.at >= cutoff).slice(-MAX_EVENTS);
}

export function recordAdvisorMetric(event = {}) {
  const now = Date.now();
  prune(now);
  const type = String(event.type || "request");
  const answerMode = String(event.answer_mode || "");
  const source = String(event.source || "");
  const latency = Number(event.latency_ms);
  const safe = {
    at: now,
    type,
    answer_mode: answerMode || null,
    source: source || null,
    handoff: event.handoff || null,
    has_sources: Boolean(event.has_sources),
    cta_type: event.cta_type || null,
    latency_ms: Number.isFinite(latency) ? Math.max(0, Math.round(latency)) : null,
    ok: event.ok !== false,
  };
  state.events.push(safe);

  if (type === "cta") {
    state.counters.cta_clicks += 1;
    return safe;
  }

  state.counters.requests += 1;
  if (!safe.ok) state.counters.errors += 1;
  if (answerMode && state.counters[answerMode] != null) state.counters[answerMode] += 1;
  if (source === "no_sources") state.counters.no_sources += 1;
  if (source === "privacy_guard") state.counters.privacy_guard += 1;
  if (safe.latency_ms != null) {
    state.counters.latency_sum_ms += safe.latency_ms;
    state.counters.latency_count += 1;
  }
  return safe;
}

export function getAdvisorMetricsSummary() {
  prune();
  const c = state.counters;
  const total = Math.max(1, c.requests);
  return {
    window_hours: 24,
    started_at: new Date(state.startedAt).toISOString(),
    event_count: state.events.length,
    counters: { ...c },
    rates: {
      no_model_resolution_rate: Number(((c.fixed + c.tool_route) / total).toFixed(4)),
      tool_route_rate: Number((c.tool_route / total).toFixed(4)),
      no_sources_rate: Number((c.no_sources / total).toFixed(4)),
      error_rate: Number((c.errors / total).toFixed(4)),
      avg_latency_ms: c.latency_count
        ? Number((c.latency_sum_ms / c.latency_count).toFixed(1))
        : null,
    },
    note: "In-memory counters for the current serverless instance. Prefer log drains for durable production analytics.",
  };
}

export function resetAdvisorMetricsForTests() {
  state.startedAt = Date.now();
  state.events = [];
  for (const key of Object.keys(state.counters)) state.counters[key] = 0;
}
