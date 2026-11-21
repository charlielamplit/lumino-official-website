const test = require("node:test");
const assert = require("node:assert/strict");
const { AgentTaskEngine, createMemoryStorage } = require("../runtime/agent-task-engine.js");
const capabilities = require("../runtime/capability-catalog.js");
const { extractEnergyInvoice } = require("../domain/energy-invoice-extractor.js");

test("AgentTask completes from extracted evidence bytes as proposal_only", () => {
  assert.equal(capabilities.getCapability("CBAM_ENERGY_INVOICE_EXTRACT").ruleOrPromptVersion, "extract-gas@1.1.0");
  const engine = new AgentTaskEngine({ storage: createMemoryStorage(), capabilities });
  const task = engine.submit({ serialNo: "intake-1", businessType: "CBAM_ENERGY_INVOICE_EXTRACT", tenantId: "TNT-0018", caseId: "CASE-1", input: { evidenceId: "EVD-1" } }, { actor: "周岚" });
  const extracted = extractEnergyInvoice({
    evidenceMeta: { evidenceId: "EVD-1", requestId: "MR-1", tenantId: "TNT-0018", annualCaseId: "CASE-1", year: "2026", quarter: "Q3", contentSha256: "abc" },
    bytes: new TextEncoder().encode("NATURAL_GAS_NM3=22100"),
    facilityAssetId: "FAC-JS-02",
    caseId: "CASE-1",
  });
  engine.markProcessing(task.id);
  const completed = engine.complete(task.id, extracted);
  assert.equal(completed.status, "READY");
  assert.equal(completed.result.appliedAs, "proposal_only");
  assert.equal(completed.result.proposals[0].proposedPatch.originalValue, "22100");
});
