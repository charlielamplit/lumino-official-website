const test = require("node:test");
const assert = require("node:assert/strict");
const { listStages, evaluateGate, evaluatePipeline, GATES_VERSION } = require("../domain/stage-gates.js");

const cbamPassing = {
  scopeDecisions: [{ id: "SD-1", status: "IN_SCOPE" }],
  codeBindings: [{ id: "CN-1", cnCode: "7208", status: "CONFIRMED" }],
  activityBindings: [{ id: "ACT-1", status: "CONFIRMED" }],
  calculation: { currentRun: true, snapshotStatus: "LOCKED" },
  findings: [{ id: "F-1", status: "RESOLVED" }],
  delivery: { status: "LOCKED" }
};

const pcfPassing = {
  declaration: {
    productId: "PRD-HRC-01",
    goal: "客户披露与供应链响应",
    functionalUnit: "1 t product",
    period: "2026",
    confirmed: true,
  },
  boundary: { status: "CONFIRMED" },
  template: { status: "VALIDATED" },
  inventoryBindings: [{ id: "INV-1", status: "CONFIRMED" }],
  factors: [{ id: "EF-1", applicabilityConfirmed: true }],
  calculation: { currentRun: true, snapshotStatus: "LOCKED" },
  review: { expertApproved: true, reportVersion: "PCF-RPT-001@1" }
};

test("stage-gates version and stage lists", () => {
  assert.equal(GATES_VERSION, "0.1.1");
  assert.equal(listStages("cbam").length, 6);
  assert.equal(listStages("pcf").length, 7);
  assert.throws(() => listStages("esg"), { code: "UNKNOWN_SERVICE" });
});

const cbamCases = [
  ["applicability", { scopeDecisions: [] }, "CBAM_SCOPE_UNDECIDED"],
  ["scope-codes", { ...cbamPassing, codeBindings: [{ id: "CN-1", status: "PENDING_CONFIRMATION" }] }, "CBAM_CODE_PENDING"],
  ["data-prep", { ...cbamPassing, activityBindings: [{ id: "ACT-1", status: "CONFLICTED" }] }, "CBAM_DATA_INCOMPLETE"],
  ["calculation", { ...cbamPassing, calculation: { currentRun: true, snapshotStatus: "STALE" } }, "CBAM_CALC_STALE"],
  ["verification", { ...cbamPassing, findings: [{ id: "F-1", status: "OPEN" }] }, "CBAM_FINDING_OPEN"],
  ["importer-delivery", { ...cbamPassing, delivery: { status: "DRAFT" } }, "CBAM_DELIVERY_UNLOCKED"]
];

for (const [stageId, ctx, code] of cbamCases) {
  test(`CBAM ${stageId} fails with ${code}`, () => {
    const failed = evaluateGate("cbam", stageId, ctx);
    assert.equal(failed.ok, false);
    assert.equal(failed.code, code);
    const passed = evaluateGate("cbam", stageId, cbamPassing);
    assert.equal(passed.ok, true);
  });
}

const pcfCases = [
  ["declaration", { declaration: { productId: "", goal: "", functionalUnit: "", period: "", confirmed: false } }, "PCF_DECL_MISSING"],
  ["boundary", { ...pcfPassing, boundary: { status: "PROPOSED" } }, "PCF_BOUNDARY_UNCONFIRMED"],
  ["template", { ...pcfPassing, template: { status: "UPLOADED" } }, "PCF_TEMPLATE_INVALID"],
  ["inventory", { ...pcfPassing, inventoryBindings: [{ id: "INV-1", status: "PENDING_CONFIRMATION" }] }, "PCF_INVENTORY_GAP"],
  ["factors", { ...pcfPassing, factors: [{ id: "EF-1", applicabilityConfirmed: false }] }, "PCF_FACTOR_UNCONFIRMED"],
  ["calc-hotspot", { ...pcfPassing, calculation: { currentRun: false, snapshotStatus: "LOCKED" } }, "PCF_CALC_STALE"],
  ["review-report", { ...pcfPassing, review: { expertApproved: false, reportVersion: null } }, "PCF_REVIEW_PENDING"]
];

for (const [stageId, ctx, code] of pcfCases) {
  test(`PCF ${stageId} fails with ${code}`, () => {
    const failed = evaluateGate("pcf", stageId, ctx);
    assert.equal(failed.ok, false);
    assert.equal(failed.code, code);
    const passed = evaluateGate("pcf", stageId, pcfPassing);
    assert.equal(passed.ok, true);
  });
}

test("CBAM pipeline blocks later stages after first failure", () => {
  const pipeline = evaluatePipeline("cbam", {
    scopeDecisions: [{ id: "SD-1", status: "IN_SCOPE" }],
    codeBindings: [{ id: "CN-1", status: "PENDING_CONFIRMATION" }]
  });
  assert.equal(pipeline[0].ok, true);
  assert.equal(pipeline[1].ok, false);
  assert.equal(pipeline[1].code, "CBAM_CODE_PENDING");
  assert.equal(pipeline[2].blocked, true);
  assert.equal(pipeline[2].code, "STAGE_BLOCKED");
  assert.equal(pipeline[5].blocked, true);
});

test("PCF pipeline all pass when context complete", () => {
  const pipeline = evaluatePipeline("pcf", pcfPassing);
  assert.equal(pipeline.length, 7);
  assert.ok(pipeline.every((item) => item.ok && !item.blocked));
});
