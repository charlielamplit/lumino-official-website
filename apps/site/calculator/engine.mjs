import { resolveCertificatePrice } from "./certificate-prices.mjs";
import { computeRealtimeCost } from "./realtime-cost.mjs";

const round = (value, decimals = 2) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

export function createCalculator(data) {
  const { parameters, cnCodes, benchmarks, defaultValues, actualValues, actualFull } = data;
  const cnByCode = new Map(cnCodes.map((item) => [item.cnCode, item]));
  const benchmarkByCode = new Map();

  for (const item of benchmarks) {
    const baseCode = String(item.cnCode || "").slice(0, 8);
    if (!benchmarkByCode.has(baseCode)) benchmarkByCode.set(baseCode, []);
    benchmarkByCode.get(baseCode).push(item);
  }

  const yearValue = (entry, year) => {
    if (year <= 2026 && entry.val2026 != null) return entry.val2026;
    if (year === 2027 && entry.val2027 != null) return entry.val2027;
    if (year >= 2028 && entry.val2028plus != null) return entry.val2028plus;
    return entry.total;
  };

  const findCountryEntry = (countryData, cnCode, year) => {
    if (!countryData) return null;
    if (countryData[cnCode]) return countryData[cnCode];

    const variants = Object.keys(countryData).filter(
      (key) => key.length > 8 && key.slice(0, 8) === cnCode
    );
    if (variants.length) {
      return variants
        .map((key) => countryData[key])
        .reduce((best, item) =>
          (yearValue(item, year) ?? 0) > (yearValue(best, year) ?? 0) ? item : best
        );
    }

    return countryData[cnCode.slice(0, 6)] || countryData[cnCode.slice(0, 4)] || null;
  };

  const getDefaultEmission = (cnCode, country, year) => {
    let entry = findCountryEntry(defaultValues[country], cnCode, year);
    let usingGlobalWorst = false;

    if (!entry) {
      usingGlobalWorst = true;
      let max = -1;
      for (const countryData of Object.values(defaultValues)) {
        const candidate = findCountryEntry(countryData, cnCode, year);
        const value = candidate ? yearValue(candidate, year) : null;
        if (value != null && value > max) {
          max = value;
          entry = candidate;
        }
      }
    }

    if (!entry) return null;
    const seeWithMarkup = yearValue(entry, year);
    if (seeWithMarkup == null) return null;
    return {
      seeWithMarkup,
      direct: entry.direct ?? entry.total ?? seeWithMarkup,
      total: entry.total ?? entry.direct ?? seeWithMarkup,
      usingGlobalWorst,
      isGlobalWorst: usingGlobalWorst,
    };
  };

  const getBenchmark = (cnCode, useColumnA = false) => {
    const entries = benchmarkByCode.get(cnCode) || benchmarkByCode.get(String(cnCode).slice(0, 8)) || [];
    const preferred = useColumnA ? "columnA" : "columnB";
    const fallback = useColumnA ? "columnB" : "columnA";
    for (const item of entries) if (item[preferred] > 0) return item[preferred];
    for (const item of entries) if (item[fallback] > 0) return item[fallback];
    return 0;
  };

  const getPrecursorBenchmark = (cnCode) => {
    const entries = benchmarks.filter((item) => item.cnCode === cnCode);
    const firstNonNull = (pick) => {
      for (const entry of entries) {
        const value = pick(entry);
        if (value != null && value > 0) return value;
      }
      return null;
    };
    return {
      columnA: firstNonNull((entry) => entry.columnA),
      columnB: firstNonNull((entry) => entry.columnB),
    };
  };

  const getCbamFactor = (year) => {
    if (String(year) in parameters.cbamFactors) return parameters.cbamFactors[String(year)];
    if (year >= 2034) return 0;
    return 1;
  };

  const getActual = (cnCode, source) => {
    const info = cnByCode.get(cnCode);
    if (!info) return null;
    return source.byCnCode[cnCode] || source._fallbackByCategory[info.aggregatedCategory] || null;
  };

  const getCnCodeInfo = (cnCode) => cnByCode.get(cnCode) || null;

  const costedSeeFromDefault = (emission, noIndirectCost) => {
    if (noIndirectCost && emission.total > 0) {
      return {
        see: emission.seeWithMarkup * (emission.direct / emission.total),
        indirectForReport: emission.seeWithMarkup - emission.seeWithMarkup * (emission.direct / emission.total),
      };
    }
    return { see: emission.seeWithMarkup, indirectForReport: 0 };
  };

  const calculateBasis = ({ year, cnCode, country = "China", source = "default" }) => {
    const info = cnByCode.get(cnCode);
    if (!info) throw new Error("请选择有效的 CN Code");
    const noIndirectCost = !info.hasIndirectEmissions;
    let see;
    let indirectForReport = 0;
    let usingGlobalWorst = false;
    let maxSee = null;
    let minSee = 0;

    if (source === "default") {
      const emission = getDefaultEmission(cnCode, country, year);
      if (!emission) throw new Error("该产品暂无可用缺省值，请联系顾问处理。");
      usingGlobalWorst = emission.usingGlobalWorst;
      const costed = costedSeeFromDefault(emission, noIndirectCost);
      see = costed.see;
      indirectForReport = costed.indirectForReport;
      maxSee = see;
    } else if (source === "actualEstimate") {
      const actual = getActual(cnCode, actualValues);
      if (!actual) throw new Error("该产品暂无实测参考值。");
      see = actual.direct + (noIndirectCost ? 0 : actual.indirect || 0);
      if (noIndirectCost) indirectForReport = actual.indirect || 0;

      // An industry process estimate may exceed the published default. Do not
      // clip it or force a whole-chain value into a process-only estimate.
    } else {
      const actual = getActual(cnCode, actualFull);
      if (!actual) throw new Error("该产品暂无实测参考值。");
      see = actual.direct + (noIndirectCost ? 0 : actual.indirect || 0);
      if (noIndirectCost) indirectForReport = actual.indirect || 0;
    }

    const bm = getBenchmark(cnCode, false);
    const bmA = source === "actualEstimate" ? (getBenchmark(cnCode, true) || bm) : null;

    return {
      info,
      see,
      indirectForReport,
      usingGlobalWorst,
      benchmark: bm,
      bm,
      bmA,
      maxSee: Number.isFinite(maxSee) ? maxSee : null,
      minSee,
      noIndirectCost,
      source,
    };
  };

  const calculate = (input) => {
    const year = Number(input.year);
    const quantity = Math.max(0, Number(input.quantity) || 0);
    const carbonPricePaid = Math.max(0, Number(input.carbonPricePaid) || 0);
    const exchangeRate = Number(input.exchangeRate) || parameters.exchangeRate;
    const basis = calculateBasis(input);
    const cbamFactor = getCbamFactor(year);
    const sefaFactor = cbamFactor * parameters.cscf;
    const certificatePrice = resolveCertificatePrice(parameters, year, input.priceQuarter);
    const computed = computeRealtimeCost({
      ...basis, sefaFactor, certificatePrice,
    }, {
      quantity, carbonPricePaid, exchangeRate,
      freeAllocationEnabled: input.freeAllocationEnabled !== false,
    });

    return {
      ...basis,
      year,
      quantity,
      cbamFactor,
      sefaFactor,
      sefa: round(computed.sefaApplied),
      see: round(basis.see),
      bm: round(basis.bm),
      bmA: basis.bmA != null ? round(basis.bmA) : null,
      maxSee: basis.maxSee != null && Number.isFinite(basis.maxSee) ? round(basis.maxSee) : basis.maxSee,
      minSee: round(basis.minSee),
      indirectForReport: round(basis.indirectForReport),
      netEmissionPerTon: round(computed.netEmissionPerTon),
      totalCertificates: round(computed.totalCertificates),
      totalCostEur: round(computed.totalCostEur),
      totalCostLocal: round(computed.totalCostLocal),
      unitCostLocal: round(computed.unitCostLocal),
      certificatePrice,
      exchangeRate,
      exempt: quantity <= parameters.deMinimisThreshold,
      threshold: parameters.deMinimisThreshold,
    };
  };

  /** 供 realtime-cost 使用的 CostBasis（配额按 fa=true 计算） */
  const buildCostBasis = (input) => {
    const result = calculateBasis(input);
    const factor = getCbamFactor(Number(input.year)) * parameters.cscf;
    return {
      see: result.see,
      sefa: result.bm * factor,
      certificatePrice: resolveCertificatePrice(parameters, Number(input.year), input.priceQuarter),
      bm: result.bm,
      bmA: result.bmA,
      sefaFactor: factor,
      maxSee: result.maxSee,
      minSee: result.minSee,
      info: result.info,
      year: Number(input.year),
      indirectForReport: result.indirectForReport,
      usingGlobalWorst: result.usingGlobalWorst,
      noIndirectCost: result.noIndirectCost,
      source: result.source,
    };
  };

  const compare = (input) => {
    const defaultResult = calculate({ ...input, source: "default" });
    let actualResult;
    try {
      actualResult = calculate({ ...input, source: "actualFull" });
    } catch {
      actualResult = calculate({ ...input, source: "actualEstimate" });
    }
    return {
      defaultResult,
      actualResult,
      potentialSaving: round(Math.max(0, defaultResult.totalCostLocal - actualResult.totalCostLocal)),
      savingRate: defaultResult.totalCostLocal > 0
        ? round(Math.max(0, 1 - actualResult.totalCostLocal / defaultResult.totalCostLocal) * 100, 1)
        : 0,
    };
  };

  return {
    calculate,
    compare,
    buildCostBasis,
    getDefaultEmission,
    getBenchmark,
    getPrecursorBenchmark,
    getCnCodeInfo,
    getCbamFactor,
    parameters,
  };
}
