/**
 * Pure gateway helpers for the public advisor model adapter.
 * Keep Provider storage claims honest: only official OpenAI Responses
 * with store:false may report api_no_store.
 */

export const STORAGE_POLICY = Object.freeze({
  API_NO_STORE: "api_no_store",
  PROVIDER_CONTRACT_REQUIRED: "provider_contract_required",
  UNKNOWN: "unknown",
});

export function normalizeApiBaseUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "https://api.openai.com/v1";
  return value.replace(/\/+$/, "");
}

export function isOfficialOpenAiBase(baseUrl) {
  return /api\.openai\.com/i.test(normalizeApiBaseUrl(baseUrl));
}

export function resolveApiMode({ forced = "", baseUrl = "" } = {}) {
  const mode = String(forced || "").trim().toLowerCase();
  if (mode === "chat" || mode === "responses") return mode;
  return isOfficialOpenAiBase(baseUrl) ? "responses" : "chat";
}

/**
 * @returns {"api_no_store"|"provider_contract_required"|"unknown"}
 */
export function resolveStoragePolicy({
  baseUrl = "",
  apiMode = "",
  override = "",
} = {}) {
  const forced = String(override || "").trim().toLowerCase();
  if (Object.values(STORAGE_POLICY).includes(forced)) return forced;

  const official = isOfficialOpenAiBase(baseUrl);
  const mode = resolveApiMode({ forced: apiMode, baseUrl });

  // Official Responses API supports request-level store:false.
  if (official && mode === "responses") return STORAGE_POLICY.API_NO_STORE;

  // Official Chat Completions has no equivalent store:false contract we rely on.
  if (official && mode === "chat") return STORAGE_POLICY.PROVIDER_CONTRACT_REQUIRED;

  // Third-party OpenAI-compatible gateways (e.g. aiberm): retention/training
  // must be confirmed by provider contract before claiming no-store.
  if (!official) return STORAGE_POLICY.PROVIDER_CONTRACT_REQUIRED;

  return STORAGE_POLICY.UNKNOWN;
}

export function shouldSendStoreFalse(storagePolicy) {
  return storagePolicy === STORAGE_POLICY.API_NO_STORE;
}

export function parseModelJson(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("model_empty_output");
  const attempts = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) attempts.push(text.slice(start, end + 1));
  let lastError;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("model_invalid_json");
}

export function extractChatMessageContent(payload) {
  const message = payload?.choices?.[0]?.message || {};
  const raw = message.content
    || message.reasoning_content
    || message.reasoning
    || "";
  return {
    raw: String(raw || ""),
    finishReason: payload?.choices?.[0]?.finish_reason || null,
    empty: !String(raw || "").trim(),
  };
}

export function classifyUpstreamHttpError(status, detail = "") {
  const code = Number(status) || 0;
  const text = String(detail || "").slice(0, 200);
  if (code === 401 || code === 403) return `model_http_${code}_auth:${text}`;
  if (code === 429) return `model_http_429_rate_limit:${text}`;
  if (code >= 500) return `model_http_${code}_upstream:${text}`;
  return `model_http_${code}:${text}`;
}
