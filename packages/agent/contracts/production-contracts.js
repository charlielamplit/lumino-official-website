(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoAgentProductionContracts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTRACT_VERSION = "1.0.0";
  const IDEMPOTENCY_MATERIAL_VERSION = "v1";

  const EXECUTION_STATUSES = Object.freeze([
    "REQUESTED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED",
  ]);
  const TASK_STATUSES = Object.freeze([
    "QUEUED", "PROCESSING", "VALIDATING", "SUCCEEDED", "FAILED", "CANCELLED", "SUPERSEDED",
  ]);
  const CANDIDATE_STATUSES = Object.freeze([
    "DRAFT", "VALIDATING", "READY_FOR_REVIEW", "VALIDATION_FAILED",
    "CONFIRMED", "REJECTED", "APPLY_FAILED", "APPLIED", "SUPERSEDED",
  ]);

  const TRANSITIONS = Object.freeze({
    execution: Object.freeze({
      REQUESTED: Object.freeze(["RUNNING", "FAILED", "CANCELLED"]),
      RUNNING: Object.freeze(["SUCCEEDED", "FAILED", "CANCELLED"]),
      SUCCEEDED: Object.freeze([]),
      FAILED: Object.freeze([]),
      CANCELLED: Object.freeze([]),
    }),
    task: Object.freeze({
      QUEUED: Object.freeze(["PROCESSING", "FAILED", "CANCELLED"]),
      PROCESSING: Object.freeze(["VALIDATING", "FAILED", "CANCELLED", "SUPERSEDED"]),
      VALIDATING: Object.freeze(["SUCCEEDED", "FAILED", "SUPERSEDED"]),
      SUCCEEDED: Object.freeze(["SUPERSEDED"]),
      FAILED: Object.freeze(["QUEUED"]),
      CANCELLED: Object.freeze([]),
      SUPERSEDED: Object.freeze([]),
    }),
    candidate: Object.freeze({
      DRAFT: Object.freeze(["VALIDATING", "SUPERSEDED"]),
      VALIDATING: Object.freeze(["READY_FOR_REVIEW", "VALIDATION_FAILED", "SUPERSEDED"]),
      READY_FOR_REVIEW: Object.freeze(["CONFIRMED", "REJECTED", "SUPERSEDED"]),
      VALIDATION_FAILED: Object.freeze([]),
      CONFIRMED: Object.freeze(["APPLIED", "APPLY_FAILED"]),
      REJECTED: Object.freeze([]),
      APPLY_FAILED: Object.freeze(["CONFIRMED"]),
      APPLIED: Object.freeze([]),
      SUPERSEDED: Object.freeze([]),
    }),
  });

  const ERROR_CATALOG = Object.freeze({
    CONTRACT_INVALID: Object.freeze({ category: "contract", httpStatus: 400, retryable: false }),
    IDEMPOTENCY_INPUT_INVALID: Object.freeze({ category: "contract", httpStatus: 400, retryable: false }),
    AUTH_REQUIRED: Object.freeze({ category: "authorization", httpStatus: 401, retryable: false }),
    TENANT_FORBIDDEN: Object.freeze({ category: "authorization", httpStatus: 403, retryable: false }),
    PROJECT_NOT_FOUND: Object.freeze({ category: "context", httpStatus: 404, retryable: false }),
    OBJECT_FORBIDDEN: Object.freeze({ category: "authorization", httpStatus: 403, retryable: false }),
    OBJECT_REVISION_CONFLICT: Object.freeze({ category: "context", httpStatus: 409, retryable: false }),
    CONTEXT_VERSION_UNSUPPORTED: Object.freeze({ category: "contract", httpStatus: 400, retryable: false }),
    CAPABILITY_NOT_FOUND: Object.freeze({ category: "execution", httpStatus: 404, retryable: false }),
    PROVIDER_TIMEOUT: Object.freeze({ category: "provider", httpStatus: 504, retryable: true }),
    PROVIDER_RATE_LIMITED: Object.freeze({ category: "provider", httpStatus: 429, retryable: true }),
    PROVIDER_UNAVAILABLE: Object.freeze({ category: "provider", httpStatus: 503, retryable: true }),
    MODEL_OUTPUT_INVALID: Object.freeze({ category: "validation", httpStatus: 422, retryable: false }),
    TOOL_FAILED: Object.freeze({ category: "execution", httpStatus: 502, retryable: true }),
    IDEMPOTENCY_CONFLICT: Object.freeze({ category: "task", httpStatus: 409, retryable: false }),
    TASK_NOT_FOUND: Object.freeze({ category: "task", httpStatus: 404, retryable: false }),
    TASK_NOT_CANCELLABLE: Object.freeze({ category: "task", httpStatus: 409, retryable: false }),
    TASK_NOT_RETRYABLE: Object.freeze({ category: "task", httpStatus: 409, retryable: false }),
    TASK_ATTEMPTS_EXHAUSTED: Object.freeze({ category: "task", httpStatus: 409, retryable: false }),
    TASK_SUPERSEDED: Object.freeze({ category: "task", httpStatus: 409, retryable: false }),
    SCHEMA_INVALID: Object.freeze({ category: "validation", httpStatus: 422, retryable: false }),
    BUSINESS_RULE_FAILED: Object.freeze({ category: "validation", httpStatus: 422, retryable: false }),
    SOURCE_VERSION_STALE: Object.freeze({ category: "validation", httpStatus: 409, retryable: false }),
    CONFIRMATION_FORBIDDEN: Object.freeze({ category: "authorization", httpStatus: 403, retryable: false }),
    APPLY_FAILED: Object.freeze({ category: "domain", httpStatus: 409, retryable: true }),
  });

  function contractError(message, code) {
    const error = new Error(message);
    error.code = code || "CONTRACT_INVALID";
    return error;
  }

  function major(version) {
    const match = String(version || "").match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
    return match ? Number(match[1]) : null;
  }

  function isCompatibleVersion(received, supported) {
    const receivedMajor = major(received);
    const supportedMajor = major(supported || CONTRACT_VERSION);
    return receivedMajor !== null && supportedMajor !== null && receivedMajor === supportedMajor;
  }

  function canTransition(kind, from, to, facts) {
    const graph = TRANSITIONS[kind];
    if (!(graph && graph[from] && graph[from].includes(to))) return false;
    if (kind === "task" && from === "FAILED" && to === "QUEUED") {
      facts = facts || {};
      return facts.retryable === true
        && Number.isInteger(facts.attempt)
        && Number.isInteger(facts.maxAttempts)
        && facts.attempt < facts.maxAttempts;
    }
    return true;
  }

  function errorDefinition(code) {
    return ERROR_CATALOG[code] || null;
  }

  function requireSegment(value, field) {
    const normalized = String(value == null ? "" : value).trim();
    if (!normalized) throw contractError(`${field} is required`, "IDEMPOTENCY_INPUT_INVALID");
    return encodeURIComponent(normalized);
  }

  function idempotencyMaterial(input) {
    input = input || {};
    const context = input.context || {};
    const objectRef = context.objectRef || {};
    if (!Number.isInteger(objectRef.revision) || objectRef.revision < 1) {
      throw contractError("context.objectRef.revision must be a positive integer", "IDEMPOTENCY_INPUT_INVALID");
    }
    const normalizedInputHash = String(input.normalizedInputHash || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalizedInputHash)) {
      throw contractError("normalizedInputHash must be a SHA-256 hex digest", "IDEMPOTENCY_INPUT_INVALID");
    }
    return [
      IDEMPOTENCY_MATERIAL_VERSION,
      requireSegment(context.tenantId, "context.tenantId"),
      requireSegment(context.annualProjectId, "context.annualProjectId"),
      requireSegment(input.operationType, "operationType"),
      requireSegment(objectRef.type, "context.objectRef.type"),
      requireSegment(objectRef.id, "context.objectRef.id"),
      String(objectRef.revision),
      normalizedInputHash,
    ].join("|");
  }

  return {
    CONTRACT_VERSION,
    IDEMPOTENCY_MATERIAL_VERSION,
    EXECUTION_STATUSES,
    TASK_STATUSES,
    CANDIDATE_STATUSES,
    TRANSITIONS,
    ERROR_CATALOG,
    isCompatibleVersion,
    canTransition,
    errorDefinition,
    idempotencyMaterial,
  };
});
