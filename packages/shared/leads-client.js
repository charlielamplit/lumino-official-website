(function (root) {
  "use strict";

  const STORAGE_KEY = "lumino.public.leads.v1";
  const STAFF_SESSION_KEY = "lumino-staff-session-token";
  const LEGACY_STAFF_KEY = "lumino-leads-staff-key";
  const STATUS_LABELS = {
    new: "新线索",
    claimed: "已认领",
    qualified: "有效线索",
    disqualified: "不适用",
    converted: "已转化",
  };
  const ERROR_MESSAGES = {
    VALIDATION_FAILED: "提交信息未通过校验，请检查后重试。",
    AUTH_REQUIRED: "登录已过期，请重新登录。",
    TENANT_FORBIDDEN: "当前工作区不可用，请联系管理员。",
    CAPABILITY_FORBIDDEN: "当前账号没有执行此操作的权限。",
    RESOURCE_NOT_FOUND: "线索不存在或已不可访问。",
    REVISION_CONFLICT: "线索已被其他人更新，请刷新后重试。",
    RATE_LIMITED: "请求过于频繁，请稍后重试。",
    DEPENDENCY_UNAVAILABLE: "服务暂不可用，本次操作尚未正式保存，请稍后重试。",
    INTERNAL_ERROR: "操作未完成，请稍后重试并保留请求编号。",
    NETWORK_UNAVAILABLE: "网络不可用，本次操作尚未正式保存，请检查连接后重试。",
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
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads.slice(0, 200)));
    } catch (_) {
      // Storage can be unavailable in private browsing or restricted embeds.
    }
  }

  function upsertLocal(lead) {
    const leads = readLocal().filter((item) => item.id !== lead.id);
    leads.unshift(lead);
    writeLocal(leads);
    return lead;
  }

  function getStaffSessionToken() {
    try {
      return root.sessionStorage.getItem(STAFF_SESSION_KEY)
        || root.sessionStorage.getItem(LEGACY_STAFF_KEY)
        || "";
    } catch (_) {
      return "";
    }
  }

  function hasStaffSession() {
    return Boolean(getStaffSessionToken());
  }

  function clearStaffSession(options = {}) {
    try { root.sessionStorage.removeItem(STAFF_SESSION_KEY); } catch (_) {}
    try { root.sessionStorage.removeItem(LEGACY_STAFF_KEY); } catch (_) {}
    try { root.sessionStorage.removeItem("lumino-staff-profile"); } catch (_) {}
    if (options.notify !== false && typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
      root.dispatchEvent(new root.CustomEvent("lumino:staff-session-expired", {
        detail: { code: options.code || "AUTH_REQUIRED" },
      }));
    }
  }

  function inferLegacyCode(status) {
    if (status === 400 || status === 413) return "VALIDATION_FAILED";
    if (status === 401) return "AUTH_REQUIRED";
    if (status === 403) return "CAPABILITY_FORBIDDEN";
    if (status === 404) return "RESOURCE_NOT_FOUND";
    if (status === 409) return "REVISION_CONFLICT";
    if (status === 429) return "RATE_LIMITED";
    if (status === 503) return "DEPENDENCY_UNAVAILABLE";
    return "INTERNAL_ERROR";
  }

  function parseApiResponse(response, payload, fallbackMessage) {
    const status = Number(response?.status || 0);
    const responseOk = Boolean(response?.ok);
    const body = payload && typeof payload === "object" ? payload : {};
    const isV1 = typeof body.contractVersion === "string" && typeof body.ok === "boolean";

    if (responseOk && body.ok !== false) {
      return {
        ok: true,
        status,
        data: isV1 && body.data && typeof body.data === "object" ? body.data : body,
        requestId: body.requestId || null,
        contractVersion: body.contractVersion || null,
        meta: body.meta || null,
      };
    }

    const apiError = isV1 && body.error && typeof body.error === "object" ? body.error : {};
    const code = apiError.code || inferLegacyCode(status);
    const legacyMessage = typeof body.error === "string" ? body.error : "";
    return {
      ok: false,
      status,
      code,
      error: ERROR_MESSAGES[code] || legacyMessage || fallbackMessage || "操作失败，请稍后重试。",
      requestId: body.requestId || null,
      retryable: apiError.retryable === true || [429, 500, 502, 503, 504].includes(status),
      recovery: apiError.recovery || (status === 401 ? "SIGN_IN" : status === 409 ? "REFRESH_RESOURCE" : "RETRY_LATER"),
      fieldErrors: Array.isArray(apiError.fieldErrors) ? apiError.fieldErrors : [],
      retryAfterSeconds: Number.isInteger(apiError.retryAfterSeconds) ? apiError.retryAfterSeconds : null,
    };
  }

  async function readApiResponse(response, fallbackMessage) {
    const payload = await response.json().catch(() => ({}));
    return parseApiResponse(response, payload, fallbackMessage);
  }

  function networkError(fallbackMessage) {
    return {
      ok: false,
      status: 0,
      code: "NETWORK_UNAVAILABLE",
      error: fallbackMessage || ERROR_MESSAGES.NETWORK_UNAVAILABLE,
      requestId: null,
      retryable: true,
      recovery: "RETRY_LATER",
      fieldErrors: [],
      retryAfterSeconds: null,
    };
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
      const response = await root.fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const parsed = await readApiResponse(response, "提交失败，请检查信息后重试。");
      if (!parsed.ok) return parsed;
      const data = parsed.data || {};
      const leadId = data.leadId || data.lead?.id;
      if (!leadId) {
        return { ...networkError("服务端未返回线索编号，本次提交状态无法确认，请勿重复提交。"), code: "INVALID_RESPONSE" };
      }
      const lead = data.lead && typeof data.lead === "object"
        ? { ...data.lead, localOnly: false }
        : { ...buildLead(body, leadId), localOnly: false };
      return {
        ...parsed,
        ok: true,
        leadId,
        lead,
        channel: "api",
        notified: Boolean(data.notified),
      };
    } catch (_) {
      return networkError();
    }
  }

  async function fetchLeads() {
    const token = getStaffSessionToken();
    if (!token) {
      return { ok: true, leads: readLocal(), source: "local-demo", demo: true };
    }
    try {
      const response = await root.fetch("/api/leads", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const parsed = await readApiResponse(response, "线索收件箱加载失败，请稍后重试。");
      if (!parsed.ok) {
        if (parsed.status === 401 || parsed.recovery === "SIGN_IN") clearStaffSession({ code: parsed.code });
        return {
          ...parsed,
          leads: [],
          source: parsed.status === 401 ? "auth-required" : "unavailable",
        };
      }
      const remote = Array.isArray(parsed.data?.leads) ? parsed.data.leads : [];
      const leads = remote.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return { ...parsed, ok: true, leads, source: "api" };
    } catch (_) {
      return { ...networkError("网络不可用，无法读取正式线索收件箱。"), leads: [], source: "unavailable" };
    }
  }

  function patchLocalDemo(id, patch) {
    const local = readLocal();
    const index = local.findIndex((lead) => lead.id === id);
    if (index < 0) return { ok: false, error: "线索不存在", code: "RESOURCE_NOT_FOUND" };
    const updatedAt = new Date().toISOString();
    const updated = { ...local[index], ...patch, updatedAt, localOnly: true };
    if (patch.status === "claimed" || patch.claimedBy) {
      updated.claimedBy = patch.claimedBy || updated.claimedBy;
      updated.claimedAt = updated.claimedAt || updatedAt;
      if (updated.status === "new" || patch.status === "claimed") updated.status = patch.status || "claimed";
    }
    if (patch.note) {
      updated.notes = [...(updated.notes || []), { at: updatedAt, by: patch.actor || "staff", text: patch.note }];
    }
    local[index] = updated;
    writeLocal(local);
    return { ok: true, lead: updated, localOnly: true, source: "local-demo" };
  }

  async function patchLead(id, patch) {
    const token = getStaffSessionToken();
    if (!token) return patchLocalDemo(id, patch);

    try {
      const response = await root.fetch("/api/leads", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          status: patch.status,
          note: patch.note,
          claim: patch.claim === true || patch.status === "claimed",
        }),
      });
      const parsed = await readApiResponse(response, "线索更新失败，请稍后重试。");
      if (!parsed.ok) {
        if (parsed.status === 401 || parsed.recovery === "SIGN_IN") clearStaffSession({ code: parsed.code });
        return parsed;
      }
      const lead = parsed.data?.lead;
      if (!lead) {
        return { ...networkError("服务端未返回更新后的线索，请刷新收件箱。"), code: "INVALID_RESPONSE", recovery: "REFRESH_RESOURCE" };
      }
      return { ...parsed, ok: true, lead, localOnly: false, source: "api" };
    } catch (_) {
      return networkError("网络不可用，本次更新尚未正式保存，请刷新后重试。");
    }
  }

  root.LuminoLeadsClient = {
    STORAGE_KEY,
    STAFF_SESSION_KEY,
    LEGACY_STAFF_KEY,
    STATUS_LABELS,
    submitLead,
    fetchLeads,
    patchLead,
    readLocal,
    upsertLocal,
    getStaffSessionToken,
    hasStaffSession,
    clearStaffSession,
    parseApiResponse,
  };
})(typeof window !== "undefined" ? window : globalThis);
