(function (root, factory) {
  "use strict";
  const api = factory(
    typeof module === "object" && module.exports ? require("./pcf-factor-catalog.js") : (root && root.LuminoPcfFactorCatalog)
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfFactorMatcher = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Catalog) {
  "use strict";

  const MATCHER_VERSION = "0.1.0";

  const REGION_ALIASES = {
    "\u534e\u4e1c": "East_China_Grid",
    "\u4e0a\u6d77": "East_China_Grid",
    "\u6c5f\u82cf": "East_China_Grid",
    "\u6d59\u6c5f": "East_China_Grid",
    "east": "East_China_Grid",
    "\u534e\u5317": "North_China_Grid",
    "\u5317\u4eac": "North_China_Grid",
    "\u5929\u6d25": "North_China_Grid",
    "\u6cb3\u5317": "North_China_Grid",
    "north": "North_China_Grid",
    "\u5168\u56fd": "National",
    "\u4e2d\u56fd": "National",
    "cn": "National"
  };

  function includesAny(text, tokens) {
    const raw = String(text || "").toLowerCase();
    return tokens.some(function (token) {
      return raw.indexOf(String(token).toLowerCase()) >= 0;
    });
  }

  function inferGridZone(text) {
    const raw = String(text || "").toLowerCase();
    if (!raw) return "National";
    const keys = Object.keys(REGION_ALIASES);
    for (let i = 0; i < keys.length; i += 1) {
      if (raw.indexOf(keys[i].toLowerCase()) >= 0) return REGION_ALIASES[keys[i]];
    }
    if (raw.indexOf("east_china") >= 0) return "East_China_Grid";
    if (raw.indexOf("north_china") >= 0) return "North_China_Grid";
    return "National";
  }

  function yearFromPeriod(declaration) {
    declaration = declaration || {};
    const end = declaration.periodEnd || declaration.period || "";
    const match = String(end).match(/(\d{4})/);
    return match ? Number(match[1]) : null;
  }

  function unitCompatible(needUnit, factorUnit) {
    const need = String(needUnit || "").toLowerCase();
    const factor = String(factorUnit || "").toLowerCase();
    if (!need || !factor) return true;
    if (need.indexOf("kwh") >= 0 || need.indexOf("mwh") >= 0 || need.indexOf("gwh") >= 0) {
      return factor.indexOf("kwh") >= 0 || factor.indexOf("mwh") >= 0;
    }
    if (need === "t" || need.indexOf("ton") >= 0 || need.indexOf("\u5428") >= 0) {
      return factor.indexOf("/t") >= 0 || factor.indexOf("tco2") >= 0 || factor.indexOf("per t") >= 0;
    }
    return true;
  }

  function buildNeeds(context) {
    context = context || {};
    const declaration = context.declaration || {};
    const geographyText = [declaration.geography, context.facilityGeography, context.siteLabel].filter(Boolean).join(" ");
    const gridZone = inferGridZone(geographyText || "\u4e2d\u56fd");
    const year = yearFromPeriod(declaration);
    const needs = [];

    const activities = Array.isArray(context.activities) ? context.activities : [];
    const hasExplicit = activities.length > 0;
    const powerLike = activities.filter(function (row) {
      const blob = [row.id, row.name, row.domain, row.unit, row.type].join(" ");
      return includesAny(blob, ["power", "electric", "\u7535\u529b", "\u8d2d\u7535", "\u80fd\u6e90", "energy", "kwh", "mwh"]);
    });
    const cokeLike = activities.filter(function (row) {
      const blob = [row.id, row.name, row.domain, row.type].join(" ");
      return includesAny(blob, ["coke", "\u7126\u70ad"]);
    });

    if (!hasExplicit || powerLike.length || context.assumePurchasedElectricity !== false) {
      needs.push({
        id: "need-purchased-electricity",
        label: "\u8d2d\u5165\u7535\u529b\u95f4\u63a5\u6392\u653e",
        activityFamily: "electricity_grid",
        level1: "Energy",
        level2: "Electricity",
        preferredLevel3: ["Grid_Average"],
        avoidLevel3UnlessForced: ["Coal_Power"],
        countryCode: "CN",
        preferredRegion: gridZone,
        year: year,
        activityUnit: context.powerUnit || (powerLike[0] && powerLike[0].unit) || "MWh",
        rationale: "\u6d3b\u52a8\u6570\u636e\u542b\u8d2d\u5165\u7535\u529b\uff08\u6216\u9ed8\u8ba4\u7535\u529b\u9700\u6c42\uff09\uff1b\u4f18\u5148\u5339\u914d\u533a\u57df\uff0f\u5168\u56fd\u7535\u7f51\u5e73\u5747\u56e0\u5b50\uff0c\u800c\u975e\u5355\u5382\u71c3\u7164\u8fc7\u7a0b\u56e0\u5b50\u3002"
      });
    }

    if (cokeLike.length) {
      needs.push({
        id: "need-coke-process",
        label: "\u7126\u70ad\u8fc7\u7a0b\u6392\u653e",
        activityFamily: "steel_coke",
        level1: "Industry",
        level2: "Steel",
        preferredLevel3: ["Coke"],
        countryCode: "CN",
        preferredRegion: "National",
        year: year,
        activityUnit: "t",
        rationale: "\u6e05\u5355\u542b\u7126\u70ad\u76f8\u5173\u6295\u5165\uff1b\u5339\u914d\u94a2\u94c1\u7126\u70ad\u8fc7\u7a0b\u4e8c\u6b21\u6570\u636e\u3002"
      });
    }

    return needs;
  }

  function scoreEntry(need, entry) {
    let score = 0;
    const reasons = [];
    const cat = entry.activityCategory || {};
    const geo = entry.geographicScope || {};
    const value = entry.emissionValue || {};
    const quality = entry.qualityInfo || {};

    if (cat.level1 === need.level1) { score += 20; reasons.push("\u6d3b\u52a8\u5927\u7c7b\u5339\u914d"); }
    else return { score: 0, reasons: ["\u6d3b\u52a8\u5927\u7c7b\u4e0d\u7b26"] };

    if (cat.level2 === need.level2) { score += 20; reasons.push("\u6d3b\u52a8\u4e2d\u7c7b\u5339\u914d"); }
    else { score -= 30; reasons.push("\u6d3b\u52a8\u4e2d\u7c7b\u504f\u5dee"); }

    if ((need.preferredLevel3 || []).indexOf(cat.level3) >= 0) {
      score += 25;
      reasons.push("\u4f18\u5148\u5b50\u7c7b\uff1a" + cat.level3);
    } else if ((need.avoidLevel3UnlessForced || []).indexOf(cat.level3) >= 0) {
      score -= 15;
      reasons.push("\u5b50\u7c7b\u504f\u8fc7\u7a0b\u53c2\u6570\uff0c\u975e\u9ed8\u8ba4\u8d2d\u7535\u9996\u9009");
    } else if (cat.level3) {
      score += 5;
      reasons.push("\u5b50\u7c7b\u53ef\u53c2\u8003\uff1a" + cat.level3);
    }

    if (geo.countryCode === need.countryCode) {
      score += 10;
      reasons.push("\u56fd\u5bb6\u5339\u914d");
    }

    const entryRegion = geo.region || geo.gridZone;
    if (need.preferredRegion && entryRegion === need.preferredRegion) {
      score += 30;
      reasons.push("\u5730\u57df\uff0f\u7535\u7f51\u533a\u5339\u914d\uff1a" + entryRegion);
    } else if (entryRegion === "National" && need.preferredRegion && need.preferredRegion !== "National") {
      score += 12;
      reasons.push("\u56de\u9000\u5168\u56fd\u5e73\u5747\uff08\u533a\u57df\u56e0\u5b50\u6682\u7f3a\u6216\u4f5c\u5151\u5e95\uff09");
    } else if (entryRegion && need.preferredRegion && entryRegion !== need.preferredRegion) {
      score -= 8;
      reasons.push("\u5730\u57df\u4e0d\u5b8c\u5168\u4e00\u81f4\uff1a" + entryRegion);
    }

    if (need.year && value.referenceYear) {
      const delta = Math.abs(Number(value.referenceYear) - Number(need.year));
      if (delta === 0) { score += 15; reasons.push("\u53c2\u8003\u5e74\u4e00\u81f4"); }
      else if (delta === 1) { score += 8; reasons.push("\u53c2\u8003\u5e74\u63a5\u8fd1"); }
      else if (delta <= 3) { score += 3; reasons.push("\u53c2\u8003\u5e74\u53ef\u63a5\u53d7\u504f\u5dee"); }
      else { score -= 10; reasons.push("\u53c2\u8003\u5e74\u504f\u5dee\u8f83\u5927"); }
    }

    if (unitCompatible(need.activityUnit, value.unit)) {
      score += 10;
      reasons.push("\u5355\u4f4d\u53ef\u6362\u7b97\uff0f\u517c\u5bb9");
    } else {
      score -= 40;
      reasons.push("\u5355\u4f4d\u4e0d\u517c\u5bb9");
    }

    if (quality.grade === "A") { score += 8; reasons.push("\u8d28\u91cf\u7b49\u7ea7 A"); }
    else if (quality.grade === "B") { score += 4; reasons.push("\u8d28\u91cf\u7b49\u7ea7 B"); }
    else if (quality.grade === "C") { score -= 2; reasons.push("\u8d28\u91cf\u7b49\u7ea7 C\uff0c\u9700\u8c28\u614e"); }
    else if (quality.grade === "D" || quality.grade === "F") { score -= 12; reasons.push("\u8d28\u91cf\u7b49\u7ea7\u504f\u4f4e"); }

    return { score: score, reasons: reasons };
  }

  function rankForNeed(need, catalog) {
    const source = catalog || (Catalog && Catalog.list ? Catalog.list({ countryCode: need.countryCode }) : []);
    return source.map(function (entry) {
      const scored = scoreEntry(need, entry);
      return { entry: entry, score: scored.score, reasons: scored.reasons };
    }).filter(function (row) {
      return row.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score;
    });
  }

  function recommend(context, catalog) {
    const needs = buildNeeds(context);
    const CatalogApi = Catalog || (typeof globalThis !== "undefined" ? globalThis.LuminoPcfFactorCatalog : null);
    const pool = catalog || (CatalogApi && CatalogApi.list ? CatalogApi.list() : []);
    const selections = [];
    const gaps = [];

    needs.forEach(function (need) {
      const ranked = rankForNeed(need, pool);
      if (!ranked.length) {
        gaps.push({
          needId: need.id,
          label: need.label,
          message: "\u76ee\u5f55\u4e2d\u6682\u65e0\u8db3\u591f\u5339\u914d\u7684\u56e0\u5b50\uff1b\u5df2\u767b\u8bb0\u7f3a\u53e3\uff0c\u4e0d\u8981\u6c42\u4e1a\u52a1\u7528\u6237\u81ea\u884c\u68c0\u7d22\u4e13\u4e1a\u5e93\u3002",
          recovery: "\u7531\u7cfb\u7edf\uff0f\u4e13\u5bb6\u4ece DatabaseofEmissionFactor \u6216\u5929\u5de5\u5305\u8865\u5145\u540e\u91cd\u65b0\u63a8\u8350"
        });
        return;
      }
      const top = ranked[0];
      const alternatives = ranked.slice(1, 4);
      selections.push({
        need: need,
        recommended: top,
        alternatives: alternatives
      });
    });

    return {
      matcherVersion: MATCHER_VERSION,
      proposalOnly: true,
      needs: needs,
      selections: selections,
      gaps: gaps,
      summary: selections.length
        ? ("\u5df2\u4e3a " + selections.length + " \u9879\u6d3b\u52a8\u81ea\u52a8\u63a8\u8350\u56e0\u5b50" + (gaps.length ? "\uff0c\u53e6\u6709 " + gaps.length + " \u9879\u7f3a\u53e3\u5f85\u8865\u76ee\u5f55" : ""))
        : (gaps.length ? "\u672a\u80fd\u81ea\u52a8\u5339\u914d\uff0c\u5df2\u767b\u8bb0\u7f3a\u53e3" : "\u65e0\u5f85\u5339\u914d\u9700\u6c42")
    };
  }

  return {
    MATCHER_VERSION: MATCHER_VERSION,
    inferGridZone: inferGridZone,
    buildNeeds: buildNeeds,
    scoreEntry: scoreEntry,
    rankForNeed: rankForNeed,
    recommend: recommend,
    unitCompatible: unitCompatible
  };
});
