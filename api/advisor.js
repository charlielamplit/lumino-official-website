/**
 * Public homepage advisor API (stateless)
 * - Deterministic fixed answers / tool routes first
 * - Else retrieve published knowledge; model only with grounded sources
 * - Phrase-chunk SSE for print-style UI; Abort cancels upstream model
 * - No conversation persistence / no sales leads
 */
import { checkRateLimit, clientKey, hasStaleReferenceDate, publicLogFields, sanitizeRequest } from "./_lib/advisor-policy.js";
import { modelConfigured, routeDeterministic } from "./_lib/advisor-runtime.js";
import { buildGroundedFallback, retrievePublishedKnowledge, stopWithoutSources } from "./_lib/advisor-retrieval.js";
import { generateGeneralAnswer, generateGroundedAnswer } from "./_lib/advisor-model.js";
import { getPublicFlags, publicBetaEnabled } from "./_lib/advisor-flags.js";
import { recordAdvisorMetric } from "./_lib/advisor-metrics-store.js";
import { ADVISOR_SSE_CHUNK_CHARS, clientTimeoutMs, modelTimeoutMs } from "./_lib/advisor-timing.js";

const CONTACT_URL = "/apps/site/contact.html";

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

function openSse(response, headers = {}) {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.flushHeaders?.();
}

function writeSseEvent(response, event, data) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function writeSse(response, payload, { streamAnswer = false, opened = false, headers = {} } = {}) {
  if (!opened) openSse(response, headers);

  if (streamAnswer && payload?.answer) {
    writeSseEvent(response, "status", { phase: "printing" });
    for (const delta of chunkText(payload.answer)) {
      writeSseEvent(response, "delta", { text: delta });
    }
  }

  writeSseEvent(response, "advisor", payload);
  writeSseEvent(response, "done", {});
  response.end();
}

function provisionalAnswer(lang) {
  return lang === "en"
    ? "Start with three facts: who is asking, the exact deliverable or decision, and the deadline. I’m now turning your question into a more specific answer."
    : "先确认三个事实：谁提出要求、需要什么具体交付物或判断、截止时间是什么。我正在结合你的问题补充更具体的答案。";
}

function betaDisabledPayload(lang) {
  const result = stopWithoutSources(lang);
  result.intent = "beta_disabled";
  result.outcome_type = "handoff";
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
  result.outcome_type = "handoff";
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

function outOfScopePayload(lang) {
  return {
    intent: "out_of_scope",
    answer_mode: "fallback",
    outcome_type: "clarify",
    answer: lang === "en"
      ? "I focus on CBAM, product carbon footprints, GHG inventories, ESG and export compliance. Reframe your question around a product, customer requirement, required file or deadline, and I can give you a concrete next step."
      : "我专注于 CBAM、产品碳足迹、碳盘查、ESG 与出口合规。请把问题改写为具体产品、客户要求、所需文件或截止时间，我可以继续给出明确的下一步。",
    confidence: "high",
    service_matches: [],
    next_question: lang === "en" ? "What product, requirement, deliverable or deadline do you need help with?" : "你需要处理的产品、要求、交付物或截止时间是什么？",
    suggested_replies: [],
    sources: [],
    links: [{ type: "link", label: lang === "en" ? "View Lumino services" : "查看 Lumino 服务", url: "/apps/site/home.html#services" }],
    cta: { type: "link", label: lang === "en" ? "View Lumino services" : "查看 Lumino 服务", url: "/apps/site/home.html#services" },
    handoff: "none",
    degradation_reason: null,
    ui_state: "ok",
  };
}

function inferServiceId(text) {
  const value = String(text || "").toLowerCase();
  if (/\bcbam\b|碳边境|cn code|进口商/.test(value)) return "cbam";
  if (/\bpcf\b|产品碳足迹|生命周期/.test(value)) return "pcf";
  if (/scope\s*[123]|碳盘查|温室气体|\bghg\b/.test(value)) return "inventory";
  if (/\besg\b|可持续报告/.test(value)) return "esg";
  if (/绿电|绿证|i-?rec|碳资产/.test(value)) return "assets";
  if (/eudr|csddd|出口合规|尽职调查/.test(value)) return "export";
  return "";
}

function asksForHumanService(text) {
  return /(人工|顾问|专家).{0,12}(复核|审核|联系|咨询|协助|服务)|(?:预约|委托|报价).{0,12}(顾问|咨询|复核|服务)|(?:联系|找).{0,8}(人工|顾问|专家)|(?:human|expert|consultant).{0,16}(review|help|service|contact)|(?:contact|talk to|quote).{0,16}(human|expert|consultant)/i.test(String(text || ""));
}

function needsClarification(text) {
  const value = String(text || "").trim();
  if (!/(碳合规|碳管理|可持续合规|出口合规|carbon compliance|sustainability compliance|export compliance)/i.test(value)) return false;
  return !/(cbam|pcf|产品|客户|进口商|报告|盘查|scope|ghg|esg|eudr|csddd|文件|模板|截止|国家|市场|行业|product|customer|report|deadline|country|market|industry)/i.test(value);
}

function humanServicePayload(request) {
  const lang = request.lang;
  const serviceId = inferServiceId(request.text);
  return {
    topic_id: "human-service",
    intent: "human_service",
    answer_mode: "fixed",
    outcome_type: "handoff",
    answer: lang === "en"
      ? "A scoped human review is appropriate. Before contacting Lumino, keep the original request, product or organisation boundary, reporting period and deadline together so the reviewer can act without asking you to repeat the basics."
      : "这个场景适合转人工复核。进入联系页前，请把原始要求、产品或组织边界、报告期间和截止时间放在一起，顾问即可据此开展有范围的复核，避免让你重复说明基础信息。",
    confidence: "high",
    service_matches: serviceId ? [{
      service_id: serviceId,
      reason: lang === "en" ? "Matched from the requested review topic." : "根据申请复核的主题匹配。",
      priority: 1,
    }] : [],
    next_question: null,
    suggested_replies: [],
    sources: [],
    links: [{
      type: "contact",
      label: lang === "en" ? "Request a human review" : "申请人工复核",
      url: `${CONTACT_URL}?source=homepage-advisor&topic=human-service${serviceId ? `&serviceId=${serviceId}` : ""}`,
    }],
    cta: {
      type: "contact",
      label: lang === "en" ? "Request a human review" : "申请人工复核",
      url: `${CONTACT_URL}?source=homepage-advisor&topic=human-service${serviceId ? `&serviceId=${serviceId}` : ""}`,
    },
    handoff: "expert_required",
    degradation_reason: null,
    ui_state: "ok",
  };
}

function clarificationPayload(request) {
  const result = routeDeterministic({ text: "", lang: request.lang });
  result.intent = "service_clarification";
  result.outcome_type = "clarify";
  result.handoff = "none";
  result.links = [{
    type: "link",
    label: request.lang === "en" ? "View service areas" : "查看服务范围",
    url: "/apps/site/home.html#services",
  }];
  result.cta = result.links[0];
  return result;
}

function inferOutcomeType(result) {
  if (["answer", "clarify", "tool", "handoff"].includes(result?.outcome_type)) return result.outcome_type;
  if (result?.answer_mode === "tool_route") return "tool";
  if (result?.handoff === "contact" || result?.handoff === "expert_required") return "handoff";
  if (result?.answer_mode === "fallback" && result?.next_question) return "clarify";
  return "answer";
}

function staleModelFallback(request, hits) {
  const result = hits.length ? buildGroundedFallback(hits, request.lang) : stopWithoutSources(request.lang);
  result.degradation_reason = "stale_reference_date";
  result.ui_state = "basic_mode";
  return {
    result,
    source: hits.length ? "retrieval_grounded" : "actionable_fallback",
    modelAttempted: true,
    modelFailed: true,
  };
}

function unavailablePayload(lang, reason = "server_error") {
  const result = stopWithoutSources(lang);
  result.intent = "service_unavailable";
  result.outcome_type = "handoff";
  result.degradation_reason = reason;
  result.answer = lang === "en"
    ? "The advisor service is temporarily unavailable. You can retry, choose a topic below, or use the contact page."
    : "顾问服务暂时不可用。你可以重试、选择下方话题，或通过联系页继续。";
  result.ui_state = "unavailable";
  return result;
}

function advisorUpstreamUrl() {
  const value = String(process.env.ADVISOR_UPSTREAM_URL || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : "";
  } catch (_) {
    return "";
  }
}

async function resolveUpstreamQuestion(request, signal) {
  const base = advisorUpstreamUrl();
  if (!base) return null;
  const response = await fetch(`${base}/api/advisor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const payload = await response.json();
  if (!response.ok || !payload?.answer) throw new Error(`advisor_upstream_${response.status}`);
  const { ok: _ok, runtime = {}, ...result } = payload;
  return {
    result,
    source: runtime.source || result.answer_mode || "actionable_fallback",
    model: {
      tier: runtime.model_tier || null,
      storage_policy: runtime.storage_policy,
      store_requested: runtime.store_requested,
    },
    modelAttempted: Boolean(runtime.model_configured),
    modelFailed: Boolean(runtime.degradation_reason?.startsWith("model_")),
  };
}

async function resolveOpenQuestion(request, signal, onDelta) {
  const inferredServiceId = inferServiceId(request.text);
  const hits = retrievePublishedKnowledge({
    text: request.text,
    lang: request.lang,
    asOf: request.asOf,
    limit: 3,
    serviceId: request.context?.serviceId || inferredServiceId,
  });
  if (advisorUpstreamUrl()) {
    try {
      const upstream = await resolveUpstreamQuestion(request, signal);
      return hasStaleReferenceDate(upstream.result.answer, request.asOf) ? staleModelFallback(request, hits) : upstream;
    } catch (error) {
      console.error("[lumino-advisor] upstream failed", error?.message || error);
      const result = hits.length ? buildGroundedFallback(hits, request.lang) : stopWithoutSources(request.lang);
      result.degradation_reason = "upstream_error";
      result.ui_state = "basic_mode";
      return {
        result,
        source: hits.length ? "retrieval_grounded" : "actionable_fallback",
        modelAttempted: true,
        modelFailed: true,
      };
    }
  }
  if (!hits.length) {
    if (modelConfigured()) {
      try {
        const generated = await generateGeneralAnswer({
          text: request.text,
          lang: request.lang,
          signal,
          request,
          onDelta,
        });
        if (generated?.answer) {
          if (hasStaleReferenceDate(generated.answer, request.asOf)) return staleModelFallback(request, hits);
          const { runtime_model: runtimeModel, ...rest } = generated;
          rest.degradation_reason = "no_published_sources";
          rest.ui_state = "ok";
          return {
            result: rest,
            source: "general_model",
            model: runtimeModel,
            modelAttempted: true,
            modelFailed: false,
          };
        }
        const result = stopWithoutSources(request.lang);
        result.degradation_reason = "model_empty";
        result.ui_state = "basic_mode";
        return { result, source: "actionable_fallback", modelAttempted: true, modelFailed: true };
      } catch (error) {
        const aborted = signal?.aborted || /abort|timeout|advisor_timeout|client_disconnected/i.test(String(error?.message || error));
        console.error("[lumino-advisor] general model failed", error?.message || error);
        const result = stopWithoutSources(request.lang);
        result.degradation_reason = aborted ? "model_timeout" : "model_error";
        result.ui_state = "basic_mode";
        return { result, source: "actionable_fallback", modelAttempted: true, modelFailed: true };
      }
    }
    const result = stopWithoutSources(request.lang);
    result.degradation_reason = "no_model";
    result.ui_state = "basic_mode";
    return { result, source: "actionable_fallback", modelAttempted: false, modelFailed: false };
  }

  if (process.env.ADVISOR_GROUNDED_MODEL_ENABLED !== "1") {
    const grounded = buildGroundedFallback(hits, request.lang);
    grounded.degradation_reason = null;
    grounded.ui_state = "ok";
    return {
      result: grounded,
      source: "retrieval_grounded",
      modelAttempted: false,
      modelFailed: false,
    };
  }

  if (modelConfigured()) {
    try {
      const generated = await generateGroundedAnswer({
        text: request.text,
        lang: request.lang,
        hits,
        signal,
        request,
      });
      if (generated?.answer && generated.sources?.length) {
        if (hasStaleReferenceDate(generated.answer, request.asOf)) return staleModelFallback(request, hits);
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
  let sseOpened = false;
  let modelStreamed = false;
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
    } else if (sanitized.outOfScope) {
      result = outOfScopePayload(sanitized.request.lang);
      source = "out_of_scope";
    } else if (asksForHumanService(sanitized.request.text)) {
      result = humanServicePayload(sanitized.request);
      source = "human_handoff";
    } else if (needsClarification(sanitized.request.text)) {
      result = clarificationPayload(sanitized.request);
      source = "clarification";
    } else {
      const portalOpenQuestion = sanitized.request.surface === "portal" && sanitized.request.text;
      result = portalOpenQuestion ? null : routeDeterministic(sanitized.request);
      if (portalOpenQuestion || (result.answer_mode === "fallback" && sanitized.request.text)) {
        if (wantsStream) {
          openSse(response, rateHeaders);
          sseOpened = true;
          writeSseEvent(response, "status", { phase: "working" });
          writeSseEvent(response, "provisional", { text: provisionalAnswer(sanitized.request.lang) });
        }
        const open = await resolveOpenQuestion(sanitized.request, abort.signal, wantsStream ? (delta) => {
          if (!delta || abort.signal.aborted) return;
          modelStreamed = true;
          writeSseEvent(response, "delta", { text: delta });
        } : null);
        result = open.result;
        source = open.source;
        model = open.model || null;
        modelAttempted = Boolean(open.modelAttempted);
        modelFailed = Boolean(open.modelFailed);
      }
      result.ui_state = result.ui_state || "ok";
      result.degradation_reason = result.degradation_reason || null;
    }

    result.outcome_type = inferOutcomeType(result);

    const latencyMs = Date.now() - started;
    const payload = {
      ok: true,
      ...result,
      runtime: {
        source,
        surface: sanitized.request.surface,
        model_configured: modelConfigured() || Boolean(advisorUpstreamUrl()),
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

    if (wantsStream) return writeSse(response, payload, {
      streamAnswer: !modelStreamed,
      opened: sseOpened,
      headers: rateHeaders,
    });
    return json(response, 200, payload, rateHeaders);
  } catch (error) {
    console.error("[lumino-advisor] failed", error?.message || error);
    const latencyMs = Date.now() - started;
    const reason = /timeout|abort/i.test(String(error?.message || "")) ? "timeout" : "server_error";
    try {
      recordAdvisorMetric({
        type: "request",
        answer_mode: "fallback",
        source: "error",
        latency_ms: latencyMs,
        degradation_reason: reason,
        ok: false,
      });
    } catch (_) {}
    try {
      const fallback = unavailablePayload(sanitized.request.lang, reason);
      if (wantsStream) return writeSse(response, { ok: false, ...fallback }, {
        streamAnswer: !modelStreamed,
        opened: sseOpened,
        headers: rateHeaders,
      });
      return json(response, 503, { ok: false, ...fallback }, rateHeaders);
    } catch (nested) {
      console.error("[lumino-advisor] unavailable payload failed", nested?.message || nested);
      return json(response, 503, {
        ok: false,
        answer_mode: "fallback",
        outcome_type: "handoff",
        ui_state: "unavailable",
        degradation_reason: reason,
        answer: sanitized.request.lang === "en"
          ? "The advisor is temporarily unavailable. Please try again or contact Lumino."
          : "顾问暂时不可用。请稍后重试，或通过联系页联络 Lumino。",
        links: [{ type: "contact", label: sanitized.request.lang === "en" ? "Contact Lumino" : "联系 Lumino", url: `${CONTACT_URL}?source=homepage-advisor&topic=unavailable` }],
        handoff: "contact",
      }, rateHeaders);
    }
  } finally {
    abort.dispose();
  }
}
