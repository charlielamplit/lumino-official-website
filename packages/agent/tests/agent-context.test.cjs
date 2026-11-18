const test = require("node:test");
const assert = require("node:assert/strict");
const AgentContext = require("../domain/agent-context.js");

function workflow(objects) {
  const rows = objects.map((item) => ({ revision: 1, metadata: { serviceId: "cbam", ...(item.metadata || {}) }, ...item }));
  return {
    list(filter = {}) {
      return rows.filter((item) => Object.entries(filter).every(([key, value]) => String(item[key]) === String(value)));
    },
    get(id) { return rows.find((item) => item.id === id) || null; },
  };
}

const engine = workflow([
  { id: "CASE-CBAM-2026", type: "serviceCase", year: "2026", status: "COLLECTING" },
  { id: "SCOPE-CBAM-2026", type: "annualInclusion", year: "2026", status: "IN_SCOPE" },
  { id: "MP-CBAM-2026-R3", type: "formalArtifact", year: "2026", status: "APPROVED", metadata: { artifactType: "MONITORING_PLAN" } },
  { id: "PKG-2026-Q3-NORDWERK", type: "quarterlyPackage", year: "2026", quarter: "Q3", status: "COLLECTING" },
  { id: "RUN-CBAM-2026Q3-001", type: "calculationRun", year: "2026", quarter: "Q3", status: "CURRENT" },
  { id: "CASE-CBAM-2027", type: "serviceCase", year: "2027", status: "SCOPING" },
]);

test("context binds annual project, workstream and quarterly object", () => {
  const context = AgentContext.build({ workflow: engine, state: { currentService: "cbam", year: "2026", quarter: "Q3", page: "data-calculation", cbamDataView: "data" } });
  assert.equal(context.annualProjectId, "CASE-CBAM-2026");
  assert.equal(context.workstream, "data_collection");
  assert.deepEqual(context.objectRef, { type: "quarterlyPackage", id: "PKG-2026-Q3-NORDWERK", revision: 1 });
  assert.match(context.conversationId, /CASE-CBAM-2026:data_collection:PKG-2026-Q3-NORDWERK:Q3$/);
  assert.equal(AgentContext.validate(context).valid, true);
});

test("products, monitoring plan and calculation resolve to business objects", () => {
  const base = { currentService: "cbam", year: "2026", quarter: "Q3" };
  assert.equal(AgentContext.build({ workflow: engine, state: { ...base, page: "products" } }).objectRef.id, "SCOPE-CBAM-2026");
  assert.equal(AgentContext.build({ workflow: engine, state: { ...base, page: "monitoring-plan" } }).objectRef.id, "MP-CBAM-2026-R3");
  const calculation = AgentContext.build({ workflow: engine, state: { ...base, page: "data-calculation", cbamDataView: "results" } });
  assert.equal(calculation.workstream, "calculation");
  assert.equal(calculation.objectRef.id, "RUN-CBAM-2026Q3-001");
  assert.equal(AgentContext.preferredPlaybook(calculation), "p07");
});

test("year switch creates an isolated conversation key", () => {
  const state = { currentService: "cbam", quarter: "Q1", page: "annual-project" };
  const current = AgentContext.build({ workflow: engine, state: { ...state, year: "2026" } });
  const next = AgentContext.build({ workflow: engine, state: { ...state, year: "2027" } });
  assert.notEqual(current.conversationId, next.conversationId);
  assert.equal(AgentContext.projectStarted(current, engine), true);
  assert.equal(AgentContext.projectStarted(next, engine), false);
});

test("invalid object references are rejected", () => {
  const context = AgentContext.build({ workflow: engine, state: { currentService: "cbam", year: "2026", quarter: "Q3", page: "work" } });
  context.objectRef = { type: "serviceCase" };
  assert.deepEqual(AgentContext.validate(context), { valid: false, errors: ["OBJECT_REF_INVALID"] });
});
