const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://lumino@127.0.0.1:5432/lumino_platform";
process.env.LEADS_STORE = "postgres";
process.env.STAFF_USERS = process.env.STAFF_USERS || "ops@lumino.tech:OpsTest-123456:ops:Ops";

const db = require("../db/index.js");

test.before(async () => {
  await db.migrate();
  await db.bootstrapStaffFromEnv();
});

test.after(async () => {
  await db.closePool();
});

test("JSON import is idempotent across two consecutive runs", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const suffix = crypto.randomBytes(3).toString("hex");
  const publicId = `LM-20261118-${String(9000 + (Number.parseInt(suffix.slice(0, 3), 16) % 900)).padStart(4, "0")}`;
  const leads = [{
    id: publicId,
    company: `ImportCo-${suffix}`,
    name: "导入测试",
    email: `import-${suffix}@example.com`,
    phone: "13800138001",
    note: "idempotent import",
    services: ["cbam"],
    status: "new",
    source: "json-import-test",
  }];

  const first = await db.importLeadsJson({
    leads,
    tenantId: boot.tenant.id,
    dryRun: false,
    withClient: db.withClient,
  });
  assert.equal(first.inserted, 1);
  assert.equal(first.updated, 0);
  assert.equal(first.unchanged, 0);

  const afterFirst = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT revision, updated_at, company FROM leads WHERE tenant_id = $1 AND public_id = $2`,
      [boot.tenant.id, publicId],
    );
    return result.rows[0];
  });

  const second = await db.importLeadsJson({
    leads,
    tenantId: boot.tenant.id,
    dryRun: false,
    withClient: db.withClient,
  });
  assert.equal(second.inserted, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.unchanged, 1);
  assert.equal(second.failed.length, 0);

  const afterSecond = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT revision, updated_at, company FROM leads WHERE tenant_id = $1 AND public_id = $2`,
      [boot.tenant.id, publicId],
    );
    return result.rows[0];
  });

  assert.equal(afterSecond.revision, afterFirst.revision);
  assert.equal(new Date(afterSecond.updated_at).getTime(), new Date(afterFirst.updated_at).getTime());
  assert.equal(afterSecond.company, afterFirst.company);

  const third = await db.importLeadsJson({
    leads: [{ ...leads[0], company: `ImportCo-${suffix}-changed` }],
    tenantId: boot.tenant.id,
    dryRun: false,
    withClient: db.withClient,
  });
  assert.equal(third.updated, 1);
  assert.equal(third.unchanged, 0);

  const afterThird = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT revision, company FROM leads WHERE tenant_id = $1 AND public_id = $2`,
      [boot.tenant.id, publicId],
    );
    return result.rows[0];
  });
  assert.equal(afterThird.revision, afterFirst.revision + 1);
  assert.equal(afterThird.company, `ImportCo-${suffix}-changed`);
});
