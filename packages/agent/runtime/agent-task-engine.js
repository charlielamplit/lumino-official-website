(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoAgentRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RUNTIME_VERSION = "0.1.0";
  const STORE_SCHEMA_VERSION = 1;
  const defaultStorageKey = "lumino-agent-tasks-v1";

  const statuses = new Set([
    "SUBMITTING",
    "PROCESSING",
    "READY",
    "READY_PARTIAL",
    "FAILED",
    "SUBMIT_UNKNOWN",
    "SYNC_FAILED"
  ]);

  const transitions = Object.freeze({
    SUBMITTING: Object.freeze(["PROCESSING", "SUBMIT_UNKNOWN", "FAILED"]),
    PROCESSING: Object.freeze(["READY", "READY_PARTIAL", "FAILED", "SYNC_FAILED"]),
    READY: Object.freeze([]),
    READY_PARTIAL: Object.freeze([]),
    FAILED: Object.freeze([]),
    SUBMIT_UNKNOWN: Object.freeze(["SUBMITTING", "PROCESSING", "FAILED"]),
    SYNC_FAILED: Object.freeze(["SUBMITTING", "PROCESSING", "FAILED"])
  });

  const retryableStatuses = new Set(["SUBMIT_UNKNOWN", "SYNC_FAILED"]);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso(clock) { return new Date(clock()).toISOString(); }
  function assert(condition, message, code = "AGENT_TASK_ERROR", retryableFlag = false) {
    if (condition) return;
    const error = new Error(message);
    error.code = code;
    error.retryable = Boolean(retryableFlag);
    throw error;
  }
  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => (values.has(key) ? values.get(key) : null),
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    };
  }

  function emptyStore() {
    return { schemaVersion: STORE_SCHEMA_VERSION, tasks: {}, serialIndex: {}, events: [] };
  }

  function loadStore(storage, storageKey) {
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw);
      if (parsed.schemaVersion !== STORE_SCHEMA_VERSION) return emptyStore();
      return parsed;
    } catch (_) {
      return emptyStore();
    }
  }

  function AgentTaskEngine(options = {}) {
    this.storage = options.storage || createMemoryStorage();
    this.storageKey = options.storageKey || defaultStorageKey;
    this.clock = options.clock || (() => Date.now());
    this.capabilities = options.capabilities || null;
    if (!this.capabilities && typeof globalThis !== "undefined" && globalThis.LuminoAgentCapabilities) {
      this.capabilities = globalThis.LuminoAgentCapabilities;
    }
    if (!this.capabilities && typeof require === "function") {
      try { this.capabilities = require("./capability-catalog.js"); } catch (_) { this.capabilities = null; }
    }
    this.state = loadStore(this.storage, this.storageKey);
  }

  AgentTaskEngine.prototype._save = function _save() {
    this.storage.setItem(this.storageKey, JSON.stringify(this.state));
  };

  AgentTaskEngine.prototype._record = function _record(type, taskId, detail) {
    this.state.events.push({
      id: `ATE-${String(this.state.events.length + 1).padStart(5, "0")}`,
      type,
      taskId,
      at: nowIso(this.clock),
      detail: detail || null
    });
  };

  AgentTaskEngine.prototype._resolveCapability = function _resolveCapability(businessType) {
    if (this.capabilities && typeof this.capabilities.getCapability === "function") {
      return this.capabilities.getCapability(businessType);
    }
    assert(false, `?? Agent ?? ${businessType}`, "UNKNOWN_BUSINESS_TYPE", false);
  };

  AgentTaskEngine.prototype.get = function get(id) {
    const task = this.state.tasks[id];
    return task ? clone(task) : null;
  };

  AgentTaskEngine.prototype.getBySerialNo = function getBySerialNo(serialNo) {
    const id = this.state.serialIndex[serialNo];
    return id ? this.get(id) : null;
  };

  AgentTaskEngine.prototype.list = function list(filter = {}) {
    return Object.values(this.state.tasks)
      .filter((task) => Object.entries(filter).every(([key, value]) => value == null || task[key] === value))
      .map(clone);
  };

  AgentTaskEngine.prototype.submit = function submit(input = {}, command = {}) {
    assert(input.businessType, "???? businessType", "MISSING_BUSINESS_TYPE");
    assert(input.serialNo && String(input.serialNo).trim(), "???? serialNo", "MISSING_SERIAL_NO");
    const capability = this._resolveCapability(input.businessType);
    assert(capability.completionMode === "proposal_only", "??? proposal_only ????", "INVALID_COMPLETION_MODE");

    const existingId = this.state.serialIndex[input.serialNo];
    if (existingId) {
      const existing = this.state.tasks[existingId];
      assert(existing.businessType === input.businessType, "?? serialNo ???? businessType", "SERIAL_CONFLICT");
      return clone(existing);
    }

    const id = input.id || `ATASK-${String(Object.keys(this.state.tasks).length + 1).padStart(4, "0")}`;
    assert(!this.state.tasks[id], `?? ${id} ???`, "TASK_EXISTS");

    const task = {
      id,
      serialNo: String(input.serialNo).trim(),
      businessType: capability.businessType,
      serviceId: capability.serviceId,
      stageIds: [...capability.stageIds],
      promptId: capability.promptId,
      ruleOrPromptVersion: capability.ruleOrPromptVersion,
      status: "SUBMITTING",
      tenantId: input.tenantId || null,
      caseId: input.caseId || null,
      input: clone(input.input || {}),
      result: null,
      errorCode: null,
      errorMessage: null,
      retryable: false,
      attempt: 1,
      createdAt: nowIso(this.clock),
      updatedAt: nowIso(this.clock),
      createdBy: command.actor || null
    };
    this.state.tasks[id] = task;
    this.state.serialIndex[task.serialNo] = id;
    this._record("TASK_SUBMITTED", id, { businessType: task.businessType, serialNo: task.serialNo });
    this._save();
    return clone(task);
  };

  AgentTaskEngine.prototype._transition = function _transition(id, to, patch = {}) {
    const task = this.state.tasks[id];
    assert(task, `?? ${id} ???`, "TASK_NOT_FOUND");
    const allowed = transitions[task.status] || [];
    assert(allowed.includes(to), `??? ${task.status} ?? ${to}`, "ILLEGAL_TASK_TRANSITION");
    assert(statuses.has(to), `???? ${to}`, "INVALID_STATUS");
    Object.assign(task, patch, { status: to, updatedAt: nowIso(this.clock) });
    this._record("TASK_TRANSITION", id, { to, errorCode: task.errorCode || null });
    this._save();
    return clone(task);
  };

  AgentTaskEngine.prototype.markProcessing = function markProcessing(id) {
    return this._transition(id, "PROCESSING", { errorCode: null, errorMessage: null, retryable: false });
  };

  AgentTaskEngine.prototype.markSubmitUnknown = function markSubmitUnknown(id, message) {
    return this._transition(id, "SUBMIT_UNKNOWN", {
      errorCode: "SUBMIT_UNKNOWN",
      errorMessage: message || "?????????????",
      retryable: true
    });
  };

  AgentTaskEngine.prototype.fail = function fail(id, errorCode, message, options = {}) {
    const isRetryable = options.retryable != null ? Boolean(options.retryable) : retryableStatuses.has(errorCode);
    const to = errorCode === "SYNC_FAILED" ? "SYNC_FAILED" : "FAILED";
    return this._transition(id, to, {
      errorCode: errorCode || "FAILED",
      errorMessage: message || "????",
      retryable: isRetryable,
      result: null
    });
  };

  AgentTaskEngine.prototype.complete = function complete(id, result = {}) {
    const task = this.state.tasks[id];
    assert(task, `?? ${id} ???`, "TASK_NOT_FOUND");
    assert(["PROCESSING", "SUBMITTING"].includes(task.status), `?? ${task.status} ????`, "ILLEGAL_TASK_TRANSITION");
    if (task.status === "SUBMITTING") this.markProcessing(id);

    const proposals = Array.isArray(result.proposals) ? result.proposals : [];
    assert(proposals.length > 0 || result.allowEmpty, "???????? proposals???? allowEmpty", "MISSING_PROPOSALS");

    const partial = Boolean(result.partial);
    const payload = {
      proposals: clone(proposals),
      summary: result.summary || null,
      warnings: clone(result.warnings || []),
      appliedAs: "proposal_only",
      completedAt: nowIso(this.clock)
    };
    return this._transition(id, partial ? "READY_PARTIAL" : "READY", {
      result: payload,
      errorCode: null,
      errorMessage: null,
      retryable: false
    });
  };

  AgentTaskEngine.prototype.retry = function retry(id, command = {}) {
    const task = this.state.tasks[id];
    assert(task, `?? ${id} ???`, "TASK_NOT_FOUND");
    assert(retryableStatuses.has(task.status) || task.retryable, `?? ${task.status} ????`, "NOT_RETRYABLE", false);
    task.attempt += 1;
    task.errorCode = null;
    task.errorMessage = null;
    task.retryable = false;
    task.result = null;
    const next = this._transition(id, "SUBMITTING", {});
    this._record("TASK_RETRY", id, { attempt: task.attempt, actor: command.actor || null });
    this._save();
    return next;
  };

  AgentTaskEngine.prototype.simulateSuccess = function simulateSuccess(id, result = {}) {
    const task = this.get(id);
    assert(task, `?? ${id} ???`, "TASK_NOT_FOUND");
    if (task.status === "SUBMITTING") this.markProcessing(id);
    if (["READY", "READY_PARTIAL"].includes(this.get(id).status)) return this.get(id);
    return this.complete(id, result);
  };

  return {
    RUNTIME_VERSION,
    AgentTaskEngine,
    createMemoryStorage,
    statuses: [...statuses],
    transitions: clone(transitions)
  };
});
