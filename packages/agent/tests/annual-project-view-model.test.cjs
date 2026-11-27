"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { WorkflowEngine, createMemoryStorage } = require("../domain/workflow-engine.js");
const { buildAnnualProjectView } = require("../domain/annual-project-view-model.js");

function createWorkflow() {
  const workflow = new WorkflowEngine({ storage: createMemoryStorage() });
  workflow.seed([
    { id: "CASE-CBAM-2031", type: "serviceCase", status: "COLLECTING", owner: "陈琳", year: "2031", metadata: { serviceId: "cbam", targetCloseDate: "2032-06-30", currentPeriod: "Q4", reviewer: "赵复核", wizardDraft: { importer: "Example Importer", firstDeadline: "2031-12-18", cadence: "annual", products: ["P-A", "P-B", "P-C"] }, members: [{ name: "陈琳", role: "客户确认" }] } },
    { id: "SCOPE-CBAM-2031", type: "annualInclusion", status: "IN_SCOPE", owner: "陈琳", year: "2031", revision: 7, metadata: { serviceId: "cbam", included: ["P-A", "P-B", "P-C"], excluded: ["P-D", "P-E"], facilityIds: ["F-1", "F-2", "F-3"], masterDataRevision: 7 } },
    { id: "MP-CBAM-2031-R4", type: "formalArtifact", status: "APPROVED", owner: "王专家", year: "2031", revision: 4, metadata: { serviceId: "cbam", artifactType: "MONITORING_PLAN" } },
    { id: "MR-1", type: "workPackage", status: "READY", owner: "陈琳", year: "2031", quarter: "Q4", metadata: { serviceId: "cbam", basis: "annual_scope_and_monitoring_draft" } },
    { id: "MR-2", type: "workPackage", status: "READY", owner: "陈琳", year: "2031", quarter: "Q4", metadata: { serviceId: "cbam", basis: "annual_scope_and_monitoring_draft" } },
  ]);
  return workflow;
}

test("annual project view is derived from project objects rather than template constants", () => {
  const view = buildAnnualProjectView({ workflow: createWorkflow(), year: "2031", quarter: "Q2", organizationName: "示例制造" });
  assert.equal(view.organizationName, "示例制造");
  assert.equal(view.project.id, "CASE-CBAM-2031");
  assert.equal(view.currentPeriod, "Q4");
  assert.equal(view.targetCloseLabel, "2032 Q2 末");
  assert.equal(view.nextMilestone, "12 月 18 日 · Example Importer");
  assert.equal(view.scope.includedCount, 3);
  assert.equal(view.scope.excludedCount, 2);
  assert.equal(view.scope.facilityCount, 3);
  assert.equal(view.scope.revision, 7);
  assert.equal(view.monitoringPlan.id, "MP-CBAM-2031-R4");
  assert.equal(view.monitoringPlan.revision, 4);
  assert.equal(view.materialRequests.count, 2);
  assert.equal(view.materialRequests.items.length, 2);
  assert.equal(view.materialRequests.items[0].status, "READY");
  assert.deepEqual(view.members, [{ name: "陈琳", role: "客户确认" }]);
});

test("verification state moves the lifecycle marker without changing display templates", () => {
  const workflow = createWorkflow();
  workflow.seed([{ id: "VER-2031-F1", type: "verification", status: "REMEDIATION", owner: "核查机构", year: "2031", metadata: { serviceId: "cbam" } }]);
  const view = buildAnnualProjectView({ workflow, year: "2031" });
  assert.equal(view.lifecycle.findIndex((item) => item.state === "current"), 3);
  assert.equal(view.lifecycle[3].label, "核查、Finding 整改与重算");
});
