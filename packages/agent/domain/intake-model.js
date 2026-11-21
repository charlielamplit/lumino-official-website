(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoIntakeModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const INTAKE_REQUEST_STATUS = Object.freeze({
    READY: "READY",
    IN_PROGRESS: "IN_PROGRESS",
    SUBMITTED: "SUBMITTED",
    AWAITING_CONFIRMATION: "AWAITING_CONFIRMATION",
    RETURNED: "RETURNED",
    CONFIRMED: "CONFIRMED",
    BLOCKED: "BLOCKED",
  });
  const confirmRoles = new Set(["customer_admin", "customer_owner"]);
  const allowedExtensions = new Set(["txt", "csv"]);

  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  function token(value) {
    return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-");
  }

  function buildEvidenceId({ year, quarter, requestId, contentSha256 }) {
    if (!year || !quarter || !requestId || !contentSha256) fail("EVIDENCE_ID_INPUT_REQUIRED", "证据 ID 缺少请求、期间或摘要。");
    return `EVD-${token(year)}-${token(quarter)}-${token(requestId)}-${token(contentSha256).slice(0, 16)}`;
  }

  function buildCandidateId({ evidenceId, extractorVersion }) {
    if (!evidenceId || !extractorVersion) fail("CANDIDATE_ID_INPUT_REQUIRED", "候选 ID 缺少证据或提取器版本。");
    return `CAND-${token(evidenceId)}-${token(extractorVersion)}`;
  }

  function assertUploadAllowed(request, fileMeta) {
    if (!request?.id) fail("MATERIAL_REQUEST_REQUIRED", "请选择材料请求。");
    if (["BLOCKED", "DONE", "CLOSED"].includes(request.status)) fail("MATERIAL_REQUEST_NOT_OPEN", "该材料请求当前不能接收文件。");
    if (!fileMeta?.name || !Number(fileMeta.size)) fail("FILE_REQUIRED", "请选择非空文件。");
    if (Number(fileMeta.size) > 30 * 1024 * 1024) fail("FILE_TOO_LARGE", "文件超过 30 MB。");
    const extension = String(fileMeta.name).split(".").pop().toLowerCase();
    if (!allowedExtensions.has(extension)) fail("UNSUPPORTED_FILE_TYPE", "当前演示提取仅支持 TXT 或 CSV。");
    if (request.year && fileMeta.year && String(request.year) !== String(fileMeta.year)) fail("REQUEST_YEAR_MISMATCH", "材料请求与当前年度不一致。");
    if (request.quarter && fileMeta.quarter && request.quarter !== fileMeta.quarter) fail("REQUEST_PERIOD_MISMATCH", "材料请求与当前期间不一致。");
  }

  function assertConfirmAllowed({ candidate, evidence, request, actor, expectedRevision }) {
    if (!candidate || !evidence || !request) fail("INTAKE_LINEAGE_REQUIRED", "确认缺少候选、证据或材料请求。");
    if (!actor?.actor || !actor?.role || !actor?.tenantId) fail("NAMED_ACTOR_REQUIRED", "确认必须使用具名登录身份。");
    if (!confirmRoles.has(actor.role)) fail("FORBIDDEN", "当前角色无权确认提取候选。");
    const tenants = [candidate.tenantId, evidence.tenantId, request.tenantId].filter(Boolean);
    if (!tenants.length || tenants.some((tenantId) => tenantId !== actor.tenantId)) fail("TENANT_MISMATCH", "对象不属于当前企业工作区。");
    if (candidate.evidenceId !== evidence.evidenceId || candidate.requestId !== request.id || evidence.requestId !== request.id) fail("LINEAGE_MISMATCH", "候选、证据与材料请求不属于同一血缘。");
    if (candidate.status !== "READY_FOR_REVIEW") fail("CANDIDATE_NOT_CONFIRMABLE", "候选已退回、失效或完成确认。");
    if (Number(candidate.revision) !== Number(expectedRevision)) fail("CANDIDATE_REVISION_STALE", "候选版本已更新，请刷新后重试。");
  }

  function projectRequestStatus({ workPackage, evidence, candidate, fact }) {
    if (workPackage?.status === "BLOCKED") return INTAKE_REQUEST_STATUS.BLOCKED;
    if (fact?.status === "CONFIRMED" && fact?.metadata?.evidenceId === evidence?.evidenceId) return INTAKE_REQUEST_STATUS.CONFIRMED;
    if (candidate?.status === "REJECTED" || workPackage?.status === "RETURNED") return INTAKE_REQUEST_STATUS.RETURNED;
    if (candidate?.status === "READY_FOR_REVIEW") return INTAKE_REQUEST_STATUS.AWAITING_CONFIRMATION;
    if (evidence) return INTAKE_REQUEST_STATUS.SUBMITTED;
    if (["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(workPackage?.status)) return INTAKE_REQUEST_STATUS.IN_PROGRESS;
    return INTAKE_REQUEST_STATUS.READY;
  }

  function createMemoryCandidateStore({ clock = () => Date.now() } = {}) {
    const candidates = new Map();
    return {
      put(input) {
        if (!input?.id || !input.evidenceId || !input.requestId || !input.tenantId) fail("INVALID_CANDIDATE", "候选缺少受控血缘字段。");
        const existing = candidates.get(input.id);
        const candidate = Object.freeze({
          ...input,
          revision: existing ? existing.revision + 1 : Number(input.revision || 1),
          status: input.status || "READY_FOR_REVIEW",
          createdAt: input.createdAt || new Date(clock()).toISOString(),
        });
        candidates.set(candidate.id, candidate);
        return { ...candidate };
      },
      get({ candidateId, tenantId }) {
        const candidate = candidates.get(candidateId);
        return candidate && candidate.tenantId === tenantId ? { ...candidate } : null;
      },
      latest({ requestId, tenantId, year, quarter }) {
        return [...candidates.values()]
          .filter((item) => item.requestId === requestId && item.tenantId === tenantId && String(item.year) === String(year) && item.quarter === quarter)
          .at(-1) || null;
      },
      confirm({ candidateId, tenantId, expectedRevision, actor }) {
        const current = this.get({ candidateId, tenantId });
        if (!current) fail("CANDIDATE_NOT_FOUND", "找不到当前候选。");
        if (current.revision !== Number(expectedRevision)) fail("CANDIDATE_REVISION_STALE", "候选版本已更新，请刷新后重试。");
        const confirmed = Object.freeze({ ...current, status: "CONFIRMED", confirmedBy: actor.actor, confirmedAt: new Date(clock()).toISOString() });
        candidates.set(candidateId, confirmed);
        return { ...confirmed };
      },
    };
  }

  return { INTAKE_REQUEST_STATUS, buildEvidenceId, buildCandidateId, assertUploadAllowed, assertConfirmAllowed, projectRequestStatus, createMemoryCandidateStore };
});
