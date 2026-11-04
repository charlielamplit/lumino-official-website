const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const contract = require("../packages/shared/service-contract.js");
const registry = require("../apps/site/site/service-registry.js");

function loadCatalog() {
  const file = path.join(__dirname, "../apps/site/site/services-catalog.js");
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { module: { exports: {} }, exports: {}, console };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox, { filename: "services-catalog.js" });
  const list = sandbox.LuminoServicesCatalog;
  assert.ok(Array.isArray(list), "LuminoServicesCatalog should be an array");
  return list;
}

test("Portal 契约与内部 registry 六项服务对齐", () => {
  assert.deepEqual(Object.keys(registry).sort(), Object.keys(contract).sort());
  for (const [id, service] of Object.entries(contract)) {
    assert.equal(registry[id].id, service.id);
    assert.equal(registry[id].name, service.name);
    assert.equal(registry[id].status, service.status);
    assert.equal(registry[id].statusLabel, service.statusLabel);
    assert.equal(registry[id].primaryActionLabel, service.primaryActionLabel);
    assert.equal(registry[id].publicRoute, service.publicRoute);
  }
});

test("公开站实际渲染目录与契约 ID 对齐", () => {
  const catalog = loadCatalog();
  const ids = catalog.map((s) => String(s.id)).sort();
  const contractIds = Object.keys(contract).map(String).sort();
  assert.equal(ids.join("|"), contractIds.join("|"));
  for (const svc of catalog) {
    assert.ok(typeof svc.href === "string" && svc.href.startsWith("/"), `${svc.id} needs a public href`);
    assert.ok(contract[svc.id], `${svc.id} missing from shared contract`);
    assert.ok(svc.name?.zh || typeof svc.name === "string");
    assert.ok(Array.isArray(svc.steps) && svc.steps.length >= 3);
    assert.ok(Array.isArray(svc.deliv) && svc.deliv.length >= 2);
    assert.ok(Array.isArray(svc.boundaries) && svc.boundaries.length >= 1);
  }
});

test("公开目录文案不夹带内部成熟度标签", () => {
  const catalog = loadCatalog();
  const blob = JSON.stringify(catalog);
  assert.doesNotMatch(blob, /\bPILOT\b/);
  assert.doesNotMatch(blob, /\bPLANNED\b/);
  assert.doesNotMatch(blob, /\bUNVERIFIED\b/);
  assert.doesNotMatch(blob, /claimState/);
});

test("内部 registry 不允许未核实声明", () => {
  for (const service of Object.values(registry)) {
    assert.notEqual(service.claimState, "UNVERIFIED");
    assert.ok(["SUPPORTED", "PILOT", "PLANNED"].includes(service.claimState));
    assert.ok(service.boundaries.length >= 3);
    assert.match(service.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});
