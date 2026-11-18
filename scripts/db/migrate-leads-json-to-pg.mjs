#!/usr/bin/env node
/**
 * Idempotent JSON -> Postgres leads import.
 * Usage:
 *   DATABASE_URL=... node scripts/db/migrate-leads-json-to-pg.mjs [--dry-run] [path/to/leads.json]
 *
 * Same content does not UPDATE and does not bump revision.
 * Summary: inserted / updated / unchanged / failed (plus would_* in dry-run).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const platformDb = require(path.join(root, "packages/platform/db/index.js"));

const dryRun = process.argv.includes("--dry-run");
const fileArg = process.argv.find((arg, index) => index >= 2 && !arg.startsWith("--"));
const jsonPath = path.resolve(fileArg || path.join(root, "data/leads.json"));

const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const leads = Array.isArray(raw?.leads) ? raw.leads : Array.isArray(raw) ? raw : [];
const sha256 = platformDb.snapshotFingerprint(raw);

if (dryRun) {
  const tenantId = await platformDb.withClient(async (client) => {
    const existing = await client.query(
      `SELECT id FROM tenants WHERE slug = 'lumino' AND archived_at IS NULL LIMIT 1`,
    );
    return existing.rows[0]?.id || null;
  }).catch(() => null);

  if (!tenantId) {
    const summary = {
      file: jsonPath,
      sha256,
      total: leads.length,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      would_insert: leads.filter((lead) => platformDb.publicIdOf(lead)).length,
      would_update: 0,
      would_unchanged: 0,
      failed: leads.filter((lead) => !platformDb.publicIdOf(lead)).map(() => ({ reason: "missing_public_id" })),
      dryRun: true,
    };
    console.log(JSON.stringify(summary, null, 2));
    await platformDb.closePool();
    if (summary.failed.length) process.exitCode = 1;
    process.exit();
  }

  const summary = await platformDb.importLeadsJson({
    leads,
    tenantId,
    dryRun: true,
    withClient: platformDb.withClient,
  });
  console.log(JSON.stringify({ file: jsonPath, sha256, ...summary }, null, 2));
  await platformDb.closePool();
  if (summary.failed.length) process.exitCode = 1;
  process.exit();
}

await platformDb.migrate();
const boot = await platformDb.bootstrapStaffFromEnv();
const tenantId = boot.tenant?.id || (await platformDb.withClient((client) => platformDb.ensureDefaultTenant(client))).id;

const summary = await platformDb.importLeadsJson({
  leads,
  tenantId,
  dryRun: false,
  withClient: platformDb.withClient,
});

console.log(JSON.stringify({ file: jsonPath, sha256, ...summary }, null, 2));
await platformDb.closePool();
if (summary.failed.length) process.exitCode = 1;
