const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function loadCatalog() {
  require(path.join(root, "packages/advisor/catalog.js"));
  require(path.join(root, "packages/advisor/schema.js"));
  require(path.join(root, "packages/advisor/router.js"));
  return globalThis.LuminoAdvisorCatalog;
}

test("every published topic has a published fixed answer with zh/en copy", () => {
  const catalog = loadCatalog();
  assert.ok(catalog);
  const answersByTopic = new Map(
    catalog.fixedAnswers
      .filter((item) => item.status === "published")
      .map((item) => [item.topicId, item]),
  );
  for (const topic of catalog.topics) {
    const answer = answersByTopic.get(topic.id);
    assert.ok(answer, `missing fixed answer for topic ${topic.id}`);
    assert.equal(typeof answer.answer.zh, "string");
    assert.equal(typeof answer.answer.en, "string");
    assert.ok(answer.answer.zh.length >= 24, `${topic.id} zh answer too short`);
    assert.ok(answer.answer.en.length >= 24, `${topic.id} en answer too short`);
  }
});

test("fixed-answer source ids resolve to catalog source urls", () => {
  const catalog = globalThis.LuminoAdvisorCatalog || loadCatalog();
  const byId = new Map(Object.values(catalog.sources).map((item) => [item.id, item]));
  for (const answer of catalog.fixedAnswers.filter((item) => item.status === "published")) {
    assert.ok(Array.isArray(answer.sourceIds) && answer.sourceIds.length > 0, answer.id);
    for (const sourceId of answer.sourceIds) {
      const source = byId.get(sourceId);
      assert.ok(source, `${answer.id} missing source ${sourceId}`);
      assert.ok(source.url, `${sourceId} missing url`);
    }
  }
});

test("eudr/csddd and cbam fixed answers stay preliminary and actionable", () => {
  const catalog = globalThis.LuminoAdvisorCatalog || loadCatalog();
  const eudr = catalog.fixedAnswers.find((item) => item.topicId === "eudr_csddd");
  const cbam = catalog.fixedAnswers.find((item) => item.topicId === "cbam_scope");
  assert.match(eudr.answer.zh, /EUDR/);
  assert.match(eudr.answer.zh, /CSDDD/);
  assert.match(eudr.answer.zh, /追溯|尽职/);
  assert.doesNotMatch(eudr.answer.zh, /正式认定|法律意见|保证合规/);
  assert.match(cbam.answer.zh, /CN Code|编码/);
  assert.match(cbam.answer.zh, /不会直接作出正式/);
});

test("vercel advisor function includes advisor package and knowledge corpus", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const include = config.functions?.["api/advisor.js"]?.includeFiles || "";
  assert.match(include, /packages\/advisor/);
  assert.match(include, /apps\/site\/knowledge/);
});
