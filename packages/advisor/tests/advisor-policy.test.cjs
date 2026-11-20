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

test("sanitizeRequest keeps only the portal context needed for model orientation", async () => {
  const policy = await loadPolicy();
  const result = policy.sanitizeRequest({
    surface: "portal",
    taskMode: "draft",
    text: "起草本季度缺口说明",
    context: {
      tenantId: "must-not-reach-model",
      conversationId: "must-not-reach-model",
      serviceId: "cbam",
      annualProjectId: "CASE-CBAM-2026",
      serviceYear: "2026",
      workstream: "data_collection",
      objectRef: { type: "quarterlyPackage", id: "PKG-2026-Q3", revision: 3, secret: "drop" },
      period: { quarter: "Q3" },
      pageId: "data",
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.request.surface, "portal");
  assert.equal(result.request.taskMode, "draft");
  assert.deepEqual(result.request.context, {
    serviceId: "cbam",
    annualProjectId: "CASE-CBAM-2026",
    serviceYear: "2026",
    workstream: "data_collection",
    objectRef: { type: "quarterlyPackage", id: "PKG-2026-Q3", revision: "3" },
    period: { quarter: "Q3" },
    pageId: "data",
  });
  assert.equal("tenantId" in result.request.context, false);
  assert.equal("conversationId" in result.request.context, false);
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
  assert.deepEqual(Object.keys(fields).sort(), ["answer_mode", "confidence", "handoff", "has_sources", "intent", "latency_ms", "model_tier", "source"]);
  assert.equal("text" in fields, false);
  assert.equal("answer" in fields, false);
});
