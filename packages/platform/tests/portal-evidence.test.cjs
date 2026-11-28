const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const db = require("../db/index.js");
const suffix = crypto.randomBytes(4).toString("hex");
const password = `Evidence-${suffix}-2026!`;
let handler;
let ownerToken;
let otherToken;
let materialId;
const objects = new Map();
const store = {
  put: async (key, bytes) => { objects.set(key, Buffer.from(bytes)); },
  get: async (key) => objects.get(key),
};

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    end(body) { this.body = body; return this; },
  };
}

async function call(method, token, body, query) {
  const result = response();
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body, query }, result);
  return result;
}

test.before(async () => {
  process.env.PORTAL_AUTH_ENABLED = "1";
  await db.migrate();
  const owner = await db.provisionPortalAccount({ email: `evidence-${suffix}@example.com`, password,
    name: "资料负责人", tenantSlug: `evidence-${suffix}`, tenantName: "资料测试企业" });
  const other = await db.provisionPortalAccount({ email: `evidence-other-${suffix}@example.com`, password,
    name: "其他负责人", tenantSlug: `evidence-other-${suffix}`, tenantName: "其他测试企业" });
  ownerToken = (await db.authenticatePortal({ email: owner.user.email, password })).token;
  otherToken = (await db.authenticatePortal({ email: other.user.email, password })).token;
  const session = await db.resolvePortalSession(ownerToken);
  const project = await db.createPortalAnnualProject(session, { serviceYear: 2026, confirmedTenantName: owner.tenant.name });
  const product = await db.createPortalProjectRecord(session, { projectId: project.id, kind: "product", record: { name: "热轧钢板", cnCode: "72085120" } });
  const facility = await db.createPortalProjectRecord(session, { projectId: project.id, kind: "facility", record: { name: "一厂", location: "上海" } });
  await db.createPortalProjectRecord(session, { projectId: project.id, kind: "production_link", record: { productId: product.id, facilityId: facility.id } });
  materialId = (await db.createPortalMaterialRequest(session, { projectId: project.id, facilityId: facility.id, quarter: 1 })).record.id;
  const module = await import(pathToFileURL(path.resolve(__dirname, "../../../api/portal-evidence.js")).href);
  handler = module.createPortalEvidenceHandler(() => store, () => true);
});

test.after(async () => { await db.closePool(); });

test("private evidence is versioned, integrity checked, and tenant scoped", async () => {
  const bytes = Buffer.from("date,gas_nm3\n2026-01-01,100\n", "utf8");
  const payload = { materialRequestId: materialId, filename: "gas.csv", base64: bytes.toString("base64"), tenantId: "forged" };
  const unauthorized = await call("POST", null, payload);
  assert.equal(unauthorized.statusCode, 401);
  const crossTenant = await call("POST", otherToken, payload);
  assert.equal(crossTenant.statusCode, 404);
  const first = await call("POST", ownerToken, payload);
  assert.equal(first.statusCode, 201);
  const firstRecord = JSON.parse(first.body).data.evidence;
  assert.equal(firstRecord.version, 1);
  assert.equal(firstRecord.materialRequestId, materialId);
  assert.equal(firstRecord.sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
  assert.equal("objectKey" in firstRecord, false);
  const second = await call("POST", ownerToken, payload);
  assert.equal(JSON.parse(second.body).data.evidence.version, 2);
  assert.equal(objects.size, 2);
  const own = await call("GET", ownerToken, null, { evidenceId: firstRecord.id });
  assert.equal(own.statusCode, 200);
  assert.deepEqual(own.body, bytes);
  assert.match(own.headers["content-disposition"], /^attachment;/);
  assert.equal((await call("GET", otherToken, null, { evidenceId: firstRecord.id })).statusCode, 404);
  const workspace = await db.portalWorkspace(await db.resolvePortalSession(ownerToken));
  assert.equal(workspace.evidence.length, 2);
  assert.equal(workspace.evidence.some((item) => "objectKey" in item), false);
  assert.deepEqual((await db.portalWorkspace(await db.resolvePortalSession(otherToken))).evidence, []);
  const workspaceHandler = (await import(pathToFileURL(path.resolve(__dirname, "../../../api/portal-workspace.js")).href)).default;
  const closedWorkspace = response();
  await workspaceHandler({ method: "GET", headers: { authorization: `Bearer ${ownerToken}` } }, closedWorkspace);
  assert.equal(JSON.parse(closedWorkspace.body).data.capabilities.evidenceUpload, false);
  assert.deepEqual(JSON.parse(closedWorkspace.body).data.evidence, []);
  const objectKey = (await db.withClient((client) => client.query("SELECT object_key FROM portal_evidence WHERE id = $1", [firstRecord.id]))).rows[0].object_key;
  objects.set(objectKey, Buffer.from("tampered"));
  assert.equal((await call("GET", ownerToken, null, { evidenceId: firstRecord.id })).statusCode, 503);
});

test("invalid files never reserve evidence and COS failure does not publish it", async () => {
  const initialCount = (await db.withClient((client) => client.query("SELECT count(*)::int AS count FROM portal_evidence WHERE material_request_id = $1", [materialId]))).rows[0].count;
  for (const bad of [
    { filename: "bad.pdf", base64: Buffer.from("hello").toString("base64") },
    { filename: "bad.csv", base64: Buffer.from([0xff]).toString("base64") },
    { filename: "bad.csv", base64: "%%%" },
  ]) assert.equal((await call("POST", ownerToken, { materialRequestId: materialId, ...bad })).statusCode, 400);
  assert.equal((await db.withClient((client) => client.query("SELECT count(*)::int AS count FROM portal_evidence WHERE material_request_id = $1", [materialId]))).rows[0].count, initialCount);
  const previousPut = store.put;
  store.put = async () => { throw Object.assign(new Error("storage offline"), { code: "Unavailable" }); };
  try {
    assert.equal((await call("POST", ownerToken, { materialRequestId: materialId, filename: "new.txt", base64: Buffer.from("100").toString("base64") })).statusCode, 503);
  } finally { store.put = previousPut; }
  const failed = (await db.withClient((client) => client.query("SELECT id, status FROM portal_evidence WHERE material_request_id = $1 ORDER BY version DESC LIMIT 1", [materialId]))).rows[0];
  assert.equal(failed.status, "FAILED");
  assert.equal((await call("GET", ownerToken, null, { evidenceId: failed.id })).statusCode, 404);
});
