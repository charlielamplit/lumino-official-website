import test from "node:test";
import assert from "node:assert/strict";
import { createCalculator } from "../apps/site/calculator/engine.mjs";

const calculator = createCalculator({
  parameters: {
    certificatePrice: 75.36,
    exchangeRate: 7.8,
    displayCurrency: "CNY",
    cscf: 1,
    deMinimisThreshold: 50,
    cbamFactors: { "2026": 0.975 },
  },
  cnCodes: [{ cnCode: "72000000", sector: "Iron and Steel", aggregatedCategory: "Steel", hasIndirectEmissions: false }],
  benchmarks: [{ cnCode: "72000000", columnA: 0.5, columnB: 0.6 }],
  defaultValues: { China: { "72000000": { direct: 2, indirect: 1, total: 3, val2026: 3.3 } } },
  actualValues: { byCnCode: { "72000000": { direct: 1.5, indirect: 0.4 } }, _fallbackByCategory: {} },
  actualFull: { byCnCode: { "72000000": { direct: 1.7, indirect: 0.5 } }, _fallbackByCategory: {} },
});

test("钢铁缺省值成本剔除间接排放", () => {
  const result = calculator.calculate({ year: 2026, cnCode: "72000000", country: "China", quantity: 1000, source: "default", freeAllocationEnabled: true, carbonPricePaid: 0 });
  assert.equal(result.see, 2.2);
  assert.equal(result.indirectForReport, 1.1);
  assert.equal(result.sefa, 0.59);
  assert.equal(result.totalCertificates, 1615);
});

test("已付碳价不能把证书净价扣成负数", () => {
  const result = calculator.calculate({ year: 2026, cnCode: "72000000", country: "China", quantity: 1000, source: "default", freeAllocationEnabled: true, carbonPricePaid: 99999 });
  assert.equal(result.totalCostLocal, 0);
});

test("实测对比返回非负节省金额", () => {
  const result = calculator.compare({ year: 2026, cnCode: "72000000", country: "China", quantity: 1000, freeAllocationEnabled: true, carbonPricePaid: 0 });
  assert.ok(result.potentialSaving >= 0);
  assert.ok(result.actualResult.totalCostLocal < result.defaultResult.totalCostLocal);
});
