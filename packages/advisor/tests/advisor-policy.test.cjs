const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function loadPolicy() {
  const file = pathToFileURL(path.resolve(__dirname, "../../../api/_lib/advisor-policy.js")).href;
  return import(file);
}

test("sanitizeRequest rejects oversized input and flags sensitive content", async () => {
  const policy = await loadPolicy();
  const long = policy.sanitizeRequest({ text: "a".repeat(2001), lang: "zh" });
  assert.equal(long.ok, false);
  assert.ok(long.errors.includes("input_too_long"));

  const sensitive = policy.sanitizeRequest({ text: "??? 13800138000", lang: "zh" });
  assert.equal(sensitive.ok, true);
  assert.equal(sensitive.sensitive, true);
  assert.equal(sensitive.request.text, "");
});

test("rate limit eventually blocks a noisy client key", async () => {
  const policy = await loadPolicy();
  const key = `test-${Date.now()}-${Math.random()}`;
  let blocked = false;
  for (let i = 0; i < policy.ADVISOR_LIMITS.RATE_LIMIT + 2; i += 1) {
    const result = policy.checkRateLimit(key);
    if (!result.ok) blocked = true;
  }
  assert.equal(blocked, true);
});

test("publicLogFields never includes raw question text", async () => {
  const policy = await loadPolicy();
  const fields = policy.publicLogFields({
    intent: "cbam_scope",
    answer_mode: "fixed",
    confidence: "high",
    handoff: "none",
    source: "deterministic",
  });
  assert.deepEqual(Object.keys(fields).sort(), ["answer_mode", "confidence", "handoff", "intent", "source"]);
});
