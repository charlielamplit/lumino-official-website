"use strict";

const { withClient, withTransaction } = require("./pool");

const STATUS = new Set(["new", "claimed", "qualified", "disqualified", "converted"]);

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return value || null;
}

function normalizePhone(phone) {
  const value = String(phone || "").replace(/\s+/g, "");
  return value || null;
}

function mapLead(row) {
  if (!row) return null;
  return {
    id: row.public_id,
    internalId: row.id,
    tenantId: row.tenant_id,
    status: row.status,
    company: row.company,
    name: row.name,
    phone: row.phone || "",
    email: row.email || "",
    industry: row.industry || "",
    timeline: row.timeline || "",
    services: row.services || [],
    note: row.note,
    notes: row.notes || [],
    source: row.source,
    requestType: row.request_type,
    consent: row.consent,
    consentAt: row.consent_at,
    noticeVersion: row.notice_version,
    context: row.context,
    userAgent: row.user_agent || "",
    claimedBy: row.claimed_by_email || row.claimed_by_user_id || null,
    claimedByUserId: row.claimed_by_user_id || null,
    claimedAt: row.claimed_at,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    revision: row.revision,
  };
}

async function nextPublicId(client, tenantId, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const stamp = day.replaceAll("-", "");
  const counter = await client.query(
    `INSERT INTO lead_daily_counters (tenant_id, day, seq)
     VALUES ($1, $2::date, 1)
     ON CONFLICT (tenant_id, day)
     DO UPDATE SET seq = lead_daily_counters.seq + 1
     RETURNING seq`,
    [tenantId, day],
  );
  const seq = String(counter.rows[0].seq).padStart(4, "0");
  return `LM-${stamp}-${seq}`;
}

async function createLead(input, options = {}) {
  const tenantId = options.tenantId;
  if (!tenantId) {
    const error = new Error("tenantId is required");
    error.code = "TENANT_REQUIRED";
    throw error;
  }

  return withTransaction(async (client) => {
    const now = new Date();
    const publicId = await nextPublicId(client, tenantId, now);
    const services = Array.isArray(input.services) ? input.services.map(String) : [];
    const inserted = await client.query(
      `INSERT INTO leads (
         public_id, tenant_id, status, company, name, phone, email,
         email_normalized, phone_normalized, industry, timeline, services,
         note, source, request_type, consent, consent_at, notice_version,
         context, user_agent, is_demo
       ) VALUES (
         $1,$2,'new',$3,$4,$5,$6,
         $7,$8,$9,$10,$11::jsonb,
         $12,$13,$14,$15,$16,$17,
         $18::jsonb,$19,$20
       )
       RETURNING *`,
      [
        publicId,
        tenantId,
        String(input.company || "").slice(0, 120),
        String(input.name || "").slice(0, 80),
        String(input.phone || "").slice(0, 40) || null,
        String(input.email || "").slice(0, 120) || null,
        normalizeEmail(input.email),
        normalizePhone(input.phone),
        String(input.industry || "").slice(0, 80) || null,
        String(input.timeline || "").slice(0, 120) || null,
        JSON.stringify(services),
        String(input.note || "").slice(0, 4000),
        String(input.source || "lumino-website").slice(0, 120),
        String(input.requestType || "service-consultation").slice(0, 80),
        Boolean(input.consent),
        now.toISOString(),
        String(input.noticeVersion || "v1"),
        input.context ? JSON.stringify(input.context) : null,
        String(input.userAgent || "").slice(0, 500) || null,
        Boolean(input.isDemo),
      ],
    );
    const lead = inserted.rows[0];

    await client.query(
      `INSERT INTO lead_events (lead_id, tenant_id, event_type, actor_user_id, payload)
       VALUES ($1, $2, 'lead.created', NULL, $3::jsonb)`,
      [lead.id, tenantId, JSON.stringify({ publicId, source: lead.source })],
    );

    const eventKey = `lead.create.wecom.${lead.id}`;
    await client.query(
      `INSERT INTO outbox_events (
         event_key, lead_id, tenant_id, channel, status, payload
       ) VALUES ($1, $2, $3, 'wecom', 'pending', $4::jsonb)`,
      [
        eventKey,
        lead.id,
        tenantId,
        JSON.stringify({
          publicId: lead.public_id,
          company: lead.company,
          name: lead.name,
        }),
      ],
    );

    await client.query(
      `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
       VALUES ($1, NULL, NULL, 'lead.create', 'lead', $2, $3::jsonb)`,
      [tenantId, lead.public_id, JSON.stringify({ source: lead.source, isDemo: lead.is_demo })],
    );

    return {
      lead: mapLead(lead),
      persisted: true,
      notifyStatus: "queued",
      outboxEventKey: eventKey,
    };
  }, options);
}

async function listLeads({ tenantId, includeDeleted = false } = {}, options = {}) {
  if (!tenantId) throw Object.assign(new Error("tenantId is required"), { code: "TENANT_REQUIRED" });
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT l.*, u.email AS claimed_by_email
       FROM leads l
       LEFT JOIN users u ON u.id = l.claimed_by_user_id
       WHERE l.tenant_id = $1
         AND ($2::boolean OR l.deleted_at IS NULL)
       ORDER BY l.created_at DESC`,
      [tenantId, includeDeleted],
    );
    return result.rows.map(mapLead);
  }, options);
}

async function getLeadByPublicId({ tenantId, publicId }, options = {}) {
  if (!tenantId) throw Object.assign(new Error("tenantId is required"), { code: "TENANT_REQUIRED" });
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT l.*, u.email AS claimed_by_email
       FROM leads l
       LEFT JOIN users u ON u.id = l.claimed_by_user_id
       WHERE l.tenant_id = $1 AND l.public_id = $2 AND l.deleted_at IS NULL`,
      [tenantId, publicId],
    );
    return mapLead(result.rows[0]);
  }, options);
}

async function updateLead({ tenantId, publicId, patch, actor }, options = {}) {
  if (!tenantId) throw Object.assign(new Error("tenantId is required"), { code: "TENANT_REQUIRED" });
  if (!actor?.userId) throw Object.assign(new Error("actor is required"), { code: "AUTH_REQUIRED", httpStatus: 401 });

  return withTransaction(async (client) => {
    const currentResult = await client.query(
      `SELECT * FROM leads WHERE tenant_id = $1 AND public_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [tenantId, publicId],
    );
    const current = currentResult.rows[0];
    if (!current) return { lead: null, persisted: false };

    let status = current.status;
    let claimedByUserId = current.claimed_by_user_id;
    let claimedAt = current.claimed_at;
    let notes = Array.isArray(current.notes) ? [...current.notes] : [];

    if (patch.status) {
      const nextStatus = String(patch.status);
      if (!STATUS.has(nextStatus)) {
        throw Object.assign(new Error("无效的线索状态"), { code: "INVALID_STATUS", httpStatus: 400 });
      }
      status = nextStatus;
      if (status === "claimed" && !claimedByUserId) {
        claimedByUserId = actor.userId;
        claimedAt = new Date().toISOString();
      }
      if (status === "new") {
        claimedByUserId = null;
        claimedAt = null;
      }
    }

    if (patch.claim === true || patch.status === "claimed") {
      claimedByUserId = actor.userId;
      claimedAt = claimedAt || new Date().toISOString();
      if (status === "new") status = "claimed";
    }

    if (patch.note) {
      notes.push({
        at: new Date().toISOString(),
        byUserId: actor.userId,
        byEmail: actor.email || null,
        text: String(patch.note).slice(0, 2000),
      });
    }

    const updated = await client.query(
      `UPDATE leads
       SET status = $3,
           claimed_by_user_id = $4,
           claimed_at = $5,
           notes = $6::jsonb,
           updated_at = now(),
           revision = revision + 1
       WHERE tenant_id = $1 AND public_id = $2
       RETURNING *`,
      [tenantId, publicId, status, claimedByUserId, claimedAt, JSON.stringify(notes)],
    );

    await client.query(
      `INSERT INTO lead_events (lead_id, tenant_id, event_type, actor_user_id, payload)
       VALUES ($1, $2, 'lead.updated', $3, $4::jsonb)`,
      [
        current.id,
        tenantId,
        actor.userId,
        JSON.stringify({ status, noteAdded: Boolean(patch.note) }),
      ],
    );

    await client.query(
      `INSERT INTO audit_events (tenant_id, actor_user_id, actor_email_snapshot, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, 'lead.patch', 'lead', $4, $5::jsonb)`,
      [
        tenantId,
        actor.userId,
        actor.email || null,
        publicId,
        JSON.stringify({ status, claimedByUserId }),
      ],
    );

    const withEmail = await client.query(
      `SELECT l.*, u.email AS claimed_by_email
       FROM leads l
       LEFT JOIN users u ON u.id = l.claimed_by_user_id
       WHERE l.id = $1`,
      [updated.rows[0].id],
    );

    return { lead: mapLead(withEmail.rows[0]), persisted: true };
  }, options);
}

const OUTBOX_MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS || 8);
const OUTBOX_LEASE_SECONDS = Number(process.env.OUTBOX_LEASE_SECONDS || 120);

async function claimPendingOutbox(
  { limit = 20, leadPublicId = null, leaseSeconds = OUTBOX_LEASE_SECONDS } = {},
  options = {},
) {
  return withTransaction(async (client) => {
    // Reclaim stale processing leases before claiming new work.
    await client.query(
      `UPDATE outbox_events
       SET status = CASE
             WHEN attempts >= $2 THEN 'dead'
             ELSE 'failed'
           END,
           last_error_code = COALESCE(last_error_code, 'lease_timeout'),
           next_attempt_at = now(),
           processing_started_at = NULL,
           updated_at = now()
       WHERE status = 'processing'
         AND processing_started_at IS NOT NULL
         AND processing_started_at < now() - make_interval(secs => $1)`,
      [Math.max(30, Number(leaseSeconds) || 120), OUTBOX_MAX_ATTEMPTS],
    );

    const result = await client.query(
      `WITH picked AS (
         SELECT o.id
         FROM outbox_events o
         LEFT JOIN leads l ON l.id = o.lead_id
         WHERE o.status IN ('pending', 'failed')
           AND o.next_attempt_at <= now()
           AND o.attempts < $2
           AND ($3::text IS NULL OR l.public_id = $3 OR o.payload->>'publicId' = $3)
         ORDER BY o.created_at ASC
         FOR UPDATE OF o SKIP LOCKED
         LIMIT $1
       )
       UPDATE outbox_events o
       SET status = 'processing',
           attempts = o.attempts + 1,
           processing_started_at = now(),
           updated_at = now()
       FROM picked
       WHERE o.id = picked.id
       RETURNING o.*`,
      [limit, OUTBOX_MAX_ATTEMPTS, leadPublicId],
    );
    return result.rows;
  }, options);
}

async function markOutboxSent(id, options = {}) {
  return withClient(async (client) => {
    await client.query(
      `UPDATE outbox_events
       SET status = 'sent',
           sent_at = now(),
           processing_started_at = NULL,
           updated_at = now(),
           last_error_code = NULL
       WHERE id = $1`,
      [id],
    );
  }, options);
}

async function markOutboxFailed(id, errorCode, options = {}) {
  const attempts = Number(options.attempts || 1);
  const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 8));
  const dead = attempts >= OUTBOX_MAX_ATTEMPTS;
  return withClient(async (client) => {
    await client.query(
      `UPDATE outbox_events
       SET status = $4,
           last_error_code = $2,
           next_attempt_at = now() + make_interval(secs => $3),
           processing_started_at = NULL,
           updated_at = now()
       WHERE id = $1`,
      [id, String(errorCode || "error").slice(0, 120), delaySeconds, dead ? "dead" : "failed"],
    );
  }, options);
}

async function getLeadRowById(client, leadId) {
  const result = await client.query(`SELECT * FROM leads WHERE id = $1`, [leadId]);
  return result.rows[0] || null;
}

module.exports = {
  STATUS: [...STATUS],
  createLead,
  listLeads,
  getLeadByPublicId,
  updateLead,
  claimPendingOutbox,
  markOutboxSent,
  markOutboxFailed,
  getLeadRowById,
  mapLead,
};
