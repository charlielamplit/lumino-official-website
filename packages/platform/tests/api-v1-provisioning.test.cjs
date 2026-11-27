const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Client } = require("pg");

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://lumino@127.0.0.1:5432/lumino_platform";
process.env.LEADS_STORE = "postgres";
process.env.STAFF_USERS = process.env.STAFF_USERS
  || "ops@lumino.tech:OpsTest-123456:ops:Ops,sales@lumino.tech:SalesTest-123456:sales:Sales";

const db = require("../db/index.js");

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
      return this;
    },
    end(payload = "") {
      this.body = payload;
      return this;
    },
  };
}

async function loadHandler(relativePath) {
  const url = pathToFileURL(path.join(__dirname, "../../..", relativePath));
  url.searchParams.set("test", String(Date.now() + Math.random()));
  return (await import(url.href)).default;
}

function adminDatabaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

function databaseUrlWithName(baseUrl, dbName) {
  const url = new URL(baseUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function createTempDatabase(baseUrl, dbName) {
  const client = new Client({ connectionString: adminDatabaseUrl(baseUrl) });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }
}

async function dropTempDatabase(baseUrl, dbName) {
  const client = new Client({ connectionString: adminDatabaseUrl(baseUrl) });
  await client.connect();
  try {
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    await client.end();
  }
}

test.before(async () => {
  await db.migrate();
  await db.bootstrapStaffFromEnv();
});

test.after(async () => {
  await db.closePool();
});

test("empty database migration creates phase-1 tables on the same DATABASE_URL host", async () => {
  const baseUrl = process.env.DATABASE_URL;
  const dbName = `lumino_empty_${crypto.randomBytes(3).toString("hex")}`;
  await createTempDatabase(baseUrl, dbName);
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrlWithName(baseUrl, dbName);
  await db.closePool();
  try {
    const result = await db.migrate();
    assert.ok(result.plan.some((item) => item.id.startsWith("001_") && item.action === "apply"));
    assert.ok(result.plan.some((item) => item.id.startsWith("002_")));
    const tables = await db.withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT tablename FROM pg_tables
         WHERE schemaname = 'public'
           AND tablename = ANY($1::text[])
         ORDER BY tablename`,
        [["users", "tenants", "leads", "outbox_events", "audit_events", "schema_migrations"]],
      );
      return rows.map((row) => row.tablename);
    });
    assert.deepEqual(tables, [
      "audit_events",
      "leads",
      "outbox_events",
      "schema_migrations",
      "tenants",
      "users",
    ]);
    const second = await db.migrate();
    assert.equal(second.plan.every((item) => item.action === "skip"), true);
  } finally {
    await db.closePool();
    process.env.DATABASE_URL = previous;
    try {
      await dropTempDatabase(baseUrl, dbName);
    } catch (_) {
      // best-effort cleanup
    }
  }
});

test("tenant ACL hides cross-tenant leads", async () => {
  const boot = await db.bootstrapStaffFromEnv();
  const other = await db.withClient(async (client) => {
    const inserted = await client.query(
      `INSERT INTO tenants (slug, name)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [`tenant-${crypto.randomBytes(2).toString("hex")}`, "Other"],
    );
    return inserted.rows[0];
  });

  const created = await db.createLead({
    company: "ACL Co",
    name: "ACL",
    email: `acl-${crypto.randomBytes(2).toString("hex")}@example.com`,
    note: "tenant acl",
    consent: true,
    source: "acl-test",
    isDemo: true,
  }, { tenantId: boot.tenant.id });

  const visible = await db.getLeadByPublicId({
    tenantId: boot.tenant.id,
    publicId: created.lead.id,
  });
  const hidden = await db.getLeadByPublicId({
    tenantId: other.id,
    publicId: created.lead.id,
  });
  assert.ok(visible);
  assert.equal(hidden, null);
});

test("Bearer session authenticates staff leads GET via API contract", async () => {
  const session = await db.authenticateStaff({
    email: "ops@lumino.tech",
    password: "OpsTest-123456",
  });
  const handler = await loadHandler("api/leads.js");
  const response = mockResponse();
  await handler({
    method: "GET",
    headers: { authorization: `Bearer ${session.token}` },
    query: {},
    body: {},
  }, response);
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.ok, true);
  assert.equal(body.contractVersion, "1.0.0");
  assert.ok(Array.isArray(body.data.leads));
  assert.ok(body.requestId);
});

test("concurrent migrate is serialized by advisory lock on a fresh database", async () => {
  const baseUrl = process.env.DATABASE_URL;
  const dbName = `lumino_mig_${crypto.randomBytes(3).toString("hex")}`;
  await createTempDatabase(baseUrl, dbName);
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrlWithName(baseUrl, dbName);
  await db.closePool();
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => db.migrate()));
    assert.equal(results.length, 8);
    assert.ok(results.every((item) => Array.isArray(item.plan)));
    const applied = await db.withClient(async (client) => {
      const { rows } = await client.query(`SELECT id FROM schema_migrations ORDER BY id`);
      return rows.map((row) => row.id);
    });
    assert.ok(applied.some((id) => id.startsWith("001_")));
    assert.ok(applied.some((id) => id.startsWith("002_")));
  } finally {
    await db.closePool();
    process.env.DATABASE_URL = previous;
    try {
      await dropTempDatabase(baseUrl, dbName);
    } catch (_) {
      // best-effort cleanup
    }
  }
});

test("active provisioning replay is a true no-op and membership-only archive is skipped", async () => {
  const previous = process.env.STAFF_USERS;
  const email = `prov-${crypto.randomBytes(3).toString("hex")}@lumino.tech`;
  const password = "ProvTest-123456";
  process.env.STAFF_USERS = `${email}:${password}:ops:供给`;
  try {
    const first = await db.provisionStaffFromEnv({ reactivate: false, source: "admin_cli" });
    assert.equal(first.users.length, 1);
    const userId = first.users[0].id;

    const createAudit = await db.withClient(async (client) => {
      const result = await client.query(
        `SELECT actor_user_id, actor_email_snapshot, entity_id, payload
         FROM audit_events
         WHERE action = 'staff.provision' AND entity_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId],
      );
      return result.rows[0] || null;
    });
    assert.ok(createAudit);
    assert.equal(createAudit.actor_user_id, null);
    assert.equal(createAudit.actor_email_snapshot, null);
    assert.equal(createAudit.entity_id, userId);
    assert.equal(createAudit.payload.source, "admin_cli");
    assert.equal(createAudit.payload.targetUserId, userId);

    const before = await db.withClient(async (client) => {
      const user = await client.query(
        `SELECT password_hash, revision FROM users WHERE id = $1`,
        [userId],
      );
      const membership = await client.query(
        `SELECT revision, is_active, archived_at FROM tenant_memberships WHERE user_id = $1`,
        [userId],
      );
      return { user: user.rows[0], membership: membership.rows[0] };
    });

    const second = await db.provisionStaffFromEnv({ reactivate: false });
    assert.equal(second.users.length, 0);
    assert.ok(second.skipped.some((item) => item.email === email && item.reason === "already_provisioned"));

    const afterReplay = await db.withClient(async (client) => {
      const user = await client.query(
        `SELECT password_hash, revision FROM users WHERE id = $1`,
        [userId],
      );
      const membership = await client.query(
        `SELECT revision, is_active, archived_at FROM tenant_memberships WHERE user_id = $1`,
        [userId],
      );
      return { user: user.rows[0], membership: membership.rows[0] };
    });
    assert.equal(afterReplay.user.password_hash, before.user.password_hash);
    assert.equal(afterReplay.user.revision, before.user.revision);
    assert.equal(afterReplay.membership.revision, before.membership.revision);

    await db.withClient(async (client) => {
      await client.query(
        `UPDATE tenant_memberships
         SET archived_at = now(), is_active = false, revision = revision + 1
         WHERE user_id = $1`,
        [userId],
      );
    });

    const third = await db.provisionStaffFromEnv({ reactivate: false });
    assert.equal(third.users.length, 0);
    assert.ok(third.skipped.some((item) => item.email === email && item.reason === "membership_archived"));

    const membershipStillArchived = await db.withClient(async (client) => {
      const result = await client.query(
        `SELECT is_active, archived_at FROM tenant_memberships WHERE user_id = $1`,
        [userId],
      );
      return result.rows[0];
    });
    assert.equal(membershipStillArchived.is_active, false);
    assert.ok(membershipStillArchived.archived_at);
  } finally {
    process.env.STAFF_USERS = previous;
  }
});

test("requestId flows into lead create/patch and staff login audits", async () => {
  const createRequestId = `REQ-create-${crypto.randomBytes(3).toString("hex")}`;
  const loginRequestId = `REQ-login-${crypto.randomBytes(3).toString("hex")}`;
  const patchRequestId = `REQ-patch-${crypto.randomBytes(3).toString("hex")}`;

  const loginHandler = await loadHandler("api/staff-login.js");
  const loginResponse = mockResponse();
  await loginHandler({
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": loginRequestId,
    },
    query: {},
    body: { email: "ops@lumino.tech", password: "OpsTest-123456" },
  }, loginResponse);
  assert.equal(loginResponse.statusCode, 200);
  const loginBody = JSON.parse(loginResponse.body);
  assert.equal(loginBody.requestId, loginRequestId);

  const loginAudit = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT payload FROM audit_events
       WHERE action = 'staff.login'
         AND payload->>'requestId' = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [loginRequestId],
    );
    return result.rows[0] || null;
  });
  assert.ok(loginAudit);

  const leadsHandler = await loadHandler("api/leads.js");
  const createResponse = mockResponse();
  await leadsHandler({
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": createRequestId,
    },
    query: {},
    body: {
      company: "Audit Co",
      name: "Audit",
      email: `audit-${crypto.randomBytes(2).toString("hex")}@example.com`,
      note: "requestId audit",
      consent: true,
      source: "audit-test",
      isDemo: true,
    },
  }, createResponse);
  assert.equal(createResponse.statusCode, 200);
  const createdBody = JSON.parse(createResponse.body);
  assert.equal(createdBody.requestId, createRequestId);
  const leadId = createdBody.data.leadId;
  const revision = createdBody.meta.revision;

  const createAudit = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT payload FROM audit_events
       WHERE action = 'lead.create'
         AND entity_id = $1
         AND payload->>'requestId' = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [leadId, createRequestId],
    );
    return result.rows[0] || null;
  });
  assert.ok(createAudit);

  const token = loginBody.data.staffKey;
  const patchResponse = mockResponse();
  await leadsHandler({
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-request-id": patchRequestId,
    },
    query: {},
    body: {
      id: leadId,
      status: "claimed",
      revision,
    },
  }, patchResponse);
  assert.equal(patchResponse.statusCode, 200);

  const patchAudit = await db.withClient(async (client) => {
    const result = await client.query(
      `SELECT payload FROM audit_events
       WHERE action = 'lead.patch'
         AND entity_id = $1
         AND payload->>'requestId' = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [leadId, patchRequestId],
    );
    return result.rows[0] || null;
  });
  assert.ok(patchAudit);
});

test("Portal write path requires revision; stale revision returns 409", async () => {
  const fs = require("node:fs");
  const portalEvents = fs.readFileSync(
    path.join(__dirname, "../../../apps/portal/runtime/portal-events.js"),
    "utf8",
  );
  const leadsClient = fs.readFileSync(
    path.join(__dirname, "../../../packages/shared/leads-client.js"),
    "utf8",
  );
  assert.match(portalEvents, /revision/);
  assert.match(portalEvents, /currentLead\?\.revision|currentLead\.revision|revision = currentLead/);
  assert.match(leadsClient, /revision,/);
  assert.match(leadsClient, /缺少线索版本号/);

  const ops = await db.authenticateStaff({
    email: "ops@lumino.tech",
    password: "OpsTest-123456",
  });
  const created = await db.createLead({
    company: "Rev Co",
    name: "Rev",
    email: `rev-${crypto.randomBytes(2).toString("hex")}@example.com`,
    note: "revision",
    consent: true,
    source: "rev-test",
    isDemo: true,
  }, { tenantId: ops.tenant.id, requestId: "REQ-rev-create" });

  const leadsHandler = await loadHandler("api/leads.js");

  const missing = mockResponse();
  await leadsHandler({
    method: "PATCH",
    headers: {
      authorization: `Bearer ${ops.token}`,
      "content-type": "application/json",
    },
    query: {},
    body: {
      id: created.lead.id,
      status: "claimed",
    },
  }, missing);
  assert.equal(missing.statusCode, 400);
  const missingBody = JSON.parse(missing.body);
  assert.equal(missingBody.error.code, "VALIDATION_FAILED");

  const first = mockResponse();
  await leadsHandler({
    method: "PATCH",
    headers: {
      authorization: `Bearer ${ops.token}`,
      "content-type": "application/json",
    },
    query: {},
    body: {
      id: created.lead.id,
      status: "claimed",
      revision: created.lead.revision,
    },
  }, first);
  assert.equal(first.statusCode, 200);
  const firstBody = JSON.parse(first.body);
  assert.equal(firstBody.data.lead.status, "claimed");
  assert.equal(firstBody.meta.revision, created.lead.revision + 1);

  const stale = mockResponse();
  await leadsHandler({
    method: "PATCH",
    headers: {
      authorization: `Bearer ${ops.token}`,
      "content-type": "application/json",
    },
    query: {},
    body: {
      id: created.lead.id,
      status: "qualified",
      revision: created.lead.revision,
    },
  }, stale);
  assert.equal(stale.statusCode, 409);
  const staleBody = JSON.parse(stale.body);
  assert.equal(staleBody.error.code, "REVISION_CONFLICT");
  assert.equal(staleBody.error.recovery, "REFRESH_RESOURCE");
});

test("API contract returns 401 403 and 503 envelopes", async () => {
  const leadsHandler = await loadHandler("api/leads.js");

  const unauthorized = mockResponse();
  await leadsHandler({ method: "GET", headers: {}, query: {}, body: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  const unauthorizedBody = JSON.parse(unauthorized.body);
  assert.equal(unauthorizedBody.error.code, "AUTH_REQUIRED");
  assert.equal(unauthorizedBody.error.recovery, "SIGN_IN");

  const forbiddenEmail = `viewer-${crypto.randomBytes(2).toString("hex")}@lumino.tech`;
  const forbiddenPassword = "ViewerTest-123456";
  const viewerToken = crypto.randomBytes(32).toString("base64url");
  await db.withClient(async (client) => {
    const tenant = await db.ensureDefaultTenant(client);
    const user = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [forbiddenEmail, db.hashPassword(forbiddenPassword), "Viewer"],
    );
    await client.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, roles)
       VALUES ($1, $2, $3::text[])
       ON CONFLICT (tenant_id, user_id)
       DO UPDATE SET roles = EXCLUDED.roles, is_active = true, archived_at = NULL`,
      [tenant.id, user.rows[0].id, ["viewer"]],
    );
    await client.query(
      `INSERT INTO staff_sessions (token_hash, user_id, tenant_id, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 hour')`,
      [db.hashToken(viewerToken), user.rows[0].id, tenant.id],
    );
  });
  await assert.rejects(() => db.authenticateStaff({ email: forbiddenEmail, password: forbiddenPassword }), { code: "TENANT_FORBIDDEN" });

  const forbidden = mockResponse();
  await leadsHandler({
    method: "GET",
    headers: { authorization: `Bearer ${viewerToken}` },
    query: {},
    body: {},
  }, forbidden);
  assert.equal(forbidden.statusCode, 403);
  const forbiddenBody = JSON.parse(forbidden.body);
  assert.equal(forbiddenBody.error.code, "CAPABILITY_FORBIDDEN");

  const previousUrl = process.env.DATABASE_URL;
  const previousStore = process.env.LEADS_STORE;
  process.env.LEADS_STORE = "postgres";
  delete process.env.DATABASE_URL;
  await db.closePool();
  try {
    const unavailable = mockResponse();
    const handler = await loadHandler("api/leads.js");
    await handler({
      method: "POST",
      headers: { "content-type": "application/json" },
      query: {},
      body: {
        company: "X",
        name: "Y",
        email: "z@example.com",
        note: "n",
        consent: true,
      },
    }, unavailable);
    assert.equal(unavailable.statusCode, 503);
    const unavailableBody = JSON.parse(unavailable.body);
    assert.equal(unavailableBody.error.code, "DEPENDENCY_UNAVAILABLE");
    assert.equal(unavailableBody.error.retryable, true);
  } finally {
    process.env.DATABASE_URL = previousUrl;
    process.env.LEADS_STORE = previousStore;
    await db.closePool();
  }
});
