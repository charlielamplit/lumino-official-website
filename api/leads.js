/**
 * Lead intake API
 *
 * Failure strategy:
 * 1. Validate → persist first (file /tmp or data/leads.json + memory).
 * 2. If persist fails → 503 (do not claim delivery).
 * 3. Notify via LEAD_WEBHOOK_URL and/or Resend (LEAD_NOTIFY_EMAIL + RESEND_API_KEY).
 * 4. Persist OK + notify fail → still 200 with notified:false (inbox remains source of truth).
 * 5. CRM webhook is the same LEAD_WEBHOOK_URL; no separate CRM required in v1.
 */
import { createLead, getLead, listLeads, updateLead } from "./_lib/leads-store.js";

const PHONE_CN = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function staffAuthorized(request) {
  const expected = process.env.LEADS_STAFF_KEY;
  if (!expected) return true; // prototype: open staff read/write; set LEADS_STAFF_KEY in production
  const header = request.headers["x-lumino-staff-key"] || "";
  const query = request.query?.key || "";
  return header === expected || query === expected;
}

function normalizeServices(body) {
  if (Array.isArray(body.services)) return body.services.map((s) => String(s).trim()).filter(Boolean);
  if (Array.isArray(body.serviceIds)) return body.serviceIds.map((s) => String(s).trim()).filter(Boolean);
  const raw = String(body.serviceId || body.services || "").trim();
  if (!raw) return [];
  return raw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
}

async function notifyLead(lead) {
  const results = { webhook: null, email: null };
  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    try {
      const upstream = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
        signal: AbortSignal.timeout(8000),
      });
      results.webhook = upstream.ok ? "ok" : `status_${upstream.status}`;
      if (!upstream.ok) console.error("[lumino-lead] webhook failed", upstream.status, lead.id);
    } catch (error) {
      results.webhook = "error";
      console.error("[lumino-lead] webhook error", error, lead.id);
    }
  }

  const notifyEmail = process.env.LEAD_NOTIFY_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  if (notifyEmail && resendKey) {
    try {
      const from = process.env.LEAD_NOTIFY_FROM || "Lumino Leads <onboarding@resend.dev>";
      const text = [
        `新线索 ${lead.id}`,
        `公司：${lead.company}`,
        `联系人：${lead.name}`,
        `手机：${lead.phone || "—"}`,
        `邮箱：${lead.email || "—"}`,
        `服务：${(lead.services || []).join(", ") || "—"}`,
        `行业：${lead.industry || "—"}`,
        `说明：${lead.note || "—"}`,
        `来源：${lead.source}`,
        `时间：${lead.createdAt}`,
      ].join("\n");
      const upstream = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [notifyEmail],
          subject: `[Lumino] 新线索 ${lead.company} · ${lead.id}`,
          text,
        }),
        signal: AbortSignal.timeout(8000),
      });
      results.email = upstream.ok ? "ok" : `status_${upstream.status}`;
      if (!upstream.ok) console.error("[lumino-lead] email failed", await upstream.text());
    } catch (error) {
      results.email = "error";
      console.error("[lumino-lead] email error", error, lead.id);
    }
  }

  const notified = results.webhook === "ok" || results.email === "ok";
  const configured = Boolean(webhook || (notifyEmail && resendKey));
  return { notified, configured, results };
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    if (!staffAuthorized(request)) return json(response, 401, { error: "未授权" });
    const id = request.query?.id;
    if (id) {
      const lead = getLead(String(id));
      if (!lead) return json(response, 404, { error: "线索不存在" });
      return json(response, 200, { ok: true, lead });
    }
    return json(response, 200, { ok: true, leads: listLeads() });
  }

  if (request.method === "PATCH") {
    if (!staffAuthorized(request)) return json(response, 401, { error: "未授权" });
    const body = request.body || {};
    const id = String(body.id || request.query?.id || "").trim();
    if (!id) return json(response, 400, { error: "缺少线索编号" });
    try {
      const { lead, persisted } = updateLead(id, body, body.actor || "staff");
      if (!lead) return json(response, 404, { error: "线索不存在" });
      if (!persisted) console.warn("[lumino-lead] patch memory-only", id);
      return json(response, 200, { ok: true, lead, persisted });
    } catch (error) {
      return json(response, 400, { error: error.message || "更新失败" });
    }
  }

  if (request.method !== "POST") return json(response, 405, { error: "Method Not Allowed" });

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
    // 试算等场景仍要求中国大陆手机号；联系页允许手机或微信号
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
    context: body.context || null,
    userAgent: request.headers["user-agent"] || "",
  };

  let created;
  try {
    created = createLead(record);
  } catch (error) {
    console.error("[lumino-lead] persist failed", error, record);
    return json(response, 503, { error: "线索暂存失败，请稍后重试" });
  }

  if (!created.persisted) {
    console.warn("[lumino-lead] persisted to memory only", created.lead.id);
  }

  const notify = await notifyLead(created.lead);
  if (!notify.configured) {
    console.warn("[lumino-lead] no LEAD_WEBHOOK_URL / Resend configured; inbox-only", created.lead.id);
  }

  return json(response, 200, {
    ok: true,
    leadId: created.lead.id,
    status: created.lead.status,
    persisted: created.persisted,
    notified: notify.notified,
    notify: notify.results,
  });
}
