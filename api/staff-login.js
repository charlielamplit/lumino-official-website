/**
 * Staff login for Lumino ops / sales.
 *
 * Modes:
 * - PostgreSQL (LEADS_STORE=postgres and/or DATABASE_URL): personal staff_sessions token
 * - Legacy file/demo: STAFF_USERS + shared LEADS_STAFF_KEY
 *
 * Responses follow Platform API Response Contract v1.
 * Login never bootstraps/reactivates staff rows — use scripts/db/provision-staff.mjs.
 */
import crypto from "node:crypto";
import { platformDb } from "./_lib/platform-db.js";
import {
  createRequestId,
  sendSuccess,
  sendError,
  sendDomainError,
} from "./_lib/platform-api-response.js";

function parseStaffUsers() {
  const raw = String(process.env.STAFF_USERS || "").trim();
  if (!raw) return [];
  return raw.split(",").map((entry) => {
    const parts = entry.split(":").map((part) => part.trim());
    if (parts.length < 3) return null;
    const [email, password, role, ...nameParts] = parts;
    const name = nameParts.join(":") || email.split("@")[0];
    if (!email || !password) return null;
    if (!["sales", "ops", "admin"].includes(role)) return null;
    return {
      email: email.toLowerCase(),
      password,
      role,
      name,
    };
  }).filter(Boolean);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function handlePostgres(request, response, requestId) {
  if (request.method === "GET") {
    try {
      platformDb.assertPostgresMode();
      const provisioned = await platformDb.countActiveStaffUsers();
      return sendSuccess(response, {
        configured: provisioned > 0,
        roles: ["sales", "ops", "admin"],
        authMode: "staff_session",
      }, { requestId });
    } catch (error) {
      return sendDomainError(response, error, { requestId });
    }
  }

  if (request.method !== "POST") {
    return sendError(response, "METHOD_NOT_ALLOWED", { requestId });
  }

  try {
    platformDb.assertPostgresMode();
    const provisioned = await platformDb.countActiveStaffUsers();
    if (!provisioned) {
      return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
    }

    const body = request.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      return sendError(response, "VALIDATION_FAILED", {
        requestId,
        fieldErrors: [
          ...(!email ? [{ field: "email", code: "REQUIRED", messageKey: "api.field_required" }] : []),
          ...(!password ? [{ field: "password", code: "REQUIRED", messageKey: "api.field_required" }] : []),
        ],
      });
    }

    // Intentionally no bootstrapStaffFromEnv here — archived users must stay archived.
    const session = await platformDb.authenticateStaff({ email, password, requestId });
    return sendSuccess(response, {
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      roles: session.user.roles,
      tenantId: session.tenant.id,
      staffKey: session.token,
      expiresInHours: session.expiresInHours,
      expiresAt: session.expiresAt,
      authMode: "staff_session",
    }, { requestId });
  } catch (error) {
    return sendDomainError(response, error, { requestId });
  }
}

function handleLegacy(request, response, requestId) {
  if (request.method === "GET") {
    const users = parseStaffUsers();
    return sendSuccess(response, {
      configured: users.length > 0 && Boolean(process.env.LEADS_STAFF_KEY),
      roles: ["sales", "ops"],
      authMode: "shared_key",
    }, { requestId });
  }

  if (request.method !== "POST") {
    return sendError(response, "METHOD_NOT_ALLOWED", { requestId });
  }

  const staffKey = String(process.env.LEADS_STAFF_KEY || "").trim();
  const users = parseStaffUsers();
  if (!staffKey || !users.length) {
    return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
  }

  const body = request.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return sendError(response, "VALIDATION_FAILED", {
      requestId,
      fieldErrors: [
        ...(!email ? [{ field: "email", code: "REQUIRED", messageKey: "api.field_required" }] : []),
        ...(!password ? [{ field: "password", code: "REQUIRED", messageKey: "api.field_required" }] : []),
      ],
    });
  }

  const matched = users.find((user) => user.email === email);
  if (!matched || !timingSafeEqual(matched.password, password)) {
    return sendError(response, "AUTH_REQUIRED", { requestId });
  }

  return sendSuccess(response, {
    email: matched.email,
    name: matched.name,
    role: matched.role,
    staffKey,
    expiresInHours: 12,
    authMode: "shared_key",
  }, { requestId });
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  const requestId = createRequestId(request);
  if (platformDb.isPostgresMode()) {
    return handlePostgres(request, response, requestId);
  }
  return handleLegacy(request, response, requestId);
}
