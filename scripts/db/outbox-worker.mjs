#!/usr/bin/env node
/**
 * Independent outbox worker for WeCom (and future channels).
 *
 * Usage:
 *   DATABASE_URL=... WECOM_WEBHOOK_URL=... node scripts/db/outbox-worker.mjs
 *   DATABASE_URL=... node scripts/db/outbox-worker.mjs --once --limit=20
 *
 * Does not write leads. Claims outbox rows with lease / dead-letter semantics
 * from packages/platform/db. Safe to run alongside API best-effort single-lead drain.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const platformDb = require(path.join(root, "packages/platform/db/index.js"));

const once = process.argv.includes("--once");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const pollArg = process.argv.find((arg) => arg.startsWith("--poll-ms="));
const limit = Math.max(1, Number(limitArg?.split("=")[1] || 20));
const pollMs = Math.max(1000, Number(pollArg?.split("=")[1] || 5000));

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
  const services = (lead.services || []).join("?") || "—";
  return [
    `## ??? <font color="warning">${lead.id}</font>`,
    `>???<font color="comment">${lead.company}</font>`,
    `>????<font color="comment">${lead.name}</font>`,
    `>???<font color="comment">${lead.phone || "—"}</font>`,
    `>???<font color="comment">${lead.email || "—"}</font>`,
    `>???<font color="comment">${services}</font>`,
    `>???<font color="comment">${lead.source || "—"}</font>`,
    `>???${String(lead.note || "—").slice(0, 400)}`,
    `[???????](${portalBase}/portal/)`,
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

async function drainBatch() {
  const wecomUrl = String(process.env.WECOM_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL || "").trim();
  if (!wecomUrl || !isWecomWebhook(wecomUrl)) {
    return { claimed: 0, sent: 0, failed: 0, skipped: 0, reason: "webhook_not_configured" };
  }

  platformDb.assertPostgresMode();
  const claimed = await platformDb.claimPendingOutbox({ limit });
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of claimed) {
    if (row.channel !== "wecom") {
      skipped += 1;
      await platformDb.markOutboxFailed(row.id, "unsupported_channel", { attempts: row.attempts });
      continue;
    }
    try {
      const publicId = row.payload?.publicId;
      if (!publicId) {
        failed += 1;
        await platformDb.markOutboxFailed(row.id, "payload_missing_public_id", { attempts: row.attempts });
        continue;
      }
      const lead = await platformDb.getLeadByPublicId({
        tenantId: row.tenant_id,
        publicId,
      });
      if (!lead) {
        failed += 1;
        await platformDb.markOutboxFailed(row.id, "lead_missing", { attempts: row.attempts });
        continue;
      }
      const result = await postWebhook(wecomUrl, {
        msgtype: "markdown",
        markdown: { content: buildWecomMarkdown(lead) },
      });
      if (result.ok) {
        await platformDb.markOutboxSent(row.id);
        sent += 1;
      } else {
        await platformDb.markOutboxFailed(row.id, result.detail, { attempts: row.attempts });
        failed += 1;
      }
    } catch (error) {
      await platformDb.markOutboxFailed(row.id, error.code || "error", { attempts: row.attempts });
      failed += 1;
    }
  }

  return { claimed: claimed.length, sent, failed, skipped };
}

async function main() {
  platformDb.assertPostgresMode();
  if (once) {
    const summary = await drainBatch();
    console.log(JSON.stringify({ ok: true, mode: "once", ...summary }, null, 2));
    await platformDb.closePool();
    return;
  }

  console.log(JSON.stringify({ ok: true, mode: "loop", limit, pollMs }, null, 2));
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const summary = await drainBatch();
      if (summary.claimed > 0 || summary.reason) {
        console.log(JSON.stringify({ at: new Date().toISOString(), ...summary }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        at: new Date().toISOString(),
        error: error.code || "worker_error",
      }));
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

main().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, error: error.code || error.message || "fatal" }));
  try {
    await platformDb.closePool();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
