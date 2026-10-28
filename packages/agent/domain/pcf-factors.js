(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfFactors = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FACTORS_VERSION = "0.1.0";

  function defaultSet(declaration) {
    declaration = declaration || {};
    return {
      schemaVersion: FACTORS_VERSION,
      setId: "CN-EF-2026.1",
      setName: "中国区域电网与过程因子集 2026.1",
      status: "PROPOSED",
      sourceKind: "demo_stub",
      provenance: {
        localDatabase: false,
        localCatalogAvailable: true,
        skillReference: "pcf-calculation/reference.md#8-排放因子数据库指南",
        statusDoc: "docs/emission-factors-status.md",
        intendedSources: ["DatabaseofEmissionFactor", "天工ILCD", "CPCD", "IPE", "Ecoinvent", "GaBi"],
        localPaths: [
          "/Users/qikunmac01/Documents/01Charlie/03_Autocoding/DatabaseEmissionFactor/DatabaseofEmissionFactor",
          "/Users/qikunmac01/Documents/01Charlie/01_工作文档/01_碳中和/1_项目工作/13_排放因子库"
        ],
        apiHint: "GET /api/v1/emission-factors/search（DatabaseofEmissionFactor backend）",
        note: "当前为原型演示集；形态对齐本机因子库种子／样例，尚未联机调用 DatabaseofEmissionFactor 或加载天工 ILCD。"
      },
      items: [
        {
          id: "EF-PCF-GRID-CN",
          datasetId: "CN-GRID-NATIONAL-2024",
          name: "全国电网平均电力",
          library: "DatabaseofEmissionFactor-seed",
          version: "2024",
          geography: "CN-National",
          year: "2024",
          numeratorUnit: "kgCO2e",
          denominatorUnit: "kWh",
          value: "0.5703",
          applicability: "适用于购入电力间接排放；数值取自本机因子库 init.sql 种子，需确认与核算期间／区域电网是否匹配",
          applicabilityConfirmed: false,
          sourceKind: "local_catalog_sample"
        },
        {
          id: "EF-PCF-GRID-N",
          datasetId: "CN-GRID-NORTH-COAL-2024",
          name: "华北电网燃煤发电",
          library: "DatabaseofEmissionFactor-seed",
          version: "2024",
          geography: "CN-North_China_Grid",
          year: "2024",
          numeratorUnit: "kgCO2e",
          denominatorUnit: "kWh",
          value: "0.8241",
          applicability: "过程／区域电力参考；取自本机因子库种子与 02_排放因子样例.md，需确认工艺与地域适用性",
          applicabilityConfirmed: false,
          sourceKind: "local_catalog_sample"
        }
      ],
      confirmed: false,
      confirmedAt: null,
      confirmedBy: null,
      functionalUnitRef: declaration.functionalUnit || null
    };
  }

  function normalize(input) {
    input = input || {};
    const items = Array.isArray(input.items) ? input.items.map(function (item) {
      return Object.assign({}, item, {
        applicabilityConfirmed: Boolean(item.applicabilityConfirmed)
      });
    }) : [];
    return {
      schemaVersion: FACTORS_VERSION,
      setId: input.setId || "CN-EF-2026.1",
      setName: input.setName || "排放因子集",
      status: input.status || "PROPOSED",
      sourceKind: input.sourceKind || "demo_stub",
      provenance: input.provenance || null,
      items: items,
      confirmed: Boolean(input.confirmed),
      confirmedAt: input.confirmedAt || null,
      confirmedBy: input.confirmedBy || null,
      functionalUnitRef: input.functionalUnitRef || null
    };
  }

  function validate(factorSet) {
    const set = normalize(factorSet);
    const blockers = [];
    if (!set.items.length) blockers.push("尚未登记排放因子");
    const pending = set.items.filter(function (item) { return !item.applicabilityConfirmed; });
    if (pending.length) blockers.push("仍有 " + pending.length + " 项因子适用性未确认");
    return {
      ok: blockers.length === 0,
      blockers: blockers,
      message: blockers.length ? blockers.join("；") : "因子适用性已确认"
    };
  }

  function confirm(factorSet, actor) {
    const set = normalize(factorSet);
    if (!set.items.length) {
      const error = new Error("尚未登记排放因子");
      error.code = "PCF_FACTOR_EMPTY";
      throw error;
    }
    const items = set.items.map(function (item) {
      return Object.assign({}, item, { applicabilityConfirmed: true });
    });
    return {
      schemaVersion: FACTORS_VERSION,
      setId: set.setId,
      setName: set.setName,
      status: "CONFIRMED",
      sourceKind: set.sourceKind || "demo_stub",
      provenance: set.provenance || null,
      items: items,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: (actor && (actor.actor || actor.name)) || null,
      functionalUnitRef: set.functionalUnitRef
    };
  }

  function toStageGate(factorSet) {
    const set = normalize(factorSet);
    return set.items.map(function (item) {
      return {
        id: item.id,
        datasetId: item.datasetId,
        applicabilityConfirmed: Boolean(item.applicabilityConfirmed) || Boolean(set.confirmed)
      };
    });
  }

  return {
    FACTORS_VERSION: FACTORS_VERSION,
    defaultSet: defaultSet,
    normalize: normalize,
    validate: validate,
    confirm: confirm,
    toStageGate: toStageGate
  };
});
