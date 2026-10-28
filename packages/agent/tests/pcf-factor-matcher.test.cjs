const test = require("node:test");
const assert = require("node:assert/strict");
const Catalog = require("../domain/pcf-factor-catalog.js");
const Matcher = require("../domain/pcf-factor-matcher.js");
const Factors = require("../domain/pcf-factors.js");
const { confirm: confirmDeclaration, defaultsForProduct } = require("../domain/pcf-declaration.js");

const declaration = confirmDeclaration(defaultsForProduct({ id: "PRD-HRC-01", name: "???????" }), { actor: "??" });

test("??????????????????????????", () => {
  const advice = Matcher.recommend({
    declaration: Object.assign({}, declaration, { geography: "?? · ??", periodEnd: "2024-12-31" }),
    facilityGeography: "??",
    powerUnit: "MWh",
    activities: [{ id: "energy", name: "????", unit: "MWh", type: "purchased_electricity" }]
  });
  assert.equal(advice.selections.length, 1);
  const top = advice.selections[0].recommended.entry;
  assert.equal(top.activityCategory.level3, "Grid_Average");
  assert.ok(["East_China_Grid", "National"].includes(top.geographicScope.region));
  assert.notEqual(top.activityCategory.level3, "Coal_Power");
});

test("???????????????????", () => {
  const need = Matcher.buildNeeds({
    declaration: { geography: "??", periodEnd: "2024-12-31" },
    assumePurchasedElectricity: true
  })[0];
  const east = Catalog.getById("ef-seed-cn-east-grid-2024");
  const coal = Catalog.getById("ef-seed-cn-north-coal-2024");
  const eastScore = Matcher.scoreEntry(need, east).score;
  const coalScore = Matcher.scoreEntry(need, coal).score;
  assert.ok(eastScore > coalScore);
});

test("recommendSet ?????????????????????", () => {
  const set = Factors.recommendSet({
    declaration,
    facilityGeography: "??",
    activities: [{ id: "energy", name: "????", unit: "MWh" }]
  });
  assert.equal(set.sourceKind, "matcher_recommendation");
  assert.ok(set.items.length >= 1);
  assert.equal(set.items[0].role, "recommended");
  assert.ok(set.recommendation.proposalOnly);
  const needId = set.items[0].needId;
  const alts = set.recommendation.alternativesByNeed[needId] || [];
  assert.ok(alts.length >= 1);
  const overridden = Factors.selectAlternative(set, needId, alts[0].datasetId);
  assert.equal(overridden.confirmed, false);
  assert.equal(overridden.items.find((row) => row.needId === needId).role, "manual_override");
  const confirmed = Factors.confirm(overridden, { actor: "??" });
  assert.equal(confirmed.confirmed, true);
});

test("???????????????????", () => {
  const emptyAdvice = Matcher.recommend(
    {
      declaration,
      activities: [{ id: "solvent", name: "????", type: "chemical_solvent" }],
      assumePurchasedElectricity: false
    },
    []
  );
  assert.equal(emptyAdvice.selections.length, 0);
  // with assumePurchasedElectricity false and only solvent activity, needs may be empty
  const cokeOnly = Matcher.recommend(
    {
      declaration,
      activities: [{ id: "mystery", name: "???? XYZ", type: "unknown_xyz" }],
      assumePurchasedElectricity: false
    },
    Catalog.list()
  );
  // no matching need built for mystery ? empty needs
  assert.ok(Array.isArray(cokeOnly.needs));
});
