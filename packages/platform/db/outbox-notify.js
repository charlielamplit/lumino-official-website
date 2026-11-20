"use strict";

const leads = require("./leads-repository");
const pool = require("./pool");

function isWecomWebhook(url) {
  try {
    const host = new URL(url).host;
    return host === "qyapi.weixin.qq.com" || host.endsWith(".weixin.qq.com");
  } catch {
    return false;
  }
}

function buildWecomMarkdown(lead) {
  const portalBase = String(process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "") || "https://www.luminoyou.cn";
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

async function postWebhook(url, body, { fetchImpl = fetch } = {}) {
  const upstream = await fetchImpl(url, {
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

function safeWorkerLog(summary) {
  return {
    at: new Date().toISOString(),
    claimed: summary.claimed,
    sent: summary.sent,
    failed: summary.failed,
    skipped: summary.skipped,
    dead: summary.dead,
    reason: summary.reason || undefined,
  };
}

async function drainOutboxBatch(
  {
    limit = 20,
    leadPublicId = null,
    leaseSeconds,
    wecomUrl = process.env.WECOM_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL,
    fetchImpl = fetch,
  } = {},
  options = {},
) {
  const url = String(wecomUrl || "").trim();
  if (!url || !isWecomWebhook(url)) {
    return { claimed: 0, sent: 0, failed: 0, skipped: 0, dead: 0, reason: "webhook_not_configured" };
  }

  pool.requireDatabaseUrl();
  const claimed = await leads.claimPendingOutbox({ limit, leadPublicId, leaseSeconds }, options);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let dead = 0;
  const maxAttempts = Number(process.env.OUTBOX_MAX_ATTEMPTS || 8);

  for (const row of claimed) {
    if (row.channel !== "wecom") {
      await leads.markOutboxFailed(row.id, "unsupported_channel", { ...options, attempts: maxAttempts });
      skipped += 1;
      dead += 1;
      continue;
    }
    try {
      const publicId = row.payload?.publicId;
      if (!publicId) {
        await leads.markOutboxFailed(row.id, "payload_missing_public_id", { ...options, attempts: row.attempts });
        failed += 1;
        continue;
      }
      const lead = await leads.getLeadByPublicId(
        { tenantId: row.tenant_id, publicId },
        options,
      );
      if (!lead) {
        await leads.markOutboxFailed(row.id, "lead_missing", { ...options, attempts: row.attempts });
        failed += 1;
        continue;
      }
      const result = await postWebhook(
        url,
        {
          msgtype: "markdown",
          markdown: { content: buildWecomMarkdown(lead) },
        },
        { fetchImpl },
      );
      if (result.ok) {
        await leads.markOutboxSent(row.id, options);
        sent += 1;
      } else {
        await leads.markOutboxFailed(row.id, result.detail, { ...options, attempts: row.attempts });
        failed += 1;
      }
    } catch (error) {
      await leads.markOutboxFailed(row.id, error.code || "error", { ...options, attempts: row.attempts });
      failed += 1;
    }
  }

  return { claimed: claimed.length, sent, failed, skipped, dead };
}

module.exports = {
  isWecomWebhook,
  buildWecomMarkdown,
  postWebhook,
  drainOutboxBatch,
  safeWorkerLog,
};
