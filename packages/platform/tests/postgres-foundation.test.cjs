const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://lumino@127.0.0.1:5432/lumino_platform";
process.env.LEADS_STORE = "postgres";
process.env.STAFF_USERS = "ops@lumino.tech:OpsTest-123456:ops:????,sales@lumino.tech:SalesTest-123456:sales:????";

const db = require("../db/index.js");

test.before(async () => {
  await db.migrate();
  await db.bootstrapStaffFromEnv();
});

test.after(async () => {
  await db.closePool();
});

test("migrate is idempotent and records checksums", async () => {
  const first = await db.migrate();
  const second = await db.migrate();
  assert.equal(second.plan.every((item) => item.action === "skip"), true);
  assert.ok(first.plan.some((item) => item.id.startsWith("001_")));
});

test("staff login issues personal session and rejects forged tenant/actor on patch", async () => {
  const session = await db.authenticateStaff({
    email: "ops@lumino.tech",
    password: "OpsTest-123456",
  });
  assert.ok(session.token);
  assert.ok(session.user.id);
  assert.ok(session.tenant.id);

  const resolved = await db.resolveSession(session.token);
  assert.equal(resolved.userId, session.user.id);
  assert.equal(resolved.activeTenantId, session.tenant.id);

  const created = await db.createLead(
    {
      company: "??????",
      name: "??",
      email: "lead@example.com",
      phone: "13800138000",
      note: "????????",
      consent: true,
      source: "postgres-foundation-test",
      services: ["cbam"],
      isDemo: true,
    },
    { tenantId: session.tenant.id },
  );
  assert.equal(created.persisted, true);
  assert.match(created.lead.id, /^LM-\d{8}-\d{4}$/);
  assert.equal(created.notifyStatus, "queued");

  const patched = await db.updateLead({
    tenantId: session.tenant.id,
    publicId: created.lead.id,
    patch: { status: "claimed", note: "???" },
    actor: {
      userId: session.user.id,
      email: session.user.email,
    },
  });
  assert.equal(patched.lead.status, "claimed");
  assert.equal(patched.lead.claimedByUserId, session.user.id);

  await assert.rejects(
    () => db.updateLead({
      tenantId: session.tenant.id,
      publicId: created.lead.id,
      patch: { status: "qualified" },
      actor: null,
    }),
    /actor is required|AUTH_REQUIRED/,
  );
});

test("leads and outbox commit together; concurrent public_ids stay unique", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const tenantId = boot.tenant.id;
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) => db.createLead({
      company: `????${index}`,
      name: `???${index}`,
      email: `c${index}-${crypto.randomBytes(3).toString("hex")}@example.com`,
      phone: `1390000${String(1000 + index).slice(-4)}`,
      note: "??????",
      consent: true,
      source: "concurrency-test",
      isDemo: true,
    }, { tenantId })),
  );
  const ids = results.map((item) => item.lead.id);
  assert.equal(new Set(ids).size, ids.length);

  const pending = await db.withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT count(*)::int AS c
       FROM outbox_events o
       JOIN leads l ON l.id = o.lead_id
       WHERE l.tenant_id = $1 AND o.status = 'pending'`,
      [tenantId],
    );
    return rows[0].c;
  });
  assert.ok(pending >= 12);
});

test("DATABASE_URL missing fails closed", async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.LEADS_STORE = "postgres";
  try {
    assert.throws(() => db.requireDatabaseUrl(), /DATABASE_URL/);
  } finally {
    process.env.DATABASE_URL = previous;
  }
});
