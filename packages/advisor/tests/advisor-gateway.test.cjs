const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadGateway() {
  const file = pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-gateway.js")).href;
  return import(`${file}?t=${Date.now()}-${Math.random()}`);
}

async function loadModel() {
  const file = pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-model.js")).href;
  return import(`${file}?t=${Date.now()}-${Math.random()}`);
}

async function loadFlags() {
  const file = pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-flags.js")).href;
  return import(`${file}?t=${Date.now()}-${Math.random()}`);
}

test("normalizeApiBaseUrl strips trailing slashes", async () => {
  const gw = await loadGateway();
  assert.equal(gw.normalizeApiBaseUrl("https://aiberm.com/v1/"), "https://aiberm.com/v1");
  assert.equal(gw.normalizeApiBaseUrl("https://aiberm.com/v1///"), "https://aiberm.com/v1");
  assert.equal(gw.normalizeApiBaseUrl(""), "https://api.openai.com/v1");
});

test("resolveApiMode auto-selects responses for official OpenAI and chat otherwise", async () => {
  const gw = await loadGateway();
  assert.equal(gw.resolveApiMode({ baseUrl: "https://api.openai.com/v1" }), "responses");
  assert.equal(gw.resolveApiMode({ baseUrl: "https://aiberm.com/v1" }), "chat");
  assert.equal(gw.resolveApiMode({ forced: "chat", baseUrl: "https://api.openai.com/v1" }), "chat");
  assert.equal(gw.resolveApiMode({ forced: "responses", baseUrl: "https://aiberm.com/v1" }), "responses");
});

test("storage_policy is capability-based and never claims no-store for third-party gateways", async () => {
  const gw = await loadGateway();
  assert.equal(
    gw.resolveStoragePolicy({ baseUrl: "https://api.openai.com/v1", apiMode: "responses" }),
    "api_no_store",
  );
  assert.equal(
    gw.resolveStoragePolicy({ baseUrl: "https://api.openai.com/v1", apiMode: "chat" }),
    "provider_contract_required",
  );
  assert.equal(
    gw.resolveStoragePolicy({ baseUrl: "https://aiberm.com/v1", apiMode: "chat" }),
    "provider_contract_required",
  );
  assert.equal(
    gw.resolveStoragePolicy({
      baseUrl: "https://aiberm.com/v1",
      apiMode: "chat",
      override: "unknown",
    }),
    "unknown",
  );
  assert.equal(gw.shouldSendStoreFalse("api_no_store"), true);
  assert.equal(gw.shouldSendStoreFalse("provider_contract_required"), false);
  assert.equal(gw.shouldSendStoreFalse("unknown"), false);
});

test("parseModelJson accepts raw, fenced, and mixed text JSON", async () => {
  const gw = await loadGateway();
  assert.equal(gw.parseModelJson('{"answer":"a","intent":"i"}').answer, "a");
  assert.equal(gw.parseModelJson('```json\n{"answer":"b","intent":"i"}\n```').answer, "b");
  assert.equal(gw.parseModelJson('Sure.\n{"answer":"c","intent":"i"}\nThanks').answer, "c");
  assert.throws(() => gw.parseModelJson("not-json"), /JSON|model_invalid|Unexpected/);
});

test("extractChatMessageContent prefers content then reasoning_content", async () => {
  const gw = await loadGateway();
  assert.equal(
    gw.extractChatMessageContent({ choices: [{ message: { content: "hi" }, finish_reason: "stop" }] }).raw,
    "hi",
  );
  assert.equal(
    gw.extractChatMessageContent({
      choices: [{ message: { content: "", reasoning_content: '{"answer":"x"}' }, finish_reason: "stop" }],
    }).raw,
    '{"answer":"x"}',
  );
  assert.equal(
    gw.extractChatMessageContent({ choices: [{ message: { content: "" }, finish_reason: "length" }] }).empty,
    true,
  );
});

test("classifyUpstreamHttpError distinguishes auth, rate limit, and upstream failures", async () => {
  const gw = await loadGateway();
  assert.match(gw.classifyUpstreamHttpError(401, "nope"), /401_auth/);
  assert.match(gw.classifyUpstreamHttpError(429, "slow"), /429_rate_limit/);
  assert.match(gw.classifyUpstreamHttpError(500, "boom"), /500_upstream/);
  assert.match(gw.classifyUpstreamHttpError(405, "openai_error"), /model_http_405/);
});

test("chooseModel supports explicit Luna opt-out", async () => {
  const model = await loadModel();
  const luna = "luna-test-model";
  const sol = "sol-test-model";
  assert.deepEqual(model.chooseModel({ text: "What is CBAM?", hits: [{ id: 1 }], luna, sol, lunaEnabled: true }), {
    id: luna,
    tier: "luna",
  });
  assert.deepEqual(model.chooseModel({ text: "What is CBAM?", hits: [{ id: 1 }], luna, sol, lunaEnabled: false }), {
    id: sol,
    tier: "sol",
  });
  assert.deepEqual(model.chooseModel({ text: "Please compare CBAM versus PCF", hits: [{ id: 1 }], luna, sol, lunaEnabled: true }), {
    id: sol,
    tier: "sol",
  });
  assert.equal(model.chooseModel({ text: "x", hits: [{}, {}, {}], luna, sol, lunaEnabled: true }).tier, "sol");
  assert.equal(model.chooseModel({ text: "a".repeat(281), hits: [{ id: 1 }], luna, sol, lunaEnabled: true }).tier, "sol");
});

test("known unhealthy gateway model ids migrate to current cost-effective routes", async () => {
  const previous = {
    luna: process.env.ADVISOR_MODEL_LUNA,
    sol: process.env.ADVISOR_MODEL_SOL,
  };
  try {
    process.env.ADVISOR_MODEL_LUNA = "anthropic/claude-haiku-5.5";
    process.env.ADVISOR_MODEL_SOL = "deepseek/deepseek-v4-flash";
    const model = await loadModel();
    assert.equal(model.ADVISOR_MODELS.LUNA, "gpt-6-luna");
    assert.equal(model.ADVISOR_MODELS.SOL, "gpt-6.1-terra");
  } finally {
    if (previous.luna == null) delete process.env.ADVISOR_MODEL_LUNA; else process.env.ADVISOR_MODEL_LUNA = previous.luna;
    if (previous.sol == null) delete process.env.ADVISOR_MODEL_SOL; else process.env.ADVISOR_MODEL_SOL = previous.sol;
  }
});

test("public flags expose storage_policy instead of blanket store:false", async () => {
  const prevBase = process.env.ADVISOR_OPENAI_BASE_URL;
  const prevMode = process.env.ADVISOR_OPENAI_API_MODE;
  const prevPolicy = process.env.ADVISOR_STORAGE_POLICY;
  try {
    process.env.ADVISOR_OPENAI_BASE_URL = "https://aiberm.com/v1";
    process.env.ADVISOR_OPENAI_API_MODE = "chat";
    delete process.env.ADVISOR_STORAGE_POLICY;
    const flags = await loadFlags();
    const pub = flags.getPublicFlags();
    assert.equal(pub.storage_policy, "provider_contract_required");
    assert.equal(pub.store_requested, false);
    assert.equal(pub.lumino_conversation_store, false);
    assert.equal(pub.api_base_host, "aiberm.com");
    assert.equal(pub.api_mode, "chat");
    assert.equal(Object.prototype.hasOwnProperty.call(pub, "store"), false);

    process.env.ADVISOR_OPENAI_BASE_URL = "https://api.openai.com/v1";
    process.env.ADVISOR_OPENAI_API_MODE = "responses";
    const official = (await loadFlags()).getPublicFlags();
    assert.equal(official.storage_policy, "api_no_store");
    assert.equal(official.store_requested, true);
    assert.equal(official.api_base_host, "api.openai.com");
    assert.equal(official.api_mode, "responses");
  } finally {
    if (prevBase == null) delete process.env.ADVISOR_OPENAI_BASE_URL; else process.env.ADVISOR_OPENAI_BASE_URL = prevBase;
    if (prevMode == null) delete process.env.ADVISOR_OPENAI_API_MODE; else process.env.ADVISOR_OPENAI_API_MODE = prevMode;
    if (prevPolicy == null) delete process.env.ADVISOR_STORAGE_POLICY; else process.env.ADVISOR_STORAGE_POLICY = prevPolicy;
  }
});

test("generateGroundedAnswer maps gateway 401/429/500 and does not send store:false on aiberm", async () => {
  const prev = {
    key: process.env.ADVISOR_OPENAI_API_KEY,
    base: process.env.ADVISOR_OPENAI_BASE_URL,
    mode: process.env.ADVISOR_OPENAI_API_MODE,
    luna: process.env.ADVISOR_MODEL_LUNA,
    sol: process.env.ADVISOR_MODEL_SOL,
    lunaEnabled: process.env.ADVISOR_LUNA_ENABLED,
    enabled: process.env.ADVISOR_MODEL_ENABLED,
  };
  process.env.ADVISOR_OPENAI_API_KEY = "sk-test";
  process.env.ADVISOR_OPENAI_BASE_URL = "https://aiberm.com/v1/";
  process.env.ADVISOR_OPENAI_API_MODE = "chat";
  process.env.ADVISOR_MODEL_LUNA = "luna-mock";
  process.env.ADVISOR_MODEL_SOL = "sol-mock";
  process.env.ADVISOR_LUNA_ENABLED = "1";
  process.env.ADVISOR_MODEL_ENABLED = "1";

  const originalFetch = globalThis.fetch;
  const hits = [{
    title: "CBAM vs PCF",
    url: "/knowledge/article?id=cbam-vs-pcf",
    lead: "Different deliverables.",
    excerpt: "Do not reuse one spreadsheet.",
    serviceId: "cbam",
  }];

  async function withStatus(status) {
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.store, undefined, "third-party chat must not send store:false");
      assert.match(String(url), /chat\/completions$/);
      assert.equal(String(url).endsWith("/"), false);
      return {
        ok: false,
        status,
        text: async () => `err-${status}`,
        json: async () => ({ error: { message: `err-${status}` } }),
      };
    };
    const model = await loadModel();
    await assert.rejects(
      () => model.generateGroundedAnswer({ text: "What is CBAM briefly?", lang: "en", hits }),
      (err) => String(err.message).includes(`model_http_${status}`),
    );
  }

  try {
    await withStatus(401);
    await withStatus(429);
    await withStatus(500);

    // Happy path + JSON fence + Luna selection
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.model, "luna-mock");
      assert.equal(body.store, undefined);
      assert.equal(body.temperature, undefined);
      assert.equal(body.max_tokens, undefined);
      assert.equal(body.response_format, undefined);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            finish_reason: "stop",
            message: {
              content: "```json\n{\"intent\":\"x\",\"answer\":\"ok\",\"confidence\":\"medium\",\"next_question\":null,\"primary_service_id\":\"cbam\",\"secondary_service_id\":null,\"handoff\":\"none\"}\n```",
            },
          }],
        }),
      };
    };
    const model = await loadModel();
    const out = await model.generateGroundedAnswer({ text: "What is CBAM briefly?", lang: "en", hits });
    assert.equal(out.answer, "ok");
    assert.equal(out.runtime_model.storage_policy, "provider_contract_required");
    assert.equal(out.runtime_model.store_requested, false);
    assert.equal(out.runtime_model.id, "luna-mock");

    // Sol selection
    let sawSol = false;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      sawSol = body.model === "sol-mock";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            finish_reason: "stop",
            message: {
              content: "{\"intent\":\"x\",\"answer\":\"diff\",\"confidence\":\"medium\",\"next_question\":null,\"primary_service_id\":\"cbam\",\"secondary_service_id\":\"pcf\",\"handoff\":\"none\"}",
            },
          }],
        }),
      };
    };
    const solOut = await (await loadModel()).generateGroundedAnswer({
      text: "Please compare CBAM versus PCF in detail",
      lang: "en",
      hits,
    });
    assert.equal(sawSol, true);
    assert.equal(solOut.runtime_model.id, "sol-mock");
    assert.equal(solOut.runtime_model.tier, "sol");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      ADVISOR_OPENAI_API_KEY: prev.key,
      ADVISOR_OPENAI_BASE_URL: prev.base,
      ADVISOR_OPENAI_API_MODE: prev.mode,
      ADVISOR_MODEL_LUNA: prev.luna,
      ADVISOR_MODEL_SOL: prev.sol,
      ADVISOR_LUNA_ENABLED: prev.lunaEnabled,
      ADVISOR_MODEL_ENABLED: prev.enabled,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("generateGeneralAnswer uses model capability when no published source matches", async () => {
  const previous = {
    key: process.env.ADVISOR_OPENAI_API_KEY,
    base: process.env.ADVISOR_OPENAI_BASE_URL,
    mode: process.env.ADVISOR_OPENAI_API_MODE,
    luna: process.env.ADVISOR_MODEL_LUNA,
    enabled: process.env.ADVISOR_MODEL_ENABLED,
  };
  process.env.ADVISOR_OPENAI_API_KEY = "sk-test";
  process.env.ADVISOR_OPENAI_BASE_URL = "https://aiberm.com/v1";
  process.env.ADVISOR_OPENAI_API_MODE = "chat";
  process.env.ADVISOR_MODEL_LUNA = "luna-general-mock";
  process.env.ADVISOR_MODEL_SOL = "sol-general-mock";
  process.env.ADVISOR_MODEL_ENABLED = "1";
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.model, "sol-general-mock");
      assert.equal(body.store, undefined);
      assert.equal(body.temperature, undefined);
      assert.equal(body.max_tokens, undefined);
      const system = body.messages[0].content;
      const user = body.messages[1].content;
      assert.match(system, /运用自身能力直接回答/);
      assert.match(system, /司法辖区|辖区/);
      assert.match(system, /不能只说无法确认/);
      assert.match(user, /没有匹配到已发布资料/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                intent: "regulatory_guidance",
                answer: "按 2026-11-09 的参考时点，可以先核对产品、辖区和报告用途。",
                confidence: "medium",
                next_question: "产品将进入哪个市场？",
                primary_service_id: "cbam",
                secondary_service_id: null,
                handoff: "none",
              }),
            },
          }],
        }),
      };
    };
    const output = await (await loadModel()).generateGeneralAnswer({
      text: "这个新的法规要求怎么判断？",
      lang: "zh",
    });
    assert.equal(output.answer_mode, "general_model");
    assert.equal(output.sources.length, 0);
    assert.equal(output.runtime_model.id, "sol-general-mock");
    assert.equal(output.service_matches[0]?.service_id, "cbam");
    assert.match(output.answer, /2026-11-09/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      ADVISOR_OPENAI_API_KEY: previous.key,
      ADVISOR_OPENAI_BASE_URL: previous.base,
      ADVISOR_OPENAI_API_MODE: previous.mode,
      ADVISOR_MODEL_LUNA: previous.luna,
      ADVISOR_MODEL_SOL: previous.sol,
      ADVISOR_MODEL_ENABLED: previous.enabled,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("portal model prompt uses sanitized context without claiming authority or execution", async () => {
  const previous = {
    key: process.env.ADVISOR_OPENAI_API_KEY,
    base: process.env.ADVISOR_OPENAI_BASE_URL,
    mode: process.env.ADVISOR_OPENAI_API_MODE,
    enabled: process.env.ADVISOR_MODEL_ENABLED,
  };
  process.env.ADVISOR_OPENAI_API_KEY = "sk-test";
  process.env.ADVISOR_OPENAI_BASE_URL = "https://aiberm.com/v1";
  process.env.ADVISOR_OPENAI_API_MODE = "chat";
  process.env.ADVISOR_MODEL_ENABLED = "1";
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.match(body.messages[0].content, /Portal 的 CBAM 助手/);
      assert.match(body.messages[0].content, /不得声称已读取文件、修改数据、执行工作流/);
      assert.match(body.messages[1].content, /CASE-CBAM-2026/);
      assert.match(body.messages[1].content, /PKG-2026-Q3/);
      assert.match(body.messages[1].content, /assistant: 上一轮回答/);
      assert.doesNotMatch(body.messages[1].content, /must-not-reach-model/);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
          intent: "portal_context_qa",
          answer: "当前定位到 2026 Q3 数据收集对象；先核对监测计划要求与材料缺口。",
          confidence: "medium",
          next_question: "需要查看哪类材料？",
          primary_service_id: "cbam",
          secondary_service_id: null,
          handoff: "none",
        }) } }] }),
      };
    };
    const model = await loadModel();
    const out = await model.generateGeneralAnswer({
      text: "这个季度还缺什么？",
      lang: "zh",
      request: {
        surface: "portal",
        taskMode: "ask",
        asOf: "2026-11-20",
        history: [{ role: "assistant", text: "上一轮回答" }],
        context: {
          annualProjectId: "CASE-CBAM-2026",
          serviceYear: "2026",
          workstream: "data_collection",
          objectRef: { type: "quarterlyPackage", id: "PKG-2026-Q3", revision: "3" },
          period: { quarter: "Q3" },
        },
      },
    });
    assert.match(out.answer, /2026 Q3/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      ADVISOR_OPENAI_API_KEY: previous.key,
      ADVISOR_OPENAI_BASE_URL: previous.base,
      ADVISOR_OPENAI_API_MODE: previous.mode,
      ADVISOR_MODEL_ENABLED: previous.enabled,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("official responses mode may request store:false under api_no_store", async () => {
  const prev = {
    key: process.env.ADVISOR_OPENAI_API_KEY,
    base: process.env.ADVISOR_OPENAI_BASE_URL,
    mode: process.env.ADVISOR_OPENAI_API_MODE,
    luna: process.env.ADVISOR_MODEL_LUNA,
    enabled: process.env.ADVISOR_MODEL_ENABLED,
  };
  process.env.ADVISOR_OPENAI_API_KEY = "sk-test";
  process.env.ADVISOR_OPENAI_BASE_URL = "https://api.openai.com/v1";
  process.env.ADVISOR_OPENAI_API_MODE = "responses";
  process.env.ADVISOR_MODEL_LUNA = "gpt-4.1-mini";
  process.env.ADVISOR_MODEL_ENABLED = "1";
  const originalFetch = globalThis.fetch;
  try {
    let storeFlag;
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /\/responses$/);
      const body = JSON.parse(init.body);
      storeFlag = body.store;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          output_text: "{\"intent\":\"x\",\"answer\":\"ok\",\"confidence\":\"medium\",\"next_question\":null,\"primary_service_id\":\"cbam\",\"secondary_service_id\":null,\"handoff\":\"none\"}",
        }),
      };
    };
    const model = await loadModel();
    const out = await model.generateGroundedAnswer({
      text: "What is CBAM?",
      lang: "en",
      hits: [{
        title: "CBAM",
        url: "/knowledge/article?id=cbam",
        lead: "Import compliance",
        excerpt: "Not PCF",
      }],
    });
    assert.equal(storeFlag, false);
    assert.equal(out.runtime_model.storage_policy, "api_no_store");
    assert.equal(out.runtime_model.store_requested, true);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      ADVISOR_OPENAI_API_KEY: prev.key,
      ADVISOR_OPENAI_BASE_URL: prev.base,
      ADVISOR_OPENAI_API_MODE: prev.mode,
      ADVISOR_MODEL_LUNA: prev.luna,
      ADVISOR_MODEL_ENABLED: prev.enabled,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
