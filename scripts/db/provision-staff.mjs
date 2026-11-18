#!/usr/bin/env node
/**
 * One-time / controlled staff provisioning from STAFF_USERS.
 *
 * Usage:
 *   DATABASE_URL=... STAFF_USERS='ops@x:pass:ops:Name' node scripts/db/provision-staff.mjs
 *   DATABASE_URL=... node scripts/db/provision-staff.mjs --reactivate
 *
 * Default: never reactivate archived users/memberships.
 * Login (/api/staff-login) must not call this.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const platformDb = require(path.join(root, "packages/platform/db/index.js"));

const reactivate = process.argv.includes("--reactivate");

platformDb.assertPostgresMode();
await platformDb.migrate();
const result = await platformDb.provisionStaffFromEnv({ reactivate });
console.log(JSON.stringify({
  ok: true,
  reactivate,
  tenantId: result.tenant?.id || null,
  provisioned: (result.users || []).map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
  })),
  skipped: result.skipped || [],
}, null, 2));
await platformDb.closePool();
