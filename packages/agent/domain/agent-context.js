(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LuminoAgentContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const STARTED_CASE_STATES = new Set([
    "COLLECTING", "IN_PROGRESS", "READY_FOR_REVIEW", "APPROVED", "LOCKED",
    "SHARED", "DELIVERED", "ACKNOWLEDGED", "REMEDIATION", "CLOSED",
  ]);

  const WORKSTREAM_PLAYBOOK = Object.freeze({
    annual_project: "p02",
    current_work: "p06",
    scope_master_data: "p03",
    monitoring_plan: "p04",
    data_collection: "p06",
    calculation: "p07",
    cost_scenario: "p07",
    report_delivery: "p08",
    annual_lifecycle: "p10",
  });

  function list(workflow, filter) {
    if (!workflow || typeof workflow.list !== "function") return [];
    return workflow.list(filter || {}) || [];
  }

  function yearObjects(workflow, type, year) {
    return list(workflow, { type, year: String(year) })
      .filter((item) => !item.metadata?.serviceId || item.metadata.serviceId === "cbam");
  }

  function currentQuarter(items, quarter) {
    return items.find((item) => item.quarter === quarter) || items.find((item) => item.status !== "CLOSED") || items[0] || null;
  }

  function annualCase(workflow, year) {
    return yearObjects(workflow, "serviceCase", year)[0] || null;
  }

  function monitoringPlan(workflow, year) {
    return yearObjects(workflow, "formalArtifact", year)
      .find((item) => item.metadata?.artifactType === "MONITORING_PLAN") || null;
  }

  function resolveTarget(options) {
    const workflow = options.workflow;
    const state = options.state || {};
    const year = String(options.serviceYear || state.year || "");
    const quarter = options.quarter || state.quarter || null;
    const pageId = options.pageId || state.page || "";
    const dataView = options.dataView || state.cbamDataView || "data";
    const annual = annualCase(workflow, year);
    let workstream = "current_work";
    let object = annual;

    if (pageId === "annual-project" || pageId === "onboarding") {
      workstream = "annual_project";
    } else if (pageId === "products") {
      workstream = "scope_master_data";
      object = yearObjects(workflow, "annualInclusion", year)[0] || annual;
    } else if (pageId === "monitoring-plan") {
      workstream = "monitoring_plan";
      object = monitoringPlan(workflow, year) || annual;
    } else if (pageId === "data" || (pageId === "data-calculation" && dataView === "data")) {
      workstream = "data_collection";
      object = currentQuarter(yearObjects(workflow, "quarterlyPackage", year), quarter)
        || currentQuarter(yearObjects(workflow, "workPackage", year), quarter)
        || annual;
    } else if (pageId === "results" || (pageId === "data-calculation" && dataView === "results")) {
      workstream = "calculation";
      object = currentQuarter(yearObjects(workflow, "calculationRun", year), quarter) || annual;
    } else if (pageId === "data-calculation" && dataView === "cost") {
      workstream = "cost_scenario";
      object = currentQuarter(yearObjects(workflow, "calculationRun", year), quarter) || annual;
    } else if (pageId === "deliverables") {
      workstream = "report_delivery";
      object = currentQuarter(yearObjects(workflow, "quarterlyPackage", year), quarter)
        || yearObjects(workflow, "formalArtifact", year).find((item) => item.metadata?.artifactType !== "MONITORING_PLAN")
        || annual;
    } else if (pageId === "roadmap") {
      workstream = "annual_lifecycle";
    }

    return { annual, object, workstream, year, quarter, pageId };
  }

  function refFor(object) {
    if (!object) return null;
    return { type: object.type || "unknown", id: object.id, revision: object.revision || object.version || 1 };
  }

  function segment(value) {
    return String(value || "none").replace(/[^A-Za-z0-9_.-]/g, "-");
  }

  function contextKey(context) {
    if (!context) return "agent:none";
    const objectId = context.objectRef?.id || "none";
    const period = context.period?.quarter || "annual";
    return ["agent", context.annualProjectId || "none", context.workstream || "general", objectId, period]
      .map(segment).join(":");
  }

  function build(options = {}) {
    const state = options.state || {};
    const target = resolveTarget(options);
    const objectRef = refFor(target.object);
    const base = {
      contextVersion: VERSION,
      serviceId: options.serviceId || state.currentService || "cbam",
      tenantId: options.tenantId || state.tenantId || "TNT-0018",
      annualProjectId: target.annual?.id || null,
      serviceYear: target.year || null,
      workstream: target.workstream,
      objectRef,
      period: target.quarter ? { quarter: target.quarter } : {},
      pageId: target.pageId,
    };
    const key = contextKey(base);
    return { ...base, conversationId: key, correlationId: `ctx:${key.slice("agent:".length)}` };
  }

  function validate(context) {
    const errors = [];
    if (!context || typeof context !== "object") return { valid: false, errors: ["CONTEXT_REQUIRED"] };
    if (context.contextVersion !== VERSION) errors.push("CONTEXT_VERSION_UNSUPPORTED");
    if (!context.serviceId) errors.push("SERVICE_REQUIRED");
    if (!context.serviceYear) errors.push("SERVICE_YEAR_REQUIRED");
    if (!context.workstream) errors.push("WORKSTREAM_REQUIRED");
    if (context.objectRef && (!context.objectRef.type || !context.objectRef.id)) errors.push("OBJECT_REF_INVALID");
    return { valid: errors.length === 0, errors };
  }

  function projectStarted(context, workflow) {
    if (!context?.annualProjectId || !workflow || typeof workflow.get !== "function") return false;
    const project = workflow.get(context.annualProjectId);
    return Boolean(project?.metadata?.projectCreated || project?.metadata?.collectionStarted || STARTED_CASE_STATES.has(project?.status));
  }

  function preferredPlaybook(context) {
    return WORKSTREAM_PLAYBOOK[context?.workstream] || null;
  }

  return { VERSION, WORKSTREAM_PLAYBOOK, build, validate, contextKey, projectStarted, preferredPlaybook, resolveTarget };
});
