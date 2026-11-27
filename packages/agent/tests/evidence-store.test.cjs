const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryEvidenceStore, sha256 } = require("../domain/evidence-store.js");

const actor = { actor: "周岚", role: "customer_owner", tenantId: "TNT-0018" };

test("put stores bytes under a stable request and digest id", async () => {
  const store = createMemoryEvidenceStore({ clock: () => Date.parse("2026-11-21T00:00:00Z") });
  const bytes = new TextEncoder().encode("NATURAL_GAS_NM3=18420\n");
  const input = { requestId: "MR-1", annualCaseId: "CASE-1", year: "2026", quarter: "Q3", filename: "a.txt", mediaType: "text/plain", bytes, tenantId: "TNT-0018", actor };
  const first = await store.put(input);
  const again = await store.put({ ...input, filename: "copy.txt" });
  assert.equal(first.evidenceId, again.evidenceId);
  assert.equal(first.contentSha256, await sha256(bytes));
  assert.deepEqual(store.getBytes({ evidenceId: first.evidenceId, tenantId: "TNT-0018", actor }), bytes);
});

test("evidence lookup hides objects from another tenant", async () => {
  const store = createMemoryEvidenceStore();
  const record = await store.put({ requestId: "MR-1", year: "2026", quarter: "Q3", filename: "a.txt", bytes: new TextEncoder().encode("x"), tenantId: "TNT-0018", actor });
  const other = { actor: "Other", role: "customer_owner", tenantId: "TNT-OTHER" };
  assert.equal(store.get({ evidenceId: record.evidenceId, tenantId: "TNT-OTHER", actor: other }), null);
  assert.equal(store.getBytes({ evidenceId: record.evidenceId, tenantId: "TNT-OTHER", actor: other }), null);
});

test("same invoice bytes under another facility create a distinct evidence and candidate", async () => {
  const store = createMemoryEvidenceStore();
  const bytes = new TextEncoder().encode("NATURAL_GAS_NM3=22100\n");
  const input = { requestId: "MR-1", annualCaseId: "CASE-1", year: "2026", quarter: "Q3", filename: "bill.csv", bytes, tenantId: "TNT-0018", actor };
  const first = await store.put({ ...input, facilityAssetId: "FAC-A" });
  const second = await store.put({ ...input, facilityAssetId: "FAC-B" });
  assert.notEqual(first.evidenceId, second.evidenceId);
  assert.equal(store.get({ evidenceId: first.evidenceId, tenantId: "TNT-0018", actor }).facilityAssetId, "FAC-A");
  assert.equal(store.get({ evidenceId: second.evidenceId, tenantId: "TNT-0018", actor }).facilityAssetId, "FAC-B");
});
