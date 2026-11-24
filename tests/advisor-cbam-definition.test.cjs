const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

test("public CBAM definition is source-backed and states annual declaration", async () => {
  const previous = process.env.ADVISOR_PUBLIC_BETA;
  process.env.ADVISOR_PUBLIC_BETA = "1";
  try {
    const file = pathToFileURL(path.join(__dirname, "../api/advisor.js")).href;
    const { default: handler } = await import(`${file}?definition-test=${Date.now()}`);
    let body = "";
    const response = {
      status() { return this; },
      setHeader() {},
      end(value) { body = value || ""; },
      write() {},
    };
    await handler({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.218", accept: "application/json" },
      body: { text: "CBAM 是什么意思？", lang: "zh" },
      query: {},
      on() {},
    }, response);
    const result = JSON.parse(body);
    assert.equal(result.answer_mode, "fixed");
    assert.equal(result.runtime.source, "official_fixed");
    assert.match(result.answer, /按年度申报/);
    assert.doesNotMatch(result.answer, /按季度申报|仍处于过渡期/);
    assert.match(result.sources[0].url, /^https:\/\/taxation-customs\.ec\.europa\.eu\//);
  } finally {
    if (previous === undefined) delete process.env.ADVISOR_PUBLIC_BETA;
    else process.env.ADVISOR_PUBLIC_BETA = previous;
  }
});
