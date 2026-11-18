const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://lumino@127.0.0.1:5432/lumino_platform";
process.env.LEADS_STORE = "postgres";
process.env.STAFF_USERS = "ops@lumino.tech:OpsTest-123456:ops:运维,sales@lumino.tech:SalesTest-123456:sales:销售";

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
  assert.ok(first.plan.some((item) => item.id.startsWith("002_")) || second.plan.some((item) => item.id.startsWith("002_")));
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
      company: "测试公司",
      name: "张三",
      email: `lead-${crypto.randomBytes(3).toString("hex")}@example.com`,
      phone: "13800138000",
      note: "阶段一基础能力测试",
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
    patch: { status: "claimed", note: "已认领" },
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

test("archived membership/user/tenant invalidate session", async () => {
  const email = `archive-${crypto.randomBytes(3).toString("hex")}@lumino.tech`;
  const password = "ArchiveTest-123456";
  const { hashPassword } = require("../db/identity-repository.js");
  const boot = await db.withClient(async (client) => {
    const tenant = await db.ensureDefaultTenant(client);
    const user = await client.query(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true, archived_at = NULL
       RETURNING *`,
      [email, "归档测试", hashPassword(password)],
    );
    await client.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, roles)
       VALUES ($1, $2, $3::text[])
       ON CONFLICT (tenant_id, user_id)
       DO UPDATE SET roles = EXCLUDED.roles, is_active = true, archived_at = NULL`,
      [tenant.id, user.rows[0].id, ["ops"]],
    );
    return { tenant, userId: user.rows[0].id };
  });

  const session = await db.authenticateStaff({ email, password });
  assert.ok(await db.resolveSession(session.token));

  await db.withClient(async (client) => {
    await client.query(`UPDATE users SET archived_at = now() WHERE id = $1`, [boot.userId]);
  });
  assert.equal(await db.resolveSession(session.token), null);

  await db.withClient(async (client) => {
    await client.query(`UPDATE users SET archived_at = NULL WHERE id = $1`, [boot.userId]);
  });
  const session2 = await db.authenticateStaff({ email, password });
  assert.ok(await db.resolveSession(session2.token));

  await db.withClient(async (client) => {
    await client.query(
      `UPDATE tenant_memberships SET archived_at = now() WHERE user_id = $1 AND tenant_id = $2`,
      [boot.userId, boot.tenant.id],
    );
  });
  assert.equal(await db.resolveSession(session2.token), null);

  await db.withClient(async (client) => {
    await client.query(
      `UPDATE tenant_memberships SET archived_at = NULL, is_active = true WHERE user_id = $1 AND tenant_id = $2`,
      [boot.userId, boot.tenant.id],
    );
    await client.query(`UPDATE tenants SET archived_at = now() WHERE id = $1`, [boot.tenant.id]);
  });
  const session3 = await db.authenticateStaff({ email, password }).catch((error) => error);
  assert.equal(session3 && session3.code, "TENANT_FORBIDDEN");

  await db.withClient(async (client) => {
    await client.query(`UPDATE tenants SET archived_at = NULL WHERE id = $1`, [boot.tenant.id]);
  });
});

test("leads and outbox commit together; concurrent public_ids stay unique", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const tenantId = boot.tenant.id;
  const suffix = crypto.randomBytes(3).toString("hex");
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) => db.createLead({
      company: `并发公司${index}-${suffix}`,
      name: `测试人${index}`,
      email: `c${index}-${suffix}@example.com`,
      phone: `1390000${String(1000 + index).slice(-4)}`,
      note: "并发写入测试",
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
       WHERE l.tenant_id = $1 AND o.status = 'pending'
         AND o.payload->>'publicId' = ANY($2::text[])`,
      [tenantId, ids],
    );
    return rows[0].c;
  });
  assert.equal(pending, 12);
});

test("outbox lease reclaim and dead-letter after max attempts", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const created = await db.createLead({
    company: "Outbox Lease Co",
    name: "Lease",
    email: `lease-${crypto.randomBytes(3).toString("hex")}@example.com`,
    note: "lease test",
    consent: true,
    source: "outbox-lease-test",
    isDemo: true,
  }, { tenantId: boot.tenant.id });

  const claimed = await db.claimPendingOutbox({ limit: 1, leadPublicId: created.lead.id });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].status, "processing");

  await db.withClient(async (client) => {
    await client.query(
      `UPDATE outbox_events
       SET processing_started_at = now() - interval '10 minutes', attempts = 8
       WHERE id = $1`,
      [claimed[0].id],
    );
  });

  await db.claimPendingOutbox({ limit: 1, leadPublicId: created.lead.id, leaseSeconds: 60 });
  const row = await db.withClient(async (client) => {
    const result = await client.query(`SELECT status, last_error_code FROM outbox_events WHERE id = $1`, [claimed[0].id]);
    return result.rows[0];
  });
  assert.equal(row.status, "dead");
  assert.equal(row.last_error_code, "lease_timeout");
});


test("concurrent bootstrapStaffFromEnv and ensureDefaultTenant stay atomic", async () => {
  const results = await Promise.all(
    Array.from({ length: 16 }, () => db.bootstrapStaffFromEnv()),
  );
  const tenantIds = results.map((item) => item.tenant.id);
  assert.equal(new Set(tenantIds).size, 1);

  const tenants = await Promise.all(
    Array.from({ length: 16 }, () => db.withClient((client) => db.ensureDefaultTenant(client))),
  );
  assert.equal(new Set(tenants.map((row) => row.id)).size, 1);
  assert.equal(tenants[0].id, tenantIds[0]);

  const counts = await db.withClient(async (client) => {
    const tenantCount = await client.query(`SELECT count(*)::int AS c FROM tenants WHERE slug = 'lumino'`);
    const userCount = await client.query(`SELECT count(*)::int AS c FROM users WHERE email = 'ops@lumino.tech'`);
    const membershipCount = await client.query(
      `SELECT count(*)::int AS c
       FROM tenant_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE u.email = 'ops@lumino.tech'`,
    );
    return {
      tenants: tenantCount.rows[0].c,
      users: userCount.rows[0].c,
      memberships: membershipCount.rows[0].c,
    };
  });
  assert.equal(counts.tenants, 1);
  assert.equal(counts.users, 1);
  assert.equal(counts.memberships, 1);
});


test("provisionStaffFromEnv does not reactivate archived users by default", async () => {
  const previousUsers = process.env.STAFF_USERS;
  const email = `archived-prov-${crypto.randomBytes(3).toString("hex")}@lumino.tech`;
  const password = "ArchiveProv-123456";
  process.env.STAFF_USERS = `${email}:${password}:ops:归档供给`;
  try {
    const first = await db.provisionStaffFromEnv({ reactivate: true });
    const userId = first.users[0].id;
    await db.withClient(async (client) => {
      await client.query(`UPDATE users SET archived_at = now(), is_active = false WHERE id = $1`, [userId]);
      await client.query(
        `UPDATE tenant_memberships SET archived_at = now(), is_active = false WHERE user_id = $1`,
        [userId],
      );
    });

    const second = await db.provisionStaffFromEnv({ reactivate: false });
    assert.equal(second.users.length, 0);
    assert.ok(second.skipped.some((item) => item.email === email && item.reason === "archived"));

    const row = await db.withClient(async (client) => {
      const result = await client.query(`SELECT archived_at, is_active FROM users WHERE id = $1`, [userId]);
      return result.rows[0];
    });
    assert.ok(row.archived_at);
    assert.equal(row.is_active, false);

    await assert.rejects(
      () => db.authenticateStaff({ email, password }),
      (error) => error.code === "AUTH_INVALID",
    );
  } finally {
    process.env.STAFF_USERS = previousUsers;
  }
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
