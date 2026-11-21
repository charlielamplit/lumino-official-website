const test = require("node:test");
const assert = require("node:assert/strict");
const intake = require("../domain/intake-model.js");

const request = { id: "MR-1", tenantId: "TNT-0018", status: "READY" };
const evidence = { evidenceId: "EVD-1", requestId: "MR-1", tenantId: "TNT-0018" };
const candidate = { id: "CAND-1", revision: 1, status: "READY_FOR_REVIEW", requestId: "MR-1", evidenceId: "EVD-1", tenantId: "TNT-0018" };

test("named owner can confirm the current candidate revision", () => {
  assert.doesNotThrow(() => intake.assertConfirmAllowed({ candidate, evidence, request, actor: { actor: "周岚", role: "customer_owner", tenantId: "TNT-0018" }, expectedRevision: 1 }));
});

test("contributor, wrong tenant and rejected candidate cannot confirm", () => {
  assert.throws(() => intake.assertConfirmAllowed({ candidate, evidence, request, actor: { actor: "孙悦", role: "customer_contrib", tenantId: "TNT-0018" }, expectedRevision: 1 }), (error) => error.code === "FORBIDDEN");
  assert.throws(() => intake.assertConfirmAllowed({ candidate, evidence, request, actor: { actor: "周岚", role: "customer_owner", tenantId: "TNT-X" }, expectedRevision: 1 }), (error) => error.code === "TENANT_MISMATCH");
  assert.throws(() => intake.assertConfirmAllowed({ candidate: { ...candidate, status: "REJECTED" }, evidence, request, actor: { actor: "周岚", role: "customer_owner", tenantId: "TNT-0018" }, expectedRevision: 1 }), (error) => error.code === "CANDIDATE_NOT_CONFIRMABLE");
});
