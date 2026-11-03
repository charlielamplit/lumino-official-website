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

test("chooseModel routes Luna vs Sol", async () => {
  const model = await loadModel();
  const luna = "luna-test-model";
  const sol = "sol-test-model";
  assert.deepEqual(model.chooseModel({ text: "What is CBAM?", hits: [{ id: 1 }], luna, sol }), {
    id: luna,
    tier: "luna",
  });
  assert.deepEqual(model.chooseModel({ text: "Please compare CBAM versus PCF", hits: [{ id: 1 }], luna, sol }), {
    id: sol,
    tier: "sol",
  });
  assert.equal(model.chooseModel({ text: "x", hits: [{}, {}, {}], luna, sol }).tier, "sol");
  assert.equal(model.chooseModel({ text: "a".repeat(281), hits: [{ id: 1 }], luna, sol }).tier, "sol");
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
    enabled: process.env.ADVISOR_MODEL_ENABLED,
  };
  process.env.ADVISOR_OPENAI_API_KEY = "sk-test";
  process.env.ADVISOR_OPENAI_BASE_URL = "https://aiberm.com/v1/";
  process.env.ADVISOR_OPENAI_API_MODE = "chat";
  process.env.ADVISOR_MODEL_LUNA = "luna-mock";
  process.env.ADVISOR_MODEL_SOL = "sol-mock";
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
      assert.equal(body.response_format?.type, "json_object");
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
      ADVISOR_MODEL_ENABLED: prev.enabled,
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
