const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { extractEnergyInvoice } = require("../domain/energy-invoice-extractor.js");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "../fixtures/energy-invoices", name));
const meta = (id) => ({ evidenceId: id, requestId: "MR-1", tenantId: "TNT-0018", annualCaseId: "CASE-1", year: "2026", quarter: "Q3", contentSha256: id });

test("two fixture bills yield different candidates", () => {
  const a = extractEnergyInvoice({ evidenceMeta: meta("EVD-A"), bytes: fixture("bill-a-18420.txt"), facilityAssetId: "FAC-JS-02", caseId: "CASE-1" });
  const b = extractEnergyInvoice({ evidenceMeta: meta("EVD-B"), bytes: fixture("bill-b-22100.csv"), facilityAssetId: "FAC-JS-02", caseId: "CASE-1" });
  assert.equal(a.candidate.proposedPatch.originalValue, "18420");
  assert.equal(b.candidate.proposedPatch.originalValue, "22100");
  assert.notEqual(a.candidate.id, b.candidate.id);
  assert.equal(a.candidate.status, "READY_FOR_REVIEW");
});

test("unparseable bytes never invent a default", () => {
  const result = extractEnergyInvoice({ evidenceMeta: meta("EVD-X"), bytes: Buffer.from("hello"), facilityAssetId: "FAC-JS-02", caseId: "CASE-1" });
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.warnings, ["UNPARSEABLE_INVOICE"]);
});
