/**
 * ESM adapter for Platform API Response Contract v1.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const contract = require(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../packages/platform/contracts/api-response.js",
));

const DOMAIN_TO_API_CODE = Object.freeze({
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_QUERY_KEY_REJECTED: "AUTH_REQUIRED",
  AUTH_INVALID: "AUTH_REQUIRED",
  TENANT_FORBIDDEN: "TENANT_FORBIDDEN",
  FORBIDDEN_ROLE: "CAPABILITY_FORBIDDEN",
  CAPABILITY_FORBIDDEN: "CAPABILITY_FORBIDDEN",
  INVALID_STATUS: "VALIDATION_FAILED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  TENANT_REQUIRED: "VALIDATION_FAILED",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  REVISION_CONFLICT: "REVISION_CONFLICT",
  DB_UNAVAILABLE: "DEPENDENCY_UNAVAILABLE",
  DB_MODE_DISABLED: "DEPENDENCY_UNAVAILABLE",
  DEPENDENCY_UNAVAILABLE: "DEPENDENCY_UNAVAILABLE",
});

export function createRequestId(request) {
  const incoming = String(
    request?.headers?.["x-request-id"]
      || request?.headers?.["x-correlation-id"]
      || "",
  ).trim();
  if (/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(incoming)) return incoming;
  return `REQ-${crypto.randomBytes(8).toString("hex")}`;
}

export function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  if (body?.requestId) response.setHeader("X-Request-Id", body.requestId);
  response.end(JSON.stringify(body));
}

export function sendSuccess(response, data, { requestId, revision, httpStatus = 200 } = {}) {
  const body = contract.buildSuccessResponse(data, { requestId, revision });
  sendJson(response, httpStatus, body);
}

export function sendError(response, code, { requestId, fieldErrors, retryAfterSeconds } = {}) {
  const built = contract.buildErrorResponse(code, { requestId, fieldErrors, retryAfterSeconds });
  if (retryAfterSeconds && built.body.error.retryable) {
    response.setHeader("Retry-After", String(retryAfterSeconds));
  }
  sendJson(response, built.httpStatus, built.body);
}

export function sendDomainError(response, error, { requestId, fieldErrors } = {}) {
  const mapped = DOMAIN_TO_API_CODE[error?.code];
  if (mapped) {
    return sendError(response, mapped, {
      requestId,
      fieldErrors: fieldErrors || error.fieldErrors,
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }
  if (error?.httpStatus === 400) {
    return sendError(response, "VALIDATION_FAILED", { requestId, fieldErrors });
  }
  if (error?.httpStatus === 401) {
    return sendError(response, "AUTH_REQUIRED", { requestId });
  }
  if (error?.httpStatus === 403) {
    return sendError(response, "CAPABILITY_FORBIDDEN", { requestId });
  }
  if (error?.httpStatus === 404) {
    return sendError(response, "RESOURCE_NOT_FOUND", { requestId });
  }
  if (error?.httpStatus === 405) {
    return sendError(response, "METHOD_NOT_ALLOWED", { requestId });
  }
  if (error?.httpStatus === 409) {
    return sendError(response, "REVISION_CONFLICT", { requestId });
  }
  if (error?.httpStatus === 503) {
    return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
  }
  return sendError(response, "INTERNAL_ERROR", { requestId });
}

export const {
  PLATFORM_API_CONTRACT_VERSION,
  PLATFORM_API_ERROR_CATALOG,
  buildSuccessResponse,
  buildErrorResponse,
} = contract;
