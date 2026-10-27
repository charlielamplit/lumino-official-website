(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 2;
  const defaultStorageKey = "lumino-multiservice-workflow-v2";

  const definitions = {
    serviceCase: {
      states: ["NOT_STARTED", "SCOPING", "COLLECTING", "NEEDS_CONFIRMATION", "CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY", "CLOSED"],
      transitions: { NOT_STARTED: ["SCOPING"], SCOPING: ["COLLECTING"], COLLECTING: ["NEEDS_CONFIRMATION"], NEEDS_CONFIRMATION: ["CALCULATING", "COLLECTING"], CALCULATING: ["EXPERT_REVIEW", "COLLECTING"], EXPERT_REVIEW: ["DELIVERABLE_READY", "COLLECTING"], DELIVERABLE_READY: ["CLOSED", "COLLECTING"] },
    },
    productMaster: {
      states: ["DRAFT", "ACTIVE", "SUSPENDED", "RETIRED"],
      transitions: { DRAFT: ["ACTIVE"], ACTIVE: ["SUSPENDED", "RETIRED"], SUSPENDED: ["ACTIVE", "RETIRED"] },
    },
    cnDecision: {
      states: ["SUGGESTED", "UNDER_REVIEW", "CONFIRMED", "REJECTED", "EXPIRED", "SUPERSEDED"],
      transitions: { SUGGESTED: ["UNDER_REVIEW", "REJECTED"], UNDER_REVIEW: ["CONFIRMED", "REJECTED"], CONFIRMED: ["EXPIRED", "SUPERSEDED"] },
    },
    annualInclusion: {
      states: ["PROPOSED", "IN_SCOPE", "OUT_OF_SCOPE", "LOCKED"],
      transitions: { PROPOSED: ["IN_SCOPE", "OUT_OF_SCOPE"], IN_SCOPE: ["OUT_OF_SCOPE", "LOCKED"], OUT_OF_SCOPE: ["IN_SCOPE", "LOCKED"] },
    },
    shipment: {
      states: ["IMPORTED", "MATCHING", "NEEDS_REVIEW", "RECONCILED", "INCLUDED", "EXCLUDED", "FROZEN"],
      transitions: { IMPORTED: ["MATCHING"], MATCHING: ["NEEDS_REVIEW", "RECONCILED"], NEEDS_REVIEW: ["RECONCILED", "EXCLUDED"], RECONCILED: ["INCLUDED", "EXCLUDED"], INCLUDED: ["FROZEN"], EXCLUDED: ["FROZEN"] },
    },
    evidence: {
      states: ["UPLOADED", "SECURITY_SCANNED", "PARSED", "CLASSIFIED", "LINKED", "REVIEWED", "ACCEPTED", "ARCHIVED", "INFECTED", "PARSE_FAILED", "UNREADABLE", "DUPLICATE", "OUT_OF_PERIOD", "WRONG_ENTITY", "SUPERSEDED"],
      transitions: {
        UPLOADED: ["SECURITY_SCANNED", "INFECTED", "DUPLICATE"],
        SECURITY_SCANNED: ["PARSED", "PARSE_FAILED", "UNREADABLE"],
        PARSED: ["CLASSIFIED", "OUT_OF_PERIOD", "WRONG_ENTITY"],
        CLASSIFIED: ["LINKED", "WRONG_ENTITY"], LINKED: ["REVIEWED"], REVIEWED: ["ACCEPTED", "SUPERSEDED"], ACCEPTED: ["ARCHIVED", "SUPERSEDED"],
      },
    },
    fact: {
      states: ["MISSING", "PROPOSED", "NEEDS_CONFIRMATION", "CONFIRMED", "CONFLICTED", "NEEDS_EVIDENCE", "REJECTED", "APPROVED", "VERIFIED"],
      transitions: { MISSING: ["PROPOSED"], PROPOSED: ["NEEDS_CONFIRMATION", "REJECTED"], NEEDS_CONFIRMATION: ["CONFIRMED", "CONFLICTED", "NEEDS_EVIDENCE", "REJECTED"], CONFIRMED: ["APPROVED"], APPROVED: ["VERIFIED"] },
    },
    calculationRun: {
      states: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CURRENT", "STALE", "SUPERSEDED"],
      transitions: { QUEUED: ["RUNNING", "FAILED"], RUNNING: ["SUCCEEDED", "FAILED"], SUCCEEDED: ["CURRENT", "SUPERSEDED"], CURRENT: ["STALE"], STALE: ["SUPERSEDED"] },
    },
    finding: {
      states: ["OPEN", "TRIAGED", "ASSIGNED", "RESPONSE_SUBMITTED", "VALIDATING", "RESOLVED", "CLOSED", "REOPENED"],
      transitions: { OPEN: ["TRIAGED"], TRIAGED: ["ASSIGNED"], ASSIGNED: ["RESPONSE_SUBMITTED"], RESPONSE_SUBMITTED: ["VALIDATING"], VALIDATING: ["RESOLVED", "REOPENED"], RESOLVED: ["CLOSED", "REOPENED"], CLOSED: ["REOPENED"], REOPENED: ["ASSIGNED"] },
    },
    quarterlyPackage: {
      states: ["NOT_STARTED", "PLANNED", "COLLECTING", "READY_FOR_REVIEW", "APPROVED", "PACKAGE_READY", "SHARED", "ACKNOWLEDGED", "FROZEN"],
      transitions: { NOT_STARTED: ["PLANNED"], PLANNED: ["COLLECTING"], COLLECTING: ["READY_FOR_REVIEW"], READY_FOR_REVIEW: ["APPROVED", "COLLECTING"], APPROVED: ["PACKAGE_READY"], PACKAGE_READY: ["SHARED"], SHARED: ["ACKNOWLEDGED"], ACKNOWLEDGED: ["FROZEN"] },
    },
    formalArtifact: {
      states: ["DRAFT", "GENERATED", "VALIDATED", "INTERNAL_REVIEW", "APPROVED", "LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED", "AMENDMENT_REQUIRED", "REVOKED", "EXPIRED", "SUPERSEDED"],
      transitions: { DRAFT: ["GENERATED"], GENERATED: ["VALIDATED"], VALIDATED: ["INTERNAL_REVIEW"], INTERNAL_REVIEW: ["APPROVED", "DRAFT"], APPROVED: ["LOCKED"], LOCKED: ["SHARED", "AMENDMENT_REQUIRED"], SHARED: ["DELIVERED", "REVOKED"], DELIVERED: ["ACKNOWLEDGED", "AMENDMENT_REQUIRED"], ACKNOWLEDGED: ["AMENDMENT_REQUIRED", "EXPIRED"], AMENDMENT_REQUIRED: ["SUPERSEDED"] },
    },
    verification: {
      states: ["NOT_STARTED", "PLANNED", "IN_VERIFICATION", "REMEDIATION", "VERIFIED", "DELIVERED", "ACKNOWLEDGED"],
      transitions: { NOT_STARTED: ["PLANNED"], PLANNED: ["IN_VERIFICATION"], IN_VERIFICATION: ["REMEDIATION", "VERIFIED"], REMEDIATION: ["IN_VERIFICATION"], VERIFIED: ["DELIVERED"], DELIVERED: ["ACKNOWLEDGED"] },
    },
    serviceOrder: {
      states: ["DRAFT", "PENDING_CUSTOMER_CONFIRMATION", "CUSTOMER_REJECTED", "SIGNED_PENDING_HANDOFF", "PENDING_OPS_ACCEPTANCE", "ACTIVATING", "ACTIVE", "SUSPENDED", "PENDING_ACCEPTANCE", "COMPLETED", "CLOSED", "CANCELLED", "TERMINATED", "EXPIRED"],
      transitions: { DRAFT: ["PENDING_CUSTOMER_CONFIRMATION", "CANCELLED"], PENDING_CUSTOMER_CONFIRMATION: ["SIGNED_PENDING_HANDOFF", "CUSTOMER_REJECTED", "CANCELLED"], SIGNED_PENDING_HANDOFF: ["PENDING_OPS_ACCEPTANCE"], PENDING_OPS_ACCEPTANCE: ["ACTIVATING"], ACTIVATING: ["ACTIVE"], ACTIVE: ["SUSPENDED", "PENDING_ACCEPTANCE", "TERMINATED", "EXPIRED"], SUSPENDED: ["ACTIVE", "TERMINATED", "EXPIRED"], PENDING_ACCEPTANCE: ["COMPLETED", "ACTIVE"], COMPLETED: ["CLOSED"] },
    },
    workPackage: {
      states: ["DRAFT", "READY", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "SUBMITTED", "REVIEWED", "DONE", "BLOCKED", "CANCELLED"],
      transitions: { DRAFT: ["READY", "CANCELLED"], READY: ["ASSIGNED", "CANCELLED"], ASSIGNED: ["ACCEPTED", "BLOCKED", "CANCELLED"], ACCEPTED: ["IN_PROGRESS", "BLOCKED", "CANCELLED"], IN_PROGRESS: ["SUBMITTED", "BLOCKED", "CANCELLED"], SUBMITTED: ["REVIEWED", "IN_PROGRESS"], REVIEWED: ["DONE", "IN_PROGRESS"], BLOCKED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"] },
    },
    handoff: {
      states: ["PROPOSED", "SENT", "ACCEPTED", "REJECTED", "CLOSED"],
      transitions: { PROPOSED: ["SENT"], SENT: ["ACCEPTED", "REJECTED"], ACCEPTED: ["CLOSED"], REJECTED: ["PROPOSED"] },
    },
    approval: {
      states: ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN", "SUPERSEDED"],
      transitions: { PENDING: ["IN_REVIEW"], IN_REVIEW: ["APPROVED", "REJECTED"], APPROVED: ["WITHDRAWN", "SUPERSEDED"], REJECTED: ["PENDING"], WITHDRAWN: ["PENDING"] },
    },
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso(clock) { return new Date(clock()).toISOString(); }
  function assert(condition, message, code) {
    if (condition) return;
    const error = new Error(message);
    error.code = code || "WORKFLOW_ERROR";
    throw error;
  }

  function createMemoryStorage() {
    const values = new Map();
    return { getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  }

  class WorkflowEngine {
    constructor(options = {}) {
      this.storage = options.storage || createMemoryStorage();
      this.storageKey = options.storageKey || defaultStorageKey;
      this.clock = options.clock || (() => Date.now());
      this.state = this.load();
    }

    load() {
      try {
        const parsed = JSON.parse(this.storage.getItem(this.storageKey) || "null");
        if (parsed && parsed.schemaVersion === SCHEMA_VERSION && parsed.objects && Array.isArray(parsed.events)) return parsed;
      } catch (_) { /* Corrupt demo state is replaced by a clean store. */ }
      return { schemaVersion: SCHEMA_VERSION, objects: {}, events: [] };
    }

    persist() { this.storage.setItem(this.storageKey, JSON.stringify(this.state)); }

    reset() { this.state = { schemaVersion: SCHEMA_VERSION, objects: {}, events: [] }; this.persist(); }

    seed(objects) {
      objects.forEach((object) => { if (!this.state.objects[object.id]) this.create(object, { seed: true }); });
      return this.list();
    }

    create(input, options = {}) {
      const definition = definitions[input.type];
      assert(definition, `未知对象类型：${input.type}`, "UNKNOWN_TYPE");
      assert(input.id, "状态对象必须有唯一 ID", "MISSING_ID");
      assert(!this.state.objects[input.id], `对象 ${input.id} 已存在`, "DUPLICATE_ID");
      const status = input.status || definition.states[0];
      assert(definition.states.includes(status), `${input.type} 不支持状态 ${status}`, "INVALID_STATUS");
      const timestamp = nowIso(this.clock);
      const object = {
        id: input.id, type: input.type, status, revision: Number(input.revision) || 1,
        owner: input.owner || "未分配", tenantId: input.tenantId || "TNT-0018",
        year: input.year || null, quarter: input.quarter || null, scope: input.scope || null,
        dependsOn: Array.isArray(input.dependsOn) ? [...input.dependsOn] : [],
        metadata: clone(input.metadata || {}), createdAt: timestamp, updatedAt: timestamp,
      };
      this.state.objects[object.id] = object;
      this.recordEvent({ objectId: object.id, type: object.type, from: null, to: status, actor: options.seed ? "SYSTEM_SEED" : (input.actor || "SYSTEM"), role: options.seed ? "system" : (input.role || "system"), reason: options.seed ? "初始化演示对象" : (input.reason || "创建对象"), objectRevision: object.revision, metadata: input.eventMetadata || {} });
      this.persist();
      return clone(object);
    }

    get(id) { return this.state.objects[id] ? clone(this.state.objects[id]) : null; }

    list(filter = {}) {
      return Object.values(this.state.objects).filter((object) => Object.entries(filter).every(([key, value]) => value == null || object[key] === value)).map(clone);
    }

    allowedTransitions(id) {
      const object = this.state.objects[id];
      assert(object, `找不到对象 ${id}`, "NOT_FOUND");
      return [...(definitions[object.type].transitions[object.status] || [])];
    }

    canTransition(id, to) {
      try { return this.allowedTransitions(id).includes(to); } catch (_) { return false; }
    }

    transition(id, to, command = {}) {
      const object = this.state.objects[id];
      assert(object, `找不到对象 ${id}`, "NOT_FOUND");
      assert(command.actor, "状态变更必须记录操作者", "MISSING_ACTOR");
      assert(command.reason && String(command.reason).trim(), "状态变更必须说明原因", "MISSING_REASON");
      if (command.expectedRevision != null) assert(Number(command.expectedRevision) === object.revision, `对象已由其他操作更新：期望 Rev ${command.expectedRevision}，当前 Rev ${object.revision}`, "REVISION_CONFLICT");
      assert(this.canTransition(id, to), `不允许 ${object.type} 从 ${object.status} 直接进入 ${to}`, "ILLEGAL_TRANSITION");
      const metadata = clone(command.metadata || {});
      if (to === "ACKNOWLEDGED") assert(metadata.receiptId, "进入“对方已接收”必须提供接收回执 ID", "MISSING_RECEIPT");
      if (object.type === "finding" && to === "CLOSED") {
        assert(metadata.resolutionEvidence, "关闭 Finding 必须关联解决依据", "MISSING_RESOLUTION_EVIDENCE");
        if (object.metadata.source === "VERIFIER") assert(command.role === "verifier", "外部核查 Finding 只能由核查员关闭", "SEPARATION_OF_DUTIES");
      }
      if (to === "LOCKED") assert(metadata.snapshotId, "锁定正式对象必须保存快照 ID", "MISSING_SNAPSHOT");
      const from = object.status;
      object.status = to;
      object.revision += 1;
      object.updatedAt = nowIso(this.clock);
      object.metadata = { ...object.metadata, ...metadata };
      this.recordEvent({ objectId: object.id, type: object.type, from, to, actor: command.actor, role: command.role || "unknown", reason: String(command.reason).trim(), objectRevision: object.revision, correlationId: command.correlationId || null, metadata });
      this.persist();
      return clone(object);
    }

    transitionPath(id, targets, command = {}) {
      return targets.map((to, index) => this.transition(id, to, { ...command, reason: Array.isArray(command.reasons) ? command.reasons[index] : command.reason }));
    }

    invalidateDependents(sourceId, command = {}) {
      const changed = [];
      Object.values(this.state.objects).forEach((object) => {
        if (!object.dependsOn.includes(sourceId) || object.type !== "calculationRun" || object.status !== "CURRENT") return;
        changed.push(this.transition(object.id, "STALE", { actor: command.actor || "SYSTEM", role: command.role || "system", reason: command.reason || `依赖对象 ${sourceId} 已变化`, correlationId: command.correlationId || null, metadata: { invalidatedBy: sourceId } }));
      });
      return changed;
    }

    events(filter = {}) {
      const rows = this.state.events.filter((event) => Object.entries(filter).every(([key, value]) => value == null || event[key] === value));
      return clone(rows.slice().reverse());
    }

    recordEvent(event) {
      this.state.events.push({ id: `EVT-${String(this.state.events.length + 1).padStart(5, "0")}`, at: nowIso(this.clock), ...clone(event) });
    }

    deriveAnnualCycle(context = {}) {
      const objects = this.list({ tenantId: context.tenantId || "TNT-0018", year: String(context.year || "2027") });
      const quarterly = objects.filter((item) => item.type === "quarterlyPackage");
      const artifacts = objects.filter((item) => item.type === "formalArtifact");
      const verification = objects.filter((item) => item.type === "verification");
      const blockers = objects.filter((item) => item.type === "finding" && !["RESOLVED", "CLOSED"].includes(item.status));
      let status = "SCOPING";
      if (quarterly.some((item) => ["PLANNED", "COLLECTING", "READY_FOR_REVIEW"].includes(item.status))) status = "COLLECTING";
      if (artifacts.some((item) => ["GENERATED", "VALIDATED", "INTERNAL_REVIEW", "APPROVED"].includes(item.status))) status = "INTERNAL_REVIEW";
      if (verification.some((item) => ["PLANNED", "IN_VERIFICATION", "REMEDIATION"].includes(item.status))) status = "IN_VERIFICATION";
      if (verification.length && verification.every((item) => ["VERIFIED", "DELIVERED", "ACKNOWLEDGED"].includes(item.status))) status = "VERIFIED";
      const deliveries = [...quarterly, ...artifacts, ...verification];
      if (deliveries.length && deliveries.every((item) => ["ACKNOWLEDGED", "FROZEN"].includes(item.status))) status = "LOCKED";
      return { status, blockers: blockers.map((item) => item.id), counts: { objects: objects.length, quarterly: quarterly.length, artifacts: artifacts.length, verification: verification.length } };
    }
  }

  return { SCHEMA_VERSION, definitions, WorkflowEngine, createMemoryStorage };
});
