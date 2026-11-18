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
 *
 * Logs never include full contact PII (name / phone / email).
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

async function main() {
  platformDb.assertPostgresMode();
  if (once) {
    const summary = await platformDb.drainOutboxBatch({ limit });
    console.log(JSON.stringify({ ok: true, mode: "once", ...platformDb.safeWorkerLog(summary) }, null, 2));
    await platformDb.closePool();
    return;
  }

  console.log(JSON.stringify({ ok: true, mode: "loop", limit, pollMs }, null, 2));
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const summary = await platformDb.drainOutboxBatch({ limit });
      if (summary.claimed > 0 || summary.reason) {
        console.log(JSON.stringify(platformDb.safeWorkerLog(summary)));
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
