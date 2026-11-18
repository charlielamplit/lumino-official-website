"use strict";

const AUTHORITY_CONTRACT_VERSION = "1.0.0";

const AUTHORITY_ERROR_CATALOG = Object.freeze({
  AUTH_REQUIRED: Object.freeze({ httpStatus: 401, publicMessage: "Authentication is required." }),
  TENANT_FORBIDDEN: Object.freeze({ httpStatus: 403, publicMessage: "The active workspace is not available." }),
  PROJECT_NOT_FOUND: Object.freeze({ httpStatus: 404, publicMessage: "The annual project was not found." }),
  OBJECT_FORBIDDEN: Object.freeze({ httpStatus: 404, publicMessage: "The requested object was not found." }),
  OBJECT_REVISION_CONFLICT: Object.freeze({ httpStatus: 409, publicMessage: "The object has changed. Refresh and retry." }),
  CAPABILITY_FORBIDDEN: Object.freeze({ httpStatus: 403, publicMessage: "This Agent capability is not available for the current role." }),
  AUTHORITY_DEPENDENCY_INVALID: Object.freeze({ httpStatus: 500, publicMessage: "The authorization service is not configured." }),
});

function authorityError(code, detail) {
  const definition = AUTHORITY_ERROR_CATALOG[code] || AUTHORITY_ERROR_CATALOG.AUTHORITY_DEPENDENCY_INVALID;
  const error = new Error(definition.publicMessage);
  error.code = code;
  error.httpStatus = definition.httpStatus;
  if (detail) error.detail = detail;
  return error;
}

function requiredMethod(target, method, label) {
  if (!target || typeof target[method] !== "function") {
    throw authorityError("AUTHORITY_DEPENDENCY_INVALID", `${label}.${method} is required`);
  }
}

function safeRoles(roles) {
  return [...new Set((Array.isArray(roles) ? roles : []).map((role) => String(role).trim()).filter(Boolean))].sort();
}

class ServerAuthorityBoundary {
  constructor(options = {}) {
    requiredMethod(options.identityProvider, "resolveSession", "identityProvider");
    requiredMethod(options.membershipRepository, "findActive", "membershipRepository");
    requiredMethod(options.annualProjectRepository, "findByIdForTenant", "annualProjectRepository");
    requiredMethod(options.objectRepository, "findCurrentByIdForTenant", "objectRepository");
    requiredMethod(options.capabilityPolicy, "canUse", "capabilityPolicy");
    requiredMethod(options.auditSink, "append", "auditSink");
    this.identityProvider = options.identityProvider;
    this.membershipRepository = options.membershipRepository;
    this.annualProjectRepository = options.annualProjectRepository;
    this.objectRepository = options.objectRepository;
    this.capabilityPolicy = options.capabilityPolicy;
    this.auditSink = options.auditSink;
    this.clock = options.clock || (() => Date.now());
  }

  async audit(input) {
    await this.auditSink.append({
      schemaVersion: AUTHORITY_CONTRACT_VERSION,
      eventType: "AUTHORIZATION_DECIDED",
      occurredAt: new Date(this.clock()).toISOString(),
      outcome: input.outcome,
      reasonCode: input.reasonCode,
      actorId: input.actorId || null,
      tenantId: input.tenantId || null,
      capability: input.capability || null,
      annualProjectId: input.annualProjectId || null,
      objectRef: input.objectRef || null,
    });
  }

  async deny(code, facts = {}) {
    await this.audit({ ...facts, outcome: "DENIED", reasonCode: code });
    throw authorityError(code);
  }

  async resolveAgentContext(request = {}) {
    const capability = String(request.capability == null ? "" : request.capability).trim();
    if (!capability) {
      return this.deny("CAPABILITY_FORBIDDEN", {});
    }
    const hint = request.clientHint || {};
    const session = await this.identityProvider.resolveSession(request.sessionRef);
    if (!session?.userId || !session?.activeTenantId) {
      return this.deny("AUTH_REQUIRED", { capability });
    }

    const actorId = String(session.userId);
    const tenantId = String(session.activeTenantId);
    if (hint.tenantId && String(hint.tenantId) !== tenantId) {
      return this.deny("TENANT_FORBIDDEN", { actorId, tenantId, capability });
    }

    const membership = await this.membershipRepository.findActive({ userId: actorId, tenantId });
    if (!membership
      || (membership.userId && String(membership.userId) !== actorId)
      || (membership.tenantId && String(membership.tenantId) !== tenantId)) {
      return this.deny("TENANT_FORBIDDEN", { actorId, tenantId, capability });
    }
    const roles = safeRoles(membership.roles);
    if (!roles.length) {
      return this.deny("TENANT_FORBIDDEN", { actorId, tenantId, capability });
    }

    const annualProjectId = String(hint.annualProjectId == null ? "" : hint.annualProjectId).trim();
    if (!annualProjectId) {
      return this.deny("PROJECT_NOT_FOUND", { actorId, tenantId, capability });
    }
    const project = await this.annualProjectRepository.findByIdForTenant({ annualProjectId, tenantId });
    if (!project || String(project.id) !== annualProjectId || String(project.tenantId) !== tenantId) {
      return this.deny("PROJECT_NOT_FOUND", { actorId, tenantId, capability, annualProjectId });
    }
    if (!project.serviceId || !/^\d{4}$/.test(String(project.serviceYear || ""))) {
      return this.deny("AUTHORITY_DEPENDENCY_INVALID", { actorId, tenantId, capability, annualProjectId });
    }

    const hintedRef = hint.objectRef || {};
    const objectId = String(hintedRef.id == null ? "" : hintedRef.id).trim();
    if (!objectId) {
      return this.deny("OBJECT_FORBIDDEN", { actorId, tenantId, capability, annualProjectId });
    }
    const object = await this.objectRepository.findCurrentByIdForTenant({
      objectId,
      tenantId,
      annualProjectId: project.id,
    });
    if (!object
      || String(object.id) !== objectId
      || String(object.annualProjectId) !== String(project.id)
      || String(object.tenantId) !== tenantId) {
      return this.deny("OBJECT_FORBIDDEN", { actorId, tenantId, capability, annualProjectId });
    }
    if (!object.type || !object.workstream || !Number.isInteger(object.revision) || object.revision < 1) {
      return this.deny("AUTHORITY_DEPENDENCY_INVALID", { actorId, tenantId, capability, annualProjectId });
    }
    if (hintedRef.type && String(hintedRef.type) !== String(object.type)) {
      return this.deny("OBJECT_FORBIDDEN", { actorId, tenantId, capability, annualProjectId });
    }
    if (!Number.isInteger(hintedRef.revision) || hintedRef.revision !== object.revision) {
      return this.deny("OBJECT_REVISION_CONFLICT", {
        actorId,
        tenantId,
        capability,
        annualProjectId,
        objectRef: { type: object.type, id: object.id, revision: object.revision },
      });
    }

    const allowed = await this.capabilityPolicy.canUse({
      capability,
      actor: { userId: actorId, tenantId, roles },
      project,
      object,
    });
    if (!allowed) {
      return this.deny("CAPABILITY_FORBIDDEN", {
        actorId,
        tenantId,
        capability,
        annualProjectId,
        objectRef: { type: object.type, id: object.id, revision: object.revision },
      });
    }

    const context = {
      contextVersion: AUTHORITY_CONTRACT_VERSION,
      serviceId: String(project.serviceId),
      tenantId,
      annualProjectId: project.id,
      serviceYear: String(project.serviceYear),
      workstream: String(object.workstream),
      objectRef: { type: object.type, id: object.id, revision: object.revision },
      period: object.period?.quarter ? { quarter: object.period.quarter } : {},
    };
    await this.audit({
      outcome: "ALLOWED",
      reasonCode: "AUTHORIZED",
      actorId,
      tenantId,
      capability,
      annualProjectId,
      objectRef: context.objectRef,
    });
    return {
      authorityVersion: AUTHORITY_CONTRACT_VERSION,
      actor: { userId: actorId, tenantId, roles },
      context,
    };
  }
}

module.exports = {
  AUTHORITY_CONTRACT_VERSION,
  AUTHORITY_ERROR_CATALOG,
  ServerAuthorityBoundary,
  authorityError,
};
