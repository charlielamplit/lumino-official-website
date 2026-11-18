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

function auditPayload(base, requestId) {
  const payload = { ...base };
  if (requestId) payload.requestId = requestId;
  return JSON.stringify(payload);
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

async function writeProvisionAudit(client, {
  tenantId,
  userId,
  email,
  action,
  requestId = null,
  details = {},
}) {
  await client.query(
    `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
     VALUES ($1, $2, $3, $4, 'user', $5, $6::jsonb)`,
    [
      tenantId,
      userId,
      email,
      action,
      userId,
      auditPayload(details, requestId),
    ],
  );
}

/**
 * Default mode is true no-op for existing accounts (no password/role/revision mutation).
 * Mutations require explicit flags: reactivate / rotatePassword / updateRoles.
 */
async function upsertUserWithMembership(
  client,
  {
    email,
    password,
    name,
    role,
    tenantId,
    reactivate = false,
    rotatePassword = false,
    updateRoles = false,
    requestId = null,
  },
) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await client.query(
    `SELECT * FROM users WHERE email = $1`,
    [normalizedEmail],
  );
  let user = existing.rows[0] || null;

  if (!user) {
    const passwordHash = hashPassword(password);
    const inserted = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [normalizedEmail, passwordHash, name],
    );
    user = inserted.rows[0];
    await client.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, roles)
       VALUES ($1, $2, $3::text[])`,
      [tenantId, user.id, [role]],
    );
    await writeProvisionAudit(client, {
      tenantId,
      userId: user.id,
      email: user.email,
      action: "staff.provision",
      requestId,
      details: { role, created: true },
    });
    return { skipped: false, user, reason: "created" };
  }

  const membershipResult = await client.query(
    `SELECT * FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2`,
    [tenantId, user.id],
  );
  let membership = membershipResult.rows[0] || null;
  const userArchived = Boolean(user.archived_at) || user.is_active === false;
  const membershipArchived = membership
    && (Boolean(membership.archived_at) || membership.is_active === false);

  // Default: true skip / report inactive membership — never rewrite password/roles/revision.
  if (!reactivate && !rotatePassword && !updateRoles) {
    if (userArchived) {
      return { skipped: true, reason: "archived", user };
    }
    if (membershipArchived) {
      return { skipped: true, reason: "membership_archived", user };
    }
    if (!membership) {
      await client.query(
        `INSERT INTO tenant_memberships (tenant_id, user_id, roles)
         VALUES ($1, $2, $3::text[])
         ON CONFLICT (tenant_id, user_id) DO NOTHING`,
        [tenantId, user.id, [role]],
      );
      await writeProvisionAudit(client, {
        tenantId,
        userId: user.id,
        email: user.email,
        action: "staff.provision.membership",
        requestId,
        details: { role, membershipCreated: true },
      });
      return { skipped: false, user, reason: "membership_created" };
    }
    return { skipped: true, reason: "already_provisioned", user };
  }

  if (userArchived && !reactivate) {
    return { skipped: true, reason: "archived", user };
  }
  if (membershipArchived && !reactivate) {
    return { skipped: true, reason: "membership_archived", user };
  }

  const shouldTouchUser = reactivate || rotatePassword;
  if (shouldTouchUser) {
    const nextHash = rotatePassword || reactivate ? hashPassword(password) : user.password_hash;
    const updated = await client.query(
      `UPDATE users
       SET password_hash = CASE WHEN $2::boolean THEN $3 ELSE password_hash END,
           name = COALESCE($4, name),
           is_active = CASE WHEN $5::boolean THEN true ELSE is_active END,
           archived_at = CASE WHEN $5::boolean THEN NULL ELSE archived_at END,
           updated_at = now(),
           revision = revision + 1
       WHERE id = $1
       RETURNING *`,
      [
        user.id,
        Boolean(rotatePassword || reactivate),
        nextHash,
        name || null,
        Boolean(reactivate),
      ],
    );
    user = updated.rows[0];
  }

  if (!membership) {
    const inserted = await client.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, roles, is_active, archived_at)
       VALUES ($1, $2, $3::text[], true, NULL)
       RETURNING *`,
      [tenantId, user.id, [role]],
    );
    membership = inserted.rows[0];
  } else if (reactivate || updateRoles) {
    await client.query(
      `UPDATE tenant_memberships
       SET roles = CASE WHEN $3::boolean THEN $4::text[] ELSE roles END,
           is_active = CASE WHEN $5::boolean THEN true ELSE is_active END,
           archived_at = CASE WHEN $5::boolean THEN NULL ELSE archived_at END,
           updated_at = now(),
           revision = revision + 1
       WHERE tenant_id = $1 AND user_id = $2`,
      [
        tenantId,
        user.id,
        Boolean(updateRoles || reactivate),
        [role],
        Boolean(reactivate),
      ],
    );
  }

  await writeProvisionAudit(client, {
    tenantId,
    userId: user.id,
    email: user.email,
    action: reactivate
      ? "staff.provision.reactivate"
      : rotatePassword
        ? "staff.provision.rotate_password"
        : "staff.provision.update_roles",
    requestId,
    details: {
      role,
      reactivate: Boolean(reactivate),
      rotatePassword: Boolean(rotatePassword),
      updateRoles: Boolean(updateRoles),
    },
  });

  return { skipped: false, user, reason: "updated" };
}

async function provisionStaffFromEnv({
  reactivate = false,
  rotatePassword = false,
  updateRoles = false,
  requestId = null,
  ...options
} = {}) {
  const raw = String(process.env.STAFF_USERS || "").trim();
  if (!raw) return { tenant: null, users: [], skipped: [] };
  return withTransaction(async (client) => {
    const tenant = await ensureDefaultTenant(client);
    const users = [];
    const skipped = [];
    for (const entry of raw.split(",")) {
      const parts = entry.split(":").map((part) => part.trim());
      if (parts.length < 3) continue;
      const [email, password, role, ...nameParts] = parts;
      if (!email || !password || !["sales", "ops", "admin"].includes(role)) continue;
      const name = nameParts.join(":") || email.split("@")[0];
      const result = await upsertUserWithMembership(client, {
        email,
        password,
        name,
        role,
        tenantId: tenant.id,
        reactivate,
        rotatePassword,
        updateRoles,
        requestId,
      });
      if (result.skipped) {
        skipped.push({ email: email.toLowerCase(), reason: result.reason || "skipped" });
        continue;
      }
      users.push({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role,
        reason: result.reason,
      });
    }
    return { tenant, users, skipped };
  }, options);
}

/** @deprecated Use provisionStaffFromEnv for one-time setup. Kept for tests/scripts. */
async function bootstrapStaffFromEnv(options = {}) {
  return provisionStaffFromEnv({
    reactivate: true,
    rotatePassword: true,
    updateRoles: true,
    ...options,
  });
}

async function countActiveStaffUsers(options = {}) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT count(*)::int AS c
       FROM users u
       JOIN tenant_memberships m ON m.user_id = u.id
       WHERE u.is_active = true
         AND u.archived_at IS NULL
         AND m.is_active = true
         AND m.archived_at IS NULL`,
    );
    return result.rows[0].c;
  }, options);
}

async function authenticateStaff({ email, password, requestId = null }, options = {}) {
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
        auditPayload({ role: membership.roles[0] || null }, requestId),
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
  provisionStaffFromEnv,
  countActiveStaffUsers,
  authenticateStaff,
  resolveSession,
  revokeSession,
};
