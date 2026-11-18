"use strict";

const crypto = require("node:crypto");
const { withClient, withTransaction } = require("./pool");

const DEFAULT_TENANT_SLUG = "lumino";
const SESSION_TTL_HOURS = Number(process.env.STAFF_SESSION_TTL_HOURS || 12);

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  const actual = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function ensureDefaultTenant(client, { slug = DEFAULT_TENANT_SLUG, name = "Lumino" } = {}) {
  // Atomic upsert: concurrent bootstraps must not race on SELECT-then-INSERT.
  const upserted = await client.query(
    `INSERT INTO tenants (slug, name)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE
       SET updated_at = tenants.updated_at
     RETURNING *`,
    [slug, name],
  );
  return upserted.rows[0];
}

async function upsertUserWithMembership(client, { email, password, name, role, tenantId }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const upserted = await client.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           is_active = true,
           archived_at = NULL,
           updated_at = now(),
           revision = users.revision + 1
     RETURNING *`,
    [normalizedEmail, passwordHash, name],
  );
  const user = upserted.rows[0];

  await client.query(
    `INSERT INTO tenant_memberships (tenant_id, user_id, roles)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, user_id)
     DO UPDATE SET
       roles = EXCLUDED.roles,
       is_active = true,
       archived_at = NULL,
       updated_at = now(),
       revision = tenant_memberships.revision + 1`,
    [tenantId, user.id, [role]],
  );
  return user;
}

async function bootstrapStaffFromEnv(options = {}) {
  const raw = String(process.env.STAFF_USERS || "").trim();
  if (!raw) return { tenant: null, users: [] };
  return withTransaction(async (client) => {
    const tenant = await ensureDefaultTenant(client);
    const users = [];
    for (const entry of raw.split(",")) {
      const parts = entry.split(":").map((part) => part.trim());
      if (parts.length < 3) continue;
      const [email, password, role, ...nameParts] = parts;
      if (!email || !password || !["sales", "ops", "admin"].includes(role)) continue;
      const name = nameParts.join(":") || email.split("@")[0];
      const user = await upsertUserWithMembership(client, {
        email,
        password,
        name,
        role,
        tenantId: tenant.id,
      });
      users.push({ id: user.id, email: user.email, name: user.name, role });
    }
    return { tenant, users };
  }, options);
}

async function authenticateStaff({ email, password }, options = {}) {
  return withTransaction(async (client) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const userResult = await client.query(
      `SELECT u.*
       FROM users u
       WHERE u.email = $1 AND u.is_active = true AND u.archived_at IS NULL`,
      [normalizedEmail],
    );
    const user = userResult.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      const error = new Error("邮箱或密码错误");
      error.code = "AUTH_INVALID";
      error.httpStatus = 401;
      throw error;
    }

    const membershipResult = await client.query(
      `SELECT m.*, t.slug AS tenant_slug
       FROM tenant_memberships m
       JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = $1
         AND m.is_active = true
         AND m.archived_at IS NULL
         AND t.archived_at IS NULL
       ORDER BY m.created_at ASC
       LIMIT 1`,
      [user.id],
    );
    const membership = membershipResult.rows[0];
    if (!membership) {
      const error = new Error("无可用租户成员资格");
      error.code = "TENANT_FORBIDDEN";
      error.httpStatus = 403;
      throw error;
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
    await client.query(
      `INSERT INTO staff_sessions (token_hash, user_id, tenant_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [tokenHash, user.id, membership.tenant_id, expiresAt.toISOString()],
    );
    await client.query(
      `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, 'staff.login', 'user', $4, $5::jsonb)`,
      [
        membership.tenant_id,
        user.id,
        user.email,
        user.id,
        JSON.stringify({ role: membership.roles[0] || null }),
      ],
    );

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      expiresInHours: SESSION_TTL_HOURS,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: membership.roles[0] || "ops",
        roles: membership.roles,
      },
      tenant: {
        id: membership.tenant_id,
        slug: membership.tenant_slug,
      },
    };
  }, options);
}

async function resolveSession(token, options = {}) {
  if (!token) return null;
  return withClient(async (client) => {
    const tokenHash = hashToken(token);
    const result = await client.query(
      `SELECT s.*,
              u.email,
              u.name,
              u.is_active AS user_active,
              u.archived_at AS user_archived_at,
              m.roles,
              m.is_active AS membership_active,
              m.archived_at AS membership_archived_at,
              t.archived_at AS tenant_archived_at
       FROM staff_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN tenant_memberships m
         ON m.user_id = s.user_id AND m.tenant_id = s.tenant_id
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.token_hash = $1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;
    if (!row.user_active || !row.membership_active) return null;
    if (row.user_archived_at || row.membership_archived_at || row.tenant_archived_at) return null;

    await client.query(
      `UPDATE staff_sessions SET last_seen_at = now() WHERE token_hash = $1`,
      [tokenHash],
    );

    return {
      userId: row.user_id,
      activeTenantId: row.tenant_id,
      email: row.email,
      name: row.name,
      roles: row.roles || [],
      expiresAt: row.expires_at,
    };
  }, options);
}

async function revokeSession(token, options = {}) {
  if (!token) return false;
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE staff_sessions
       SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(token)],
    );
    return result.rowCount > 0;
  }, options);
}

module.exports = {
  DEFAULT_TENANT_SLUG,
  hashPassword,
  verifyPassword,
  hashToken,
  ensureDefaultTenant,
  bootstrapStaffFromEnv,
  authenticateStaff,
  resolveSession,
  revokeSession,
};
