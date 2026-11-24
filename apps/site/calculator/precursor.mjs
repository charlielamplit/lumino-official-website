/** ??????????? sumaorong/CBAM lib/precursor.ts ???? */

/** @typedef {{ name: string, cnCode: string, estimateValue: number, consumption: number, reason: string, defaultValue: number | null, defaultIsGlobalWorst: boolean, benchmarkA: number | null, benchmarkB: number | null }} Precursor */
/** @typedef {"default" | "estimate"} PrecursorValueSource */

/** @param {Precursor} p @param {PrecursorValueSource} source */
export function precursorUnitValue(p, source) {
  if (source === "estimate") return p.estimateValue;
  return p.defaultValue ?? p.estimateValue;
}

/** @param {Precursor} p @param {PrecursorValueSource} source */
export function precursorContribution(p, source) {
  return precursorUnitValue(p, source) * p.consumption;
}

/** @param {Precursor} p @param {PrecursorValueSource} source */
export function precursorSefaUnit(p, source) {
  const v = source === "estimate" ? p.benchmarkA : p.benchmarkB;
  return v ?? 0;
}

/** @param {Precursor} p @param {PrecursorValueSource} source */
export function precursorSefaContribution(p, source) {
  return precursorSefaUnit(p, source) * p.consumption;
}
