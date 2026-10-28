(function (root, factory) {
  "use strict";
  const Catalog = typeof module === "object" && module.exports
    ? require("./pcf-factor-catalog.js")
    : (root && root.LuminoPcfFactorCatalog);
  const Matcher = typeof module === "object" && module.exports
    ? require("./pcf-factor-matcher.js")
    : (root && root.LuminoPcfFactorMatcher);
  const api = factory(Catalog, Matcher);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfFactors = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Catalog, Matcher) {
  "use strict";

  const FACTORS_VERSION = "0.2.0";

  function provenance() {
    return {
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
      matcherVersion: Matcher && Matcher.MATCHER_VERSION || null,
      catalogVersion: Catalog && Catalog.CATALOG_VERSION || null,
      note: "系统按匹配逻辑自动推荐因子；用户确认适用性或改选备选。不要求业务用户自行检索专业因子库。"
    };
  }

  function contextFromInputs(input) {
    input = input || {};
    if (input.declaration || input.activities || input.facilityGeography) return input;
    return { declaration: input };
  }

  /**
   * 基于核算声明／活动上下文自动推荐因子集（proposal_only）。
   * 默认项 = 各需求的最高分匹配；备选保留在 alternatives 供改选。
   */
  function recommendSet(input) {
    const ctx = contextFromInputs(input);
    const declaration = ctx.declaration || {};
    if (!Matcher || !Catalog) {
      return legacyFallback(declaration);
    }
    const advice = Matcher.recommend(ctx);
    const items = [];
    const alternativesByNeed = {};

    advice.selections.forEach(function (selection) {
      const need = selection.need;
      const top = selection.recommended;
      const item = Catalog.toFactorItem(top.entry, {
        id: "EF-" + need.id.replace(/^need-/, "").toUpperCase(),
        needId: need.id,
        role: "recommended",
        matchScore: top.score,
        matchReasons: top.reasons,
        applicability: need.rationale + " 匹配分 " + top.score + "。"
      });
      items.push(item);
      alternativesByNeed[need.id] = selection.alternatives.map(function (alt, index) {
        return Catalog.toFactorItem(alt.entry, {
          id: "EF-ALT-" + need.id.replace(/^need-/, "").toUpperCase() + "-" + (index + 1),
          needId: need.id,
          role: "alternative",
          matchScore: alt.score,
          matchReasons: alt.reasons,
          applicability: "备选：" + alt.reasons.slice(0, 2).join("；")
        });
      });
    });

    return {
      schemaVersion: FACTORS_VERSION,
      setId: "CN-EF-MATCH-" + (declaration.periodEnd || declaration.period || "DRAFT").toString().slice(0, 4),
      setName: "系统推荐排放因子集",
      status: "PROPOSED",
      sourceKind: "matcher_recommendation",
      provenance: provenance(),
      recommendation: {
        proposalOnly: true,
        matcherVersion: advice.matcherVersion,
        summary: advice.summary,
        needs: advice.needs,
        gaps: advice.gaps,
        alternativesByNeed: alternativesByNeed
      },
      items: items,
      confirmed: false,
      confirmedAt: null,
      confirmedBy: null,
      functionalUnitRef: declaration.functionalUnit || null
    };
  }

  function legacyFallback(declaration) {
    declaration = declaration || {};
    return {
      schemaVersion: FACTORS_VERSION,
      setId: "CN-EF-2026.1",
      setName: "中国区域电网与过程因子集（回退）",
      status: "PROPOSED",
      sourceKind: "demo_stub",
      provenance: provenance(),
      recommendation: null,
      items: [],
      confirmed: false,
      confirmedAt: null,
      confirmedBy: null,
      functionalUnitRef: declaration.functionalUnit || null
    };
  }

  function defaultSet(declarationOrContext) {
    return recommendSet(declarationOrContext);
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
      setId: input.setId || "CN-EF-MATCH",
      setName: input.setName || "排放因子集",
      status: input.status || "PROPOSED",
      sourceKind: input.sourceKind || "matcher_recommendation",
      provenance: input.provenance || provenance(),
      recommendation: input.recommendation || null,
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
    if (!set.items.length) {
      const gaps = set.recommendation && set.recommendation.gaps || [];
      blockers.push(gaps.length ? "因子目录缺口未补齐，无法确认" : "尚未登记排放因子");
    }
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
      sourceKind: set.sourceKind || "matcher_recommendation",
      provenance: set.provenance || provenance(),
      recommendation: set.recommendation,
      items: items,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: (actor && (actor.actor || actor.name)) || null,
      functionalUnitRef: set.functionalUnitRef
    };
  }

  /**
   * 用户改选某需求的备选因子；仍为提议态，需再次确认适用性。
   */
  function selectAlternative(factorSet, needId, datasetId) {
    const set = normalize(factorSet);
    const alts = set.recommendation && set.recommendation.alternativesByNeed
      ? set.recommendation.alternativesByNeed[needId] || []
      : [];
    const chosen = alts.find(function (row) { return row.datasetId === datasetId || row.id === datasetId; });
    if (!chosen) {
      const fromCatalog = Catalog && Catalog.getById ? Catalog.getById(datasetId) : null;
      if (!fromCatalog) {
        const error = new Error("找不到可改选的备选因子");
        error.code = "PCF_FACTOR_ALT_MISSING";
        throw error;
      }
      const mapped = Catalog.toFactorItem(fromCatalog, {
        needId: needId,
        role: "manual_override",
        applicability: "用户从目录改选；须重新确认适用性。"
      });
      return replaceNeedItem(set, needId, mapped);
    }
    const override = Object.assign({}, chosen, {
      role: "manual_override",
      applicabilityConfirmed: false,
      applicability: (chosen.applicability || "") + "（用户改选备选）"
    });
    return replaceNeedItem(set, needId, override);
  }

  function replaceNeedItem(set, needId, nextItem) {
    const items = set.items.slice();
    const index = items.findIndex(function (row) { return row.needId === needId; });
    if (index >= 0) items[index] = nextItem;
    else items.push(nextItem);
    return normalize(Object.assign({}, set, {
      status: "PROPOSED",
      confirmed: false,
      confirmedAt: null,
      confirmedBy: null,
      items: items,
      setName: set.setName.indexOf("改选") >= 0 ? set.setName : set.setName + "（含改选）"
    }));
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
    recommendSet: recommendSet,
    normalize: normalize,
    validate: validate,
    confirm: confirm,
    selectAlternative: selectAlternative,
    toStageGate: toStageGate
  };
});
