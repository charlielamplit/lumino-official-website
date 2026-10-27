(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoAssets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FRAMEWORK_VERSION = "0.2.0";
  const STORE_SCHEMA_VERSION = 2;
  const defaultStorageKey = "lumino-enterprise-data-assets-v1";
  const assetTypes = new Set([
    "organization", "organizationUnit", "facility", "product", "productVariant", "process", "productionLine", "counterparty",
    "evidence", "measurement", "energyConsumption", "materialFlow", "productionOutput", "transportActivity", "wasteActivity",
    "shipmentEvent", "supplierDeclaration", "certificate", "referenceData", "dataset",
  ]);
  const statuses = new Set(["DRAFT", "PROPOSED", "NEEDS_CONFIRMATION", "CONFIRMED", "CONFLICTED", "SUPERSEDED", "ARCHIVED"]);
  const bindingStatuses = new Set(["PROPOSED", "PENDING_CONFIRMATION", "CONFIRMED", "REJECTED", "SUPERSEDED"]);
  const snapshotStatuses = new Set(["OPEN", "CURRENT", "LOCKED", "STALE", "SUPERSEDED"]);
  const runStatuses = new Set(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CURRENT", "STALE", "SUPERSEDED"]);
  const writeRoles = new Set(["customer_admin", "customer_owner", "customer_contrib", "expert", "system", "agent"]);
  const confirmRoles = new Set(["customer_admin", "customer_owner", "system"]);
  const bindRoles = new Set(["customer_admin", "customer_owner", "expert", "system", "agent"]);
  const bindingConfirmRoles = new Set(["customer_admin", "customer_owner", "customer_approver", "expert", "reviewer", "system"]);
  const serviceObjectRoles = new Set(["customer_admin", "customer_owner", "expert", "reviewer", "system"]);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso(clock) { return new Date(clock()).toISOString(); }
  function assert(condition, message, code = "ASSET_ERROR") {
    if (condition) return;
    const error = new Error(message);
    error.code = code;
    throw error;
  }
  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    };
  }
  function eventId(prefix, count) { return `${prefix}-${String(count + 1).padStart(5, "0")}`; }
  function currentVersion(versions = []) { return versions.length ? versions[versions.length - 1] : null; }
  function requireCommand(command, roles, action) {
    assert(command?.actor, `${action}必须记录操作者`, "MISSING_ACTOR");
    assert(command?.reason && String(command.reason).trim(), `${action}必须说明原因`, "MISSING_REASON");
    assert(roles.has(command.role), `角色 ${command.role || "unknown"} 无权${action}`, "FORBIDDEN");
  }
  function emptyStore() {
    return {
      schemaVersion: STORE_SCHEMA_VERSION,
      frameworkVersion: FRAMEWORK_VERSION,
      assets: {},
      bindings: {},
      lineage: [],
      transformations: {},
      snapshots: {},
      calculationRuns: {},
      events: [],
    };
  }
  function migrateStore(parsed) {
    if (!parsed || !parsed.assets || !parsed.bindings || !Array.isArray(parsed.events)) return null;
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== STORE_SCHEMA_VERSION) return null;
    return {
      schemaVersion: STORE_SCHEMA_VERSION,
      frameworkVersion: FRAMEWORK_VERSION,
      assets: parsed.assets || {},
      bindings: parsed.bindings || {},
      lineage: Array.isArray(parsed.lineage) ? parsed.lineage : [],
      transformations: parsed.transformations || {},
      snapshots: parsed.snapshots || {},
      calculationRuns: parsed.calculationRuns || {},
      events: parsed.events || [],
    };
  }

  class AssetRegistry {
    constructor(options = {}) {
      this.storage = options.storage || createMemoryStorage();
      this.storageKey = options.storageKey || defaultStorageKey;
      this.clock = options.clock || (() => Date.now());
      this.state = this.load();
    }

    load() {
      try {
        const parsed = JSON.parse(this.storage.getItem(this.storageKey) || "null");
        const migrated = migrateStore(parsed);
        if (migrated) return migrated;
      } catch (_) { /* Invalid prototype state is replaced by a clean store. */ }
      return emptyStore();
    }

    persist() { this.storage.setItem(this.storageKey, JSON.stringify(this.state)); }
    reset() {
      this.state = emptyStore();
      this.persist();
    }

    seed({ assets = [], bindings = [], lineage = [], transformations = [], snapshots = [], calculationRuns = [] } = {}) {
      assets.forEach((asset) => {
        if (!this.state.assets[asset.id]) this.register(asset, { actor: "SYSTEM_SEED", role: "system", reason: "初始化企业数据资产" });
      });
      bindings.forEach((binding) => {
        if (!this.state.bindings[binding.id]) this.bind(binding, { actor: "SYSTEM_SEED", role: "system", reason: "初始化服务使用绑定" });
      });
      lineage.forEach((edge) => {
        if (!this.state.lineage.some((item) => item.id === edge.id)) this.linkLineage(edge, { actor: "SYSTEM_SEED", role: "system", reason: "初始化数据血缘" });
      });
      transformations.forEach((item) => {
        if (!this.state.transformations[item.id]) this.createTransformation(item, { actor: "SYSTEM_SEED", role: "system", reason: "初始化转换规则" });
      });
      snapshots.forEach((item) => {
        if (!this.state.snapshots[item.id]) this.createSnapshot(item, { actor: "SYSTEM_SEED", role: "system", reason: "初始化计算快照" });
      });
      calculationRuns.forEach((item) => {
        if (!this.state.calculationRuns[item.id]) this.createCalculationRun(item, { actor: "SYSTEM_SEED", role: "system", reason: "初始化计算运行" });
      });
      return this.catalog({});
    }

    validateAsset(input) {
      assert(input?.id, "数据资产必须有唯一 ID", "MISSING_ID");
      assert(assetTypes.has(input.type), `不支持的数据资产类型：${input.type}`, "UNKNOWN_TYPE");
      assert(input.tenantId, "数据资产必须属于租户", "MISSING_TENANT");
      assert(input.ownerOrganizationId, "数据资产必须记录数据所有方", "MISSING_OWNER");
      assert(statuses.has(input.status || "DRAFT"), `不支持的数据资产状态：${input.status}`, "INVALID_STATUS");
      assert(input.name, "数据资产必须有业务名称", "MISSING_NAME");
    }

    register(input, command) {
      requireCommand(command, writeRoles, "登记数据资产");
      this.validateAsset(input);
      assert(!this.state.assets[input.id], `数据资产 ${input.id} 已存在`, "DUPLICATE_ID");
      const status = input.status || "DRAFT";
      if (command.role === "agent") {
        assert(status === "PROPOSED" || status === "NEEDS_CONFIRMATION", "Agent 只能登记待确认提议", "AGENT_CANNOT_CONFIRM");
        assert((input.provenance?.sourceAssetIds || []).length > 0, "Agent 提议必须引用来源资产", "MISSING_PROVENANCE");
      }
      const timestamp = nowIso(this.clock);
      const version = {
        id: input.id,
        versionId: `${input.id}@1`,
        revision: 1,
        parentVersionId: null,
        frameworkVersion: FRAMEWORK_VERSION,
        schemaVersion: input.schemaVersion || "1.0.0",
        type: input.type,
        status,
        tenantId: input.tenantId,
        ownerOrganizationId: input.ownerOrganizationId,
        name: input.name,
        description: input.description || "",
        subjectRefs: clone(input.subjectRefs || {}),
        temporal: clone(input.temporal || {}),
        payload: clone(input.payload || {}),
        provenance: clone(input.provenance || { sourceType: "manual", sourceAssetIds: [] }),
        quality: clone(input.quality || {}),
        access: clone(input.access || { confidentiality: "internal", visibility: "enterprise", allowedRoles: [] }),
        steward: clone(input.steward || {}),
        tags: [...(input.tags || [])],
        createdAt: timestamp,
        createdBy: command.actor,
        createdByRole: command.role,
        reason: String(command.reason).trim(),
      };
      this.state.assets[input.id] = [version];
      this.recordEvent("ASSET_REGISTERED", input.id, command, { versionId: version.versionId, status });
      this.persist();
      return clone(version);
    }

    get(id, revision = null) {
      const versions = this.state.assets[id] || [];
      const version = revision == null ? currentVersion(versions) : versions.find((item) => item.revision === Number(revision));
      return version ? clone(version) : null;
    }

    history(id) { return clone(this.state.assets[id] || []); }

    revise(id, patch, command) {
      requireCommand(command, writeRoles, "创建数据资产修订版");
      const versions = this.state.assets[id];
      assert(versions?.length, `找不到数据资产 ${id}`, "NOT_FOUND");
      const previous = currentVersion(versions);
      if (command.expectedRevision != null) assert(previous.revision === Number(command.expectedRevision), `数据资产已更新：期望 Rev ${command.expectedRevision}，当前 Rev ${previous.revision}`, "REVISION_CONFLICT");
      const nextStatus = patch.status || previous.status;
      assert(statuses.has(nextStatus), `不支持的数据资产状态：${nextStatus}`, "INVALID_STATUS");
      if (command.role === "agent") assert(["PROPOSED", "NEEDS_CONFIRMATION"].includes(nextStatus), "Agent 不能把数据资产写为正式事实", "AGENT_CANNOT_CONFIRM");
      const revision = previous.revision + 1;
      const next = {
        ...clone(previous),
        ...clone(patch),
        subjectRefs: { ...previous.subjectRefs, ...(patch.subjectRefs || {}) },
        temporal: { ...previous.temporal, ...(patch.temporal || {}) },
        payload: { ...previous.payload, ...(patch.payload || {}) },
        provenance: { ...previous.provenance, ...(patch.provenance || {}) },
        quality: { ...previous.quality, ...(patch.quality || {}) },
        access: { ...previous.access, ...(patch.access || {}) },
        steward: { ...previous.steward, ...(patch.steward || {}) },
        versionId: `${id}@${revision}`,
        revision,
        parentVersionId: previous.versionId,
        status: nextStatus,
        createdAt: nowIso(this.clock),
        createdBy: command.actor,
        createdByRole: command.role,
        reason: String(command.reason).trim(),
      };
      versions.push(next);
      this.recordEvent("ASSET_REVISED", id, command, { fromVersionId: previous.versionId, versionId: next.versionId, status: next.status });
      this.notifyBindingsOfAssetRevision(id, previous.versionId, next.versionId, command);
      this.invalidateDependents(previous.versionId, command, { assetId: id, newVersionId: next.versionId });
      this.persist();
      return clone(next);
    }

    confirm(id, command) {
      requireCommand(command, confirmRoles, "确认企业事实");
      const asset = this.get(id);
      assert(asset, `找不到数据资产 ${id}`, "NOT_FOUND");
      assert(["DRAFT", "PROPOSED", "NEEDS_CONFIRMATION", "CONFLICTED"].includes(asset.status), `状态 ${asset.status} 不能直接确认`, "ILLEGAL_STATUS");
      return this.revise(id, { status: "CONFIRMED", provenance: { confirmedBy: command.actor, confirmedAt: nowIso(this.clock), confirmationBasis: command.basis || command.reason } }, command);
    }

    bind(input, command) {
      requireCommand(command, bindRoles, "创建服务使用绑定");
      assert(input?.id, "服务绑定必须有唯一 ID", "MISSING_ID");
      assert(!this.state.bindings[input.id], `服务绑定 ${input.id} 已存在`, "DUPLICATE_ID");
      assert(input.serviceId && input.caseId && input.assetId, "服务绑定必须包含 serviceId、caseId 和 assetId", "MISSING_BINDING_SCOPE");
      const asset = this.get(input.assetId, input.assetRevision);
      assert(asset, `找不到绑定的数据资产 ${input.assetId}`, "NOT_FOUND");
      const status = input.status || (command.role === "agent" ? "PROPOSED" : "PENDING_CONFIRMATION");
      assert(bindingStatuses.has(status), `不支持的服务绑定状态：${status}`, "INVALID_STATUS");
      if (command.role === "agent") assert(status === "PROPOSED", "Agent 只能提出服务复用建议", "AGENT_CANNOT_CONFIRM");
      if (status === "CONFIRMED") assert(command.role === "system", "服务绑定必须经独立确认，不能在创建时直接生效", "BINDING_CONFIRMATION_REQUIRED");
      const binding = {
        id: input.id,
        tenantId: asset.tenantId,
        serviceId: input.serviceId,
        caseId: input.caseId,
        assetId: input.assetId,
        assetRevision: asset.revision,
        assetVersionId: asset.versionId,
        usagePurpose: input.usagePurpose || "",
        scopeId: input.scopeId || null,
        included: input.included !== false,
        inclusionReason: input.inclusionReason || "",
        transformationId: input.transformationId || null,
        allocationRuleId: input.allocationRuleId || null,
        status,
        revision: 1,
        snapshotId: input.snapshotId || null,
        supersededBy: null,
        createdAt: nowIso(this.clock),
        createdBy: command.actor,
        createdByRole: command.role,
      };
      this.state.bindings[input.id] = binding;
      this.recordEvent("SERVICE_BINDING_CREATED", input.assetId, command, { bindingId: binding.id, serviceId: binding.serviceId, status });
      this.persist();
      return clone(binding);
    }

    confirmBinding(id, command) {
      requireCommand(command, bindingConfirmRoles, "确认服务使用绑定");
      const binding = this.state.bindings[id];
      assert(binding, `找不到服务绑定 ${id}`, "NOT_FOUND");
      assert(["PROPOSED", "PENDING_CONFIRMATION"].includes(binding.status), `服务绑定 ${id} 已经处理`, "ILLEGAL_STATUS");
      binding.status = "CONFIRMED";
      binding.revision += 1;
      binding.confirmedBy = command.actor;
      binding.confirmedAt = nowIso(this.clock);
      binding.confirmationBasis = command.basis || command.reason;
      this.recordEvent("SERVICE_BINDING_CONFIRMED", binding.assetId, command, { bindingId: id, serviceId: binding.serviceId, assetVersionId: binding.assetVersionId });
      this.persist();
      return clone(binding);
    }

    rejectBinding(id, command) {
      requireCommand(command, bindingConfirmRoles, "拒绝服务使用绑定");
      const binding = this.state.bindings[id];
      assert(binding, `找不到服务绑定 ${id}`, "NOT_FOUND");
      assert(["PROPOSED", "PENDING_CONFIRMATION"].includes(binding.status), `服务绑定 ${id} 已经处理`, "ILLEGAL_STATUS");
      binding.status = "REJECTED";
      binding.revision += 1;
      binding.rejectedBy = command.actor;
      binding.rejectedAt = nowIso(this.clock);
      binding.rejectionReason = command.basis || command.reason;
      this.recordEvent("SERVICE_BINDING_REJECTED", binding.assetId, command, { bindingId: id, serviceId: binding.serviceId });
      this.persist();
      return clone(binding);
    }

    supersedeBinding(oldBindingId, input, command) {
      requireCommand(command, bindRoles, "创建替代服务绑定");
      const previous = this.state.bindings[oldBindingId];
      assert(previous, `找不到服务绑定 ${oldBindingId}`, "NOT_FOUND");
      assert(["CONFIRMED", "PENDING_CONFIRMATION", "PROPOSED"].includes(previous.status), `服务绑定 ${oldBindingId} 不能被替代`, "ILLEGAL_STATUS");
      const nextInput = {
        ...input,
        id: input.id,
        serviceId: input.serviceId || previous.serviceId,
        caseId: input.caseId || previous.caseId,
        assetId: input.assetId || previous.assetId,
        usagePurpose: input.usagePurpose || previous.usagePurpose,
        scopeId: input.scopeId !== undefined ? input.scopeId : previous.scopeId,
        included: input.included !== undefined ? input.included : previous.included,
        inclusionReason: input.inclusionReason || previous.inclusionReason,
        transformationId: input.transformationId !== undefined ? input.transformationId : previous.transformationId,
        allocationRuleId: input.allocationRuleId !== undefined ? input.allocationRuleId : previous.allocationRuleId,
        status: input.status || "PENDING_CONFIRMATION",
      };
      const created = this.bind(nextInput, command);
      previous.status = "SUPERSEDED";
      previous.revision += 1;
      previous.supersededBy = created.id;
      previous.supersededAt = nowIso(this.clock);
      this.recordEvent("SERVICE_BINDING_SUPERSEDED", previous.assetId, command, {
        bindingId: oldBindingId,
        supersededBy: created.id,
        previousAssetVersionId: previous.assetVersionId,
        nextAssetVersionId: created.assetVersionId,
      });
      this.persist();
      return { previous: clone(previous), next: created };
    }

    createTransformation(input, command) {
      requireCommand(command, serviceObjectRoles, "登记转换规则");
      assert(input?.id, "转换规则必须有唯一 ID", "MISSING_ID");
      assert(!this.state.transformations[input.id], `转换规则 ${input.id} 已存在`, "DUPLICATE_ID");
      assert(input.serviceId && input.ruleType, "转换规则必须包含 serviceId 和 ruleType", "MISSING_TRANSFORMATION");
      const transformation = {
        id: input.id,
        tenantId: input.tenantId || null,
        serviceId: input.serviceId,
        caseId: input.caseId || null,
        ruleType: input.ruleType,
        ruleVersion: input.ruleVersion || "1.0.0",
        name: input.name || input.id,
        description: input.description || "",
        parameters: clone(input.parameters || {}),
        inputAssetVersionIds: [...(input.inputAssetVersionIds || [])],
        status: input.status || "ACTIVE",
        createdAt: nowIso(this.clock),
        createdBy: command.actor,
        createdByRole: command.role,
      };
      this.state.transformations[input.id] = transformation;
      this.recordEvent("TRANSFORMATION_CREATED", null, command, { transformationId: transformation.id, serviceId: transformation.serviceId });
      this.persist();
      return clone(transformation);
    }

    createSnapshot(input, command) {
      requireCommand(command, serviceObjectRoles, "创建计算快照");
      assert(input?.id, "计算快照必须有唯一 ID", "MISSING_ID");
      assert(!this.state.snapshots[input.id], `计算快照 ${input.id} 已存在`, "DUPLICATE_ID");
      assert(input.serviceId && input.caseId, "计算快照必须包含 serviceId 和 caseId", "MISSING_SNAPSHOT_SCOPE");
      const bindingIds = [...(input.bindingIds || [])];
      const assetVersionIds = new Set(input.inputAssetVersionIds || []);
      bindingIds.forEach((bindingId) => {
        const binding = this.state.bindings[bindingId];
        assert(binding, `找不到绑定 ${bindingId}`, "NOT_FOUND");
        assetVersionIds.add(binding.assetVersionId);
      });
      assert(assetVersionIds.size > 0, "计算快照必须锁定至少一个资产版本", "MISSING_INPUT_VERSIONS");
      const status = input.status || "CURRENT";
      assert(snapshotStatuses.has(status), `不支持的快照状态：${status}`, "INVALID_STATUS");
      if (status === "LOCKED") assert(command.role === "system" || command.role === "reviewer" || command.role === "expert" || command.role === "customer_owner" || command.role === "customer_admin", "无权锁定快照", "FORBIDDEN");
      const snapshot = {
        id: input.id,
        tenantId: input.tenantId || null,
        serviceId: input.serviceId,
        caseId: input.caseId,
        bindingIds,
        inputAssetVersionIds: [...assetVersionIds],
        transformationIds: [...(input.transformationIds || [])],
        status,
        locked: status === "LOCKED",
        lockedAt: status === "LOCKED" ? nowIso(this.clock) : null,
        lockedBy: status === "LOCKED" ? command.actor : null,
        impactAlerts: [],
        createdAt: nowIso(this.clock),
        createdBy: command.actor,
        createdByRole: command.role,
        reason: String(command.reason).trim(),
      };
      this.state.snapshots[input.id] = snapshot;
      bindingIds.forEach((bindingId) => {
        if (this.state.bindings[bindingId]) this.state.bindings[bindingId].snapshotId = snapshot.id;
      });
      this.recordEvent("SNAPSHOT_CREATED", null, command, { snapshotId: snapshot.id, status: snapshot.status, inputAssetVersionIds: snapshot.inputAssetVersionIds });
      this.persist();
      return clone(snapshot);
    }

    lockSnapshot(id, command) {
      requireCommand(command, serviceObjectRoles, "锁定计算快照");
      const snapshot = this.state.snapshots[id];
      assert(snapshot, `找不到计算快照 ${id}`, "NOT_FOUND");
      assert(["OPEN", "CURRENT"].includes(snapshot.status), `快照 ${id} 状态 ${snapshot.status} 不能锁定`, "ILLEGAL_STATUS");
      snapshot.status = "LOCKED";
      snapshot.locked = true;
      snapshot.lockedAt = nowIso(this.clock);
      snapshot.lockedBy = command.actor;
      this.recordEvent("SNAPSHOT_LOCKED", null, command, { snapshotId: id, inputAssetVersionIds: snapshot.inputAssetVersionIds });
      this.persist();
      return clone(snapshot);
    }

    createCalculationRun(input, command) {
      requireCommand(command, serviceObjectRoles, "创建计算运行");
      assert(input?.id, "计算运行必须有唯一 ID", "MISSING_ID");
      assert(!this.state.calculationRuns[input.id], `计算运行 ${input.id} 已存在`, "DUPLICATE_ID");
      assert(input.serviceId && input.caseId && input.snapshotId, "计算运行必须包含 serviceId、caseId 和 snapshotId", "MISSING_RUN_SCOPE");
      const snapshot = this.state.snapshots[input.snapshotId];
      assert(snapshot, `找不到计算快照 ${input.snapshotId}`, "NOT_FOUND");
      const status = input.status || "QUEUED";
      assert(runStatuses.has(status), `不支持的计算运行状态：${status}`, "INVALID_STATUS");
      const run = {
        id: input.id,
        tenantId: input.tenantId || snapshot.tenantId || null,
        serviceId: input.serviceId,
        caseId: input.caseId,
        snapshotId: input.snapshotId,
        inputAssetVersionIds: [...(input.inputAssetVersionIds || snapshot.inputAssetVersionIds)],
        ruleVersion: input.ruleVersion || null,
        status,
        resultSummary: clone(input.resultSummary || {}),
        workflowObjectId: input.workflowObjectId || null,
        createdAt: nowIso(this.clock),
        createdBy: command.actor,
        createdByRole: command.role,
        reason: String(command.reason).trim(),
      };
      this.state.calculationRuns[input.id] = run;
      this.recordEvent("CALCULATION_RUN_CREATED", null, command, { runId: run.id, snapshotId: run.snapshotId, status: run.status });
      this.persist();
      return clone(run);
    }

    markCurrent(runId, command) {
      requireCommand(command, serviceObjectRoles, "标记当前计算运行");
      const run = this.state.calculationRuns[runId];
      assert(run, `找不到计算运行 ${runId}`, "NOT_FOUND");
      assert(["SUCCEEDED", "QUEUED", "RUNNING", "CURRENT"].includes(run.status), `计算运行 ${runId} 状态不能标记为当前`, "ILLEGAL_STATUS");
      Object.values(this.state.calculationRuns).forEach((item) => {
        if (item.caseId === run.caseId && item.serviceId === run.serviceId && item.id !== runId && item.status === "CURRENT") {
          item.status = "SUPERSEDED";
        }
      });
      run.status = "CURRENT";
      this.recordEvent("CALCULATION_RUN_CURRENT", null, command, { runId, snapshotId: run.snapshotId });
      this.persist();
      return clone(run);
    }

    previewImpact(assetId, revision = null) {
      const asset = this.get(assetId, revision);
      if (!asset) return { asset: null, bindings: [], staleSnapshots: [], lockedSnapshots: [], staleRuns: [] };
      const versionId = asset.versionId;
      const bindings = Object.values(this.state.bindings)
        .filter((item) => item.assetId === assetId && item.assetVersionId === versionId && !["SUPERSEDED", "REJECTED"].includes(item.status))
        .map(clone);
      const staleSnapshots = [];
      const lockedSnapshots = [];
      Object.values(this.state.snapshots).forEach((snapshot) => {
        if (!snapshot.inputAssetVersionIds.includes(versionId)) return;
        if (snapshot.locked || snapshot.status === "LOCKED") lockedSnapshots.push(clone(snapshot));
        else if (!["STALE", "SUPERSEDED"].includes(snapshot.status)) staleSnapshots.push(clone(snapshot));
      });
      const staleRuns = Object.values(this.state.calculationRuns)
        .filter((run) => run.inputAssetVersionIds.includes(versionId) && ["CURRENT", "SUCCEEDED"].includes(run.status))
        .filter((run) => {
          const snapshot = this.state.snapshots[run.snapshotId];
          return !(snapshot?.locked || snapshot?.status === "LOCKED");
        })
        .map(clone);
      return { asset: clone(asset), bindings, staleSnapshots, lockedSnapshots, staleRuns };
    }

    notifyBindingsOfAssetRevision(assetId, fromVersionId, toVersionId, command) {
      Object.values(this.state.bindings).forEach((binding) => {
        if (binding.assetId !== assetId || binding.assetVersionId !== fromVersionId) return;
        if (["SUPERSEDED", "REJECTED"].includes(binding.status)) return;
        this.recordEvent("BINDING_ASSET_VERSION_OUTDATED", assetId, command, {
          bindingId: binding.id,
          serviceId: binding.serviceId,
          fromVersionId,
          toVersionId,
          bindingStatus: binding.status,
          autoSwitched: false,
        });
      });
    }

    invalidateDependents(assetVersionId, command, meta = {}) {
      const staleSnapshots = [];
      const staleRuns = [];
      Object.values(this.state.snapshots).forEach((snapshot) => {
        if (!snapshot.inputAssetVersionIds.includes(assetVersionId)) return;
        if (snapshot.locked || snapshot.status === "LOCKED") {
          snapshot.impactAlerts = snapshot.impactAlerts || [];
          snapshot.impactAlerts.push({
            at: nowIso(this.clock),
            assetVersionId,
            newVersionId: meta.newVersionId || null,
            message: `输入资产版本 ${assetVersionId} 已修订，锁定快照保持可重现`,
          });
          this.recordEvent("SNAPSHOT_IMPACT_ALERT", meta.assetId || null, command, {
            snapshotId: snapshot.id,
            assetVersionId,
            newVersionId: meta.newVersionId || null,
            locked: true,
          });
          return;
        }
        if (["STALE", "SUPERSEDED"].includes(snapshot.status)) return;
        snapshot.status = "STALE";
        staleSnapshots.push(snapshot.id);
        this.recordEvent("SNAPSHOT_STALE", meta.assetId || null, command, {
          snapshotId: snapshot.id,
          assetVersionId,
          newVersionId: meta.newVersionId || null,
        });
      });
      Object.values(this.state.calculationRuns).forEach((run) => {
        if (!run.inputAssetVersionIds.includes(assetVersionId)) return;
        const snapshot = this.state.snapshots[run.snapshotId];
        if (snapshot?.locked || snapshot?.status === "LOCKED") {
          this.recordEvent("CALCULATION_RUN_IMPACT_ALERT", meta.assetId || null, command, {
            runId: run.id,
            snapshotId: run.snapshotId,
            assetVersionId,
            lockedSnapshot: true,
          });
          return;
        }
        if (run.status !== "CURRENT" && run.status !== "SUCCEEDED") return;
        run.status = "STALE";
        staleRuns.push(run.id);
        this.recordEvent("CALCULATION_RUN_STALE", meta.assetId || null, command, {
          runId: run.id,
          snapshotId: run.snapshotId,
          assetVersionId,
          newVersionId: meta.newVersionId || null,
        });
      });
      return { staleSnapshots, staleRuns };
    }

    linkLineage(input, command) {
      requireCommand(command, writeRoles, "记录数据血缘");
      assert(input?.id && input.fromAssetId && input.toAssetId && input.activityType, "血缘必须包含 ID、来源、结果和活动类型", "INVALID_LINEAGE");
      assert(this.get(input.fromAssetId) && this.get(input.toAssetId), "血缘两端的数据资产必须存在", "NOT_FOUND");
      const edge = {
        id: input.id,
        tenantId: this.get(input.toAssetId).tenantId,
        fromAssetId: input.fromAssetId,
        fromVersionId: input.fromVersionId || this.get(input.fromAssetId).versionId,
        toAssetId: input.toAssetId,
        toVersionId: input.toVersionId || this.get(input.toAssetId).versionId,
        activityType: input.activityType,
        agentType: input.agentType || command.role,
        agentId: input.agentId || command.actor,
        ruleVersion: input.ruleVersion || null,
        createdAt: nowIso(this.clock),
      };
      this.state.lineage.push(edge);
      this.recordEvent("LINEAGE_LINKED", input.toAssetId, command, { lineageId: edge.id, fromAssetId: edge.fromAssetId, activityType: edge.activityType });
      this.persist();
      return clone(edge);
    }

    canView(asset, context = {}) {
      if (!asset || (context.tenantId && asset.tenantId !== context.tenantId)) return false;
      const role = context.role || "customer_owner";
      if (["customer_admin", "customer_owner", "platform_admin", "system"].includes(role)) return true;
      if (asset.access?.allowedRoles?.includes(role)) return true;
      if (role === "customer_contrib") return asset.access?.confidentiality === "general" || asset.steward?.assignedRole === role;
      if (role === "customer_approver") return asset.status === "CONFIRMED" || this.bindingsForAsset(asset.id).some((item) => item.status === "PENDING_CONFIRMATION");
      if (["expert", "reviewer"].includes(role)) return this.bindingsForAsset(asset.id).some((item) => !context.serviceId || item.serviceId === context.serviceId);
      if (role === "ops") return asset.access?.metadataVisible === true;
      return false;
    }

    catalog(filter = {}) {
      return Object.values(this.state.assets)
        .map((versions) => currentVersion(versions))
        .filter((asset) => asset && (!filter.type || asset.type === filter.type) && (!filter.status || asset.status === filter.status) && this.canView(asset, filter))
        .map(clone);
    }

    bindingsForAsset(assetId) { return Object.values(this.state.bindings).filter((item) => item.assetId === assetId).map(clone); }
    bindings(filter = {}) { return Object.values(this.state.bindings).filter((item) => Object.entries(filter).every(([key, value]) => value == null || item[key] === value)).map(clone); }
    lineage(assetId) { return this.state.lineage.filter((item) => item.fromAssetId === assetId || item.toAssetId === assetId).map(clone); }
    transformations(filter = {}) { return Object.values(this.state.transformations).filter((item) => Object.entries(filter).every(([key, value]) => value == null || item[key] === value)).map(clone); }
    snapshots(filter = {}) { return Object.values(this.state.snapshots).filter((item) => Object.entries(filter).every(([key, value]) => value == null || item[key] === value)).map(clone); }
    calculationRuns(filter = {}) { return Object.values(this.state.calculationRuns).filter((item) => Object.entries(filter).every(([key, value]) => value == null || item[key] === value)).map(clone); }
    getSnapshot(id) { return this.state.snapshots[id] ? clone(this.state.snapshots[id]) : null; }
    getCalculationRun(id) { return this.state.calculationRuns[id] ? clone(this.state.calculationRuns[id]) : null; }
    getTransformation(id) { return this.state.transformations[id] ? clone(this.state.transformations[id]) : null; }
    events(filter = {}) { return this.state.events.filter((item) => Object.entries(filter).every(([key, value]) => value == null || item[key] === value)).map(clone); }

    recordEvent(type, assetId, command, metadata = {}) {
      this.state.events.unshift({
        id: eventId("DAE", this.state.events.length),
        type,
        assetId,
        actor: command.actor,
        role: command.role,
        reason: String(command.reason || ""),
        at: nowIso(this.clock),
        metadata: clone(metadata),
      });
    }
  }

  return {
    FRAMEWORK_VERSION,
    STORE_SCHEMA_VERSION,
    assetTypes,
    statuses,
    bindingStatuses,
    snapshotStatuses,
    runStatuses,
    AssetRegistry,
    createMemoryStorage,
  };
});
