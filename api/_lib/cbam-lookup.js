/**
 * Server-side CBAM lookup for /api/precursors.
 * Reuses calculator JSON data (single source of truth).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCalculator } from "../../apps/site/calculator/engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.join(root, "apps/site/calculator/data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
}

let cached = null;

export function getCalculatorLookup() {
  if (cached) return cached;
  const parameters = readJson("parameters.json");
  const cnCodes = readJson("cn-codes.json");
  const benchmarks = readJson("benchmarks.json");
  const defaultValues = readJson("default-values.json");
  const actualValues = readJson("actual-values.json");
  const actualFull = readJson("actual-full.json");
  const calculator = createCalculator({
    parameters,
    cnCodes,
    benchmarks,
    defaultValues,
    actualValues,
    actualFull,
  });
  cached = {
    calculator,
    cnCodes,
    actualFull,
    getDefaultEmission: calculator.getDefaultEmission,
    getPrecursorBenchmark: calculator.getPrecursorBenchmark,
    getCnCodeInfo: calculator.getCnCodeInfo,
  };
  return cached;
}
