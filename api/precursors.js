/**
 * POST /api/precursors — AI precursor suggestion.
 *
 * Align with sumaorong/CBAM app/api/precursors/route.ts:
 * 1) Model proposes precursors (structure only; one-layer rules live in the prompt).
 * 2) Server dedupes by cnCode and overwrites estimateValue from tables.
 *
 * Do NOT drop same-category or off-table codes here — original route notes that
 * filtering steel-structure←plate / aluminium←unwrought Al wrongly empties results.
 */
import { getCalculatorLookup } from "./_lib/cbam-lookup.js";
import { verifyCalculatorAiAccess } from "./_lib/calculator-ai-access.js";
import {
  precursorModelConfigured,
  suggestPrecursorsWithModel,
} from "./_lib/precursor-model.js";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function valueFor(code, lookup, country, year) {
  const info = lookup.getCnCodeInfo(code);
  const def = lookup.getDefaultEmission(code, country, year);
  const benchmark = lookup.getPrecursorBenchmark(code);
  if (!info || !def || !(benchmark?.columnB > 0)) return null;
  const defaultValue = info.hasIndirectEmissions || !(def.total > 0)
    ? def.seeWithMarkup : def.seeWithMarkup * def.direct / def.total;
  const full = lookup.actualFull.byCnCode?.[code]
    || lookup.actualFull._fallbackByCategory?.[info.aggregatedCategory];
  const estimateValue = full
    ? full.direct + (info.hasIndirectEmissions ? full.indirect || 0 : 0) : null;
  return { info, def, benchmark, defaultValue, estimateValue };
}

export function normalizePrecursorCode(code, lookup, country, year) {
  if (valueFor(code, lookup, country, year)) return { code, mappedFrom: null };
  // An LLM sometimes invents a suffix 00. Only map within the same six-digit
  // category when all valid children have identical costing factors and BM.
  if (!/^\d{6}00$/.test(code)) return null;
  const candidates = lookup.cnCodes.map((item) => item.cnCode)
    .filter((candidate) => candidate.startsWith(code.slice(0, 6)))
    .map((candidate) => ({ code: candidate, values: valueFor(candidate, lookup, country, year) }))
    .filter((candidate) => candidate.values);
  if (!candidates.length) return null;
  const first = candidates[0].values;
  if (!candidates.every(({ values }) =>
    values.defaultValue === first.defaultValue
    && values.benchmark.columnB === first.benchmark.columnB
    && values.estimateValue === first.estimateValue
    && values.info.hasIndirectEmissions === first.info.hasIndirectEmissions)) return null;
  return { code: candidates[0].code, mappedFrom: code };
}

export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (String(request.method || "").toUpperCase() !== "POST") {
    response.statusCode = 405;
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = typeof request.body === "object" && request.body
      ? request.body
      : JSON.parse(String(request.body || "{}"));
    const cnCode = digitsOnly(body.cnCode);
    const productDesc = String(body.productDesc || "");
    const productionRoute = String(body.productionRoute || "").slice(0, 400).trim();
    const country = body.country || "China";
    const year = Number(body.year) || 2026;

    if (!cnCode) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: "缺少 cnCode" }));
      return;
    }

    const lookup = getCalculatorLookup();
    const { getCnCodeInfo, actualFull } = lookup;
    if (!getCnCodeInfo(cnCode)) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: "成品 CN Code 不在当前计算器清单中" }));
      return;
    }
    if (!verifyCalculatorAiAccess(request.headers?.["x-calculator-ai-token"], cnCode)) {
      response.statusCode = 403;
      response.end(JSON.stringify({ error: "请先提交并确认保存咨询信息，再使用 AI 推算。" }));
      return;
    }
    // Commission steel guidance lists no relevant CBAM precursor for sintered ore.
    if (cnCode === "26011200") {
      response.statusCode = 200;
      response.end(JSON.stringify({ precursors: [], meta: { noPrecursorReason: "upstream", proposal_only: true } }));
      return;
    }
    if (!precursorModelConfigured()) {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: "未配置模型接口(检查 OPENAI_API_KEY / ADVISOR_OPENAI_API_KEY)" }));
      return;
    }
    const rawDesc = productDesc || getCnCodeInfo(cnCode)?.zh || getCnCodeInfo(cnCode)?.description || "";
    const desc = rawDesc.length > 250 ? rawDesc.slice(0, 250) : rawDesc;
    const modelContext = `${desc}\n用户描述的工艺与直接外购投入：${productionRoute || "未提供；请标明仅按典型路线推测"}\n当前数据表可用的 8 位 CN 码（只能从中选）：${lookup.cnCodes.map((item) => item.cnCode).join(",")}`;

    let precursorsRaw = [];
    let modelId = "";
    try {
      const suggested = await suggestPrecursorsWithModel({
        cnCode,
        productDesc: modelContext,
        signal: AbortSignal.timeout(120000),
      });
      precursorsRaw = suggested.precursors;
      modelId = suggested.model;
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型推测失败";
      const isTimeout = error instanceof Error && (
        error.name === "TimeoutError" || /timeout/i.test(message)
      );
      response.statusCode = isTimeout ? 504 : 502;
      response.end(JSON.stringify({
        error: isTimeout ? "前体推测超时(>120s)" : `前体推测失败: ${message.slice(0, 200)}`,
      }));
      return;
    }

    const seen = new Set();
    const precursors = [];
    const rejected = [];
    if (precursorsRaw.length === 0 && /外购|购入|采购/.test(productionRoute)) {
      response.statusCode = 422;
      response.end(JSON.stringify({ error: "工艺说明包含外购投入，但模型未识别可核算前体；请补充具体品类后重试。" }));
      return;
    }
    for (const item of precursorsRaw) {
      const rawCode = digitsOnly(item?.cnCode);
      const normalized = normalizePrecursorCode(rawCode, lookup, country, year);
      if (!normalized) { rejected.push(rawCode || "missing"); continue; }
      const code = normalized.code;
      if (code === cnCode) { rejected.push(`${code}:same_as_finished_good`); continue; }
      if (seen.has(code)) continue;
      const consumption = Number(item?.consumption);
      if (!Number.isFinite(consumption) || consumption <= 0 || consumption > 10) {
        rejected.push(`${code}:consumption`);
        continue;
      }
      seen.add(code);
      const { info, def, benchmark: bench, defaultValue } = valueFor(code, lookup, country, year);
      const full = actualFull.byCnCode?.[code] || actualFull._fallbackByCategory?.[info.aggregatedCategory];
      let estimateValue = null;
      if (full) {
        estimateValue = full.direct + (info.hasIndirectEmissions ? full.indirect || 0 : 0);
      }
      if (!(estimateValue >= 0)) { rejected.push(`${code}:actual`); continue; }
      precursors.push({
        name: String(item?.name ?? ""),
        cnCode: code,
        mappedFrom: normalized.mappedFrom,
        estimateValue,
        consumption,
        reason: String(item?.reason ?? ""),
        defaultValue,
        defaultIsGlobalWorst: Boolean(def.isGlobalWorst || def.usingGlobalWorst),
        benchmarkA: bench?.columnA ?? null,
        benchmarkB: bench?.columnB ?? null,
      });
    }

    if (rejected.length) {
      response.statusCode = 422;
      response.end(JSON.stringify({ error: `前体 CN 码、排放因子或消耗量无法校验：${rejected.join(", ")}` }));
      return;
    }

    response.statusCode = 200;
    response.end(JSON.stringify({
      precursors,
      meta: { provider: "openai_compatible", model: modelId, proposal_only: true,
        noPrecursorReason: precursors.length ? null : "model_empty" },
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "前体推测出错";
    response.statusCode = 500;
    response.end(JSON.stringify({ error: message }));
  }
}
