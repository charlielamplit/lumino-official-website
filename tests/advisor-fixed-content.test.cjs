const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

function loadCatalog() {
  require(path.join(root, "packages/advisor/catalog.js"));
  require(path.join(root, "packages/advisor/schema.js"));
  require(path.join(root, "packages/advisor/router.js"));
  return globalThis.LuminoAdvisorCatalog;
}

test("serverless ESM advisor-data stays aligned with packages/advisor topics and answers", async () => {
  const browser = loadCatalog();
  const mod = await import(pathToFileURL(path.join(root, "api/_lib/advisor-data/catalog.js")).href);
  const server = mod.default;
  assert.deepEqual(
    server.topics.map((t) => t.id),
    browser.topics.map((t) => t.id),
  );
  const bAns = new Map(browser.fixedAnswers.filter((a) => a.status === "published").map((a) => [a.topicId, a.answer.zh]));
  const sAns = new Map(server.fixedAnswers.filter((a) => a.status === "published").map((a) => [a.topicId, a.answer.zh]));
  assert.deepEqual(sAns, bAns);
});

test("every published topic has a published fixed answer with zh/en copy", () => {
  const catalog = globalThis.LuminoAdvisorCatalog || loadCatalog();
  const answersByTopic = new Map(
    catalog.fixedAnswers.filter((item) => item.status === "published").map((item) => [item.topicId, item]),
  );
  for (const topic of catalog.topics) {
    const answer = answersByTopic.get(topic.id);
    assert.ok(answer, `missing fixed answer for topic ${topic.id}`);
    assert.ok(answer.answer.zh.length >= 24);
    assert.ok(answer.answer.en.length >= 24);
  }
});

test("eudr/csddd and cbam fixed answers stay preliminary and actionable", () => {
  const catalog = globalThis.LuminoAdvisorCatalog || loadCatalog();
  const eudr = catalog.fixedAnswers.find((item) => item.topicId === "eudr_csddd");
  const cbam = catalog.fixedAnswers.find((item) => item.topicId === "cbam_scope");
  assert.match(eudr.answer.zh, /EUDR/);
  assert.match(eudr.answer.zh, /CSDDD/);
  assert.doesNotMatch(eudr.answer.zh, /正式认定|法律意见|保证合规/);
  assert.match(cbam.answer.zh, /不会直接作出正式/);
  assert.doesNotMatch(cbam.answer.zh, /法律意见|保证合规/);
});

test("api helpers avoid import.meta.url for Vercel CJS compatibility", () => {
  for (const rel of [
    "api/_lib/advisor-retrieval.js",
    "api/_lib/knowledge-store.js",
    "api/_lib/leads-store.js",
  ]) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(src, /fileURLToPath\s*\(\s*import\.meta\.url\s*\)/);
  }
});

test("vercel advisor function includes knowledge corpus for retrieval", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const include = config.functions?.["api/advisor.js"]?.includeFiles || "";
  assert.match(include, /apps\/site\/knowledge/);
});
