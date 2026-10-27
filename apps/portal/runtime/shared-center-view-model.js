(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoSharedCenterViewModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CUSTOMER_ROLES = new Set(["customer_admin", "customer_owner", "customer_contrib", "customer_approver"]);
  const DELIVERY_TYPES = new Set(["quarterlyPackage", "formalArtifact", "verification"]);
  const CLOSED_TASK_STATUSES = new Set(["RESOLVED", "CLOSED", "DONE", "CANCELLED", "REJECTED", "WITHDRAWN", "SUPERSEDED"]);

  const ARTIFACT_LABELS = Object.freeze({
    OPERATOR_EMISSIONS_REPORT: "设施年度排放报告",
    IMPORTER_DECLARATION_SUPPORT: "进口商申报支持包",
    PCF_REPORT: "产品碳足迹报告",
  });

  const STATUS_LABELS = Object.freeze({
    NOT_STARTED: "未开始", PLANNED: "已计划", COLLECTING: "采集中", READY_FOR_REVIEW: "待复核",
    DRAFT: "草稿", GENERATED: "已生成", VALIDATED: "已校验", INTERNAL_REVIEW: "内部复核",
    APPROVED: "已批准", PACKAGE_READY: "数据包就绪", LOCKED: "已锁定", SHARED: "已共享",
    DELIVERED: "已交付", ACKNOWLEDGED: "已回执", FROZEN: "已封存", IN_VERIFICATION: "核查中",
    REMEDIATION: "整改中", VERIFIED: "核查完成", AMENDMENT_REQUIRED: "需要更正", REVOKED: "已撤销",
    EXPIRED: "已过期", SUPERSEDED: "已被替代",
  });

  function create(options = {}, defaults = {}) {
    const workflow = options.workflow;
    const assetViews = options.assetViews;
    const assetRegistry = options.assetRegistry;
    const services = options.services || {};
    if (!workflow || typeof workflow.list !== "function") throw new Error("Shared Center ViewModel requires a workflow engine");
    if (!assetViews || typeof assetViews.accessibleAsset !== "function") throw new Error("Shared Center ViewModel requires asset views");

    const defaultTenantId = defaults.tenantId || "TNT-0018";
    const referenceDate = defaults.referenceDate || "2026-10-27";

    function context(input = {}) {
      return {
        tenantId: input.tenantId || defaultTenantId,
        role: input.role || "customer_owner",
        actor: input.actor || "当前用户",
        serviceId: input.serviceId || null,
      };
    }

    function serviceIdOf(object) {
      return object?.metadata?.serviceId || "cbam";
    }

    function serviceIsVisible(serviceId, role) {
      const service = services[serviceId];
      return Boolean(service && Array.isArray(service.roles) && service.roles.includes(role));
    }

    function referencedAssetIds(object) {
      const refs = new Set();
      const metadata = object?.metadata || {};
      Object.entries(metadata).forEach(([key, value]) => {
        if (/assetid$/i.test(key) || /productid$/i.test(key)) {
          if (typeof value === "string") refs.add(value);
          if (Array.isArray(value)) value.forEach((item) => typeof item === "string" && refs.add(item));
        }
      });
      if (typeof object?.scope === "string" && assetRegistry?.get?.(object.scope)) refs.add(object.scope);
      return [...refs];
    }

    function objectIsVisible(object, input = {}) {
      const ctx = context(input);
      if (!object || object.tenantId !== ctx.tenantId || !CUSTOMER_ROLES.has(ctx.role)) return false;
      const serviceId = serviceIdOf(object);
      if (ctx.serviceId && ctx.serviceId !== serviceId) return false;
      if (!serviceIsVisible(serviceId, ctx.role)) return false;
      return referencedAssetIds(object).every((assetId) => {
        if (!assetRegistry?.get?.(assetId)) return true;
        return Boolean(assetViews.accessibleAsset(assetId, { tenantId: ctx.tenantId, role: ctx.role, serviceId }));
      });
    }

    function formatDue(dueAt) {
      if (!dueAt) return { at: null, label: "无固定期限", tone: "neutral", rank: 4 };
      const today = Date.parse(`${referenceDate}T00:00:00Z`);
      const due = Date.parse(`${dueAt}T00:00:00Z`);
      const days = Math.round((due - today) / 86400000);
      if (days < 0) return { at: dueAt, label: `已逾期 ${Math.abs(days)} 天`, tone: "danger", rank: 0 };
      if (days === 0) return { at: dueAt, label: "今天到期", tone: "warn", rank: 1 };
      if (days === 1) return { at: dueAt, label: "明天到期", tone: "warn", rank: 2 };
      return { at: dueAt, label: `${dueAt.slice(5).replace("-", " 月 ")} 日`, tone: "neutral", rank: 3 };
    }

    function baseTask(object, input, fields) {
      const ctx = context(input);
      const serviceId = serviceIdOf(object);
      return {
        id: fields.id || `TASK-${object.id}-${ctx.role}`,
        tenantId: object.tenantId,
        serviceId,
        serviceName: services[serviceId]?.name || serviceId.toUpperCase(),
        serviceCode: services[serviceId]?.code || serviceId.toUpperCase(),
        sourceType: "workflow",
        sourceId: object.id,
        sourceRevision: object.revision,
        sourceStatus: object.status,
        object: fields.object || object.scope || object.id,
        title: fields.title,
        nextStep: fields.nextStep,
        owner: fields.owner || ctx.actor,
        due: formatDue(fields.dueAt),
        priority: fields.priority || "normal",
        page: fields.page,
      };
    }

    function taskFromObject(object, input = {}) {
      const ctx = context(input);
      if (!objectIsVisible(object, ctx) || CLOSED_TASK_STATUSES.has(object.status)) return null;

      if (object.id === "FACT-2026-Q3-GAS" && object.status === "MISSING" && ctx.role === "customer_contrib") {
        return baseTask(object, ctx, { title: "补充江苏二厂天然气账单", nextStep: "上传账单并核对账期、设施与用量", owner: ctx.actor, dueAt: "2026-10-27", priority: "high", page: "data" });
      }
      if (object.type === "approval" && ["PENDING", "IN_REVIEW"].includes(object.status) && ctx.role === "customer_approver") {
        return baseTask(object, ctx, { title: `审批${object.scope || "待决定事项"}`, nextStep: "查看差异、依据和影响后具名决定", owner: object.owner, dueAt: "2026-10-27", priority: "high", page: "approvals" });
      }
      if (object.type === "finding" && !["RESOLVED", "CLOSED"].includes(object.status) && ["customer_admin", "customer_owner"].includes(ctx.role)) {
        return baseTask(object, ctx, { title: "处理当前数据缺口", object: `${object.scope || "CBAM 计算"} · ${object.id}`, nextStep: "选择补数、等待供应商或受控默认值路径", owner: ctx.actor, dueAt: "2026-10-25", priority: "high", page: "results" });
      }
      if (object.type === "quarterlyPackage" && ["PLANNED", "COLLECTING", "READY_FOR_REVIEW"].includes(object.status) && ["customer_admin", "customer_owner"].includes(ctx.role)) {
        return baseTask(object, ctx, { title: `完成 ${object.quarter || "当前季度"} 数据包`, nextStep: object.status === "READY_FOR_REVIEW" ? "检查完整性并提交内部复核" : "补齐当前季度事实与证明材料", owner: object.owner, dueAt: "2026-10-31", page: "data" });
      }
      if (object.type === "serviceCase" && serviceIdOf(object) === "pcf") {
        const roleCanCoordinate = ["customer_admin", "customer_owner"].includes(ctx.role);
        if (object.status === "SCOPING" && roleCanCoordinate) return baseTask(object, ctx, { title: "确认 PCF 核算声明", nextStep: "确认产品、核算目标、功能单位和核算期间", dueAt: "2026-10-29", priority: "high", page: "pcf-scope" });
        if (object.status === "COLLECTING" && ["customer_admin", "customer_owner", "customer_contrib"].includes(ctx.role)) return baseTask(object, ctx, { title: ctx.role === "customer_contrib" ? "上传 PCF 活动数据与证明" : "完成 PCF 活动数据采集", nextStep: "按已确认范围上传模板和证明材料", dueAt: "2026-11-03", page: "pcf-data" });
        if (object.status === "NEEDS_CONFIRMATION" && roleCanCoordinate) return baseTask(object, ctx, { title: "确认 PCF 提取事实与服务用途", nextStep: "核对单位、期间、产品分配与来源证据", dueAt: "2026-11-04", priority: "high", page: "pcf-data" });
        if (object.status === "CALCULATING" && roleCanCoordinate) return baseTask(object, ctx, { title: "生成 PCF 确定性计算草稿", nextStep: "锁定输入快照并运行当前规则版本", dueAt: "2026-11-05", page: "pcf-results" });
      }
      return null;
    }

    function tasks(input = {}) {
      const ctx = context(input);
      const items = workflow.list({ tenantId: ctx.tenantId }).map((object) => taskFromObject(object, ctx)).filter(Boolean);
      items.sort((a, b) => a.due.rank - b.due.rank || (a.due.at || "9999").localeCompare(b.due.at || "9999") || a.id.localeCompare(b.id));
      return {
        items,
        summary: {
          total: items.length,
          urgent: items.filter((item) => item.due.rank <= 1).length,
          services: new Set(items.map((item) => item.serviceId)).size,
        },
      };
    }

    function artifactName(object) {
      if (object.type === "quarterlyPackage") return `${object.quarter || "季度"} Communication Package`;
      if (object.type === "verification") return "设施核查报告";
      return ARTIFACT_LABELS[object.metadata?.artifactType] || "受控交付物";
    }

    function artifactVersion(object) {
      if (object.metadata?.documentRevision) return `Rev ${object.metadata.documentRevision}`;
      const suffix = String(object.id).match(/-R(\d+)$/i);
      return suffix ? `Rev ${suffix[1]}` : object.type === "quarterlyPackage" ? "数据包版本 1" : "Rev 1";
    }

    function artifactControls(object) {
      const status = object.status;
      if (object.type === "verification") {
        return {
          approval: ["VERIFIED", "DELIVERED", "ACKNOWLEDGED"].includes(status) ? "核查完成" : status === "REMEDIATION" ? "整改中" : "待核查",
          lock: "按核查版本控制",
          delivery: status === "ACKNOWLEDGED" ? "已回执" : status === "DELIVERED" ? "已交付" : "未交付",
        };
      }
      const approved = ["APPROVED", "PACKAGE_READY", "LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED", "FROZEN"].includes(status);
      const locked = ["LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED", "FROZEN"].includes(status);
      const delivered = ["SHARED", "DELIVERED", "ACKNOWLEDGED", "FROZEN"].includes(status);
      return {
        approval: approved ? "已批准" : status === "INTERNAL_REVIEW" || status === "READY_FOR_REVIEW" ? "复核中" : "待批准",
        lock: locked ? (status === "FROZEN" ? "已封存" : "已锁定") : "未锁定",
        delivery: status === "ACKNOWLEDGED" || status === "FROZEN" ? "已回执" : delivered ? "已发送" : "未交付",
      };
    }

    function deliverableIsVisible(object, input = {}) {
      const ctx = context(input);
      if (!objectIsVisible(object, ctx) || !DELIVERY_TYPES.has(object.type)) return false;
      if (ctx.role === "customer_contrib") return object.owner === ctx.actor || object.metadata?.allowedRoles?.includes(ctx.role);
      return ["customer_admin", "customer_owner", "customer_approver"].includes(ctx.role);
    }

    function deliverables(input = {}) {
      const ctx = context(input);
      const items = workflow.list({ tenantId: ctx.tenantId }).filter((object) => deliverableIsVisible(object, ctx)).map((object) => {
        const serviceId = serviceIdOf(object);
        return {
          id: object.id,
          tenantId: object.tenantId,
          serviceId,
          serviceName: services[serviceId]?.name || serviceId.toUpperCase(),
          serviceCode: services[serviceId]?.code || serviceId.toUpperCase(),
          name: artifactName(object),
          object: object.scope || object.id,
          owner: object.owner,
          version: artifactVersion(object),
          workflowRevision: object.revision,
          status: STATUS_LABELS[object.status] || object.status,
          rawStatus: object.status,
          controls: artifactControls(object),
          snapshotId: object.metadata?.assetSnapshotId || object.metadata?.snapshotId || null,
          calculationRunId: object.metadata?.calculationRunId || object.metadata?.assetRunId || null,
          page: serviceId === "pcf" ? "pcf-report" : "deliverables",
        };
      });
      const statusRank = (item) => ["AMENDMENT_REQUIRED", "REVOKED", "EXPIRED"].includes(item.rawStatus) ? 0 : ["INTERNAL_REVIEW", "READY_FOR_REVIEW", "REMEDIATION"].includes(item.rawStatus) ? 1 : 2;
      items.sort((a, b) => statusRank(a) - statusRank(b) || a.serviceId.localeCompare(b.serviceId) || a.id.localeCompare(b.id));
      return {
        items,
        summary: {
          total: items.length,
          inReview: items.filter((item) => ["INTERNAL_REVIEW", "READY_FOR_REVIEW", "IN_VERIFICATION", "REMEDIATION"].includes(item.rawStatus)).length,
          locked: items.filter((item) => ["LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED", "FROZEN"].includes(item.rawStatus)).length,
          delivered: items.filter((item) => ["SHARED", "DELIVERED", "ACKNOWLEDGED", "FROZEN"].includes(item.rawStatus)).length,
        },
      };
    }

    return { tasks, deliverables, objectIsVisible, referencedAssetIds };
  }

  return { create, CUSTOMER_ROLES, DELIVERY_TYPES, ARTIFACT_LABELS, STATUS_LABELS };
});
