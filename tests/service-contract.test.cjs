const test = require("node:test");
const assert = require("node:assert/strict");
const contract = require("../apps/portal/runtime/service-contract.js");
const publicServices = require("../apps/site/site/service-registry.js");

test("公开站与 Portal 共享六项服务契约", () => {
  assert.deepEqual(Object.keys(publicServices), Object.keys(contract));
  for (const [id, service] of Object.entries(contract)) {
    assert.equal(publicServices[id].id, service.id);
    assert.equal(publicServices[id].name, service.name);
    assert.equal(publicServices[id].status, service.status);
    assert.equal(publicServices[id].statusLabel, service.statusLabel);
    assert.equal(publicServices[id].primaryActionLabel, service.primaryActionLabel);
    assert.equal(publicServices[id].publicRoute, service.publicRoute);
  }
});

test("公开服务不允许未核实声明", () => {
  for (const service of Object.values(publicServices)) {
    assert.notEqual(service.claimState, "UNVERIFIED");
    assert.ok(["SUPPORTED", "PILOT", "PLANNED"].includes(service.claimState));
    assert.ok(service.boundaries.length >= 3);
    assert.match(service.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});
