const test = require("node:test");
const assert = require("node:assert/strict");
const { WorkflowEngine, createMemoryStorage } = require("../portal/domain/workflow-engine.js");

function engine() {
  let time = Date.parse("2026-10-11T00:00:00Z");
  return new WorkflowEngine({ storage: createMemoryStorage(), clock: () => (time += 1000) });
}

test("合法迁移会递增版本并写入审计", () => {
  const workflow = engine();
  workflow.create({ id: "EVD-1", type: "evidence", status: "UPLOADED", owner: "周岚" });
  const next = workflow.transition("EVD-1", "SECURITY_SCANNED", { actor: "Agent", role: "agent", reason: "安全扫描通过", expectedRevision: 1 });
  assert.equal(next.revision, 2);
  assert.equal(next.status, "SECURITY_SCANNED");
  assert.equal(workflow.events({ objectId: "EVD-1" })[0].to, "SECURITY_SCANNED");
});

test("非法跳转和并发版本冲突会被拒绝", () => {
  const workflow = engine();
  workflow.create({ id: "PKG-1", type: "quarterlyPackage", status: "COLLECTING" });
  assert.throws(() => workflow.transition("PKG-1", "SHARED", { actor: "周岚", reason: "尝试跳级" }), { code: "ILLEGAL_TRANSITION" });
  assert.throws(() => workflow.transition("PKG-1", "READY_FOR_REVIEW", { actor: "周岚", reason: "提交复核", expectedRevision: 99 }), { code: "REVISION_CONFLICT" });
});

test("没有接收回执不能标记为对方已接收", () => {
  const workflow = engine();
  workflow.create({ id: "PKG-2", type: "quarterlyPackage", status: "SHARED" });
  assert.throws(() => workflow.transition("PKG-2", "ACKNOWLEDGED", { actor: "Anna", role: "importer", reason: "确认收到" }), { code: "MISSING_RECEIPT" });
  const acknowledged = workflow.transition("PKG-2", "ACKNOWLEDGED", { actor: "Anna", role: "importer", reason: "确认收到", metadata: { receiptId: "RCPT-1" } });
  assert.equal(acknowledged.status, "ACKNOWLEDGED");
});

test("外部核查 Finding 不能由内部角色关闭", () => {
  const workflow = engine();
  workflow.create({ id: "FND-1", type: "finding", status: "RESOLVED", metadata: { source: "VERIFIER" } });
  assert.throws(() => workflow.transition("FND-1", "CLOSED", { actor: "王晨", role: "expert", reason: "内部认为已解决", metadata: { resolutionEvidence: "EVD-1" } }), { code: "SEPARATION_OF_DUTIES" });
  assert.equal(workflow.transition("FND-1", "CLOSED", { actor: "Marta", role: "verifier", reason: "核查确认关闭", metadata: { resolutionEvidence: "EVD-1" } }).status, "CLOSED");
});

test("事实变化会让依赖的当前计算版本过期", () => {
  const workflow = engine();
  workflow.create({ id: "FACT-1", type: "fact", status: "CONFIRMED" });
  workflow.create({ id: "RUN-04", type: "calculationRun", status: "CURRENT", dependsOn: ["FACT-1"] });
  const changed = workflow.invalidateDependents("FACT-1", { actor: "周岚", role: "customer_owner", reason: "事实值发生变化" });
  assert.equal(changed.length, 1);
  assert.equal(workflow.get("RUN-04").status, "STALE");
});

test("状态在重新创建引擎后仍可恢复", () => {
  const storage = createMemoryStorage();
  const first = new WorkflowEngine({ storage });
  first.create({ id: "SO-1", type: "serviceOrder", status: "ACTIVE" });
  first.transition("SO-1", "SUSPENDED", { actor: "林晓", role: "ops", reason: "客户申请暂停" });
  const restored = new WorkflowEngine({ storage });
  assert.equal(restored.get("SO-1").status, "SUSPENDED");
  assert.equal(restored.events({ objectId: "SO-1" }).length, 2);
});

test("证据确认会使旧 Run 过期并产生可追溯的新 Run", () => {
  const workflow = engine();
  workflow.create({ id: "EVD-Q3", type: "evidence", status: "PARSED", year: "2027", quarter: "Q3" });
  workflow.transitionPath("EVD-Q3", ["CLASSIFIED", "LINKED", "REVIEWED", "ACCEPTED"], { actor: "周岚", role: "customer_owner", reason: "确认账期、设施和提取值" });
  workflow.create({ id: "FACT-Q3", type: "fact", status: "MISSING", year: "2027", quarter: "Q3" });
  workflow.transitionPath("FACT-Q3", ["PROPOSED", "NEEDS_CONFIRMATION", "CONFIRMED"], { actor: "周岚", role: "customer_owner", reason: "确认业务事实" });
  workflow.create({ id: "RUN-OLD", type: "calculationRun", status: "CURRENT", dependsOn: ["FACT-Q3"] });
  workflow.invalidateDependents("FACT-Q3", { actor: "SYSTEM", role: "system", reason: "输入快照已变化" });
  workflow.create({ id: "RUN-NEW", type: "calculationRun", status: "QUEUED", dependsOn: ["FACT-Q3"] });
  workflow.transitionPath("RUN-NEW", ["RUNNING", "SUCCEEDED", "CURRENT"], { actor: "SYSTEM", role: "system", reason: "用新快照重算" });
  assert.equal(workflow.get("EVD-Q3").status, "ACCEPTED");
  assert.equal(workflow.get("FACT-Q3").status, "CONFIRMED");
  assert.equal(workflow.get("RUN-OLD").status, "STALE");
  assert.equal(workflow.get("RUN-NEW").status, "CURRENT");
  assert.equal(workflow.events({ objectId: "RUN-NEW" }).length, 4);
});

test("年度状态只由子对象派生并返回开放阻塞", () => {
  const workflow = engine();
  workflow.create({ id: "PKG-Q3", type: "quarterlyPackage", status: "COLLECTING", year: "2027" });
  workflow.create({ id: "FND-Q3", type: "finding", status: "VALIDATING", year: "2027" });
  const summary = workflow.deriveAnnualCycle({ year: "2027" });
  assert.equal(summary.status, "COLLECTING");
  assert.deepEqual(summary.blockers, ["FND-Q3"]);
  assert.equal(workflow.get("PKG-Q3").status, "COLLECTING");
});

test("PCF 服务案件只能按范围、采集、确认、计算、复核和报告顺序推进", () => {
  const workflow = engine();
  workflow.create({ id: "PCF-1", type: "serviceCase", status: "SCOPING", metadata: { serviceId: "pcf" } });
  assert.throws(() => workflow.transition("PCF-1", "CALCULATING", { actor: "周岚", reason: "尝试跳过采集与确认" }), { code: "ILLEGAL_TRANSITION" });
  workflow.transitionPath("PCF-1", ["COLLECTING", "NEEDS_CONFIRMATION", "CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY"], { actor: "周岚", role: "customer_owner", reason: "完成 PCF 最小闭环" });
  assert.equal(workflow.get("PCF-1").status, "DELIVERABLE_READY");
  assert.equal(workflow.get("PCF-1").metadata.serviceId, "pcf");
  assert.equal(workflow.events({ objectId: "PCF-1" }).length, 6);
});

test("跨服务复用材料仍保留独立服务事实", () => {
  const workflow = engine();
  workflow.create({ id: "EVD-SHARED", type: "evidence", status: "ACCEPTED", metadata: { serviceId: "pcf", referencedBy: ["pcf", "cbam"] } });
  workflow.create({ id: "FACT-PCF", type: "fact", status: "CONFIRMED", dependsOn: ["EVD-SHARED"], metadata: { serviceId: "pcf" } });
  workflow.create({ id: "FACT-CBAM", type: "fact", status: "NEEDS_CONFIRMATION", dependsOn: ["EVD-SHARED"], metadata: { serviceId: "cbam" } });
  assert.equal(workflow.get("FACT-PCF").status, "CONFIRMED");
  assert.equal(workflow.get("FACT-CBAM").status, "NEEDS_CONFIRMATION");
});
