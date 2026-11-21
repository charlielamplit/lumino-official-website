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
  assert.match(source, /data-float-top/);
  assert.match(source, /问 Lumino|Ask Lumino/);
  assert.doesNotMatch(source, /OPENAI|API_KEY|sk-/);
  assert.doesNotMatch(source, /insertAdvisorMenuItem/);
});

test("advisor widget exposes public-beta boundary and preliminary labels", () => {
  const source = read("apps/site/site/advisor-widget.js");
  assert.match(source, /初步判断，帮助你快速定向/);
  assert.match(source, /retrieval_model/);
  assert.match(source, /\/api\/advisor-metrics/);
  assert.match(source, /需要更有针对性的服务/);
  assert.match(source, /联系我们/);
  assert.match(source, /advisor-foot/);
  assert.match(source, /TimeoutError|AbortError/);
  assert.match(source, /data-advisor-cta/);
  assert.doesNotMatch(source, /公开试用/);
});

test("homepage soft Ask Lumino entry starts hidden until beta confirmed", () => {
  const source = read("apps/site/home.html");
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
  mod.recordAdvisorMetric({ type: "request", answer_mode: "general_model", source: "general_model", latency_ms: 18, ok: true, model_attempted: true, model_tier: "luna" });
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
  assert.equal(summary.counters.requests, 5);
  assert.equal(summary.counters.client_events, 2);
  assert.equal(summary.counters.cta_clicks, 1);
  assert.equal(summary.counters.errors, 0);
  assert.equal(summary.counters.model_attempts, 2);
  assert.equal(summary.counters.model_failures, 1);
  assert.equal(summary.counters.model_luna, 2);
  assert.ok(summary.rates.tool_route_rate > 0);
  assert.ok(summary.rates.no_sources_rate > 0);
  assert.ok(summary.rates.general_guidance_rate > 0);
  assert.equal(JSON.stringify(summary).includes("13800138000"), false);
});

test("unmatched questions fall back to a useful framework when the model is not configured", async () => {
  const previous = {
    beta: process.env.ADVISOR_PUBLIC_BETA,
    enabled: process.env.ADVISOR_MODEL_ENABLED,
    advisorKey: process.env.ADVISOR_OPENAI_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
  };
  process.env.ADVISOR_PUBLIC_BETA = "1";
  process.env.ADVISOR_MODEL_ENABLED = "1";
  delete process.env.ADVISOR_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const file = pathToFileURL(path.join(root, "api/advisor.js")).href;
    const mod = await import(`${file}?t=${Date.now()}-${Math.random()}`);
    const out = { statusCode: 0, body: "" };
    const res = {
      status(code) { out.statusCode = code; return this; },
      setHeader() {},
      end(body) { out.body = body || ""; },
      write() {},
    };
    await mod.default({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.91" },
      body: { text: "客户突然让我准备一份陌生的合规文件，怎么开始？", lang: "zh" },
      query: {},
      on() {},
    }, res);
    const data = JSON.parse(out.body);
    assert.equal(out.statusCode, 200);
    assert.equal(data.runtime.source, "actionable_fallback");
    assert.equal(data.runtime.model_configured, false);
    assert.equal(data.runtime.ui_state, "basic_mode");
    assert.equal(data.outcome_type, "clarify");
    assert.equal(data.sources.length, 0);
    assert.match(data.answer, /三个动作|截止时间/);
    assert.doesNotMatch(data.answer, /没有足够依据|无法确认/);
  } finally {
    for (const [key, value] of Object.entries({
      ADVISOR_PUBLIC_BETA: previous.beta,
      ADVISOR_MODEL_ENABLED: previous.enabled,
      ADVISOR_OPENAI_API_KEY: previous.advisorKey,
      OPENAI_API_KEY: previous.openaiKey,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("clear out-of-scope requests are redirected without calling a model", async () => {
  const previous = process.env.ADVISOR_PUBLIC_BETA;
  const originalFetch = globalThis.fetch;
  process.env.ADVISOR_PUBLIC_BETA = "1";
  let called = false;
  try {
    globalThis.fetch = async () => { called = true; throw new Error("must not call model"); };
    const file = pathToFileURL(path.join(root, "api/advisor.js")).href;
    const mod = await import(`${file}?t=${Date.now()}-${Math.random()}`);
    const out = { statusCode: 0, body: "" };
    const res = {
      status(code) { out.statusCode = code; return this; },
      setHeader() {},
      end(body) { out.body = body || ""; },
      write() {},
    };
    await mod.default({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.96" },
      body: { text: "帮我写一首关于海边的诗", lang: "zh" },
      query: {},
      on() {},
    }, res);
    const data = JSON.parse(out.body);
    assert.equal(called, false);
    assert.equal(data.intent, "out_of_scope");
    assert.equal(data.outcome_type, "clarify");
    assert.equal(data.runtime.source, "out_of_scope");
    assert.equal(data.links.some((item) => item.type === "contact"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous == null) delete process.env.ADVISOR_PUBLIC_BETA; else process.env.ADVISOR_PUBLIC_BETA = previous;
  }
});

test("unmatched questions reach the general model path when the model is configured", async () => {
  const previous = {
    beta: process.env.ADVISOR_PUBLIC_BETA,
    enabled: process.env.ADVISOR_MODEL_ENABLED,
    key: process.env.ADVISOR_OPENAI_API_KEY,
    base: process.env.ADVISOR_OPENAI_BASE_URL,
    mode: process.env.ADVISOR_OPENAI_API_MODE,
  };
  const originalFetch = globalThis.fetch;
  process.env.ADVISOR_PUBLIC_BETA = "1";
  process.env.ADVISOR_MODEL_ENABLED = "1";
  process.env.ADVISOR_OPENAI_API_KEY = "sk-test";
  process.env.ADVISOR_OPENAI_BASE_URL = "https://aiberm.com/v1";
  process.env.ADVISOR_OPENAI_API_MODE = "chat";
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.match(body.messages[0].content, /运用自身能力直接回答/);
      assert.match(body.messages[1].content, /参考日期：2026-11-20/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                intent: "general_guidance",
                answer: "先确认适用辖区、产品范围和客户要求，再对照参考时点核实现行规则。",
                confidence: "medium",
                next_question: "产品要进入哪个市场？",
                primary_service_id: null,
                secondary_service_id: null,
                handoff: "none",
              }),
            },
          }],
        }),
      };
    };
    const file = pathToFileURL(path.join(root, "api/advisor.js")).href;
    const mod = await import(`${file}?t=${Date.now()}-${Math.random()}`);
    const out = { statusCode: 0, body: "" };
    const res = {
      status(code) { out.statusCode = code; return this; },
      setHeader() {},
      end(body) { out.body = body || ""; },
      write() {},
    };
    await mod.default({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.92" },
      body: { text: "这个完全没有收录的新要求应该怎么判断？", lang: "zh", asOf: "2026-11-20" },
      query: {},
      on() {},
    }, res);
    const data = JSON.parse(out.body);
    assert.equal(out.statusCode, 200);
    assert.equal(data.answer_mode, "general_model");
    assert.equal(data.outcome_type, "answer");
    assert.equal(data.runtime.source, "general_model");
    assert.equal(data.runtime.model_configured, true);
    assert.equal(data.runtime.ui_state, "ok");
    assert.equal(data.runtime.degradation_reason, "no_published_sources");
    assert.equal(data.sources.length, 0);
    assert.match(data.answer, /适用辖区/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      ADVISOR_PUBLIC_BETA: previous.beta,
      ADVISOR_MODEL_ENABLED: previous.enabled,
      ADVISOR_OPENAI_API_KEY: previous.key,
      ADVISOR_OPENAI_BASE_URL: previous.base,
      ADVISOR_OPENAI_API_MODE: previous.mode,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("stale model reference dates degrade to a safe actionable result", async () => {
  const previous = {
    beta: process.env.ADVISOR_PUBLIC_BETA,
    enabled: process.env.ADVISOR_MODEL_ENABLED,
    key: process.env.ADVISOR_OPENAI_API_KEY,
    base: process.env.ADVISOR_OPENAI_BASE_URL,
    mode: process.env.ADVISOR_OPENAI_API_MODE,
  };
  const originalFetch = globalThis.fetch;
  process.env.ADVISOR_PUBLIC_BETA = "1";
  process.env.ADVISOR_MODEL_ENABLED = "1";
  process.env.ADVISOR_OPENAI_API_KEY = "sk-test";
  process.env.ADVISOR_OPENAI_BASE_URL = "https://aiberm.com/v1";
  process.env.ADVISOR_OPENAI_API_MODE = "chat";
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              intent: "general_guidance",
              answer: "参考时点为 2025 年，可以直接使用旧规则。",
              confidence: "medium",
              next_question: null,
              primary_service_id: "cbam",
              secondary_service_id: null,
              handoff: "none",
            }),
          },
        }],
      }),
    });
    const file = pathToFileURL(path.join(root, "api/advisor.js")).href;
    const mod = await import(`${file}?t=${Date.now()}-${Math.random()}`);
    const out = { statusCode: 0, body: "" };
    const res = {
      status(code) { out.statusCode = code; return this; },
      setHeader() {},
      end(body) { out.body = body || ""; },
      write() {},
    };
    await mod.default({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.97" },
      body: { text: "这个新要求应该怎么判断？", lang: "zh", asOf: "2026-11-20" },
      query: {},
      on() {},
    }, res);
    const data = JSON.parse(out.body);
    assert.equal(out.statusCode, 200);
    assert.equal(data.runtime.source, "actionable_fallback");
    assert.equal(data.runtime.degradation_reason, "stale_reference_date");
    assert.equal(data.outcome_type, "clarify");
    assert.doesNotMatch(data.answer, /2025|旧规则/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      ADVISOR_PUBLIC_BETA: previous.beta,
      ADVISOR_MODEL_ENABLED: previous.enabled,
      ADVISOR_OPENAI_API_KEY: previous.key,
      ADVISOR_OPENAI_BASE_URL: previous.base,
      ADVISOR_OPENAI_API_MODE: previous.mode,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("portal grounded questions use contextual model output when enrichment is enabled", async () => {
  const previous = {
    beta: process.env.ADVISOR_PUBLIC_BETA,
    enabled: process.env.ADVISOR_MODEL_ENABLED,
    key: process.env.ADVISOR_OPENAI_API_KEY,
    base: process.env.ADVISOR_OPENAI_BASE_URL,
    mode: process.env.ADVISOR_OPENAI_API_MODE,
    grounded: process.env.ADVISOR_GROUNDED_MODEL_ENABLED,
  };
  const originalFetch = globalThis.fetch;
  process.env.ADVISOR_PUBLIC_BETA = "1";
  process.env.ADVISOR_MODEL_ENABLED = "1";
  process.env.ADVISOR_OPENAI_API_KEY = "sk-test";
  process.env.ADVISOR_OPENAI_BASE_URL = "https://aiberm.com/v1";
  process.env.ADVISOR_OPENAI_API_MODE = "chat";
  process.env.ADVISOR_GROUNDED_MODEL_ENABLED = "1";
  let modelCalled = false;
  try {
    globalThis.fetch = async (_url, init) => {
      modelCalled = true;
      const body = JSON.parse(init.body);
      assert.match(body.messages[0].content, /Portal 的 CBAM 助手/);
      assert.match(body.messages[1].content, /CASE-CBAM-2026/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                intent: "portal_cbam_scope",
                answer: "结合当前 2026 年度项目，应先核对本季度产品 CN Code、进口商关系和数据缺口。",
                confidence: "medium",
                next_question: "要先看产品范围还是数据缺口？",
                primary_service_id: "cbam",
                secondary_service_id: null,
                handoff: "none",
              }),
            },
          }],
        }),
      };
    };
    const file = pathToFileURL(path.join(root, "api/advisor.js")).href;
    const mod = await import(`${file}?t=${Date.now()}-${Math.random()}`);
    const out = { statusCode: 0, body: "" };
    const res = {
      status(code) { out.statusCode = code; return this; },
      setHeader() {},
      end(body) { out.body = body || ""; },
      write() {},
    };
    await mod.default({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.93" },
      body: {
        text: "我的产品是否可能涉及 CBAM？",
        lang: "zh",
        surface: "portal",
        taskMode: "ask",
        asOf: "2026-11-20",
        context: {
          serviceId: "cbam",
          annualProjectId: "CASE-CBAM-2026",
          serviceYear: "2026",
          workstream: "scope_master_data",
          objectRef: { type: "annualInclusion", id: "SCOPE-CBAM-2026", revision: 3 },
        },
      },
      query: {},
      on() {},
    }, res);
    const data = JSON.parse(out.body);
    assert.equal(out.statusCode, 200);
    assert.equal(modelCalled, true);
    assert.equal(data.runtime.surface, "portal");
    assert.match(data.answer, /2026 年度项目/);
    assert.notEqual(data.answer_mode, "fixed");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      ADVISOR_PUBLIC_BETA: previous.beta,
      ADVISOR_MODEL_ENABLED: previous.enabled,
      ADVISOR_OPENAI_API_KEY: previous.key,
      ADVISOR_OPENAI_BASE_URL: previous.base,
      ADVISOR_OPENAI_API_MODE: previous.mode,
      ADVISOR_GROUNDED_MODEL_ENABLED: previous.grounded,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("portal may forward only sanitized open questions to an HTTPS Advisor upstream", async () => {
  const previous = {
    beta: process.env.ADVISOR_PUBLIC_BETA,
    upstream: process.env.ADVISOR_UPSTREAM_URL,
  };
  const originalFetch = globalThis.fetch;
  process.env.ADVISOR_PUBLIC_BETA = "1";
  process.env.ADVISOR_UPSTREAM_URL = "https://intl.luminoyou.com/path-is-ignored";
  let calls = 0;
  try {
    globalThis.fetch = async (url, init) => {
      calls += 1;
      assert.equal(url, "https://intl.luminoyou.com/api/advisor");
      const body = JSON.parse(init.body);
      assert.equal(body.surface, "portal");
      assert.equal(body.context.serviceId, "cbam");
      assert.equal(body.context.tenantId, undefined);
      assert.equal(body.context.secret, undefined);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          answer_mode: "general_model",
          answer: "先确认产品、期间和交付用途。",
          confidence: "medium",
          sources: [],
          runtime: {
            source: "general_model",
            model_configured: true,
            model_tier: "luna",
            storage_policy: "provider_contract_required",
            store_requested: false,
          },
        }),
      };
    };
    const file = pathToFileURL(path.join(root, "api/advisor.js")).href;
    const mod = await import(`${file}?t=${Date.now()}-${Math.random()}`);
    const out = { statusCode: 0, body: "" };
    const res = {
      status(code) { out.statusCode = code; return this; },
      setHeader() {},
      end(body) { out.body = body || ""; },
      write() {},
    };
    await mod.default({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.94" },
      body: {
        text: "这个季度应该先准备什么？",
        lang: "zh",
        surface: "portal",
        context: { serviceId: "cbam", tenantId: "must-not-forward", secret: "must-not-forward" },
      },
      query: {},
      on() {},
    }, res);
    const data = JSON.parse(out.body);
    assert.equal(calls, 1);
    assert.equal(out.statusCode, 200);
    assert.equal(data.runtime.source, "general_model");
    assert.equal(data.runtime.model_tier, "luna");
    assert.match(data.answer, /产品/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.beta == null) delete process.env.ADVISOR_PUBLIC_BETA; else process.env.ADVISOR_PUBLIC_BETA = previous.beta;
    if (previous.upstream == null) delete process.env.ADVISOR_UPSTREAM_URL; else process.env.ADVISOR_UPSTREAM_URL = previous.upstream;
  }
});

test("sensitive portal input is rejected locally before an Advisor upstream call", async () => {
  const previous = process.env.ADVISOR_UPSTREAM_URL;
  const originalFetch = globalThis.fetch;
  process.env.ADVISOR_UPSTREAM_URL = "https://intl.luminoyou.com";
  let called = false;
  try {
    globalThis.fetch = async () => { called = true; throw new Error("must not call upstream"); };
    const file = pathToFileURL(path.join(root, "api/advisor.js")).href;
    const mod = await import(`${file}?t=${Date.now()}-${Math.random()}`);
    const out = { statusCode: 0, body: "" };
    const res = {
      status(code) { out.statusCode = code; return this; },
      setHeader() {},
      end(body) { out.body = body || ""; },
      write() {},
    };
    await mod.default({
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.95" },
      body: { text: "请处理 13800138000", lang: "zh", surface: "portal" },
      query: {},
      on() {},
    }, res);
    const data = JSON.parse(out.body);
    assert.equal(called, false);
    assert.equal(data.runtime.source, "privacy_guard");
  } finally {
    globalThis.fetch = originalFetch;
    if (previous == null) delete process.env.ADVISOR_UPSTREAM_URL; else process.env.ADVISOR_UPSTREAM_URL = previous;
  }
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
