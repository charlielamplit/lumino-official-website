const test = require("node:test");
const assert = require("node:assert/strict");
const Calculation = require("../domain/pcf-calculation.js");
const ReportLock = require("../domain/pcf-report-lock.js");
const { confirm: confirmDeclaration, defaultsForProduct } = require("../domain/pcf-declaration.js");
const { confirm: confirmBoundary, suggest } = require("../domain/pcf-boundary.js");
const Factors = require("../domain/pcf-factors.js");
const Template = require("../domain/pcf-template.js");

const declaration = confirmDeclaration(defaultsForProduct({ id: "PRD-HRC-01", name: "热轧非合金钢卷" }), { actor: "周岚" });
const boundary = confirmBoundary(suggest(declaration).proposal, { actor: "周岚" });
const factors = Factors.confirm(Factors.defaultSet(declaration), { actor: "周岚" });
const template = Template.validateUpload({
  filename: "Lumino_PCF_数据采集模板_HRC-01.xlsx",
  templateVersion: "PCF-DATA-PACK-1.0",
  scenario: "valid",
});

test("计算构建阶段结果与热点，总和可核对", () => {
  const power = { id: "REC-HX-POWER-2026Q3", versionId: "REC-HX-POWER-2026Q3@1" };
  const inventory = Calculation.buildDemoInventory({ factors, power });
  const result = Calculation.buildResult({
    declaration,
    boundary,
    factors,
    inventory,
    inputMode: "demo_seed",
    formalUseAllowed: false,
    actor: { actor: "周岚" },
  });
  assert.equal(result.stages.length, 6);
  assert.equal(result.lineItems.length, 6);
  assert.equal(result.hotspots[0].id, "LCI-MAT-001");
  assert.equal(result.formalUseAllowed, false);
  assert.equal(result.unit, "tCO2e/t");
  assert.ok(result.limitations.length >= 1);
  const stageTotal = result.stages.reduce((sum, stage) => sum + stage.value, 0);
  assert.ok(Math.abs(stageTotal - result.total) < 0.002);
});

test("报告锁定清单覆盖声明、边界、模板、因子、快照、Run 与绑定", () => {
  const inventory = Calculation.buildDemoInventory({ factors });
  const calculation = Calculation.buildResult({ declaration, boundary, factors, inventory, inputMode: "demo_seed", actor: { actor: "周岚" } });
  const lock = ReportLock.buildLockInventory({
    declaration,
    boundary,
    template,
    factors,
    calculation,
    snapshot: { id: "SNAP-PCF-HRC-01", status: "LOCKED", locked: true, inputAssetVersionIds: ["REC-HX-POWER-2026Q3@1"] },
    run: { id: "ARUN-PCF-001", status: "SUCCEEDED" },
    bindings: [{ id: "BIND-REC-POWER-PCF", assetVersionId: "REC-HX-POWER-2026Q3@1", status: "CONFIRMED", usagePurpose: "产品能源分配" }],
    actor: { actor: "李娜" },
  });
  assert.equal(lock.status, "LOCKED");
  assert.equal(lock.lockedBy, "李娜");
  assert.equal(lock.formalUseAllowed, false);
  const kinds = new Set(lock.items.map((item) => item.kind));
  ["declaration", "boundary", "template", "factorSet", "inventory", "snapshot", "calculationRun", "binding"].forEach((kind) => {
    assert.ok(kinds.has(kind), `missing ${kind}`);
  });
  assert.match(lock.statement, /不可正式披露/);
});
