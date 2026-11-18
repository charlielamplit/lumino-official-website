/**
 * Lead intake API (PostgreSQL phase-1)
 *
 * Failure strategy:
 * 1. Validate → persist to Postgres (leads + outbox same transaction).
 * 2. If DB fails → 503 / DEPENDENCY_UNAVAILABLE (never fall back to JSON/memory).
 * 3. Notification is queued via outbox; worker/best-effort drain may send WeCom.
 * 4. Actor/tenant/role always come from server session — never from request body.
 *
 * Responses follow Platform API Response Contract v1.
 */
import { createLead, getLead, listLeads, updateLead } from "./_lib/leads-store.js";
import { platformDb } from "./_lib/platform-db.js";
import {
  createRequestId,
  sendSuccess,
  sendError,
  sendDomainError,
} from "./_lib/platform-api-response.js";

const PHONE_CN = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_CHARS = 32_000;

function extractBearerOrStaffToken(request) {
  const headerKey = String(request.headers["x-lumino-staff-key"] || "").trim();
  if (headerKey) return headerKey;
  const auth = String(request.headers.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

const STAFF_LEAD_ROLES = new Set(["ops", "sales", "admin"]);

function assertLeadStaffRole(roles) {
  const list = Array.isArray(roles) ? roles : [];
  if (!list.some((role) => STAFF_LEAD_ROLES.has(String(role)))) {
    const error = new Error("Forbidden role");
    error.httpStatus = 403;
    error.code = "FORBIDDEN_ROLE";
    throw error;
  }
}

async function requireStaffActor(request) {
  if (request.query?.key) {
    const error = new Error("Auth query key rejected");
    error.httpStatus = 401;
    error.code = "AUTH_QUERY_KEY_REJECTED";
    throw error;
  }
  const token = extractBearerOrStaffToken(request);
  if (!token) {
    const error = new Error("Authentication required");
    error.httpStatus = 401;
    error.code = "AUTH_REQUIRED";
    throw error;
  }
  const session = await platformDb.resolveSession(token);
  if (!session?.userId || !session?.activeTenantId) {
    const error = new Error("Authentication required");
    error.httpStatus = 401;
    error.code = "AUTH_REQUIRED";
    throw error;
  }
  const roles = session.roles || [];
  assertLeadStaffRole(roles);
  return {
    userId: session.userId,
    tenantId: session.activeTenantId,
    email: session.email,
    name: session.name,
    roles,
  };
}

function normalizeServices(body) {
  if (Array.isArray(body.services)) return body.services.map((s) => String(s).trim()).filter(Boolean);
  if (Array.isArray(body.serviceIds)) return body.serviceIds.map((s) => String(s).trim()).filter(Boolean);
  const raw = String(body.serviceId || body.services || "").trim();
  if (!raw) return [];
  return raw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
}

function isWecomWebhook(url) {
  try {
    const host = new URL(url).host;
    return host === "qyapi.weixin.qq.com" || host.endsWith(".weixin.qq.com");
  } catch {
    return false;
  }
}

function buildWecomMarkdown(lead) {
  const portalBase = String(process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "") || "https://www.luminoyou.com";
  const services = (lead.services || []).join("、") || "—";
  return [
    `## 新线索 <font color="warning">${lead.id}</font>`,
    `>公司：<font color="comment">${lead.company}</font>`,
    `>联系人：<font color="comment">${lead.name}</font>`,
    `>电话：<font color="comment">${lead.phone || "—"}</font>`,
    `>邮箱：<font color="comment">${lead.email || "—"}</font>`,
    `>服务：<font color="comment">${services}</font>`,
    `>来源：<font color="comment">${lead.source || "—"}</font>`,
    `>说明：${String(lead.note || "—").slice(0, 400)}`,
    `[打开线索收件箱](${portalBase}/portal/)`,
  ].join("\n");
}

async function postWebhook(url, body) {
  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await upstream.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const wecomFail = parsed && typeof parsed.errcode === "number" && parsed.errcode !== 0;
  if (!upstream.ok || wecomFail) {
    const detail = wecomFail ? `errcode_${parsed.errcode}` : `status_${upstream.status}`;
    return { ok: false, detail };
  }
  return { ok: true, detail: "ok" };
}

async function drainOutboxOnce(leadPublicId) {
  const wecomUrl = String(process.env.WECOM_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL || "").trim();
  if (!wecomUrl || !isWecomWebhook(wecomUrl)) {
    return { notified: false, notifyStatus: "queued", results: { wecom: "not_configured" } };
  }

  const claimed = await platformDb.claimPendingOutbox({ limit: 1, leadPublicId });
  let notified = false;
  const results = { wecom: null, webhook: null, email: null };

  for (const row of claimed) {
    if (row.channel !== "wecom") continue;
    try {
      const lead = await platformDb.getLeadByPublicId({
        tenantId: row.tenant_id,
        publicId: row.payload?.publicId || leadPublicId,
      });
      if (!lead) {
        await platformDb.markOutboxFailed(row.id, "lead_missing", { attempts: row.attempts });
        continue;
      }
      const sent = await postWebhook(wecomUrl, {
        msgtype: "markdown",
        markdown: { content: buildWecomMarkdown(lead) },
      });
      if (sent.ok) {
        await platformDb.markOutboxSent(row.id);
        notified = true;
        results.wecom = "ok";
      } else {
        await platformDb.markOutboxFailed(row.id, sent.detail, { attempts: row.attempts });
        results.wecom = sent.detail;
      }
    } catch (error) {
      await platformDb.markOutboxFailed(row.id, error.code || "error", { attempts: row.attempts });
      results.wecom = "error";
    }
  }

  return {
    notified,
    notifyStatus: notified ? "sent" : "queued",
    results,
  };
}

function validationError(fieldErrors) {
  const error = new Error("Validation failed");
  error.code = "VALIDATION_FAILED";
  error.httpStatus = 400;
  error.fieldErrors = fieldErrors;
  return error;
}

export default async function handler(request, response) {
  const requestId = createRequestId(request);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    try {
      const actor = await requireStaffActor(request);
      const id = request.query?.id;
      if (id) {
        const lead = await getLead(String(id), actor);
        if (!lead) return sendError(response, "RESOURCE_NOT_FOUND", { requestId });
        return sendSuccess(response, { lead }, { requestId, revision: lead.revision });
      }
      const leads = await listLeads(actor);
      return sendSuccess(response, { leads }, { requestId });
    } catch (error) {
      return sendDomainError(response, error, { requestId });
    }
  }

  if (request.method === "PATCH") {
    try {
      const actor = await requireStaffActor(request);
      const body = request.body || {};
      const id = String(body.id || request.query?.id || "").trim();
      if (!id) {
        return sendError(response, "VALIDATION_FAILED", {
          requestId,
          fieldErrors: [{ field: "id", code: "REQUIRED", messageKey: "api.field_required" }],
        });
      }
      const { lead, persisted } = await updateLead(
        id,
        {
          status: body.status,
          note: body.note,
          claim: body.status === "claimed" || body.claim === true,
        },
        actor,
      );
      if (!lead) return sendError(response, "RESOURCE_NOT_FOUND", { requestId });
      return sendSuccess(response, { lead, persisted }, { requestId, revision: lead.revision });
    } catch (error) {
      return sendDomainError(response, error, { requestId });
    }
  }

  if (request.method !== "POST") {
    return sendError(response, "METHOD_NOT_ALLOWED", { requestId });
  }

  const rawSize = Number(request.headers["content-length"] || 0);
  if (rawSize > MAX_BODY_CHARS) {
    return sendError(response, "VALIDATION_FAILED", {
      requestId,
      fieldErrors: [{ field: "body", code: "TOO_LARGE", messageKey: "api.field_too_large" }],
    });
  }

  const body = request.body || {};
  const company = String(body.company || "").trim();
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const industry = String(body.industry || "").trim();
  const timeline = String(body.timeline || "").trim();
  let note = String(body.note || body.message || "").trim();
  const services = normalizeServices(body);
  const consent = body.consent === true || body.consent === "on" || body.consent === "true" || body.consent === "1";
  const requestType = String(body.requestType || "service-consultation").slice(0, 80);

  const fieldErrors = [];
  if (!company) fieldErrors.push({ field: "company", code: "REQUIRED", messageKey: "api.field_required" });
  if (!name) fieldErrors.push({ field: "name", code: "REQUIRED", messageKey: "api.field_required" });
  if (!consent) fieldErrors.push({ field: "consent", code: "REQUIRED", messageKey: "api.field_required" });
  if (!phone && !email) {
    fieldErrors.push({ field: "email", code: "REQUIRED_ONE_OF", messageKey: "api.field_required" });
    fieldErrors.push({ field: "phone", code: "REQUIRED_ONE_OF", messageKey: "api.field_required" });
  }
  if (phone) {
    const compact = phone.replace(/\s+/g, "");
    if (requestType !== "service-consultation" && body.source === "lumino-cbam-calculator") {
      if (!PHONE_CN.test(compact)) fieldErrors.push({ field: "phone", code: "INVALID", messageKey: "api.field_invalid" });
    } else if (!PHONE_CN.test(compact) && compact.length < 5) {
      fieldErrors.push({ field: "phone", code: "INVALID", messageKey: "api.field_invalid" });
    }
  }
  if (email && !EMAIL_RE.test(email)) {
    fieldErrors.push({ field: "email", code: "INVALID", messageKey: "api.field_invalid" });
  }
  if (!note && body.context) {
    const ctx = body.context;
    note = `试算线索：${ctx.sector || ""} CN ${ctx.cnCode || ""} · ${ctx.quantity || ""} t · 估算 ¥${ctx.estimatedCostCny || "—"}`.trim();
  }
  if (!note) fieldErrors.push({ field: "note", code: "REQUIRED", messageKey: "api.field_required" });
  if (fieldErrors.length) {
    return sendError(response, "VALIDATION_FAILED", { requestId, fieldErrors });
  }

  const record = {
    source: String(body.source || "lumino-website").slice(0, 120),
    company: company.slice(0, 120),
    name: name.slice(0, 80),
    phone: phone.slice(0, 40),
    email: email.slice(0, 120),
    industry: industry.slice(0, 80),
    timeline: timeline.slice(0, 120),
    services,
    note: note.slice(0, 4000),
    requestType,
    consent: true,
    noticeVersion: String(body.noticeVersion || "v1").slice(0, 40),
    context: body.context || null,
    userAgent: request.headers["user-agent"] || "",
    isDemo: body.isDemo === true,
  };

  let created;
  try {
    created = await createLead(record);
  } catch (error) {
    console.error("[lumino-lead] persist failed", error && error.code ? error.code : "error");
    return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
  }

  let notify = { notified: false, notifyStatus: "queued", results: { wecom: "queued" } };
  try {
    notify = await drainOutboxOnce(created.lead.id);
  } catch (error) {
    console.error("[lumino-lead] outbox drain failed", error && error.code ? error.code : "error");
  }

  return sendSuccess(response, {
    leadId: created.lead.id,
    status: created.lead.status,
    persisted: true,
    notified: notify.notified,
    notifyStatus: notify.notifyStatus || "queued",
    notify: notify.results,
    lead: created.lead,
  }, { requestId, revision: created.lead.revision });
}
