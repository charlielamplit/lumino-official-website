#!/usr/bin/env node
/**
 * One-time / controlled staff provisioning from STAFF_USERS.
 *
 * Usage:
 *   DATABASE_URL=... STAFF_USERS='ops@x:pass:ops:Name' node scripts/db/provision-staff.mjs
 *   DATABASE_URL=... node scripts/db/provision-staff.mjs --reactivate
 *   DATABASE_URL=... node scripts/db/provision-staff.mjs --rotate-password
 *   DATABASE_URL=... node scripts/db/provision-staff.mjs --update-roles
 *
 * Default: true no-op for existing accounts (no password/role/revision mutation).
 * Archived users and inactive/archived memberships are reported as skipped.
 * Login (/api/staff-login) must not call this.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const platformDb = require(path.join(root, "packages/platform/db/index.js"));

const reactivate = process.argv.includes("--reactivate");
const rotatePassword = process.argv.includes("--rotate-password");
const updateRoles = process.argv.includes("--update-roles");

platformDb.assertPostgresMode();
await platformDb.migrate();
const result = await platformDb.provisionStaffFromEnv({
  reactivate,
  rotatePassword,
  updateRoles,
});
console.log(JSON.stringify({
  ok: true,
  reactivate,
  rotatePassword,
  updateRoles,
  tenantId: result.tenant?.id || null,
  provisioned: (result.users || []).map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    reason: user.reason || null,
  })),
  skipped: result.skipped || [],
}, null, 2));
await platformDb.closePool();
