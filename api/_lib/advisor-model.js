import { modelConfigured } from "./advisor-runtime.js";
import { modelTimeoutMs } from "./advisor-timing.js";
import { sanitizeServiceId, sanitizeServiceMatches } from "./advisor-services.js";
import {
  classifyUpstreamHttpError,
  extractChatMessageContent,
  normalizeApiBaseUrl,
  parseModelJson,
  resolveApiMode,
  resolveStoragePolicy,
  shouldSendStoreFalse,
} from "./advisor-gateway.js";

const LUNA = process.env.ADVISOR_MODEL_LUNA || "gpt-4.1-mini";
// Prefer a fast Sol by default; slow Sol models cause Beta No-Go under client budget.
const SOL = process.env.ADVISOR_MODEL_SOL || "deepseek/deepseek-v4-flash";
const CONTACT_URL = "/apps/site/Lumino%20联系.dc.html";

function apiKey() {
  return process.env.ADVISOR_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
}

function apiBaseUrl() {
  return normalizeApiBaseUrl(
    process.env.ADVISOR_OPENAI_BASE_URL
      || process.env.OPENAI_BASE_URL
      || "https://api.openai.com/v1",
  );
}

function apiMode() {
  return resolveApiMode({
    forced: process.env.ADVISOR_OPENAI_API_MODE,
    baseUrl: apiBaseUrl(),
  });
}

function storagePolicy() {
  return resolveStoragePolicy({
    baseUrl: apiBaseUrl(),
    apiMode: apiMode(),
    override: process.env.ADVISOR_STORAGE_POLICY,
  });
}

export function chooseModel({
  text = "",
  hits = [],
  luna = LUNA,
  sol = SOL,
} = {}) {
  const long = String(text).length > 280;
  const multi = hits.length >= 3;
  const complex = /对比|比较|差异|区别|and also|compare|versus|vs\./i.test(text);
  if (long || multi || complex) return { id: sol, tier: "sol" };
  return { id: luna, tier: "luna" };
}

function systemPrompt(lang) {
  return lang === "en"
    ? [
        "You are Lumino Service Guide for public website orientation.",
        "Use ONLY the provided published sources. Never invent laws, dates, codes, clients, prices or certifications.",
        "Do not mention internal review, fixed-answer systems, pilots or maturity labels.",
        "If sources are insufficient, say you cannot confirm and suggest contact.",
        "Keep answers short (about 80-160 words). Ask at most one next question.",
        "Return raw JSON only matching the schema. No markdown, no code fences.",
      ].join(" ")
    : [
        "你是 Lumino 官网服务顾问，只做公开站导向说明。",
        "只能使用下方已发布来源，不得编造法规、日期、编码、客户、价格或认证结论。",
        "不要提及内部审核、固定答案系统、试点或成熟度标签。",
        "来源不足时明确说明无法确认，并建议通过联系页继续。",
        "回答控制在约 150–300 字，最多追问一个问题。",
        "只返回符合 schema 的原始 JSON，不要 Markdown，不要代码围栏。",
      ].join("");
}

function responseSchema() {
  return {
    name: "lumino_advisor_response",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        intent: { type: "string" },
        answer: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        next_question: { type: ["string", "null"] },
        primary_service_id: { type: ["string", "null"] },
        secondary_service_id: { type: ["string", "null"] },
        handoff: { type: "string", enum: ["none", "contact", "expert_required"] },
      },
      required: [
        "intent",
        "answer",
        "confidence",
        "next_question",
        "primary_service_id",
        "secondary_service_id",
        "handoff",
      ],
    },
  };
}

function userPrompt(lang, text, sourcesBlock) {
  return lang === "en"
    ? `Question:\n${text}\n\nPublished sources:\n${sourcesBlock}\n\nRespond with JSON fields: intent, answer, confidence, next_question, primary_service_id, secondary_service_id, handoff.`
    : `用户问题：\n${text}\n\n已发布来源：\n${sourcesBlock}\n\n请只返回 JSON，字段：intent, answer, confidence, next_question, primary_service_id, secondary_service_id, handoff。`;
}

function isTimeoutError(error) {
  return /abort|timeout|advisor_timeout/i.test(String(error?.message || error || ""));
}

async function callResponsesApi({ model, key, lang, text, sourcesBlock, signal, policy }) {
  const schema = responseSchema();
  const body = {
    model: model.id,
    temperature: 0.2,
    // Claude via gateway may spend completion budget on hidden reasoning.
    max_output_tokens: 1200,
    text: {
      format: {
        type: "json_schema",
        name: schema.name,
        strict: true,
        schema: schema.schema,
      },
    },
    input: [
      { role: "system", content: systemPrompt(lang) },
      { role: "user", content: userPrompt(lang, text, sourcesBlock) },
    ],
  };
  // Only claim/request no-store when the Provider API actually supports it.
  if (shouldSendStoreFalse(policy)) body.store = false;

  const upstream = await fetch(`${apiBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify(body),
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(classifyUpstreamHttpError(upstream.status, detail));
  }
  return extractOutputText(await upstream.json());
}

async function callChatCompletionsApi({ model, key, lang, text, sourcesBlock, signal }) {
  const upstream = await fetch(`${apiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: model.id,
      temperature: 0.2,
      // Claude via gateway may spend completion budget on hidden reasoning.
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(lang) },
        { role: "user", content: userPrompt(lang, text, sourcesBlock) },
      ],
    }),
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(classifyUpstreamHttpError(upstream.status, detail));
  }
  const payload = await upstream.json();
  const extracted = extractChatMessageContent(payload);
  if (extracted.empty) {
    throw new Error(`model_empty_output:finish=${extracted.finishReason || "unknown"}`);
  }
  return extracted.raw;
}

async function invokeModel({ model, key, lang, text, sourcesBlock, signal, mode, policy }) {
  return mode === "chat"
    ? callChatCompletionsApi({ model, key, lang, text, sourcesBlock, signal })
    : callResponsesApi({ model, key, lang, text, sourcesBlock, signal, policy });
}

function buildGroundedPayload({ parsed, hits, model, mode, policy, lang = "zh", solFallback = false }) {
  const allowedUrls = new Set(hits.map((hit) => hit.url));
  const sources = hits.slice(0, 3).map((hit) => ({ title: hit.title, url: hit.url }));
  if (!sources.length) return null;

  const services = sanitizeServiceMatches([
    parsed.primary_service_id ? {
      service_id: sanitizeServiceId(parsed.primary_service_id),
      reason: lang === "en" ? "Primary match from published sources." : "来自已发布来源的主要匹配。",
    } : null,
    parsed.secondary_service_id ? {
      service_id: sanitizeServiceId(parsed.secondary_service_id),
      reason: lang === "en" ? "Related service from published sources." : "来自已发布来源的相关服务。",
    } : null,
  ].filter(Boolean), lang);

  return {
    intent: String(parsed.intent || "knowledge_retrieval"),
    answer_mode: "retrieval_model",
    answer: String(parsed.answer || "").trim(),
    confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
    service_matches: services,
    next_question: parsed.next_question ? String(parsed.next_question) : null,
    suggested_replies: [],
    sources,
    links: [
      { type: "knowledge", label: lang === "en" ? "Open related article" : "打开相关文章", url: hits[0].url },
      {
        type: "contact",
        label: lang === "en" ? "Contact Lumino" : "联系 Lumino",
        url: `${CONTACT_URL}?source=homepage-advisor&topic=retrieval`,
      },
    ],
    cta: { type: "knowledge", label: lang === "en" ? "Open related article" : "打开相关文章", url: hits[0].url },
    handoff: ["none", "contact", "expert_required"].includes(parsed.handoff) ? parsed.handoff : "none",
    runtime_model: {
      ...model,
      api_mode: mode,
      base_url: apiBaseUrl(),
      storage_policy: policy,
      store_requested: shouldSendStoreFalse(policy),
      sol_fallback_to_luna: Boolean(solFallback),
    },
    _allowedUrls: [...allowedUrls],
  };
}

export async function generateGroundedAnswer({ text, lang, hits, signal }) {
  if (!modelConfigured() || !hits.length) return null;
  const primary = chooseModel({ text, hits });
  const key = apiKey();
  const sourcesBlock = hits.map((hit, index) => (
    `[#${index + 1}] ${hit.title}\nURL: ${hit.url}\n${hit.lead}\n${hit.excerpt}`
  )).join("\n\n");
  const mode = apiMode();
  const policy = storagePolicy();
  const abortSignal = signal || AbortSignal.timeout(modelTimeoutMs(primary.tier));

  let raw;
  let usedModel = primary;
  let solFallback = false;
  try {
    raw = await invokeModel({
      model: primary,
      key,
      lang,
      text,
      sourcesBlock,
      signal: abortSignal,
      mode,
      policy,
    });
  } catch (error) {
    // Sol timeout/slow-path: one Luna retry within remaining client budget.
    const canFallback = primary.tier === "sol"
      && LUNA
      && LUNA !== primary.id
      && isTimeoutError(error);
    if (!canFallback) throw error;
    solFallback = true;
    usedModel = { id: LUNA, tier: "luna" };
    const retrySignal = signal || AbortSignal.timeout(modelTimeoutMs("luna"));
    raw = await invokeModel({
      model: usedModel,
      key,
      lang,
      text,
      sourcesBlock,
      signal: retrySignal,
      mode,
      policy,
    });
  }

  const parsed = parseModelJson(raw);
  return buildGroundedPayload({
    parsed,
    hits,
    model: usedModel,
    mode,
    policy,
    lang,
    solFallback,
  });
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const chunks = [];
  for (const item of payload?.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  if (!chunks.length) throw new Error("model_empty_output");
  return chunks.join("\n");
}

export const ADVISOR_MODELS = Object.freeze({ LUNA, SOL });
export const ADVISOR_API = Object.freeze({
  baseUrl: apiBaseUrl,
  mode: apiMode,
  storagePolicy,
});

export {
  parseModelJson,
  normalizeApiBaseUrl,
  resolveApiMode,
  resolveStoragePolicy,
  extractChatMessageContent,
  classifyUpstreamHttpError,
};
