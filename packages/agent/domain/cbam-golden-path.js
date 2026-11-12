(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoCbamGoldenPath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const IDS = Object.freeze({
    scenario: "CBAM-2026-Q3-DEMO",
    package: "PKG-2026-Q3-NORDWERK",
    run: "RUN-CBAM-2026Q3-001",
    approval: "AP-2026-014",
  });

  const ACTORS = Object.freeze({
    owner: Object.freeze({ name: "周岚", roles: Object.freeze(["customer_owner", "customer_admin"]) }),
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
        package: this.workflow.get(IDS.package),
        run: this.workflow.get(IDS.run),
        approval: this.workflow.get(IDS.approval),
      };
    }

    stage(playbookId) {
      const { package: pkg, run, approval } = this.snapshot();
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
      if (playbookId === "p06") ensureActor(actor, ACTORS.owner);
      return { allowed: true, ...stage };
    }

    command(playbookId, action, actor) {
      if (playbookId === "p06" && action === "confirm") return this.confirmData(actor);
      if (playbookId === "p07" && action === "calculate") return this.calculate(actor);
      if (playbookId === "p07" && action === "review") return this.review(actor);
      if (playbookId === "p08" && action === "package") return this.buildPackage(actor);
      fail("UNKNOWN_COMMAND", `不支持命令 ${playbookId}:${action}。`);
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
