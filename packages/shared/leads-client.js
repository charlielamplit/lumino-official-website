(function (root) {
  "use strict";

  const STORAGE_KEY = "lumino.public.leads.v1";
  const STATUS_LABELS = {
    new: "新线索",
    claimed: "已认领",
    qualified: "有效线索",
    disqualified: "不适用",
    converted: "已转化",
  };

  function readLocal() {
    try {
      const raw = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocal(leads) {
    root.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads.slice(0, 200)));
  }

  function upsertLocal(lead) {
    const leads = readLocal().filter((item) => item.id !== lead.id);
    leads.unshift(lead);
    writeLocal(leads);
    return lead;
  }

  function makeLocalId() {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `LM-${stamp}-L${rand}`;
  }

  function buildLead(payload, leadId) {
    const now = new Date().toISOString();
    return {
      id: leadId || makeLocalId(),
      status: "new",
      createdAt: now,
      updatedAt: now,
      claimedBy: null,
      claimedAt: null,
      notes: [],
      source: payload.source || "public-contact",
      company: payload.company || "",
      name: payload.name || "",
      phone: payload.phone || "",
      email: payload.email || "",
      industry: payload.industry || "",
      timeline: payload.timeline || "",
      services: Array.isArray(payload.services)
        ? payload.services
        : String(payload.serviceId || "")
            .split(/[,，\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
      note: payload.note || "",
      requestType: payload.requestType || "service-consultation",
      consent: true,
      localOnly: Boolean(payload.localOnly),
    };
  }

  async function submitLead(payload) {
    const body = {
      company: payload.company,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      industry: payload.industry,
      timeline: payload.timeline,
      serviceId: payload.serviceId,
      services: payload.services,
      note: payload.note,
      source: payload.source,
      requestType: payload.requestType || "service-consultation",
      consent: payload.consent === true || payload.consent === "on",
      context: payload.context || null,
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.leadId) {
        const lead = buildLead(body, data.leadId);
        lead.localOnly = false;
        lead.notified = Boolean(data.notified);
        upsertLocal(lead);
        return { ok: true, leadId: data.leadId, lead, channel: "api", notified: Boolean(data.notified) };
      }
      if (response.status >= 400 && response.status < 500) {
        return { ok: false, error: data.error || "提交信息未通过校验", retryable: false };
      }
      // 5xx / missing API: local-only bridge for the Portal demo.
      const lead = buildLead({ ...body, localOnly: true });
      upsertLocal(lead);
      return {
        ok: true,
        leadId: lead.id,
        lead,
        channel: "local",
        notified: false,
        warning: data.error || "服务端不可用，记录仅保存在当前浏览器",
      };
    } catch (_) {
      const lead = buildLead({ ...body, localOnly: true });
      upsertLocal(lead);
      return {
        ok: true,
        leadId: lead.id,
        lead,
        channel: "local",
        notified: false,
        warning: "网络不可用，记录仅保存在当前浏览器，不代表已送达服务团队",
      };
    }
  }

  async function fetchLeads() {
    const local = readLocal();
    try {
      const headers = {};
      const key = root.sessionStorage.getItem("lumino-leads-staff-key");
      if (key) headers["X-Lumino-Staff-Key"] = key;
      const response = await fetch("/api/leads", { headers });
      if (!response.ok) return { leads: local, source: "local" };
      const data = await response.json();
      const remote = Array.isArray(data.leads) ? data.leads : [];
      const byId = new Map();
      [...remote, ...local].forEach((lead) => {
        if (!lead?.id) return;
        if (!byId.has(lead.id)) byId.set(lead.id, lead);
      });
      const leads = [...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return { leads, source: remote.length ? "api+local" : "local" };
    } catch (_) {
      return { leads: local, source: "local" };
    }
  }

  async function patchLead(id, patch) {
    const local = readLocal();
    const index = local.findIndex((lead) => lead.id === id);
    let updated = null;
    if (index >= 0) {
      updated = {
        ...local[index],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      if (patch.status === "claimed" || patch.claimedBy) {
        updated.claimedBy = patch.claimedBy || updated.claimedBy;
        updated.claimedAt = updated.claimedAt || updated.updatedAt;
        if (updated.status === "new" || patch.status === "claimed") updated.status = patch.status || "claimed";
      }
      if (patch.note) {
        updated.notes = [...(updated.notes || []), { at: updated.updatedAt, by: patch.actor || "staff", text: patch.note }];
      }
      local[index] = updated;
      writeLocal(local);
    }

    try {
      const headers = { "Content-Type": "application/json" };
      const key = root.sessionStorage.getItem("lumino-leads-staff-key");
      if (key) headers["X-Lumino-Staff-Key"] = key;
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id, ...patch }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.lead) {
          upsertLocal(data.lead);
          return { ok: true, lead: data.lead };
        }
      }
    } catch (_) {
      /* local-only fallback */
    }

    if (updated) return { ok: true, lead: updated, localOnly: true };
    return { ok: false, error: "线索不存在" };
  }

  root.LuminoLeadsClient = {
    STORAGE_KEY,
    STATUS_LABELS,
    submitLead,
    fetchLeads,
    patchLead,
    readLocal,
    upsertLocal,
  };
})(typeof window !== "undefined" ? window : globalThis);
