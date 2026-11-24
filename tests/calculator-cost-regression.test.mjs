import test from "node:test";
import assert from "node:assert/strict";
import { getCalculatorLookup } from "../api/_lib/cbam-lookup.js";
import { normalizePrecursorCode } from "../api/precursors.js";
import { computeRealtimeCost } from "../apps/site/calculator/realtime-cost.mjs";
import { publishedQuarterMean, resolveCertificatePrice } from "../apps/site/calculator/certificate-prices.mjs";

const lookup = getCalculatorLookup();
const controls = { quantity: 1, exchangeRate: 7.8, carbonPricePaid: 0, freeAllocationEnabled: true };

test("published 2026 quarter prices produce the displayed YTD arithmetic mean", () => {
  const parameters = lookup.calculator.parameters;
  assert.equal(parameters.certificatePrices2026[3].price, null);
  assert.ok(Math.abs(publishedQuarterMean(parameters) - 77.65333333333334) < 1e-9);
  assert.equal(resolveCertificatePrice(parameters, 2026, "Q2"), 75.28);
  assert.equal(resolveCertificatePrice(parameters, 2027), publishedQuarterMean(parameters));
});

test("72189980 mixed route counts equivalent-code FeCr precursor and cannot collapse to zero", () => {
  const normalized = normalizePrecursorCode("72024100", lookup, "China", 2026);
  assert.equal(normalized.mappedFrom, "72024100");
  assert.equal(normalized.code, "72024110");
  const actual = lookup.calculator.buildCostBasis({ year: 2026, cnCode: "72189980", country: "China", source: "actualEstimate" });
  const precursor = lookup.getDefaultEmission(normalized.code, "China", 2026);
  const benchmark = lookup.getPrecursorBenchmark(normalized.code);
  const mixed = computeRealtimeCost(actual, controls, precursor.seeWithMarkup * 0.25, benchmark.columnB * 0.25);
  assert.ok(Math.abs(mixed.effectiveSee - 1.09625) < 1e-9);
  assert.ok(Math.abs(mixed.sefaApplied - 0.6274125) < 1e-9);
  assert.ok(Math.abs(mixed.netEmissionPerTon - 0.4688375) < 1e-9);
  assert.ok(Math.abs(mixed.totalCostLocal - 283.9729984) < 1e-6);
});

test("invalid precursor codes cannot silently inherit a parent default without a benchmark", () => {
  assert.equal(normalizePrecursorCode("72024101", lookup, "China", 2026), null);
  assert.equal(normalizePrecursorCode("99999999", lookup, "China", 2026), null);
});

test("verified paid carbon price reduces certificates after the free allocation adjustment", () => {
  const basis = lookup.calculator.buildCostBasis({ year: 2026, cnCode: "72189980", country: "China", source: "default" });
  const paid = computeRealtimeCost(basis, { ...controls, carbonPricePaid: 100 });
  const unpaid = computeRealtimeCost(basis, controls);
  assert.ok(paid.payableCertificates < unpaid.payableCertificates);
  assert.ok(Math.abs(paid.payableCertificates - Math.max(0, unpaid.totalCertificates - basis.see * 100 / 7.8 / basis.certificatePrice)) < 1e-9);
});
