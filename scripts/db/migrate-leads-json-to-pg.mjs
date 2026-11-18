#!/usr/bin/env node
/**
 * Idempotent JSON -> Postgres leads import.
 * Usage:
 *   DATABASE_URL=... node scripts/db/migrate-leads-json-to-pg.mjs [--dry-run] [path/to/leads.json]
 *
 * --dry-run: read-only plan (no migrate/bootstrap/writes). Counts would_insert / would_update.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const platformDb = require(path.join(root, "packages/platform/db/index.js"));

const dryRun = process.argv.includes("--dry-run");
const fileArg = process.argv.find((arg, index) => index >= 2 && !arg.startsWith("--"));
const jsonPath = path.resolve(fileArg || path.join(root, "data/leads.json"));

function loadJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const leads = Array.isArray(raw?.leads) ? raw.leads : Array.isArray(raw) ? raw : [];
  return { raw, leads, sha256: crypto.createHash("sha256").update(JSON.stringify(raw)).digest("hex") };
}

function publicIdOf(lead) {
  return String(lead.id || lead.public_id || "").trim();
}

async function syncDailyCounters(client, tenantId, publicIds) {
  const byDay = new Map();
  for (const publicId of publicIds) {
    const match = /^LM-(\d{4})(\d{2})(\d{2})-(\d+)$/.exec(publicId);
    if (!match) continue;
    const day = `${match[1]}-${match[2]}-${match[3]}`;
    const seq = Number(match[4]);
    const prev = byDay.get(day) || 0;
    if (seq > prev) byDay.set(day, seq);
  }
  for (const [day, seq] of byDay) {
    await client.query(
      `INSERT INTO lead_daily_counters (tenant_id, day, seq)
       VALUES ($1, $2::date, $3)
       ON CONFLICT (tenant_id, day)
       DO UPDATE SET seq = GREATEST(lead_daily_counters.seq, EXCLUDED.seq)`,
      [tenantId, day, seq],
    );
  }
}

const snapshot = loadJson(jsonPath);

const summary = {
  file: jsonPath,
  sha256: snapshot.sha256,
  total: snapshot.leads.length,
  inserted: 0,
  updated: 0,
  would_insert: 0,
  would_update: 0,
  skipped: 0,
  failed: [],
  dryRun,
};

if (dryRun) {
  // Read-only: do not migrate schema or bootstrap staff.
  const tenantId = await platformDb.withClient(async (client) => {
    const existing = await client.query(
      `SELECT id FROM tenants WHERE slug = 'lumino' AND archived_at IS NULL LIMIT 1`,
    );
    return existing.rows[0]?.id || null;
  }).catch(() => null);

  for (const lead of snapshot.leads) {
    const publicId = publicIdOf(lead);
    if (!publicId) {
      summary.failed.push({ reason: "missing_public_id" });
      continue;
    }
    if (!tenantId) {
      summary.would_insert += 1;
      continue;
    }
    try {
      const exists = await platformDb.withClient(async (client) => {
        const result = await client.query(
          `SELECT 1 FROM leads WHERE tenant_id = $1 AND public_id = $2 LIMIT 1`,
          [tenantId, publicId],
        );
        return result.rowCount > 0;
      });
      if (exists) summary.would_update += 1;
      else summary.would_insert += 1;
    } catch (error) {
      summary.failed.push({ publicId, reason: error.code || "query_failed" });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  await platformDb.closePool();
  if (summary.failed.length) process.exitCode = 1;
  process.exit();
}

await platformDb.migrate();
const boot = await platformDb.bootstrapStaffFromEnv();
const tenantId = boot.tenant?.id || (await platformDb.withClient((client) => platformDb.ensureDefaultTenant(client))).id;

const touchedPublicIds = [];

for (const lead of snapshot.leads) {
  const publicId = publicIdOf(lead);
  if (!publicId) {
    summary.failed.push({ reason: "missing_public_id" });
    continue;
  }
  try {
    const result = await platformDb.withClient(async (client) => {
      const existing = await client.query(
        `SELECT id FROM leads WHERE tenant_id = $1 AND public_id = $2`,
        [tenantId, publicId],
      );
      if (existing.rows[0]) {
        await client.query(
          `UPDATE leads SET
             company = $3, name = $4, phone = $5, email = $6,
             email_normalized = lower(nullif($6, '')),
             phone_normalized = nullif(regexp_replace(coalesce($5, ''), '\\s+', '', 'g'), ''),
             industry = $7, timeline = $8, services = $9::jsonb, note = $10,
             notes = $11::jsonb, source = $12, request_type = $13, status = $14,
             is_demo = true, updated_at = now(), revision = revision + 1
           WHERE tenant_id = $1 AND public_id = $2`,
          [
            tenantId,
            publicId,
            lead.company || "unknown",
            lead.name || "unknown",
            lead.phone || null,
            lead.email || null,
            lead.industry || null,
            lead.timeline || null,
            JSON.stringify(lead.services || []),
            lead.note || "",
            JSON.stringify(lead.notes || []),
            lead.source || "json-import",
            lead.requestType || lead.request_type || "service-consultation",
            lead.status || "new",
          ],
        );
        return "updated";
      }
      await client.query(
        `INSERT INTO leads (
           public_id, tenant_id, status, company, name, phone, email,
           email_normalized, phone_normalized, industry, timeline, services,
           note, notes, source, request_type, consent, consent_at, notice_version,
           context, user_agent, is_demo, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,
           lower(nullif($7,'')), nullif(regexp_replace(coalesce($6,''), '\\s+', '', 'g'), ''),
           $8,$9,$10::jsonb,
           $11,$12::jsonb,$13,$14,true,coalesce($15::timestamptz, now()),'v1-import',
           $16::jsonb,$17,true,coalesce($15::timestamptz, now()), coalesce($18::timestamptz, now())
         )`,
        [
          publicId,
          tenantId,
          lead.status || "new",
          lead.company || "unknown",
          lead.name || "unknown",
          lead.phone || null,
          lead.email || null,
          lead.industry || null,
          lead.timeline || null,
          JSON.stringify(lead.services || []),
          lead.note || "",
          JSON.stringify(lead.notes || []),
          lead.source || "json-import",
          lead.requestType || lead.request_type || "service-consultation",
          lead.createdAt || lead.created_at || null,
          lead.context ? JSON.stringify(lead.context) : null,
          lead.userAgent || lead.user_agent || null,
          lead.updatedAt || lead.updated_at || null,
        ],
      );
      return "inserted";
    });
    touchedPublicIds.push(publicId);
    if (result === "inserted") summary.inserted += 1;
    else summary.updated += 1;
  } catch (error) {
    summary.failed.push({ publicId, reason: error.code || "write_failed" });
  }
}

await platformDb.withClient((client) => syncDailyCounters(client, tenantId, touchedPublicIds));

console.log(JSON.stringify(summary, null, 2));
await platformDb.closePool();
if (summary.failed.length) process.exitCode = 1;
