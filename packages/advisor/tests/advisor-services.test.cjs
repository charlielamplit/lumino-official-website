const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function load() {
  return import(pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-services.js")).href);
}

async function loadTiming() {
  return import(pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-timing.js")).href);
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

test("model timeout stays strictly below client timeout", async () => {
  const timing = await loadTiming();
  assert.ok(timing.modelTimeoutMs() < timing.clientTimeoutMs());
  assert.ok(timing.clientTimeoutMs() - timing.modelTimeoutMs() >= 1500);
});
