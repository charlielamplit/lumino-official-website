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

function systemPrompt(lang, grounded = true) {
  if (lang === "en") {
    return [
      "You are Lumino Service Guide for public website orientation.",
      grounded
        ? "Prioritise the provided published sources, and use your own capabilities to explain or complete the answer. You may give a regulatory conclusion when the facts are sufficient; state the jurisdiction, reference date, key assumptions and any point that still needs current verification. Never invent laws, dates, codes, clients, prices or certifications."
        : "No published Lumino source matched. Use your own capabilities to answer and provide a practical result. You may give a regulatory conclusion when the facts are sufficient; state the jurisdiction, reference date, key assumptions and any point that still needs current verification. Never invent laws, dates, codes, clients, prices or certifications.",
      "Do not mention internal review, fixed-answer systems, pilots or maturity labels.",
      grounded
        ? "Distinguish conclusions supported by the supplied sources from model knowledge that needs external verification, then continue with what the user can do next."
        : "Do not stop at 'I cannot confirm' or only redirect to contact. Give at least one actionable result first. If the question is outside Lumino's scope, state the boundary briefly and show how to reframe it.",
      "Keep answers short (about 80-160 words). Ask at most one next question.",
      "Return raw JSON only matching the schema. No markdown, no code fences.",
    ].join(" ");
  }
  return [
    "你是 Lumino 官网服务顾问，只做公开站导向说明。",
    grounded
      ? "优先使用下方已发布来源，并可运用自身能力解释或补充答案。事实充分时可以给出法规结论，但必须说明司法辖区、参考时点、关键前提和仍需核实的事项；不得编造法规、日期、编码、客户、价格或认证结论。"
      : "当前没有匹配到已发布的 Lumino 资料。请运用自身能力直接回答并给出实际结果；事实充分时可以给出法规结论，但必须说明司法辖区、参考时点、关键前提和仍需核实的事项；不得编造法规、日期、编码、客户、价格或认证结论。",
    "不要提及内部审核、固定答案系统、试点或成熟度标签。",
    grounded
      ? "应区分由所提供来源支持的结论与需要外部复核的模型知识，同时继续说明用户现在可以做什么。"
      : "不能只说无法确认或只让用户联系人工；必须先给出至少一个可执行结果。问题超出 Lumino 范围时，简要说明边界，并告诉用户可以怎样重新描述。",
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

function userPrompt(lang, text, sourcesBlock, grounded = true) {
  return lang === "en"
    ? `Question:\n${text}\n\n${grounded ? `Published sources:\n${sourcesBlock}` : "No published source matched this question. Use your own capabilities and identify the basis, reference date and assumptions for any regulatory conclusion."}\n\nRespond with JSON fields: intent, answer, confidence, next_question, primary_service_id, secondary_service_id, handoff.`
    : `用户问题：\n${text}\n\n${grounded ? `已发布来源：\n${sourcesBlock}` : "没有匹配到已发布资料。请运用自身能力回答；如给出法规结论，请说明依据、参考时点和前提。"}\n\n请只返回 JSON，字段：intent, answer, confidence, next_question, primary_service_id, secondary_service_id, handoff。`;
}

function isTimeoutError(error) {
  return /abort|timeout|advisor_timeout/i.test(String(error?.message || error || ""));
}

async function callResponsesApi({ model, key, lang, text, sourcesBlock, signal, policy, grounded }) {
  const schema = responseSchema();
  const body = {
    model: model.id,
    temperature: 0.2,
    // Compatible gateways may count hidden reasoning against this budget;
    // leave enough room for the required JSON object after deliberation.
    max_output_tokens: 2400,
    text: {
      format: {
        type: "json_schema",
        name: schema.name,
        strict: true,
        schema: schema.schema,
      },
    },
    input: [
      { role: "system", content: systemPrompt(lang, grounded) },
      { role: "user", content: userPrompt(lang, text, sourcesBlock, grounded) },
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

async function callChatCompletionsApi({ model, key, lang, text, sourcesBlock, signal, grounded }) {
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
      // Compatible gateways may count hidden reasoning against this budget;
      // 1200 previously truncated valid JSON before the closing quote/brace.
      max_tokens: 2400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(lang, grounded) },
        { role: "user", content: userPrompt(lang, text, sourcesBlock, grounded) },
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

async function invokeModel({ model, key, lang, text, sourcesBlock, signal, mode, policy, grounded = true }) {
  return mode === "chat"
    ? callChatCompletionsApi({ model, key, lang, text, sourcesBlock, signal, grounded })
    : callResponsesApi({ model, key, lang, text, sourcesBlock, signal, policy, grounded });
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

function buildGeneralPayload({ parsed, model, mode, policy, lang = "zh", solFallback = false }) {
  const services = sanitizeServiceMatches([
    parsed.primary_service_id ? {
      service_id: sanitizeServiceId(parsed.primary_service_id),
      reason: lang === "en" ? "Primary service inferred from the question." : "根据问题初步匹配的主要服务。",
    } : null,
    parsed.secondary_service_id ? {
      service_id: sanitizeServiceId(parsed.secondary_service_id),
      reason: lang === "en" ? "Related service inferred from the question." : "根据问题初步匹配的相关服务。",
    } : null,
  ].filter(Boolean), lang);
  const contact = {
    type: "contact",
    label: lang === "en" ? "Contact Lumino" : "联系 Lumino",
    url: `${CONTACT_URL}?source=homepage-advisor&topic=general-guidance`,
  };
  return {
    intent: String(parsed.intent || "general_guidance"),
    answer_mode: "general_model",
    answer: String(parsed.answer || "").trim(),
    confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
    service_matches: services,
    next_question: parsed.next_question ? String(parsed.next_question) : null,
    suggested_replies: [],
    sources: [],
    links: [contact],
    cta: contact,
    handoff: ["none", "contact", "expert_required"].includes(parsed.handoff) ? parsed.handoff : "none",
    runtime_model: {
      ...model,
      api_mode: mode,
      base_url: apiBaseUrl(),
      storage_policy: policy,
      store_requested: shouldSendStoreFalse(policy),
      sol_fallback_to_luna: Boolean(solFallback),
    },
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

export async function generateGeneralAnswer({ text, lang, signal }) {
  if (!modelConfigured()) return null;
  // Open questions may require a direct regulatory explanation and a complete
  // structured result. Use the capable fast Sol route instead of a Luna model
  // that some compatible gateways run with hidden reasoning until finish=length.
  const primary = { id: SOL, tier: "sol" };
  const key = apiKey();
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
      sourcesBlock: "",
      signal: abortSignal,
      mode,
      policy,
      grounded: false,
    });
  } catch (error) {
    const canFallback = LUNA
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
      sourcesBlock: "",
      signal: retrySignal,
      mode,
      policy,
      grounded: false,
    });
  }

  const parsed = parseModelJson(raw);
  return buildGeneralPayload({
    parsed,
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
