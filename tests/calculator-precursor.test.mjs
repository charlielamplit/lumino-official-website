import test from "node:test";
import assert from "node:assert/strict";
import {
  precursorUnitValue,
  precursorContribution,
} from "../apps/site/calculator/precursor.mjs";
import { computeRealtimeCost } from "../apps/site/calculator/realtime-cost.mjs";
import { createCalculator } from "../apps/site/calculator/engine.mjs";

const sample = {
  name: "??",
  cnCode: "72071111",
  estimateValue: 1.7,
  consumption: 1.05,
  reason: "test",
  defaultValue: 2.0,
  defaultIsGlobalWorst: false,
  benchmarkA: 1.2,
  benchmarkB: 1.491,
};

test("???????estimate ??????default ?????", () => {
  assert.equal(precursorUnitValue(sample, "estimate"), 1.7);
  assert.equal(precursorUnitValue(sample, "default"), 2.0);
  assert.equal(precursorContribution(sample, "estimate"), 1.7 * 1.05);
  assert.equal(precursorContribution(sample, "default"), 2.0 * 1.05);
});

test("??????? minSee ???SEE = own + ?(value×consumption)", () => {
  const basis = {
    see: 0.11,
    sefa: 1.33,
    certificatePrice: 75.36,
    bm: 1.36,
    bmA: 0.2,
    sefaFactor: 0.975,
    maxSee: 3.48,
    minSee: 2.0,
  };
  const controls = {
    quantity: 1000,
    exchangeRate: 7.8,
    carbonPricePaid: 0,
    freeAllocationEnabled: true,
  };
  const without = computeRealtimeCost(basis, controls, 0, 0);
  assert.equal(without.effectiveSee, 2.0);

  const addition = precursorContribution(sample, "estimate");
  const withPrecursor = computeRealtimeCost(basis, controls, addition, sample.benchmarkB * sample.consumption);
  assert.ok(Math.abs(withPrecursor.effectiveSee - (0.11 + addition)) < 1e-9);
  assert.ok(withPrecursor.effectiveSee < without.effectiveSee || withPrecursor.effectiveSee > 0.11);
});

test("????????? BM ??????", () => {
  const basis = {
    see: 3.0,
    sefa: 0.975,
    certificatePrice: 75.36,
    bm: 1.0,
    bmA: 0.2,
    sefaFactor: 0.975,
  };
  const c = {
    quantity: 1000,
    exchangeRate: 7.8,
    carbonPricePaid: 0,
    freeAllocationEnabled: true,
  };
  const without = computeRealtimeCost(basis, c, 1.0, 0);
  const withBm = computeRealtimeCost(basis, c, 1.0, 1.5);
  assert.ok(Math.abs(without.sefaApplied - 0.975 * 0.2) < 1e-9);
  assert.ok(Math.abs(withBm.sefaApplied - 0.975 * 1.7) < 1e-9);
  assert.ok(withBm.totalCostLocal < without.totalCostLocal);
});

test("engine buildCostBasis?????? minSee/maxSee/bmA", () => {
  const calculator = createCalculator({
    parameters: {
      certificatePrice: 75.36,
      exchangeRate: 7.8,
      displayCurrency: "CNY",
      cscf: 1,
      deMinimisThreshold: 50,
      cbamFactors: { "2026": 0.975 },
    },
    cnCodes: [{
      cnCode: "72142000",
      sector: "Iron and Steel",
      aggregatedCategory: "Iron or steel products",
      hasIndirectEmissions: false,
      description: "Bars",
    }],
    benchmarks: [{ cnCode: "72142000", columnA: 0.2, columnB: 1.36 }],
    defaultValues: {
      China: { "72142000": { direct: 2.2, indirect: 0.3, total: 2.5, val2026: 2.75 } },
    },
    actualValues: {
      byCnCode: { "72142000": { direct: 0.11, indirect: 0.05 } },
      _fallbackByCategory: {},
    },
    actualFull: {
      byCnCode: { "72142000": { direct: 1.9, indirect: 0.2 } },
      _fallbackByCategory: {},
    },
  });

  const basis = calculator.buildCostBasis({
    year: 2026,
    cnCode: "72142000",
    country: "China",
    source: "actualEstimate",
  });
  assert.equal(basis.see, 0.11);
  assert.equal(basis.minSee, 0);
  assert.equal(basis.maxSee, null);
  assert.equal(basis.bmA, 0.2);
  assert.equal(basis.bm, 1.36);
  assert.ok(basis.sefaFactor === 0.975);
});
