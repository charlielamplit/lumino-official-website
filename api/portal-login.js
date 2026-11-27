import { platformDb } from "./_lib/platform-db.js";
import { createRequestId, sendSuccess, sendError, sendDomainError } from "./_lib/platform-api-response.js";

export default async function handler(request, response) {
  const requestId = createRequestId(request);
  if (request.method !== "POST") return sendError(response, "METHOD_NOT_ALLOWED", { requestId });
  if (process.env.PORTAL_AUTH_ENABLED !== "1") return sendError(response, "DEPENDENCY_UNAVAILABLE", { requestId });
  try {
    platformDb.assertPostgresMode();
    const email = String(request.body?.email || "").trim();
    const password = String(request.body?.password || "");
    if (!email || !password) return sendError(response, "VALIDATION_FAILED", { requestId });
    const session = await platformDb.authenticatePortal({ email, password, requestId });
    return sendSuccess(response, {
      token: session.token,
      expiresAt: session.expiresAt,
      user: session.user,
      tenant: session.tenant,
    }, { requestId });
  } catch (error) {
    return sendDomainError(response, error, { requestId });
  }
}
