const test = require("node:test");
const assert = require("node:assert/strict");
const Template = require("../domain/pcf-template.js");
const Inventory = require("../domain/pcf-inventory.js");
const Factors = require("../domain/pcf-factors.js");
const { evaluateGate } = require("../domain/stage-gates.js");
const { confirm: confirmDeclaration, defaultsForProduct } = require("../domain/pcf-declaration.js");
const { confirm: confirmBoundary, suggest } = require("../domain/pcf-boundary.js");

const declaration = confirmDeclaration(defaultsForProduct({ id: "PRD-HRC-01", name: "热轧非合金钢卷" }), { actor: "周岚" });
const boundary = confirmBoundary(suggest(declaration).proposal, { actor: "周岚" });

test("模板校验：正常通过写入 VALIDATED", () => {
  const result = Template.validateUpload({
    filename: "Lumino_PCF_数据采集模板_HRC-01.xlsx",
    templateVersion: "PCF-DATA-PACK-1.0",
    scenario: "valid",
  });
  assert.equal(result.status, "VALIDATED");
  assert.equal(evaluateGate("pcf", "template", { template: Template.toStageGate(result) }).ok, true);
});

test("模板校验：结构错误与单位错误可恢复", () => {
  const structure = Template.validateUpload({
    filename: "bad.xlsx",
    templateVersion: "PCF-DATA-PACK-1.0",
    scenario: "structure_error",
  });
  assert.equal(structure.status, "INVALID");
  assert.ok(structure.issues.some((item) => item.code === "STRUCTURE"));
  assert.equal(evaluateGate("pcf", "template", { template: Template.toStageGate(structure) }).ok, false);

  const units = Template.validateUpload({
    filename: "pack.xlsx",
    templateVersion: "PCF-DATA-PACK-1.0",
    scenario: "unit_error",
  });
  assert.ok(units.issues.some((item) => item.code === "UNIT"));
});

test("清单域由模板与绑定投影，不再返回空壳", () => {
  const template = Template.validateUpload({
    filename: "pack.xlsx",
    templateVersion: "PCF-DATA-PACK-1.0",
    scenario: "partial",
  });
  const ledger = Inventory.buildDomainLedger({
    declaration,
    boundary,
    template,
    bindings: [{ id: "BIND-REC-POWER-PCF", assetId: "REC-HX-POWER-2026Q3", status: "PENDING_CONFIRMATION" }],
  });
  assert.equal(ledger.rows.length, 7);
  const energy = ledger.rows.find((row) => row.id === "energy");
  assert.equal(energy.status, "1 项待确认");
  assert.ok(ledger.summary.ready >= 1);
});

test("因子由匹配引擎推荐，确认后 stage gate 通过", () => {
  const draft = Factors.defaultSet({
    declaration,
    facilityGeography: "上海",
    activities: [{ id: "energy", name: "购入电力", unit: "MWh" }]
  });
  assert.equal(draft.sourceKind, "matcher_recommendation");
  assert.equal(draft.provenance.localDatabase, false);
  assert.equal(draft.provenance.localCatalogAvailable, true);
  assert.ok(draft.provenance.intendedSources.includes("DatabaseofEmissionFactor"));
  assert.ok(draft.items.length >= 1);
  assert.ok(draft.recommendation.proposalOnly);
  assert.equal(evaluateGate("pcf", "factors", { factors: Factors.toStageGate(draft) }).ok, false);
  const confirmed = Factors.confirm(draft, { actor: "周岚" });
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.sourceKind, "matcher_recommendation");
  assert.equal(evaluateGate("pcf", "factors", { factors: Factors.toStageGate(confirmed) }).ok, true);
});
