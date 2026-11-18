const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://lumino@127.0.0.1:5432/lumino_platform";
process.env.LEADS_STORE = "postgres";
process.env.STAFF_USERS = process.env.STAFF_USERS || "ops@lumino.tech:OpsTest-123456:ops:Ops";
process.env.OUTBOX_MAX_ATTEMPTS = "3";

const db = require("../db/index.js");

function mockFetch(handler) {
  return async (url, init) => handler(url, init);
}

test.before(async () => {
  await db.migrate();
  await db.bootstrapStaffFromEnv();
});

test.after(async () => {
  await db.closePool();
});

test("outbox worker sends wecom successfully without logging contact PII", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const suffix = crypto.randomBytes(3).toString("hex");
  const created = await db.createLead({
    company: `SendCo-${suffix}`,
    name: "机密联系人",
    email: `secret-${suffix}@example.com`,
    phone: "13900001111",
    note: "worker success",
    consent: true,
    source: "outbox-worker-test",
    isDemo: true,
  }, { tenantId: boot.tenant.id });

  let postedBody = null;
  const summary = await db.drainOutboxBatch({
    limit: 5,
    leadPublicId: created.lead.id,
    wecomUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test",
    fetchImpl: mockFetch(async (_url, init) => {
      postedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ errcode: 0 }),
      };
    }),
  });

  assert.equal(summary.sent, 1);
  assert.equal(summary.failed, 0);
  assert.match(postedBody.markdown.content, /新线索/);
  assert.equal(postedBody.markdown.content.includes(created.lead.id), true);

  const logLine = JSON.stringify(db.safeWorkerLog(summary));
  assert.equal(logLine.includes("机密联系人"), false);
  assert.equal(logLine.includes(`secret-${suffix}@example.com`), false);
  assert.equal(logLine.includes("13900001111"), false);

  const row = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT status FROM outbox_events WHERE payload->>'publicId' = $1`,
      [created.lead.id],
    );
    return result.rows[0];
  });
  assert.equal(row.status, "sent");
});

test("outbox worker marks failed for webhook errors and can retry", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const suffix = crypto.randomBytes(3).toString("hex");
  const created = await db.createLead({
    company: `FailCo-${suffix}`,
    name: "Retry",
    email: `retry-${suffix}@example.com`,
    note: "worker fail",
    consent: true,
    source: "outbox-worker-test",
    isDemo: true,
  }, { tenantId: boot.tenant.id });

  const first = await db.drainOutboxBatch({
    limit: 1,
    leadPublicId: created.lead.id,
    wecomUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test",
    fetchImpl: mockFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ errcode: 93000 }),
    })),
  });
  assert.equal(first.failed, 1);

  const failedRow = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT status, attempts, last_error_code, next_attempt_at
       FROM outbox_events WHERE payload->>'publicId' = $1`,
      [created.lead.id],
    );
    return result.rows[0];
  });
  assert.equal(failedRow.status, "failed");
  assert.equal(failedRow.last_error_code, "errcode_93000");
  assert.ok(new Date(failedRow.next_attempt_at).getTime() <= Date.now() + 60_000);

  await db.withClient(async (client) => {
    await client.query(
      `UPDATE outbox_events SET next_attempt_at = now() - interval '1 second'
       WHERE payload->>'publicId' = $1`,
      [created.lead.id],
    );
  });

  const second = await db.drainOutboxBatch({
    limit: 1,
    leadPublicId: created.lead.id,
    wecomUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test",
    fetchImpl: mockFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ errcode: 0 }),
    })),
  });
  assert.equal(second.sent, 1);
});

test("outbox worker reclaims stale processing lease after interrupt", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const suffix = crypto.randomBytes(3).toString("hex");
  const created = await db.createLead({
    company: `LeaseCo-${suffix}`,
    name: "Lease",
    email: `lease-${suffix}@example.com`,
    note: "lease reclaim",
    consent: true,
    source: "outbox-worker-test",
    isDemo: true,
  }, { tenantId: boot.tenant.id });

  const claimed = await db.claimPendingOutbox({ limit: 1, leadPublicId: created.lead.id });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].status, "processing");

  await db.withClient(async (client) => {
    await client.query(
      `UPDATE outbox_events
       SET processing_started_at = now() - interval '10 minutes',
           next_attempt_at = now() - interval '1 second'
       WHERE id = $1`,
      [claimed[0].id],
    );
  });

  const summary = await db.drainOutboxBatch({
    limit: 1,
    leadPublicId: created.lead.id,
    leaseSeconds: 60,
    wecomUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test",
    fetchImpl: mockFetch(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ errcode: 0 }),
    })),
  });
  assert.equal(summary.sent, 1);
});

test("outbox worker dead-letters after max attempts", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const suffix = crypto.randomBytes(3).toString("hex");
  const created = await db.createLead({
    company: `DeadCo-${suffix}`,
    name: "Dead",
    email: `dead-${suffix}@example.com`,
    note: "dead letter",
    consent: true,
    source: "outbox-worker-test",
    isDemo: true,
  }, { tenantId: boot.tenant.id });

  await db.withClient(async (client) => {
    await client.query(
      `UPDATE outbox_events
       SET attempts = 2, next_attempt_at = now() - interval '1 second'
       WHERE payload->>'publicId' = $1`,
      [created.lead.id],
    );
  });

  const summary = await db.drainOutboxBatch({
    limit: 1,
    leadPublicId: created.lead.id,
    wecomUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test",
    fetchImpl: mockFetch(async () => ({
      ok: false,
      status: 500,
      text: async () => "boom",
    })),
  });
  assert.equal(summary.failed, 1);

  const row = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT status, attempts FROM outbox_events WHERE payload->>'publicId' = $1`,
      [created.lead.id],
    );
    return result.rows[0];
  });
  assert.equal(row.status, "dead");
  assert.ok(row.attempts >= 3);
});

test("unsupported channel leaves processing and goes dead", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const suffix = crypto.randomBytes(3).toString("hex");
  const created = await db.createLead({
    company: `ChanCo-${suffix}`,
    name: "Channel",
    email: `chan-${suffix}@example.com`,
    note: "unsupported channel",
    consent: true,
    source: "outbox-worker-test",
    isDemo: true,
  }, { tenantId: boot.tenant.id });

  await db.withClient(async (client) => {
    await client.query(
      `UPDATE outbox_events
       SET channel = 'email', next_attempt_at = now() - interval '1 second'
       WHERE payload->>'publicId' = $1`,
      [created.lead.id],
    );
  });

  const summary = await db.drainOutboxBatch({
    limit: 1,
    leadPublicId: created.lead.id,
    wecomUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test",
    fetchImpl: mockFetch(async () => {
      throw new Error("should not send");
    }),
  });
  assert.equal(summary.skipped, 1);
  assert.equal(summary.dead, 1);

  const row = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT status, last_error_code, processing_started_at
       FROM outbox_events WHERE payload->>'publicId' = $1`,
      [created.lead.id],
    );
    return result.rows[0];
  });
  assert.equal(row.status, "dead");
  assert.equal(row.last_error_code, "unsupported_channel");
  assert.equal(row.processing_started_at, null);
});
