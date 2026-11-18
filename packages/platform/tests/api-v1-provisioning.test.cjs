const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { execFileSync } = require("node:child_process");

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

test.before(async () => {
  await db.migrate();
  await db.bootstrapStaffFromEnv();
});

test.after(async () => {
  await db.closePool();
});

test("empty database migration creates phase-1 tables", async () => {
  const dbName = `lumino_empty_${crypto.randomBytes(3).toString("hex")}`;
  execFileSync("createdb", [dbName], { stdio: "ignore" });
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `postgres://lumino@127.0.0.1:5432/${dbName}`;
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
      execFileSync("dropdb", ["--if-exists", dbName], { stdio: "ignore" });
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

test("provisioning is anti-replay for archived accounts and idempotent for active ones", async () => {
  const previous = process.env.STAFF_USERS;
  const email = `prov-${crypto.randomBytes(3).toString("hex")}@lumino.tech`;
  const password = "ProvTest-123456";
  process.env.STAFF_USERS = `${email}:${password}:ops:供给`;
  try {
    const first = await db.provisionStaffFromEnv({ reactivate: false });
    assert.equal(first.users.length, 1);
    const second = await db.provisionStaffFromEnv({ reactivate: false });
    assert.equal(second.users.length, 1);
    assert.equal(second.users[0].id, first.users[0].id);

    await db.withClient(async (client) => {
      await client.query(`UPDATE users SET archived_at = now(), is_active = false WHERE id = $1`, [first.users[0].id]);
      await client.query(
        `UPDATE tenant_memberships SET archived_at = now(), is_active = false WHERE user_id = $1`,
        [first.users[0].id],
      );
    });

    const third = await db.provisionStaffFromEnv({ reactivate: false });
    assert.equal(third.users.length, 0);
    assert.ok(third.skipped.some((item) => item.email === email));
  } finally {
    process.env.STAFF_USERS = previous;
  }
});

test("API contract returns 401 403 409 and 503 envelopes", async () => {
  const leadsHandler = await loadHandler("api/leads.js");

  const unauthorized = mockResponse();
  await leadsHandler({ method: "GET", headers: {}, query: {}, body: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  const unauthorizedBody = JSON.parse(unauthorized.body);
  assert.equal(unauthorizedBody.error.code, "AUTH_REQUIRED");
  assert.equal(unauthorizedBody.error.recovery, "SIGN_IN");

  // 403: membership role outside ops/sales/admin
  const forbiddenEmail = `viewer-${crypto.randomBytes(2).toString("hex")}@lumino.tech`;
  const forbiddenPassword = "ViewerTest-123456";
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
  });
  const forbiddenSession = await db.authenticateStaff({
    email: forbiddenEmail,
    password: forbiddenPassword,
  });
  const forbiddenToken = forbiddenSession.token;

  const forbidden = mockResponse();
  await leadsHandler({
    method: "GET",
    headers: { authorization: `Bearer ${forbiddenToken}` },
    query: {},
    body: {},
  }, forbidden);
  assert.equal(forbidden.statusCode, 403);
  const forbiddenBody = JSON.parse(forbidden.body);
  assert.equal(forbiddenBody.error.code, "CAPABILITY_FORBIDDEN");

  // 409 revision conflict
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
  }, { tenantId: ops.tenant.id });

  const conflict = mockResponse();
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
      revision: 999,
    },
  }, conflict);
  assert.equal(conflict.statusCode, 409);
  const conflictBody = JSON.parse(conflict.body);
  assert.equal(conflictBody.error.code, "REVISION_CONFLICT");
  assert.equal(conflictBody.error.recovery, "REFRESH_RESOURCE");

  // 503 dependency unavailable when DATABASE_URL missing in postgres mode
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
