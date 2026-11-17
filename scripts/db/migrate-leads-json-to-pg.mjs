#!/usr/bin/env node
/**
 * Idempotent JSON ? Postgres leads import.
 * Usage:
 *   DATABASE_URL=... node scripts/db/migrate-leads-json-to-pg.mjs [--dry-run] [path/to/leads.json]
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

const snapshot = loadJson(jsonPath);
await platformDb.migrate();
const boot = await platformDb.bootstrapStaffFromEnv();
const tenantId = boot.tenant?.id || (await platformDb.withClient((client) => platformDb.ensureDefaultTenant(client))).id;

const summary = {
  file: jsonPath,
  sha256: snapshot.sha256,
  total: snapshot.leads.length,
  inserted: 0,
  updated: 0,
  skipped: 0,
  failed: [],
  dryRun,
};

for (const lead of snapshot.leads) {
  const publicId = String(lead.id || lead.public_id || "").trim();
  if (!publicId) {
    summary.failed.push({ reason: "missing_public_id", lead });
    continue;
  }
  try {
    if (dryRun) {
      summary.skipped += 1;
      continue;
    }
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
    if (result === "inserted") summary.inserted += 1;
    else summary.updated += 1;
  } catch (error) {
    summary.failed.push({ publicId, reason: error.message });
  }
}

console.log(JSON.stringify(summary, null, 2));
await platformDb.closePool();
if (summary.failed.length) process.exitCode = 1;
