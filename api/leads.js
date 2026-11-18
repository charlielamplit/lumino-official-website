/**
 * Lead intake API (PostgreSQL phase-1)
 *
 * Failure strategy:
 * 1. Validate → persist to Postgres (leads + outbox same transaction).
 * 2. If DB fails → 503 (never fall back to JSON/memory, never fake success).
 * 3. Notification is queued via outbox; worker/best-effort drain may send WeCom.
 * 4. Actor/tenant/role always come from server session — never from request body.
 */
import { createLead, getLead, listLeads, updateLead } from "./_lib/leads-store.js";
import { platformDb } from "./_lib/platform-db.js";

const PHONE_CN = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_CHARS = 32_000;

function json(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

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
    const error = new Error("权限不足");
    error.httpStatus = 403;
    error.code = "FORBIDDEN_ROLE";
    throw error;
  }
}

async function requireStaffActor(request) {
  // URL ?key= is intentionally rejected in phase-1.
  if (request.query?.key) {
    const error = new Error("未授权");
    error.httpStatus = 401;
    error.code = "AUTH_QUERY_KEY_REJECTED";
    throw error;
  }
  const token = extractBearerOrStaffToken(request);
  if (!token) {
    const error = new Error("未授权");
    error.httpStatus = 401;
    error.code = "AUTH_REQUIRED";
    throw error;
  }
  const session = await platformDb.resolveSession(token);
  if (!session?.userId || !session?.activeTenantId) {
    const error = new Error("未授权");
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

  // Only claim the just-created lead's outbox row — never drain historical backlog on POST.
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

export default async function handler(request, response) {
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
        if (!lead) return json(response, 404, { error: "线索不存在" });
        return json(response, 200, { ok: true, lead });
      }
      const leads = await listLeads(actor);
      return json(response, 200, { ok: true, leads });
    } catch (error) {
      return json(response, error.httpStatus || 503, { error: error.message || "查询失败" });
    }
  }

  if (request.method === "PATCH") {
    try {
      const actor = await requireStaffActor(request);
      const body = request.body || {};
      // Ignore client-supplied actor / claimedBy for authority.
      const id = String(body.id || request.query?.id || "").trim();
      if (!id) return json(response, 400, { error: "缺少线索编号" });
      const { lead, persisted } = await updateLead(
        id,
        {
          status: body.status,
          note: body.note,
          claim: body.status === "claimed" || body.claim === true,
        },
        actor,
      );
      if (!lead) return json(response, 404, { error: "线索不存在" });
      return json(response, 200, { ok: true, lead, persisted });
    } catch (error) {
      return json(response, error.httpStatus || 400, { error: error.message || "更新失败" });
    }
  }

  if (request.method !== "POST") return json(response, 405, { error: "Method Not Allowed" });

  const rawSize = Number(request.headers["content-length"] || 0);
  if (rawSize > MAX_BODY_CHARS) {
    return json(response, 413, { error: "请求过大" });
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

  if (!company) return json(response, 400, { error: "请填写公司名称" });
  if (!name) return json(response, 400, { error: "请填写姓名" });
  if (!consent) return json(response, 400, { error: "请同意联系授权后再提交" });
  if (!phone && !email) return json(response, 400, { error: "请至少填写工作邮箱或电话 / 微信" });
  if (phone) {
    const compact = phone.replace(/\s+/g, "");
    if (requestType !== "service-consultation" && body.source === "lumino-cbam-calculator") {
      if (!PHONE_CN.test(compact)) return json(response, 400, { error: "请填写有效的 11 位手机号" });
    } else if (!PHONE_CN.test(compact) && compact.length < 5) {
      return json(response, 400, { error: "请填写有效的联系电话或微信" });
    }
  }
  if (email && !EMAIL_RE.test(email)) return json(response, 400, { error: "请填写有效的工作邮箱" });
  if (!note && body.context) {
    const ctx = body.context;
    note = `试算线索：${ctx.sector || ""} CN ${ctx.cnCode || ""} · ${ctx.quantity || ""} t · 估算 ¥${ctx.estimatedCostCny || "—"}`.trim();
  }
  if (!note) return json(response, 400, { error: "请填写需求说明" });

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
    return json(response, 503, { error: "线索暂存失败，请稍后重试" });
  }

  // Best-effort outbox drain; lead already committed.
  let notify = { notified: false, notifyStatus: "queued", results: { wecom: "queued" } };
  try {
    notify = await drainOutboxOnce(created.lead.id);
  } catch (error) {
    console.error("[lumino-lead] outbox drain failed", error && error.code ? error.code : "error");
  }

  return json(response, 200, {
    ok: true,
    leadId: created.lead.id,
    status: created.lead.status,
    persisted: true,
    notified: notify.notified,
    notifyStatus: notify.notifyStatus || "queued",
    notify: notify.results,
  });
}
