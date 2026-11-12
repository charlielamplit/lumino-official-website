"use strict";

  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

  const customerRoles = new Set(["customer_admin", "customer_owner", "customer_contrib", "customer_approver"]);
  const isCustomer = () => customerRoles.has(state.role);
  const isLockedYear = () => years[state.year]?.chip === "locked";
  const canManageOrganization = () => state.role === "customer_admin";
  const canCreateYear = () => state.role === "customer_admin";
  const canPerformPortalAction = (action, role = state.role) => window.LuminoPortalPermissions.canPerform(role, action);
  const portalActionDenial = (action) => window.LuminoPortalPermissions.denialMessage(action);
  const assetViews = window.LuminoAssetViewModel.create(assetRegistry, { tenantId: "TNT-0018" });
  const sharedCenterViews = window.LuminoSharedCenterViewModel.create({
    workflow: workflowEngine,
    assetViews,
    assetRegistry,
    agentTasks: agentTaskEngine,
    capabilities: window.LuminoAgentCapabilities,
    services: serviceRegistry,
  }, { tenantId: "TNT-0018", referenceDate: "2026-10-28" });
  const annualProfile = () => annualProfiles[state.year] || { mode: "planned", defaultQuarter: "Q1", step: 1, progress: years[state.year]?.progress || 0, position: "年度准备", foundation: "等待确认年度范围", quarters: { Q1: ["待计划", 0, ""], Q2: ["待计划", 0, ""], Q3: ["待计划", 0, ""], Q4: ["待计划", 0, ""] }, monitoring: ["待生成", ""], emissions: ["未开始", ""], verification: ["未开始", ""] };

  function customerNavWithLiveBadges() {
    const actor = roleConfig[state.role].name;
    const taskView = sharedCenterViews.tasks({ role: state.role, actor });
    const deliveryView = sharedCenterViews.deliverables({ role: state.role, actor });
    const assetView = assetViews.overview({ role: state.role, serviceId: state.currentService, facet: "attention" });
    const badgeFor = (id) => {
      if (id === "workbench") return taskView.summary.urgent || "";
      if (id === "shared-tasks") return taskView.summary.total || "";
      if (id === "shared-files") return assetView.summary.attention || "";
      if (id === "shared-deliverables") return deliveryView.summary.inReview || "";
      return "";
    };
    return customerGlobalNav.map(([id, icon, label, short]) => {
      const badge = badgeFor(id);
      return [id, icon, label, badge ? String(badge) : "", short || label];
    });
  }

  function periodKey() { return `${state.year}-${state.quarter}`; }

  function savePeriodState() {
    state.periodData[periodKey()] = {
      uploadAdded: state.uploadAdded,
      factConfirmed: state.factConfirmed,
      outputConfirmed: state.outputConfirmed,
      findingResolved: state.findingResolved,
      findingChoiceOpen: state.findingChoiceOpen,
      dataPathChoice: state.dataPathChoice,
      answer: state.answer,
    };
  }

  function loadPeriodState() {
    const saved = state.periodData[periodKey()] || {};
    state.uploadAdded = Boolean(saved.uploadAdded);
    state.factConfirmed = Boolean(saved.factConfirmed);
    state.outputConfirmed = Boolean(saved.outputConfirmed);
    state.findingResolved = Boolean(saved.findingResolved);
    state.findingChoiceOpen = Boolean(saved.findingChoiceOpen);
    state.dataPathChoice = saved.dataPathChoice || null;
    state.answer = saved.answer || null;
  }

  function persistPortalState() {
    savePeriodState();
    const persisted = {
      periodData: state.periodData, productOverrides: state.productOverrides, configurationDrafts: state.configurationDrafts,
      facilities: state.facilities, invitedMembers: state.invitedMembers, organization: state.organization,
      productYears: state.productYears, productCnCodes: state.productCnCodes, productAdded: state.productAdded,
      configurationAdded: state.configurationAdded, yearCreated: state.yearCreated, selectedProduct: state.selectedProduct,
      currentService: state.currentService, page: state.page, settingsSection: state.settingsSection,
      consultationRequests: state.consultationRequests, assetFacet: state.assetFacet,
      taskTab: state.taskTab, delivFilter: state.delivFilter,
    };
    window.localStorage.setItem(portalStateStorageKey, JSON.stringify(persisted));
  }

  const assetTypeLabels = {
    organization: "企业主档", organizationUnit: "组织单元", facility: "设施主档", product: "产品主档", productVariant: "产品规格",
    process: "工艺", productionLine: "产线", counterparty: "交易方", evidence: "原始证据", measurement: "测量记录",
    energyConsumption: "能源活动", materialFlow: "物料流动", productionOutput: "产量活动", transportActivity: "运输活动",
    wasteActivity: "废弃物活动", shipmentEvent: "发运事件", supplierDeclaration: "供应商声明", certificate: "证书",
    referenceData: "参考数据", dataset: "数据集",
  };
  const assetStatusLabels = {
    DRAFT: "草稿", PROPOSED: "Agent 提议", NEEDS_CONFIRMATION: "待确认", CONFIRMED: "企业已确认",
    CONFLICTED: "存在冲突", SUPERSEDED: "已被替代", ARCHIVED: "已归档",
  };
  const assetBindingLabels = {
    PROPOSED: "建议复用", PENDING_CONFIRMATION: "待本服务确认", CONFIRMED: "已确认使用", REJECTED: "已拒绝", SUPERSEDED: "已被替代",
  };

  function assetServiceName(id) {
    return id === "cbam" ? "CBAM" : id === "pcf" ? "PCF" : String(id || "").toUpperCase();
  }

  function assetPlainSummary(asset) {
    if (!asset) return "资产不存在或无权查看";
    const type = assetTypeLabels[asset.type] || asset.type;
    if (asset.type === "energyConsumption" && asset.payload?.originalValue) {
      return `${type} · ${Number(asset.payload.originalValue).toLocaleString("zh-CN")} ${asset.payload.originalUnit || ""}`.trim();
    }
    if (asset.type === "evidence") return `${type} · ${asset.payload?.fileName || asset.name}`;
    if (asset.type === "facility" || asset.type === "product" || asset.type === "organization") {
      return `${type} · ${asset.payload?.internalCode || asset.id}`;
    }
    return type;
  }

  function assetCoverageText(asset) {
    if (!asset) return "—";
    if (asset.temporal?.periodStart && asset.temporal?.periodEnd) return `${asset.temporal.periodStart} — ${asset.temporal.periodEnd}`;
    if (asset.temporal?.validFrom) return `${asset.temporal.validFrom} 起有效`;
    return "长期主档";
  }

  function assetSubjectText(asset) {
    if (!asset) return "—";
    const refs = asset.subjectRefs || {};
    const parts = [];
    const viewContext = { role: state.role, serviceId: state.currentService };
    if (refs.facilityId) parts.push(assetViews.accessibleAsset(refs.facilityId, viewContext)?.name || "受限设施");
    if (refs.productId) parts.push(assetViews.accessibleAsset(refs.productId, viewContext)?.name || "受限产品");
    if (refs.organizationId) parts.push(assetViews.accessibleAsset(refs.organizationId, viewContext)?.name || "受限企业");
    if (refs.counterpartyId) parts.push(`交易方 ${refs.counterpartyId}`);
    return parts.join(" · ") || asset.ownerOrganizationId || "企业范围";
  }

  function assetCapsule(assetId, options = {}) {
    const viewContext = { role: state.role, serviceId: options.serviceId || state.currentService };
    const asset = assetViews.accessibleAsset(assetId, viewContext);
    if (!asset) return "";
    const serviceId = options.serviceId || null;
    const visibleBindings = assetViews.bindingsForVisibleAsset(assetId, viewContext);
    const binding = serviceId ? visibleBindings.find((item) => item.serviceId === serviceId) : null;
    const otherBindings = visibleBindings.filter((item) => !serviceId || item.serviceId !== serviceId);
    const confirmedElsewhere = otherBindings.filter((item) => item.status === "CONFIRMED").map((item) => assetServiceName(item.serviceId));
    const valueBit = asset.payload?.originalValue
      ? `${Number(asset.payload.originalValue).toLocaleString("zh-CN")} ${asset.payload.originalUnit || ""}`.trim()
      : asset.payload?.fileName || assetTypeLabels[asset.type] || asset.type;
    const statusBit = binding
      ? (assetBindingLabels[binding.status] || binding.status)
      : (assetStatusLabels[asset.status] || asset.status);
    const reuseBit = confirmedElsewhere.length
      ? `也用于 ${confirmedElsewhere.join("、")}`
      : otherBindings.length
        ? `另有 ${otherBindings.length} 项服务引用`
        : "尚未被其他服务使用";
    const tone = binding?.status === "CONFIRMED" || asset.status === "CONFIRMED" ? "ok" : "warn";
    return `<button type="button" class="asset-capsule asset-capsule--${tone}" data-drawer="asset-detail" data-asset-id="${safe(asset.id)}" aria-label="查看数据资产 ${safe(asset.name)}">
      <span class="asset-capsule__kind">${safe(assetTypeLabels[asset.type] || asset.type)}</span>
      <strong>${safe(asset.name)}</strong>
      <span class="asset-capsule__meta">${safe(valueBit)} · ${safe(statusBit)}</span>
      <small>${safe(reuseBit)}</small>
    </button>`;
  }

  function assetImpactPreviewHtml(assetId) {
    const impact = assetViews.impact(assetId, { role: state.role, serviceId: state.currentService });
    if (!impact?.asset) return "<p>找不到该资产，或当前角色无权查看。</p>";
    const bindingRows = impact.bindings.length
      ? impact.bindings.map((binding) => `<li><strong>${safe(assetServiceName(binding.serviceId))}</strong><span>${safe(binding.usagePurpose || "服务引用")} · ${safe(assetBindingLabels[binding.status] || binding.status)}</span><small>不会自动切换到新版本</small></li>`).join("")
      : "<li><strong>无活跃绑定</strong><span>修订不会影响服务使用状态</span></li>";
    const staleRows = impact.staleSnapshots.length
      ? impact.staleSnapshots.map((snapshot) => `<li><strong>${safe(snapshot.id)}</strong><span>${safe(assetServiceName(snapshot.serviceId))} 输入快照将标为过期</span></li>`).join("")
      : "<li><strong>无未锁定快照</strong><span>当前没有会自动过期的计算输入</span></li>";
    const lockedRows = impact.lockedSnapshots.length
      ? impact.lockedSnapshots.map((snapshot) => `<li><strong>${safe(snapshot.id)}</strong><span>已锁定报告保持可重现，仅记录影响告警</span></li>`).join("")
      : "<li><strong>无已锁定交付</strong><span>暂无锁定快照需要告警</span></li>";
    return `<div class="asset-impact">
      <p class="drawer-intro">修订「${safe(impact.asset.name)}」会生成新版本，不会覆盖 ${safe(impact.asset.versionId)}。各服务需自行决定是否改绑。</p>
      <section><span>服务绑定</span><ul class="asset-impact-list">${bindingRows}</ul></section>
      <section><span>将过期的计算输入</span><ul class="asset-impact-list">${staleRows}</ul></section>
      <section><span>已锁定交付物</span><ul class="asset-impact-list">${lockedRows}</ul></section>
      <footer class="drawer-actions">
        <button class="button button--secondary" type="button" data-close-drawer>取消</button>
        <button class="button button--secondary" type="button" data-drawer="asset-detail" data-asset-id="${safe(assetId)}">返回详情</button>
        <button class="button button--primary" type="button" data-action="asset-revise-confirm" data-asset-id="${safe(assetId)}">确认创建修订版</button>
      </footer>
    </div>`;
  }

  function assetDetailHtml(assetId) {
    const view = assetViews.detail(assetId, { role: state.role, serviceId: state.currentService });
    if (!view) {
      return `<div class="asset-detail"><p class="drawer-intro">找不到数据资产，或当前角色无权查看。</p><footer class="drawer-actions"><button class="button button--secondary" type="button" data-close-drawer>关闭</button></footer></div>`;
    }
    const { asset, bindings, lineage, history, impact } = view;
    const sourceNames = view.sourceNames.join("、") || "未关联证据";
    const quality = asset.quality || {};
    const qualityDims = [
      ["完整性", quality.completeness], ["准确性", quality.accuracy], ["一致性", quality.consistency],
      ["及时性", quality.timeliness], ["唯一性", quality.uniqueness], ["可追溯性", quality.traceability],
    ].map(([label, value]) => `<li><span>${label}</span><strong>${value == null ? "未知" : Math.round(Number(value) * 100) + "%"}</strong></li>`).join("");
    const issues = (quality.issues || []).length ? quality.issues.map((issue) => `<li>${safe(issue)}</li>`).join("") : "<li>无开放质量问题</li>";
    const staleBindings = [];
    const bindingRows = bindings.length
      ? bindings.map((binding) => {
        const snapshot = binding.snapshotId ? assetRegistry.getSnapshot(binding.snapshotId) : null;
        if (snapshot?.status === "STALE") staleBindings.push({ binding, snapshot });
        const staleNote = snapshot?.status === "STALE" ? "输入快照已过期" : snapshot?.locked ? "报告输入已锁定" : snapshot ? `快照 ${snapshot.id}` : "尚未进入计算快照";
        return `<article class="asset-binding-row">
          <div><span class="service-tag ${binding.serviceId === "pcf" ? "pilot" : ""}">${safe(assetServiceName(binding.serviceId))}</span><strong>${safe(binding.usagePurpose || "服务引用")}</strong><small>${safe(binding.id)} · 锁定 ${safe(binding.assetVersionId)}</small></div>
          <div><span class="record-state ${binding.status === "CONFIRMED" ? "ok" : "warn"}">${safe(assetBindingLabels[binding.status] || binding.status)}</span><small>${safe(staleNote)}</small></div>
        </article>`;
      }).join("")
      : `<p class="asset-empty">尚未被任何服务绑定。服务使用前需创建独立确认。</p>`;
    const staleBanner = staleBindings.length
      ? staleSnapshotPanel({
        snapshotId: staleBindings[0].snapshot.id,
        resumePage: staleBindings[0].binding.serviceId === "pcf" ? "pcf-data" : "data",
      })
      : "";
    const lineageName = (id) => assetViews.accessibleAsset(id, { role: state.role, serviceId: state.currentService })?.name || "受限来源";
    const lineageSteps = lineage.length
      ? lineage.map((edge) => `<li><strong>${safe(String(edge.activityType || "").replace(/_/g, " "))}</strong><span>${safe(lineageName(edge.fromAssetId))} → ${safe(lineageName(edge.toAssetId))}</span><small>${safe(edge.agentId || "system")} · ${safe(edge.ruleVersion || "无规则版本")}</small></li>`).join("")
      : "<li><strong>尚无处理血缘</strong><span>直接登记或主档对象</span></li>";
    const versionSteps = history.slice().reverse().map((version) => `<li class="${version.versionId === asset.versionId ? "current" : ""}"><strong>${safe(version.versionId)}</strong><span>${safe(assetStatusLabels[version.status] || version.status)} · ${safe(version.createdBy)}</span><small>${safe(version.reason || "无说明")} · ${safe(new Date(version.createdAt).toLocaleString("zh-CN", { hour12: false }))}</small></li>`).join("");
    const access = asset.access || {};
    const accessText = access.confidentiality === "highly_sensitive"
      ? "高度敏感：默认仅授权审批人与已绑定专家可见内容"
      : access.confidentiality === "sensitive"
        ? "敏感：企业授权角色与已绑定服务可访问；运营默认只看元数据"
        : "一般/内部：当前企业授权范围内可见";
    const canConfirmAsset = ["DRAFT", "PROPOSED", "NEEDS_CONFIRMATION", "CONFLICTED"].includes(asset.status)
      && ["customer_admin", "customer_owner"].includes(state.role);
    const pendingServiceBinding = bindings.find((item) => ["PROPOSED", "PENDING_CONFIRMATION"].includes(item.status));
    const primaryAction = canConfirmAsset
      ? `<button class="button button--primary" type="button" data-action="asset-confirm" data-asset-id="${safe(asset.id)}">确认企业事实</button>`
      : pendingServiceBinding
        ? `<button class="button button--primary" type="button" data-service-enter="${safe(pendingServiceBinding.serviceId)}" data-page-target="${pendingServiceBinding.serviceId === "pcf" ? "pcf-data" : "data"}">去 ${safe(assetServiceName(pendingServiceBinding.serviceId))} 确认绑定</button>`
        : "";
    const valueBlock = asset.payload?.originalValue
      ? `<section class="asset-value-panel" aria-label="资产数值">
          <div class="asset-value-panel__primary">
            <span>原始值</span>
            <strong><em>${safe(Number(asset.payload.originalValue).toLocaleString("zh-CN"))}</em> ${safe(asset.payload.originalUnit || "")}</strong>
          </div>
          <div class="asset-value-panel__secondary">
            <span>标准值</span>
            <strong>${safe(asset.payload.normalizedValue ? `${Number(asset.payload.normalizedValue).toLocaleString("zh-CN")} ${asset.payload.normalizedUnit || ""}` : "未换算")}</strong>
          </div>
        </section>`
      : asset.payload?.fileName
        ? `<div class="asset-value-pair"><div><span>文件</span><strong>${safe(asset.payload.fileName)}</strong></div><div><span>类型</span><strong>${safe(asset.payload.documentType || asset.payload.mediaType || "—")}</strong></div></div>`
        : `<div class="asset-value-pair"><div><span>业务对象</span><strong>${safe(assetPlainSummary(asset))}</strong></div><div><span>内部编码</span><strong>${safe(asset.payload?.internalCode || asset.id)}</strong></div></div>`;
    const impactHint = impact.staleSnapshots.length || impact.lockedSnapshots.length
      ? `<p class="asset-impact-hint">若修订此版本：${impact.staleSnapshots.length} 个未锁定快照将过期；${impact.lockedSnapshots.length} 个已锁定报告保持可重现。</p>`
      : `<p class="asset-impact-hint">当前没有依赖此版本的计算快照。</p>`;

    return `<div class="asset-detail drawer-shell" data-template="T3">
      ${staleBanner}
      <section class="asset-detail__hero">
        <div><span>${safe(assetTypeLabels[asset.type] || asset.type)} · ${safe(asset.versionId)}</span><h3>${safe(asset.name)}</h3><p>${safe(assetPlainSummary(asset))} · 属于 ${safe(assetViews.accessibleAsset(asset.ownerOrganizationId, { role: state.role })?.name || "当前企业")}</p></div>
        <span class="record-state ${asset.status === "CONFIRMED" ? "ok" : "warn"}">${safe(assetStatusLabels[asset.status] || asset.status)}</span>
      </section>
      ${valueBlock}
      <dl class="asset-detail__facts">
        <div><dt>覆盖对象</dt><dd>${safe(assetSubjectText(asset))}</dd></div>
        <div><dt>覆盖期间</dt><dd>${safe(assetCoverageText(asset))}</dd></div>
        <div><dt>当前版本</dt><dd>${safe(asset.versionId)}</dd></div>
        <div><dt>责任人</dt><dd>${safe(asset.steward?.ownerName || "待分配")}</dd></div>
      </dl>
      <section class="asset-detail__block">
        <header><span>服务使用</span><strong>${bindings.length} 项绑定</strong></header>
        <div class="asset-binding-list">${bindingRows}</div>
        ${impactHint}
      </section>
      <section class="asset-detail__block ${["PROPOSED", "NEEDS_CONFIRMATION"].includes(asset.status) ? "is-proposal" : ""}">
        <header><span>${["PROPOSED", "NEEDS_CONFIRMATION"].includes(asset.status) ? "待确认来源" : "来源与版本"}</span><strong>${safe(asset.provenance?.sourceType || "manual")} · Rev ${asset.revision}</strong></header>
        <p>来自 ${safe(sourceNames)}${asset.provenance?.confirmedBy ? ` · 由 ${safe(asset.provenance.confirmedBy)} 确认` : " · 尚未确认为企业正式事实"}</p>
        <ol class="asset-timeline">${versionSteps}</ol>
      </section>
      <section class="asset-detail__block">
        <header><span>数据质量</span><strong>${safe(quality.status || "待评估")}</strong></header>
        <ul class="asset-quality-grid">${qualityDims}</ul>
        <ul class="asset-issue-list">${issues}</ul>
      </section>
      <section class="asset-detail__block">
        <header><span>处理血缘</span><strong>${lineage.length} 步</strong></header>
        <ol class="asset-timeline">${lineageSteps}</ol>
      </section>
      <section class="asset-detail__block">
        <header><span>谁可以访问</span><strong>${safe(access.confidentiality || "internal")}</strong></header>
        <p>${safe(accessText)}</p>
      </section>
      <footer class="drawer-actions">
        <button class="button button--secondary" type="button" data-close-drawer>关闭</button>
        ${primaryAction || `<button class="button button--secondary" type="button" data-drawer="asset-impact" data-asset-id="${safe(asset.id)}">查看修订影响</button>`}
      </footer>
    </div>`;
  }

  function workflowActor() {
    const profile = roleConfig[state.role];
    return { actor: profile.name, role: state.role };
  }

  function workflowObject(flowId) {
    const reference = workflowObjectRefs[flowId];
    if (!reference) return null;
    if (["evidence", "calculation"].includes(flowId)) {
      const type = reference[1];
      const matches = workflowEngine.list({ type, year: state.year, quarter: state.quarter })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      if (matches.length) return matches[0];
    }
    return workflowEngine.get(reference[0]);
  }

  function workflowView(flowId, flow = workflowStates[flowId]) {
    const object = workflowObject(flowId);
    const objectType = workflowObjectRefs[flowId]?.[1];
    const canonicalStates = window.LuminoWorkflow.definitions[objectType]?.states;
    return { ...flow, current: object?.status || flow.current, states: canonicalStates || flow.states, object };
  }

  function ensureWorkflowObject(input) {
    return workflowEngine.get(input.id) || workflowEngine.create({ ...input, ...workflowActor(), reason: input.reason || "用户操作创建业务对象" });
  }

  function moveWorkflow(id, targets, reason, metadata = {}) {
    targets.forEach((target) => {
      if (workflowEngine.canTransition(id, target)) workflowEngine.transition(id, target, { ...workflowActor(), reason, metadata });
    });
    return workflowEngine.get(id);
  }

  function syncUiFromWorkflow() {
    const evidence = workflowEngine.get(`EVD-${state.year}-${state.quarter}-GAS`);
    const fact = workflowEngine.get(`FACT-${state.year}-${state.quarter}-GAS`);
    const finding = workflowEngine.get("FND-PRE-004");
    state.uploadAdded = Boolean(evidence && !["UPLOADED", "SECURITY_SCANNED"].includes(evidence.status));
    state.factConfirmed = Boolean(fact && ["CONFIRMED", "APPROVED", "VERIFIED"].includes(fact.status));
    state.findingResolved = Boolean(finding && ["RESPONSE_SUBMITTED", "VALIDATING", "RESOLVED", "CLOSED"].includes(finding.status));
  }

  function iconLabel(role) {
    if (customerRoles.has(role)) return "客户企业";
    return { expert: "制备专家", reviewer: "独立复核", ops: "运营视图", sales: "商务视图", importer: "外部接收方", verifier: "第三方核查", supplier: "供应商协同", support: "平台支持", platform_admin: "平台治理" }[role];
  }

  function pageHeader(meta, title, aside = "") {
    const metaHtml = meta ? `<p class="page-head__meta">${meta}</p>` : "";
    return `<header class="page-head"><div>${metaHtml}<h1>${title}</h1></div>${aside || ""}</header>`;
  }

  /** Unified in-content system states (framework F): empty / loading / error / forbidden / locked / stale. */
  function systemStatePanel({
    code = "empty",
    title,
    reason = "",
    canDo = [],
    primary = null,
    secondary = null,
    errorCode = "",
  } = {}) {
    const labels = {
      empty: "暂无内容",
      loading: "正在加载",
      error: "出错了",
      forbidden: "无权访问",
      locked: "已锁定",
      stale: "数据已过期",
    };
    const actions = [
      primary ? `<button class="button button--primary" type="button" ${primary.attrs || ""}>${safe(primary.label)}</button>` : "",
      secondary ? `<button class="button button--secondary" type="button" ${secondary.attrs || ""}>${safe(secondary.label)}</button>` : "",
    ].filter(Boolean).join("");
    const list = (canDo || []).length
      ? `<ul class="system-state__can">${canDo.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>`
      : "";
    const skeleton = code === "loading"
      ? `<div class="system-state__skeleton" aria-hidden="true"><span></span><span></span><span></span></div>`
      : "";
    const errorMeta = code === "error" && errorCode
      ? `<p class="system-state__error-code">错误编号 ${safe(errorCode)}</p>`
      : "";
    return `<section class="system-state system-state--${safe(code)}" data-system-state="${safe(code)}" aria-live="polite"${code === "loading" ? ' aria-busy="true"' : ""}>
      <p class="system-state__code">${safe(labels[code] || code)}</p>
      <h2>${safe(title || labels[code] || "状态")}</h2>
      ${reason ? `<p class="system-state__reason">${safe(reason)}</p>` : ""}
      ${errorMeta}
      ${skeleton}
      ${list}
      ${actions ? `<div class="system-state__actions">${actions}</div>` : ""}
    </section>`;
  }

  function listPageShell({ meta, title, aside = "", tabs = "", body = "", footnote = "" }) {
    return `<div class="list-page-shell" data-template="T2">
      ${pageHeader(meta, title, aside)}
      ${tabs || ""}
      ${body}
      ${footnote || ""}
    </div>`;
  }

  /** T5 review / compare: queue + decision sheet + optional separation note. */
  function reviewSuiteShell({
    meta,
    title,
    aside = "",
    note = "",
    queueTitle = "待处理队列",
    queueMeta = "",
    queueItems = "",
    decisionKicker = "",
    decisionTitle = "",
    decisionLead = "",
    decisionPoints = "",
    approveLabel = "批准",
    approveAttrs = "",
    rejectLabel = "退回",
    rejectAttrs = "",
    secondaryLabel = "",
    secondaryAttrs = "",
  } = {}) {
    const noteHtml = note ? `<div class="callout review-suite__note" role="note"><strong>职责分离：</strong> ${note}</div>` : "";
    const secondary = secondaryLabel
      ? `<button class="button button--secondary" type="button" ${secondaryAttrs}>${safe(secondaryLabel)}</button>`
      : `<button class="button button--secondary" type="button" ${rejectAttrs}>${safe(rejectLabel)}</button>`;
    return `<div class="review-suite" data-template="T5">
      ${pageHeader(meta, title, aside)}
      ${noteHtml}
      <div class="approval-board review-suite__board">
        <section class="panel">
          <div class="panel-head"><h2>${safe(queueTitle)}</h2>${queueMeta || ""}</div>
          <div class="stack-list">${queueItems}</div>
        </section>
        <section class="panel review-sheet">
          ${decisionKicker ? `<small>${safe(decisionKicker)}</small>` : ""}
          <h2>${safe(decisionTitle)}</h2>
          ${decisionLead ? `<p>${decisionLead}</p>` : ""}
          ${decisionPoints ? `<ol>${decisionPoints}</ol>` : ""}
          <div class="action-bar">
            <button class="button button--primary" type="button" ${approveAttrs}>${safe(approveLabel)}</button>
            ${secondary}
          </div>
        </section>
      </div>
    </div>`;
  }

  const settingsNavItems = [
    ["org", "企业信息", "1"],
    ["facilities", "设施", null],
    ["members", "成员与角色", "2"],
    ["services", "服务与订单", null],
    ["security", "安全与登录", null],
    ["audit", "审计记录", null],
  ];

  /** T6 settings: sectioned shell; year/quarter stay hidden (cross-year page). */
  function settingsShell({ title = "企业设置", aside = "", section = "members", body = "" } = {}) {
    const current = settingsNavItems.some(([id]) => id === section) ? section : "members";
    const nav = settingsNavItems.map(([id, label, badge]) => `
      <button class="${current === id ? "active" : ""}" type="button" data-settings-section="${id}" ${current === id ? 'aria-current="page"' : ""}>
        ${safe(label)}${badge ? `<span>${safe(badge)}</span>` : ""}
      </button>`).join("");
    return `<div class="settings-shell" data-template="T6" data-settings-section="${safe(current)}">
      ${pageHeader("ENTERPRISE SETTINGS", title, aside)}
      <p class="settings-shell__lead">这里回答「谁能看、能做什么」。保存后原位提示，并写入审计记录；不会静默扩大权限。</p>
      <div class="settings-layout">
        <nav class="settings-nav" aria-label="企业设置分区">${nav}</nav>
        <section class="settings-main">${body}</section>
      </div>
    </div>`;
  }

  /** T3 drawer body shell: type/version → usage → source → footer with close + one primary. */
  function drawerShell({
    kind = "DETAIL",
    name = "",
    version = "",
    status = "",
    usage = "",
    source = "",
    body = "",
    primary = null,
    secondary = null,
  } = {}) {
    const primaryBtn = primary
      ? `<button class="button button--primary" type="button" ${primary.attrs || ""}>${safe(primary.label)}</button>`
      : "";
    const secondaryBtn = secondary
      ? `<button class="button button--secondary" type="button" ${secondary.attrs || ""}>${safe(secondary.label)}</button>`
      : "";
    return `<div class="drawer-shell" data-template="T3">
      <header class="drawer-shell__head">
        <p>${safe(kind)}${version ? ` · ${safe(version)}` : ""}</p>
        <h3>${safe(name)}</h3>
        ${status ? `<span class="record-state">${safe(status)}</span>` : ""}
      </header>
      ${usage ? `<section class="drawer-shell__block"><span>服务使用</span><p>${usage}</p></section>` : ""}
      ${source ? `<section class="drawer-shell__block"><span>来源与版本</span><p>${source}</p></section>` : ""}
      ${body}
      <footer class="drawer-actions">
        <button class="button button--secondary" type="button" data-close-drawer>关闭</button>
        ${secondaryBtn}
        ${primaryBtn}
      </footer>
    </div>`;
  }

  /** T4 step-flow footer: previous / continue share one sticky bar. */
  function stepFlowFooter({ prev = null, next = null, hint = "" } = {}) {
    const prevBtn = prev
      ? `<button class="button button--secondary" type="button" ${prev.attrs || ""}>${safe(prev.label || "上一步")}</button>`
      : `<span></span>`;
    const nextBtn = next
      ? `<button class="button button--primary" type="button" ${next.attrs || ""}${next.disabled ? " disabled" : ""}>${safe(next.label || "确认并继续")}<span aria-hidden="true"> →</span></button>`
      : "";
    return `<footer class="step-flow-footer" data-template="T4">
      ${prevBtn}
      <div class="step-flow-footer__meta">${hint ? `<p>${safe(hint)}</p>` : ""}${nextBtn}</div>
    </footer>`;
  }

  function lockedYearBanner() {
    if (!isLockedYear()) return "";
    return systemStatePanel({
      code: "locked",
      title: `${state.year} 年度已锁定`,
      reason: "这是交付时的不可变快照。产量、能耗、计算与批准状态不能原位修改；如需更正，请创建 Amendment Revision。",
      canDo: ["只读查看历史数据包与交付物", "创建更正修订（Amendment）", "切换到进行中的年度继续工作"],
      primary: { label: "创建更正修订", attrs: 'data-drawer="generic-action" data-drawer-label="创建 Amendment Revision"' },
      secondary: { label: "切到 2026 年度", attrs: 'data-action="enter-program" data-year="2026"' },
    });
  }

  function staleSnapshotPanel({ snapshotId = "", runId = "", resumePage = "pcf-data" } = {}) {
    return systemStatePanel({
      code: "stale",
      title: "输入快照已过期（STALE）",
      reason: `上游资产或绑定已修订${snapshotId ? `（${snapshotId}）` : ""}。当前计算结果${runId ? ` ${runId}` : ""}不可再作为正式依据；历史数值仅供对照。`,
      canDo: ["回到活动数据重新确认绑定", "重新运行计算生成新 Run", "对照历史结果，但不用于正式披露"],
      primary: { label: "返回活动数据", attrs: `data-page="${safe(resumePage)}"` },
      secondary: { label: "查看服务目录", attrs: 'data-page="services-hub"' },
    });
  }

  function showForbiddenPage(pageId) {
    $("#main").innerHTML = systemStatePanel({
      code: "forbidden",
      title: "当前角色不能进入此页面",
      reason: `页面「${pageId}」不在你的授权范围，或当前服务频道未开通该入口。导航仍然可用，可返回工作台或联系企业管理员开通权限。`,
      canDo: ["返回工作台或工作队列", "切换到有权限的服务频道", "联系企业管理员申请权限"],
      primary: { label: "返回工作台", attrs: 'data-page="workbench"' },
      secondary: { label: "查看企业与权限", attrs: 'data-page="org-settings"' },
    });
  }

  function actionButton(label, variant = "primary", attributes = "") {
    return `<button class="button button--${variant}" type="button" ${attributes}>${label}</button>`;
  }

  function statusChip(label, tone = "") {
    return `<span class="status-chip ${tone}">${label}</span>`;
  }

  function workflowStateLabel(value) {
    const serviceLabels = { SCOPING: "核算声明", CALCULATING: "计算中", EXPERT_REVIEW: "独立复核", DELIVERABLE_READY: "报告就绪" };
    if (serviceLabels[value]) return serviceLabels[value];
    return ({ NOT_STARTED: "未开始", PLANNED: "已计划", COLLECTING: "收集中", READY_FOR_REVIEW: "待复核", APPROVED: "已批准", PACKAGE_READY: "数据包就绪", SHARED: "已分享", ACKNOWLEDGED: "对方已接收", FROZEN: "已冻结", DRAFT: "草稿", GENERATED: "已生成", VALIDATED: "已校验", INTERNAL_REVIEW: "内部复核中", LOCKED: "已锁定", DELIVERED: "已交付", IN_VERIFICATION: "核查中", REMEDIATION: "整改中", VERIFIED: "已核查", ACTIVE: "在用 / 履约中", SUSPENDED: "已暂停", RETIRED: "已停用", SUGGESTED: "已建议", UNDER_REVIEW: "审核中", CONFIRMED: "已确认", SUPERSEDED: "已被替代", IMPORTED: "已导入", MATCHING: "匹配中", NEEDS_REVIEW: "需人工确认", RECONCILED: "已对账", INCLUDED: "已纳入", UPLOADED: "已上传", SECURITY_SCANNED: "安全扫描通过", PARSED: "已解析", CLASSIFIED: "已分类", LINKED: "已关联", REVIEWED: "已复核", ACCEPTED: "已接受", ARCHIVED: "已归档", MISSING: "缺失", NEEDS_CONFIRMATION: "待确认", CONFLICTED: "数据冲突", NEEDS_EVIDENCE: "缺少依据", REJECTED: "已退回", QUEUED: "排队中", RUNNING: "运行中", SUCCEEDED: "运行成功", CURRENT: "当前版本", STALE: "已过期", OPEN: "开放", TRIAGED: "已分级", ASSIGNED: "已分派", RESPONSE_SUBMITTED: "已回应", VALIDATING: "验证中", RESOLVED: "已解决", REOPENED: "已重开", IN_PROGRESS: "处理中", SUBMITTED: "已提交", DONE: "已完成", PROPOSED: "待发送", SENT: "已发送", PENDING: "待审批", IN_REVIEW: "审批中", WITHDRAWN: "已撤回", COMPLETED: "已完成", CLOSED: "已关闭" })[value] || value;
  }

  function workflowStateTone(value) {
    if (["SCOPING", "CALCULATING", "EXPERT_REVIEW", "NEEDS_CONFIRMATION"].includes(value)) return "warn";
    if (value === "DELIVERABLE_READY") return "ok";
    if (["APPROVED", "ACKNOWLEDGED", "VERIFIED", "COMPLETED", "CLOSED", "FROZEN", "CONFIRMED", "ACCEPTED", "CURRENT", "ACTIVE"].includes(value)) return "ok";
    if (["COLLECTING", "READY_FOR_REVIEW", "INTERNAL_REVIEW", "IN_VERIFICATION", "REMEDIATION", "IN_PROGRESS", "UNDER_REVIEW", "NEEDS_REVIEW", "VALIDATING", "IN_REVIEW"].includes(value)) return "warn";
    return "";
  }

  function objectContext(items) {
    return `<section class="object-context" aria-label="当前对象上下文">${items.map(([label, value]) => `<div><small>${label}</small><strong title="${safe(value)}">${safe(value)}</strong></div>`).join("")}</section>`;
  }

  function workflowCard(id, flow) {
    const view = workflowView(id, flow);
    const currentIndex = view.states.indexOf(view.current);
    const objectMeta = view.object ? `<div class="workflow-meta"><span>${safe(view.object.id)}</span><span>Rev ${view.object.revision}</span><span>${safe(view.object.owner)}</span></div>` : "";
    return `<article class="workflow-card"><header><div><small>${safe(view.cadence)}</small><h2>${safe(view.label)}</h2></div>${statusChip(workflowStateLabel(view.current), workflowStateTone(view.current))}</header>${objectMeta}<div class="state-track" aria-label="${safe(view.label)}状态"><span style="--state-progress:${Math.max(3, Math.round(((currentIndex + 1) / view.states.length) * 100))}%"></span></div><p><b>下一步：</b>${safe(view.next)}</p><button class="text-button" type="button" data-drawer="workflow-detail" data-flow="${id}" data-drawer-label="${safe(view.label)}">查看状态与审计</button></article>`;
  }

  function activeServiceNav(serviceId = state.currentService, role = state.role) {
    if (serviceId === "cbam" && ["customer_contrib", "customer_approver"].includes(role)) return roleConfig[role].nav;
    if (serviceId === "pcf" && role === "customer_contrib") return serviceRegistry.pcf.nav.filter(([id]) => id === "pcf-data");
    if (serviceId === "pcf" && role === "customer_approver") return serviceRegistry.pcf.nav.filter(([id]) => id === "pcf-report");
    return serviceRegistry[serviceId]?.nav || [];
  }

  function isValidCustomerDestination(serviceId, page, role = state.role) {
    if (globalCustomerPages.has(page)) return !serviceId;
    return Boolean(serviceRegistry[serviceId]?.roles.includes(role) && activeServiceNav(serviceId, role).some(([id]) => id === page));
  }

  function canAccessPage(page, role = state.role, serviceId = state.currentService) {
    if (customerRoles.has(role)) {
      if (globalCustomerPages.has(page)) return true;
      return isValidCustomerDestination(serviceId, page, role);
    }
    return Boolean(roleConfig[role]?.nav.some(([id]) => id === page));
  }

  function customerHasEnterableServices() {
    return Object.values(serviceRegistry).some((service) => service.roles?.includes(state.role) && service.entryPage);
  }

  /** Demo entry: the workbench stays underneath an independent, dismissible service overview. */
  function resolveCustomerHomePage() {
    return customerHasEnterableServices() ? "workbench" : "services-hub";
  }

  /** 一级入口进入跨服务页时，二级筛选回到第一项。 */
  function resetSecondaryDefaults(page) {
    if (page === "shared-tasks") state.taskTab = "open";
    else if (page === "shared-files") state.assetFacet = "attention";
    else if (page === "shared-deliverables") state.delivFilter = "all";
    else if (page === "org-settings") state.settingsSection = settingsNavItems[0]?.[0] || "org";
  }

  function firstServicePage(serviceId) {
    return activeServiceNav(serviceId)[0]?.[0] || null;
  }

  function setCustomerDestination(serviceId, page) {
    if (globalCustomerPages.has(page)) {
      state.currentService = null;
      state.page = page;
      resetSecondaryDefaults(page);
      return;
    }
    const validService = serviceRegistry[serviceId]?.roles.includes(state.role) ? serviceId : null;
    state.currentService = validService;
    const nav = validService ? activeServiceNav(validService) : [];
    /* 一级服务轨点击（无 page / 无效 page）一律落到该服务二级导航第一项 */
    state.page = validService && page && nav.some(([id]) => id === page)
      ? page
      : (firstServicePage(validService) || "services-hub");
  }

  function syncCustomerUrl() {
    if (!state.loggedIn || !isCustomer()) return;
    const url = new URL(window.location.href);
    url.search = "";
    if (state.currentService) url.searchParams.set("service", state.currentService);
    if (state.page !== "services-hub") url.searchParams.set("page", state.page);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function login(role, options = {}) {
    state.role = role || "customer_owner";
    if (customerRoles.has(state.role)) { state.year = "2026"; state.quarter = "Q3"; }
    if (state.role === "customer_owner" && state.importedTrial && years[state.importedTrial.year]) state.year = state.importedTrial.year;
    if (isCustomer()) {
      const requestedService = incoming.get("service");
      const requestedPage = incoming.get("page");
      if (requestedService || requestedPage) setCustomerDestination(requestedService, requestedPage);
      else if (options.restore && isValidCustomerDestination(state.currentService, state.page)) setCustomerDestination(state.currentService, state.page);
      else setCustomerDestination(null, resolveCustomerHomePage());
    } else state.page = defaultPages[state.role];
    state.serviceOverviewMode = isCustomer() ? "open" : "closed";
    state.loggedIn = true;
    window.sessionStorage.setItem("lumino-portal-session-role", state.role);
    loadPeriodState(); syncUiFromWorkflow();
    $("#loginScreen").hidden = true;
    $("#portal").hidden = false;
    $("#roleSelect").value = state.role;
    syncShell();
    render();
    window.scrollTo(0, 0);
  }

  function logout() {
    state.loggedIn = false;
    state.currentService = null;
    state.page = "services-hub";
    window.sessionStorage.removeItem("lumino-portal-session-role");
    if (isCustomer()) window.history.replaceState({}, "", window.location.pathname);
    $("#portal").hidden = true;
    $("#loginScreen").hidden = false;
    $("#sidebar").classList.remove("open");
    $("#mobileMenu").setAttribute("aria-expanded", "false");
  }

  function railIcon(name) {
    const url = lucideIcon(name);
    return `<i class="rail-icon" aria-hidden="true" style="-webkit-mask-image:url(${url});mask-image:url(${url})"></i>`;
  }

  function railButton(id, icon, label, opts = {}) {
    const active = opts.active || state.page === id || (opts.service && state.currentService === opts.service);
    const attrs = opts.service
      ? `data-service-enter="${opts.service}" data-page-target="${opts.pageTarget || ""}"`
      : `data-page="${id}"`;
    const short = opts.short || label;
    const badge = opts.badge ? `<span class="rail-badge">${safe(opts.badge)}</span>` : "";
    if (opts.code) {
      return `<button class="rail-item rail-item--code ${active ? "active" : ""}" type="button" title="${safe(label)}" aria-label="${safe(label)}" ${attrs} ${active ? 'aria-current="page"' : ""}>
        <span class="rail-code" aria-hidden="true">${safe(opts.code)}</span>
        <span class="rail-label">${safe(short)}</span>
      </button>`;
    }
    return `<button class="rail-item ${active ? "active" : ""}" type="button" title="${safe(label)}" aria-label="${safe(label)}" ${attrs} ${active ? 'aria-current="page"' : ""}>
      ${railIcon(icon)}
      <span class="rail-label">${safe(short)}</span>${badge}
    </button>`;
  }

  function syncShell() {
    const config = roleConfig[state.role];
    const crossYearPage = ["programs", "team", "org-settings", "annual-setup", ...globalCustomerPages].includes(state.page);
    const hideSecondary = isCustomer() && !state.currentService && overviewPages.has(state.page)
      && state.page !== "org-settings";
    const showSecondary = !hideSecondary;
    $("#companyName").textContent = isCustomer() ? state.organization.name : config.company;
    const companySub = isCustomer()
      ? ""
      : ["importer", "verifier", "supplier"].includes(state.role) ? "当前机构" : "当前工作区";
    const companyLabel = $("#companyContextLabel");
    if (companyLabel) {
      companyLabel.textContent = companySub;
      companyLabel.hidden = !companySub;
    }
    const mark = $("#companyMark");
    if (mark) mark.textContent = (isCustomer() ? state.organization.name : config.company).slice(0, 1);
    $("#profileName").textContent = config.name;
    $("#profileInitial").textContent = config.initial;
    $("#profileRole").textContent = config.title;
    /* 期间切换：仅 CBAM 服务频道显示；通用页（工作台/任务/资产/交付/服务目录）与设置页隐藏 */
    const showPeriod = isCustomer()
      && state.currentService === "cbam"
      && !["customer_contrib", "customer_approver"].includes(state.role)
      && !crossYearPage;
    const periodEl = $("#projectPeriod") || document.querySelector(".project-period");
    if (periodEl) periodEl.hidden = !showPeriod;
    $("#yearSelect").innerHTML = Object.keys(years).sort((a, b) => Number(b) - Number(a)).map((value) => `<option value="${value}">${value}</option>`).join("")
      + (canCreateYear() ? `<option value="new">＋ 新建</option>` : "");
    $("#yearSelect").value = state.year;
    $("#quarterSelect").value = state.quarter;
    const toneEl = $("#yearTone");
    if (toneEl) {
      const chip = years[state.year]?.chip || "active";
      const toneLabel = chip === "locked" ? "已封存" : chip === "warn" ? "待开始" : "进行中";
      toneEl.dataset.tone = chip === "locked" ? "locked" : chip === "warn" ? "warn" : "active";
      const label = toneEl.querySelector("em");
      if (label) label.textContent = toneLabel;
    }

    const rail = $("#shellRail");
    const channel = $("#sidebarChannel");
    const layout = document.querySelector(".portal-layout");
    const sidebar = $("#sidebar");
    if (isCustomer()) {
      const global = customerNavWithLiveBadges();
      const services = Object.values(serviceRegistry)
        .filter((service) => service.roles?.includes(state.role) && service.entryPage);
      const [setId, setIcon, setLabel, setShort] = customerRailExtras.settings;
      rail.innerHTML = global.map(([id, icon, label, badge, short]) => railButton(id, icon, label, {
        short: short || label,
        badge: badge || "",
      })).join("")
        + `<div class="rail-divider" aria-hidden="true"></div>`
        + services.map((service) => railButton(firstServicePage(service.id) || service.entryPage, service.code, service.name, {
          service: service.id,
          /* 一级服务轨：不带具体 page，进入后固定选中二级第一项 */
          pageTarget: "",
          active: state.currentService === service.id,
          code: service.code,
          short: service.code,
        })).join("")
        + `<span class="rail-spacer" aria-hidden="true"></span>`
        + (canManageOrganization()
          ? railButton(setId, setIcon, setLabel, { short: setShort, active: state.page === "org-settings" })
          : "");

      if (!showSecondary) {
        sidebar.hidden = true;
        layout?.classList.add("portal-layout--rail-only");
        channel.hidden = true;
        $("#roleNav").innerHTML = "";
      } else if (state.page === "org-settings" && canManageOrganization()) {
        sidebar.hidden = false;
        layout?.classList.remove("portal-layout--rail-only");
        channel.hidden = false;
        channel.innerHTML = `<p class="sidebar-channel__eyebrow">企业设置</p><strong>${safe(state.organization.name)}</strong><span>长期主档与权限</span>`;
        $("#roleNav").innerHTML = settingsNavItems.map(([id, label, badge]) => `
          <button class="nav-item ${state.settingsSection === id ? "active" : ""}" type="button" data-settings-section="${id}" ${state.settingsSection === id ? 'aria-current="page"' : ""}>
            <span class="nav-icon" aria-hidden="true">◎</span><span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ""}
          </button>`).join("");
      } else if (["shared-tasks", "shared-files", "shared-deliverables"].includes(state.page)) {
        /* 跨服务列表页：二级栏必须是分类筛选，不能回落到全局页或服务频道导航 */
        state.currentService = null;
        sidebar.hidden = false;
        layout?.classList.remove("portal-layout--rail-only");
        channel.hidden = false;
        const actor = roleConfig[state.role].name;
        if (state.page === "shared-tasks") {
          const taskView = sharedCenterViews.tasks({ role: state.role, actor });
          const waiting = taskView.items.filter((task) => /等待|供应商|回执/.test(`${task.nextStep || ""}${task.title || ""}`));
          const open = taskView.items.filter((task) => !waiting.includes(task));
          const taskFilter = state.taskTab || "open";
          channel.innerHTML = `<p class="sidebar-channel__eyebrow">跨服务</p><strong>我的任务</strong>`;
          $("#roleNav").innerHTML = [
            ["open", "inbox", "待处理", open.length],
            ["waiting", "hourglass", "等待他人", waiting.length],
            ["done", "check-circle-2", "已完成", 0],
            ["all", "layers", "全部", taskView.items.length],
          ].map(([id, icon, label, badge]) => `
            <button class="nav-item ${taskFilter === id ? "active" : ""}" type="button" data-task-tab="${id}" ${taskFilter === id ? 'aria-current="page"' : ""}>
              ${railIcon(icon)}<span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ""}
            </button>`).join("");
        } else if (state.page === "shared-files") {
          const assetView = assetViews.overview({ role: state.role, serviceId: null, facet: state.assetFacet || "attention" });
          const facet = state.assetFacet || "attention";
          channel.innerHTML = `<p class="sidebar-channel__eyebrow">跨服务</p><strong>数据资产</strong>`;
          $("#roleNav").innerHTML = assetView.facets.map(({ id, label, count }) => `
            <button class="nav-item ${facet === id ? "active" : ""}" type="button" data-asset-facet="${id}" ${facet === id ? 'aria-current="page"' : ""}>
              ${railIcon({ attention: "inbox", all: "layers", master: "building-2", activity: "activity", evidence: "file-text" }[id] || "circle")}<span>${label}</span>${count ? `<span class="nav-badge">${count}</span>` : ""}
            </button>`).join("");
        } else {
          const deliveryView = sharedCenterViews.deliverables({ role: state.role, actor });
          const df = state.delivFilter || "all";
          const countFor = (f) => deliveryView.items.filter((item) => f === "all" || (f === "mine" ? item.mine : item.serviceCode === f)).length;
          channel.innerHTML = `<p class="sidebar-channel__eyebrow">跨服务</p><strong>交付中心</strong>`;
          $("#roleNav").innerHTML = [
            ["all", "layers", "全部"],
            ["mine", "inbox", "待我处理"],
            ["CBAM", "file-check-2", "CBAM"],
            ["PCF", "file-check-2", "PCF"],
          ].map(([id, icon, label]) => {
            const badge = countFor(id);
            return `<button class="nav-item ${df === id ? "active" : ""}" type="button" data-deliv-filter="${id}" ${df === id ? 'aria-current="page"' : ""}>
              ${railIcon(icon)}<span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ""}
            </button>`;
          }).join("");
        }
      } else if (state.currentService && serviceRegistry[state.currentService]) {
        sidebar.hidden = false;
        layout?.classList.remove("portal-layout--rail-only");
        const service = serviceRegistry[state.currentService];
        channel.hidden = false;
        channel.innerHTML = `<p class="sidebar-channel__eyebrow">${safe(service.code)} · ${safe(service.statusLabel || "已开通")}</p><strong>${safe(service.name)}</strong>`;
        const nav = activeServiceNav();
        $("#roleNav").innerHTML = nav.map(([id, icon, label, badge]) => `
          <button class="nav-item ${state.page === id ? "active" : ""}" type="button" data-page="${id}" ${state.page === id ? 'aria-current="page"' : ""}>
            <span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ""}
          </button>`).join("");
      } else {
        sidebar.hidden = false;
        layout?.classList.remove("portal-layout--rail-only");
        channel.hidden = false;
        channel.innerHTML = `<p class="sidebar-channel__eyebrow">跨服务</p><strong>工作门户</strong>`;
        $("#roleNav").innerHTML = global.map(([id, icon, label, badge]) => `
          <button class="nav-item ${state.page === id ? "active" : ""}" type="button" data-page="${id}" ${state.page === id ? 'aria-current="page"' : ""}>
            ${railIcon(icon)}<span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ""}
          </button>`).join("");
      }
    } else {
      layout?.classList.remove("portal-layout--rail-only");
      sidebar.hidden = false;
      rail.innerHTML = config.nav.map(([id, icon, label]) => {
        const known = { "◉": "circle-dot", "▣": "layout-grid", "✓": "list-checks", "!": "triangle-alert", "□": "package-check", "∿": "chart-no-axes-column", "◎": "users", "→": "route", "◇": "factory", "▦": "table-2" };
        return railButton(id, known[icon] || "circle", label, { short: label.length > 4 ? label.slice(0, 4) : label });
      }).join("");
      channel.hidden = false;
      channel.innerHTML = `<p class="sidebar-channel__eyebrow">${["importer", "verifier", "supplier"].includes(state.role) ? "共享空间" : "工作队列"}</p><strong>${safe(config.title)}</strong><span>${safe(config.company)}</span>`;
      $("#roleNav").innerHTML = config.nav.map(([id, icon, label, badge]) => `
        <button class="nav-item ${state.page === id ? "active" : ""}" type="button" data-page="${id}" ${state.page === id ? 'aria-current="page"' : ""}>
          <span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ""}
        </button>`).join("");
    }

    if ($("#settingsButton")) $("#settingsButton").hidden = true;
  }

  function render() {
    syncShell();
    $("#main").classList.toggle("workspace--pcf", isCustomer() && state.currentService === "pcf");
    if (isCustomer()) renderCustomer();
    if (state.role === "expert") renderExpert();
    if (state.role === "reviewer") renderStaffSecondary("reviewer");
    if (state.role === "ops") renderOps();
    if (state.role === "sales") renderSales();
    if (["importer", "verifier", "supplier"].includes(state.role)) renderExternalRole();
    if (["support", "platform_admin"].includes(state.role)) renderPlatformRole();
    if (isCustomer()) syncCustomerUrl();
    if (typeof syncServiceOverview === "function") syncServiceOverview();
    const settingsLabel = state.page === "org-settings"
      ? settingsNavItems.find(([id]) => id === state.settingsSection)?.[1]
      : null;
    const pageLabel = settingsLabel
      || (isCustomer()
        ? [...customerGlobalNav, customerRailExtras.services, customerRailExtras.settings, ...activeServiceNav()].find(([id]) => id === state.page)?.[2]
        : roleConfig[state.role].nav.find(([id]) => id === state.page)?.[2]);
    document.title = `${pageLabel || "企业工作门户"} · Lumino`;
  }

  function yearBadge() {
    const data = years[state.year];
    return statusChip(data.short, data.chip === "warn" ? "warn" : data.chip === "locked" ? "locked" : "");
  }

  function nextAction(kicker, title, description, label, attributes, tone = "primary") {
    return `<section class="next-action" aria-label="下一步"><div><small>${kicker}</small><strong>${title}</strong><p>${description}</p></div><button class="button button--${tone}" type="button" ${attributes}>${label}<span aria-hidden="true">→</span></button></section>`;
  }

  function onboardingGuide() {
    if (state.onboardingDismissed || state.year === "2025") return "";
    return `<section class="onboarding-guide" aria-label="快速开始"><div><small>第一次使用 · 约 3 分钟</small><strong>先确认范围，再按季度收材料</strong><p>不用先学法规，也不要求先做免费试算。回答一个业务问题后，Agent 会生成下一步材料清单。</p></div><ol><li class="current"><span>1</span>回答事实</li><li><span>2</span>核对产品与工厂</li><li><span>3</span>上传本季度材料</li></ol><div class="onboarding-actions"><button class="button button--secondary" type="button" data-action="start-onboarding">开始第一个问题</button><button class="text-button" type="button" data-action="dismiss-onboarding">我先自己看看</button></div></section>`;
  }

  function formField(label, control, hint = "") {
    return `<label class="drawer-field"><span>${label}</span>${control}${hint ? `<small>${hint}</small>` : ""}</label>`;
  }

  function drawerForm(id, intro, fields, submitLabel = "保存") {
    return `<form class="drawer-form" data-drawer-form="${id}"><p class="drawer-intro">${intro}</p><div class="drawer-fields">${fields}</div><footer class="drawer-actions"><button class="button button--secondary" type="button" data-close-drawer>取消</button><button class="button button--primary" type="submit">${submitLabel}</button></footer></form>`;
  }

  function drawerTemplate(id, context = {}) {
    const commonRole = `<div class="drawer-context"><span>${iconLabel(state.role)}</span><strong>${roleConfig[state.role].name}</strong><small>${roleConfig[state.role].company}</small></div>`;
    const baseProductYears = { hrc: ["2026", "2027"], coated: ["2027"], section: ["2026", "2027"], wire: ["2027"], cold: state.productYears };
    const yearChecks = (selectedYears = []) => Object.entries(years)
      .filter(([, data]) => data.chip !== "locked")
      .map(([year]) => `<label><input type="checkbox" name="productYears" value="${year}" ${selectedYears.includes(year) ? "checked" : ""}>${year}</label>`)
      .join("");
    const newProductYearChecks = yearChecks([]);
    const managedProductYearChecks = yearChecks(state.productOverrides[state.selectedProduct]?.scope || baseProductYears[state.selectedProduct] || []);
    const facilitySelectOptions = (() => {
      const facilities = assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role, type: "facility" });
      if (!facilities.length) return "<option>上海一厂</option><option>江苏二厂</option><option>暂不确定</option>";
      return `${facilities.map((facility) => `<option value="${safe(facility.name)}" data-asset-id="${safe(facility.id)}">${safe(facility.name)}</option>`).join("")}<option>暂不确定</option>`;
    })();
    const facilityConfigOptions = (() => {
      const facilities = assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role, type: "facility" });
      if (!facilities.length) return '<option value="">请选择</option><option>上海一厂</option><option>江苏二厂</option>';
      return `<option value="">请选择</option>${facilities.map((facility) => `<option value="${safe(facility.name)}">${safe(facility.name)}</option>`).join("")}`;
    })();
    const pcfCase = workflowEngine.get("PCF-2026-001");
    const pcfCalculation = pcfCase?.metadata?.calculation || {};
    const pcfDeclaration = pcfCase?.metadata?.declaration || {};
    const pcfBoundary = pcfCase?.metadata?.boundary || {};
    const templates = {
      "upload-evidence": ["QUARTERLY EVIDENCE", `上传 ${state.year} ${state.quarter} 材料`, drawerForm("upload-evidence", "上传后先进入 Agent 提取区。只有你确认账期、设施和数值后，材料才会进入正式事实建议。", `${formField("材料类型", '<select name="type"><option>能源账单</option><option>产量台账</option><option>发运台账</option><option>供应商排放数据</option><option>其他证明</option></select>')}${formField("所属设施", `<select name="facility">${facilitySelectOptions}</select>`)}${formField("数据期间", `<input name="period" value="${state.year} ${state.quarter}" readonly>`)}<label class="upload-drop"><input name="file" type="file" required><strong>选择文件或拖到这里</strong><small>PDF、XLSX、CSV、JPG；单个文件不超过 30 MB</small></label>${formField("补充说明", '<textarea name="note" rows="3" placeholder="例如：账单同时覆盖两座设施"></textarea>')}`, "上传并交给 Agent")],
      "new-product": ["ENTERPRISE PRODUCT MASTER", "新增产品主档", drawerForm("new-product", "产品属于企业长期主档，不必绑定某一年。可以先创建，再由 Agent 或关务人员补充 CN Code。", `${formField("产品名称", '<input name="productName" value="冷轧非合金钢板" required>')}${formField("内部编码", '<input name="internalCode" value="CRS-02" required>')}${formField("CN Code 候选", '<input name="cnCodes" placeholder="如 72091690；多个用逗号分隔">', "可留空；候选不会自动成为已确认编码")}<fieldset class="drawer-field drawer-fieldset"><legend>初始年度范围（可选）</legend><div class="check-grid">${newProductYearChecks}</div><small>这里只列出已创建且未锁定的年度；也可以稍后再纳入。</small></fieldset>`, "创建产品主档")],
      "edit-product": ["PRODUCT MASTER", "编辑产品主档", drawerForm("edit-product", "主档变更会形成新版本，不覆盖锁定年度中的历史快照。", `${formField("产品名称", `<input name="productName" value="${safe(context.name || "热轧非合金钢卷")}" required>`)}${formField("内部编码", `<input name="internalCode" value="${safe(context.code || "HRC-01")}" required>`)}${formField("变更生效日", '<input name="effectiveDate" type="date" value="2026-10-10">')}${formField("变更原因", '<textarea name="reason" rows="4" required placeholder="说明为何修改产品主档"></textarea>')}`, "保存为新版本")],
      "manage-cn": ["CN CODE MANAGEMENT", "管理 CN Code", drawerForm("manage-cn", "同一企业产品可以保留多个候选编码。最终确认需要记录依据、确认人和有效期。", `<div class="code-candidate"><div><strong>72083900</strong><small>候选 · Agent 根据产品说明建议</small></div><span class="record-state warn">待关务确认</span></div><div class="code-candidate"><div><strong>72083800</strong><small>历史候选 · 2026 年使用</small></div><span class="record-state">历史</span></div>${formField("新增候选 CN Code", '<input name="cnCode" inputmode="numeric" placeholder="8 位 CN Code">')}${formField("建议依据", '<textarea name="basis" rows="3" placeholder="产品说明、材质、规格或关务意见"></textarea>')}`, "保存候选")],
      "manage-years": ["ANNUAL SCOPE", "管理适用年度", drawerForm("manage-years", "年度项目引用产品主档。纳入或移除只影响该年度范围，不删除企业产品和历史数据。", `<fieldset class="drawer-field drawer-fieldset"><legend>开放年度</legend><div class="check-grid">${managedProductYearChecks}</div></fieldset><div class="locked-row"><strong>2025 · 已锁定</strong><span>只能通过 Amendment Revision 调整</span></div>`, "更新年度范围")],
      "new-configuration": ["PRODUCTION CONFIGURATION", "新增生产配置", drawerForm("new-configuration", "同一销售产品可以按工厂、工艺和前体来源建立多条配置，分别核算后汇总。", `${formField("生产设施", `<select name="facility" required>${facilityConfigOptions}</select>`)}${formField("主要工艺", '<select name="process" required><option value="">请选择</option><option>高炉—转炉长流程</option><option>电弧炉</option><option>仅轧制/加工</option><option>暂不确定，让 Agent 询问</option></select>')}${formField("前体来源", '<select name="precursor" required><option>自产</option><option>外购</option><option>自产与外购并存</option><option>暂不确定</option></select>')}${formField("区分依据", '<input name="basis" placeholder="例如采购批次、订单号或产线">')}`, "创建配置草稿")],
      "service-scope": ["SERVICE ORDER", "申请服务范围变更", drawerForm("service-scope", "变更不会立即覆盖当前服务订单；运营确认影响、费用与 SLA 后生成新版本。", `${formField("变更类型", '<select><option>新增产品</option><option>新增设施</option><option>新增进口商</option><option>增加核查支持</option><option>其他</option></select>')}${formField("期望生效时间", '<input type="date" value="2026-11-01">')}${formField("业务原因", '<textarea rows="4" required></textarea>')}`, "提交变更申请")],
      "shipping-import": ["SHIPMENT LEDGER", "导入出口发运台账", drawerForm("shipping-import", "系统先预览列映射、重复批次和进口商范围，不会直接覆盖已对账记录。", `${formField("数据期间", `<select name="period"><option>${state.year} ${state.quarter}</option><option>${state.year} 全年</option></select>`)}<label class="upload-drop"><input name="file" type="file" accept=".xlsx,.csv" required><strong>选择 XLSX 或 CSV</strong><small>建议字段：报关单号、发运日、进口商、产品、CN Code、数量</small></label>${formField("重复记录处理", '<select name="duplicatePolicy"><option>停止并让我确认</option><option>仅导入新批次</option></select>')}`, "进入映射预览")],
      "document-preview": ["DOCUMENT PREVIEW", "交付文件预览", `<div class="document-sheet"><small>PREVIEW · NOT FOR SUBMISSION</small><h3>${state.deliveryExpanded === "emissions" ? "年度排放报告" : state.deliveryExpanded === "verification" ? "Verification Package" : "年度监测计划 / 监测报告"}</h3><dl><div><dt>企业</dt><dd>华星钢铁有限公司</dd></div><div><dt>年度</dt><dd>${state.year}</dd></div><div><dt>计算版本</dt><dd>Run 04</dd></div><div><dt>规则版本</dt><dd>EU-CBAM-${state.year}.1</dd></div><div><dt>开放缺口</dt><dd>2 项</dd></div></dl><p>正式导出前将执行字段完整性、数据血缘、制备/复核职责分离和版本锁定检查。</p></div><footer class="drawer-actions"><button class="button button--secondary" type="button" data-close-drawer>关闭</button><button class="button button--primary" type="button" data-drawer="generic-action" data-drawer-label="生成带水印 PDF">生成带水印 PDF</button></footer>`],
      "invite-member": ["ORGANIZATION ACCESS", "邀请成员", drawerForm("invite-member", "成员权限由企业、年度、设施和任务范围共同决定。邀请不会默认开放全量生产数据。", `${formField("工作邮箱", '<input name="email" type="email" required placeholder="name@company.com">')}${formField("企业角色", '<select name="role"><option>数据贡献者</option><option>项目协调人</option><option>内部审批人</option><option>企业管理员</option></select>')}${formField("数据范围", `<select name="scope"><option>仅分配给我的任务</option>${assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role, type: "facility" }).map((facility) => `<option>${safe(facility.name)}</option>`).join("")}<option>当前年度全部设施</option></select>`)}${formField("授权期限", '<input name="expiresAt" type="date" value="2027-03-31">')}`, "发送邀请")],
      "permission-audit": ["ACCESS AUDIT", "有效权限与继承来源", `<div class="audit-list"><article><span>周岚</span><strong>企业管理员 + 项目协调人</strong><p>企业角色 → 全部年度；项目角色 → SO-2026-018。最近访问：今天 09:12。</p></article><article><span>王晨</span><strong>制备专家</strong><p>服务订单授权 → 2026 年度、2 座设施；不包含成员管理和最终复核。</p></article><article><span>NordWerk GmbH</span><strong>外部接收方</strong><p>仅可下载已分享的产品与期间交付包；不可查看其他进口商或原始账单。</p></article></div>`],
      "organization-edit": ["ENTERPRISE MASTER", "编辑企业资料", drawerForm("organization-edit", "企业资料属于长期主档。变更按生效日期形成版本，锁定年度继续引用原快照。", `${formField("法定名称", `<input name="organizationName" value="${safe(state.organization.name)}" required>`)}${formField("统一社会信用代码", `<input name="organizationCode" value="${safe(state.organization.code)}" required>`)}${formField("注册地址", `<textarea name="organizationAddress" rows="3">${safe(state.organization.address)}</textarea>`)}${formField("生效日期", '<input name="effectiveDate" type="date" value="2026-10-10">')}`, "保存企业主档版本")],
      "new-facility": ["FACILITY MASTER", "新建生产设施", drawerForm("new-facility", "设施先进入企业主档，再选择纳入哪些年度项目。年度产量和能耗不会随设施主档复制。", `${formField("设施名称", '<input name="facilityName" required placeholder="例如：广东三厂">')}${formField("内部编码", '<input name="facilityCode" required placeholder="例如：GD-03">')}${formField("地址", '<textarea name="address" rows="3" required></textarea>')}${formField("主要生产活动", '<input name="activity" placeholder="例如：电弧炉炼钢与热轧">')}${formField("初始状态", '<select name="status"><option>在建</option><option>试生产</option><option>在用</option></select>')}`, "创建设施主档")],
      "workflow-detail": (() => {
        const flow = workflowView(context.flow || "quarterlyPackage", workflowStates[context.flow] || workflowStates.quarterlyPackage);
        const currentIndex = flow.states.indexOf(flow.current);
        const allowed = flow.object ? workflowEngine.allowedTransitions(flow.object.id) : [];
        const events = flow.object ? workflowEngine.events({ objectId: flow.object.id }).slice(0, 4) : [];
        const audit = events.length ? events.map((item) => `<article><span>${safe(new Date(item.at).toLocaleString("zh-CN", { hour12: false }))}</span><strong>${safe(item.from ? `${workflowStateLabel(item.from)} → ${workflowStateLabel(item.to)}` : `创建为${workflowStateLabel(item.to)}`)}</strong><p>${safe(item.actor)} · ${safe(item.reason)} · Rev ${item.objectRevision}</p></article>`).join("") : "<p>暂无审计事件。</p>";
        const advance = allowed.length ? `<button class="button button--primary" type="button" data-action="advance-workflow" data-flow="${safe(context.flow)}" data-target="${safe(allowed[0])}">推进至${safe(workflowStateLabel(allowed[0]))}</button>` : "";
        return ["STATE & RESPONSIBILITY", flow.label, `<div class="detail-ledger">${commonRole}<dl><div><dt>对象 ID</dt><dd>${safe(flow.object?.id || "尚未建立")}</dd></div><div><dt>对象粒度</dt><dd>${safe(flow.cadence)}</dd></div><div><dt>当前状态</dt><dd>${safe(workflowStateLabel(flow.current))} · Rev ${flow.object?.revision || "-"}</dd></div><div><dt>负责人</dt><dd>${safe(flow.object?.owner || "未分配")}</dd></div><div><dt>更新时间</dt><dd>${safe(flow.object ? new Date(flow.object.updatedAt).toLocaleString("zh-CN", { hour12: false }) : "-")}</dd></div><div><dt>下一动作</dt><dd>${safe(flow.next)}</dd></div></dl><section><strong>状态路径</strong><ol class="state-sequence">${flow.states.map((item, index) => `<li class="${index < currentIndex ? "done" : index === currentIndex ? "current" : ""}"><span>${index < currentIndex ? "✓" : index + 1}</span><div><strong>${safe(workflowStateLabel(item))}</strong><small>${safe(item)}</small></div></li>`).join("")}</ol></section><section><strong>最近审计记录</strong><div class="audit-list compact">${audit}</div></section><section><strong>控制原则</strong><p>只允许执行当前状态定义的迁移；每次变更保留操作者、理由、时间和版本。接收、锁定等关键状态还需要回执或快照 ID。</p></section></div><footer class="drawer-actions"><button class="button button--secondary" type="button" data-close-drawer>关闭</button>${advance}</footer>`];
      })(),
      "resources": ["GLOBAL RESOURCES", "资源中心", `<div class="resource-list"><a href="/calculator"><strong>CBAM 成本试算工具</strong><span>打开公开工具 →</span></a><a href="/knowledge/article?id=cbam-hs-cn-codes"><strong>CBAM 操作指南</strong><span>查看知识文章 →</span></a><button type="button" data-page="shared-files"><strong>企业数据资产</strong><span>查看已授权资产与服务使用 →</span></button></div>`],
      "service-consultation": ["SERVICE CONSULTATION", `咨询${safe(serviceRegistry[context.serviceId]?.name || "专业服务")}`, drawerForm("service-consultation", "我们会把当前企业、账号角色和服务类型一并带给顾问；不会为尚未开放的服务创建工作空间。", `<input type="hidden" name="serviceId" value="${safe(context.serviceId || "")}">${formField("需求说明", '<textarea name="needs" rows="5" required placeholder="希望解决的问题、涉及产品或交付时间"></textarea>')}${formField("期望联系时间", '<input name="preferredAt" type="datetime-local" required>')}${formField("联系电话", '<input name="phone" type="tel" placeholder="电话或手机号码">')}${formField("联系邮箱", '<input name="email" type="email" placeholder="name@company.com">', "电话或邮箱至少填写一项")}`, "提交咨询")],
      "pcf-upload": ["PCF DATA PACK", "回传 PCF 数据包", drawerForm("pcf-upload", "请回传完整 Excel 模板，并可同时附上账单、台账和供应商声明。系统先校验表结构、单位、期间和证据引用；确认前不会进入正式计算。", `<div class="drawer-template-link"><div><span>项目模板 · HRC-01 · V1.0</span><strong>还没有填写模板？</strong><small>模板已预填产品、核算期、功能单位和系统边界。</small></div><a class="button button--secondary" href="../outputs/pcf-template/Lumino_PCF_%E6%95%B0%E6%8D%AE%E9%87%87%E9%9B%86%E6%A8%A1%E6%9D%BF_HRC-01.xlsx" download>下载模板</a></div><input type="hidden" name="templateVersion" value="PCF-DATA-PACK-1.0">${formField("核算期间", '<input name="period" value="2026-01-01 至 2026-09-30" readonly>')}${formField("演示校验场景", '<select name="validationScenario"><option value="valid">正常通过</option><option value="structure_error">结构错误（缺表／改名）</option><option value="unit_error">单位错误</option><option value="missing_evidence">缺证据引用</option><option value="partial">部分通过（能源缺口）</option></select>', "原型专用：用于验证失败恢复路径，不代表生产上传选项。")}<label class="upload-drop"><input name="file" type="file" accept=".xlsx" required><strong>选择已填写的 Excel 模板</strong><small>必须保留原工作表名称和字段结构</small></label><label class="upload-drop upload-drop--secondary"><input name="supportFiles" type="file" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png" multiple><strong>添加证明材料（可多选）</strong><small>账单、ERP 导出、采购或物流台账、供应商 PCF / EPD</small></label>${formField("回传说明", '<textarea name="note" rows="3" placeholder="例如：采购和能源数据已完成，供应商 PCF 尚在收集中"></textarea>')}`, "上传并开始校验")],
      "pcf-report-preview": ["PCF REPORT PREVIEW", "产品碳足迹报告预览", `<div class="document-sheet"><small>PREVIEW · ${pcfCase?.status === "DELIVERABLE_READY" ? "REV 1" : "DRAFT"} · ${pcfCalculation.formalUseAllowed ? "CONTROLLED INPUTS" : "DEMO INPUTS"}</small><h3>${safe(pcfDeclaration.productName || "热轧非合金钢卷")}产品碳足迹报告</h3><dl><div><dt>核算声明</dt><dd>${safe(pcfDeclaration.goal || "客户披露与供应链响应")}</dd></div><div><dt>系统边界</dt><dd>${safe(pcfBoundary.boundaryType || pcfCalculation.boundaryType || "尚未确认")}</dd></div><div><dt>功能单位</dt><dd>${safe(pcfDeclaration.functionalUnit || pcfCalculation.functionalUnit || "尚未确认")}</dd></div><div><dt>结果</dt><dd>${pcfCalculation.total != null ? `${safe(pcfCalculation.total)} ${safe(pcfCalculation.unit)}` : "尚未生成计算结果"}</dd></div><div><dt>计算版本</dt><dd>${safe(pcfCalculation.runId || "尚未运行")} · ${safe(pcfCalculation.ruleVersion || "—")}</dd></div></dl><p>${pcfCalculation.formalUseAllowed ? "正式交付前仍需完成独立复核、方法说明和证据完整性检查。" : "当前结果含演示清单输入，仅用于验证计算与报告流程，不可用于正式披露或对外交付。"}</p></div>`],
      "generic-action": [context.eyebrow || "ACTION", context.title || "完成操作", drawerForm("generic-action", context.description || "补充必要信息后执行。动作、理由和影响范围会写入审计记录。", `${commonRole}${formField(context.fieldLabel || "处理说明", `<textarea rows="4" required placeholder="${context.placeholder || "说明处理内容或判断依据"}"></textarea>`)}${formField("责任人", '<select><option>我负责</option><option>转交项目协调人</option><option>转交制备专家</option><option>转交运营</option></select>')}${formField("期望完成时间", '<input type="date" value="2026-10-15">')}`, context.submitLabel || "确认并记录")],
      "record-detail": [context.eyebrow || "DETAIL", context.title || "记录详情", drawerShell({
        kind: context.eyebrow || "DETAIL",
        name: context.title || "记录详情",
        version: context.object || `华星钢铁 · ${state.year}`,
        status: context.status || "处理中",
        usage: context.scope || "当前服务订单与已授权数据",
        source: `负责人 ${context.owner || roleConfig[state.role].name} · 最近更新 今天 09:20`,
        body: `${commonRole}<section class="drawer-shell__block"><span>当前需要处理</span><p>${context.description || "查看记录、确认下一步，并保留处理依据。"}</p></section>`,
        primary: context.action
          ? { label: context.action, attrs: `data-drawer="generic-action" data-drawer-label="${safe(context.action)}"` }
          : null,
      })],
      "calc-run-detail": (() => {
        const run = cbamRunDetail(context.runId || "Run-0412");
        const fields = run.fields.map(([k, v]) => `<div><dt>${safe(k)}</dt><dd>${safe(v)}</dd></div>`).join("");
        const inputs = run.inputs.map((row) => `
          <li class="cbam-snapshot__row ${row.warn ? "is-warn" : ""}">
            <span><strong>${safe(row.k)}</strong><small>${safe(row.note)}</small></span>
            <b>${safe(row.v)}</b>
          </li>`).join("");
        const events = (run.events || []).map((e) => `
          <li class="drawer-timeline__item ${e.tone || ""}">
            <i aria-hidden="true"></i>
            <span><strong>${safe(e.t)}</strong><small>${safe(e.d)}</small></span>
          </li>`).join("");
        return ["CBAM · 计算版本", run.title, `
          <div class="drawer-detail" data-template="T3">
            <p class="drawer-detail__sub">${safe(run.state)} · ${safe(run.source)}</p>
            <dl class="drawer-kv">${fields}</dl>
            <section class="drawer-shell__block"><span>锁定输入快照</span>
              <ul class="cbam-snapshot cbam-snapshot--bordered">${inputs}</ul>
            </section>
            ${events ? `<section class="drawer-shell__block"><span>版本记录</span><ol class="drawer-timeline">${events}</ol></section>` : ""}
            <p class="drawer-note">${safe(run.note)}</p>
            <footer class="drawer-actions">
              <button class="button button--secondary" type="button" data-close-drawer>关闭</button>
              ${run.secondary ? `<button class="button button--secondary" type="button" ${run.secondary.attrs}>${safe(run.secondary.label)}</button>` : ""}
              ${run.primary ? `<button class="button button--primary" type="button" ${run.primary.attrs}>${safe(run.primary.label)}</button>` : ""}
            </footer>
          </div>`];
      })(),
      "calc-rerun": (() => {
        const snap = cbamCalcSnapshot();
        const ready = snap.every((row) => !row.warn);
        const rows = snap.map((row) => `
          <li class="cbam-snapshot__row ${row.warn ? "is-warn" : ""}">
            <span><strong>${safe(row.k)}</strong><small>${safe(row.note)}</small></span>
            <b>${safe(row.v)}</b>
          </li>`).join("");
        return ["CBAM · 重新计算", "重新计算 Q3 隐含排放", `
          <div class="drawer-detail" data-template="T3">
            <p class="drawer-lead">计算会先锁定以下输入版本作为快照，再生成新版本 Run-0418。Run-0412 保留为历史记录，可随时对照。</p>
            <ul class="cbam-snapshot cbam-snapshot--bordered">${rows}</ul>
            <p class="drawer-note">规则包 CBAM 2026.3 · 证书价格 2026 Q3 €82.32。计算完成后进入 Lumino 专家复核，你会收到通知。${ready ? "" : "当前仍有未齐输入，演示中仍可预览流程。"}</p>
            <footer class="drawer-actions">
              <button class="button button--secondary" type="button" data-close-drawer>关闭</button>
              <button class="button button--primary" type="button" data-action="demo-calc-rerun">确认并开始计算</button>
            </footer>
          </div>`];
      })(),
      "extract-energy": (() => {
        const rows = [
          ["7 月 购入电力", "电力账单 7 月 · 第 1 页", "4,120 MWh", false],
          ["8 月 购入电力", "电力账单 8 月 · 第 1 页", "4,260 MWh", false],
          ["9 月 购入电力", "电力账单 9 月 · 含 8 月补抄", "4,100 MWh", true],
          ["Q3 天然气", "天然气计量表 · 汇总行", "1.86 百万 m³", false],
        ].map(([k, src, v, flag]) => `
          <li class="cbam-extract__row ${flag ? "is-warn" : ""}">
            <span><strong>${safe(k)}</strong><small>${safe(src)}</small></span>
            <b>${safe(v)}</b>
            <button class="text-button" type="button" data-action="demo-fix-field" data-field="${safe(k)}">修正</button>
          </li>`).join("");
        return ["CBAM · 能源确认", "核对 Q3 能源用量", `
          <div class="drawer-detail" data-template="T3">
            <p class="drawer-lead">Agent 从你上传的文件中提取了以下用量。逐项核对，有误的点“修正”。</p>
            <ul class="cbam-extract">${rows}</ul>
            <p class="drawer-note">确认后生成企业事实新版本，并用于 Q3 计算；依赖旧版本的计算会标记为需要重算。</p>
            <footer class="drawer-actions">
              <button class="button button--secondary" type="button" data-close-drawer>关闭</button>
              <button class="button button--primary" type="button" data-action="confirm-fact">确认提取结果</button>
            </footer>
          </div>`];
      })(),
      "extract-output": (() => {
        const rows = [
          ["热轧非合金钢卷 · Q3 产量", "生产月报 7–9 月.xlsx · 汇总表", "38,400 t"],
          ["其中出口欧盟", "发运台账 · NordWerk", "12,000 t"],
          ["产品 CN Code", "产品主档 · 已确认", "7208 39 00"],
        ].map(([k, src, v]) => `
          <li class="cbam-extract__row">
            <span><strong>${safe(k)}</strong><small>${safe(src)}</small></span>
            <b>${safe(v)}</b>
            <button class="text-button" type="button" data-action="demo-fix-field" data-field="${safe(k)}">修正</button>
          </li>`).join("");
        return ["CBAM · 产量确认", "确认 Q3 产量提取结果", `
          <div class="drawer-detail" data-template="T3">
            <p class="drawer-lead">Agent 从生产月报 7–9 月提取了产量与出口量。确认后用于 Q3 计算的分母。</p>
            <ul class="cbam-extract">${rows}</ul>
            <p class="drawer-note">确认后生成企业事实新版本，并用于 Q3 计算；依赖旧版本的计算会标记为需要重算。</p>
            <footer class="drawer-actions">
              <button class="button button--secondary" type="button" data-close-drawer>关闭</button>
              <button class="button button--primary" type="button" data-action="confirm-output">确认提取结果</button>
            </footer>
          </div>`];
      })(),
      "cbam-data-item": (() => {
        const item = cbamDataItemDetail(context.itemId || "out-cn");
        const fields = item.fields.map(([k, v]) => `<div><dt>${safe(k)}</dt><dd>${safe(v)}</dd></div>`).join("");
        const history = item.history.map((h) => `
          <li class="cbam-data-history__row">
            <b>${safe(h.v)}</b>
            <span>${safe(h.t)}</span>
            <small>${safe(h.d)}</small>
          </li>`).join("");
        return [`CBAM · ${item.cat}`, item.name, `
          <div class="drawer-detail" data-template="T3">
            <dl class="drawer-kv">${fields}</dl>
            <section class="drawer-shell__block"><span>版本记录</span>
              <ul class="cbam-data-history">${history}</ul>
            </section>
            <p class="drawer-note">${safe(item.note)}</p>
            <footer class="drawer-actions">
              <button class="button button--secondary" type="button" data-close-drawer>关闭</button>
            </footer>
          </div>`];
      })(),
      "cbam-deliv-detail": (() => {
        const item = cbamDelivDetail(context.delivId || "q3");
        const fields = item.fields.map(([k, v]) => `<div><dt>${safe(k)}</dt><dd>${safe(v)}</dd></div>`).join("");
        const events = item.events.map((e) => `
          <li class="drawer-timeline__item ${e.tone || ""}">
            <i aria-hidden="true"></i>
            <span><strong>${safe(e.t)}</strong><small>${safe(e.d)}</small></span>
          </li>`).join("");
        return [`${item.svc} · 交付物`, item.name, `
          <div class="drawer-detail" data-template="T3">
            <p class="drawer-detail__sub">${safe(item.when)}</p>
            <dl class="drawer-kv">${fields}</dl>
            <section class="drawer-shell__block"><span>记录</span>
              <ol class="drawer-timeline">${events}</ol>
            </section>
            ${item.note ? `<p class="drawer-note">${safe(item.note)}</p>` : ""}
            <footer class="drawer-actions">
              <button class="button button--secondary" type="button" data-close-drawer>关闭</button>
              ${item.primary ? `<button class="button button--primary" type="button" ${item.primary.attrs}>${safe(item.primary.label)}</button>` : ""}
            </footer>
          </div>`];
      })(),
      "cbam-package": ["CBAM · PKG-2026-Q3", "检查并共享 Q3 数据包", `
        <div class="drawer-detail" data-template="T3">
          <p class="drawer-detail__sub">${state.findingResolved ? "已就绪 · 待共享" : "草稿 · 未就绪"} · Rev 1</p>
          <p class="drawer-lead">数据包将共享给 NordWerk GmbH 的 Anna。对方只能看到包内文件，回执会显示在交付中心。</p>
          <ul class="drawer-file-list">
            <li>Q3 隐含排放汇总 · 热轧非合金钢卷</li>
            <li>计算方法与数据来源说明</li>
            <li>${state.findingResolved ? "前体路径说明 · 受控默认值" : "前体缺口说明 · 待处理"}</li>
          </ul>
          <p class="drawer-note">“已共享”不等于对方已接收，需等待回执；也不代表欧盟申报已完成。本演示不真正发送。</p>
          <footer class="drawer-actions">
            <button class="button button--secondary" type="button" data-close-drawer>关闭</button>
            ${state.findingResolved
              ? `<button class="button button--primary" type="button" data-action="demo-share-package">确认共享（演示）</button>`
              : `<button class="button button--primary" type="button" data-page="work">先完成计算前置</button>`}
          </footer>
        </div>`],
      "asset-detail": (() => {
        const asset = assetRegistry.get(context.assetId);
        return ["ENTERPRISE DATA ASSET", asset?.name || context.title || "数据资产详情", assetDetailHtml(context.assetId)];
      })(),
      "asset-impact": (() => {
        const asset = assetRegistry.get(context.assetId);
        return ["REVISION IMPACT", asset ? `修订影响 · ${asset.name}` : "修订影响预览", assetImpactPreviewHtml(context.assetId)];
      })(),
    };
    return templates[id] || templates["record-detail"];
  }

  function cbamDataItemDetail(itemId) {
    const catalog = {
      "out-qty": {
        cat: "产量", name: "热轧非合金钢卷 · Q3 产量",
        fields: [["Q3 数值", state.outputConfirmed ? "38,400 t" : "38,400 t（待确认）"], ["来源", "生产月报 7–9 月.xlsx"], ["确认人", state.outputConfirmed ? "周岚 · 今天" : "—"], ["被谁使用", "Q3 计算 · NordWerk 数据包"]],
        history: [{ v: "v1", t: state.outputConfirmed ? "Agent 提取，周岚确认" : "Agent 已提取，待确认", d: "今天" }],
      },
      "out-cn": {
        cat: "产量", name: "产品 CN Code",
        fields: [["Q3 数值", "7208 39 00"], ["来源", "产品主档 v2"], ["确认人", "周岚 · 10 月 12 日"], ["被谁使用", "Q3 计算 · NordWerk 数据包"]],
        history: [{ v: "v2", t: "关务确认 CN Code", d: "10 月 12 日" }, { v: "v1", t: "Agent 建议候选", d: "9 月 20 日" }],
      },
      "en-power": {
        cat: "能源", name: "购入电力",
        fields: [["Q3 数值", state.factConfirmed ? "12,480 MWh" : "—"], ["来源", state.uploadAdded ? "电力账单 7–9 月" : "未上传"], ["确认人", state.factConfirmed ? "周岚 · 今天" : "—"], ["被谁使用", "Q3 计算间接排放"]],
        history: state.factConfirmed
          ? [{ v: "v3", t: "企业已确认", d: "今天" }, { v: "v2", t: "中期预估", d: "10 月 15 日" }]
          : [{ v: "—", t: "等待上传或确认", d: "—" }],
      },
      "en-gas": {
        cat: "能源", name: "天然气",
        fields: [["Q3 数值", state.factConfirmed ? "1.86 百万 m³" : "—"], ["来源", state.uploadAdded ? "天然气计量表" : "未上传"], ["确认人", state.factConfirmed ? "周岚 · 今天" : "—"], ["被谁使用", "Q3 计算直接排放"]],
        history: state.factConfirmed
          ? [{ v: "v1", t: "企业已确认", d: "今天" }]
          : [{ v: "—", t: "等待上传或确认", d: "—" }],
      },
      "en-diesel": {
        cat: "能源", name: "厂内运输柴油",
        fields: [["Q3 数值", state.dieselDone ? "6.2 t" : "—"], ["来源", state.dieselDone ? "叉车柴油台账 Q3" : "未提供"], ["确认人", state.dieselDone ? "周岚" : "—"], ["被谁使用", "可选 · 直接排放 / PCF 可引用"]],
        history: [{ v: "—", t: "可选数据，不阻塞 Q3 计算", d: "—" }],
      },
      "ship-nord": {
        cat: "发运", name: "发往 NordWerk GmbH",
        fields: [["Q3 数值", "12,000 t"], ["来源", "发运台账 Q3"], ["确认人", "周岚 · 10 月 12 日"], ["被谁使用", "Q3 计算 · 出口隐含排放"]],
        history: [{ v: "v1", t: "Agent 提取，周岚确认", d: "10 月 12 日" }],
      },
      "ship-docs": {
        cat: "发运", name: "报关与提单",
        fields: [["Q3 数值", "3 份"], ["来源", "报关单 / 提单 PDF"], ["确认人", "周岚 · 10 月 12 日"], ["被谁使用", "NordWerk 数据包附件"]],
        history: [{ v: "v1", t: "材料已归档", d: "10 月 12 日" }],
      },
      "pre-emiss": {
        cat: "前体", name: "钢坯实测排放 · 北方特钢",
        fields: [["Q3 数值", state.findingResolved ? "1.85 tCO₂e/t" : "—"], ["来源", state.findingResolved ? "EU 默认值表 3" : "北方特钢 · 未提供"], ["确认人", state.findingResolved ? "周岚 · 路径已选定" : "—"], ["被谁使用", "Q3 计算前体排放"]],
        history: state.findingResolved
          ? [{ v: "默认", t: "受控默认值 · 专家复核中", d: "今天" }]
          : [{ v: "—", t: "缺口未处理", d: "已逾期 3 天" }],
      },
      "pre-qty": {
        cat: "前体", name: "钢坯采购量",
        fields: [["Q3 数值", "41,000 t"], ["来源", "采购台账 Q3"], ["确认人", "周岚 · 10 月 12 日"], ["被谁使用", "Q3 计算前体分配"]],
        history: [{ v: "v1", t: "Agent 提取，周岚确认", d: "10 月 12 日" }],
      },
    };
    const item = catalog[itemId] || catalog["out-cn"];
    return {
      ...item,
      note: "已确认数据只能通过新版本修改；修改后依赖它的计算会标记为需要重算。",
    };
  }

  function cbamCalcSnapshot() {
    const fndOk = state.findingResolved;
    const energyDone = state.uploadAdded && state.factConfirmed;
    const outputDone = Boolean(state.outputConfirmed);
    return [
      { k: "上海一厂购入电力", v: energyDone ? "v3 · 12,480 MWh" : "v2 · 12,100 MWh", note: energyDone ? "企业已确认" : "电力 v2 · 已过期", warn: !energyDone },
      { k: "上海一厂天然气", v: "v1 · 1.86 百万 m³", note: "企业已确认", warn: false },
      { k: "热轧非合金钢卷 Q3 产量", v: outputDone ? "v1 · 38,400 t" : "预估 · 38,000 t", note: outputDone ? "企业已确认" : "Agent 已提取，待你确认", warn: !outputDone },
      { k: "发往 NordWerk", v: outputDone ? "v1 · 12,000 t" : "预估 · 12,000 t", note: outputDone ? "企业已确认" : "待产量一并确认", warn: !outputDone },
      { k: "前体排放 · 钢坯", v: fndOk ? "默认值 1.85" : "—", note: fndOk ? "受控默认值 · 专家复核中" : "缺口未处理，无法锁定", warn: !fndOk },
    ];
  }

  function cbamRunDetail(runId) {
    const catalog = {
      "Run-0418": {
        id: "Run-0418",
        title: "Q3 正式输入 · 电力 v3、产量 v1、前体默认值",
        state: "当前 · 专家复核中",
        usage: "写入 NordWerk Q3 数据包 · 热轧非合金钢卷",
        source: "今天 · 周岚 发起 · 规则包 CBAM 2026.3",
        fields: [
          ["计算版本", "Run-0418"],
          ["产品", "热轧非合金钢卷 · CN 7208 39 00"],
          ["出口量", "12,000 t · NordWerk GmbH"],
          ["证书价格", "2026 Q3 · €82.32 / tCO₂e"],
          ["当前适用情景", "前体默认 + 自身实测"],
          ["隐含排放合计", "2.44 tCO₂e / t"],
          ["预估证书成本", "€240.0 万"],
        ],
        inputs: cbamCalcSnapshot().map((row) => ({ ...row, warn: false, note: row.k.includes("前体") ? "受控默认值 · 专家复核中" : "企业已确认" })),
        events: [
          { t: "锁定输入并开始计算", d: "今天 · 周岚" },
          { t: "计算结果生成", d: "今天 · 系统", tone: "is-now" },
          { t: "等待专家王晨复核", d: "—", tone: "is-wait" },
        ],
        note: "正式结果需经 Lumino 专家王晨复核后写入数据包。新证据到达后应重新计算，生成新版本而不覆盖本记录。",
        primary: { label: "去完成数据包", attrs: 'data-page="work"' },
        secondary: { label: "对照重新计算", attrs: 'data-drawer="calc-rerun"' },
      },
      "Run-0412": {
        id: "Run-0412",
        title: "Q3 中期 · 电力 v2、产量预估",
        state: state.findingResolved ? "已被替代" : "预估 · 数据未齐",
        usage: "演示对照基线 · 不可写入正式数据包",
        source: "10 月 15 日 · 周岚 发起 · 规则包 CBAM 2026.3",
        fields: [
          ["计算版本", "Run-0412"],
          ["产品", "热轧非合金钢卷 · CN 7208 39 00"],
          ["出口量", "12,000 t · NordWerk GmbH"],
          ["证书价格", "2026 Q3 · €82.32 / tCO₂e"],
          ["当前适用情景", "前体默认 + 自身实测（预估）"],
          ["隐含排放合计", "2.43 tCO₂e / t"],
          ["预估证书成本", "€240.0 万"],
        ],
        inputs: [
          { k: "上海一厂购入电力", v: "v2 · 12,100 MWh", note: state.uploadAdded && state.factConfirmed ? "已被 v3 替代" : "预估输入", warn: true },
          { k: "上海一厂天然气", v: "v1 · 1.86 百万 m³", note: "企业已确认", warn: false },
          { k: "热轧非合金钢卷 Q3 产量", v: "预估 · 38,000 t", note: state.outputConfirmed ? "已被 38,400 t 替代" : "待确认", warn: true },
          { k: "发往 NordWerk", v: "v1 · 12,000 t", note: "企业已确认", warn: false },
          { k: "前体排放 · 钢坯", v: state.findingResolved ? "默认值 1.85" : "缺口", note: state.findingResolved ? "路径已选定" : "当时未处理", warn: !state.findingResolved },
        ],
        events: [
          { t: "中期预估计算", d: "10 月 15 日 · 周岚", tone: "is-now" },
          { t: "等待输入齐全后重算", d: "—", tone: "is-wait" },
        ],
        note: "预估版本仅供进度对照。输入更新后需重新计算；不会覆盖本历史记录。",
        primary: state.findingResolved
          ? { label: "对照重新计算", attrs: 'data-drawer="calc-rerun"' }
          : { label: "去处理阻塞项", attrs: 'data-page="work"' },
        secondary: state.findingResolved ? null : { label: "对照重新计算", attrs: 'data-drawer="calc-rerun"' },
      },
      "Run-0405": {
        id: "Run-0405",
        title: "Q3 首次预估 · 仅 7 月数据",
        state: "已被替代",
        usage: "早期预估 · 不可用于交付",
        source: "9 月 30 日 · Agent 自动 · 规则包 CBAM 2026.3",
        fields: [
          ["计算版本", "Run-0405"],
          ["产品", "热轧非合金钢卷 · CN 7208 39 00"],
          ["数据覆盖", "仅 7 月能源与产量"],
          ["证书价格", "2026 Q3 · €82.32 / tCO₂e"],
          ["隐含排放合计", "约 2.55 tCO₂e / t（粗估）"],
        ],
        inputs: [
          { k: "购入电力", v: "7 月账单 · 局部", note: "不完整", warn: true },
          { k: "产量", v: "7 月月报", note: "不完整", warn: true },
          { k: "前体排放 · 钢坯", v: "EU 默认值表 3", note: "参考", warn: false },
        ],
        events: [
          { t: "Agent 自动预估", d: "9 月 30 日", tone: "is-now" },
          { t: "已被 Run-0412 替代", d: "10 月 15 日" },
        ],
        note: "首次自动预估已被后续版本替代，保留供审计对照。",
        primary: null,
        secondary: null,
      },
    };
    return catalog[runId] || catalog["Run-0412"];
  }

  function cbamDelivDetail(delivId) {
    const ready = state.findingResolved;
    const catalog = {
      q3: {
        id: "q3", svc: "CBAM", name: "2026 Q3 数据包 · 热轧非合金钢卷",
        code: "PKG-2026-Q3-NORDWERK · Rev 1", to: "NordWerk GmbH · Anna",
        when: "截止 10 月 31 日", state: ready ? "已就绪 · 待共享" : "草稿 · 未就绪",
        fields: [
          ["服务", "CBAM"],
          ["编号", "PKG-2026-Q3-NORDWERK · Rev 1"],
          ["接收方", "NordWerk GmbH · Anna"],
          ["当前状态", ready ? "已就绪 · 待共享" : "草稿 · 未就绪"],
        ],
        events: ready
          ? [
              { t: "生成草稿 · 基于 Run-0412", d: "10 月 15 日 · 系统" },
              { t: "计算更新为 Run-0418", d: "今天 · 周岚 发起", tone: "is-now" },
              { t: "等待共享", d: "—", tone: "is-wait" },
            ]
          : [
              { t: "生成草稿 · 基于 Run-0412", d: "10 月 15 日 · 系统", tone: "is-now" },
              { t: "等待 Q3 计算完成", d: "—", tone: "is-wait" },
            ],
        note: ready
          ? "就绪后可共享给进口商；“已共享”不等于已接收，需等待回执。"
          : "需要先处理前体数据缺口、确认 Q3 能源与产量，并在「计算与成本」重新计算。完成后即可共享给 NordWerk GmbH。",
        primary: ready
          ? { label: "检查并共享", attrs: 'data-drawer="cbam-package"' }
          : { label: "去处理前置任务", attrs: 'data-page="work"' },
      },
      q2: {
        id: "q2", svc: "CBAM", name: "2026 Q2 数据包 · 热轧非合金钢卷",
        code: "PKG-2026-Q2-NORDWERK · Rev 2", to: "NordWerk GmbH · Anna",
        when: "8 月 4 日回执", state: "已回执",
        fields: [["服务", "CBAM"], ["编号", "PKG-2026-Q2-NORDWERK · Rev 2"], ["接收方", "NordWerk GmbH · Anna"], ["当前状态", "已回执"]],
        events: [
          { t: "Rev 1 共享", d: "7 月 28 日" },
          { t: "进口商提问：天然气单位", d: "7 月 30 日" },
          { t: "Rev 2 更正后共享", d: "8 月 2 日" },
          { t: "Anna 确认收到 Rev 2", d: "8 月 4 日", tone: "is-now" },
        ],
        note: "回执只表示进口商已收到数据包，不代表其已完成欧盟 CBAM 申报。",
        primary: null,
      },
      q1: {
        id: "q1", svc: "CBAM", name: "2026 Q1 数据包 · 热轧非合金钢卷",
        code: "PKG-2026-Q1-NORDWERK · Rev 1", to: "NordWerk GmbH · Anna",
        when: "4 月 26 日回执", state: "已回执",
        fields: [["服务", "CBAM"], ["编号", "PKG-2026-Q1-NORDWERK · Rev 1"], ["接收方", "NordWerk GmbH · Anna"], ["当前状态", "已回执"]],
        events: [
          { t: "共享给 NordWerk", d: "4 月 22 日" },
          { t: "Anna 确认收到", d: "4 月 26 日", tone: "is-now" },
        ],
        note: null,
        primary: null,
      },
      q4: {
        id: "q4", svc: "CBAM", name: "2026 Q4 数据包 · 热轧非合金钢卷",
        code: "PKG-2026-Q4-NORDWERK", to: "NordWerk GmbH",
        when: "Q4 开始后生成", state: "未开始",
        fields: [["服务", "CBAM"], ["编号", "尚未生成"], ["接收方", "NordWerk GmbH"], ["当前状态", "未开始"]],
        events: [{ t: "Q4 尚未开始", d: "—", tone: "is-wait" }],
        note: "季度数据包按进口商与季度生成，不从上一季复制计算结果。",
        primary: null,
      },
      mp26: {
        id: "mp26", svc: "CBAM", name: "2026 年度监测计划",
        code: "MP-2026 · Rev 3", to: "内部 · 已适用",
        when: "本年度方法已建立", state: "当前适用",
        fields: [["服务", "CBAM"], ["编号", "MP-2026 · Rev 3"], ["接收方", "内部"], ["当前状态", "当前适用"]],
        events: [
          { t: "Rev 1 草稿", d: "2026-01-12" },
          { t: "Rev 3 适用本年度方法", d: "2026-03-02", tone: "is-now" },
        ],
        note: "监测计划定义全年一致的方法、职责与控制；季度包不会替代它。",
        primary: null,
      },
      aer26: {
        id: "aer26", svc: "CBAM", name: "2026 年度排放报告",
        code: "AER-2026 · 尚未生成", to: "Veritas Climate · 核查",
        when: "Q4 数据确认后开始", state: "未开始",
        fields: [["服务", "CBAM"], ["编号", "尚未生成"], ["接收方", "Veritas Climate"], ["当前状态", "未开始"]],
        events: [{ t: "Q1–Q4 数据确认后生成", d: "—", tone: "is-wait" }],
        note: "年度排放报告按设施形成，季度数据包不能替代。",
        primary: null,
      },
      ver26: {
        id: "ver26", svc: "CBAM", name: "设施核查报告",
        code: "尚未生成", to: "第三方核查员",
        when: "年度报告批准后", state: "未开始",
        fields: [["服务", "CBAM"], ["编号", "尚未生成"], ["接收方", "第三方核查员"], ["当前状态", "未开始"]],
        events: [{ t: "年度报告批准后启动", d: "—", tone: "is-wait" }],
        note: null,
        primary: null,
      },
      aer25: {
        id: "aer25", svc: "CBAM", name: "2025 年度排放报告",
        code: "AER-2025 · Amendment R0", to: "Veritas Climate · 已核查",
        when: "2026-04-30 锁定", state: "已锁定 · 已核查",
        fields: [["服务", "CBAM"], ["编号", "AER-2025 · Amendment R0"], ["接收方", "Veritas Climate"], ["当前状态", "已锁定 · 已核查"]],
        events: [
          { t: "专家复核通过", d: "2026-03-18" },
          { t: "核查员出具结论", d: "2026-04-22" },
          { t: "锁定年度快照", d: "2026-04-30", tone: "is-now" },
        ],
        note: "已锁定文件只读。如需更正，在「当前工作」切换到 2025 并创建更正修订。",
        primary: null,
      },
      ver25: {
        id: "ver25", svc: "CBAM", name: "设施核查报告",
        code: "VER-2025-SH01 · Rev 1", to: "Veritas Climate",
        when: "2026-04-22", state: "已核查",
        fields: [["服务", "CBAM"], ["编号", "VER-2025-SH01 · Rev 1"], ["接收方", "Veritas Climate"], ["当前状态", "已核查"]],
        events: [{ t: "核查结论出具", d: "2026-04-22", tone: "is-now" }],
        note: null,
        primary: null,
      },
    };
    return catalog[delivId] || catalog.q3;
  }

  let drawerReturnFocus = null;
  function openDrawer(id, context = {}) {
    drawerReturnFocus = document.activeElement;
    state.drawer = { id, context };
    const [eyebrow, title, body] = drawerTemplate(id, context);
    $("#drawerEyebrow").textContent = eyebrow;
    $("#drawerTitle").textContent = title;
    $("#drawerBody").innerHTML = body;
    $("#drawerLayer").classList.toggle("drawer-layer--wide", id === "asset-detail" || id === "asset-impact");
    $("#drawerLayer").hidden = false;
    $("#drawer").querySelector("button, input, select, textarea, [href]")?.focus();
    $("#portal").inert = true;
    $("#portal").setAttribute("aria-hidden", "true");
    document.body.classList.add("drawer-open");
  }

  function closeDrawer() {
    $("#drawerLayer").hidden = true;
    $("#drawerLayer").classList.remove("drawer-layer--wide");
    $("#portal").inert = false;
    $("#portal").removeAttribute("aria-hidden");
    document.body.classList.remove("drawer-open");
    state.drawer = null;
    const target = drawerReturnFocus;
    drawerReturnFocus = null;
    queueMicrotask(() => {
      if (target && document.contains(target) && typeof target.focus === "function") target.focus({ preventScroll: true });
      else $("#main")?.focus?.({ preventScroll: true });
    });
  }

  function buildStageGateContext(serviceId) {
    const profile = annualProfile();
    const planned = profile.mode === "planned";
    const locked = isLockedYear();
    const power = typeof assetRegistry !== "undefined" ? assetRegistry.get("REC-HX-POWER-2026Q3") : null;
    const powerBindings = typeof assetRegistry !== "undefined" ? assetRegistry.bindings({ assetId: "REC-HX-POWER-2026Q3" }) : [];
    const cbamBinding = powerBindings.find((item) => item.serviceId === "cbam");
    const pcfBinding = powerBindings.find((item) => item.serviceId === "pcf");
    const pcfCase = typeof workflowEngine !== "undefined" ? workflowEngine.get("PCF-2026-001") : null;
    const pcfRun = typeof workflowEngine !== "undefined" ? workflowEngine.get("RUN-PCF-001") : null;
    const pcfReport = typeof workflowEngine !== "undefined" ? workflowEngine.get("PCF-RPT-2026-001-R1") : null;
    const snap = typeof assetRegistry !== "undefined" && assetRegistry.getSnapshot ? assetRegistry.getSnapshot("SNAP-PCF-HRC-01") || assetRegistry.getSnapshot("SNAP-PCF-001") : null;
    const openFindings = typeof workflowEngine !== "undefined"
      ? workflowEngine.list({ type: "finding" }).filter((item) => !["RESOLVED", "CLOSED"].includes(item.status))
      : [];
    const deliveryArtifact = typeof workflowEngine !== "undefined"
      ? workflowEngine.list({ type: "formalArtifact" }).find((item) => (item.metadata?.serviceId || "cbam") === "cbam")
      : null;

    if (serviceId === "cbam") {
      return {
        scopeDecisions: planned ? [{ id: "SD-PENDING", status: "PENDING" }] : [{ id: "SD-2026", status: "IN_SCOPE" }],
        codeBindings: planned
          ? [{ id: "CN-PENDING", status: "PENDING_CONFIRMATION" }]
          : [{ id: "CN-HRC", cnCode: "7208", status: "CONFIRMED" }],
        activityBindings: planned
          ? []
          : [{
            id: cbamBinding?.id || "BIND-CBAM-POWER",
            status: state.factConfirmed || cbamBinding?.status === "CONFIRMED" ? "CONFIRMED" : (cbamBinding?.status || "PENDING_CONFIRMATION"),
            conflicted: false
          }],
        calculation: {
          currentRun: Boolean(state.factConfirmed) || ["active", "locked"].includes(years[state.year]?.chip),
          snapshotStatus: power?.status === "STALE" ? "STALE" : "LOCKED"
        },
        findings: state.findingResolved ? [{ id: "FND-PRE-004", status: "RESOLVED" }] : openFindings.map((item) => ({ id: item.id, status: item.status })),
        delivery: { status: locked ? "LOCKED" : (deliveryArtifact?.status || (state.findingResolved ? "APPROVED" : "DRAFT")) }
      };
    }

    if (serviceId === "pcf") {
      const pastScope = pcfCase && !["NOT_STARTED", "SCOPING"].includes(pcfCase.status);
      const pastBoundary = pcfCase && !["NOT_STARTED", "SCOPING", "COLLECTING"].includes(pcfCase.status)
        || ["NEEDS_CONFIRMATION", "CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY", "CLOSED"].includes(pcfCase?.status);
      const storedTemplate = pcfCase?.metadata?.template || {};
      const templateValidated = ["VALIDATED", "VALIDATED_PARTIAL"].includes(storedTemplate.status)
        || Boolean(workflowEngine?.get("EVD-PCF-DATAPACK-001") && !storedTemplate.status);
      const inventoryConfirmed = pcfBinding?.status === "CONFIRMED" || ["CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY", "CLOSED"].includes(pcfCase?.status);
      const storedFactors = pcfCase?.metadata?.factors;
      const storedDeclaration = pcfCase?.metadata?.declaration || {};
      const declaration = window.LuminoPcfDeclaration
        ? window.LuminoPcfDeclaration.toStageGate({
          ...storedDeclaration,
          confirmed: Boolean(storedDeclaration.confirmed) || (pastScope && Boolean(storedDeclaration.functionalUnit || storedDeclaration.period || storedDeclaration.periodStart)),
          productId: storedDeclaration.productId || pcfCase?.metadata?.productId || (pastScope ? "PRD-HRC-01" : ""),
          goal: storedDeclaration.goal || (pastScope ? "客户披露与供应链响应" : ""),
          functionalUnit: storedDeclaration.functionalUnit || (pastScope ? "1 吨热轧非合金钢卷" : ""),
          period: storedDeclaration.period || (pastScope ? "2026-01-01 至 2026-09-30" : ""),
          periodStart: storedDeclaration.periodStart || (pastScope ? "2026-01-01" : ""),
          periodEnd: storedDeclaration.periodEnd || (pastScope ? "2026-09-30" : ""),
        })
        : {
          productId: pastScope ? "PRD-HRC-01" : "",
          goal: pastScope ? "客户披露与供应链响应" : "",
          functionalUnit: pastScope ? "1 吨热轧非合金钢卷" : "",
          period: pastScope ? "2026-01-01 至 2026-09-30" : "",
          confirmed: Boolean(pastScope),
        };
      const storedBoundary = pcfCase?.metadata?.boundary || {};
      const boundaryFallbackConfirmed = Boolean(pastBoundary) || ["NEEDS_CONFIRMATION", "CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY", "CLOSED"].includes(pcfCase?.status);
      const boundary = window.LuminoPcfBoundary
        ? window.LuminoPcfBoundary.toStageGate({
          ...storedBoundary,
          status: storedBoundary.status || (storedBoundary.confirmed || boundaryFallbackConfirmed ? "CONFIRMED" : "PROPOSED"),
          confirmed: Boolean(storedBoundary.confirmed) || boundaryFallbackConfirmed,
          boundaryType: storedBoundary.boundaryType || (boundaryFallbackConfirmed ? "从摇篮到大门" : ""),
          includedProcesses: storedBoundary.includedProcesses?.length
            ? storedBoundary.includedProcesses
            : (boundaryFallbackConfirmed ? ["上游原料", "厂内生产"] : []),
          excludedItems: storedBoundary.excludedItems?.length
            ? storedBoundary.excludedItems
            : (boundaryFallbackConfirmed ? ["销售运输", "使用与报废"] : []),
          cutOffRule: storedBoundary.cutOffRule || (boundaryFallbackConfirmed ? "单项 <1% 且合计 ≤5% 可截断" : ""),
        })
        : {
          status: boundaryFallbackConfirmed ? "CONFIRMED" : "PROPOSED",
          boundaryType: boundaryFallbackConfirmed ? "从摇篮到大门" : "",
          includedProcesses: boundaryFallbackConfirmed ? ["上游原料", "厂内生产"] : [],
          excludedItems: boundaryFallbackConfirmed ? ["销售运输"] : [],
          cutOffRule: boundaryFallbackConfirmed ? "单项 <1% 且合计 ≤5% 可截断" : "",
        };
      const template = window.LuminoPcfTemplate
        ? window.LuminoPcfTemplate.toStageGate({
          ...storedTemplate,
          status: storedTemplate.status
            || (templateValidated || inventoryConfirmed ? "VALIDATED" : (workflowEngine?.get("EVD-PCF-DATAPACK-001") ? "UPLOADED" : "NOT_UPLOADED")),
        })
        : { status: templateValidated || inventoryConfirmed ? "VALIDATED" : "UPLOADED" };
      const factorFallbackConfirmed = inventoryConfirmed || ["CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY", "CLOSED"].includes(pcfCase?.status);
      const factorSource = storedFactors || window.LuminoPcfFactors?.defaultSet(pcfCase?.metadata?.declaration || {}) || null;
      const factors = window.LuminoPcfFactors && factorSource
        ? window.LuminoPcfFactors.toStageGate({
          ...factorSource,
          confirmed: Boolean(factorSource.confirmed) || factorFallbackConfirmed,
          items: (factorSource.items || []).map((item) => ({
            ...item,
            applicabilityConfirmed: Boolean(item.applicabilityConfirmed) || factorFallbackConfirmed,
          })),
        })
        : (factorFallbackConfirmed
          ? [{ id: "EF-PCF-GRID", applicabilityConfirmed: true }]
          : [{ id: "EF-PCF-GRID", applicabilityConfirmed: false }]);
      return {
        declaration,
        boundary,
        template,
        inventoryBindings: inventoryConfirmed
          ? [{ id: pcfBinding?.id || "BIND-PCF-POWER", status: "CONFIRMED" }]
          : (pcfBinding ? [{ id: pcfBinding.id, status: pcfBinding.status }] : []),
        factors,
        calculation: {
          currentRun: ["CURRENT", "SUCCEEDED"].includes(pcfRun?.status) || ["EXPERT_REVIEW", "DELIVERABLE_READY", "CLOSED"].includes(pcfCase?.status),
          snapshotStatus: snap?.status === "STALE" ? "STALE" : "LOCKED"
        },
        review: {
          expertApproved: ["DELIVERABLE_READY", "CLOSED"].includes(pcfCase?.status),
          reportVersion: pcfReport?.id || null
        }
      };
    }

    return {};
  }

  function evaluateServicePipeline(serviceId) {
    if (!window.LuminoStageGates) return [];
    return window.LuminoStageGates.evaluatePipeline(serviceId, buildStageGateContext(serviceId));
  }

  /** Stage gates are secondary reference only — never the primary action surface.
   *  variant: "rail" (context sidebar) | "footer" (below the working form). */
  function stageGatePanelHtml(serviceId, { variant = "footer" } = {}) {
    const pipeline = evaluateServicePipeline(serviceId);
    if (!pipeline.length) return "";
    const passed = pipeline.filter((item) => item.ok).length;
    const current = pipeline.find((item) => !item.ok) || pipeline[pipeline.length - 1];
    const currentHint = current && !current.ok
      ? ((current.blockers || [])[0] || current.message || "待处理")
      : (current?.nextAction || "可继续");
    const rows = pipeline.map((item, index) => {
      const tone = item.ok ? "pass" : item.blocked ? "blocked" : "fail";
      const label = item.ok ? "通过" : item.blocked ? "阻塞" : "待完成";
      const detail = item.ok ? (item.nextAction || "可进入下一步") : (item.blockers || []).slice(0, 2).join("；") || item.message;
      return `<li class="stage-gate-row stage-gate-row--${tone}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${safe(item.title || item.stageId)}</strong><small>${safe(detail)}</small></div><em>${label}</em></li>`;
    }).join("");
    const variantClass = variant === "rail" ? "is-rail" : "is-footer";
    return `<section class="stage-gate-panel ${variantClass}" aria-label="${serviceId.toUpperCase()} 分步门槛">
      <header><p class="eyebrow">分步门槛</p><h2>${variant === "rail" ? "进度参考" : "本项目进度"}</h2></header>
      <p class="stage-gate-summary"><strong>${passed}/${pipeline.length}</strong> 已通过 · 当前：${safe(current?.title || "—")}${current && !current.ok ? ` · ${safe(currentHint)}` : ""}</p>
      <ol>${rows}</ol>
    </section>`;
  }

  function assertStageGate(serviceId, stageId) {
    if (!window.LuminoStageGates) return { ok: true };
    const outcome = window.LuminoStageGates.evaluateGate(serviceId, stageId, buildStageGateContext(serviceId));
    if (!outcome.ok) {
      toast(outcome.message || "当前步骤校验未通过");
    }
    return outcome;
  }
