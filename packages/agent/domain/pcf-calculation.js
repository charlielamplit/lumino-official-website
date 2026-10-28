(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfCalculation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CALC_VERSION = "0.2.0";
  const STAGES = Object.freeze([
    { id: "raw-materials", name: "原材料获取" },
    { id: "raw-material-transport", name: "原材料运输" },
    { id: "manufacturing", name: "生产制造" },
    { id: "distribution", name: "分销运输" },
    { id: "use", name: "使用阶段" },
    { id: "end-of-life", name: "废弃处理与回收" }
  ]);
  const UNITS = Object.freeze({
    g: { dimension: "mass", scale: 0.001 },
    kg: { dimension: "mass", scale: 1 },
    t: { dimension: "mass", scale: 1000 },
    Wh: { dimension: "energy", scale: 0.001 },
    kWh: { dimension: "energy", scale: 1 },
    MWh: { dimension: "energy", scale: 1000 },
    L: { dimension: "volume", scale: 1 },
    m3: { dimension: "volume", scale: 1000 },
    Nm3: { dimension: "gas-volume", scale: 1 }
  });

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function round(value, digits) {
    const factor = Math.pow(10, digits == null ? 6 : digits);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function normalizeUnit(unit) {
    return trim(unit)
      .replace(/³/g, "3")
      .replace(/\s+/g, "")
      .replace(/[*.]/g, "·")
      .replace(/^tonnes?$/i, "t")
      .replace(/^kilograms?$/i, "kg");
  }

  function convert(value, fromUnit, toUnit) {
    const from = UNITS[normalizeUnit(fromUnit)];
    const to = UNITS[normalizeUnit(toUnit)];
    if (!from || !to || from.dimension !== to.dimension) {
      const error = new Error("活动数据单位与排放因子单位不兼容：" + fromUnit + " → " + toUnit);
      error.code = "PCF_UNIT_MISMATCH";
      throw error;
    }
    return number(value) * from.scale / to.scale;
  }

  function numeratorToKg(value, numeratorUnit) {
    const unit = normalizeUnit(numeratorUnit || "kgCO2e").toLowerCase();
    if (unit === "kgco2e") return value;
    if (unit === "tco2e") return value * 1000;
    if (unit === "gco2e") return value / 1000;
    const error = new Error("不支持的排放因子分子单位：" + numeratorUnit);
    error.code = "PCF_FACTOR_UNIT_UNSUPPORTED";
    throw error;
  }

  function validateInventory(inventory) {
    const blockers = [];
    if (!Array.isArray(inventory) || inventory.length === 0) blockers.push("排放清单为空");
    (inventory || []).forEach(function (row, index) {
      const label = row.id || row.name || "第 " + (index + 1) + " 行";
      if (!STAGES.some(function (stage) { return stage.id === row.stageId; })) blockers.push(label + " 缺少有效生命周期阶段");
      if (!row.activity || !Number.isFinite(number(row.activity.value)) || number(row.activity.value) < 0) blockers.push(label + " 活动数据无效");
      if (!row.activity || !trim(row.activity.unit)) blockers.push(label + " 缺少活动数据单位");
      if (!row.factor || !Number.isFinite(number(row.factor.value)) || number(row.factor.value) < 0) blockers.push(label + " 排放因子无效");
      if (!row.factor || !trim(row.factor.id || row.factor.datasetId)) blockers.push(label + " 缺少排放因子标识");
      if (!row.factor || !trim(row.factor.denominatorUnit)) blockers.push(label + " 缺少排放因子分母单位");
      if (row.factor && row.factor.applicabilityConfirmed !== true) blockers.push(label + " 排放因子适用性未确认");
      if (row.type === "transport" && (!Number.isFinite(number(row.distanceKm)) || number(row.distanceKm) <= 0)) blockers.push(label + " 缺少有效运输距离");
    });
    return { ok: blockers.length === 0, blockers: blockers };
  }

  function calculateLine(row) {
    const activityValue = number(row.activity.value);
    const factorValue = number(row.factor.value);
    const allocationFactor = row.allocationFactor == null ? 1 : number(row.allocationFactor);
    if (!Number.isFinite(allocationFactor) || allocationFactor < 0 || allocationFactor > 1) {
      const error = new Error((row.id || row.name) + " 的分配比例必须介于 0 与 1 之间");
      error.code = "PCF_ALLOCATION_INVALID";
      throw error;
    }

    const denominator = normalizeUnit(row.factor.denominatorUnit);
    let normalizedActivity;
    let formula;
    if (row.type === "transport" || denominator.endsWith("·km")) {
      const massUnit = denominator.replace(/·km$/, "");
      const mass = convert(activityValue, row.activity.unit, massUnit);
      normalizedActivity = mass * number(row.distanceKm);
      formula = mass + " " + massUnit + " × " + number(row.distanceKm) + " km × " + factorValue;
    } else {
      normalizedActivity = convert(activityValue, row.activity.unit, denominator);
      formula = normalizedActivity + " " + denominator + " × " + factorValue;
    }
    const emissionKg = numeratorToKg(normalizedActivity * factorValue * allocationFactor, row.factor.numeratorUnit);
    return Object.assign({}, row, {
      allocationFactor: allocationFactor,
      normalizedActivity: round(normalizedActivity, 6),
      normalizedActivityUnit: denominator,
      emissionKgCO2e: round(emissionKg, 6),
      emissionTCO2e: round(emissionKg / 1000, 6),
      formula: formula + (allocationFactor !== 1 ? " × 分配比例 " + allocationFactor : "")
    });
  }

  function boundaryExcludes(stageId, boundaryType) {
    if (boundaryType === "从摇篮到大门") return ["distribution", "use", "end-of-life"].includes(stageId);
    if (boundaryType === "从大门到大门") return ["raw-materials", "raw-material-transport", "distribution", "use", "end-of-life"].includes(stageId);
    return false;
  }

  function qualitySummary(lines, totalKg) {
    const tiers = { TIER_1: 0, TIER_2: 0, TIER_3: 0 };
    let primary = 0;
    let evidenceCount = 0;
    lines.forEach(function (line) {
      const tier = line.activity.qualityTier || "TIER_3";
      if (tiers[tier] == null) tiers[tier] = 0;
      tiers[tier] += line.emissionKgCO2e;
      if (["measured", "invoice", "erp", "supplier_verified"].includes(line.activity.sourceKind)) primary += line.emissionKgCO2e;
      if (line.activity.sourceId || line.evidenceId) evidenceCount += 1;
    });
    function share(value) { return totalKg > 0 ? round(value / totalKg, 4) : 0; }
    return {
      primaryActivityCoverage: share(primary),
      factorCoverage: lines.length ? 1 : 0,
      completeness: lines.length ? round(evidenceCount / lines.length, 4) : 0,
      tier1Percentage: round(share(tiers.TIER_1) * 100, 1),
      tier2Percentage: round(share(tiers.TIER_2) * 100, 1),
      tier3Percentage: round(share(tiers.TIER_3) * 100, 1),
      allocationMethod: "质量分配",
      biogenicCarbon: "不适用"
    };
  }

  function buildResult(input) {
    input = input || {};
    const declaration = input.declaration || {};
    const boundary = input.boundary || {};
    const inventory = Array.isArray(input.inventory) ? input.inventory : [];
    const check = validateInventory(inventory);
    if (!check.ok) {
      const error = new Error("PCF 清单尚不能计算：" + check.blockers.join("；"));
      error.code = "PCF_INVENTORY_INVALID";
      error.blockers = check.blockers;
      throw error;
    }
    const lineItems = inventory.map(function (row) {
      const line = calculateLine(row);
      line.included = !boundaryExcludes(line.stageId, boundary.boundaryType);
      line.includedEmissionKgCO2e = line.included ? line.emissionKgCO2e : 0;
      return line;
    });
    const includedLines = lineItems.filter(function (line) { return line.included; });
    const totalKg = includedLines.reduce(function (sum, line) { return sum + line.emissionKgCO2e; }, 0);
    const stages = STAGES.map(function (stage) {
      const rows = lineItems.filter(function (line) { return line.stageId === stage.id; });
      const included = !boundaryExcludes(stage.id, boundary.boundaryType);
      const calculatedKg = rows.reduce(function (sum, line) { return sum + line.emissionKgCO2e; }, 0);
      const valueKg = included ? calculatedKg : 0;
      return {
        id: stage.id,
        name: stage.name,
        value: round(valueKg / 1000, 6),
        unit: "tCO2e",
        share: totalKg > 0 ? round(valueKg / totalKg, 6) : 0,
        included: included,
        excludedValue: included ? 0 : round(calculatedKg / 1000, 6),
        lineCount: rows.length,
        basis: rows.length ? rows.map(function (line) { return line.activity.sourceLabel || line.activity.sourceKind; }).filter(Boolean).join(" + ") : "边界外或无数据"
      };
    });
    const hotspots = includedLines
      .map(function (line) {
        const share = totalKg > 0 ? line.emissionKgCO2e / totalKg : 0;
        return { id: line.id, name: line.name, stageId: line.stageId, emission: line.emissionTCO2e, share: round(share, 6), shareLabel: Math.round(share * 100) + "%" };
      })
      .filter(function (line) { return line.share > 0.1; })
      .sort(function (a, b) { return b.share - a.share; });
    const dataQuality = qualitySummary(includedLines, totalKg);
    const limitations = [];
    if (input.formalUseAllowed !== true) limitations.push("当前清单为演示输入，仅用于验证计算和报告流程，不得作为正式披露结果");
    if (dataQuality.tier3Percentage > 0) limitations.push("清单包含 Tier 3 推算数据，正式报告前应替换或说明不确定性");
    if (dataQuality.completeness < 1) limitations.push("部分清单项尚未关联来源证据");
    return {
      schemaVersion: CALC_VERSION,
      runId: trim(input.runId || "ARUN-PCF-001"),
      snapshotId: trim(input.snapshotId || "SNAP-PCF-HRC-01"),
      status: "DRAFT",
      inputMode: input.inputMode || "confirmed_inventory",
      formalUseAllowed: input.formalUseAllowed === true,
      total: round(totalKg / 1000, 3),
      totalKgCO2e: round(totalKg, 3),
      unit: "tCO2e/t",
      functionalUnit: declaration.functionalUnit || "1 吨产品",
      boundaryType: boundary.boundaryType || "",
      factorSetId: trim((input.factors || {}).setId || input.ruleVersion || "UNSPECIFIED"),
      ruleVersion: trim(input.ruleVersion || "pcf-deterministic@" + CALC_VERSION),
      lineItems: lineItems,
      stages: stages,
      hotspots: hotspots,
      dataQuality: dataQuality,
      limitations: limitations,
      uncertainties: lineItems.filter(function (line) { return line.activity.qualityTier === "TIER_3"; }).map(function (line) {
        return { topic: line.name, level: "高", note: "活动数据为 AI / 行业推算，需由责任人补充或确认" };
      }),
      createdAt: new Date().toISOString(),
      createdBy: (input.actor && (input.actor.actor || input.actor.name)) || null
    };
  }

  function buildDemoInventory(input) {
    input = input || {};
    const factors = input.factors || {};
    const grid = (factors.items || []).find(function (item) {
      return item.id === "EF-PCF-GRID-CN"
        || item.needId === "need-purchased-electricity"
        || (normalizeUnit(item.denominatorUnit).toLowerCase() === "kwh" && /electric|grid|电力|电网/i.test([item.name, item.datasetId, item.id].join(" ")));
    }) || {};
    return [
      { id: "LCI-MAT-001", name: "钢铁前体与合金投入", stageId: "raw-materials", type: "material", activity: { value: 1.4, unit: "t", sourceKind: "supplier_verified", sourceLabel: "供应商数据", sourceId: "SUP-PCF-001", qualityTier: "TIER_2" }, factor: { id: "EF-STEEL-PRECURSOR-DEMO", datasetId: "DEMO-STEEL-2026", value: 950, numeratorUnit: "kgCO2e", denominatorUnit: "t", applicabilityConfirmed: true }, allocationFactor: 1 },
      { id: "LCI-TRN-001", name: "上游原料运输", stageId: "raw-material-transport", type: "transport", distanceKm: 450, activity: { value: 1.4, unit: "t", sourceKind: "erp", sourceLabel: "采购物流台账", sourceId: "LOG-2026-001", qualityTier: "TIER_2" }, factor: { id: "EF-ROAD-FREIGHT-DEMO", datasetId: "DEMO-ROAD-2026", value: 0.062, numeratorUnit: "kgCO2e", denominatorUnit: "t·km", applicabilityConfirmed: true }, allocationFactor: 1 },
      { id: "LCI-ENE-001", name: "购入电力", stageId: "manufacturing", type: "energy", activity: { value: 0.62, unit: "MWh", sourceKind: "invoice", sourceLabel: "电费账单与产品分配", sourceId: (input.power && (input.power.versionId || input.power.id)) || "REC-HX-POWER-2026Q3", qualityTier: "TIER_1" }, factor: { id: grid.id || "EF-PCF-GRID-CN", datasetId: grid.datasetId || "CN-GRID-NATIONAL-2024", value: number(grid.value || 0.5703), numeratorUnit: grid.numeratorUnit || "kgCO2e", denominatorUnit: grid.denominatorUnit || "kWh", applicabilityConfirmed: Boolean(grid.applicabilityConfirmed || factors.confirmed) }, allocationFactor: 1 },
      { id: "LCI-ENE-002", name: "天然气燃烧", stageId: "manufacturing", type: "energy", activity: { value: 25, unit: "Nm3", sourceKind: "measured", sourceLabel: "生产计量", sourceId: "REC-HX-GAS-PCF-2026", qualityTier: "TIER_1" }, factor: { id: "EF-NG-DEMO", datasetId: "DEMO-NG-2026", value: 2.16, numeratorUnit: "kgCO2e", denominatorUnit: "Nm3", applicabilityConfirmed: true }, allocationFactor: 1 },
      { id: "LCI-PRO-001", name: "焦炭及过程投入", stageId: "manufacturing", type: "material", activity: { value: 0.22, unit: "t", sourceKind: "erp", sourceLabel: "生产台账", sourceId: "ERP-HRC-2026", qualityTier: "TIER_2" }, factor: { id: "EF-COKE-DEMO", datasetId: "DEMO-COKE-2026", value: 850, numeratorUnit: "kgCO2e", denominatorUnit: "t", applicabilityConfirmed: true }, allocationFactor: 1 },
      { id: "LCI-WST-001", name: "生产废弃物处理", stageId: "manufacturing", type: "waste", activity: { value: 0.05, unit: "t", sourceKind: "erp", sourceLabel: "EHS 台账", sourceId: "EHS-WASTE-2026", qualityTier: "TIER_2" }, factor: { id: "EF-WASTE-DEMO", datasetId: "DEMO-WASTE-2026", value: 110, numeratorUnit: "kgCO2e", denominatorUnit: "t", applicabilityConfirmed: true }, allocationFactor: 1 }
    ];
  }

  function normalize(result) {
    result = result || {};
    return Object.assign({}, result, {
      schemaVersion: result.schemaVersion || CALC_VERSION,
      lineItems: Array.isArray(result.lineItems) ? result.lineItems : [],
      stages: Array.isArray(result.stages) ? result.stages : [],
      hotspots: Array.isArray(result.hotspots) ? result.hotspots : [],
      limitations: Array.isArray(result.limitations) ? result.limitations : [],
      uncertainties: Array.isArray(result.uncertainties) ? result.uncertainties : [],
      dataQuality: result.dataQuality || {}
    });
  }

  return {
    CALC_VERSION: CALC_VERSION,
    STAGES: STAGES,
    convert: convert,
    validateInventory: validateInventory,
    calculateLine: calculateLine,
    buildDemoInventory: buildDemoInventory,
    buildResult: buildResult,
    normalize: normalize
  };
});
