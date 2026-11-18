const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  AUTHORITY_TO_API_CODE,
  PLATFORM_API_CONTRACT_VERSION,
  PLATFORM_API_ERROR_CATALOG,
  buildErrorResponse,
  buildSuccessResponse,
  mapAuthorityError,
} = require("../contracts/api-response.js");

test("success responses are versioned, correlated and optionally revision-bound", () => {
  assert.deepEqual(buildSuccessResponse({ lead: { id: "LM-1" } }, {
    requestId: "REQ-1",
    revision: 3,
  }), {
    ok: true,
    contractVersion: PLATFORM_API_CONTRACT_VERSION,
    requestId: "REQ-1",
    data: { lead: { id: "LM-1" } },
    meta: { revision: 3 },
  });
});

test("request identifiers and revisions fail closed", () => {
  assert.throws(() => buildSuccessResponse({}, {}), /requestId/);
  assert.throws(() => buildSuccessResponse(undefined, { requestId: "REQ-1" }), /data/);
  assert.throws(() => buildSuccessResponse({}, { requestId: "REQ-1\nforged" }), /requestId/);
  assert.throws(() => buildSuccessResponse({}, { requestId: "REQ-1", revision: 0 }), /revision/);
  assert.throws(() => buildErrorResponse("AUTH_REQUIRED", { requestId: "" }), /requestId/);
});

test("validation errors expose bounded field codes without raw values", () => {
  const result = buildErrorResponse("VALIDATION_FAILED", {
    requestId: "REQ-2",
    fieldErrors: [{
      field: "email",
      code: "FORMAT",
      messageKey: "lead.email.invalid",
      value: "private@example.com",
      databaseDetail: "must not leak",
    }],
  });
  assert.equal(result.httpStatus, 400);
  assert.deepEqual(result.body.error.fieldErrors, [{
    field: "email",
    code: "FORMAT",
    messageKey: "lead.email.invalid",
  }]);
  assert.doesNotMatch(JSON.stringify(result), /private@example|databaseDetail|must not leak/);
});

test("unknown internal errors never leak messages or stack details", () => {
  const result = buildErrorResponse("PG_UNIQUE_VIOLATION", {
    requestId: "REQ-3",
    message: "duplicate key value violates unique constraint tenants_slug_key",
    detail: "sensitive database detail",
  });
  assert.equal(result.httpStatus, 500);
  assert.equal(result.body.error.code, "INTERNAL_ERROR");
  assert.equal(result.body.error.message, PLATFORM_API_ERROR_CATALOG.INTERNAL_ERROR.publicMessage);
  assert.doesNotMatch(JSON.stringify(result), /tenants_slug_key|sensitive database detail/);
});

test("authority errors map to stable public semantics without cross-tenant enumeration", () => {
  assert.equal(AUTHORITY_TO_API_CODE.OBJECT_FORBIDDEN, "RESOURCE_NOT_FOUND");
  assert.equal(AUTHORITY_TO_API_CODE.PROJECT_NOT_FOUND, "RESOURCE_NOT_FOUND");
  const missing = mapAuthorityError({ code: "OBJECT_FORBIDDEN", detail: "object exists in TNT-OTHER" }, { requestId: "REQ-4" });
  assert.equal(missing.httpStatus, 404);
  assert.equal(missing.body.error.code, "RESOURCE_NOT_FOUND");
  assert.doesNotMatch(JSON.stringify(missing), /TNT-OTHER/);
});

test("recovery actions distinguish correction, refresh, sign-in and retry", () => {
  assert.equal(PLATFORM_API_ERROR_CATALOG.VALIDATION_FAILED.recovery, "CORRECT_INPUT");
  assert.equal(PLATFORM_API_ERROR_CATALOG.AUTH_REQUIRED.recovery, "SIGN_IN");
  assert.equal(PLATFORM_API_ERROR_CATALOG.REVISION_CONFLICT.recovery, "REFRESH_RESOURCE");
  assert.equal(PLATFORM_API_ERROR_CATALOG.DEPENDENCY_UNAVAILABLE.recovery, "RETRY_LATER");
  assert.equal(PLATFORM_API_ERROR_CATALOG.DEPENDENCY_UNAVAILABLE.retryable, true);
  const retry = buildErrorResponse("RATE_LIMITED", { requestId: "REQ-5", retryAfterSeconds: 30 });
  assert.equal(retry.body.error.retryAfterSeconds, 30);
  assert.throws(() => buildErrorResponse("AUTH_REQUIRED", { requestId: "REQ-5", retryAfterSeconds: 30 }), /retryAfterSeconds/);
});

test("machine-readable schema enums stay aligned with the implementation catalogs", () => {
  const schemaPath = path.join(__dirname, "..", "schemas", "api-error-response.schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const schemaCodes = schema.properties.error.properties.code.enum.slice().sort();
  const catalogCodes = Object.keys(PLATFORM_API_ERROR_CATALOG).sort();
  assert.deepEqual(schemaCodes, catalogCodes);
  for (const apiCode of Object.values(AUTHORITY_TO_API_CODE)) {
    assert.ok(Object.hasOwn(PLATFORM_API_ERROR_CATALOG, apiCode));
  }
});
