const test = require("node:test");
const assert = require("node:assert/strict");
const Calculation = require("../domain/pcf-calculation.js");
const Factors = require("../domain/pcf-factors.js");

const confirmedFactors = Factors.confirm(Factors.defaultSet({ productId: "PRD-HRC-01" }), { actor: "周岚" });

test("活动数据按同维度换算，MWh 可转换为 kWh", () => {
  assert.equal(Calculation.convert(0.62, "MWh", "kWh"), 620);
});

test("普通清单行按活动数据乘排放因子计算", () => {
  const line = Calculation.calculateLine({
    id: "LCI-POWER-TEST",
    name: "购入电力",
    stageId: "manufacturing",
    activity: { value: 0.62, unit: "MWh", sourceKind: "invoice", qualityTier: "TIER_1" },
    factor: { id: "EF-GRID-TEST", value: 0.5703, numeratorUnit: "kgCO2e", denominatorUnit: "kWh", applicabilityConfirmed: true },
  });
  assert.equal(line.normalizedActivity, 620);
  assert.equal(line.emissionKgCO2e, 353.586);
});

test("运输清单行按质量乘距离乘因子计算", () => {
  const line = Calculation.calculateLine({
    id: "LCI-TRANSPORT-TEST",
    name: "上游运输",
    stageId: "raw-material-transport",
    type: "transport",
    distanceKm: 450,
    activity: { value: 1.4, unit: "t", sourceKind: "erp", qualityTier: "TIER_2" },
    factor: { id: "EF-ROAD-TEST", value: 0.062, numeratorUnit: "kgCO2e", denominatorUnit: "t·km", applicabilityConfirmed: true },
  });
  assert.equal(line.normalizedActivity, 630);
  assert.equal(line.emissionKgCO2e, 39.06);
});

test("演示清单输出六阶段、热点与数据质量，且不可正式披露", () => {
  const inventory = Calculation.buildDemoInventory({ factors: confirmedFactors, power: { versionId: "REC-HX-POWER-2026Q3@1" } });
  const result = Calculation.buildResult({
    declaration: { functionalUnit: "1 吨热轧非合金钢卷" },
    boundary: { boundaryType: "从摇篮到大门" },
    factors: confirmedFactors,
    inventory,
    inputMode: "demo_seed",
    formalUseAllowed: false,
  });
  assert.equal(result.stages.length, 6);
  assert.equal(result.lineItems.length, 6);
  assert.equal(result.lineItems.find((row) => row.id === "LCI-ENE-001").factor.id, confirmedFactors.items[0].id);
  assert.equal(result.formalUseAllowed, false);
  assert.ok(result.hotspots.length > 0);
  assert.ok(result.dataQuality.primaryActivityCoverage > 0);
  assert.match(result.limitations.join("\n"), /演示输入/);
});

test("不兼容的活动数据单位不允许静默计算", () => {
  assert.throws(() => Calculation.calculateLine({
    id: "LCI-UNIT-ERROR",
    name: "错误单位",
    stageId: "manufacturing",
    activity: { value: 1, unit: "kg", sourceKind: "erp", qualityTier: "TIER_2" },
    factor: { id: "EF-POWER", value: 0.5, numeratorUnit: "kgCO2e", denominatorUnit: "kWh", applicabilityConfirmed: true },
  }), (error) => error.code === "PCF_UNIT_MISMATCH");
});

test("未确认适用性的因子阻断计算", () => {
  const inventory = Calculation.buildDemoInventory({ factors: confirmedFactors });
  inventory[0].factor.applicabilityConfirmed = false;
  assert.throws(() => Calculation.buildResult({ inventory }), (error) => {
    assert.equal(error.code, "PCF_INVENTORY_INVALID");
    assert.match(error.message, /适用性未确认/);
    return true;
  });
});

test("系统边界外的清单行保留记录但不计入总量", () => {
  const inventory = Calculation.buildDemoInventory({ factors: confirmedFactors });
  inventory.push({
    id: "LCI-USE-TEST",
    name: "使用阶段演示",
    stageId: "use",
    activity: { value: 100, unit: "kWh", sourceKind: "estimated", qualityTier: "TIER_3" },
    factor: { id: "EF-USE-TEST", value: 1, numeratorUnit: "kgCO2e", denominatorUnit: "kWh", applicabilityConfirmed: true },
  });
  const result = Calculation.buildResult({
    boundary: { boundaryType: "从摇篮到大门" },
    factors: confirmedFactors,
    inventory,
  });
  const useLine = result.lineItems.find((row) => row.id === "LCI-USE-TEST");
  const useStage = result.stages.find((row) => row.id === "use");
  assert.equal(useLine.included, false);
  assert.equal(useStage.included, false);
  assert.equal(useStage.value, 0);
  assert.equal(useStage.excludedValue, 0.1);
  assert.ok(!result.hotspots.some((row) => row.id === "LCI-USE-TEST"));
});
