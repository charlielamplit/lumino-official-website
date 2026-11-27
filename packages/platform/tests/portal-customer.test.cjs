const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const db = require("../db/index.js");
const suffix = crypto.randomBytes(4).toString("hex");
const password = `Customer-${suffix}-2026!`;
let customer;
let other;
let demo;

test.before(async () => {
  await db.migrate();
  customer = await db.provisionPortalAccount({
    email: `owner-${suffix}@example.com`, password, name: "客户负责人",
    tenantSlug: `customer-${suffix}`, tenantName: "测试钢铁企业",
  });
  other = await db.provisionPortalAccount({
    email: `other-${suffix}@example.com`, password, name: "另一负责人",
    tenantSlug: `other-${suffix}`, tenantName: "另一钢铁企业",
  });
  demo = await db.provisionPortalAccount({
    email: `demo-${suffix}@example.com`, password, name: "演示负责人",
    tenantSlug: `demo-${suffix}`, tenantName: "演示钢铁企业", isDemo: true,
  });
});

test.after(async () => { await db.closePool(); });

test("customer session is tenant scoped and does not pass staff authentication", async () => {
  const session = await db.authenticatePortal({ email: customer.user.email, password });
  const resolved = await db.resolvePortalSession(session.token);
  assert.equal(resolved.tenantId, customer.tenant.id);
  assert.deepEqual(resolved.roles, ["customer_admin"]);
  assert.deepEqual((await db.portalWorkspace(resolved)).projects, []);
  await assert.rejects(() => db.authenticateStaff({ email: customer.user.email, password }), { code: "TENANT_FORBIDDEN" });

  const project = await db.createPortalAnnualProject(resolved, { serviceYear: 2026, confirmedTenantName: "测试钢铁企业（修正）" });
  assert.equal(project.created, true);
  assert.equal(project.status, "SETUP_DRAFT");
  const refreshed = await db.resolvePortalSession(session.token);
  assert.equal(refreshed.tenantName, "测试钢铁企业（修正）");
  const retried = await db.createPortalAnnualProject(refreshed, { serviceYear: 2026, confirmedTenantName: "测试钢铁企业（修正）" });
  assert.equal(retried.id, project.id);
  assert.equal(retried.created, false);

  const otherSession = await db.authenticatePortal({ email: other.user.email, password });
  const otherResolved = await db.resolvePortalSession(otherSession.token);
  assert.deepEqual((await db.portalWorkspace(otherResolved)).projects, []);
  assert.equal((await db.portalWorkspace(resolved)).projects[0].id, project.id);
  const product = await db.createPortalProjectRecord(refreshed, { projectId: project.id, kind: "product", record: { name: "热轧钢板", cnCode: "72085120" } });
  const batch = await db.createPortalProductBatch(refreshed, { projectId: project.id, cnCodes: ["72085120", "72189980", "2507008080"] });
  assert.deepEqual(batch.created.map((row) => row.cnCode), ["72189980", "2507008080"]);
  assert.deepEqual(batch.skippedCodes, ["72085120"]);
  assert.equal((await db.createPortalProductBatch(refreshed, { projectId: project.id, cnCodes: ["2507008080"] })).created.length, 0);
  const facility = await db.createPortalProjectRecord(refreshed, { projectId: project.id, kind: "facility", record: { name: "上海一厂", location: "中国上海" } });
  const link = await db.createPortalProjectRecord(refreshed, { projectId: project.id, kind: "production_link", record: { productId: product.id, facilityId: facility.id, processSummary: "本厂轧制" } });
  assert.equal(link.processSummary, "本厂轧制");
  await assert.rejects(() => db.createPortalProjectRecord(refreshed, { projectId: project.id, kind: "production_link", record: { productId: product.id, facilityId: facility.id } }), { code: "VALIDATION_FAILED" });
  await assert.rejects(() => db.createPortalProjectRecord(otherResolved, { projectId: project.id, kind: "production_link", record: { productId: product.id, facilityId: facility.id } }), { code: "FORBIDDEN_ROLE" });
  const updatedLink = await db.updatePortalProjectRecord(refreshed, { recordId: link.id, kind: "production_link", record: { productId: product.id, facilityId: facility.id, processSummary: "工艺路线待核对" } });
  assert.equal(updatedLink.processSummary, "工艺路线待核对");
  await assert.rejects(() => db.createPortalProjectRecord(refreshed, { projectId: project.id, kind: "material_request", record: { title: "天然气账单", assigneeEmail: "data@example.com" } }), { code: "VALIDATION_FAILED" });
  await assert.rejects(() => db.createPortalMaterialRequest(refreshed, { projectId: project.id, facilityId: other.tenant.id, quarter: 1 }), { code: "RESOURCE_NOT_FOUND" });
  await assert.rejects(() => db.createPortalMaterialRequest(refreshed, { projectId: project.id, facilityId: facility.id, quarter: 5 }), { code: "VALIDATION_FAILED" });
  const material = await db.createPortalMaterialRequest(refreshed, { projectId: project.id, facilityId: facility.id, quarter: 1 });
  assert.equal(material.created, true);
  assert.equal(material.record.period, "2026-Q1");
  assert.equal(material.record.status, "DRAFT");
  assert.equal((await db.createPortalMaterialRequest(refreshed, { projectId: project.id, facilityId: facility.id, quarter: 1 })).record.id, material.record.id);
  await assert.rejects(() => db.createPortalMaterialRequest(otherResolved, { projectId: project.id, facilityId: facility.id, quarter: 1 }), { code: "RESOURCE_NOT_FOUND" });
  assert.deepEqual(new Set((await db.portalWorkspace(refreshed)).records.map((row) => row.id)), new Set([product.id, ...batch.created.map((row) => row.id), facility.id, link.id, material.record.id]));
  const unlinked = await db.createPortalProjectRecord(refreshed, { projectId: project.id, kind: "facility", record: { name: "未关联设施", location: "中国江苏" } });
  await assert.rejects(() => db.createPortalMaterialRequest(refreshed, { projectId: project.id, facilityId: unlinked.id, quarter: 1 }), { code: "VALIDATION_FAILED" });
  const changed = await db.updatePortalProjectRecord(refreshed, { recordId: product.id, kind: "product", record: { name: "热轧卷板", cnCode: "72085120" } });
  assert.equal(changed.name, "热轧卷板");
  await db.renamePortalTenant(refreshed, { tenantName: "测试钢铁企业（最终）" });
  assert.equal((await db.portalWorkspace(await db.resolvePortalSession(session.token))).tenant.name, "测试钢铁企业（最终）");
  assert.deepEqual((await db.portalWorkspace(otherResolved)).records, []);
  await assert.rejects(() => db.createPortalProjectRecord(otherResolved, { projectId: project.id, kind: "product", record: { name: "跨租户", cnCode: "72085120" } }), { code: "FORBIDDEN_ROLE" });
  await assert.rejects(() => db.createPortalProductBatch(otherResolved, { projectId: project.id, cnCodes: ["72085120"] }), { code: "FORBIDDEN_ROLE" });
  await assert.rejects(() => db.updatePortalProjectRecord(otherResolved, { recordId: product.id, kind: "product", record: { name: "跨租户", cnCode: "72085120" } }), { code: "RESOURCE_NOT_FOUND" });
  await assert.rejects(() => db.createPortalProjectRecord(refreshed, { projectId: project.id, kind: "product", record: { name: "错误编码", cnCode: "123" } }), { code: "VALIDATION_FAILED" });
  await assert.rejects(() => db.createPortalProjectRecord(refreshed, { projectId: project.id, kind: "product", record: { name: "目录外编码", cnCode: "99999999" } }), { code: "VALIDATION_FAILED" });
  await assert.rejects(() => db.createPortalProductBatch(refreshed, { projectId: project.id, cnCodes: ["72085120", "99999999"] }), { code: "VALIDATION_FAILED" });

  await db.revokePortalSession(session.token);
  assert.equal(await db.resolvePortalSession(session.token), null);
});

test("demo tenant cannot create a real annual project", async () => {
  const session = await db.authenticatePortal({ email: demo.user.email, password });
  const resolved = await db.resolvePortalSession(session.token);
  assert.equal(resolved.isDemo, true);
  await assert.rejects(() => db.createPortalAnnualProject(resolved, { serviceYear: 2026, confirmedTenantName: "演示钢铁企业" }), { code: "FORBIDDEN_ROLE" });
});

test("Portal API rejects missing sessions and ignores forged tenant fields", async () => {
  const load = async (name) => (await import(pathToFileURL(path.resolve(__dirname, `../../../api/${name}.js`)).href)).default;
  const loginHandler = await load("portal-login");
  const workspaceHandler = await load("portal-workspace");
  const response = () => ({ statusCode: 200, body: "", status(code) { this.statusCode = code; return this; }, setHeader() { return this; }, end(body) { this.body = body; return this; } });

  delete process.env.PORTAL_AUTH_ENABLED;
  const disabled = response();
  await loginHandler({ method: "POST", headers: {}, body: { email: other.user.email, password } }, disabled);
  assert.equal(disabled.statusCode, 503);
  process.env.PORTAL_AUTH_ENABLED = "1";

  const missing = response();
  await workspaceHandler({ method: "GET", headers: {} }, missing);
  assert.equal(missing.statusCode, 401);

  const loggedIn = response();
  await loginHandler({ method: "POST", headers: {}, body: { email: other.user.email, password } }, loggedIn);
  assert.equal(loggedIn.statusCode, 200);
  const token = JSON.parse(loggedIn.body).data.token;

  const created = response();
  await workspaceHandler({ method: "POST", headers: { authorization: `Bearer ${token}` }, body: {
    serviceYear: 2027, confirmedTenantName: "另一钢铁企业", tenantId: customer.tenant.id,
  } }, created);
  assert.equal(created.statusCode, 201);
  const own = await db.portalWorkspace(await db.resolvePortalSession(token));
  assert.equal(own.tenant.id, other.tenant.id);
  assert.equal(own.projects[0].id, JSON.parse(created.body).data.project.id);
  const customerToken = (await db.authenticatePortal({ email: customer.user.email, password })).token;
  const customerProjects = (await db.portalWorkspace(await db.resolvePortalSession(customerToken))).projects;
  assert.equal(customerProjects.some((project) => project.id === own.projects[0].id), false);

  const recordCreated = response();
  await workspaceHandler({ method: "PUT", headers: { authorization: `Bearer ${token}` }, body: {
    projectId: own.projects[0].id, kind: "facility", record: { name: "江苏二厂", location: "中国江苏" }, tenantId: customer.tenant.id,
  } }, recordCreated);
  assert.equal(recordCreated.statusCode, 201);
  assert.equal((await db.portalWorkspace(await db.resolvePortalSession(token))).records[0].name, "江苏二厂");
  const forgedRead = response();
  await workspaceHandler({ method: "GET", headers: { authorization: `Bearer ${token}` }, query: { tenantId: customer.tenant.id } }, forgedRead);
  assert.equal(forgedRead.statusCode, 200);
  assert.equal(JSON.parse(forgedRead.body).data.tenant.id, other.tenant.id);
  assert.equal(JSON.parse(forgedRead.body).data.projects.some((project) => customerProjects.some((item) => item.id === project.id)), false);
  const crossTenantCreate = response();
  await workspaceHandler({ method: "PUT", headers: { authorization: `Bearer ${token}` }, body: {
    projectId: customerProjects[0].id, kind: "facility", record: { name: "越权设施", location: "中国上海" },
  } }, crossTenantCreate);
  assert.equal(crossTenantCreate.statusCode, 403);
  const crossTenantUpdate = response();
  await workspaceHandler({ method: "PATCH", headers: { authorization: `Bearer ${customerToken}` }, body: {
    operation: "update_record", recordId: JSON.parse(recordCreated.body).data.record.id,
    kind: "facility", record: { name: "越权修改", location: "中国上海" },
  } }, crossTenantUpdate);
  assert.equal(crossTenantUpdate.statusCode, 404);
  assert.equal((await db.portalWorkspace(await db.resolvePortalSession(token))).records[0].name, "江苏二厂");
  const renamed = response();
  await workspaceHandler({ method: "PATCH", headers: { authorization: `Bearer ${token}` }, body: { operation: "rename_tenant", tenantName: "另一钢铁企业（修正）" } }, renamed);
  assert.equal(renamed.statusCode, 200);
  assert.equal((await db.portalWorkspace(await db.resolvePortalSession(token))).tenant.name, "另一钢铁企业（修正）");

  const ownSession = await db.resolvePortalSession(token);
  const ownProduct = await db.createPortalProjectRecord(ownSession, { projectId: own.projects[0].id, kind: "product", record: { name: "热轧钢板", cnCode: "72085120" } });
  const ownFacilityId = JSON.parse(recordCreated.body).data.record.id;
  await db.createPortalProjectRecord(ownSession, { projectId: own.projects[0].id, kind: "production_link", record: { productId: ownProduct.id, facilityId: ownFacilityId } });
  const materialCreated = response();
  await workspaceHandler({ method: "PUT", headers: { authorization: `Bearer ${token}` }, body: {
    operation: "create_material_request", projectId: own.projects[0].id,
    facilityId: ownFacilityId, quarter: 2, tenantId: customer.tenant.id,
  } }, materialCreated);
  assert.equal(materialCreated.statusCode, 201);
  assert.equal(JSON.parse(materialCreated.body).data.record.period, "2027-Q2");
  const materialRetried = response();
  await workspaceHandler({ method: "PUT", headers: { authorization: `Bearer ${token}` }, body: {
    operation: "create_material_request", projectId: own.projects[0].id, facilityId: ownFacilityId, quarter: 2,
  } }, materialRetried);
  assert.equal(materialRetried.statusCode, 200);
  assert.equal(JSON.parse(materialRetried.body).data.record.id, JSON.parse(materialCreated.body).data.record.id);
  assert.equal((await db.portalWorkspace(await db.resolvePortalSession(customerToken))).records.some((row) => row.id === JSON.parse(materialCreated.body).data.record.id), false);

  const revoked = response();
  await workspaceHandler({ method: "DELETE", headers: { authorization: `Bearer ${token}` } }, revoked);
  assert.equal(revoked.statusCode, 200);
  const after = response();
  await workspaceHandler({ method: "GET", headers: { authorization: `Bearer ${token}` } }, after);
  assert.equal(after.statusCode, 401);
});

test("customer authentication is rate limited and archived membership invalidates sessions", async () => {
  const email = other.user.email;
  for (let index = 0; index < 5; index += 1) {
    await assert.rejects(() => db.authenticatePortal({ email, password: "wrong-password" }), { code: "AUTH_INVALID" });
  }
  await assert.rejects(() => db.authenticatePortal({ email, password }), { code: "RATE_LIMITED" });
  const session = await db.authenticatePortal({ email: customer.user.email, password });
  await db.withClient((client) => client.query(
    `UPDATE tenant_memberships SET is_active = false WHERE tenant_id = $1 AND user_id = $2`,
    [customer.tenant.id, customer.user.id],
  ));
  assert.equal(await db.resolvePortalSession(session.token), null);
});
