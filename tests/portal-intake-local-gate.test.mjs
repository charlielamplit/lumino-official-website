import test from "node:test";
import assert from "node:assert/strict";
import extractHandler from "../api/_lib/portal-intake-local.js";
import recordHandler from "../api/_lib/portal-intake-record-local.js";

for (const [name, handler] of [["extract", extractHandler], ["record", recordHandler]]) {
  test(`${name} preview handler refuses requests outside the loopback router`, async () => {
    const response = {
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ method: "POST", headers: { "content-type": "application/json" }, body: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { error: "not_found" });
  });
}
