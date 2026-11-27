#!/usr/bin/env node
// Controlled one-time account creation. No password is printed or stored in Git.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const db = require(path.join(root, "packages/platform/db/index.js"));

const input = {
  email: process.env.PORTAL_CUSTOMER_EMAIL,
  password: process.env.PORTAL_CUSTOMER_PASSWORD,
  name: process.env.PORTAL_CUSTOMER_NAME,
  tenantSlug: process.env.PORTAL_TENANT_SLUG,
  tenantName: process.env.PORTAL_TENANT_NAME,
  isDemo: process.env.PORTAL_DEMO_ACCOUNT === "1",
};
db.assertPostgresMode();
try {
  await db.migrate();
  const result = await db.provisionPortalAccount(input);
  console.log(JSON.stringify({ userId: result.user.id, email: result.user.email, tenantId: result.tenant.id, tenantSlug: result.tenant.slug, isDemo: result.tenant.is_demo }));
} finally {
  await db.closePool();
}
