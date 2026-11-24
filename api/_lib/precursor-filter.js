/**
 * Keep only the direct upstream CBAM layer.
 * Models often return billet + pig iron together; pig iron is one layer deeper.
 */

/** Higher = farther upstream from finished goods. */
export const CATEGORY_DEPTH = Object.freeze({
  "Iron or steel products": 0,
  "Aluminium products": 0,
  Cement: 0,
  Urea: 0,
  "Nitric acid": 0,
  "Mixed Fertilisers": 0,
  Fertiliser: 0,
  Hydrogen: 0,

  "Crude steel": 1,
  "Unwrought aluminium": 1,
  "Cement clinker": 1,
  Ammonia: 1,
  "Aluminous cement": 1,

  "Pig iron": 2,
  DRI: 2,
  FeCr: 2,
  FeMn: 2,
  FeNi: 2,
  "Calcined clay": 2,

  "Sintered Ore": 3,
});

export function categoryDepth(category) {
  if (!category) return Number.POSITIVE_INFINITY;
  return Object.prototype.hasOwnProperty.call(CATEGORY_DEPTH, category)
    ? CATEGORY_DEPTH[category]
    : Number.POSITIVE_INFINITY;
}

/**
 * @param {string} productCn
 * @param {Array<{ cnCode: string, consumption?: number, name?: string }>} rows
 * @param {(cnCode: string) => ({ aggregatedCategory?: string, description?: string, zh?: string } | null)} getCnCodeInfo
 */
export function filterToDirectPrecursorLayer(productCn, rows, getCnCodeInfo) {
  const productInfo = getCnCodeInfo(productCn);
  const productDepth = categoryDepth(productInfo?.aggregatedCategory);
  const annotated = [];

  for (const row of rows || []) {
    const code = String(row?.cnCode || "").replace(/\D/g, "");
    if (!code || code === productCn) continue;
    const info = getCnCodeInfo(code);
    if (!info) continue; // drop non-CBAM codes (gypsum, scrap outside table, etc.)
    const depth = categoryDepth(info.aggregatedCategory);
    if (!Number.isFinite(depth)) continue;
    if (!(depth > productDepth)) continue; // must be strictly upstream
    annotated.push({
      ...row,
      cnCode: code,
      consumption: Number(row.consumption) || 0,
      _category: info.aggregatedCategory,
      _depth: depth,
    });
  }

  if (!annotated.length) return [];

  const minDepth = Math.min(...annotated.map((item) => item._depth));
  const sameLayer = annotated.filter((item) => item._depth === minDepth);

  // One substitute per aggregated category at that layer (keep highest consumption).
  const byCategory = new Map();
  for (const item of sameLayer) {
    const key = item._category || item.cnCode;
    const prev = byCategory.get(key);
    if (!prev || item.consumption > prev.consumption) byCategory.set(key, item);
  }

  return [...byCategory.values()]
    .sort((a, b) => b.consumption - a.consumption)
    .slice(0, 3)
    .map(({ _category, _depth, ...rest }) => rest);
}
