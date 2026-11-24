/**
 * CBAM precursor suggestion via OpenAI-compatible gateway.
 * Replaces Dify workflow: cn_code + product_desc ? LLM JSON ? table enrich in /api/precursors.
 *
 * Model only proposes structure (name/cnCode/consumption/reason).
 * Emission factors are overwritten by official tables server-side.
 */
import {
  classifyUpstreamHttpError,
  normalizeApiBaseUrl,
  resolveApiMode,
  resolveStoragePolicy,
  shouldSendStoreFalse,
} from "./advisor-gateway.js";

// Prefer Sol/deepseek by default: some Claude-compatible gateways put tokens in
 // reasoning_content and leave message.content empty (finish_reason=length).
const PRIMARY = process.env.PRECURSOR_MODEL
  || process.env.ADVISOR_MODEL_SOL
  || process.env.ADVISOR_MODEL_LUNA
  || "gpt-4.1-mini";
const FALLBACK = process.env.PRECURSOR_MODEL_FALLBACK
  || process.env.ADVISOR_MODEL_LUNA
  || PRIMARY;
const LUNA = PRIMARY;
const SOL = FALLBACK;

/** Same rules as Dify system prompt; object wrapper for chat json_object gateways. */
export const PRECURSOR_SYSTEM_PROMPT = `你是 CBAM(欧盟碳边境调节机制)碳排放核算专家。用户给你一个成品的 CN code 和中文描述。请推测生产该成品时**直接外购投入**的上游前体(precursor)——即做出该成品时直接消耗的、本身也属于 CBAM 管控范围的**半成品或原料**。

【核心判定规则,务必严格遵守】
- 只取「直接上游一层」:只返回直接投入该成品生产的前体。例:钢材成品(棒材/板材/管材/线材/盘条等)的前体是**粗钢/钢坯(Crude steel)**,**不要同时返回生铁/烧结矿**——那些是钢坯的前体,不是本成品的直接前体。
- 禁止并列成品:不要返回与成品同类、只是规格/形状不同的并列产品。
- 禁止多层链条:若前体 B 本身又由 C 制成,只返回直接上游 B,**不要再列 C**。
- 可替代前体只取一个:同一种投入的可替代品类只返回一个，但不同的直接投入（例如不锈钢的粗钢、铬铁、镍铁、锰铁）应分别列出。
- CN code 必须是有效的 8 位商品码；不能把 6 位品目后补 00 伪装成 8 位码。无法确定细码时在 reason 中说明不确定性。
- 只返回属于 CBAM 附件商品的前体;不要返回石膏、粉煤灰、废钢等非 CBAM 管控物料。
- 优先按用户描述的实际工艺和直接外购投入确定上一层。若未提供工艺，说明是典型路线假设；不能仅凭成品 CN 码断言具体供应链。
- 8 位 CN 码只能从用户消息附带的当前数据表清单中选择；若无法确定具体细码，不要自造编码。

【输出格式】
1. 只输出一个 JSON 对象,无任何额外文字,无 markdown 围栏,不要输出推理过程。形状必须是:
   {"precursors":[...]}
2. precursors 数组中每个对象仅含字段:
   - name:前体中文名称(字符串)
   - cnCode:前体 8 位 CN code(字符串;务必是字符串)
   - estimateValue:该前体每吨大致嵌入排放强度 tCO₂e/吨(数值;仅供参考,后端会用权威表覆盖)
   - consumption:每 1 吨成品消耗多少吨该前体(数值,如 1.05;按典型工艺)
   - reason:一句话说明为何是该成品的**直接**前体
3. 最多 5 个且必须同属直接一层；有多个真实直接投入时不要遗漏。
4. 只有在当前生产路线确实没有直接使用受 CBAM 管控的前体时，才返回 {"precursors":[]}。烧结矿在欧委会钢铁行业指南中没有相关前体；生铁等其他品类可能使用烧结矿、铁合金或氢，不得仅凭品类名称认定其无前体。

示例(成品=非合金钢盘条 72142000;仅示意格式):
{"precursors":[{"name":"非合金钢方坯","cnCode":"72071210","estimateValue":2.0,"consumption":1.05,"reason":"盘条由钢坯热轧而成,是其直接金属料前体"}]}`

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

export function precursorModelConfigured() {
  return Boolean(apiKey());
}

/**
 * Parse LLM text into raw precursor rows (Dify code_parse equivalent).
 * @param {string} llmText
 */
export function parsePrecursorLlmOutput(llmText) {
  let text = String(llmText || "").trim();
  if (text.startsWith("```")) {
    const parts = text.split("```");
    text = (parts[1] || text).replace(/^\s*json\s*/i, "").trim();
  }

  const attempts = [text];
  const fenced = String(llmText || "").match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());

  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) attempts.push(text.slice(objStart, objEnd + 1));

  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) attempts.push(text.slice(arrStart, arrEnd + 1));

  let data = null;
  for (const candidate of attempts) {
    try {
      data = JSON.parse(candidate);
      break;
    } catch {
      /* try next */
    }
  }
  if (data == null) return [];

  const list = Array.isArray(data)
    ? data
    : (Array.isArray(data.precursors) ? data.precursors : []);

  const result = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    result.push({
      name: String(item.name ?? ""),
      cnCode: String(item.cnCode ?? item.cn_code ?? ""),
      estimateValue: Number(item.estimateValue ?? item.estimate_value) || 0,
      consumption: Number(item.consumption) || 0,
      reason: String(item.reason ?? ""),
    });
  }
  return result.slice(0, 5);
}

function userPrompt(cnCode, productDesc, { forceJson = false } = {}) {
  const base = `成品 CN code:${cnCode}
成品中文描述:${productDesc || ""}`;
  if (!forceJson) return base;
  return `${base}

重要:请立刻在回复正文中输出完整 JSON 对象 {"precursors":[...]},不要只写分析或推理。只列直接上一层 CBAM 前体,不要列更上游。不确定 CN 细码时选该前体品类下最常见的 8 位码。`;
}

/** Prefer visible content; only use reasoning_* if it already contains parseable JSON. */
export function extractPrecursorMessageText(payload) {
  const message = payload?.choices?.[0]?.message || {};
  const finishReason = payload?.choices?.[0]?.finish_reason || null;
  const content = String(message.content || "").trim();
  if (content) {
    return { raw: content, finishReason, empty: false, source: "content" };
  }
  const reasoning = String(
    message.reasoning_content || message.reasoning || "",
  ).trim();
  if (reasoning && parsePrecursorLlmOutput(reasoning).length >= 0) {
    // Accept reasoning only when it parses to a JSON object/array shape.
    const looksJson = /[{[]/.test(reasoning) && /precursors|"cnCode"|\[/.test(reasoning);
    if (looksJson && (parsePrecursorLlmOutput(reasoning).length > 0 || /"precursors"\s*:\s*\[/.test(reasoning))) {
      return { raw: reasoning, finishReason, empty: false, source: "reasoning_json" };
    }
  }
  return { raw: "", finishReason, empty: true, source: "none" };
}

async function callChat({ model, key, cnCode, productDesc, signal, forceJson = false, maxTokens = 2500 }) {
  const upstream = await fetch(`${apiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PRECURSOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt(cnCode, productDesc, { forceJson }) },
      ],
    }),
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(classifyUpstreamHttpError(upstream.status, detail));
  }
  return extractPrecursorMessageText(await upstream.json());
}

async function callResponses({ model, key, cnCode, productDesc, signal, policy, forceJson = false }) {
  const body = {
    model,
    temperature: 0.2,
    max_output_tokens: 2500,
    input: [
      { role: "system", content: PRECURSOR_SYSTEM_PROMPT },
      { role: "user", content: userPrompt(cnCode, productDesc, { forceJson }) },
    ],
  };
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
  const payload = await upstream.json();
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return { raw: payload.output_text, finishReason: null, empty: false, source: "output_text" };
  }
  const chunks = [];
  for (const item of payload?.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  const raw = chunks.join("\n").trim();
  return { raw, finishReason: null, empty: !raw, source: raw ? "output" : "none" };
}

async function invokeOnce({ model, key, cnCode, productDesc, signal, mode, policy, forceJson }) {
  return mode === "chat"
    ? callChat({ model, key, cnCode, productDesc, signal, forceJson })
    : callResponses({ model, key, cnCode, productDesc, signal, policy, forceJson });
}

/**
 * @param {{ cnCode: string, productDesc?: string, signal?: AbortSignal }} input
 */
export async function suggestPrecursorsWithModel({ cnCode, productDesc = "", signal } = {}) {
  const key = apiKey();
  if (!key) {
    const error = new Error("未配置模型接口(检查 OPENAI_API_KEY / ADVISOR_OPENAI_API_KEY)");
    error.statusCode = 500;
    throw error;
  }
  const mode = apiMode();
  const policy = resolveStoragePolicy({
    baseUrl: apiBaseUrl(),
    apiMode: mode,
    override: process.env.ADVISOR_STORAGE_POLICY,
  });

  // Prefer forced-JSON first: some Claude-compatible gateways fill reasoning_content
  // and leave content empty unless pushed. Fall back across Luna/Sol.
  const attempts = [
    { model: LUNA, forceJson: true },
  ];
  if (SOL && SOL !== LUNA) {
    attempts.push({ model: SOL, forceJson: true });
  }
  attempts.push({ model: LUNA, forceJson: false });

  let lastError = null;
  let usedModel = LUNA;
  let emptyAcceptedModel = null;
  for (const attempt of attempts) {
    usedModel = attempt.model;
    try {
      const extracted = await invokeOnce({
        model: attempt.model,
        key,
        cnCode,
        productDesc,
        signal,
        mode,
        policy,
        forceJson: attempt.forceJson,
      });
      if (extracted.empty) {
        lastError = new Error(`model_empty_output:finish=${extracted.finishReason || "unknown"}`);
        continue;
      }
      const precursors = parsePrecursorLlmOutput(extracted.raw);
      if (precursors.length > 0) {
        return { precursors, model: usedModel };
      }
      // Empty JSON can be correct for upstream goods, but models often return
      // {"precursors":[]} too early. Keep trying later attempts; only accept
      // empty after all retries if the payload was valid JSON.
      const root = safeJsonRoot(extracted.raw);
      let emptyJsonOk = false;
      if (root) {
        try {
          const data = JSON.parse(root);
          emptyJsonOk = Array.isArray(data)
            || (data && typeof data === "object" && Array.isArray(data.precursors));
        } catch {
          emptyJsonOk = false;
        }
      }
      if (emptyJsonOk) {
        lastError = null;
        emptyAcceptedModel = attempt.model;
        continue;
      }
      lastError = new Error("model_unparsed_precursors");
    } catch (error) {
      lastError = error;
    }
  }

  if (emptyAcceptedModel) {
    return { precursors: [], model: emptyAcceptedModel };
  }
  if (lastError) throw lastError;
  return { precursors: [], model: usedModel };
}

function safeJsonRoot(text) {
  const t = String(text || "").trim();
  const objStart = t.indexOf("{");
  const objEnd = t.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) return t.slice(objStart, objEnd + 1);
  const arrStart = t.indexOf("[");
  const arrEnd = t.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) return t.slice(arrStart, arrEnd + 1);
  return null;
}
