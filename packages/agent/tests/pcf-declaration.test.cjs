const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalize,
  validate,
  confirm,
  toStageGate,
  defaultsForProduct,
  DECLARATION_VERSION,
} = require("../domain/pcf-declaration.js");
const { evaluateGate } = require("../domain/stage-gates.js");
const { WorkflowEngine, createMemoryStorage } = require("../domain/workflow-engine.js");

test("核算声明 normalize 与 validate", () => {
  const draft = defaultsForProduct({ id: "PRD-HRC-01", name: "热轧非合金钢卷", payload: { summary: "热轧" } });
  assert.equal(draft.schemaVersion, DECLARATION_VERSION);
  assert.equal(validate(draft).ok, true);
  assert.equal(validate(normalize({ productId: "PRD-HRC-01" })).ok, false);
});

test("confirm 写入确认标记，并可供 stage gate 通过", () => {
  const confirmed = confirm(defaultsForProduct({ id: "PRD-HRC-01", name: "热轧非合金钢卷" }), { actor: "周岚" });
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.confirmedBy, "周岚");
  const gate = evaluateGate("pcf", "declaration", { declaration: toStageGate(confirmed) });
  assert.equal(gate.ok, true);
});

test("工作流 patch 可同步 scope 与 declaration", () => {
  const engine = new WorkflowEngine({ storage: createMemoryStorage(), clock: () => Date.parse("2026-10-28T02:00:00Z") });
  engine.seed([{
    id: "PCF-2026-001",
    type: "serviceCase",
    status: "SCOPING",
    owner: "周岚",
    scope: "草稿",
    metadata: { serviceId: "pcf", productId: "PRD-HRC-01" },
  }]);
  const confirmed = confirm(defaultsForProduct({ id: "PRD-HRC-01", name: "热轧非合金钢卷" }), { actor: "周岚" });
  engine.transition("PCF-2026-001", "COLLECTING", {
    actor: "周岚",
    role: "customer_owner",
    reason: "确认核算声明",
    metadata: { declaration: confirmed, productId: confirmed.productId },
  });
  const patched = engine.patch("PCF-2026-001", {
    scope: `${confirmed.productName} · ${confirmed.functionalUnit}`,
    metadata: { declaration: confirmed },
  }, { actor: "周岚", role: "customer_owner", reason: "同步范围字段" });
  assert.match(patched.scope, /热轧非合金钢卷/);
  assert.equal(patched.metadata.declaration.confirmed, true);
  assert.equal(patched.status, "COLLECTING");
});
