import test from "node:test";
import assert from "node:assert/strict";
import { filterToDirectPrecursorLayer } from "../api/_lib/precursor-filter.js";

const INFO = {
  "72142000": { aggregatedCategory: "Iron or steel products" },
  "72071210": { aggregatedCategory: "Crude steel" },
  "72071100": { aggregatedCategory: "Crude steel" },
  "72011000": { aggregatedCategory: "Pig iron" },
  "72061000": { aggregatedCategory: "Crude steel" },
  "26011200": { aggregatedCategory: "Sintered Ore" },
  "25232900": { aggregatedCategory: "Cement" },
  "25231000": { aggregatedCategory: "Cement clinker" },
};

const getInfo = (cn) => INFO[cn] || null;

test("???????????????/???", () => {
  const filtered = filterToDirectPrecursorLayer("72142000", [
    { name: "??", cnCode: "72071210", consumption: 1.05 },
    { name: "??", cnCode: "72011000", consumption: 0.85 },
    { name: "???", cnCode: "26011200", consumption: 1.2 },
  ], getInfo);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].cnCode, "72071210");
});

test("????????????????????", () => {
  const filtered = filterToDirectPrecursorLayer("72142000", [
    { name: "??", cnCode: "72071100", consumption: 1.02 },
    { name: "???", cnCode: "72071210", consumption: 1.05 },
  ], getInfo);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].cnCode, "72071210");
});

test("? CBAM ?????", () => {
  const filtered = filterToDirectPrecursorLayer("25232900", [
    { name: "??", cnCode: "25231000", consumption: 0.95 },
    { name: "??", cnCode: "25201000", consumption: 0.05 },
  ], getInfo);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].cnCode, "25231000");
});
