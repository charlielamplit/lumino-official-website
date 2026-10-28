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
        skillReference: "pcf-calculation/reference.md#8-排放因子数据库指南",
        intendedSources: ["CPCD", "IPE", "天工", "Ecoinvent", "GaBi"],
        note: "当前为原型演示因子，不代表已接入真实排放因子库或官方发布值。"
      },
      items: [
        {
          id: "EF-PCF-GRID-SH",
          datasetId: "CN-GRID-EAST-2026",
          name: "华东区域电网电力",
          library: "CN-EF-DEMO",
          version: "2026.1",
          geography: "CN-East",
          year: "2026",
          numeratorUnit: "kgCO2e",
          denominatorUnit: "kWh",
          value: "0.5810",
          applicability: "适用于购入电力间接排放；与核算声明期间重叠",
          applicabilityConfirmed: false,
          sourceKind: "demo_stub"
        },
        {
          id: "EF-PCF-COKE",
          datasetId: "CN-PROCESS-COKE-2024",
          name: "焦炭过程排放",
          library: "CN-EF-DEMO",
          version: "2024.2",
          geography: "CN",
          year: "2024",
          numeratorUnit: "tCO2e",
          denominatorUnit: "t",
          value: "0.302",
          applicability: "用于焦炭投入；需确认与产品工艺匹配",
          applicabilityConfirmed: false,
          sourceKind: "demo_stub"
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
