const test = require("node:test");
const assert = require("node:assert/strict");

const { WorkflowEngine, createMemoryStorage } = require("../packages/agent/domain/workflow-engine.js");
const { AssetRegistry } = require("../packages/agent/domain/data-asset-engine.js");
const AssetViewModel = require("../apps/portal/runtime/asset-view-model.js");
const SharedCenterViewModel = require("../apps/portal/runtime/shared-center-view-model.js");

function fixture() {
  const workflow = new WorkflowEngine({ storage: createMemoryStorage(), clock: () => Date.parse("2026-10-27T08:00:00Z") });
  workflow.seed([
    { id: "FACT-2026-Q3-GAS", type: "fact", status: "MISSING", tenantId: "TNT-0018", owner: "陈浩", scope: "江苏二厂天然气用量", metadata: { serviceId: "cbam", facilityAssetId: "FAC-GENERAL" } },
    { id: "FND-001", type: "finding", status: "OPEN", tenantId: "TNT-0018", owner: "周岚", scope: "CBAM 数据缺口", metadata: { serviceId: "cbam" } },
    { id: "AP-001", type: "approval", status: "IN_REVIEW", tenantId: "TNT-0018", owner: "赵海峰", scope: "默认值并行路径", metadata: { serviceId: "cbam" } },
    { id: "PKG-001", type: "quarterlyPackage", status: "COLLECTING", tenantId: "TNT-0018", owner: "周岚", year: "2026", quarter: "Q3", scope: "NordWerk GmbH", metadata: { serviceId: "cbam" } },
    { id: "OER-001-R1", type: "formalArtifact", status: "INTERNAL_REVIEW", tenantId: "TNT-0018", owner: "王晨", year: "2026", scope: "上海一厂", metadata: { serviceId: "cbam", artifactType: "OPERATOR_EMISSIONS_REPORT", facilityAssetId: "FAC-GENERAL" } },
    { id: "PCF-001", type: "serviceCase", status: "SCOPING", tenantId: "TNT-0018", owner: "周岚", scope: "热轧卷", metadata: { serviceId: "pcf", productId: "PRD-GENERAL" } },
    { id: "OTHER-TENANT", type: "quarterlyPackage", status: "COLLECTING", tenantId: "TNT-OTHER", owner: "其他企业", scope: "不应可见", metadata: { serviceId: "cbam" } },
  ]);

  const registry = new AssetRegistry({ storage: createMemoryStorage(), clock: () => Date.parse("2026-10-27T08:00:00Z") });
  registry.seed({ assets: [
    { id: "FAC-GENERAL", type: "facility", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-1", name: "普通设施", access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true }, steward: { assignedRole: "customer_contrib" } },
    { id: "PRD-GENERAL", type: "product", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-1", name: "普通产品", access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true } },
    { id: "FAC-RESTRICTED", type: "facility", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-1", name: "受限设施", access: { confidentiality: "highly_sensitive", visibility: "restricted", allowedRoles: ["customer_approver"], metadataVisible: true } },
  ] });
  const assetViews = AssetViewModel.create(registry, { tenantId: "TNT-0018" });
  const services = {
    cbam: { id: "cbam", code: "CBAM", name: "CBAM", roles: ["customer_admin", "customer_owner", "customer_contrib", "customer_approver"] },
    pcf: { id: "pcf", code: "PCF", name: "产品碳足迹 PCF", roles: ["customer_admin", "customer_owner", "customer_contrib", "customer_approver"] },
  };
  const views = SharedCenterViewModel.create({ workflow, assetViews, assetRegistry: registry, services }, { tenantId: "TNT-0018", referenceDate: "2026-10-27" });
  return { workflow, registry, views };
}

test("我的任务按当前角色投影而不是返回全量角色数组", () => {
  const { views } = fixture();
  const contributor = views.tasks({ role: "customer_contrib", actor: "陈浩" });
  const approver = views.tasks({ role: "customer_approver", actor: "赵海峰" });
  const owner = views.tasks({ role: "customer_owner", actor: "周岚" });

  assert.deepEqual(contributor.items.map((item) => item.sourceId), ["FACT-2026-Q3-GAS"]);
  assert.deepEqual(approver.items.map((item) => item.sourceId), ["AP-001"]);
  assert.deepEqual(new Set(owner.items.map((item) => item.sourceId)), new Set(["FND-001", "PKG-001", "PCF-001"]));
  assert.equal(owner.summary.services, 2);
  assert.equal(owner.items[0].due.tone, "danger");
});

test("任务与交付物排除其他租户和无权关联资产", () => {
  const { workflow, views } = fixture();
  const otherTenant = workflow.get("OTHER-TENANT");
  assert.equal(views.objectIsVisible(otherTenant, { role: "customer_owner" }), false);

  workflow.seed([{ id: "RESTRICTED-OER-R1", type: "formalArtifact", status: "DRAFT", tenantId: "TNT-0018", owner: "陈浩", scope: "受限设施", metadata: { serviceId: "cbam", artifactType: "OPERATOR_EMISSIONS_REPORT", facilityAssetId: "FAC-RESTRICTED", allowedRoles: ["customer_contrib"] } }]);
  assert.equal(views.objectIsVisible(workflow.get("RESTRICTED-OER-R1"), { role: "customer_contrib", actor: "陈浩" }), false);
  assert.equal(views.objectIsVisible(workflow.get("RESTRICTED-OER-R1"), { role: "customer_approver", actor: "赵海峰" }), true);
});

test("交付中心只展示工作流中真实存在的交付物", () => {
  const { views } = fixture();
  const result = views.deliverables({ role: "customer_owner", actor: "周岚" });
  assert.equal(result.items.some((item) => item.serviceId === "pcf"), false);
  assert.deepEqual(new Set(result.items.map((item) => item.id)), new Set(["PKG-001", "OER-001-R1"]));
  assert.equal(result.items.find((item) => item.id === "OER-001-R1").controls.approval, "复核中");
});

test("PCF 报告创建后携带快照和锁定控制状态进入交付中心", () => {
  const { workflow, views } = fixture();
  workflow.seed([{ id: "PCF-RPT-001-R1", type: "formalArtifact", status: "LOCKED", tenantId: "TNT-0018", owner: "PCF 专家", scope: "热轧卷", metadata: { serviceId: "pcf", artifactType: "PCF_REPORT", assetSnapshotId: "SNAP-PCF-001", calculationRunId: "RUN-PCF-001" } }]);
  const report = views.deliverables({ role: "customer_approver", actor: "赵海峰" }).items.find((item) => item.id === "PCF-RPT-001-R1");
  assert.ok(report);
  assert.equal(report.version, "Rev 1");
  assert.equal(report.snapshotId, "SNAP-PCF-001");
  assert.equal(report.controls.approval, "已批准");
  assert.equal(report.controls.lock, "已锁定");
  assert.equal(report.controls.delivery, "未交付");
});

test("数据贡献者不会自动获得企业受控交付物视图", () => {
  const { views } = fixture();
  const result = views.deliverables({ role: "customer_contrib", actor: "陈浩" });
  assert.equal(result.items.length, 0);
  assert.equal(result.summary.total, 0);
});

test("READY 的 Agent 提议进入我的任务，审批人不可见", () => {
  const AssetViewModel = require("../apps/portal/runtime/asset-view-model.js");
  const SharedCenterViewModel = require("../apps/portal/runtime/shared-center-view-model.js");
  const { AgentTaskEngine } = require("../packages/agent/runtime/agent-task-engine.js");
  const capabilities = require("../packages/agent/runtime/capability-catalog.js");

  const base = fixture();
  const agentTasks = new AgentTaskEngine({ storage: createMemoryStorage(), capabilities, clock: () => Date.parse("2026-10-27T08:00:00Z") });
  const submitted = agentTasks.submit({
    businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
    serialNo: "SER-SHARED-001",
    tenantId: "TNT-0018",
    caseId: "CBAM-2026-Q3",
    input: { fileName: "gas.pdf" },
  }, { actor: "陈浩" });
  agentTasks.markProcessing(submitted.id);
  agentTasks.complete(submitted.id, {
    proposals: [{ assetId: "REC-GAS-DEMO", targetAssetType: "energyConsumption", proposedPatch: { originalValue: "100" } }],
  });

  const views = SharedCenterViewModel.create({
    workflow: base.workflow,
    assetViews: AssetViewModel.create(base.registry, { tenantId: "TNT-0018" }),
    assetRegistry: base.registry,
    agentTasks,
    capabilities,
    services: {
      cbam: { id: "cbam", code: "CBAM", name: "CBAM", roles: ["customer_admin", "customer_owner", "customer_contrib", "customer_approver"] },
      pcf: { id: "pcf", code: "PCF", name: "产品碳足迹 PCF", roles: ["customer_admin", "customer_owner", "customer_contrib", "customer_approver"] },
    },
  }, { tenantId: "TNT-0018", referenceDate: "2026-10-27" });

  const owner = views.tasks({ role: "customer_owner", actor: "周岚" });
  const approver = views.tasks({ role: "customer_approver", actor: "赵海峰" });
  assert.ok(owner.items.some((item) => item.sourceType === "agentTask" && item.sourceId === submitted.id));
  assert.equal(approver.items.some((item) => item.sourceType === "agentTask"), false);
});
