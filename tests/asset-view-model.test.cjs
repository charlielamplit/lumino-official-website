const test = require("node:test");
const assert = require("node:assert/strict");
const { AssetRegistry, createMemoryStorage } = require("../packages/agent/domain/data-asset-engine.js");
const { create } = require("../apps/portal/runtime/asset-view-model.js");

function fixture() {
  const registry = new AssetRegistry({ storage: createMemoryStorage() });
  registry.seed({
    assets: [
      { id: "A-GENERAL", type: "evidence", tenantId: "T1", ownerOrganizationId: "ORG-1", name: "普通证据", status: "NEEDS_CONFIRMATION", access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [] } },
      { id: "A-SENSITIVE", type: "evidence", tenantId: "T1", ownerOrganizationId: "ORG-1", name: "敏感证据", status: "CONFIRMED", access: { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: [] } },
      { id: "A-OTHER", type: "evidence", tenantId: "T2", ownerOrganizationId: "ORG-2", name: "其他租户", status: "CONFIRMED", access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [] } },
    ],
    bindings: [
      { id: "B-GENERAL-PCF", serviceId: "pcf", caseId: "PCF-1", assetId: "A-GENERAL", status: "PENDING_CONFIRMATION" },
      { id: "B-SENSITIVE-CBAM", serviceId: "cbam", caseId: "CBAM-1", assetId: "A-SENSITIVE", status: "CONFIRMED" },
      { id: "B-OTHER-PCF", serviceId: "pcf", caseId: "PCF-2", assetId: "A-OTHER", status: "CONFIRMED" },
    ],
  });
  return create(registry, { tenantId: "T1" });
}

test("资产概览只投影当前租户与角色可见对象", () => {
  const view = fixture().overview({ role: "customer_contrib", facet: "all" });
  assert.deepEqual(view.assets.map((asset) => asset.id), ["A-GENERAL"]);
  assert.deepEqual(view.bindings.map((binding) => binding.id), ["B-GENERAL-PCF"]);
  assert.equal(view.summary.attention, 1);
});

test("资产详情和影响预览不会绕过目录授权", () => {
  const viewModel = fixture();
  assert.equal(viewModel.detail("A-SENSITIVE", { role: "customer_contrib" }), null);
  assert.equal(viewModel.impact("A-OTHER", { role: "customer_owner" }), null);
  assert.equal(viewModel.detail("A-SENSITIVE", { role: "customer_owner" }).asset.name, "敏感证据");
});
