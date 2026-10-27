const test = require("node:test");
const assert = require("node:assert/strict");
const { AssetRegistry, FRAMEWORK_VERSION, createMemoryStorage } = require("../domain/data-asset-engine.js");

function registry() {
  let time = Date.parse("2026-10-22T00:00:00Z");
  return new AssetRegistry({ storage: createMemoryStorage(), clock: () => (time += 1000) });
}

function baseAsset(overrides = {}) {
  return {
    id: "REC-POWER-001",
    type: "energyConsumption",
    tenantId: "TNT-0018",
    ownerOrganizationId: "ORG-HX-001",
    name: "上海一厂购入电力",
    status: "PROPOSED",
    payload: { originalValue: "12480", originalUnit: "MWh" },
    access: { confidentiality: "internal", visibility: "enterprise", allowedRoles: [] },
    ...overrides,
  };
}

test("框架版本固定并登记首个不可变版本", () => {
  const assets = registry();
  const created = assets.register(baseAsset(), { actor: "周岚", role: "customer_owner", reason: "登记电力记录" });
  assert.equal(FRAMEWORK_VERSION, "0.2.0");
  assert.equal(created.versionId, "REC-POWER-001@1");
  assert.equal(created.revision, 1);
  assert.equal(assets.history(created.id).length, 1);
});

test("修订生成新版本且不覆盖历史快照", () => {
  const assets = registry();
  assets.register(baseAsset(), { actor: "周岚", role: "customer_owner", reason: "登记电力记录" });
  const next = assets.revise("REC-POWER-001", { payload: { originalValue: "12600" } }, { actor: "周岚", role: "customer_owner", reason: "按修订账单更新", expectedRevision: 1 });
  assert.equal(next.versionId, "REC-POWER-001@2");
  assert.equal(next.parentVersionId, "REC-POWER-001@1");
  assert.equal(assets.get("REC-POWER-001", 1).payload.originalValue, "12480");
  assert.equal(assets.get("REC-POWER-001").payload.originalValue, "12600");
});

test("Agent 只能写入待确认提议且必须引用来源", () => {
  const assets = registry();
  assert.throws(() => assets.register(baseAsset({ status: "CONFIRMED" }), { actor: "Asset Agent", role: "agent", reason: "自动提取" }), { code: "AGENT_CANNOT_CONFIRM" });
  assert.throws(() => assets.register(baseAsset(), { actor: "Asset Agent", role: "agent", reason: "自动提取" }), { code: "MISSING_PROVENANCE" });
});

test("企业事实确认只能由授权企业角色执行", () => {
  const assets = registry();
  assets.register(baseAsset(), { actor: "陈浩", role: "customer_contrib", reason: "录入电力记录" });
  assert.throws(() => assets.confirm("REC-POWER-001", { actor: "陈浩", role: "customer_contrib", reason: "确认数值" }), { code: "FORBIDDEN" });
  const confirmed = assets.confirm("REC-POWER-001", { actor: "周岚", role: "customer_owner", reason: "核对账单与期间" });
  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(confirmed.revision, 2);
});

test("跨服务绑定引用确定资产版本且分别确认", () => {
  const assets = registry();
  assets.register(baseAsset({ status: "CONFIRMED" }), { actor: "周岚", role: "customer_owner", reason: "登记已确认事实" });
  assets.bind({ id: "BIND-CBAM-POWER", serviceId: "cbam", caseId: "CBAM-2026", assetId: "REC-POWER-001", usagePurpose: "季度间接排放" }, { actor: "周岚", role: "customer_owner", reason: "申请用于 CBAM" });
  assets.confirmBinding("BIND-CBAM-POWER", { actor: "周岚", role: "customer_owner", reason: "确认 CBAM 使用范围" });
  assets.bind({ id: "BIND-PCF-POWER", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-POWER-001", status: "PENDING_CONFIRMATION", usagePurpose: "产品能源分配" }, { actor: "PCF 专家", role: "expert", reason: "建议复用企业电力事实" });
  assert.equal(assets.bindings({ serviceId: "cbam" })[0].status, "CONFIRMED");
  assert.equal(assets.bindings({ serviceId: "pcf" })[0].status, "PENDING_CONFIRMATION");
  assert.equal(assets.bindings({ serviceId: "pcf" })[0].assetVersionId, "REC-POWER-001@1");
});

test("服务确认不会修改企业资产或其他服务状态", () => {
  const assets = registry();
  assets.register(baseAsset({ status: "CONFIRMED" }), { actor: "周岚", role: "customer_owner", reason: "登记已确认事实" });
  assets.bind({ id: "BIND-CBAM-POWER", serviceId: "cbam", caseId: "CBAM-2026", assetId: "REC-POWER-001" }, { actor: "周岚", role: "customer_owner", reason: "申请 CBAM 使用" });
  assets.confirmBinding("BIND-CBAM-POWER", { actor: "周岚", role: "customer_owner", reason: "确认 CBAM 使用范围" });
  assets.bind({ id: "BIND-PCF-POWER", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-POWER-001" }, { actor: "王晨", role: "expert", reason: "申请 PCF 复用" });
  assets.confirmBinding("BIND-PCF-POWER", { actor: "周岚", role: "customer_owner", reason: "确认 PCF 使用范围" });
  assert.equal(assets.get("REC-POWER-001").status, "CONFIRMED");
  assert.equal(assets.bindings({ serviceId: "cbam" })[0].status, "CONFIRMED");
  assert.equal(assets.bindings({ serviceId: "pcf" })[0].status, "CONFIRMED");
});

test("非系统用户不能在创建绑定时跳过独立确认", () => {
  const assets = registry();
  assets.register(baseAsset({ status: "CONFIRMED" }), { actor: "周岚", role: "customer_owner", reason: "登记已确认事实" });
  assert.throws(() => assets.bind({ id: "BIND-PCF-DIRECT", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-POWER-001", status: "CONFIRMED" }, { actor: "周岚", role: "customer_owner", reason: "尝试直接确认" }), { code: "BINDING_CONFIRMATION_REQUIRED" });
});

test("血缘同时记录来源、处理活动和责任主体", () => {
  const assets = registry();
  assets.register(baseAsset({ id: "EVD-POWER", type: "evidence", name: "电力账单", status: "CONFIRMED" }), { actor: "周岚", role: "customer_owner", reason: "上传账单" });
  assets.register(baseAsset({ provenance: { sourceType: "agent-extraction", sourceAssetIds: ["EVD-POWER"] } }), { actor: "Asset Agent", role: "agent", reason: "提取电力记录" });
  const edge = assets.linkLineage({ id: "LIN-POWER", fromAssetId: "EVD-POWER", toAssetId: "REC-POWER-001", activityType: "AGENT_EXTRACTION", agentType: "agent", agentId: "asset-agent", ruleVersion: "extract-energy@1.0.0" }, { actor: "Asset Agent", role: "agent", reason: "记录提取血缘" });
  assert.equal(edge.fromVersionId, "EVD-POWER@1");
  assert.equal(edge.toVersionId, "REC-POWER-001@1");
  assert.equal(assets.lineage("REC-POWER-001")[0].ruleVersion, "extract-energy@1.0.0");
});

test("目录按租户和角色过滤敏感资产", () => {
  const assets = registry();
  assets.register(baseAsset({ access: { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: [] } }), { actor: "周岚", role: "customer_owner", reason: "登记敏感能源记录" });
  assert.equal(assets.catalog({ tenantId: "TNT-0018", role: "customer_owner" }).length, 1);
  assert.equal(assets.catalog({ tenantId: "TNT-0018", role: "customer_contrib" }).length, 0);
  assert.equal(assets.catalog({ tenantId: "TNT-OTHER", role: "customer_admin" }).length, 0);
});

test("资产修订使未锁定快照与当前计算运行进入 STALE，且不自动切换绑定", () => {
  const assets = registry();
  assets.register(baseAsset({ status: "CONFIRMED" }), { actor: "周岚", role: "customer_owner", reason: "登记已确认事实" });
  assets.bind({ id: "BIND-PCF-POWER", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-POWER-001" }, { actor: "王晨", role: "expert", reason: "申请 PCF 复用" });
  assets.confirmBinding("BIND-PCF-POWER", { actor: "周岚", role: "customer_owner", reason: "确认 PCF 使用范围" });
  assets.createTransformation({
    id: "ALLOC-HRC-ELECTRICITY@1",
    tenantId: "TNT-0018",
    serviceId: "pcf",
    caseId: "PCF-2026-001",
    ruleType: "mass_allocation",
    ruleVersion: "1.0.0",
    name: "热轧卷电力质量分配",
  }, { actor: "王晨", role: "expert", reason: "登记分配规则" });
  assets.createSnapshot({
    id: "SNAP-PCF-001",
    tenantId: "TNT-0018",
    serviceId: "pcf",
    caseId: "PCF-2026-001",
    bindingIds: ["BIND-PCF-POWER"],
    transformationIds: ["ALLOC-HRC-ELECTRICITY@1"],
  }, { actor: "王晨", role: "expert", reason: "锁定 PCF 输入快照" });
  assets.createCalculationRun({
    id: "ARUN-PCF-001",
    tenantId: "TNT-0018",
    serviceId: "pcf",
    caseId: "PCF-2026-001",
    snapshotId: "SNAP-PCF-001",
    status: "SUCCEEDED",
    workflowObjectId: "RUN-PCF-001",
  }, { actor: "王晨", role: "expert", reason: "记录计算运行" });
  assets.markCurrent("ARUN-PCF-001", { actor: "王晨", role: "expert", reason: "设为当前结果" });

  assets.revise("REC-POWER-001", { payload: { originalValue: "12600" }, status: "NEEDS_CONFIRMATION" }, { actor: "周岚", role: "customer_owner", reason: "按修订账单更正", expectedRevision: 1 });

  assert.equal(assets.getSnapshot("SNAP-PCF-001").status, "STALE");
  assert.equal(assets.getCalculationRun("ARUN-PCF-001").status, "STALE");
  assert.equal(assets.bindings({ id: "BIND-PCF-POWER" })[0].status, "CONFIRMED");
  assert.equal(assets.bindings({ id: "BIND-PCF-POWER" })[0].assetVersionId, "REC-POWER-001@1");
  assert.ok(assets.events({ type: "BINDING_ASSET_VERSION_OUTDATED" }).some((event) => event.metadata.bindingId === "BIND-PCF-POWER"));
});

test("锁定快照在资产修订后保持可重现并记录影响告警", () => {
  const assets = registry();
  assets.register(baseAsset({ status: "CONFIRMED" }), { actor: "周岚", role: "customer_owner", reason: "登记已确认事实" });
  assets.bind({ id: "BIND-PCF-POWER", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-POWER-001" }, { actor: "王晨", role: "expert", reason: "申请 PCF 复用" });
  assets.confirmBinding("BIND-PCF-POWER", { actor: "周岚", role: "customer_owner", reason: "确认 PCF 使用范围" });
  assets.createSnapshot({
    id: "SNAP-PCF-LOCKED",
    tenantId: "TNT-0018",
    serviceId: "pcf",
    caseId: "PCF-2026-001",
    bindingIds: ["BIND-PCF-POWER"],
  }, { actor: "王晨", role: "expert", reason: "创建报告输入快照" });
  assets.lockSnapshot("SNAP-PCF-LOCKED", { actor: "王晨", role: "reviewer", reason: "报告已锁定交付" });
  assets.createCalculationRun({
    id: "ARUN-PCF-LOCKED",
    serviceId: "pcf",
    caseId: "PCF-2026-001",
    snapshotId: "SNAP-PCF-LOCKED",
    status: "CURRENT",
  }, { actor: "王晨", role: "expert", reason: "记录已交付计算" });

  assets.revise("REC-POWER-001", { payload: { originalValue: "13000" } }, { actor: "周岚", role: "customer_owner", reason: "更正电力用量" });

  const snapshot = assets.getSnapshot("SNAP-PCF-LOCKED");
  assert.equal(snapshot.status, "LOCKED");
  assert.equal(snapshot.locked, true);
  assert.equal(snapshot.inputAssetVersionIds[0], "REC-POWER-001@1");
  assert.equal(snapshot.impactAlerts.length, 1);
  assert.equal(assets.getCalculationRun("ARUN-PCF-LOCKED").status, "CURRENT");
});

test("修订影响预览列出将过期快照与不会自动切换的绑定", () => {
  const assets = registry();
  assets.register(baseAsset({ status: "CONFIRMED" }), { actor: "周岚", role: "customer_owner", reason: "登记已确认事实" });
  assets.bind({ id: "BIND-PCF-POWER", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-POWER-001" }, { actor: "王晨", role: "expert", reason: "申请 PCF 复用" });
  assets.confirmBinding("BIND-PCF-POWER", { actor: "周岚", role: "customer_owner", reason: "确认 PCF 使用范围" });
  assets.createSnapshot({
    id: "SNAP-PCF-001",
    tenantId: "TNT-0018",
    serviceId: "pcf",
    caseId: "PCF-2026-001",
    bindingIds: ["BIND-PCF-POWER"],
  }, { actor: "王晨", role: "expert", reason: "创建快照" });
  const preview = assets.previewImpact("REC-POWER-001");
  assert.equal(preview.bindings.length, 1);
  assert.equal(preview.staleSnapshots[0].id, "SNAP-PCF-001");
  assert.equal(preview.lockedSnapshots.length, 0);
});

test("reject 与 supersede 不自动切换旧绑定到新资产版本", () => {
  const assets = registry();
  assets.register(baseAsset({ status: "CONFIRMED" }), { actor: "周岚", role: "customer_owner", reason: "登记已确认事实" });
  assets.bind({ id: "BIND-PCF-OLD", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-POWER-001" }, { actor: "王晨", role: "expert", reason: "申请复用" });
  assets.rejectBinding("BIND-PCF-OLD", { actor: "周岚", role: "customer_owner", reason: "范围不适用" });
  assert.equal(assets.bindings({ id: "BIND-PCF-OLD" })[0].status, "REJECTED");

  assets.bind({ id: "BIND-PCF-V1", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-POWER-001" }, { actor: "王晨", role: "expert", reason: "再次申请" });
  assets.confirmBinding("BIND-PCF-V1", { actor: "周岚", role: "customer_owner", reason: "确认使用" });
  assets.revise("REC-POWER-001", { payload: { originalValue: "12600" }, status: "NEEDS_CONFIRMATION" }, { actor: "周岚", role: "customer_owner", reason: "更正" });
  assets.confirm("REC-POWER-001", { actor: "周岚", role: "customer_owner", reason: "确认更正后的电力事实", basis: "修订账单" });
  const { previous, next } = assets.supersedeBinding("BIND-PCF-V1", { id: "BIND-PCF-V2", assetId: "REC-POWER-001" }, { actor: "王晨", role: "expert", reason: "改绑新版本" });
  assert.equal(previous.status, "SUPERSEDED");
  assert.equal(previous.supersededBy, "BIND-PCF-V2");
  assert.equal(next.status, "PENDING_CONFIRMATION");
  assert.equal(next.assetVersionId, "REC-POWER-001@3");
});
