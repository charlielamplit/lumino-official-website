const MAX_INPUT_CHARS = 2000;
const MAX_HISTORY = 6;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;

const buckets = new Map();

const SENSITIVE_RE = [
  /\b1[3-9]\d{9}\b/,
  /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/,
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
  /\b\d{15,18}[0-9xX]\b/,
  /\b[A-Z]{1,2}\d{7,9}\b/, // passport-like
];

const OUT_OF_SCOPE_RE = [
  /(?:写|创作|生成).{0,16}(?:诗|歌词|小说|故事|情书|笑话)/,
  /\b(?:write|compose|create)\b.{0,30}\b(?:poem|song|lyrics|novel|story|joke)\b/i,
];

function cleanContextValue(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function sanitizePortalContext(value) {
  if (!value || typeof value !== "object") return null;
  const year = /^20\d{2}$/.test(String(value.serviceYear || "")) ? String(value.serviceYear) : null;
  const quarter = /^Q[1-4]$/.test(String(value.period?.quarter || "")) ? String(value.period.quarter) : null;
  const object = value.objectRef && typeof value.objectRef === "object" ? {
    type: cleanContextValue(value.objectRef.type, 60) || null,
    id: cleanContextValue(value.objectRef.id) || null,
    revision: cleanContextValue(value.objectRef.revision, 40) || null,
  } : null;
  return {
    serviceId: cleanContextValue(value.serviceId, 40) || null,
    annualProjectId: cleanContextValue(value.annualProjectId) || null,
    serviceYear: year,
    workstream: cleanContextValue(value.workstream, 80) || null,
    objectRef: object?.type && object?.id ? object : null,
    period: quarter ? { quarter } : null,
    pageId: cleanContextValue(value.pageId, 80) || null,
  };
}

export function detectSensitive(value) {
  const input = String(value || "");
  return SENSITIVE_RE.some((pattern) => pattern.test(input));
}

export function detectOutOfScope(value) {
  const input = String(value || "");
  return OUT_OF_SCOPE_RE.some((pattern) => pattern.test(input));
}

export function hasStaleReferenceDate(value, asOf) {
  const requestedYear = Number(String(asOf || "").slice(0, 4));
  if (!Number.isInteger(requestedYear)) return false;
  const text = String(value || "");
  const patterns = [
    /(?:参考(?:时点|日期|时间)|截至|当前(?:日期|时间))[^0-9]{0,12}(20\d{2})/gi,
    /(?:reference|as of|current) date[^0-9]{0,12}(20\d{2})/gi,
  ];
  return patterns.some((pattern) => [...text.matchAll(pattern)].some((match) => Number(match[1]) < requestedYear));
}

export function clientKey(request) {
  const forwarded = request.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return request.socket?.remoteAddress || request.headers?.["x-real-ip"] || "unknown";
}

export function checkRateLimit(key, now = Date.now()) {
  const bucket = buckets.get(key) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_WINDOW_MS;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return {
    ok: bucket.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export function sanitizeRequest(body = {}) {
  const errors = [];
  const lang = body.lang === "en" ? "en" : "zh";
  const text = String(body.text || "").trim();
  const topicId = String(body.topicId || "").trim();
  const replyId = String(body.replyId || "").trim();
  const asOf = String(body.asOf || new Date().toISOString().slice(0, 10)).trim();
  const surface = body.surface === "portal" ? "portal" : "public";
  const taskMode = surface === "portal" && body.taskMode === "draft" ? "draft" : "ask";
  const context = surface === "portal" ? sanitizePortalContext(body.context) : null;

  if (text.length > MAX_INPUT_CHARS) errors.push("input_too_long");
  if (topicId.length > 80) errors.push("topic_invalid");
  if (replyId.length > 80) errors.push("reply_invalid");
  if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) errors.push("as_of_invalid");

  let history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
  history = history
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      text: String(item.text || "").slice(0, MAX_INPUT_CHARS),
    }))
    .filter((item) => item.text);

  const joined = [text, ...history.map((item) => item.text), JSON.stringify(context || {})].join("\n");
  const sensitive = detectSensitive(joined);
  const outOfScope = detectOutOfScope(text);

  return {
    ok: errors.length === 0,
    errors,
    sensitive,
    outOfScope,
    request: {
      lang,
      text: sensitive ? "" : text,
      topicId,
      replyId,
      asOf,
      history,
      surface,
      taskMode,
      context,
    },
  };
}

export function publicLogFields({ intent, answer_mode, confidence, handoff, source, latency_ms, has_sources, model_tier }) {
  return {
    intent: intent || "unknown",
    answer_mode: answer_mode || "fallback",
    confidence: confidence || "low",
    handoff: handoff || "contact",
    source: source || "deterministic",
    latency_ms: Number.isFinite(latency_ms) ? Math.round(latency_ms) : null,
    has_sources: Boolean(has_sources),
    model_tier: model_tier || null,
  };
}

export const ADVISOR_LIMITS = Object.freeze({
  MAX_INPUT_CHARS,
  MAX_HISTORY,
  RATE_WINDOW_MS,
  RATE_LIMIT,
});
