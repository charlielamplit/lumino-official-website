const test = require("node:test");
const assert = require("node:assert/strict");
const catalog = require("../catalog.js");
const schema = require("../schema.js");
const advisor = require("../router.js");
const AS_OF = "2026-11-02";

test("catalog publishes six initial topics and reviewed deterministic content", () => {
  assert.equal(catalog.topics.length, 6);
  for (const record of [...catalog.fixedAnswers, ...catalog.toolRoutes]) {
    assert.equal(record.status, "published");
    assert.match(record.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.reviewer);
    assert.match(record.version, /^\d+\.\d+\.\d+$/);
  }
});

test("each initial topic returns a valid fixed response without a model", () => {
  for (const topic of advisor.getTopics("zh")) {
    const response = advisor.route({ topicId: topic.id, lang: "zh", asOf: AS_OF });
    assert.equal(response.answer_mode, "fixed");
    assert.equal(response.confidence, "high");
    assert.equal(schema.validateResponse(response).ok, true);
    assert.ok(response.answer.length > 20);
  }
});

test("English topic responses use English content", () => {
  const response = advisor.route({ topicId: "cbam_vs_pcf", lang: "en", asOf: AS_OF });
  assert.equal(response.answer_mode, "fixed");
  assert.match(response.answer, /CBAM supports EU import compliance/);
  assert.doesNotMatch(response.answer, /[一-鿿]/);
  assert.equal(response.suggested_replies.length, 4);
});

test("CN Code questions route to tools and never claim formal classification", () => {
  for (const input of ["我想查 CN Code", "HS code lookup", "TARIC 怎么查"]) {
    const response = advisor.route({ text: input, lang: "zh", asOf: AS_OF });
    assert.equal(response.answer_mode, "tool_route");
    assert.equal(response.intent, "cn_code_lookup");
    assert.equal(response.handoff, "expert_required");
    assert.deepEqual(response.links.map((item) => item.url), [
      "/calculator",
      "/knowledge/article?id=cbam-hs-cn-codes",
      "/apps/site/Lumino%20联系.dc.html?serviceId=cbam&source=homepage-advisor&topic=cn-code"
    ]);
    assert.doesNotMatch(response.answer, /已确定|正式认定|你的编码是/);
  }
});

test("free text maps common questions to reviewed fixed answers", () => {
  assert.equal(advisor.route({ text: "CBAM 和 PCF 有什么区别", asOf: AS_OF }).intent, "cbam_vs_pcf");
  assert.equal(advisor.route({ text: "进口商让我准备碳数据", asOf: AS_OF }).intent, "cbam_data_start");
  assert.equal(advisor.route({ text: "客户要 Scope 1 2 3 数据", asOf: AS_OF }).intent, "esg_ghg_triage");
  assert.equal(advisor.route({ text: "想做绿电和绿证规划", asOf: AS_OF }).intent, "renewable_power");
});

test("a suggested reply advances the deterministic flow instead of falling back", () => {
  const response = advisor.route({ topicId: "cbam_scope", replyId: "steel", text: "钢铁", lang: "zh", asOf: AS_OF });
  assert.equal(response.answer_mode, "fixed");
  assert.equal(response.topic_id, "cbam_scope");
  assert.match(response.answer, /已记录：钢铁/);
  assert.equal(response.next_question, null);
  assert.equal(response.suggested_replies.length, 0);
});

test("unknown questions fail safely instead of inventing an answer", () => {
  const response = advisor.route({ text: "我有一个完全未发布的特殊问题", lang: "zh", asOf: AS_OF });
  assert.equal(response.answer_mode, "fallback");
  assert.equal(response.confidence, "low");
  assert.equal(response.handoff, "contact");
  assert.equal(response.sources.length, 0);
  assert.equal(schema.validateResponse(response).ok, true);
});

test("expired fixed content is not routed as a published answer", () => {
  const response = advisor.route({ topicId: "cbam_scope", lang: "zh", asOf: "2027-06-01" });
  assert.equal(response.answer_mode, "fallback");
  assert.equal(response.confidence, "low");
});

test("public deterministic content does not expose internal maturity labels", () => {
  const blob = JSON.stringify(catalog);
  assert.doesNotMatch(blob, /PILOT|PLANNED|UNVERIFIED|claimState/);
});
