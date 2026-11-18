/**
 * Staff login for Lumino ops / sales.
 *
 * Modes:
 * - PostgreSQL (LEADS_STORE=postgres and/or DATABASE_URL): personal staff_sessions token
 * - Legacy file/demo: STAFF_USERS + shared LEADS_STAFF_KEY
 */
import crypto from "node:crypto";
import { platformDb } from "./_lib/platform-db.js";

function json(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

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

async function handlePostgres(request, response) {
  if (request.method === "GET") {
    const users = parseStaffUsers();
    try {
      platformDb.assertPostgresMode();
      return json(response, 200, {
        ok: true,
        configured: users.length > 0,
        roles: ["sales", "ops", "admin"],
        authMode: "staff_session",
      });
    } catch (error) {
      return json(response, 503, {
        ok: false,
        configured: false,
        error: error.message || "数据库未配置",
      });
    }
  }

  if (request.method !== "POST") {
    return json(response, 405, { error: "Method Not Allowed" });
  }

  const users = parseStaffUsers();
  if (!users.length) {
    return json(response, 503, {
      error: "员工登录尚未配置，请设置 STAFF_USERS 与 DATABASE_URL",
    });
  }

  try {
    platformDb.assertPostgresMode();
    await platformDb.bootstrapStaffFromEnv();

    const body = request.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      return json(response, 400, { error: "请输入工作邮箱和密码" });
    }

    const session = await platformDb.authenticateStaff({ email, password });
    return json(response, 200, {
      ok: true,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      roles: session.user.roles,
      tenantId: session.tenant.id,
      staffKey: session.token,
      expiresInHours: session.expiresInHours,
      expiresAt: session.expiresAt,
      authMode: "staff_session",
    });
  } catch (error) {
    const status = error.httpStatus || (error.code === "DB_UNAVAILABLE" ? 503 : 500);
    return json(response, status, { error: error.message || "登录失败" });
  }
}

function handleLegacy(request, response) {
  if (request.method === "GET") {
    const users = parseStaffUsers();
    return json(response, 200, {
      ok: true,
      configured: users.length > 0 && Boolean(process.env.LEADS_STAFF_KEY),
      roles: ["sales", "ops"],
      authMode: "shared_key",
    });
  }

  if (request.method !== "POST") {
    return json(response, 405, { error: "Method Not Allowed" });
  }

  const staffKey = String(process.env.LEADS_STAFF_KEY || "").trim();
  const users = parseStaffUsers();
  if (!staffKey || !users.length) {
    return json(response, 503, {
      error: "员工登录尚未配置，请设置 STAFF_USERS 与 LEADS_STAFF_KEY",
    });
  }

  const body = request.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return json(response, 400, { error: "请输入工作邮箱和密码" });
  }

  const matched = users.find((user) => user.email === email);
  if (!matched || !timingSafeEqual(matched.password, password)) {
    return json(response, 401, { error: "邮箱或密码错误" });
  }

  return json(response, 200, {
    ok: true,
    email: matched.email,
    name: matched.name,
    role: matched.role,
    // Returned once after login; Portal stores it in sessionStorage for /api/leads.
    staffKey,
    expiresInHours: 12,
  });
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (platformDb.isPostgresMode()) {
    return handlePostgres(request, response);
  }
  return handleLegacy(request, response);
}
