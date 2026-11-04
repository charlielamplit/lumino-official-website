const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");

function sha(rel) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex");
}

function loadCatalog() {
  require(path.join(root, "packages/advisor/catalog.js"));
  require(path.join(root, "packages/advisor/schema.js"));
  require(path.join(root, "packages/advisor/router.js"));
  return globalThis.LuminoAdvisorCatalog;
}

test("serverless advisor-umd .cjs mirror matches packages/advisor (router require paths excepted)", () => {
  assert.equal(sha("api/_lib/advisor-umd/catalog.cjs"), sha("packages/advisor/catalog.js"));
  assert.equal(sha("api/_lib/advisor-umd/schema.cjs"), sha("packages/advisor/schema.js"));
  const routerMirror = fs.readFileSync(path.join(root, "api/_lib/advisor-umd/router.cjs"), "utf8");
  const routerSrc = fs.readFileSync(path.join(root, "packages/advisor/router.js"), "utf8")
    .replace(/require\("\.\/catalog\.js"\)/g, 'require("./catalog.cjs")')
    .replace(/require\("\.\/schema\.js"\)/g, 'require("./schema.cjs")');
  assert.equal(routerMirror, routerSrc);
});

test("every published topic has a published fixed answer with zh/en copy", () => {
  const catalog = loadCatalog();
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

test("vercel advisor function includes umd mirror and knowledge corpus", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const include = config.functions?.["api/advisor.js"]?.includeFiles || "";
  assert.match(include, /advisor-umd/);
  assert.match(include, /apps\/site\/knowledge/);
});
