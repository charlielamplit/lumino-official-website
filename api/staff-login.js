/**
 * Staff login for Lumino ops / sales.
 * Issues the shared LEADS_STAFF_KEY after email+password verification so Portal
 * can call /api/leads without operators pasting a raw key.
 *
 * Configure STAFF_USERS as comma-separated:
 *   email:password:role:displayName
 * role = sales | ops
 */
import crypto from "node:crypto";

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
    if (!["sales", "ops"].includes(role)) return null;
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

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    const users = parseStaffUsers();
    return json(response, 200, {
      ok: true,
      configured: users.length > 0 && Boolean(process.env.LEADS_STAFF_KEY),
      roles: ["sales", "ops"],
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
