const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("float tools gates Ask Lumino behind public beta config", () => {
  const source = read("apps/site/site/float-tools.js");
  assert.match(source, /\/api\/advisor-config/);
  assert.match(source, /public_beta/);
  assert.match(source, /data-open-advisor/);
  assert.doesNotMatch(source, /OPENAI|API_KEY/);
});

test("advisor widget exposes public-beta boundary and preliminary labels", () => {
  const source = read("apps/site/site/advisor-widget.js");
  assert.match(source, /公开试用/);
  assert.match(source, /初步判断/);
  assert.match(source, /retrieval_model/);
  assert.match(source, /\/api\/advisor-metrics/);
  assert.match(source, /不保存对话到线索库/);
  assert.match(source, /data-advisor-cta/);
});

test("homepage keeps a soft Ask Lumino entry", () => {
  const source = read("apps/site/Lumino 官网.dc.html");
  assert.match(source, /data-open-advisor/);
  assert.match(source, /问 Lumino/);
});

test("advisor flags honor public beta and model kill-switch", async () => {
  const file = pathToFileURL(path.join(root, "api/_lib/advisor-flags.js")).href;
  const mod = await import(`${file}?t=${Date.now()}`);
  const prevBeta = process.env.ADVISOR_PUBLIC_BETA;
  const prevModel = process.env.ADVISOR_MODEL_ENABLED;
  try {
    process.env.ADVISOR_PUBLIC_BETA = "0";
    process.env.ADVISOR_MODEL_ENABLED = "0";
    // re-import won't reload env-bound functions unless they read env each call - they do
    assert.equal(mod.publicBetaEnabled(), false);
    assert.equal(mod.modelEnabled(), false);
    process.env.ADVISOR_PUBLIC_BETA = "1";
    process.env.ADVISOR_MODEL_ENABLED = "1";
    assert.equal(mod.publicBetaEnabled(), true);
    assert.equal(mod.modelEnabled(), true);
    const flags = mod.getPublicFlags();
    assert.equal(flags.lead_capture, false);
    assert.equal(flags.store, false);
  } finally {
    if (prevBeta == null) delete process.env.ADVISOR_PUBLIC_BETA; else process.env.ADVISOR_PUBLIC_BETA = prevBeta;
    if (prevModel == null) delete process.env.ADVISOR_MODEL_ENABLED; else process.env.ADVISOR_MODEL_ENABLED = prevModel;
  }
});

test("advisor metrics store aggregates rates without raw text", async () => {
  const file = pathToFileURL(path.join(root, "api/_lib/advisor-metrics-store.js")).href;
  const mod = await import(`${file}?t=${Date.now()}`);
  mod.resetAdvisorMetricsForTests();
  mod.recordAdvisorMetric({ type: "request", answer_mode: "fixed", source: "deterministic", latency_ms: 12, ok: true });
  mod.recordAdvisorMetric({ type: "request", answer_mode: "tool_route", source: "deterministic", latency_ms: 20, ok: true });
  mod.recordAdvisorMetric({ type: "request", answer_mode: "fallback", source: "no_sources", latency_ms: 8, ok: true });
  mod.recordAdvisorMetric({ type: "cta", cta_type: "contact" });
  const summary = mod.getAdvisorMetricsSummary();
  assert.equal(summary.counters.requests, 3);
  assert.equal(summary.counters.cta_clicks, 1);
  assert.ok(summary.rates.tool_route_rate > 0);
  assert.ok(summary.rates.no_sources_rate > 0);
  assert.equal(JSON.stringify(summary).includes("13800138000"), false);
});
