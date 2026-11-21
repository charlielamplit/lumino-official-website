const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function load() {
  return import(pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-services.js")).href);
}

async function loadTiming() {
  const file = pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-timing.js")).href;
  return import(`${file}?t=${Date.now()}-${Math.random()}`);
}

test("service id allowlist drops unknown model suggestions", async () => {
  const mod = await load();
  assert.equal(mod.sanitizeServiceId("cbam"), "cbam");
  assert.equal(mod.sanitizeServiceId("not-a-service"), null);
  const matches = mod.sanitizeServiceMatches([
    { service_id: "cbam", reason: "a" },
    { service_id: "made-up", reason: "b" },
    { service_id: "pcf", reason: "c" },
    { service_id: "cbam", reason: "dup" },
  ]);
  assert.deepEqual(matches.map((item) => item.service_id), ["cbam", "pcf"]);
});

test("legacy production timeout defaults migrate to the observed stable budget", async () => {
  const previous = {
    client: process.env.ADVISOR_CLIENT_TIMEOUT_MS,
    model: process.env.ADVISOR_MODEL_TIMEOUT_MS,
    luna: process.env.ADVISOR_LUNA_TIMEOUT_MS,
    sol: process.env.ADVISOR_SOL_TIMEOUT_MS,
  };
  try {
    process.env.ADVISOR_CLIENT_TIMEOUT_MS = "15000";
    process.env.ADVISOR_MODEL_TIMEOUT_MS = "12000";
    process.env.ADVISOR_LUNA_TIMEOUT_MS = "12000";
    process.env.ADVISOR_SOL_TIMEOUT_MS = "12000";
    const timing = await loadTiming();
    assert.equal(timing.clientTimeoutMs(), 22000);
    assert.equal(timing.modelTimeoutMs("luna"), 18000);
    assert.equal(timing.modelTimeoutMs("sol"), 18000);
  } finally {
    for (const [key, value] of Object.entries({
      ADVISOR_CLIENT_TIMEOUT_MS: previous.client,
      ADVISOR_MODEL_TIMEOUT_MS: previous.model,
      ADVISOR_LUNA_TIMEOUT_MS: previous.luna,
      ADVISOR_SOL_TIMEOUT_MS: previous.sol,
    })) {
      if (value == null) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("model timeout stays strictly below client timeout", async () => {
  const timing = await loadTiming();
  assert.ok(timing.modelTimeoutMs() < timing.clientTimeoutMs());
  assert.ok(timing.clientTimeoutMs() - timing.modelTimeoutMs() >= 1500);
});
