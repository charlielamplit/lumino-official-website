import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/precursors.js";
import { issueCalculatorAiAccess, verifyCalculatorAiAccess } from "../api/_lib/calculator-ai-access.js";

function response() {
  return {
    statusCode: 200,
    body: "",
    setHeader() {},
    end(body) { this.body = body; },
  };
}

test("AI precursor endpoint requires a saved-lead grant scoped to the CN code", async () => {
  const before = process.env.CALCULATOR_AI_ACCESS_SECRET;
  process.env.CALCULATOR_AI_ACCESS_SECRET = "test-only-calculator-access-secret";
  try {
    const token = issueCalculatorAiAccess("LM-20261124-0001", "26011200");
    assert.equal(verifyCalculatorAiAccess(token, "26011200"), true);
    assert.equal(verifyCalculatorAiAccess(token, "72189980"), false);
    assert.equal(verifyCalculatorAiAccess(`${token}x`, "26011200"), false);

    const denied = response();
    await handler({ method: "POST", headers: {}, body: { cnCode: "26011200" } }, denied);
    assert.equal(denied.statusCode, 403);

    const allowed = response();
    await handler({ method: "POST", headers: { "x-calculator-ai-token": token }, body: { cnCode: "26011200" } }, allowed);
    assert.equal(allowed.statusCode, 200);
    const result = JSON.parse(allowed.body);
    assert.deepEqual(result.precursors, []);
    assert.equal(result.meta.noPrecursorReason, "upstream");
  } finally {
    if (before === undefined) delete process.env.CALCULATOR_AI_ACCESS_SECRET;
    else process.env.CALCULATOR_AI_ACCESS_SECRET = before;
  }
});
