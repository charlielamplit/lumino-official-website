import { modelConfigured } from "./advisor-runtime.js";

const LUNA = process.env.ADVISOR_MODEL_LUNA || "gpt-4.1-mini";
const SOL = process.env.ADVISOR_MODEL_SOL || "gpt-4.1";
const CONTACT_URL = "/apps/site/Lumino%20联系.dc.html";

function apiKey() {
  return process.env.ADVISOR_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
}

export function chooseModel({ text = "", hits = [] } = {}) {
  const long = String(text).length > 280;
  const multi = hits.length >= 3;
  const complex = /对比|比较|差异|区别|and also|compare|versus|vs\./i.test(text);
  if (long || multi || complex) return { id: SOL, tier: "sol" };
  return { id: LUNA, tier: "luna" };
}

function systemPrompt(lang) {
  return lang === "en"
    ? [
        "You are Lumino Service Guide for public website orientation.",
        "Use ONLY the provided published sources. Never invent laws, dates, codes, clients, prices or certifications.",
        "Do not mention internal review, fixed-answer systems, pilots or maturity labels.",
        "If sources are insufficient, say you cannot confirm and suggest contact.",
        "Keep answers short (about 80-160 words). Ask at most one next question.",
        "Return JSON only matching the schema.",
      ].join(" ")
    : [
        "你是 Lumino 官网服务顾问，只做公开站导向说明。",
        "只能使用下方已发布来源，不得编造法规、日期、编码、客户、价格或认证结论。",
        "不要提及内部审核、固定答案系统、试点或成熟度标签。",
        "来源不足时明确说明无法确认，并建议通过联系页继续。",
        "回答控制在约 150–300 字，最多追问一个问题。",
        "只返回符合 schema 的 JSON。",
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

export async function generateGroundedAnswer({ text, lang, hits, signal }) {
  if (!modelConfigured() || !hits.length) return null;
  const model = chooseModel({ text, hits });
  const key = apiKey();
  const sourcesBlock = hits.map((hit, index) => (
    `[#${index + 1}] ${hit.title}\nURL: ${hit.url}\n${hit.lead}\n${hit.excerpt}`
  )).join("\n\n");

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: signal || AbortSignal.timeout(20000),
    body: JSON.stringify({
      model: model.id,
      store: false,
      temperature: 0.2,
      max_output_tokens: 500,
      text: {
        format: {
          type: "json_schema",
          name: responseSchema().name,
          strict: true,
          schema: responseSchema().schema,
        },
      },
      input: [
        { role: "system", content: systemPrompt(lang) },
        {
          role: "user",
          content: lang === "en"
            ? `Question:\n${text}\n\nPublished sources:\n${sourcesBlock}`
            : `用户问题：\n${text}\n\n已发布来源：\n${sourcesBlock}`,
        },
      ],
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`model_http_${upstream.status}:${detail.slice(0, 200)}`);
  }

  const payload = await upstream.json();
  const raw = extractOutputText(payload);
  const parsed = JSON.parse(raw);
  const allowedUrls = new Set(hits.map((hit) => hit.url));
  const sources = hits.slice(0, 3).map((hit) => ({ title: hit.title, url: hit.url }));
  if (!sources.length) return null;

  const services = [];
  if (parsed.primary_service_id) {
    services.push({
      service_id: String(parsed.primary_service_id),
      reason: lang === "en" ? "Primary match from published sources." : "来自已发布来源的主要匹配。",
      priority: 1,
    });
  }
  if (parsed.secondary_service_id && parsed.secondary_service_id !== parsed.primary_service_id) {
    services.push({
      service_id: String(parsed.secondary_service_id),
      reason: lang === "en" ? "Related service from published sources." : "来自已发布来源的相关服务。",
      priority: 2,
    });
  }

  return {
    intent: String(parsed.intent || "knowledge_retrieval"),
    answer_mode: "retrieval_model",
    answer: String(parsed.answer || "").trim(),
    confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
    service_matches: services.slice(0, 2),
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
    runtime_model: model,
    _allowedUrls: [...allowedUrls],
  };
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
