(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoCbamGoldenPath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const IDS = Object.freeze({
    activation: "AUTH-CBAM-2027-001",
    onboardingOrder: "SO-CBAM-2027-ONBOARDING",
    annualCase: "CASE-CBAM-2027",
    annualScope: "SCOPE-CBAM-2027",
    monitoringPlan: "MP-CBAM-2027-R1",
    materialRequestPrefix: "MR-CBAM-2027-Q1-",
    invitationDraft: "INV-CBAM-2027-DRAFT",
    scenario: "CBAM-2026-Q3-DEMO",
    package: "PKG-2026-Q3-NORDWERK",
    run: "RUN-CBAM-2026Q3-001",
    approval: "AP-2026-014",
  });

  const ACTORS = Object.freeze({
    owner: Object.freeze({ name: "周岚", roles: Object.freeze(["customer_owner", "customer_admin"]) }),
    preparer: Object.freeze({ name: "王晨", roles: Object.freeze(["expert"]) }),
    system: Object.freeze({ name: "CBAM Calculation Engine", roles: Object.freeze(["system"]) }),
    reviewer: Object.freeze({ name: "李娜", roles: Object.freeze(["reviewer"]) }),
  });

  const INPUTS = Object.freeze({
    productionTonnes: 12840,
    directEmissionsTco2e: 12326.4,
    indirectEmissionsTco2e: 4108.8,
    precursorEmissionsTco2e: 8217.6,
  });

  function fail(code, message, recovery) {
    const error = new Error(message);
    error.code = code;
    error.recovery = recovery || null;
    throw error;
  }

  function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function ensureActor(actor, contract) {
    if (!actor || !contract.roles.includes(actor.role)) fail("FORBIDDEN", "当前身份不能执行该操作。", "切换到命名经办人账户。");
    if (actor.name !== contract.name) fail("ASSIGNEE_MISMATCH", `该操作已指派给 ${contract.name}。`, `请由 ${contract.name} 执行。`);
  }

  function reviewed(run) {
    return Boolean(run && run.metadata && run.metadata.review && run.metadata.review.status === "REVIEWED");
  }

  class CbamGoldenPath {
    constructor(options = {}) {
      if (!options.workflow) fail("MISSING_WORKFLOW", "CBAM 黄金路径需要 WorkflowEngine。");
      this.workflow = options.workflow;
    }

    snapshot() {
      return {
        activation: this.workflow.get(IDS.activation),
        onboardingOrder: this.workflow.get(IDS.onboardingOrder),
        annualCase: this.workflow.get(IDS.annualCase),
        annualScope: this.workflow.get(IDS.annualScope),
        monitoringPlan: this.workflow.get(IDS.monitoringPlan),
        invitationDraft: this.workflow.get(IDS.invitationDraft),
        materialRequests: this.workflow.list({ type: "workPackage" }).filter((item) => item.metadata?.annualCaseId === IDS.annualCase || item.id.startsWith(IDS.materialRequestPrefix)),
        package: this.workflow.get(IDS.package),
        run: this.workflow.get(IDS.run),
        approval: this.workflow.get(IDS.approval),
      };
    }

    stage(playbookId) {
      const snapshot = this.snapshot();
      const { activation, onboardingOrder, annualCase, annualScope, monitoringPlan, invitationDraft, package: pkg, run, approval } = snapshot;

      if (playbookId === "p01") {
        if (activation?.status === "ACTIVE" && onboardingOrder?.status === "ACTIVE") return { state: "done", object: activation };
        return { state: "blocked", code: "P01_REQUIRED", recovery: "先完成 2027 CBAM 服务启动授权与客户线上确认。", object: activation || onboardingOrder };
      }

      if (playbookId === "p02") {
        if (this.stage("p01").state !== "done") return { state: "blocked", code: "P01_REQUIRED", recovery: "先完成 2027 CBAM 服务启动授权与客户线上确认。" };
        if (!annualCase) return { state: "failed", code: "ONBOARDING_SCENARIO_MISSING", recovery: "重置 2027 开通期演示。" };
        if (annualCase.status === "SCOPING") return { state: "in_progress", object: annualCase };
        return { state: "done", object: annualCase };
      }

      if (playbookId === "p03") {
        if (this.stage("p02").state !== "done") return { state: "blocked", code: "P02_REQUIRED", recovery: "先完成 5 步年度项目向导。" };
        if (!annualScope) return { state: "failed", code: "ANNUAL_SCOPE_MISSING", recovery: "重置 2027 开通期演示。" };
        if (["IN_SCOPE", "LOCKED"].includes(annualScope.status)) return { state: "done", object: annualScope };
        return { state: "not_started", object: annualScope };
      }

      if (playbookId === "p04") {
        if (this.stage("p02").state !== "done") return { state: "blocked", code: "P02_REQUIRED", recovery: "先创建 2027 年度项目并启动收资。" };
        if (!monitoringPlan) return { state: "failed", code: "MONITORING_PLAN_MISSING", recovery: "重置 2027 开通期演示。" };
        if (["APPROVED", "LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED"].includes(monitoringPlan.status)) return { state: "done", object: monitoringPlan };
        if (monitoringPlan.status === "DRAFT") return { state: "not_started", assignee: ACTORS.preparer.name, object: monitoringPlan };
        if (["GENERATED", "VALIDATED"].includes(monitoringPlan.status)) return { state: "waiting_human", code: "REVIEW_REQUIRED", assignee: ACTORS.reviewer.name, object: monitoringPlan };
        if (monitoringPlan.status === "INTERNAL_REVIEW") return { state: "waiting_human", code: "CUSTOMER_SIGN_REQUIRED", assignee: ACTORS.owner.name, object: monitoringPlan };
        return { state: "in_progress", object: monitoringPlan };
      }

      if (playbookId === "p05") {
        if (this.stage("p02").state !== "done") return { state: "blocked", code: "P02_REQUIRED", recovery: "先创建 2027 年度项目并启动收资。" };
        if (invitationDraft?.status === "PROPOSED" && invitationDraft.metadata?.externalSent === false) return { state: "done", object: invitationDraft };
        return { state: "not_started" };
      }

      if (!pkg || !approval) return { state: "failed", code: "SCENARIO_MISSING", recovery: "重置 Q3 演示场景。" };

      if (playbookId === "p06") {
        if (["READY_FOR_REVIEW", "APPROVED", "PACKAGE_READY", "SHARED", "ACKNOWLEDGED", "FROZEN"].includes(pkg.status)) return { state: "done", object: pkg };
        return { state: pkg.status === "COLLECTING" ? "in_progress" : "blocked", object: pkg };
      }

      if (playbookId === "p07") {
        if (!["READY_FOR_REVIEW", "APPROVED", "PACKAGE_READY", "SHARED", "ACKNOWLEDGED", "FROZEN"].includes(pkg.status)) return { state: "blocked", code: "P06_REQUIRED", recovery: "返回 p06 确认 Q3 数据。" };
        if (!run) return { state: "not_started", code: "CALCULATION_REQUIRED" };
        if (["QUEUED", "RUNNING", "SUCCEEDED"].includes(run.status)) return { state: "in_progress", object: run };
        if (run.status === "FAILED") return { state: "failed", object: run, recovery: "检查输入后重试计算。" };
        if (run.status !== "CURRENT") return { state: "blocked", code: "CURRENT_RUN_REQUIRED", object: run };
        if (!reviewed(run)) return { state: "waiting_human", code: "REVIEW_REQUIRED", assignee: ACTORS.reviewer.name, object: run };
        if (approval.status === "REJECTED") return { state: "failed", code: "APPROVAL_REJECTED", object: approval, recovery: "查看驳回原因并重新提交。" };
        if (approval.status !== "APPROVED") return { state: "waiting_human", code: "APPROVAL_REQUIRED", assignee: approval.owner, object: approval };
        return { state: "done", object: run };
      }

      if (playbookId === "p08") {
        if (!run || run.status !== "CURRENT" || !reviewed(run) || approval.status !== "APPROVED") return { state: "blocked", code: "P07_REQUIRED", recovery: "完成计算、复核和审批。" };
        if (["SHARED", "ACKNOWLEDGED", "FROZEN"].includes(pkg.status)) return { state: "done_external", object: pkg };
        if (pkg.status === "PACKAGE_READY") return { state: "done", object: pkg };
        if (pkg.status === "APPROVED") return { state: "in_progress", object: pkg };
        return { state: "not_started", object: pkg };
      }

      return { state: "not_started", code: "OUTSIDE_GOLDEN_PATH" };
    }

    gate(playbookId, actor) {
      const stage = this.stage(playbookId);
      if (stage.state === "blocked" || stage.state === "failed") return { allowed: false, ...stage };
      if (["p02", "p03", "p05", "p06"].includes(playbookId)) ensureActor(actor, ACTORS.owner);
      return { allowed: true, ...stage };
    }

    command(playbookId, action, actor, payload = {}) {
      if (playbookId === "p02" && action === "save-draft") return this.saveAnnualProjectDraft(actor, payload);
      if (playbookId === "p02" && action === "create") return this.createAnnualProject(actor, payload);
      if (playbookId === "p03" && action === "confirm") return this.confirmAnnualScope(actor, payload);
      if (playbookId === "p04" && action === "prepare") return this.prepareMonitoringPlan(actor);
      if (playbookId === "p04" && action === "review") return this.reviewMonitoringPlan(actor);
      if (playbookId === "p04" && action === "sign") return this.signMonitoringPlan(actor);
      if (playbookId === "p05" && action === "draft-invitations") return this.draftInvitations(actor, payload);
      if (playbookId === "p06" && action === "confirm") return this.confirmData(actor);
      if (playbookId === "p07" && action === "calculate") return this.calculate(actor);
      if (playbookId === "p07" && action === "review") return this.review(actor);
      if (playbookId === "p08" && action === "package") return this.buildPackage(actor);
      fail("UNKNOWN_COMMAND", `不支持命令 ${playbookId}:${action}。`);
    }

    saveAnnualProjectDraft(actor, payload = {}) {
      ensureActor(actor, ACTORS.owner);
      const gate = this.stage("p02");
      if (gate.state === "blocked" || gate.state === "failed") fail("PREREQUISITE_REQUIRED", "年度项目尚不能编辑。", gate.recovery);
      const annualCase = this.workflow.get(IDS.annualCase);
      if (annualCase.status !== "SCOPING") return { idempotent: true, object: annualCase };
      const wizardStep = Math.min(5, Math.max(1, Number(payload.step) || 1));
      const object = this.workflow.patch(IDS.annualCase, { metadata: { wizardStep, wizardDraft: { ...(annualCase.metadata?.wizardDraft || {}), ...payload, step: wizardStep } } }, { actor: actor.name, role: actor.role, reason: `保存年度项目向导第 ${wizardStep} 步草稿`, correlationId: "CBAM-2027:p02:draft" });
      return { idempotent: false, object };
    }

    ensureMaterialRequests(actor) {
      const annualCase = this.workflow.get(IDS.annualCase);
      const monitoringPlan = this.workflow.get(IDS.monitoringPlan);
      const year = annualCase?.year || "2027";
      const period = annualCase?.metadata?.currentPeriod || monitoringPlan?.metadata?.collectionPeriod || "Q1";
      const dataItems = monitoringPlan?.metadata?.dataItems || [];
      dataItems.forEach((item, offset) => {
        const index = offset + 1;
        const id = `MR-CBAM-${year}-${period}-${String(index).padStart(2, "0")}`;
        if (this.workflow.get(id)) return;
        this.workflow.create({ id, type: "workPackage", status: "READY", owner: item.owner || annualCase?.owner || actor.name, year, quarter: period, scope: `${item.code || String(index).padStart(2, "0")} · ${item.name || "材料请求"}`, dependsOn: [IDS.annualCase, IDS.monitoringPlan], actor: actor.name, role: actor.role, reason: "年度项目启动收资后生成首轮材料请求", eventMetadata: { correlationId: `CBAM-${year}:p02:material-requests`, monitoringPlanId: IDS.monitoringPlan }, metadata: { basis: "annual_scope_and_monitoring_draft", annualCaseId: IDS.annualCase, monitoringPlanId: IDS.monitoringPlan, dataItemCode: item.code || null, provisional: true } });
      });
      return this.snapshot().materialRequests;
    }

    createAnnualProject(actor, payload = {}) {
      ensureActor(actor, ACTORS.owner);
      const gate = this.stage("p02");
      if (gate.state === "blocked" || gate.state === "failed") fail("PREREQUISITE_REQUIRED", "年度项目尚不能创建。", gate.recovery);
      const annualCase = this.workflow.get(IDS.annualCase);
      if (annualCase.status !== "SCOPING") return { idempotent: true, object: annualCase };
      const object = this.workflow.transition(IDS.annualCase, "COLLECTING", { actor: actor.name, role: actor.role, reason: "创建 CBAM 2027 年度项目并启动收资", correlationId: "CBAM-2027:p02:create", metadata: { wizardStep: 5, createdBy: actor.name, projectCreated: true, collectionStarted: true, collectionStartedBy: actor.name, wizardDraft: { ...(annualCase.metadata?.wizardDraft || {}), ...payload, step: 5 } } });
      return { idempotent: false, object, materialRequests: this.ensureMaterialRequests(actor) };
    }

    confirmAnnualScope(actor, payload = {}) {
      ensureActor(actor, ACTORS.owner);
      const gate = this.stage("p03");
      if (gate.state === "blocked" || gate.state === "failed") fail("PREREQUISITE_REQUIRED", "年度范围尚不能确认。", gate.recovery);
      const scope = this.workflow.get(IDS.annualScope);
      if (["IN_SCOPE", "LOCKED"].includes(scope.status)) return { idempotent: true, object: scope };
      const object = this.workflow.transition(IDS.annualScope, "IN_SCOPE", { actor: actor.name, role: actor.role, reason: "确认 2027 年度 CBAM 范围", correlationId: "CBAM-2027:p03:confirm", metadata: { included: payload.included || ["HRC", "HDG"], excluded: payload.excluded || ["CRC"], exclusionReason: payload.exclusionReason || "2027 年尚无出口欧盟计划", confirmedBy: actor.name } });
      return { idempotent: false, object };
    }

    prepareMonitoringPlan(actor) {
      ensureActor(actor, ACTORS.preparer);
      const gate = this.stage("p04");
      if (gate.state === "blocked" || gate.state === "failed") fail("PREREQUISITE_REQUIRED", "监测计划尚不能制备。", gate.recovery);
      const plan = this.workflow.get(IDS.monitoringPlan);
      if (plan.status !== "DRAFT") return { idempotent: true, object: plan };
      const object = this.workflow.transition(IDS.monitoringPlan, "GENERATED", { actor: actor.name, role: actor.role, reason: "完成 2027 监测计划制备确认", correlationId: "CBAM-2027:p04:prepare", metadata: { preparedBy: actor.name, dataItemCount: 8, customerCommentCount: 1 } });
      return { idempotent: false, object };
    }

    reviewMonitoringPlan(actor) {
      ensureActor(actor, ACTORS.reviewer);
      const gate = this.stage("p04");
      if (gate.state === "blocked" || gate.state === "failed") fail("PREREQUISITE_REQUIRED", "监测计划尚不能复核。", gate.recovery);
      const plan = this.workflow.get(IDS.monitoringPlan);
      if (["INTERNAL_REVIEW", "APPROVED", "LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED"].includes(plan.status)) return { idempotent: true, object: plan };
      if (plan.status !== "GENERATED") fail("INVALID_STAGE", "监测计划需先由王晨完成制备确认。", "请由王晨执行制备确认。");
      const rows = this.workflow.transitionPath(IDS.monitoringPlan, ["VALIDATED", "INTERNAL_REVIEW"], { actor: actor.name, role: actor.role, reason: "独立复核 2027 监测计划并发布客户审阅版", correlationId: "CBAM-2027:p04:review", metadata: { reviewedBy: actor.name, reviewStatus: "REVIEWED" } });
      return { idempotent: false, object: rows[rows.length - 1] };
    }

    signMonitoringPlan(actor) {
      ensureActor(actor, ACTORS.owner);
      const gate = this.stage("p04");
      if (gate.state === "blocked" || gate.state === "failed") fail("PREREQUISITE_REQUIRED", "监测计划尚不能签收。", gate.recovery);
      const plan = this.workflow.get(IDS.monitoringPlan);
      if (["APPROVED", "LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED"].includes(plan.status)) return { idempotent: true, object: plan, materialRequests: this.snapshot().materialRequests };
      if (plan.status !== "INTERNAL_REVIEW") fail("INVALID_STAGE", "监测计划需先完成独立复核。", "请由李娜复核并发布客户审阅版。");
      const object = this.workflow.transition(IDS.monitoringPlan, "APPROVED", { actor: actor.name, role: actor.role, reason: "客户签收 2027 监测计划", correlationId: "CBAM-2027:p04:sign", metadata: { signedBy: actor.name, signed: true, deliveryState: "CUSTOMER_ACCEPTED" } });
      return { idempotent: false, object, materialRequests: this.snapshot().materialRequests };
    }

    draftInvitations(actor, payload = {}) {
      ensureActor(actor, ACTORS.owner);
      const gate = this.stage("p05");
      if (gate.state === "blocked" || gate.state === "failed") fail("PREREQUISITE_REQUIRED", "邀请草稿尚不能生成。", gate.recovery);
      const existing = this.workflow.get(IDS.invitationDraft);
      if (existing) return { idempotent: true, object: existing };
      this.ensureMaterialRequests(actor);
      const object = this.workflow.create({ id: IDS.invitationDraft, type: "handoff", status: "PROPOSED", owner: actor.name, year: "2027", scope: "成员与供应商邀请草稿", dependsOn: [IDS.monitoringPlan], actor: actor.name, role: actor.role, reason: "生成待人工执行的邀请草稿", eventMetadata: { correlationId: "CBAM-2027:p05:draft" }, metadata: { people: payload.people || ["孙悦", "刘倩", "北方特钢 刘明"], leastPrivilege: true, externalSent: false, deliveryState: "DRAFT_ONLY" } });
      return { idempotent: false, object };
    }

    confirmData(actor) {
      ensureActor(actor, ACTORS.owner);
      const pkg = this.workflow.get(IDS.package);
      if (!pkg) fail("SCENARIO_MISSING", "找不到 Q3 季度包。", "重置 Q3 演示场景。");
      if (["READY_FOR_REVIEW", "APPROVED", "PACKAGE_READY", "SHARED", "ACKNOWLEDGED", "FROZEN"].includes(pkg.status)) return { idempotent: true, object: pkg };
      if (pkg.status !== "COLLECTING") fail("INVALID_STAGE", "Q3 季度包尚不能提交复核。");
      const object = this.workflow.transition(IDS.package, "READY_FOR_REVIEW", { actor: actor.name, role: actor.role, reason: "确认 2026 Q3 数据齐备并提交复核", correlationId: "CBAM-2026-Q3:p06:confirm", metadata: { scenarioId: IDS.scenario, confirmedBy: actor.name } });
      return { idempotent: false, object };
    }

    calculate(actor) {
      ensureActor(actor, ACTORS.system);
      const p07 = this.stage("p07");
      if (p07.code === "P06_REQUIRED") fail("PREREQUISITE_REQUIRED", "请先完成 p06 数据确认。", p07.recovery);
      const existing = this.workflow.get(IDS.run);
      if (existing) return { idempotent: true, object: existing };
      const total = round(INPUTS.directEmissionsTco2e + INPUTS.indirectEmissionsTco2e + INPUTS.precursorEmissionsTco2e, 1);
      const intensity = round(total / INPUTS.productionTonnes, 4);
      this.workflow.create({
        id: IDS.run, type: "calculationRun", status: "QUEUED", owner: "王晨", year: "2026", quarter: "Q3",
        actor: actor.name, role: actor.role, reason: "创建 2026 Q3 CBAM 演示计算",
        metadata: { scenarioId: IDS.scenario, inputMode: "demo_seed", formalUseAllowed: false, rulepack: "EU-CBAM-2026.3-demo", ...INPUTS, totalEmissionsTco2e: total, intensityTco2ePerTonne: intensity },
        eventMetadata: { correlationId: "CBAM-2026-Q3:p07:calculate" },
      });
      const rows = this.workflow.transitionPath(IDS.run, ["RUNNING", "SUCCEEDED", "CURRENT"], { actor: actor.name, role: actor.role, reason: "使用固定演示输入执行可重现计算", correlationId: "CBAM-2026-Q3:p07:calculate" });
      return { idempotent: false, object: rows[rows.length - 1] };
    }

    review(actor) {
      ensureActor(actor, ACTORS.reviewer);
      const run = this.workflow.get(IDS.run);
      if (!run || run.status !== "CURRENT") fail("PREREQUISITE_REQUIRED", "当前没有可复核的计算 Run。", "先执行 p07 计算。");
      if (reviewed(run)) return { idempotent: true, object: run };
      const object = this.workflow.patch(IDS.run, { metadata: { review: { status: "REVIEWED", reviewedBy: actor.name, formalConclusion: false } } }, { actor: actor.name, role: actor.role, reason: "复核固定演示输入和计算结果", correlationId: "CBAM-2026-Q3:p07:review" });
      return { idempotent: false, object };
    }

    buildPackage(actor) {
      ensureActor(actor, ACTORS.owner);
      const gate = this.stage("p08");
      if (gate.state === "blocked") fail("PREREQUISITE_REQUIRED", "请先完成 p07 计算、复核和审批。", gate.recovery);
      const pkg = this.workflow.get(IDS.package);
      if (["PACKAGE_READY", "SHARED", "ACKNOWLEDGED", "FROZEN"].includes(pkg.status)) return { idempotent: true, object: pkg };
      const targets = pkg.status === "READY_FOR_REVIEW" ? ["APPROVED", "PACKAGE_READY"] : ["PACKAGE_READY"];
      const rows = this.workflow.transitionPath(IDS.package, targets, { actor: actor.name, role: actor.role, reason: "生成 2026 Q3 待共享申报包", correlationId: "CBAM-2026-Q3:p08:package", metadata: { scenarioId: IDS.scenario, runId: IDS.run, approvalId: IDS.approval, deliveryState: "READY_TO_SHARE" } });
      return { idempotent: false, object: rows[rows.length - 1] };
    }
  }

  return { CbamGoldenPath, IDS, ACTORS, INPUTS };
});
