const test = require("node:test");
const assert = require("node:assert/strict");
const intake = require("../domain/intake-model.js");

const request = { id: "MR-CBAM-2026-Q3-E02", status: "READY", tenantId: "TNT-0018", year: "2026", quarter: "Q3" };
const evidence = { evidenceId: "EVD-1", requestId: request.id, tenantId: "TNT-0018" };
const candidate = { id: "CAND-1", revision: 2, status: "READY_FOR_REVIEW", tenantId: "TNT-0018", requestId: request.id, evidenceId: evidence.evidenceId };
const actor = { actor: "周岚", role: "customer_owner", tenantId: "TNT-0018" };

test("evidence id embeds request id and content digest", () => {
  const id = intake.buildEvidenceId({ year: "2026", quarter: "Q3", requestId: request.id, contentSha256: "abc123" });
  assert.match(id, /MR-CBAM-2026-Q3-E02/);
  assert.match(id, /abc123/);
});

test("upload accepts only non-empty TXT or CSV demo fixtures", () => {
  assert.doesNotThrow(() => intake.assertUploadAllowed(request, { name: "bill.csv", size: 20, year: "2026", quarter: "Q3" }));
  assert.throws(() => intake.assertUploadAllowed(request, { name: "bill.pdf", size: 20 }), (error) => error.code === "UNSUPPORTED_FILE_TYPE");
  assert.throws(() => intake.assertUploadAllowed(null, { name: "bill.txt", size: 20 }), (error) => error.code === "MATERIAL_REQUEST_REQUIRED");
});

test("confirm enforces revision, tenant and real role", () => {
  assert.doesNotThrow(() => intake.assertConfirmAllowed({ candidate, evidence, request, actor, expectedRevision: 2 }));
  assert.throws(() => intake.assertConfirmAllowed({ candidate, evidence, request, actor, expectedRevision: 1 }), (error) => error.code === "CANDIDATE_REVISION_STALE");
  assert.throws(() => intake.assertConfirmAllowed({ candidate, evidence, request, actor: { ...actor, role: "customer_contrib" }, expectedRevision: 2 }), (error) => error.code === "FORBIDDEN");
  assert.throws(() => intake.assertConfirmAllowed({ candidate, evidence, request, actor: { ...actor, tenantId: "TNT-OTHER" }, expectedRevision: 2 }), (error) => error.code === "TENANT_MISMATCH");
});

test("candidate store retains versioned lineage and does not reveal other tenants", () => {
  const store = intake.createMemoryCandidateStore({ clock: () => Date.parse("2026-11-21T00:00:00Z") });
  const first = store.put({ ...candidate, revision: 1, year: "2026", quarter: "Q3", annualCaseId: "CASE-CBAM-2026", proposedPatch: { originalValue: "18420" }, extractorVersion: "v1", createdBy: "Agent" });
  const second = store.put({ ...first, proposedPatch: { originalValue: "22100" } });
  assert.equal(second.revision, 2);
  assert.equal(store.get({ candidateId: first.id, tenantId: "TNT-OTHER" }), null);
  assert.equal(store.latest({ requestId: request.id, tenantId: "TNT-0018", year: "2026", quarter: "Q3" }).proposedPatch.originalValue, "22100");
});

test("latest candidate follows the most recent evidence for one request", () => {
  const store = intake.createMemoryCandidateStore();
  store.put({ ...candidate, id: "CAND-A", evidenceId: "EVD-A", revision: 1, year: "2026", quarter: "Q3", proposedPatch: { originalValue: "18420" } });
  store.put({ ...candidate, id: "CAND-B", evidenceId: "EVD-B", revision: 1, year: "2026", quarter: "Q3", proposedPatch: { originalValue: "22100" } });
  assert.equal(store.latest({ requestId: request.id, tenantId: "TNT-0018", year: "2026", quarter: "Q3" }).id, "CAND-B");
});

test("request projection follows evidence and candidate state", () => {
  assert.equal(intake.projectRequestStatus({ workPackage: request }), "READY");
  assert.equal(intake.projectRequestStatus({ workPackage: request, evidence }), "SUBMITTED");
  assert.equal(intake.projectRequestStatus({ workPackage: request, evidence, candidate }), "AWAITING_CONFIRMATION");
  assert.equal(intake.projectRequestStatus({ workPackage: request, evidence, candidate, fact: { status: "CONFIRMED", metadata: { evidenceId: evidence.evidenceId } } }), "CONFIRMED");
});
