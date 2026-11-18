const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  AUTHORITY_CONTRACT_VERSION,
  AUTHORITY_ERROR_CATALOG,
  ServerAuthorityBoundary,
} = require("../contracts/server-authority.js");

function fixture(overrides = {}) {
  const audits = [];
  const sessions = {
    valid: { userId: "USR-1", sessionId: "SES-1", activeTenantId: "TNT-1" },
  };
  const memberships = [{ userId: "USR-1", tenantId: "TNT-1", roles: ["customer_owner"] }];
  const projects = [{ id: "CASE-2026", tenantId: "TNT-1", serviceId: "cbam", serviceYear: "2026" }];
  const objects = [{
    id: "PKG-Q3",
    type: "quarterlyPackage",
    revision: 3,
    tenantId: "TNT-1",
    annualProjectId: "CASE-2026",
    workstream: "data_collection",
    period: { quarter: "Q3" },
  }];
  const boundary = new ServerAuthorityBoundary({
    identityProvider: {
      resolveSession: async (sessionRef) => sessions[sessionRef] || null,
    },
    membershipRepository: {
      findActive: async (query) => memberships.find((item) => item.userId === query.userId && item.tenantId === query.tenantId) || null,
    },
    annualProjectRepository: {
      findByIdForTenant: async (query) => projects.find((item) => item.id === query.annualProjectId && item.tenantId === query.tenantId) || null,
    },
    objectRepository: {
      findCurrentByIdForTenant: async (query) => objects.find((item) => item.id === query.objectId && item.tenantId === query.tenantId && item.annualProjectId === query.annualProjectId) || null,
    },
    capabilityPolicy: {
      canUse: async ({ actor, capability }) => actor.roles.includes("customer_owner") && capability === "CBAM_FILE_PARSE",
    },
    auditSink: { append: async (event) => audits.push(event) },
    clock: () => Date.parse("2026-11-16T12:00:00Z"),
    ...overrides,
  });
  return { boundary, audits, sessions, memberships, projects, objects };
}

function request(patch = {}) {
  return {
    sessionRef: "valid",
    capability: "CBAM_FILE_PARSE",
    clientHint: {
      tenantId: "TNT-1",
      annualProjectId: "CASE-2026",
      serviceYear: "2099",
      workstream: "forged",
      roles: ["system"],
      objectRef: { type: "quarterlyPackage", id: "PKG-Q3", revision: 3 },
      ...patch,
    },
  };
}

test("server rebuilds actor and context and ignores forged client roles and business fields", async () => {
  const { boundary, audits } = fixture();
  const result = await boundary.resolveAgentContext(request());
  assert.equal(result.authorityVersion, AUTHORITY_CONTRACT_VERSION);
  assert.deepEqual(result.actor, { userId: "USR-1", tenantId: "TNT-1", roles: ["customer_owner"] });
  assert.deepEqual(result.context, {
    contextVersion: "1.0.0",
    serviceId: "cbam",
    tenantId: "TNT-1",
    annualProjectId: "CASE-2026",
    serviceYear: "2026",
    workstream: "data_collection",
    objectRef: { type: "quarterlyPackage", id: "PKG-Q3", revision: 3 },
    period: { quarter: "Q3" },
  });
  assert.equal(audits.at(-1).outcome, "ALLOWED");
});

test("missing or invalid session fails closed and is audited", async () => {
  const { boundary, audits } = fixture();
  await assert.rejects(boundary.resolveAgentContext({ ...request(), sessionRef: "missing" }), { code: "AUTH_REQUIRED", httpStatus: 401 });
  assert.deepEqual(audits.at(-1), {
    schemaVersion: "1.0.0",
    eventType: "AUTHORIZATION_DECIDED",
    occurredAt: "2026-11-16T12:00:00.000Z",
    outcome: "DENIED",
    reasonCode: "AUTH_REQUIRED",
    actorId: null,
    tenantId: null,
    capability: "CBAM_FILE_PARSE",
    annualProjectId: null,
    objectRef: null,
  });
});

test("malformed requests fail closed through the same audit boundary", async () => {
  const { boundary, audits } = fixture();
  await assert.rejects(boundary.resolveAgentContext({ sessionRef: "valid", clientHint: {} }), { code: "CAPABILITY_FORBIDDEN" });
  assert.equal(audits.at(-1).reasonCode, "CAPABILITY_FORBIDDEN");

  await assert.rejects(boundary.resolveAgentContext({
    sessionRef: "valid",
    capability: "CBAM_FILE_PARSE",
    clientHint: { tenantId: "TNT-1" },
  }), { code: "PROJECT_NOT_FOUND" });
  assert.equal(audits.at(-1).reasonCode, "PROJECT_NOT_FOUND");
});

test("client cannot switch tenant or obtain roles from request parameters", async () => {
  const { boundary, audits } = fixture();
  await assert.rejects(boundary.resolveAgentContext(request({ tenantId: "TNT-OTHER", roles: ["system"] })), { code: "TENANT_FORBIDDEN" });
  assert.equal(audits.at(-1).reasonCode, "TENANT_FORBIDDEN");
});

test("tenant-scoped repositories do not reveal cross-tenant project or object existence", async () => {
  const { boundary, audits } = fixture();
  await assert.rejects(boundary.resolveAgentContext(request({ annualProjectId: "CASE-OTHER" })), { code: "PROJECT_NOT_FOUND", httpStatus: 404 });
  assert.equal(audits.at(-1).objectRef, null);

  await assert.rejects(boundary.resolveAgentContext(request({ objectRef: { type: "quarterlyPackage", id: "OTHER-OBJECT", revision: 1 } })), { code: "OBJECT_FORBIDDEN", httpStatus: 404 });
  assert.equal(audits.at(-1).objectRef, null);
});

test("stale object revision is rejected before capability execution", async () => {
  const { boundary, audits } = fixture();
  await assert.rejects(boundary.resolveAgentContext(request({ objectRef: { type: "quarterlyPackage", id: "PKG-Q3", revision: 2 } })), { code: "OBJECT_REVISION_CONFLICT", httpStatus: 409 });
  assert.deepEqual(audits.at(-1).objectRef, { type: "quarterlyPackage", id: "PKG-Q3", revision: 3 });
});

test("capability policy is evaluated with server roles and records a denial", async () => {
  const { boundary, audits } = fixture();
  await assert.rejects(boundary.resolveAgentContext({ ...request(), capability: "CBAM_FORMAL_DELIVERY" }), { code: "CAPABILITY_FORBIDDEN", httpStatus: 403 });
  assert.equal(audits.at(-1).reasonCode, "CAPABILITY_FORBIDDEN");
});

test("malformed authoritative repository records fail closed instead of becoming string values", async () => {
  const base = fixture();
  const malformedProject = fixture({
    annualProjectRepository: {
      findByIdForTenant: async () => ({ id: "CASE-2026", tenantId: "TNT-1", serviceId: "cbam" }),
    },
    auditSink: { append: async (event) => base.audits.push(event) },
  });
  await assert.rejects(malformedProject.boundary.resolveAgentContext(request()), { code: "AUTHORITY_DEPENDENCY_INVALID", httpStatus: 500 });

  const malformedObject = fixture({
    objectRepository: {
      findCurrentByIdForTenant: async () => ({
        id: "PKG-Q3", type: "quarterlyPackage", revision: 3,
        tenantId: "TNT-1", annualProjectId: "CASE-2026",
      }),
    },
    auditSink: { append: async (event) => base.audits.push(event) },
  });
  await assert.rejects(malformedObject.boundary.resolveAgentContext(request()), { code: "AUTHORITY_DEPENDENCY_INVALID", httpStatus: 500 });
});

test("authority schemas are closed versioned Draft 2020-12 objects", () => {
  const schemaDir = path.join(__dirname, "..", "schemas");
  for (const name of fs.readdirSync(schemaDir).filter((file) => file.endsWith(".json"))) {
    const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, name), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.match(schema.$id, /\/1\.0\.0$/);
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, false);
  }
  assert.equal(AUTHORITY_ERROR_CATALOG.OBJECT_FORBIDDEN.httpStatus, 404);
});
