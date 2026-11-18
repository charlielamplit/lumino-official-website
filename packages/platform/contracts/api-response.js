"use strict";

const PLATFORM_API_CONTRACT_VERSION = "1.0.0";

const PLATFORM_API_ERROR_CATALOG = Object.freeze({
  VALIDATION_FAILED: Object.freeze({
    httpStatus: 400,
    messageKey: "api.validation_failed",
    publicMessage: "The request contains invalid fields.",
    retryable: false,
    recovery: "CORRECT_INPUT",
  }),
  AUTH_REQUIRED: Object.freeze({
    httpStatus: 401,
    messageKey: "api.auth_required",
    publicMessage: "Authentication is required.",
    retryable: false,
    recovery: "SIGN_IN",
  }),
  TENANT_FORBIDDEN: Object.freeze({
    httpStatus: 403,
    messageKey: "api.tenant_forbidden",
    publicMessage: "The active workspace is not available.",
    retryable: false,
    recovery: "CONTACT_ADMIN",
  }),
  CAPABILITY_FORBIDDEN: Object.freeze({
    httpStatus: 403,
    messageKey: "api.capability_forbidden",
    publicMessage: "This action is not available for the current role.",
    retryable: false,
    recovery: "CONTACT_ADMIN",
  }),
  RESOURCE_NOT_FOUND: Object.freeze({
    httpStatus: 404,
    messageKey: "api.resource_not_found",
    publicMessage: "The requested resource was not found.",
    retryable: false,
    recovery: "RETURN_TO_LIST",
  }),
  METHOD_NOT_ALLOWED: Object.freeze({
    httpStatus: 405,
    messageKey: "api.method_not_allowed",
    publicMessage: "This request method is not supported.",
    retryable: false,
    recovery: "NONE",
  }),
  REVISION_CONFLICT: Object.freeze({
    httpStatus: 409,
    messageKey: "api.revision_conflict",
    publicMessage: "The resource has changed. Refresh and retry.",
    retryable: false,
    recovery: "REFRESH_RESOURCE",
  }),
  RATE_LIMITED: Object.freeze({
    httpStatus: 429,
    messageKey: "api.rate_limited",
    publicMessage: "Too many requests. Try again later.",
    retryable: true,
    recovery: "RETRY_LATER",
  }),
  DEPENDENCY_UNAVAILABLE: Object.freeze({
    httpStatus: 503,
    messageKey: "api.dependency_unavailable",
    publicMessage: "The service is temporarily unavailable.",
    retryable: true,
    recovery: "RETRY_LATER",
  }),
  INTERNAL_ERROR: Object.freeze({
    httpStatus: 500,
    messageKey: "api.internal_error",
    publicMessage: "The request could not be completed.",
    retryable: true,
    recovery: "RETRY_LATER",
  }),
});

const AUTHORITY_TO_API_CODE = Object.freeze({
  AUTH_REQUIRED: "AUTH_REQUIRED",
  TENANT_FORBIDDEN: "TENANT_FORBIDDEN",
  PROJECT_NOT_FOUND: "RESOURCE_NOT_FOUND",
  OBJECT_FORBIDDEN: "RESOURCE_NOT_FOUND",
  OBJECT_REVISION_CONFLICT: "REVISION_CONFLICT",
  CAPABILITY_FORBIDDEN: "CAPABILITY_FORBIDDEN",
  AUTHORITY_DEPENDENCY_INVALID: "INTERNAL_ERROR",
});

function requireRequestId(requestId) {
  const value = String(requestId == null ? "" : requestId).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    throw new TypeError("requestId must be a safe identifier of at most 128 characters");
  }
  return value;
}

function normalizeFieldErrors(fieldErrors) {
  if (!Array.isArray(fieldErrors)) return [];
  return fieldErrors.slice(0, 100).map((item) => ({
    field: String(item?.field == null ? "" : item.field).slice(0, 160),
    code: String(item?.code == null ? "INVALID" : item.code).slice(0, 80),
    messageKey: String(item?.messageKey == null ? "api.field_invalid" : item.messageKey).slice(0, 160),
  })).filter((item) => item.field);
}

function buildSuccessResponse(data, options = {}) {
  if (data === undefined) throw new TypeError("data is required");
  const response = {
    ok: true,
    contractVersion: PLATFORM_API_CONTRACT_VERSION,
    requestId: requireRequestId(options.requestId),
    data,
  };
  if (options.revision != null) {
    if (!Number.isInteger(options.revision) || options.revision < 1) {
      throw new TypeError("revision must be a positive integer");
    }
    response.meta = { revision: options.revision };
  }
  return response;
}

function buildErrorResponse(code, options = {}) {
  const safeCode = Object.hasOwn(PLATFORM_API_ERROR_CATALOG, code) ? code : "INTERNAL_ERROR";
  const definition = PLATFORM_API_ERROR_CATALOG[safeCode];
  const error = {
    code: safeCode,
    messageKey: definition.messageKey,
    message: definition.publicMessage,
    retryable: definition.retryable,
    recovery: definition.recovery,
  };
  if (safeCode === "VALIDATION_FAILED") {
    const fieldErrors = normalizeFieldErrors(options.fieldErrors);
    if (fieldErrors.length) error.fieldErrors = fieldErrors;
  }
  if (options.retryAfterSeconds != null) {
    if (!definition.retryable
      || !Number.isInteger(options.retryAfterSeconds)
      || options.retryAfterSeconds < 1
      || options.retryAfterSeconds > 86400) {
      throw new TypeError("retryAfterSeconds requires a retryable error and an integer from 1 to 86400");
    }
    error.retryAfterSeconds = options.retryAfterSeconds;
  }
  return {
    httpStatus: definition.httpStatus,
    body: {
      ok: false,
      contractVersion: PLATFORM_API_CONTRACT_VERSION,
      requestId: requireRequestId(options.requestId),
      error,
    },
  };
}

function mapAuthorityError(error, options = {}) {
  const apiCode = AUTHORITY_TO_API_CODE[error?.code] || "INTERNAL_ERROR";
  return buildErrorResponse(apiCode, options);
}

module.exports = {
  AUTHORITY_TO_API_CODE,
  PLATFORM_API_CONTRACT_VERSION,
  PLATFORM_API_ERROR_CATALOG,
  buildErrorResponse,
  buildSuccessResponse,
  mapAuthorityError,
};
