const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CASES = path.join(ROOT, "packages/advisor/evals/cases.json");

test("advisor eval set defines at least 120 cases with required expectation fields", () => {
  const suite = JSON.parse(fs.readFileSync(CASES, "utf8"));
  assert.ok(suite.cases.length >= 120);
  for (const item of suite.cases) {
    assert.ok(item.id);
    assert.ok(item.expect);
    assert.ok(Array.isArray(item.expect.answer_modes) && item.expect.answer_modes.length);
    assert.ok(Array.isArray(item.expect.forbidden_patterns));
    assert.ok(["fixed", "tool", "knowledge", "none", "any"].includes(item.expect.source_category));
    assert.ok(item.expect.allowed_services);
    assert.ok(["none", "contact", "expert_required", null].includes(item.expect.handoff) || item.expect.handoff === undefined);
  }
});

test("advisor regression eval passes with zero critical failures", () => {
  const out = path.join(ROOT, "packages/advisor/evals/.last-report.json");
  const result = spawnSync(process.execPath, ["scripts/advisor-eval.mjs", CASES, "--out", out], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
  }
  assert.equal(result.status, 0, "advisor eval failed");
  const report = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(report.summary.critical_failures, 0);
  assert.equal(report.summary.failed, 0);
  assert.ok(report.summary.metrics.no_model_resolution_rate >= 0);
  assert.ok(report.summary.metrics.tool_route_rate >= 0);
  assert.ok(report.summary.metrics.stop_without_sources_rate >= 0);
});
