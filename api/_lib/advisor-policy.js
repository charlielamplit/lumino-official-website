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

export function detectSensitive(value) {
  const input = String(value || "");
  return SENSITIVE_RE.some((pattern) => pattern.test(input));
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
  const asOf = String(body.asOf || "").trim();

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

  const joined = [text, ...history.map((item) => item.text)].join("\n");
  const sensitive = detectSensitive(joined);

  return {
    ok: errors.length === 0,
    errors,
    sensitive,
    request: {
      lang,
      text: sensitive ? "" : text,
      topicId,
      replyId,
      asOf,
      history,
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
