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

function onboardingFixture() {
  let time = Date.parse("2026-11-13T00:00:00Z");
  const workflow = new WorkflowEngine({ storage: createMemoryStorage(), clock: () => (time += 1000) });
  workflow.seed([
    { id: IDS.activation, type: "serviceActivation", status: "ACTIVE", owner: "周岚", year: "2027", scope: "CBAM 2027 服务启动" },
    { id: IDS.onboardingOrder, type: "serviceOrder", status: "ACTIVE", owner: "周岚", year: "2027", scope: "CBAM 2027 开通期演示" },
    { id: IDS.annualCase, type: "serviceCase", status: "SCOPING", owner: "周岚", year: "2027", scope: "CBAM 2027 年度项目" },
    { id: IDS.annualScope, type: "annualInclusion", status: "PROPOSED", owner: "周岚", year: "2027", scope: "2027 年度范围" },
    { id: IDS.monitoringPlan, type: "formalArtifact", status: "DRAFT", owner: "王晨", year: "2027", scope: "2027 年度监测计划", metadata: { collectionPeriod: "Q1", dataItems: Array.from({ length: 8 }, (_, index) => ({ code: `D-${index + 1}`, name: `数据项 ${index + 1}`, owner: index < 4 ? "孙悦" : "周岚" })) } },
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

test("p01-p05 只在年度项目创建前门禁，收资、范围与监测计划随后并行", () => {
  const { controller } = onboardingFixture();
  assert.equal(controller.stage("p01").state, "done");
  assert.equal(controller.stage("p02").state, "in_progress");
  assert.equal(controller.stage("p03").code, "P02_REQUIRED");
  assert.equal(controller.stage("p04").code, "P02_REQUIRED");
  assert.equal(controller.stage("p05").code, "P02_REQUIRED");
});

test("合同与旧服务订单不能绕过客户线上启动确认", () => {
  const { workflow, controller } = onboardingFixture();
  workflow.reset();
  workflow.seed([
    { id: IDS.activation, type: "serviceActivation", status: "PENDING_CUSTOMER_CONFIRMATION", owner: "周岚", year: "2027", scope: "CBAM 2027 服务启动" },
    { id: IDS.onboardingOrder, type: "serviceOrder", status: "ACTIVE", owner: "周岚", year: "2027", scope: "已签合同对应的服务订单" },
    { id: IDS.annualCase, type: "serviceCase", status: "SCOPING", owner: "周岚", year: "2027", scope: "CBAM 2027 年度项目" },
  ]);
  assert.equal(controller.stage("p01").code, "P01_REQUIRED");
  assert.equal(controller.stage("p02").code, "P01_REQUIRED");
  assert.throws(() => controller.command("p02", "create", owner), { code: "PREREQUISITE_REQUIRED" });
});

test("年度项目向导草稿可恢复，完成后解锁年度范围", () => {
  const { workflow, controller } = onboardingFixture();
  controller.command("p02", "save-draft", owner, { step: 3, cadence: "quarterly", importer: "NordWerk GmbH" });
  assert.equal(workflow.get(IDS.annualCase).metadata.wizardStep, 3);
  assert.equal(controller.stage("p03").state, "blocked");
  controller.command("p02", "create", owner, { importer: "NordWerk GmbH", products: ["HRC", "HDG"] });
  assert.equal(controller.stage("p02").state, "done");
  assert.equal(controller.stage("p03").state, "not_started");
  assert.equal(controller.stage("p04").state, "not_started");
  assert.equal(controller.stage("p05").state, "not_started");
  assert.equal(workflow.list({ type: "workPackage" }).filter((item) => item.id.startsWith(IDS.materialRequestPrefix)).length, 8);
});

test("监测计划可与范围确认和收资并行，并保持职责分离", () => {
  const { workflow, controller } = onboardingFixture();
  controller.command("p02", "create", owner, { importer: "NordWerk GmbH" });
  assert.equal(controller.stage("p04").state, "not_started");
  assert.throws(() => controller.command("p04", "prepare", owner), { code: "FORBIDDEN" });
  controller.command("p04", "prepare", { name: "王晨", role: "expert" });
  assert.equal(controller.stage("p04").assignee, "李娜");
  assert.throws(() => controller.command("p04", "review", { name: "王晨", role: "expert" }), { code: "FORBIDDEN" });
  controller.command("p04", "review", reviewer);
  assert.equal(controller.stage("p04").assignee, "周岚");
  const result = controller.command("p04", "sign", owner);
  assert.equal(result.object.status, "APPROVED");
  assert.equal(controller.stage("p04").state, "done");
  assert.equal(workflow.list({ type: "workPackage" }).filter((item) => item.id.startsWith(IDS.materialRequestPrefix)).length, 8);
  assert.equal(controller.stage("p03").state, "not_started");
});

test("签收和邀请草稿重复执行保持幂等，p05 不产生外发事件", () => {
  const { workflow, controller } = onboardingFixture();
  controller.command("p02", "create", owner);
  controller.command("p05", "draft-invitations", owner, { people: ["孙悦", "刘倩", "北方特钢 刘明"] });
  controller.command("p04", "prepare", { name: "王晨", role: "expert" });
  controller.command("p04", "review", reviewer);
  controller.command("p04", "sign", owner);
  const before = workflow.events().length;
  controller.command("p04", "sign", owner);
  controller.command("p05", "draft-invitations", owner);
  assert.equal(controller.stage("p05").state, "done");
  assert.equal(workflow.list({ type: "handoff" }).filter((item) => item.id === IDS.invitationDraft).length, 1);
  assert.equal(workflow.events({ objectId: IDS.invitationDraft }).some((event) => ["SENT", "DELIVERED", "ACKNOWLEDGED"].includes(event.to)), false);
  assert.equal(workflow.get(IDS.invitationDraft).metadata.externalSent, false);
  assert.equal(workflow.events().length, before);
});
