/**
 * Public homepage advisor API (stateless)
 * - Deterministic fixed answers / tool routes first
 * - Else retrieve published knowledge; model only with grounded sources
 * - Phrase-chunk SSE for print-style UI; Abort cancels upstream model
 * - No conversation persistence / no sales leads
 */
import { checkRateLimit, clientKey, publicLogFields, sanitizeRequest } from "./_lib/advisor-policy.js";
import { modelConfigured, routeDeterministic } from "./_lib/advisor-runtime.js";
import { buildGroundedFallback, retrievePublishedKnowledge, stopWithoutSources } from "./_lib/advisor-retrieval.js";
import { generateGroundedAnswer } from "./_lib/advisor-model.js";
import { getPublicFlags, publicBetaEnabled } from "./_lib/advisor-flags.js";
import { recordAdvisorMetric } from "./_lib/advisor-metrics-store.js";
import { ADVISOR_SSE_CHUNK_CHARS, clientTimeoutMs, modelTimeoutMs } from "./_lib/advisor-timing.js";

const CONTACT_URL = "/apps/site/Lumino%20联系.dc.html";

function json(response, status, body, extraHeaders = {}) {
  response.status(status);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(extraHeaders)) response.setHeader(key, value);
  response.end(JSON.stringify(body));
}

function createRequestAbort(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("advisor_timeout")), timeoutMs);
  const onClose = () => controller.abort(new Error("client_disconnected"));
  try {
    request?.socket?.once?.("close", onClose);
    request?.once?.("aborted", onClose);
  } catch (_) {}
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      try { request?.socket?.off?.("close", onClose); } catch (_) {}
    },
  };
}

function chunkText(text, size = ADVISOR_SSE_CHUNK_CHARS) {
  const value = String(text || "");
  if (!value) return [];
  const chunks = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks;
}

function writeSse(response, payload, { streamAnswer = false } = {}) {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");

  if (streamAnswer && payload?.answer) {
    response.write(`event: status\ndata: ${JSON.stringify({ phase: "printing" })}\n\n`);
    for (const delta of chunkText(payload.answer)) {
      response.write(`event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`);
    }
  }

  response.write(`event: advisor\ndata: ${JSON.stringify(payload)}\n\n`);
  response.write(`event: done\ndata: {}\n\n`);
  response.end();
}

function betaDisabledPayload(lang) {
  const result = stopWithoutSources(lang);
  result.intent = "beta_disabled";
  result.answer = lang === "en"
    ? "Ask Lumino is temporarily unavailable. Use the tools menu or the contact page for a scoped review."
    : "「问 Lumino」暂时不可用。请使用工具菜单，或通过联系页申请有范围的复核。";
  result.handoff = "contact";
  result.degradation_reason = "beta_disabled";
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
  result.degradation_reason = "privacy_guard";
  result.links = [{
    type: "contact",
    label: lang === "en" ? "Contact Lumino" : "联系 Lumino",
    url: `${CONTACT_URL}?source=homepage-advisor&topic=privacy`,
  }];
  result.cta = result.links[0];
  return result;
}

function unavailablePayload(lang, reason = "server_error") {
  const result = stopWithoutSources(lang);
  result.intent = "service_unavailable";
  result.degradation_reason = reason;
  result.answer = lang === "en"
    ? "The advisor service is temporarily unavailable. You can retry, choose a topic below, or use the contact page."
    : "顾问服务暂时不可用。你可以重试、选择下方话题，或通过联系页继续。";
  result.ui_state = "unavailable";
  return result;
}

async function resolveOpenQuestion(request, signal) {
  const hits = retrievePublishedKnowledge({
    text: request.text,
    lang: request.lang,
    asOf: request.asOf,
    limit: 3,
  });
  if (!hits.length) {
    const result = stopWithoutSources(request.lang);
    result.degradation_reason = "no_sources";
    result.ui_state = "no_sources";
    return { result, source: "no_sources", modelAttempted: false, modelFailed: false };
  }

  if (modelConfigured()) {
    try {
      const generated = await generateGroundedAnswer({
        text: request.text,
        lang: request.lang,
        hits,
        signal,
      });
      if (generated?.answer && generated.sources?.length) {
        const { runtime_model: runtimeModel, _allowedUrls, ...rest } = generated;
        rest.degradation_reason = null;
        rest.ui_state = "ok";
        return {
          result: rest,
          source: "retrieval_model",
          model: runtimeModel,
          modelAttempted: true,
          modelFailed: false,
        };
      }
      const grounded = buildGroundedFallback(hits, request.lang);
      grounded.degradation_reason = "model_empty";
      grounded.ui_state = "basic_mode";
      return {
        result: grounded,
        source: "retrieval_grounded",
        modelAttempted: true,
        modelFailed: true,
      };
    } catch (error) {
      const aborted = signal?.aborted || /abort|timeout|advisor_timeout|client_disconnected/i.test(String(error?.message || error));
      console.error("[lumino-advisor] model failed", error?.message || error);
      const grounded = buildGroundedFallback(hits, request.lang);
      grounded.degradation_reason = aborted ? "model_timeout" : "model_error";
      grounded.ui_state = "basic_mode";
      if (aborted && !hits.length) {
        return { result: unavailablePayload(request.lang, "model_timeout"), source: "error", modelAttempted: true, modelFailed: true };
      }
      return {
        result: grounded,
        source: "retrieval_grounded",
        modelAttempted: true,
        modelFailed: true,
      };
    }
  }

  const grounded = buildGroundedFallback(hits, request.lang);
  grounded.degradation_reason = "no_model";
  grounded.ui_state = "basic_mode";
  return {
    result: grounded,
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
    "X-Advisor-Client-Timeout-Ms": String(clientTimeoutMs()),
    "X-Advisor-Model-Timeout-Ms": String(modelTimeoutMs()),
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

  const abort = createRequestAbort(request, modelTimeoutMs());
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
      result.ui_state = result.ui_state || "ok";
      result.degradation_reason = result.degradation_reason || null;
      if (result.answer_mode === "fallback" && sanitized.request.text) {
        const open = await resolveOpenQuestion(sanitized.request, abort.signal);
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
        // Provider retention: capability-based. Do not advertise store:false on third-party gateways.
        storage_policy: model?.storage_policy || flags.storage_policy,
        store_requested: Boolean(model?.store_requested ?? flags.store_requested),
        lumino_conversation_store: false,
        public_beta: flags.public_beta,
        model_enabled: flags.model_enabled,
        lead_capture: false,
        latency_ms: latencyMs,
        degradation_reason: result.degradation_reason || null,
        ui_state: result.ui_state || "ok",
        client_timeout_ms: clientTimeoutMs(),
        model_timeout_ms: modelTimeoutMs(model?.tier || "luna"),
        cost_estimate_usd: null,
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
      degradation_reason: result.degradation_reason || null,
      ok: true,
    });
    console.info("[lumino-advisor]", publicLogFields({
      ...result,
      source,
      latency_ms: latencyMs,
      has_sources: Boolean(result.sources?.length),
      model_tier: model?.tier || null,
    }));

    if (wantsStream) return writeSse(response, payload, { streamAnswer: true });
    return json(response, 200, payload, rateHeaders);
  } catch (error) {
    console.error("[lumino-advisor] failed", error?.message || error);
    const latencyMs = Date.now() - started;
    const reason = /timeout|abort/i.test(String(error?.message || "")) ? "timeout" : "server_error";
    recordAdvisorMetric({
      type: "request",
      answer_mode: "fallback",
      source: "error",
      latency_ms: latencyMs,
      degradation_reason: reason,
      ok: false,
    });
    const fallback = unavailablePayload(sanitized.request.lang, reason);
    if (wantsStream) return writeSse(response, { ok: false, ...fallback }, { streamAnswer: true });
    return json(response, 503, { ok: false, ...fallback }, rateHeaders);
  } finally {
    abort.dispose();
  }
}
