/**
 * Leads persistence facade.
 * Phase-1 platform foundation: PostgreSQL only. No JSON/memory write fallback.
 */
import { platformDb } from "./platform-db.js";

let defaultTenantIdPromise = null;

async function resolveDefaultTenantId() {
  if (defaultTenantIdPromise) return defaultTenantIdPromise;
  defaultTenantIdPromise = (async () => {
    platformDb.assertPostgresMode();
    const { withClient, ensureDefaultTenant } = platformDb;
    return withClient(async (client) => {
      const tenant = await ensureDefaultTenant(client);
      return tenant.id;
    });
  })();
  try {
    return await defaultTenantIdPromise;
  } catch (error) {
    defaultTenantIdPromise = null;
    throw error;
  }
}

function asDbUnavailable(error) {
  if (error?.code === "DB_UNAVAILABLE" || error?.code === "DB_MODE_DISABLED") return error;
  const wrapped = new Error("数据库暂不可用");
  wrapped.code = "DB_UNAVAILABLE";
  wrapped.httpStatus = 503;
  wrapped.cause = error;
  return wrapped;
}

export async function listLeads(actor) {
  try {
    platformDb.assertPostgresMode();
    const tenantId = actor?.tenantId || (await resolveDefaultTenantId());
    return platformDb.listLeads({ tenantId });
  } catch (error) {
    throw asDbUnavailable(error);
  }
}

export async function getLead(id, actor) {
  try {
    platformDb.assertPostgresMode();
    const tenantId = actor?.tenantId || (await resolveDefaultTenantId());
    return platformDb.getLeadByPublicId({ tenantId, publicId: id });
  } catch (error) {
    throw asDbUnavailable(error);
  }
}

export async function createLead(input, options = {}) {
  try {
    platformDb.assertPostgresMode();
    const tenantId = await resolveDefaultTenantId();
    return platformDb.createLead(input, {
      tenantId,
      requestId: options.requestId || null,
    });
  } catch (error) {
    throw asDbUnavailable(error);
  }
}

export async function updateLead(id, patch, actor, options = {}) {
  try {
    platformDb.assertPostgresMode();
    if (!actor?.userId || !actor?.tenantId) {
      const error = new Error("未授权");
      error.code = "AUTH_REQUIRED";
      error.httpStatus = 401;
      throw error;
    }
    return platformDb.updateLead({
      tenantId: actor.tenantId,
      publicId: id,
      patch,
      actor,
      requestId: options.requestId || null,
    });
  } catch (error) {
    if (error?.httpStatus) throw error;
    throw asDbUnavailable(error);
  }
}

export const LEAD_STATUSES = platformDb.STATUS;
