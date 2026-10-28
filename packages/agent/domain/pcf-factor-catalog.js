(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfFactorCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATALOG_VERSION = "0.1.0";

  const LOCAL_SEED = Object.freeze([
    Object.freeze({
      id: "ef-seed-cn-grid-national-2024",
      uuid: "00000000-0000-4000-8000-000000000001",
      activityCategory: Object.freeze({
        level1: "Energy",
        level2: "Electricity",
        level3: "Grid_Average",
        displayNameCn: "\u5168\u56fd\u7535\u7f51\u5e73\u5747"
      }),
      geographicScope: Object.freeze({
        countryCode: "CN",
        region: "National",
        displayNameCn: "\u5168\u56fd\u5e73\u5747",
        gridZone: "National"
      }),
      emissionValue: Object.freeze({ value: 0.5703, unit: "kgCO2eq/kWh", referenceYear: 2024 }),
      dataSource: Object.freeze({
        organization: "\u751f\u6001\u73af\u5883\u90e8",
        publication: "2024\u5e74\u4f01\u4e1a\u6e29\u5ba4\u6c14\u4f53\u6392\u653e\u6838\u7b97\u65b9\u6cd5\u4e0e\u62a5\u544a\u6307\u5357",
        publicationDate: "2024-01-10"
      }),
      qualityInfo: Object.freeze({ grade: "A", confidence: "High" }),
      status: "active",
      sourceKind: "local_catalog_sample",
      library: "DatabaseofEmissionFactor-seed"
    }),
    Object.freeze({
      id: "ef-seed-cn-north-coal-2024",
      uuid: "00000000-0000-4000-8000-000000000002",
      activityCategory: Object.freeze({
        level1: "Energy",
        level2: "Electricity",
        level3: "Coal_Power",
        displayNameCn: "\u534e\u5317\u7535\u7f51\u71c3\u7164\u53d1\u7535"
      }),
      geographicScope: Object.freeze({
        countryCode: "CN",
        region: "North_China_Grid",
        displayNameCn: "\u534e\u5317\u7535\u7f51",
        gridZone: "North_China_Grid"
      }),
      emissionValue: Object.freeze({ value: 0.8241, unit: "kgCO2eq/kWh", referenceYear: 2024 }),
      dataSource: Object.freeze({
        organization: "\u4e2d\u56fd\u7535\u529b\u4f01\u4e1a\u8054\u5408\u4f1a",
        publication: "\u4e2d\u56fd\u7535\u529b\u884c\u4e1a\u5e74\u5ea6\u53d1\u5c55\u62a5\u544a2024",
        publicationDate: "2024-02-28"
      }),
      qualityInfo: Object.freeze({ grade: "A", confidence: "High" }),
      status: "active",
      sourceKind: "local_catalog_sample",
      library: "DatabaseofEmissionFactor-seed"
    }),
    Object.freeze({
      id: "ef-seed-cn-east-grid-2024",
      uuid: "00000000-0000-4000-8000-000000000003",
      activityCategory: Object.freeze({
        level1: "Energy",
        level2: "Electricity",
        level3: "Grid_Average",
        displayNameCn: "\u534e\u4e1c\u533a\u57df\u7535\u7f51\u5e73\u5747"
      }),
      geographicScope: Object.freeze({
        countryCode: "CN",
        region: "East_China_Grid",
        displayNameCn: "\u534e\u4e1c\u7535\u7f51",
        gridZone: "East_China_Grid"
      }),
      emissionValue: Object.freeze({ value: 0.581, unit: "kgCO2eq/kWh", referenceYear: 2024 }),
      dataSource: Object.freeze({
        organization: "\u533a\u57df\u7535\u7f51\u516c\u5f00\u53c2\u6570\uff08\u6f14\u793a\u6269\u5c55\uff09",
        publication: "\u5bf9\u9f50\u534e\u4e1c\u8d2d\u7535\u573a\u666f\u7684\u533a\u57df\u7535\u7f51\u5e73\u5747",
        publicationDate: "2024-06-01"
      }),
      qualityInfo: Object.freeze({ grade: "B", confidence: "Medium" }),
      status: "active",
      sourceKind: "local_catalog_sample",
      library: "DatabaseofEmissionFactor-seed-ext"
    }),
    Object.freeze({
      id: "ef-seed-cn-coke-2024",
      uuid: "00000000-0000-4000-8000-000000000004",
      activityCategory: Object.freeze({
        level1: "Industry",
        level2: "Steel",
        level3: "Coke",
        displayNameCn: "\u7126\u70ad\u8fc7\u7a0b\u6392\u653e"
      }),
      geographicScope: Object.freeze({
        countryCode: "CN",
        region: "National",
        displayNameCn: "\u4e2d\u56fd",
        gridZone: null
      }),
      emissionValue: Object.freeze({ value: 0.302, unit: "tCO2eq/t", referenceYear: 2024 }),
      dataSource: Object.freeze({
        organization: "\u884c\u4e1a\u8fc7\u7a0b\u53c2\u6570\uff08\u6f14\u793a\uff09",
        publication: "\u94a2\u94c1\u7126\u70ad\u6295\u5165\u4e8c\u6b21\u6570\u636e\u5360\u4f4d",
        publicationDate: "2024-01-01"
      }),
      qualityInfo: Object.freeze({ grade: "C", confidence: "Low" }),
      status: "active",
      sourceKind: "local_catalog_sample",
      library: "DatabaseofEmissionFactor-seed-ext"
    })
  ]);

  function list(options) {
    options = options || {};
    let rows = LOCAL_SEED.slice();
    if (options.level1) rows = rows.filter(function (row) { return row.activityCategory.level1 === options.level1; });
    if (options.level2) rows = rows.filter(function (row) { return row.activityCategory.level2 === options.level2; });
    if (options.countryCode) rows = rows.filter(function (row) { return row.geographicScope.countryCode === options.countryCode; });
    if (options.status) rows = rows.filter(function (row) { return row.status === options.status; });
    else rows = rows.filter(function (row) { return row.status === "active"; });
    return rows;
  }

  function getById(id) {
    return LOCAL_SEED.find(function (row) { return row.id === id || row.uuid === id; }) || null;
  }

  function toFactorItem(entry, extras) {
    extras = extras || {};
    const unit = String(entry.emissionValue.unit || "");
    const parts = unit.split("/");
    const numeratorUnit = (parts[0] || "kgCO2e").replace("kgCO2eq", "kgCO2e").replace("tCO2eq", "tCO2e");
    const denominatorUnit = parts[1] || "unit";
    return {
      id: extras.id || ("EF-" + String(entry.id).toUpperCase()),
      datasetId: entry.id,
      catalogUuid: entry.uuid,
      name: entry.activityCategory.displayNameCn,
      library: entry.library,
      version: String(entry.emissionValue.referenceYear),
      geography: entry.geographicScope.region || entry.geographicScope.countryCode,
      geographyLabel: entry.geographicScope.displayNameCn,
      year: String(entry.emissionValue.referenceYear),
      numeratorUnit: numeratorUnit,
      denominatorUnit: denominatorUnit,
      value: String(entry.emissionValue.value),
      qualityGrade: entry.qualityInfo && entry.qualityInfo.grade || null,
      sourceKind: entry.sourceKind || "local_catalog_sample",
      dataSource: entry.dataSource || null,
      applicability: extras.applicability || "",
      applicabilityConfirmed: false,
      matchScore: extras.matchScore != null ? extras.matchScore : null,
      matchReasons: extras.matchReasons || [],
      role: extras.role || "recommended",
      needId: extras.needId || null
    };
  }

  return {
    CATALOG_VERSION: CATALOG_VERSION,
    LOCAL_SEED: LOCAL_SEED,
    list: list,
    getById: getById,
    toFactorItem: toFactorItem
  };
});
