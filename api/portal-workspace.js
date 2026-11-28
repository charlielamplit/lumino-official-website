import { platformDb } from "./_lib/platform-db.js";
import { createRequestId, sendSuccess, sendError, sendDomainError } from "./_lib/platform-api-response.js";
import { evidenceConfigured } from "./_lib/portal-evidence-cos.js";

function bearerToken(request) {
  const header = String(request.headers?.authorization || "");
  return /^Bearer ([A-Za-z0-9_-]{32,})$/.exec(header)?.[1] || null;
}

export default async function handler(request, response) {
  const requestId = createRequestId(request);
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return sendError(response, "METHOD_NOT_ALLOWED", { requestId });
  if (process.env.PORTAL_AUTH_ENABLED !== "1") return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
  try {
    platformDb.assertPostgresMode();
    const token = bearerToken(request);
    const session = await platformDb.resolvePortalSession(token);
    if (!session) return sendError(response, "AUTH_REQUIRED", { requestId });
    if (request.method === "DELETE") {
      await platformDb.revokePortalSession(token);
      return sendSuccess(response, { revoked: true }, { requestId });
    }
    if (request.method === "POST") {
      const project = await platformDb.createPortalAnnualProject(session, {
        serviceYear: request.body?.serviceYear,
        confirmedTenantName: request.body?.confirmedTenantName,
        requestId,
      });
      return sendSuccess(response, { project }, { requestId, httpStatus: project.created ? 201 : 200 });
    }
    if (request.method === "PUT") {
      if (request.body?.operation === "create_material_request") {
        const result = await platformDb.createPortalMaterialRequest(session, {
          projectId: request.body?.projectId,
          facilityId: request.body?.facilityId,
          quarter: request.body?.quarter,
          requestId,
        });
        return sendSuccess(response, result, { requestId, httpStatus: result.created ? 201 : 200 });
      }
      if (request.body?.operation === "add_products") {
        const result = await platformDb.createPortalProductBatch(session, {
          projectId: request.body?.projectId,
          cnCodes: request.body?.cnCodes,
          requestId,
        });
        return sendSuccess(response, result, { requestId, httpStatus: 201 });
      }
      const record = await platformDb.createPortalProjectRecord(session, {
        projectId: request.body?.projectId,
        kind: request.body?.kind,
        record: request.body?.record,
        requestId,
      });
      return sendSuccess(response, { record }, { requestId, httpStatus: 201 });
    }
    if (request.method === "PATCH") {
      if (request.body?.operation === "rename_tenant") {
        const tenant = await platformDb.renamePortalTenant(session, { tenantName: request.body?.tenantName, requestId });
        return sendSuccess(response, { tenant }, { requestId });
      }
      if (request.body?.operation === "update_record") {
        const record = await platformDb.updatePortalProjectRecord(session, {
          recordId: request.body?.recordId,
          kind: request.body?.kind,
          record: request.body?.record,
          requestId,
        });
        return sendSuccess(response, { record }, { requestId });
      }
      return sendError(response, "VALIDATION_FAILED", { requestId });
    }
    const evidenceUpload = evidenceConfigured();
    return sendSuccess(response, { ...await platformDb.portalWorkspace(session, { includeEvidence: evidenceUpload }), capabilities: { evidenceUpload } }, { requestId });
  } catch (error) {
    return sendDomainError(response, error, { requestId });
  }
}
