/**
 * Staff login for Lumino ops / sales (PostgreSQL phase-1).
 * Issues a personal session token. Actor/tenant come from staff_sessions.
 */
import { platformDb } from "./_lib/platform-db.js";

function json(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    try {
      platformDb.assertPostgresMode();
      return json(response, 200, {
        ok: true,
        configured: true,
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

  try {
    platformDb.assertPostgresMode();
    // Ensure seed users exist for controlled demo environments.
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
      // Personal token — Portal should send as X-Lumino-Staff-Key or Bearer.
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
