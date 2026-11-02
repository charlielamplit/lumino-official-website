import { checkRateLimit, clientKey } from "./_lib/advisor-policy.js";
import { getAdvisorMetricsSummary, recordAdvisorMetric } from "./_lib/advisor-metrics-store.js";

function staffAuthorized(request) {
  const expected = process.env.LEADS_STAFF_KEY || process.env.ADVISOR_STAFF_KEY || "";
  if (!expected) return false;
  const provided = request.headers?.["x-lumino-staff-key"] || request.headers?.["x-advisor-staff-key"] || "";
  return provided && provided === expected;
}

function readBody(request) {
  let body = request.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  return body && typeof body === "object" ? body : {};
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method === "GET") {
    if (!staffAuthorized(request)) {
      response.status(401).end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    response.status(200).end(JSON.stringify({ ok: true, ...getAdvisorMetricsSummary() }));
    return;
  }

  if (request.method !== "POST") {
    response.status(405).end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  const rate = checkRateLimit(`metrics:${clientKey(request)}`);
  if (!rate.ok) {
    response.status(429).end(JSON.stringify({ error: "Too Many Requests" }));
    return;
  }

  const body = readBody(request);
  const type = body.type === "cta" ? "cta" : "client";
  // Never accept raw question text / PII from the browser.
  recordAdvisorMetric({
    type,
    answer_mode: body.answer_mode,
    source: body.source,
    handoff: body.handoff,
    has_sources: Boolean(body.has_sources),
    cta_type: body.cta_type,
    latency_ms: body.latency_ms,
    ok: body.ok !== false,
  });
  response.status(202).end(JSON.stringify({ ok: true }));
}
