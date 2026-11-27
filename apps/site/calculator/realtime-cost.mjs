/**
 * ???????? sumaorong/CBAM lib/realtime-cost.ts ????
 * basis ???? freeAllocationEnabled:true ? calculate / buildCostBasis?
 */

/** @typedef {{ see: number, sefa: number, certificatePrice: number, bm: number, sefaFactor?: number, maxSee?: number | null, minSee?: number, bmA?: number | null }} CostBasis */
/** @typedef {{ quantity: number, exchangeRate: number, carbonPricePaid: number, freeAllocationEnabled: boolean }} CostControls */

/** @param {CostBasis} basis */
function sefaFactorOf(basis) {
  if (basis.sefaFactor != null) return basis.sefaFactor;
  return basis.bm > 0 ? basis.sefa / basis.bm : 0;
}

/** @param {CostBasis} basis @param {number} precursorBmAddition */
function bmEffective(basis, precursorBmAddition) {
  if (basis.bmA == null) return basis.bm;
  return basis.bmA + precursorBmAddition;
}

/**
 * @param {CostBasis} basis
 * @param {CostControls} c
 * @param {number} [precursorAddition=0]
 * @param {number} [precursorBmAddition=0]
 */
export function computeRealtimeCost(basis, c, precursorAddition = 0, precursorBmAddition = 0) {
  const sefaApplied = c.freeAllocationEnabled
    ? sefaFactorOf(basis) * bmEffective(basis, precursorBmAddition)
    : 0;
  const cap = basis.maxSee ?? Infinity;
  const floor = precursorAddition > 0 ? 0 : basis.minSee ?? 0;
  const effectiveSee = Math.min(Math.max(basis.see + precursorAddition, floor), cap);
  const netEmissionPerTon = Math.max(0, effectiveSee - sefaApplied);
  const totalCertificates = netEmissionPerTon * c.quantity;
  // Full emission coverage at the entered effective paid price is assumed.
  // Carbon-price deductions reduce certificates after free allocation.
  const carbonOffsetPerTon = c.exchangeRate > 0 ? c.carbonPricePaid / c.exchangeRate : 0;
  const paidCertificatesPerTon = basis.certificatePrice > 0
    ? carbonOffsetPerTon * effectiveSee / basis.certificatePrice : 0;
  const payableCertificatesPerTon = Math.max(0, netEmissionPerTon - paidCertificatesPerTon);
  const unitNetPriceEur = basis.certificatePrice;
  const totalCostEur = payableCertificatesPerTon * c.quantity * unitNetPriceEur;
  const totalCostLocal = totalCostEur * c.exchangeRate;
  const unitCostLocal = c.quantity > 0 ? totalCostLocal / c.quantity : 0;
  return {
    netEmissionPerTon,
    sefaApplied,
    precursorApplied: precursorAddition,
    effectiveSee,
    totalCertificates,
    payableCertificates: payableCertificatesPerTon * c.quantity,
    carbonOffsetPerTon,
    unitNetPriceEur,
    totalCostEur,
    totalCostLocal,
    unitCostLocal,
  };
}

export const DE_MINIMIS_THRESHOLD = 50;

export const CBAM_FACTOR_SERIES = [
  { year: 2026, factor: 0.975 },
  { year: 2027, factor: 0.95 },
  { year: 2028, factor: 0.9 },
  { year: 2029, factor: 0.775 },
  { year: 2030, factor: 0.515 },
  { year: 2031, factor: 0.39 },
  { year: 2032, factor: 0.265 },
  { year: 2033, factor: 0.14 },
  { year: 2034, factor: 0 },
];

export const CSCF = 1.0;

function sefaForYear(bm, factor) {
  return factor * CSCF * bm;
}

/**
 * @param {CostBasis} basis
 * @param {CostControls} controls
 * @param {{ min?: number, max?: number, step?: number }} [opts]
 * @param {number} [precursorAddition=0]
 * @param {number} [precursorBmAddition=0]
 */
export function computeCarbonSensitivity(
  basis,
  controls,
  opts = {},
  precursorAddition = 0,
  precursorBmAddition = 0,
) {
  const { min = 0, max = 200, step = 10 } = opts;
  const points = [];
  for (let p = min; p <= max + 1e-9; p += step) {
    const cp = Math.round(p);
    const cost = computeRealtimeCost(
      basis,
      { ...controls, carbonPricePaid: cp },
      precursorAddition,
      precursorBmAddition,
    );
    points.push({ carbonPrice: cp, unitCostLocal: cost.unitCostLocal });
  }
  return points;
}

/**
 * @param {CostBasis} basis
 * @param {CostControls} controls
 * @param {number} [precursorAddition=0]
 * @param {number} [precursorBmAddition=0]
 */
export function computeUnitCostTrend(
  basis,
  controls,
  precursorAddition = 0,
  precursorBmAddition = 0,
) {
  return CBAM_FACTOR_SERIES.map(({ year, factor }) => {
    const bmYear = bmEffective(basis, precursorBmAddition);
    const yearBasis = {
      ...basis,
      bm: bmYear,
      bmA: null,
      sefa: sefaForYear(bmYear, factor),
      sefaFactor: factor * CSCF,
    };
    const cost = computeRealtimeCost(yearBasis, controls, precursorAddition, 0);
    return { year, unitCostLocal: cost.unitCostLocal };
  });
}

/**
 * @param {CostBasis} basis
 * @param {CostControls} controls
 * @param {number} [precursorBmAddition=0]
 */
export function computeAllowanceCostTrend(basis, controls, precursorBmAddition = 0) {
  return CBAM_FACTOR_SERIES.map(({ year, factor }) => {
    const sefaYear = controls.freeAllocationEnabled
      ? sefaForYear(bmEffective(basis, precursorBmAddition), factor)
      : 0;
    const value = sefaYear * controls.quantity * basis.certificatePrice * controls.exchangeRate;
    return { year, allowanceValue: value };
  });
}
