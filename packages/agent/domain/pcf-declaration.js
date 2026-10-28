(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfDeclaration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DECLARATION_VERSION = "0.1.0";

  const GOAL_OPTIONS = Object.freeze([
    "客户披露与供应链响应",
    "内部减排分析",
    "产品比较与设计改进"
  ]);

  const REQUIRED = Object.freeze([
    "productId",
    "goal",
    "intendedUse",
    "audience",
    "functionalUnit",
    "referenceFlow",
    "periodStart",
    "periodEnd"
  ]);

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function periodLabel(declaration) {
    if (!declaration) return "";
    if (declaration.period) return trim(declaration.period);
    if (declaration.periodStart && declaration.periodEnd) {
      return declaration.periodStart + " 至 " + declaration.periodEnd;
    }
    return "";
  }

  function normalize(input, defaults) {
    input = input || {};
    defaults = defaults || {};
    const productId = trim(input.productId || defaults.productId);
    const productName = trim(input.productName || defaults.productName);
    const periodStart = trim(input.periodStart || defaults.periodStart);
    const periodEnd = trim(input.periodEnd || defaults.periodEnd);
    const declaration = {
      schemaVersion: DECLARATION_VERSION,
      productId: productId,
      productName: productName,
      goal: trim(input.goal || defaults.goal),
      intendedUse: trim(input.intendedUse || defaults.intendedUse),
      audience: trim(input.audience || defaults.audience),
      functionalUnit: trim(input.functionalUnit || defaults.functionalUnit),
      referenceFlow: trim(input.referenceFlow || defaults.referenceFlow),
      periodStart: periodStart,
      periodEnd: periodEnd,
      period: periodLabel({ period: input.period, periodStart: periodStart, periodEnd: periodEnd }),
      geography: trim(input.geography || defaults.geography || "中国 · 生产设施所在地"),
      technology: trim(input.technology || defaults.technology || ""),
      confirmed: Boolean(input.confirmed),
      confirmedAt: input.confirmedAt || null,
      confirmedBy: input.confirmedBy || null
    };
    return declaration;
  }

  function validate(declaration) {
    const blockers = REQUIRED.filter(function (key) {
      return !trim(declaration && declaration[key]);
    }).map(function (key) {
      return ({
        productId: "核算产品",
        goal: "核算目标",
        intendedUse: "预期用途",
        audience: "报告受众",
        functionalUnit: "功能单位",
        referenceFlow: "参考流",
        periodStart: "期间开始",
        periodEnd: "期间结束"
      })[key];
    });
    if (declaration && declaration.periodStart && declaration.periodEnd && declaration.periodStart > declaration.periodEnd) {
      blockers.push("核算期间结束不得早于开始");
    }
    return {
      ok: blockers.length === 0,
      code: blockers.length ? "PCF_DECL_INVALID" : null,
      blockers: blockers,
      message: blockers.length ? ("请补全核算声明：" + blockers.join("、")) : "核算声明字段完整"
    };
  }

  function confirm(declaration, actor) {
    const normalized = normalize(declaration);
    const check = validate(normalized);
    if (!check.ok) {
      const error = new Error(check.message);
      error.code = check.code;
      error.blockers = check.blockers;
      throw error;
    }
    return Object.assign({}, normalized, {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: (actor && (actor.actor || actor.name)) || null
    });
  }

  function toStageGate(declaration) {
    const normalized = normalize(declaration || {});
    return {
      productId: normalized.productId,
      goal: normalized.goal,
      functionalUnit: normalized.functionalUnit,
      period: periodLabel(normalized),
      periodStart: normalized.periodStart,
      periodEnd: normalized.periodEnd,
      confirmed: Boolean(normalized.confirmed)
    };
  }

  function defaultsForProduct(product) {
    const name = (product && product.name) || "热轧非合金钢卷";
    return normalize({
      productId: (product && product.id) || "PRD-HRC-01",
      productName: name,
      goal: "客户披露与供应链响应",
      intendedUse: "向下游客户与进口商提供可追溯的产品碳足迹信息",
      audience: "客户、供应链伙伴与内部管理",
      functionalUnit: "1 吨" + name,
      referenceFlow: "1 吨出厂" + name,
      periodStart: "2026-01-01",
      periodEnd: "2026-09-30",
      technology: (product && product.payload && product.payload.summary) || "高炉—转炉、连铸与热轧",
      confirmed: false
    });
  }

  return {
    DECLARATION_VERSION: DECLARATION_VERSION,
    GOAL_OPTIONS: GOAL_OPTIONS,
    REQUIRED: REQUIRED,
    normalize: normalize,
    validate: validate,
    confirm: confirm,
    toStageGate: toStageGate,
    periodLabel: periodLabel,
    defaultsForProduct: defaultsForProduct
  };
});
