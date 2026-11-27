(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoAnnualProjectView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATUS_LABELS = Object.freeze({
    NOT_STARTED: "未开始",
    SCOPING: "准备中",
    COLLECTING: "收资进行中",
    NEEDS_CONFIRMATION: "待数据确认",
    CALCULATING: "核算中",
    EXPERT_REVIEW: "专家复核中",
    DELIVERABLE_READY: "待交付",
    CLOSED: "已封存",
  });

  function list(workflow, filter) {
    return workflow && typeof workflow.list === "function" ? workflow.list(filter) : [];
  }

  function serviceObjects(workflow, type, year) {
    return list(workflow, { type, year: String(year) }).filter((item) => !item.metadata?.serviceId || item.metadata.serviceId === "cbam");
  }

  function quarterFromDate(value) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return `Q${Math.floor(date.getMonth() / 3) + 1}`;
  }

  function closeLabel(value, fallbackYear) {
    const closeYear = String(value || "").slice(0, 4) || String(fallbackYear);
    const quarter = quarterFromDate(value) || "Q1";
    return `${closeYear} ${quarter} 末`;
  }

  function shortDate(value) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }

  function lifecycleStage({ annualCase, quarterlyPackages, annualReports, verifications, findings }) {
    if (annualCase?.status === "CLOSED") return 4;
    const verificationActive = verifications.some((item) => ["PLANNED", "IN_VERIFICATION", "REMEDIATION", "VERIFIED", "DELIVERED", "ACKNOWLEDGED"].includes(item.status));
    if (verificationActive || findings.some((item) => !["RESOLVED", "CLOSED"].includes(item.status) && item.metadata?.source === "VERIFIER")) return 3;
    if (annualReports.some((item) => ["GENERATED", "VALIDATED", "INTERNAL_REVIEW", "APPROVED", "LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED", "AMENDMENT_REQUIRED"].includes(item.status))) return 2;
    if (quarterlyPackages.length && quarterlyPackages.every((item) => ["ACKNOWLEDGED", "FROZEN"].includes(item.status))) return 1;
    return 0;
  }

  function buildAnnualProjectView(options = {}) {
    const workflow = options.workflow;
    const year = String(options.year || new Date().getFullYear());
    const closeYear = Number(year) + 1;
    const annualCase = serviceObjects(workflow, "serviceCase", year)[0] || null;
    const annualScope = serviceObjects(workflow, "annualInclusion", year)[0] || null;
    const artifacts = serviceObjects(workflow, "formalArtifact", year);
    const monitoringPlan = artifacts.find((item) => item.metadata?.artifactType === "MONITORING_PLAN") || null;
    const annualReports = artifacts.filter((item) => ["OPERATOR_EMISSIONS_REPORT", "ANNUAL_REPORT"].includes(item.metadata?.artifactType));
    const quarterlyPackages = serviceObjects(workflow, "quarterlyPackage", year);
    const verifications = serviceObjects(workflow, "verification", year);
    const findings = serviceObjects(workflow, "finding", year);
    const materialRequests = serviceObjects(workflow, "workPackage", year).filter((item) => item.metadata?.basis === "annual_scope_and_monitoring_draft");
    const materialRequestItems = materialRequests.map((item) => ({
      id: item.id,
      period: item.quarter,
      owner: item.owner,
      status: item.metadata?.intakeStatus || (item.status === "BLOCKED" ? "BLOCKED" : "READY"),
      evidenceId: item.metadata?.evidenceId || null,
      candidateId: item.metadata?.candidateId || null,
    }));
    const activation = serviceObjects(workflow, "serviceActivation", year)[0] || null;
    const draft = annualCase?.metadata?.wizardDraft || {};
    const closeDate = annualCase?.metadata?.targetCloseDate || `${closeYear}-03-31`;
    const currentPackage = quarterlyPackages.find((item) => !["ACKNOWLEDGED", "FROZEN"].includes(item.status)) || quarterlyPackages[0] || null;
    const included = annualScope?.metadata?.included || draft.products || annualScope?.metadata?.includedProductIds || [];
    const excluded = annualScope?.metadata?.excluded || annualScope?.metadata?.excludedProductIds || [];
    const facilities = annualScope?.metadata?.facilityIds || [];
    const members = annualCase?.metadata?.members || [
      activation?.metadata?.customerOwner && { name: activation.metadata.customerOwner, role: "客户确认" },
      monitoringPlan?.owner && { name: monitoringPlan.owner, role: "专家制备" },
      annualCase?.metadata?.reviewer && { name: annualCase.metadata.reviewer, role: "独立复核" },
      activation?.metadata?.luminoOwner && { name: activation.metadata.luminoOwner, role: "服务协调" },
    ].filter(Boolean);
    const currentPeriod = annualCase?.metadata?.currentPeriod || currentPackage?.quarter || materialRequests[0]?.quarter || options.quarter || "Q1";
    const deadline = currentPackage?.metadata?.deadline || draft.firstDeadline || annualCase?.metadata?.nextMilestoneDate || null;
    const importer = currentPackage?.scope || draft.importer || annualCase?.metadata?.primaryImporter || null;
    const stageIndex = lifecycleStage({ annualCase, quarterlyPackages, annualReports, verifications, findings });
    const stageLabels = [
      ["季度收资与监测维护", `${currentPeriod} · 两项工作同步推进`],
      ["全年数据关账", `${closeYear} 年 1 月`],
      ["年度报告制备", `${closeYear} 年 1–2 月`],
      ["核查、Finding 整改与重算", `${closeYear} 年 3 月起，可能顺延`],
      ["修订交付与封存", "核查问题关闭后"],
    ];

    return {
      year,
      closeYear: String(closeYear),
      organizationName: options.organizationName || "当前企业",
      project: {
        id: annualCase?.id || `CASE-CBAM-${year}`,
        revision: annualCase?.revision || 1,
        status: annualCase?.status || "NOT_STARTED",
        statusLabel: STATUS_LABELS[annualCase?.status] || "未开始",
        locked: annualCase?.status === "CLOSED",
      },
      currentPeriod,
      targetCloseDate: closeDate,
      targetCloseLabel: closeLabel(closeDate, closeYear),
      nextMilestone: annualCase?.metadata?.deliveryStatusLabel || (deadline ? `${shortDate(deadline)}${importer ? ` · ${importer}` : ""}` : "待项目计划确认"),
      importer,
      cadence: draft.cadence || annualCase?.metadata?.cadence || null,
      scope: {
        status: annualScope?.status || "PROPOSED",
        revision: annualScope?.metadata?.masterDataRevision || annualScope?.revision || 1,
        included,
        excluded,
        includedCount: included.length,
        excludedCount: excluded.length,
        facilityCount: facilities.length,
      },
      monitoringPlan: {
        id: monitoringPlan?.id || `MP-CBAM-${year}`,
        revision: monitoringPlan?.revision || 1,
        status: monitoringPlan?.status || "DRAFT",
        owner: monitoringPlan?.owner || "未分配",
      },
      materialRequests: {
        count: materialRequests.length,
        period: materialRequests[0]?.quarter || currentPeriod,
        items: materialRequestItems,
        awaitingConfirmation: materialRequestItems.filter((item) => item.status === "AWAITING_CONFIRMATION").length,
        confirmed: materialRequestItems.filter((item) => item.status === "CONFIRMED").length,
        returned: materialRequestItems.filter((item) => item.status === "RETURNED").length,
      },
      members,
      lifecycle: stageLabels.map(([label, timing], index) => ({ label, timing, state: index < stageIndex ? "done" : index === stageIndex ? "current" : "upcoming" })),
      openFindingCount: findings.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status)).length,
    };
  }

  return { buildAnnualProjectView };
});
