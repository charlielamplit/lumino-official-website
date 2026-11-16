const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const contracts = require("../contracts/production-contracts.js");

const schemaDir = path.join(__dirname, "..", "schemas");
const schemaFiles = [
  "agent-context.schema.json",
  "agent-execution-envelope.schema.json",
  "agent-conversation.schema.json",
  "agent-audit-event.schema.json",
  "agent-task.schema.json",
  "agent-validation-result.schema.json",
  "agent-candidate-result.schema.json",
];

function readSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(schemaDir, name), "utf8"));
}

test("production Agent schemas are versioned Draft 2020-12 closed objects with unique ids", () => {
  const ids = new Set();
  for (const file of schemaFiles) {
    const schema = readSchema(file);
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema", file);
    assert.match(schema.$id, /\/1\.0\.0$/, file);
    assert.equal(schema.type, "object", file);
    assert.equal(schema.additionalProperties, false, file);
    assert.ok(Array.isArray(schema.required) && schema.required.length > 0, file);
    assert.equal(ids.has(schema.$id), false, `duplicate schema id: ${schema.$id}`);
    ids.add(schema.$id);
  }
});

test("all external schema references resolve to a schema in the contract set", () => {
  const schemas = schemaFiles.map(readSchema);
  const ids = new Set(schemas.map((schema) => schema.$id));
  for (const schema of schemas) {
    const refs = JSON.stringify(schema).match(/https:\/\/lumino\.example\/schemas\/[A-Za-z0-9-]+\/1\.0\.0/g) || [];
    for (const ref of refs) assert.equal(ids.has(ref), true, `${schema.$id} references missing ${ref}`);
  }
});

test("schema status enums stay aligned with production contract constants", () => {
  assert.deepEqual(readSchema("agent-execution-envelope.schema.json").properties.status.enum, contracts.EXECUTION_STATUSES);
  assert.deepEqual(readSchema("agent-task.schema.json").properties.status.enum, contracts.TASK_STATUSES);
  assert.deepEqual(readSchema("agent-candidate-result.schema.json").properties.status.enum, contracts.CANDIDATE_STATUSES);
});

test("contract version compatibility is major-version strict", () => {
  assert.equal(contracts.CONTRACT_VERSION, "1.0.0");
  assert.equal(contracts.isCompatibleVersion("1.4.2"), true);
  assert.equal(contracts.isCompatibleVersion("2.0.0"), false);
  assert.equal(contracts.isCompatibleVersion("invalid"), false);
  assert.equal(contracts.isCompatibleVersion("1.not-semver"), false);
  assert.equal(contracts.isCompatibleVersion("1.0"), false);
});

test("execution, task and candidate transitions enforce terminal boundaries", () => {
  assert.equal(contracts.canTransition("execution", "REQUESTED", "RUNNING"), true);
  assert.equal(contracts.canTransition("execution", "SUCCEEDED", "RUNNING"), false);
  assert.equal(contracts.canTransition("task", "FAILED", "QUEUED"), false);
  assert.equal(contracts.canTransition("task", "FAILED", "QUEUED", {
    retryable: true, attempt: 1, maxAttempts: 3,
  }), true);
  assert.equal(contracts.canTransition("task", "FAILED", "QUEUED", {
    retryable: true, attempt: 3, maxAttempts: 3,
  }), false);
  assert.equal(contracts.canTransition("task", "PROCESSING", "SUPERSEDED"), true);
  assert.equal(contracts.canTransition("task", "CANCELLED", "PROCESSING"), false);
  assert.equal(contracts.canTransition("candidate", "READY_FOR_REVIEW", "CONFIRMED"), true);
  assert.equal(contracts.canTransition("candidate", "APPLY_FAILED", "CONFIRMED"), true);
  assert.equal(contracts.canTransition("candidate", "APPLIED", "SUPERSEDED"), false);
});

test("idempotency material binds tenant, project, operation, object revision and input hash", () => {
  const base = {
    operationType: "CBAM_FILE_PARSE",
    context: {
      tenantId: "TNT-0018",
      annualProjectId: "CASE-CBAM-2026",
      objectRef: { type: "quarterlyPackage", id: "PKG-2026-Q3", revision: 3 },
    },
    normalizedInputHash: "a".repeat(64),
  };
  const material = contracts.idempotencyMaterial(base);
  assert.equal(material, `v1|TNT-0018|CASE-CBAM-2026|CBAM_FILE_PARSE|quarterlyPackage|PKG-2026-Q3|3|${"a".repeat(64)}`);

  const variants = [
    { ...base, operationType: "CBAM_CN_CODE_SUGGEST" },
    { ...base, context: { ...base.context, tenantId: "TNT-OTHER" } },
    { ...base, context: { ...base.context, annualProjectId: "CASE-CBAM-2027" } },
    { ...base, context: { ...base.context, objectRef: { ...base.context.objectRef, revision: 4 } } },
    { ...base, normalizedInputHash: "b".repeat(64) },
  ];
  for (const variant of variants) assert.notEqual(contracts.idempotencyMaterial(variant), material);
});

test("idempotency material rejects missing object versions and non-SHA-256 hashes", () => {
  assert.throws(() => contracts.idempotencyMaterial({}), { code: "IDEMPOTENCY_INPUT_INVALID" });
  assert.throws(() => contracts.idempotencyMaterial({
    operationType: "CBAM_FILE_PARSE",
    context: { tenantId: "T", annualProjectId: "P", objectRef: { type: "file", id: "F", revision: 0 } },
    normalizedInputHash: "a".repeat(64),
  }), { code: "IDEMPOTENCY_INPUT_INVALID" });
  assert.throws(() => contracts.idempotencyMaterial({
    operationType: "CBAM_FILE_PARSE",
    context: { tenantId: "T", annualProjectId: "P", objectRef: { type: "file", id: "F", revision: 1 } },
    normalizedInputHash: "not-a-hash",
  }), { code: "IDEMPOTENCY_INPUT_INVALID" });
});

test("error catalog exposes stable categories, HTTP status and retry policy", () => {
  for (const [code, definition] of Object.entries(contracts.ERROR_CATALOG)) {
    assert.match(code, /^[A-Z0-9_]+$/);
    assert.match(definition.category, /^[a-z]+$/);
    assert.ok(Number.isInteger(definition.httpStatus) && definition.httpStatus >= 400 && definition.httpStatus <= 599);
    assert.equal(typeof definition.retryable, "boolean");
    assert.deepEqual(contracts.errorDefinition(code), definition);
  }
  assert.equal(contracts.errorDefinition("NOT_REAL"), null);
  assert.equal(contracts.errorDefinition("PROVIDER_TIMEOUT").retryable, true);
  assert.equal(contracts.errorDefinition("OBJECT_REVISION_CONFLICT").retryable, false);
  assert.equal(contracts.errorDefinition("IDEMPOTENCY_INPUT_INVALID").httpStatus, 400);
  assert.equal(contracts.errorDefinition("CONTRACT_INVALID").httpStatus, 400);
});

test("attempt-level provenance and terminal-state constraints are present in schemas", () => {
  const execution = readSchema("agent-execution-envelope.schema.json");
  const candidate = readSchema("agent-candidate-result.schema.json");
  const validation = readSchema("agent-validation-result.schema.json");
  const audit = readSchema("agent-audit-event.schema.json");

  assert.ok(execution.required.includes("executionId"));
  assert.ok(execution.required.includes("attempt"));
  assert.ok(candidate.required.includes("executionId"));
  assert.ok(validation.required.includes("executionId"));
  assert.ok(audit.properties.eventType.enum.includes("CANDIDATE_TRANSITIONED"));
  assert.ok(audit.properties.eventType.enum.includes("VALIDATION_FINISHED"));
  assert.deepEqual(audit.properties.actor.properties.actorType.enum, [
    "USER", "SYSTEM", "WORKER", "SERVICE_PRINCIPAL",
  ]);
  assert.match(JSON.stringify(candidate.allOf), /domainCommandId/);
  assert.match(JSON.stringify(candidate.allOf), /appliedObjectRef/);
});
