/**
 * Public homepage advisor API (stateless)
 * - Always prefers deterministic fixed answers / tool routes.
 * - Model retrieval belongs to F08-04; without a key we safely fall back.
 * - Does not persist conversations or create sales leads.
 */
import { checkRateLimit, clientKey, publicLogFields, sanitizeRequest } from "./_lib/advisor-policy.js";
import { modelConfigured, routeDeterministic } from "./_lib/advisor-runtime.js";

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

function sensitiveResponse(lang) {
  return routeDeterministic({
    text: "",
    lang,
    topicId: "",
  });
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

  try {
    let result;
    if (sanitized.sensitive) {
      result = sensitiveResponse(sanitized.request.lang);
      result.answer = sanitized.request.lang === "en"
        ? "The input may contain contact or identity details. It was not stored. Use the controlled contact page if you want Lumino to contact you."
        : "?????????????????????????????????????";
      result.next_question = null;
      result.suggested_replies = [];
      result.answer_mode = "fallback";
      result.confidence = "low";
      result.handoff = "contact";
      result.sources = [];
      result.links = [{
        type: "contact",
        label: sanitized.request.lang === "en" ? "Contact Lumino" : "?? Lumino",
        url: "/apps/site/Lumino%20??.dc.html?source=homepage-advisor&topic=privacy",
      }];
      result.cta = result.links[0];
    } else {
      result = routeDeterministic(sanitized.request);
      // F08-04 will call the model only when deterministic mode is fallback AND a key exists.
      // For F08-03 we keep the deterministic result even when a key is present.
      if (result.answer_mode === "fallback" && !modelConfigured()) {
        result.meta = { model: "disabled" };
      }
    }

    const payload = {
      ok: true,
      ...result,
      runtime: {
        source: "deterministic",
        model_configured: modelConfigured(),
        store: false,
      },
    };

    console.info("[lumino-advisor]", publicLogFields({
      ...result,
      source: "deterministic",
    }));

    if (wantsStream) return writeSse(response, payload);
    return json(response, 200, payload, rateHeaders);
  } catch (error) {
    console.error("[lumino-advisor] failed", error?.message || error);
    const fallback = routeDeterministic({ lang: sanitized.request.lang, text: "" });
    fallback.answer = sanitized.request.lang === "en"
      ? "The advisor service is temporarily unavailable. Choose a topic below, or use the contact page."
      : "???????????????????????????";
    fallback.answer_mode = "fallback";
    fallback.confidence = "low";
    fallback.handoff = "contact";
    if (wantsStream) return writeSse(response, { ok: false, ...fallback });
    return json(response, 503, { ok: false, ...fallback }, rateHeaders);
  }
}
