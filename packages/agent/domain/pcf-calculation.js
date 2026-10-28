(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfCalculation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CALC_VERSION = "0.1.0";

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function buildResult(input) {
    input = input || {};
    const declaration = input.declaration || {};
    const boundary = input.boundary || {};
    const factors = input.factors || {};
    const power = input.power || {};
    const snapshotId = trim(input.snapshotId || "SNAP-PCF-HRC-01");
    const runId = trim(input.runId || "ARUN-PCF-001");
    const factorSetId = trim(factors.setId || input.ruleVersion || "CN-EF-2026.1");
    const stages = [
      { id: "materials", name: "原材料与前体", value: 1.395, unit: "tCO2e", share: 0.64, basis: "供应商数据 + 行业因子" },
      { id: "energy", name: "购入能源", value: 0.414, unit: "tCO2e", share: 0.19, basis: trim(power.versionId || power.id || "电力资产") + " + " + factorSetId },
      { id: "process", name: "燃料与过程排放", value: 0.262, unit: "tCO2e", share: 0.12, basis: "实测燃料与工艺数据" },
      { id: "other", name: "运输、废弃物及其他", value: 0.109, unit: "tCO2e", share: 0.05, basis: "实际路线 + 处理路径" }
    ];
    const total = Number(stages.reduce(function (sum, item) { return sum + item.value; }, 0).toFixed(3));
    const hotspots = stages
      .slice()
      .sort(function (a, b) { return b.share - a.share; })
      .map(function (item) {
        return { id: item.id, name: item.name, share: item.share, shareLabel: Math.round(item.share * 100) + "%" };
      });
    return {
      schemaVersion: CALC_VERSION,
      runId: runId,
      snapshotId: snapshotId,
      status: "DRAFT",
      total: total,
      unit: "tCO2e/t",
      functionalUnit: declaration.functionalUnit || "1 吨产品",
      boundaryType: boundary.boundaryType || "",
      factorSetId: factorSetId,
      ruleVersion: factorSetId,
      stages: stages,
      hotspots: hotspots,
      dataQuality: {
        primaryActivityCoverage: 0.78,
        factorCoverage: 1,
        allocationMethod: "质量分配",
        biogenicCarbon: "不适用"
      },
      limitations: [
        "供应商前体排放部分依赖行业平均值",
        "截断辅料按边界规则省略，合计不超过 5%",
        "结果仅用于已声明用途，不能直接替代第三方核查结论"
      ],
      uncertainties: [
        { topic: "电网因子地域代表性", level: "中", note: "采用华东区域年均值" },
        { topic: "焦炭过程因子年份", level: "低", note: "因子集年份与核算期部分重叠" }
      ],
      createdAt: new Date().toISOString(),
      createdBy: (input.actor && (input.actor.actor || input.actor.name)) || null
    };
  }

  function normalize(result) {
    result = result || {};
    return Object.assign({}, buildResult({}), result, {
      stages: Array.isArray(result.stages) ? result.stages : [],
      hotspots: Array.isArray(result.hotspots) ? result.hotspots : [],
      limitations: Array.isArray(result.limitations) ? result.limitations : [],
      uncertainties: Array.isArray(result.uncertainties) ? result.uncertainties : [],
      dataQuality: result.dataQuality || {}
    });
  }

  return { CALC_VERSION: CALC_VERSION, buildResult: buildResult, normalize: normalize };
});
