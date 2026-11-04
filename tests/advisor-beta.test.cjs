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
  assert.match(source, /AbortSignal\.timeout\(2500\)/);
  assert.match(source, /display = "none"/);
  assert.match(source, /data-open-advisor/);
  assert.match(source, /wirePrimaryAsAdvisor/);
  assert.match(source, /wirePrimaryAsTools/);
  assert.match(source, /data-float-tools/);
  assert.match(source, /问 Lumino|Ask Lumino/);
  assert.doesNotMatch(source, /OPENAI|API_KEY|sk-/);
  assert.doesNotMatch(source, /insertAdvisorMenuItem/);
});

test("advisor widget exposes public-beta boundary and preliminary labels", () => {
  const source = read("apps/site/site/advisor-widget.js");
  assert.match(source, /公开试用/);
  assert.match(source, /初步判断/);
  assert.match(source, /retrieval_model/);
  assert.match(source, /\/api\/advisor-metrics/);
  assert.match(source, /不会提交给 Lumino/);
  assert.match(source, /TimeoutError|AbortError/);
  assert.match(source, /data-advisor-cta/);
});

test("homepage soft Ask Lumino entry starts hidden until beta confirmed", () => {
  const source = read("apps/site/Lumino 官网.dc.html");
  assert.match(source, /m-hero__actions[\s\S]*data-open-advisor[^>]*hidden/);
  assert.match(source, /data-open-advisor[^>]*hidden/);
  assert.match(source, /问 Lumino/);
});

test("hidden advisor soft CTA CSS overrides button display", () => {
  const css = `${read("apps/site/site/site-v3.css")}\n${read("apps/site/site/advisor-widget.css")}`;
  assert.match(css, /\[data-open-advisor\]\[hidden\][\s\S]*display:\s*none\s*!important/);
});

test("advisor flags honor public beta and model kill-switch", async () => {
  const file = pathToFileURL(path.join(root, "api/_lib/advisor-flags.js")).href;
  const mod = await import(`${file}?t=${Date.now()}`);
  const prevBeta = process.env.ADVISOR_PUBLIC_BETA;
  const prevModel = process.env.ADVISOR_MODEL_ENABLED;
  try {
    process.env.ADVISOR_PUBLIC_BETA = "0";
    process.env.ADVISOR_MODEL_ENABLED = "0";
    assert.equal(mod.publicBetaEnabled(), false);
    assert.equal(mod.modelEnabled(), false);
    process.env.ADVISOR_PUBLIC_BETA = "1";
    process.env.ADVISOR_MODEL_ENABLED = "1";
    assert.equal(mod.publicBetaEnabled(), true);
    assert.equal(mod.modelEnabled(), true);
    const flags = mod.getPublicFlags();
    assert.equal(flags.lead_capture, false);
    assert.equal(flags.lumino_conversation_store, false);
    assert.ok(["api_no_store", "provider_contract_required", "unknown"].includes(flags.storage_policy));
    assert.equal(Object.prototype.hasOwnProperty.call(flags, "store"), false);
    assert.equal(typeof flags.api_base_host, "string");
    assert.ok(["chat", "responses"].includes(flags.api_mode));
  } finally {
    if (prevBeta == null) delete process.env.ADVISOR_PUBLIC_BETA; else process.env.ADVISOR_PUBLIC_BETA = prevBeta;
    if (prevModel == null) delete process.env.ADVISOR_MODEL_ENABLED; else process.env.ADVISOR_MODEL_ENABLED = prevModel;
  }
});

test("advisor metrics reject forged counters and keep client events out of requests", async () => {
  const file = pathToFileURL(path.join(root, "api/_lib/advisor-metrics-store.js")).href;
  const mod = await import(`${file}?t=${Date.now()}`);
  mod.resetAdvisorMetricsForTests();
  mod.recordAdvisorMetric({ type: "request", answer_mode: "fixed", source: "deterministic", latency_ms: 12, ok: true });
  mod.recordAdvisorMetric({ type: "client", answer_mode: "fixed", source: "deterministic", latency_ms: 9, ok: true });
  mod.recordAdvisorMetric({ type: "request", answer_mode: "tool_route", source: "deterministic", latency_ms: 20, ok: true });
  mod.recordAdvisorMetric({ type: "request", answer_mode: "fallback", source: "no_sources", latency_ms: 8, ok: true });
  mod.recordAdvisorMetric({ type: "cta", cta_type: "contact" });
  mod.recordAdvisorMetric({ type: "client", answer_mode: "errors", source: "toString", ok: true });
  mod.recordAdvisorMetric({
    type: "request",
    answer_mode: "fixed",
    source: "deterministic",
    model_attempted: true,
    model_failed: true,
    model_tier: "luna",
    latency_ms: 40,
    ok: true,
  });
  const summary = mod.getAdvisorMetricsSummary();
  assert.equal(summary.counters.requests, 4);
  assert.equal(summary.counters.client_events, 2);
  assert.equal(summary.counters.cta_clicks, 1);
  assert.equal(summary.counters.errors, 0);
  assert.equal(summary.counters.model_attempts, 1);
  assert.equal(summary.counters.model_failures, 1);
  assert.equal(summary.counters.model_luna, 1);
  assert.ok(summary.rates.tool_route_rate > 0);
  assert.ok(summary.rates.no_sources_rate > 0);
  assert.equal(JSON.stringify(summary).includes("13800138000"), false);
});

test("advisor API disables when public beta is off", async () => {
  const prev = process.env.ADVISOR_PUBLIC_BETA;
  process.env.ADVISOR_PUBLIC_BETA = "0";
  try {
    const file = pathToFileURL(path.join(root, "api/advisor.js")).href;
    const mod = await import(`${file}?t=${Date.now()}`);
    const out = { statusCode: 0, body: "" };
    const res = {
      status(code) { out.statusCode = code; return this; },
      setHeader() {},
      end(body) { out.body = body; },
      write() {},
    };
    await mod.default({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.77" },
      body: { topicId: "cbam_vs_pcf", lang: "zh" },
      query: {},
    }, res);
    const data = JSON.parse(out.body);
    assert.equal(out.statusCode, 200);
    assert.equal(data.runtime.source, "beta_disabled");
    assert.equal(data.runtime.public_beta, false);
    assert.equal(data.intent, "beta_disabled");
  } finally {
    if (prev == null) delete process.env.ADVISOR_PUBLIC_BETA;
    else process.env.ADVISOR_PUBLIC_BETA = prev;
  }
});
