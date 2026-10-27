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
    };
  };

  const getBenchmark = (cnCode, useColumnA = false) => {
    const entries = benchmarkByCode.get(cnCode) || [];
    const preferred = useColumnA ? "columnA" : "columnB";
    const fallback = useColumnA ? "columnB" : "columnA";
    for (const item of entries) if (item[preferred] > 0) return item[preferred];
    for (const item of entries) if (item[fallback] > 0) return item[fallback];
    return 0;
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

  const calculateBasis = ({ year, cnCode, country = "China", source = "default" }) => {
    const info = cnByCode.get(cnCode);
    if (!info) throw new Error("请选择有效的 CN Code");
    const noIndirectCost = !info.hasIndirectEmissions;
    let see;
    let indirectForReport = 0;
    let usingGlobalWorst = false;

    if (source === "default") {
      const emission = getDefaultEmission(cnCode, country, year);
      if (!emission) throw new Error("该产品暂无可用缺省值，请联系顾问处理。");
      usingGlobalWorst = emission.usingGlobalWorst;
      if (noIndirectCost && emission.total > 0) {
        see = emission.seeWithMarkup * (emission.direct / emission.total);
        indirectForReport = emission.seeWithMarkup - see;
      } else {
        see = emission.seeWithMarkup;
      }
    } else {
      const actual = getActual(cnCode, source === "actualFull" ? actualFull : actualValues);
      if (!actual) throw new Error("该产品暂无实测参考值。");
      see = actual.direct + (noIndirectCost ? 0 : actual.indirect || 0);
      if (noIndirectCost) indirectForReport = actual.indirect || 0;
    }

    return {
      info,
      see,
      indirectForReport,
      usingGlobalWorst,
      benchmark: getBenchmark(cnCode, source !== "default"),
      noIndirectCost,
    };
  };

  const calculate = (input) => {
    const year = Number(input.year);
    const quantity = Math.max(0, Number(input.quantity) || 0);
    const carbonPricePaid = Math.max(0, Number(input.carbonPricePaid) || 0);
    const exchangeRate = Number(input.exchangeRate) || parameters.exchangeRate;
    const basis = calculateBasis(input);
    const cbamFactor = getCbamFactor(year);
    const sefa = input.freeAllocationEnabled === false
      ? 0
      : cbamFactor * parameters.cscf * basis.benchmark;
    const netEmissionPerTon = Math.max(0, basis.see - sefa);
    const totalCertificates = netEmissionPerTon * quantity;
    const carbonOffsetPerTon = carbonPricePaid / exchangeRate;
    const unitNetPriceEur = Math.max(0, parameters.certificatePrice - carbonOffsetPerTon);
    const totalCostEur = totalCertificates * unitNetPriceEur;
    const totalCostLocal = totalCostEur * exchangeRate;

    return {
      ...basis,
      year,
      quantity,
      cbamFactor,
      sefa: round(sefa),
      see: round(basis.see),
      indirectForReport: round(basis.indirectForReport),
      netEmissionPerTon: round(netEmissionPerTon),
      totalCertificates: round(totalCertificates),
      totalCostEur: round(totalCostEur),
      totalCostLocal: round(totalCostLocal),
      unitCostLocal: round(quantity ? totalCostLocal / quantity : 0),
      certificatePrice: parameters.certificatePrice,
      exchangeRate,
      exempt: quantity <= parameters.deMinimisThreshold,
      threshold: parameters.deMinimisThreshold,
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

  return { calculate, compare, getDefaultEmission, getBenchmark };
}
