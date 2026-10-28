(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfBoundary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BOUNDARY_VERSION = "0.1.0";

  const BOUNDARY_TYPES = Object.freeze([
    "从摇篮到大门",
    "从大门到大门",
    "从摇篮到坟墓"
  ]);

  const REQUIRED = Object.freeze([
    "boundaryType",
    "includedProcesses",
    "excludedItems",
    "cutOffRule",
    "primaryInputs"
  ]);

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function asList(value) {
    if (Array.isArray(value)) {
      return value.map(trim).filter(Boolean);
    }
    return trim(value)
      .split(/[\n,，;；、]/)
      .map(trim)
      .filter(Boolean);
  }

  function listText(value) {
    return asList(value).join("、");
  }

  function normalize(input, defaults) {
    input = input || {};
    defaults = defaults || {};
    const includedProcesses = asList(input.includedProcesses != null ? input.includedProcesses : defaults.includedProcesses);
    const excludedItems = asList(input.excludedItems != null ? input.excludedItems : defaults.excludedItems);
    const primaryInputs = asList(input.primaryInputs != null ? input.primaryInputs : defaults.primaryInputs);
    return {
      schemaVersion: BOUNDARY_VERSION,
      boundaryType: trim(input.boundaryType || defaults.boundaryType),
      functionalUnitRef: trim(input.functionalUnitRef || defaults.functionalUnitRef || ""),
      includedProcesses: includedProcesses,
      includedProcessesText: listText(includedProcesses),
      excludedItems: excludedItems,
      excludedItemsText: listText(excludedItems),
      cutOffRule: trim(input.cutOffRule || defaults.cutOffRule),
      cutOffRationale: trim(input.cutOffRationale || defaults.cutOffRationale || ""),
      primaryInputs: primaryInputs,
      primaryInputsText: listText(primaryInputs),
      status: trim(input.status || defaults.status || "PROPOSED") || "PROPOSED",
      proposalId: input.proposalId || defaults.proposalId || null,
      promptId: input.promptId || defaults.promptId || null,
      confirmed: Boolean(input.confirmed) || trim(input.status || "") === "CONFIRMED",
      confirmedAt: input.confirmedAt || null,
      confirmedBy: input.confirmedBy || null
    };
  }

  function validate(boundary) {
    const labels = {
      boundaryType: "系统边界类型",
      includedProcesses: "纳入的生产过程",
      excludedItems: "排除项",
      cutOffRule: "截断规则",
      primaryInputs: "主要输入"
    };
    const blockers = [];
    REQUIRED.forEach(function (key) {
      const value = boundary && boundary[key];
      const empty = Array.isArray(value) ? value.length === 0 : !trim(value);
      if (empty) blockers.push(labels[key]);
    });
    if (boundary && boundary.boundaryType && BOUNDARY_TYPES.indexOf(boundary.boundaryType) === -1) {
      blockers.push("系统边界类型不在允许范围");
    }
    return {
      ok: blockers.length === 0,
      code: blockers.length ? "PCF_BOUNDARY_INVALID" : null,
      blockers: blockers,
      message: blockers.length ? ("请补全系统边界：" + blockers.join("、")) : "系统边界字段完整"
    };
  }

  function suggest(declaration) {
    declaration = declaration || {};
    const productName = trim(declaration.productName) || "目标产品";
    const proposal = normalize({
      boundaryType: "从摇篮到大门",
      functionalUnitRef: declaration.functionalUnit || ("1 吨" + productName),
      includedProcesses: ["上游原料开采与加工", "炼铁", "炼钢", "连铸", "热轧", "厂内运输与能源使用"],
      excludedItems: ["销售运输", "产品使用阶段", "报废与回收（除非客户另有要求）"],
      cutOffRule: "单项贡献低于最终结果 1% 且合计不超过 5% 的辅料与耗材可截断",
      cutOffRationale: "符合常见钢铁产品从摇篮到大门披露实践；截断项需在报告中列示",
      primaryInputs: ["铁矿石", "焦炭", "废钢", "电力", "天然气"],
      status: "PROPOSED",
      proposalId: "PROP-PCF-BOUNDARY-" + (declaration.productId || "DEFAULT"),
      promptId: "pcf.suggest_boundary",
      confirmed: false
    });
    return {
      completionMode: "proposal_only",
      businessType: "PCF_BOUNDARY_SUGGEST",
      promptId: "pcf.suggest_boundary",
      ruleOrPromptVersion: "pcf-boundary@0.2.0",
      summary: "建议采用从摇篮到大门，纳入上游原料与厂内生产，排除销售运输与使用报废。",
      proposal: proposal
    };
  }

  function confirm(boundary, actor) {
    const normalized = normalize(boundary);
    const check = validate(normalized);
    if (!check.ok) {
      const error = new Error(check.message);
      error.code = check.code;
      error.blockers = check.blockers;
      throw error;
    }
    return Object.assign({}, normalized, {
      status: "CONFIRMED",
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: (actor && (actor.actor || actor.name)) || null
    });
  }

  function toStageGate(boundary) {
    const normalized = normalize(boundary || {});
    return {
      status: normalized.confirmed || normalized.status === "CONFIRMED" ? "CONFIRMED" : (normalized.status || "PROPOSED"),
      boundaryType: normalized.boundaryType,
      includedProcesses: normalized.includedProcesses,
      excludedItems: normalized.excludedItems,
      cutOffRule: normalized.cutOffRule
    };
  }

  function defaultsFromDeclaration(declaration) {
    const suggestion = suggest(declaration || {});
    return Object.assign({}, suggestion.proposal, {
      proposalId: null,
      promptId: null,
      status: "DRAFT",
      confirmed: false
    });
  }

  return {
    BOUNDARY_VERSION: BOUNDARY_VERSION,
    BOUNDARY_TYPES: BOUNDARY_TYPES,
    REQUIRED: REQUIRED,
    normalize: normalize,
    validate: validate,
    suggest: suggest,
    confirm: confirm,
    toStageGate: toStageGate,
    defaultsFromDeclaration: defaultsFromDeclaration,
    asList: asList,
    listText: listText
  };
});
