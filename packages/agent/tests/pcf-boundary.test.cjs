const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalize,
  validate,
  suggest,
  confirm,
  toStageGate,
  defaultsFromDeclaration,
  BOUNDARY_VERSION,
} = require("../domain/pcf-boundary.js");
const { evaluateGate } = require("../domain/stage-gates.js");
const { confirm: confirmDeclaration, defaultsForProduct } = require("../domain/pcf-declaration.js");
const { WorkflowEngine, createMemoryStorage } = require("../domain/workflow-engine.js");

const declaration = confirmDeclaration(defaultsForProduct({ id: "PRD-HRC-01", name: "热轧非合金钢卷" }), { actor: "周岚" });

test("边界 suggest 仅为 proposal_only 且不可自动确认", () => {
  const suggestion = suggest(declaration);
  assert.equal(suggestion.completionMode, "proposal_only");
  assert.equal(suggestion.proposal.status, "PROPOSED");
  assert.equal(suggestion.proposal.confirmed, false);
  assert.equal(suggestion.proposal.schemaVersion, BOUNDARY_VERSION);
  assert.equal(validate(suggestion.proposal).ok, true);
});

test("confirm 后可供 stage gate 通过；PROPOSED 不能通过", () => {
  const proposed = defaultsFromDeclaration(declaration);
  assert.equal(evaluateGate("pcf", "boundary", { boundary: toStageGate(proposed) }).ok, false);

  const confirmed = confirm(proposed, { actor: "周岚" });
  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(confirmed.confirmedBy, "周岚");
  assert.equal(evaluateGate("pcf", "boundary", { boundary: toStageGate(confirmed) }).ok, true);
});

test("工作流可保存边界确认且不改写功能单位声明", () => {
  const engine = new WorkflowEngine({ storage: createMemoryStorage(), clock: () => Date.parse("2026-10-28T03:00:00Z") });
  engine.seed([{
    id: "PCF-2026-001",
    type: "serviceCase",
    status: "COLLECTING",
    owner: "周岚",
    scope: "热轧非合金钢卷",
    metadata: { serviceId: "pcf", productId: "PRD-HRC-01", declaration },
  }]);
  const confirmed = confirm(suggest(declaration).proposal, { actor: "周岚" });
  const patched = engine.patch("PCF-2026-001", {
    metadata: { boundary: confirmed },
  }, { actor: "周岚", role: "customer_owner", reason: "确认系统边界" });
  assert.equal(patched.metadata.boundary.status, "CONFIRMED");
  assert.equal(patched.metadata.declaration.functionalUnit, declaration.functionalUnit);
  assert.equal(patched.metadata.boundary.functionalUnitRef, declaration.functionalUnit);
});

test("normalize 支持顿号与换行分隔", () => {
  const boundary = normalize({
    boundaryType: "从摇篮到大门",
    includedProcesses: "炼铁、炼钢\n热轧",
    excludedItems: "销售运输；使用阶段",
    cutOffRule: "1%",
    primaryInputs: "电力,天然气",
  });
  assert.deepEqual(boundary.includedProcesses, ["炼铁", "炼钢", "热轧"]);
  assert.ok(boundary.excludedItems.includes("销售运输"));
  assert.ok(boundary.primaryInputs.includes("电力"));
});
