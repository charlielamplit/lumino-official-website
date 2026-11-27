"use strict";

const crypto = require("node:crypto");
const { withClient, withTransaction } = require("./pool");
const { hashPassword, verifyPassword, hashToken } = require("./identity-repository");
const cnCatalog = require("../../../apps/site/calculator/data/cn-codes.json");
const cnCatalogByCode = new Map(cnCatalog.map((item) => [item.cnCode, item]));

const CUSTOMER_ROLES = ["customer_admin", "customer_owner", "customer_contrib", "customer_approver"];
const SESSION_HOURS = 12;
const DUMMY_PASSWORD_HASH = hashPassword("no-such-portal-account");

function portalError(code, httpStatus, message) {
  return Object.assign(new Error(message), { code, httpStatus });
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) || value.length > 254) {
    throw portalError("VALIDATION_FAILED", 400, "邮箱格式不正确");
  }
  return value;
}

async function provisionPortalAccount({ email, password, name, tenantSlug, tenantName, isDemo = false }, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (String(password || "").length < 12 || String(password).length > 256) throw portalError("VALIDATION_FAILED", 400, "密码长度须为 12 至 256 位");
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(String(tenantSlug || ""))) throw portalError("VALIDATION_FAILED", 400, "租户标识不正确");
  if (!String(tenantName || "").trim() || !String(name || "").trim()) throw portalError("VALIDATION_FAILED", 400, "姓名与企业名称必填");
  return withTransaction(async (client) => {
    const tenant = (await client.query(
      `INSERT INTO tenants (slug, name, is_demo) VALUES ($1, $2, $3) RETURNING id, slug, name, is_demo`,
      [tenantSlug, String(tenantName).trim(), Boolean(isDemo)],
    )).rows[0];
    const user = (await client.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name`,
      [normalizedEmail, hashPassword(password), String(name).trim()],
    )).rows[0];
    await client.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, roles) VALUES ($1, $2, $3::text[])`,
      [tenant.id, user.id, ["customer_admin"]],
    );
    await client.query(
      `INSERT INTO audit_events (tenant_id, action, entity_type, entity_id, payload)
       VALUES ($1, 'portal.account.provision', 'user', $2, $3::jsonb)`,
      [tenant.id, user.id, JSON.stringify({ source: "admin_cli", isDemo: Boolean(isDemo) })],
    );
    return { tenant, user };
  }, options);
}

async function authenticatePortal({ email, password, requestId = null }, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  const emailHash = crypto.createHash("sha256").update(normalizedEmail).digest("hex");
  const outcome = await withTransaction(async (client) => {
    const counter = (await client.query(
      `SELECT failures, locked_until FROM portal_login_attempts WHERE email_hash = $1 FOR UPDATE`,
      [emailHash],
    )).rows[0];
    if (counter?.locked_until && new Date(counter.locked_until).getTime() > Date.now()) return { denied: true, rateLimited: true };

    const result = await client.query(
      `SELECT u.id AS user_id, u.email, u.name, u.password_hash,
              m.tenant_id, m.roles, t.name AS tenant_name, t.is_demo
       FROM users u
       JOIN tenant_memberships m ON m.user_id = u.id
       JOIN tenants t ON t.id = m.tenant_id
       WHERE u.email = $1 AND u.is_active AND u.archived_at IS NULL
         AND m.is_active AND m.archived_at IS NULL AND t.archived_at IS NULL
         AND m.roles && $2::text[]
       ORDER BY m.created_at ASC LIMIT 2`,
      [normalizedEmail, CUSTOMER_ROLES],
    );
    const row = result.rows.length === 1 ? result.rows[0] : null;
    const passwordValid = verifyPassword(password, row?.password_hash || DUMMY_PASSWORD_HASH);
    if (!row || !passwordValid) {
      await client.query(
        `INSERT INTO portal_login_attempts (email_hash, failures, window_started_at, locked_until)
         VALUES ($1, 1, now(), NULL)
         ON CONFLICT (email_hash) DO UPDATE SET
           failures = CASE WHEN portal_login_attempts.window_started_at < now() - interval '15 minutes' THEN 1 ELSE portal_login_attempts.failures + 1 END,
           window_started_at = CASE WHEN portal_login_attempts.window_started_at < now() - interval '15 minutes' THEN now() ELSE portal_login_attempts.window_started_at END,
           locked_until = CASE WHEN portal_login_attempts.window_started_at < now() - interval '15 minutes' THEN NULL
             WHEN portal_login_attempts.failures + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END`,
        [emailHash],
      );
      return { denied: true };
    }
    await client.query(`DELETE FROM portal_login_attempts WHERE email_hash = $1`, [emailHash]);
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
    await client.query(
      `INSERT INTO portal_sessions (token_hash, user_id, tenant_id, expires_at) VALUES ($1, $2, $3, $4)`,
      [hashToken(token), row.user_id, row.tenant_id, expiresAt],
    );
    await client.query(
      `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, 'portal.login', 'user', $4, $5::jsonb)`,
      [row.tenant_id, row.user_id, row.email, String(row.user_id), JSON.stringify({ requestId })],
    );
    return { token, expiresAt, user: { id: row.user_id, email: row.email, name: row.name, role: row.roles[0], roles: row.roles }, tenant: { id: row.tenant_id, name: row.tenant_name, isDemo: row.is_demo } };
  }, options);
  if (outcome.denied) throw portalError(outcome.rateLimited ? "RATE_LIMITED" : "AUTH_INVALID", outcome.rateLimited ? 429 : 401, "邮箱或密码错误");
  return outcome;
}

async function resolvePortalSession(token, options = {}) {
  if (!token) return null;
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT s.user_id, s.tenant_id, s.expires_at, s.revoked_at,
              u.email, u.name, u.is_active AS user_active, u.archived_at AS user_archived,
              m.roles, m.is_active AS member_active, m.archived_at AS member_archived,
              t.name AS tenant_name, t.is_demo, t.archived_at AS tenant_archived
       FROM portal_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN tenant_memberships m ON m.user_id = s.user_id AND m.tenant_id = s.tenant_id
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.token_hash = $1`,
      [hashToken(token)],
    );
    const row = result.rows[0];
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()
      || !row.user_active || row.user_archived || !row.member_active || row.member_archived || row.tenant_archived
      || !row.roles?.some((role) => CUSTOMER_ROLES.includes(role))) return null;
    return { userId: row.user_id, tenantId: row.tenant_id, email: row.email, name: row.name, roles: row.roles, tenantName: row.tenant_name, isDemo: row.is_demo, expiresAt: row.expires_at };
  }, options);
}

async function revokePortalSession(token, options = {}) {
  if (!token) return false;
  return withClient(async (client) => {
    const result = await client.query(`UPDATE portal_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [hashToken(token)]);
    return result.rowCount > 0;
  }, options);
}

async function portalWorkspace(session, options = {}) {
  if (!session?.userId || !session.tenantId) throw portalError("AUTH_REQUIRED", 401, "请先登录");
  return withClient(async (client) => {
    const projects = await client.query(
      `SELECT id, service_year, status, revision, created_at FROM portal_annual_projects WHERE tenant_id = $1 ORDER BY service_year DESC`,
      [session.tenantId],
    );
    const records = await client.query(
      `SELECT r.id, r.project_id, r.kind, r.payload, r.created_at
       FROM portal_project_records r JOIN portal_annual_projects p ON p.id = r.project_id
       WHERE r.tenant_id = $1 AND p.tenant_id = $1 ORDER BY r.created_at, r.id`,
      [session.tenantId],
    );
    return { user: { name: session.name, email: session.email, roles: session.roles }, tenant: { id: session.tenantId, name: session.tenantName, isDemo: session.isDemo }, projects: projects.rows.map((row) => ({ id: row.id, year: row.service_year, status: row.status, revision: row.revision, createdAt: row.created_at })), records: records.rows.map((row) => ({ id: row.id, projectId: row.project_id, kind: row.kind, ...row.payload, createdAt: row.created_at })) };
  }, options);
}

async function createPortalAnnualProject(session, { serviceYear, confirmedTenantName, requestId = null } = {}, options = {}) {
  if (!session?.userId || !session.tenantId) throw portalError("AUTH_REQUIRED", 401, "请先登录");
  const year = Number(serviceYear);
  if (!Number.isInteger(year) || year < 2026 || year > 2100) throw portalError("VALIDATION_FAILED", 400, "请确认项目年度");
  const tenantName = String(confirmedTenantName || "").trim();
  if (tenantName.length < 2 || tenantName.length > 120) throw portalError("VALIDATION_FAILED", 400, "企业名称须为 2 至 120 个字符");
  return withTransaction(async (client) => {
    const authority = (await client.query(
      `SELECT t.name, t.is_demo, m.roles
       FROM tenant_memberships m JOIN tenants t ON t.id = m.tenant_id
       JOIN users u ON u.id = m.user_id
       WHERE m.tenant_id = $1 AND m.user_id = $2
         AND m.is_active AND m.archived_at IS NULL
         AND u.is_active AND u.archived_at IS NULL AND t.archived_at IS NULL
       FOR UPDATE OF t`,
      [session.tenantId, session.userId],
    )).rows[0];
    if (!authority) throw portalError("AUTH_REQUIRED", 401, "登录已失效");
    if (authority.is_demo || !authority.roles.some((role) => ["customer_admin", "customer_owner"].includes(role))) throw portalError("FORBIDDEN_ROLE", 403, "当前角色不能创建项目");
    if (tenantName !== authority.name) {
      await client.query(`UPDATE tenants SET name = $1 WHERE id = $2`, [tenantName, session.tenantId]);
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, 'portal.tenant.rename', 'tenant', $4, $5::jsonb)`,
        [session.tenantId, session.userId, session.email, session.tenantId, JSON.stringify({ previousName: authority.name, nextName: tenantName, requestId })],
      );
    }
    const result = await client.query(
      `INSERT INTO portal_annual_projects (tenant_id, service_year, created_by)
       VALUES ($1, $2, $3) ON CONFLICT (tenant_id, service_year) DO NOTHING
       RETURNING id, service_year, status, revision, created_at`,
      [session.tenantId, year, session.userId],
    );
    const created = Boolean(result.rows[0]);
    const row = result.rows[0] || (await client.query(
      `SELECT id, service_year, status, revision, created_at FROM portal_annual_projects WHERE tenant_id = $1 AND service_year = $2`,
      [session.tenantId, year],
    )).rows[0];
    if (created) await client.query(
      `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, 'portal.project.create', 'portal_annual_project', $4, $5::jsonb)`,
      [session.tenantId, session.userId, session.email, row.id, JSON.stringify({ serviceYear: year, requestId })],
    );
    return { id: row.id, year: row.service_year, status: row.status, revision: row.revision, createdAt: row.created_at, created };
  }, options);
}

function validatedRecord(kind, raw) {
  const value = (key, max = 120) => {
    const text = String(raw?.[key] || "").trim();
    if (!text || text.length > max) throw portalError("VALIDATION_FAILED", 400, `${key} 必填且不能超过 ${max} 字符`);
    return text;
  };
  if (kind === "product") {
    const cnCode = value("cnCode", 10);
    if (!/^\d{8}(?:\d{2})?$/.test(cnCode) || !cnCatalogByCode.has(cnCode)) throw portalError("VALIDATION_FAILED", 400, "请从 CN 目录选择有效编码");
    return { name: value("name"), cnCode };
  }
  if (kind === "facility") return { name: value("name"), location: value("location") };
  if (kind === "production_link") {
    const productId = value("productId", 36);
    const facilityId = value("facilityId", 36);
    if (![productId, facilityId].every((id) => /^[0-9a-f-]{36}$/i.test(id))) throw portalError("VALIDATION_FAILED", 400, "请选择项目内的产品和设施");
    const processSummary = String(raw?.processSummary || "").trim();
    if (processSummary.length > 500) throw portalError("VALIDATION_FAILED", 400, "工艺说明不能超过 500 字符");
    return { productId, facilityId, processSummary };
  }
  if (kind === "material_request") {
    const assigneeEmail = value("assigneeEmail", 254).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(assigneeEmail)) throw portalError("VALIDATION_FAILED", 400, "责任人邮箱格式不正确");
    return { title: value("title"), assigneeEmail };
  }
  throw portalError("VALIDATION_FAILED", 400, "记录类型不正确");
}

async function validateProductionLinkReferences(client, session, projectId, payload) {
  const rows = (await client.query(
    `SELECT id, kind FROM portal_project_records
     WHERE tenant_id = $1 AND project_id = $2 AND id = ANY($3::uuid[])`,
    [session.tenantId, projectId, [payload.productId, payload.facilityId]],
  )).rows;
  if (!rows.some((row) => row.id === payload.productId && row.kind === "product")
    || !rows.some((row) => row.id === payload.facilityId && row.kind === "facility")) {
    throw portalError("VALIDATION_FAILED", 400, "产品与设施必须属于当前项目");
  }
}

async function createPortalProjectRecord(session, { projectId, kind, record, requestId = null } = {}, options = {}) {
  if (!session?.userId || !session.tenantId) throw portalError("AUTH_REQUIRED", 401, "请先登录");
  if (!/^[0-9a-f-]{36}$/i.test(String(projectId || ""))) throw portalError("VALIDATION_FAILED", 400, "项目标识不正确");
  const payload = validatedRecord(kind, record);
  return withTransaction(async (client) => {
    const allowed = (await client.query(
      `SELECT 1 FROM portal_annual_projects p
       JOIN tenant_memberships m ON m.tenant_id = p.tenant_id AND m.user_id = $3
       JOIN tenants t ON t.id = p.tenant_id
       JOIN users u ON u.id = m.user_id
       WHERE p.id = $1 AND p.tenant_id = $2 AND p.status = 'SETUP_DRAFT'
         AND NOT t.is_demo AND t.archived_at IS NULL
         AND m.is_active AND m.archived_at IS NULL AND u.is_active AND u.archived_at IS NULL
         AND m.roles && $4::text[] FOR UPDATE OF p`,
      [projectId, session.tenantId, session.userId, ["customer_admin", "customer_owner"]],
    )).rows[0];
    if (!allowed) throw portalError("FORBIDDEN_ROLE", 403, "当前账号不能编辑此项目");
    if (kind === "production_link") await validateProductionLinkReferences(client, session, projectId, payload);
    const row = (await client.query(
      `INSERT INTO portal_project_records (tenant_id, project_id, kind, payload, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5) ON CONFLICT DO NOTHING
       RETURNING id, project_id, kind, payload, created_at`,
      [session.tenantId, projectId, kind, JSON.stringify(payload), session.userId],
    )).rows[0];
    if (!row) throw portalError("VALIDATION_FAILED", 400, "该产品与设施的关系已存在");
    await client.query(
      `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, 'portal.project.record.create', 'portal_project_record', $4, $5::jsonb)`,
      [session.tenantId, session.userId, session.email, row.id, JSON.stringify({ projectId, kind, requestId })],
    );
    return { id: row.id, projectId: row.project_id, kind: row.kind, ...row.payload, createdAt: row.created_at };
  }, options);
}

async function createPortalProductBatch(session, { projectId, cnCodes, requestId = null } = {}, options = {}) {
  if (!session?.userId || !session.tenantId) throw portalError("AUTH_REQUIRED", 401, "请先登录");
  if (!/^[0-9a-f-]{36}$/i.test(String(projectId || ""))) throw portalError("VALIDATION_FAILED", 400, "项目标识不正确");
  if (!Array.isArray(cnCodes) || cnCodes.length < 1 || cnCodes.length > 50) throw portalError("VALIDATION_FAILED", 400, "每次请选择 1 至 50 个 CN 码");
  const codes = [...new Set(cnCodes.map((code) => String(code || "").trim()))];
  if (codes.some((code) => !cnCatalogByCode.has(code))) throw portalError("VALIDATION_FAILED", 400, "包含目录中不存在的 CN 码");
  return withTransaction(async (client) => {
    const allowed = (await client.query(
      `SELECT 1 FROM portal_annual_projects p
       JOIN tenant_memberships m ON m.tenant_id = p.tenant_id AND m.user_id = $3
       JOIN tenants t ON t.id = p.tenant_id JOIN users u ON u.id = m.user_id
       WHERE p.id = $1 AND p.tenant_id = $2 AND p.status = 'SETUP_DRAFT'
         AND NOT t.is_demo AND t.archived_at IS NULL
         AND m.is_active AND m.archived_at IS NULL AND u.is_active AND u.archived_at IS NULL
         AND m.roles && $4::text[] FOR UPDATE OF p`,
      [projectId, session.tenantId, session.userId, ["customer_admin", "customer_owner"]],
    )).rows[0];
    if (!allowed) throw portalError("FORBIDDEN_ROLE", 403, "当前账号不能编辑此项目");
    const existing = new Set((await client.query(
      `SELECT payload->>'cnCode' AS cn_code FROM portal_project_records
       WHERE tenant_id = $1 AND project_id = $2 AND kind = 'product'`,
      [session.tenantId, projectId],
    )).rows.map((row) => row.cn_code));
    const created = [];
    for (const code of codes) {
      if (existing.has(code)) continue;
      const catalogItem = cnCatalogByCode.get(code);
      const payload = { name: catalogItem.zh || catalogItem.description, cnCode: code };
      const row = (await client.query(
        `INSERT INTO portal_project_records (tenant_id, project_id, kind, payload, created_by)
         VALUES ($1, $2, 'product', $3::jsonb, $4) RETURNING id, project_id, kind, payload, created_at`,
        [session.tenantId, projectId, JSON.stringify(payload), session.userId],
      )).rows[0];
      created.push({ id: row.id, projectId: row.project_id, kind: row.kind, ...row.payload, createdAt: row.created_at });
    }
    if (created.length) await client.query(
      `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, 'portal.project.products.add', 'portal_annual_project', $4, $5::jsonb)`,
      [session.tenantId, session.userId, session.email, projectId, JSON.stringify({ cnCodes: created.map((record) => record.cnCode), requestId })],
    );
    return { created, skippedCodes: codes.filter((code) => existing.has(code)) };
  }, options);
}

async function renamePortalTenant(session, { tenantName, requestId = null } = {}, options = {}) {
  if (!session?.userId || !session.tenantId) throw portalError("AUTH_REQUIRED", 401, "请先登录");
  const name = String(tenantName || "").trim();
  if (name.length < 2 || name.length > 120) throw portalError("VALIDATION_FAILED", 400, "企业名称须为 2 至 120 个字符");
  return withTransaction(async (client) => {
    const authority = (await client.query(
      `SELECT t.name FROM tenants t JOIN tenant_memberships m ON m.tenant_id = t.id
       JOIN users u ON u.id = m.user_id
       WHERE t.id = $1 AND m.user_id = $2 AND NOT t.is_demo AND t.archived_at IS NULL
         AND m.is_active AND m.archived_at IS NULL AND u.is_active AND u.archived_at IS NULL
         AND m.roles && $3::text[] FOR UPDATE OF t`,
      [session.tenantId, session.userId, ["customer_admin", "customer_owner"]],
    )).rows[0];
    if (!authority) throw portalError("FORBIDDEN_ROLE", 403, "当前账号不能修改企业名称");
    if (authority.name !== name) {
      await client.query(`UPDATE tenants SET name = $1 WHERE id = $2`, [name, session.tenantId]);
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, 'portal.tenant.rename', 'tenant', $4, $5::jsonb)`,
        [session.tenantId, session.userId, session.email, session.tenantId, JSON.stringify({ previousName: authority.name, nextName: name, requestId })],
      );
    }
    return { name };
  }, options);
}

async function updatePortalProjectRecord(session, { recordId, kind, record, requestId = null } = {}, options = {}) {
  if (!session?.userId || !session.tenantId) throw portalError("AUTH_REQUIRED", 401, "请先登录");
  if (!/^[0-9a-f-]{36}$/i.test(String(recordId || ""))) throw portalError("VALIDATION_FAILED", 400, "记录标识不正确");
  const payload = validatedRecord(kind, record);
  return withTransaction(async (client) => {
    if (kind === "production_link") {
      const existing = (await client.query(
        `SELECT project_id FROM portal_project_records WHERE id = $1 AND tenant_id = $2 AND kind = $3`,
        [recordId, session.tenantId, kind],
      )).rows[0];
      if (!existing) throw portalError("RESOURCE_NOT_FOUND", 404, "记录不存在或无法修改");
      await validateProductionLinkReferences(client, session, existing.project_id, payload);
      const duplicate = (await client.query(
        `SELECT 1 FROM portal_project_records
         WHERE tenant_id = $1 AND project_id = $2 AND kind = 'production_link' AND id <> $3
           AND payload->>'productId' = $4 AND payload->>'facilityId' = $5`,
        [session.tenantId, existing.project_id, recordId, payload.productId, payload.facilityId],
      )).rows[0];
      if (duplicate) throw portalError("VALIDATION_FAILED", 400, "该产品与设施的关系已存在");
    }
    const row = (await client.query(
      `UPDATE portal_project_records r SET payload = $4::jsonb
       FROM portal_annual_projects p, tenant_memberships m, tenants t, users u
       WHERE r.id = $1 AND r.tenant_id = $2 AND r.project_id = p.id
         AND p.tenant_id = $2 AND p.status = 'SETUP_DRAFT'
         AND r.kind = $3 AND m.tenant_id = $2 AND m.user_id = $5
         AND t.id = $2 AND NOT t.is_demo AND t.archived_at IS NULL
         AND u.id = $5 AND u.is_active AND u.archived_at IS NULL
         AND m.is_active AND m.archived_at IS NULL AND m.roles && $6::text[]
       RETURNING r.id, r.project_id, r.kind, r.payload, r.created_at`,
      [recordId, session.tenantId, kind, JSON.stringify(payload), session.userId, ["customer_admin", "customer_owner"]],
    )).rows[0];
    if (!row) throw portalError("RESOURCE_NOT_FOUND", 404, "记录不存在或无法修改");
    await client.query(
      `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, 'portal.project.record.update', 'portal_project_record', $4, $5::jsonb)`,
      [session.tenantId, session.userId, session.email, row.id, JSON.stringify({ projectId: row.project_id, kind, requestId })],
    );
    return { id: row.id, projectId: row.project_id, kind: row.kind, ...row.payload, createdAt: row.created_at };
  }, options);
}

module.exports = { CUSTOMER_ROLES, provisionPortalAccount, authenticatePortal, resolvePortalSession, revokePortalSession, portalWorkspace, createPortalAnnualProject, createPortalProjectRecord, createPortalProductBatch, renamePortalTenant, updatePortalProjectRecord };
