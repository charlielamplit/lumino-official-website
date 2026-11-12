const test = require("node:test");
const assert = require("node:assert/strict");
const { WorkflowEngine, createMemoryStorage } = require("../domain/workflow-engine.js");
const { CbamGoldenPath, IDS } = require("../domain/cbam-golden-path.js");

function fixture() {
  let time = Date.parse("2026-11-12T00:00:00Z");
  const workflow = new WorkflowEngine({ storage: createMemoryStorage(), clock: () => (time += 1000) });
  workflow.seed([
    { id: IDS.package, type: "quarterlyPackage", status: "COLLECTING", owner: "周岚", year: "2026", quarter: "Q3", scope: "NordWerk GmbH" },
    { id: IDS.approval, type: "approval", status: "IN_REVIEW", owner: "赵海峰", year: "2026", scope: "2026 Q3 CBAM 季度包" },
  ]);
  return { workflow, controller: new CbamGoldenPath({ workflow }) };
}

const owner = { name: "周岚", role: "customer_owner" };
const approver = { name: "赵海峰", role: "customer_approver" };
const reviewer = { name: "李娜", role: "reviewer" };

test("p07 和 p08 会被真实的前置对象阻断", () => {
  const { controller } = fixture();
  assert.equal(controller.stage("p06").state, "in_progress");
  assert.equal(controller.stage("p07").state, "blocked");
  assert.equal(controller.stage("p08").state, "blocked");
});

test("完整黄金路径停在 PACKAGE_READY", () => {
  const { workflow, controller } = fixture();
  controller.command("p06", "confirm", owner);
  const run = controller.command("p07", "calculate", { name: "CBAM Calculation Engine", role: "system" });
  assert.equal(run.object.status, "CURRENT");
  assert.equal(run.object.metadata.totalEmissionsTco2e, 24652.8);
  assert.equal(run.object.metadata.intensityTco2ePerTonne, 1.92);
  assert.equal(run.object.metadata.formalUseAllowed, false);
  assert.equal(controller.stage("p07").state, "waiting_human");
  assert.equal(controller.stage("p08").state, "blocked");

  controller.command("p07", "review", reviewer);
  workflow.transition(IDS.approval, "APPROVED", { actor: approver.name, role: approver.role, reason: "审批通过" });
  assert.equal(controller.stage("p07").state, "done");
  const result = controller.command("p08", "package", owner);
  assert.equal(result.object.status, "PACKAGE_READY");
  assert.equal(controller.stage("p08").state, "done");
  assert.equal(workflow.events({ objectId: IDS.package }).some((event) => ["SHARED", "ACKNOWLEDGED"].includes(event.to)), false);
});

test("重复命令不新增 Run、修订或审计事件", () => {
  const { workflow, controller } = fixture();
  controller.command("p06", "confirm", owner);
  controller.command("p07", "calculate", { name: "CBAM Calculation Engine", role: "system" });
  controller.command("p07", "review", reviewer);
  workflow.transition(IDS.approval, "APPROVED", { actor: approver.name, role: approver.role, reason: "审批通过" });
  controller.command("p08", "package", owner);
  const before = { events: workflow.events().length, revision: workflow.get(IDS.package).revision, runs: workflow.list({ type: "calculationRun" }).length };

  controller.command("p06", "confirm", owner);
  controller.command("p07", "calculate", { name: "CBAM Calculation Engine", role: "system" });
  controller.command("p08", "package", owner);
  assert.deepEqual({ events: workflow.events().length, revision: workflow.get(IDS.package).revision, runs: workflow.list({ type: "calculationRun" }).length }, before);
});

test("客户所有者不能代替审批或复核，显示视角也不授权", () => {
  const { controller } = fixture();
  assert.throws(() => controller.command("p06", "confirm", { name: "赵海峰", role: "customer_approver", perspective: "expert" }), { code: "FORBIDDEN" });
  assert.throws(() => controller.command("p07", "review", owner), { code: "FORBIDDEN" });
  assert.throws(() => controller.command("p07", "review", approver), { code: "FORBIDDEN" });
});

test("命名经办人不能被同角色其他用户代替", () => {
  const { controller } = fixture();
  assert.throws(() => controller.command("p06", "confirm", { name: "陈欣", role: "customer_owner" }), { code: "ASSIGNEE_MISMATCH" });
});
