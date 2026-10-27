const test = require("node:test");
const assert = require("node:assert/strict");
const { AgentTaskEngine, createMemoryStorage, RUNTIME_VERSION } = require("../runtime/agent-task-engine.js");
const capabilities = require("../runtime/capability-catalog.js");
const { applyTaskResult } = require("../runtime/proposal-bridge.js");
const { AssetRegistry, createMemoryStorage: createAssetStorage } = require("../domain/data-asset-engine.js");

function tasks() {
  let time = Date.parse("2026-10-27T00:00:00Z");
  return new AgentTaskEngine({
    storage: createMemoryStorage(),
    capabilities,
    clock: () => (time += 1000)
  });
}

function assets() {
  let time = Date.parse("2026-10-27T00:00:00Z");
  return new AssetRegistry({ storage: createAssetStorage(), clock: () => (time += 1000) });
}

const gasProposal = {
  proposalId: "PROP-GAS-1",
  assetId: "REC-HX-GAS-DEMO",
  targetAssetType: "energyConsumption",
  tenantId: "TNT-0018",
  ownerOrganizationId: "ORG-HX-001",
  name: "?????????",
  subjectRefs: { facilityId: "FAC-JS-02" },
  sourceAssetIds: ["EVD-GAS-DEMO"],
  proposedPatch: { metricCode: "energy.natural_gas.purchased", originalValue: "18420", originalUnit: "Nm3" },
  binding: {
    id: "BIND-GAS-CBAM-DEMO",
    serviceId: "cbam",
    caseId: "CBAM-2026-Q3",
    usagePurpose: "??????",
    scopeId: "FAC-JS-02"
  }
};

test("runtime and capability catalog versions", () => {
  assert.equal(RUNTIME_VERSION, "0.1.0");
  assert.equal(capabilities.CATALOG_VERSION, "0.1.0");
  assert.equal(capabilities.getCapability("CBAM_ENERGY_INVOICE_EXTRACT").completionMode, "proposal_only");
  assert.equal(capabilities.capabilitiesForStage("pcf", "template").length, 1);
});

test("submit is idempotent by serialNo", () => {
  const engine = tasks();
  const first = engine.submit({
    serialNo: "biz-gas-001",
    businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
    tenantId: "TNT-0018",
    input: { filename: "bill.pdf" }
  }, { actor: "Portal" });
  const second = engine.submit({
    serialNo: "biz-gas-001",
    businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
    input: { filename: "other.pdf" }
  }, { actor: "Portal" });
  assert.equal(first.id, second.id);
  assert.equal(first.status, "SUBMITTING");
  assert.equal(engine.getBySerialNo("biz-gas-001").id, first.id);
});

test("happy path SUBMITTING ? PROCESSING ? READY", () => {
  const engine = tasks();
  const created = engine.submit({
    serialNo: "biz-gas-002",
    businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
    input: {}
  }, { actor: "Portal" });
  engine.markProcessing(created.id);
  const done = engine.complete(created.id, { proposals: [gasProposal] });
  assert.equal(done.status, "READY");
  assert.equal(done.result.appliedAs, "proposal_only");
  assert.equal(done.result.proposals.length, 1);
});

test("partial completion uses READY_PARTIAL", () => {
  const engine = tasks();
  const created = engine.submit({
    serialNo: "biz-gas-003",
    businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
    input: {}
  }, { actor: "Portal" });
  const done = engine.simulateSuccess(created.id, { proposals: [gasProposal], partial: true, warnings: ["table truncated"] });
  assert.equal(done.status, "READY_PARTIAL");
});

test("failed and retryable SUBMIT_UNKNOWN can retry", () => {
  const engine = tasks();
  const created = engine.submit({
    serialNo: "biz-gas-004",
    businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
    input: {}
  }, { actor: "Portal" });
  engine.markSubmitUnknown(created.id);
  const retried = engine.retry(created.id, { actor: "Portal" });
  assert.equal(retried.status, "SUBMITTING");
  assert.equal(retried.attempt, 2);
});

test("non-retryable FAILED cannot retry", () => {
  const engine = tasks();
  const created = engine.submit({
    serialNo: "biz-gas-005",
    businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
    input: {}
  }, { actor: "Portal" });
  engine.markProcessing(created.id);
  engine.fail(created.id, "UNSUPPORTED_FORMAT", "?????", { retryable: false });
  assert.throws(() => engine.retry(created.id), { code: "NOT_RETRYABLE" });
});

test("proposal bridge writes PROPOSED asset and binding, never CONFIRMED", () => {
  const engine = tasks();
  const registry = assets();
  const created = engine.submit({
    serialNo: "biz-gas-006",
    businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
    tenantId: "TNT-0018",
    input: {}
  }, { actor: "Portal" });
  const done = engine.simulateSuccess(created.id, { proposals: [gasProposal] });
  const applied = applyTaskResult(registry, done, { tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001" });
  assert.equal(applied.appliedAs, "proposal_only");
  assert.equal(registry.get("REC-HX-GAS-DEMO").status, "PROPOSED");
  assert.equal(registry.bindings({ id: "BIND-GAS-CBAM-DEMO" })[0].status, "PROPOSED");
  assert.throws(
    () => registry.confirm("REC-HX-GAS-DEMO", { actor: "Asset Agent", role: "agent", reason: "????" }),
    { code: "FORBIDDEN" }
  );
});

test("pipeline blocks unknown businessType", () => {
  const engine = tasks();
  assert.throws(
    () => engine.submit({ serialNo: "x", businessType: "NOPE", input: {} }, { actor: "Portal" }),
    { code: "UNKNOWN_BUSINESS_TYPE" }
  );
});
