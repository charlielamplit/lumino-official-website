const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function loadRetrieval() {
  const file = pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-retrieval.js")).href;
  return import(file);
}

const PROCESS_LEAK = /\u5df2\u5ba1\u6838|\u56fa\u5b9a\u7b54\u6848|PILOT/;

test("retrieval only returns published knowledge hits with urls", async () => {
  const retrieval = await loadRetrieval();
  retrieval.clearRetrievalCache();
  const hits = retrieval.retrievePublishedKnowledge({
    text: "\u4ea7\u54c1\u78b3\u8db3\u8ff9 \u6d3b\u52a8\u6570\u636e \u600e\u4e48\u91c7\u96c6",
    lang: "zh",
    asOf: "2026-11-02",
    limit: 3,
  });
  assert.ok(hits.length >= 1);
  for (const hit of hits) {
    assert.ok(hit.title);
    assert.match(hit.url, /\/knowledge\/article\?id=/);
    assert.ok(hit.excerpt || hit.lead);
  }
});

test("unmatched questions return an actionable fallback without inventing sources", async () => {
  const retrieval = await loadRetrieval();
  const hits = retrieval.retrievePublishedKnowledge({
    text: "xyzzy-no-match completely unrelated tax question",
    lang: "zh",
    asOf: "2026-11-02",
  });
  assert.equal(hits.length, 0);
  const stopped = retrieval.stopWithoutSources("zh");
  assert.equal(stopped.answer_mode, "fallback");
  assert.equal(stopped.sources.length, 0);
  assert.equal(stopped.handoff, "contact");
  assert.match(stopped.answer, /三个动作|截止时间/);
  assert.match(stopped.next_question, /是谁提出要求/);
  assert.doesNotMatch(stopped.answer, PROCESS_LEAK);
});

test("grounded fallback always attaches published sources", async () => {
  const retrieval = await loadRetrieval();
  const hits = retrieval.retrievePublishedKnowledge({
    text: "EUDR CSDDD export preparation",
    lang: "zh",
    asOf: "2026-11-02",
  });
  assert.ok(hits.length >= 1);
  const grounded = retrieval.buildGroundedFallback(hits, "zh");
  assert.equal(grounded.answer_mode, "retrieval_model");
  assert.ok(grounded.sources.length >= 1);
  assert.ok(grounded.service_matches.length <= 2);
  assert.doesNotMatch(grounded.answer, PROCESS_LEAK);
});

async function loadModel() {
  const file = pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-model.js")).href;
  return import(file);
}

test("chooseModel upgrades complex or multi-source questions to Sol", async () => {
  const model = await loadModel();
  assert.equal(model.chooseModel({ text: "short", hits: [{}, {}] }).tier, "luna");
  assert.equal(model.chooseModel({ text: "对比 CBAM 与 PCF 的差异", hits: [{}, {}] }).tier, "sol");
  assert.equal(model.chooseModel({ text: "short", hits: [{}, {}, {}] }).tier, "sol");
});
