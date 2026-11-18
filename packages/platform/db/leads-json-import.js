"use strict";

const crypto = require("node:crypto");

function publicIdOf(lead) {
  return String(lead?.id || lead?.public_id || "").trim();
}

function normalizeImportFields(lead) {
  return {
    company: String(lead.company || "unknown").slice(0, 120),
    name: String(lead.name || "unknown").slice(0, 80),
    phone: lead.phone == null || lead.phone === "" ? null : String(lead.phone).slice(0, 40),
    email: lead.email == null || lead.email === "" ? null : String(lead.email).slice(0, 120),
    industry: lead.industry == null || lead.industry === "" ? null : String(lead.industry).slice(0, 80),
    timeline: lead.timeline == null || lead.timeline === "" ? null : String(lead.timeline).slice(0, 120),
    services: Array.isArray(lead.services) ? lead.services.map(String) : [],
    note: String(lead.note || ""),
    notes: Array.isArray(lead.notes) ? lead.notes : [],
    source: String(lead.source || "json-import").slice(0, 120),
    request_type: String(lead.requestType || lead.request_type || "service-consultation").slice(0, 80),
    status: String(lead.status || "new"),
  };
}

function stableJson(value) {
  return JSON.stringify(value);
}

function rowMatchesImport(row, fields) {
  const rowServices = Array.isArray(row.services) ? row.services : [];
  const rowNotes = Array.isArray(row.notes) ? row.notes : [];
  return row.company === fields.company
    && row.name === fields.name
    && (row.phone || null) === fields.phone
    && (row.email || null) === fields.email
    && (row.industry || null) === fields.industry
    && (row.timeline || null) === fields.timeline
    && stableJson(rowServices) === stableJson(fields.services)
    && String(row.note || "") === fields.note
    && stableJson(rowNotes) === stableJson(fields.notes)
    && row.source === fields.source
    && row.request_type === fields.request_type
    && row.status === fields.status;
}

async function syncDailyCounters(client, tenantId, publicIds) {
  const byDay = new Map();
  for (const publicId of publicIds) {
    const match = /^LM-(\d{4})(\d{2})(\d{2})-(\d+)$/.exec(publicId);
    if (!match) continue;
    const day = `${match[1]}-${match[2]}-${match[3]}`;
    const seq = Number(match[4]);
    const prev = byDay.get(day) || 0;
    if (seq > prev) byDay.set(day, seq);
  }
  for (const [day, seq] of byDay) {
    await client.query(
      `INSERT INTO lead_daily_counters (tenant_id, day, seq)
       VALUES ($1, $2::date, $3)
       ON CONFLICT (tenant_id, day)
       DO UPDATE SET seq = GREATEST(lead_daily_counters.seq, EXCLUDED.seq)`,
      [tenantId, day, seq],
    );
  }
}

/**
 * Idempotent import. Same content ? unchanged (no UPDATE, no revision bump).
 */
async function importLeadsJson({ leads, tenantId, dryRun = false, withClient }) {
  if (typeof withClient !== "function") {
    throw new Error("withClient is required");
  }

  const summary = {
    total: Array.isArray(leads) ? leads.length : 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    would_insert: 0,
    would_update: 0,
    would_unchanged: 0,
    failed: [],
    dryRun: Boolean(dryRun),
  };

  const touchedForCounters = [];

  for (const lead of leads || []) {
    const publicId = publicIdOf(lead);
    if (!publicId) {
      summary.failed.push({ reason: "missing_public_id" });
      continue;
    }
    const fields = normalizeImportFields(lead);

    try {
      if (dryRun) {
        const existing = await withClient(async (client) => {
          const result = await client.query(
            `SELECT * FROM leads WHERE tenant_id = $1 AND public_id = $2 LIMIT 1`,
            [tenantId, publicId],
          );
          return result.rows[0] || null;
        });
        if (!existing) summary.would_insert += 1;
        else if (rowMatchesImport(existing, fields)) summary.would_unchanged += 1;
        else summary.would_update += 1;
        continue;
      }

      const result = await withClient(async (client) => {
        const existingResult = await client.query(
          `SELECT * FROM leads WHERE tenant_id = $1 AND public_id = $2 LIMIT 1`,
          [tenantId, publicId],
        );
        const existing = existingResult.rows[0];
        if (existing) {
          if (rowMatchesImport(existing, fields)) {
            return { action: "unchanged", revision: existing.revision, updatedAt: existing.updated_at };
          }
          const updated = await client.query(
            `UPDATE leads SET
               company = $3, name = $4, phone = $5, email = $6,
               email_normalized = lower(nullif($6, '')),
               phone_normalized = nullif(regexp_replace(coalesce($5, ''), '\\s+', '', 'g'), ''),
               industry = $7, timeline = $8, services = $9::jsonb, note = $10,
               notes = $11::jsonb, source = $12, request_type = $13, status = $14,
               is_demo = true, updated_at = now(), revision = revision + 1
             WHERE tenant_id = $1 AND public_id = $2
             RETURNING revision, updated_at`,
            [
              tenantId,
              publicId,
              fields.company,
              fields.name,
              fields.phone,
              fields.email,
              fields.industry,
              fields.timeline,
              JSON.stringify(fields.services),
              fields.note,
              JSON.stringify(fields.notes),
              fields.source,
              fields.request_type,
              fields.status,
            ],
          );
          return {
            action: "updated",
            revision: updated.rows[0].revision,
            updatedAt: updated.rows[0].updated_at,
          };
        }

        await client.query(
          `INSERT INTO leads (
             public_id, tenant_id, status, company, name, phone, email,
             email_normalized, phone_normalized, industry, timeline, services,
             note, notes, source, request_type, consent, consent_at, notice_version,
             context, user_agent, is_demo, created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,
             lower(nullif($7,'')), nullif(regexp_replace(coalesce($6,''), '\\s+', '', 'g'), ''),
             $8,$9,$10::jsonb,
             $11,$12::jsonb,$13,$14,true,coalesce($15::timestamptz, now()),'v1-import',
             $16::jsonb,$17,true,coalesce($15::timestamptz, now()), coalesce($18::timestamptz, now())
           )`,
          [
            publicId,
            tenantId,
            fields.status,
            fields.company,
            fields.name,
            fields.phone,
            fields.email,
            fields.industry,
            fields.timeline,
            JSON.stringify(fields.services),
            fields.note,
            JSON.stringify(fields.notes),
            fields.source,
            fields.request_type,
            lead.createdAt || lead.created_at || null,
            lead.context ? JSON.stringify(lead.context) : null,
            lead.userAgent || lead.user_agent || null,
            lead.updatedAt || lead.updated_at || null,
          ],
        );
        return { action: "inserted" };
      });

      if (result.action === "inserted") {
        summary.inserted += 1;
        touchedForCounters.push(publicId);
      } else if (result.action === "updated") {
        summary.updated += 1;
        touchedForCounters.push(publicId);
      } else {
        summary.unchanged += 1;
      }
    } catch (error) {
      summary.failed.push({ publicId, reason: error.code || "write_failed" });
    }
  }

  if (!dryRun && touchedForCounters.length) {
    await withClient((client) => syncDailyCounters(client, tenantId, touchedForCounters));
  }

  return summary;
}

function snapshotFingerprint(raw) {
  return crypto.createHash("sha256").update(JSON.stringify(raw)).digest("hex");
}

module.exports = {
  publicIdOf,
  normalizeImportFields,
  rowMatchesImport,
  importLeadsJson,
  syncDailyCounters,
  snapshotFingerprint,
};
