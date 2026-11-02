/**
 * Public homepage advisor API (stateless)
 * - Deterministic fixed answers / tool routes first
 * - Else retrieve published knowledge; model only with grounded sources
 * - No conversation persistence / no sales leads
 */
import { checkRateLimit, clientKey, publicLogFields, sanitizeRequest } from "./_lib/advisor-policy.js";
import { modelConfigured, routeDeterministic } from "./_lib/advisor-runtime.js";
import { buildGroundedFallback, retrievePublishedKnowledge, stopWithoutSources } from "./_lib/advisor-retrieval.js";
import { generateGroundedAnswer } from "./_lib/advisor-model.js";
import { getPublicFlags, publicBetaEnabled } from "./_lib/advisor-flags.js";
import { recordAdvisorMetric } from "./_lib/advisor-metrics-store.js";

const CONTACT_URL = "/apps/site/Lumino%20联系.dc.html";

function json(response, status, body, extraHeaders = {}) {
  response.status(status);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(extraHeaders)) response.setHeader(key, value);
  response.end(JSON.stringify(body));
}

function writeSse(response, payload) {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Connection", "keep-alive");
  response.write(`event: advisor\ndata: ${JSON.stringify(payload)}\n\n`);
  response.write("event: done\ndata: {}\n\n");
  response.end();
}

function betaDisabledPayload(lang) {
  const result = stopWithoutSources(lang);
  result.intent = "beta_disabled";
  result.answer = lang === "en"
    ? "Ask Lumino is temporarily unavailable. Use the tools menu or the contact page for a scoped review."
    : "「问 Lumino」暂时不可用。请使用工具菜单，或通过联系页申请有范围的复核。";
  result.handoff = "contact";
  return result;
}

function sensitivePayload(lang) {
  const result = routeDeterministic({ text: "", lang, topicId: "" });
  result.answer = lang === "en"
    ? "The input may contain contact or identity details. It was not stored. Use the controlled contact page if you want Lumino to contact you."
    : "输入中可能包含联系方式或证件号码。内容未保存。如需联系，请使用受控联系页。";
  result.next_question = null;
  result.suggested_replies = [];
  result.answer_mode = "fallback";
  result.confidence = "low";
  result.handoff = "contact";
  result.sources = [];
  result.links = [{
    type: "contact",
    label: lang === "en" ? "Contact Lumino" : "联系 Lumino",
    url: `${CONTACT_URL}?source=homepage-advisor&topic=privacy`,
  }];
  result.cta = result.links[0];
  return result;
}

async function resolveOpenQuestion(request) {
  const hits = retrievePublishedKnowledge({
    text: request.text,
    lang: request.lang,
    asOf: request.asOf,
    limit: 3,
  });
  if (!hits.length) {
    return { result: stopWithoutSources(request.lang), source: "no_sources", modelAttempted: false, modelFailed: false };
  }

  if (modelConfigured()) {
    try {
      const generated = await generateGroundedAnswer({
        text: request.text,
        lang: request.lang,
        hits,
      });
      if (generated?.answer && generated.sources?.length) {
        const { runtime_model: runtimeModel, _allowedUrls, ...rest } = generated;
        return {
          result: rest,
          source: "retrieval_model",
          model: runtimeModel,
          modelAttempted: true,
          modelFailed: false,
        };
      }
      return {
        result: buildGroundedFallback(hits, request.lang),
        source: "retrieval_grounded",
        modelAttempted: true,
        modelFailed: true,
      };
    } catch (error) {
      console.error("[lumino-advisor] model failed", error?.message || error);
      return {
        result: buildGroundedFallback(hits, request.lang),
        source: "retrieval_grounded",
        modelAttempted: true,
        modelFailed: true,
      };
    }
  }

  return {
    result: buildGroundedFallback(hits, request.lang),
    source: "retrieval_grounded",
    modelAttempted: false,
    modelFailed: false,
  };
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    return json(response, 405, { error: "Method Not Allowed" });
  }

  const rate = checkRateLimit(clientKey(request));
  const rateHeaders = {
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.floor(rate.resetAt / 1000)),
  };
  if (!rate.ok) {
    return json(response, 429, { error: "Too Many Requests" }, rateHeaders);
  }

  let body = request.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  if (!body || typeof body !== "object") body = {};

  const sanitized = sanitizeRequest(body);
  if (!sanitized.ok) {
    return json(response, 400, { error: "Invalid request", details: sanitized.errors }, rateHeaders);
  }

  const wantsStream = request.query?.stream === "1"
    || String(request.headers?.accept || "").includes("text/event-stream");

  const started = Date.now();
  try {
    let result;
    let source = "deterministic";
    let model = null;
    let modelAttempted = false;
    let modelFailed = false;
    const flags = getPublicFlags();

    if (!publicBetaEnabled()) {
      result = betaDisabledPayload(sanitized.request.lang);
      source = "beta_disabled";
    } else if (sanitized.sensitive) {
      result = sensitivePayload(sanitized.request.lang);
      source = "privacy_guard";
    } else {
      result = routeDeterministic(sanitized.request);
      if (result.answer_mode === "fallback" && sanitized.request.text) {
        const open = await resolveOpenQuestion(sanitized.request);
        result = open.result;
        source = open.source;
        model = open.model || null;
        modelAttempted = Boolean(open.modelAttempted);
        modelFailed = Boolean(open.modelFailed);
      }
    }

    const latencyMs = Date.now() - started;
    const payload = {
      ok: true,
      ...result,
      runtime: {
        source,
        model_configured: modelConfigured(),
        model_tier: model?.tier || null,
        store: false,
        public_beta: flags.public_beta,
        model_enabled: flags.model_enabled,
        lead_capture: false,
        latency_ms: latencyMs,
      },
    };

    recordAdvisorMetric({
      type: "request",
      answer_mode: result.answer_mode,
      source,
      handoff: result.handoff,
      has_sources: Boolean(result.sources?.length),
      latency_ms: latencyMs,
      model_tier: model?.tier || null,
      model_attempted: modelAttempted,
      model_failed: modelFailed,
      ok: true,
    });
    console.info("[lumino-advisor]", publicLogFields({
      ...result,
      source,
      latency_ms: latencyMs,
      has_sources: Boolean(result.sources?.length),
      model_tier: model?.tier || null,
    }));

    if (wantsStream) return writeSse(response, payload);
    return json(response, 200, payload, rateHeaders);
  } catch (error) {
    console.error("[lumino-advisor] failed", error?.message || error);
    const latencyMs = Date.now() - started;
    recordAdvisorMetric({
      type: "request",
      answer_mode: "fallback",
      source: "error",
      latency_ms: latencyMs,
      ok: false,
    });
    const fallback = stopWithoutSources(sanitized.request.lang);
    fallback.answer = sanitized.request.lang === "en"
      ? "The advisor service is temporarily unavailable. Choose a topic below, or use the contact page."
      : "顾问服务暂时不可用。请选择下方话题，或通过联系页继续。";
    if (wantsStream) return writeSse(response, { ok: false, ...fallback });
    return json(response, 503, { ok: false, ...fallback }, rateHeaders);
  }
}
