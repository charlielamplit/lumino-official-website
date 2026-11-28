import crypto from "node:crypto";
import { platformDb } from "./_lib/platform-db.js";
import { createRequestId, sendError, sendSuccess, sendDomainError } from "./_lib/platform-api-response.js";
import { createCosEvidenceStore, evidenceConfigured } from "./_lib/portal-evidence-cos.js";

function bearerToken(request) {
  return /^Bearer ([A-Za-z0-9_-]{32,})$/.exec(String(request.headers?.authorization || ""))?.[1] || null;
}

function invalid(message) {
  return Object.assign(new Error(message), { code: "VALIDATION_FAILED", httpStatus: 400 });
}

function parseUpload(body) {
  const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
  const extension = /\.([a-z]+)$/i.exec(filename)?.[1]?.toLowerCase();
  if (!filename || filename.length > 180 || /[\\/\x00-\x1f\x7f]/.test(filename)
    || !["txt", "csv"].includes(extension)) throw invalid("仅支持 UTF-8 TXT/CSV 文件");
  const encoded = body?.base64;
  if (typeof encoded !== "string" || encoded.length > 2796204 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw invalid("文件内容不是有效的 Base64 数据");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 1 || bytes.length > 2097152 || bytes.toString("base64") !== encoded) throw invalid("文件大小须为 1 字节至 2 MiB");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw invalid("文件必须使用 UTF-8 编码"); }
  if (text.includes("\0")) throw invalid("文本文件不能包含空字节");
  return { filename, bytes, mediaType: extension === "csv" ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8",
    sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}

export function createPortalEvidenceHandler(storeFactory = createCosEvidenceStore, configured = evidenceConfigured) {
  return async function handler(request, response) {
  const requestId = createRequestId(request);
  if (!["POST", "GET"].includes(request.method)) return sendError(response, "METHOD_NOT_ALLOWED", { requestId });
  if (process.env.PORTAL_AUTH_ENABLED !== "1") return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
  try {
    platformDb.assertPostgresMode();
    const session = await platformDb.resolvePortalSession(bearerToken(request));
    if (!session) return sendError(response, "AUTH_REQUIRED", { requestId });
    if (!configured()) return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
    const store = storeFactory();
    if (request.method === "POST") {
      const { filename, bytes, mediaType, sha256 } = parseUpload(request.body);
      const reserved = await platformDb.reservePortalEvidence(session, {
        materialRequestId: request.body?.materialRequestId, filename, mediaType,
        byteLength: bytes.length, sha256, requestId,
      });
      try { await store.put(reserved.objectKey, bytes, mediaType); }
      catch (error) {
        await platformDb.setPortalEvidenceStatus(session, reserved.id, "FAILED", requestId);
        console.error("[portal-evidence] COS upload failed", { requestId, code: error?.code || "unknown" });
        return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
      }
      const evidence = await platformDb.setPortalEvidenceStatus(session, reserved.id, "STORED", requestId);
      return sendSuccess(response, { evidence }, { requestId, httpStatus: 201 });
    }
    const evidence = await platformDb.getPortalEvidence(session, request.query?.evidenceId, requestId);
    let bytes;
    try { bytes = await store.get(evidence.objectKey); }
    catch (error) {
      console.error("[portal-evidence] COS download failed", { requestId, code: error?.code || "unknown" });
      return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
    }
    if (!Buffer.isBuffer(bytes) || bytes.length !== evidence.byteLength
      || crypto.createHash("sha256").update(bytes).digest("hex") !== evidence.sha256) {
      console.error("[portal-evidence] object integrity mismatch", { requestId, evidenceId: evidence.id });
      return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
    }
    response.status(200);
    response.setHeader("Content-Type", evidence.mediaType);
    response.setHeader("Content-Length", String(bytes.length));
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(evidence.filename)}`);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Request-Id", requestId);
    return response.end(bytes);
  } catch (error) {
    return sendDomainError(response, error, { requestId });
  }
  };
}

export default createPortalEvidenceHandler();
