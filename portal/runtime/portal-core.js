"use strict";

  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

  const customerRoles = new Set(["customer_admin", "customer_owner", "customer_contrib", "customer_approver"]);
  const isCustomer = () => customerRoles.has(state.role);
  const isLockedYear = () => years[state.year]?.chip === "locked";
  const canManageOrganization = () => state.role === "customer_admin";
  const canCreateYear = () => state.role === "customer_admin";
  const annualProfile = () => annualProfiles[state.year] || { mode: "planned", defaultQuarter: "Q1", step: 1, progress: years[state.year]?.progress || 0, position: "年度准备", foundation: "等待确认年度范围", quarters: { Q1: ["待计划", 0, ""], Q2: ["待计划", 0, ""], Q3: ["待计划", 0, ""], Q4: ["待计划", 0, ""] }, monitoring: ["待生成", ""], emissions: ["未开始", ""], verification: ["未开始", ""] };

  function periodKey() { return `${state.year}-${state.quarter}`; }

  function savePeriodState() {
    state.periodData[periodKey()] = {
      uploadAdded: state.uploadAdded,
      factConfirmed: state.factConfirmed,
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
      currentService: state.currentService, page: state.page, consultationRequests: state.consultationRequests,
    };
    window.localStorage.setItem(portalStateStorageKey, JSON.stringify(persisted));
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

  function pageHeader(eyebrow, title, aside = "") {
    return `<header class="page-head"><div><p>${eyebrow}</p><h1>${title}</h1></div>${aside}</header>`;
  }

  function actionButton(label, variant = "primary", attributes = "") {
    return `<button class="button button--${variant}" type="button" ${attributes}>${label}</button>`;
  }

  function statusChip(label, tone = "") {
    return `<span class="status-chip ${tone}">${label}</span>`;
  }

  function workflowStateLabel(value) {
    const serviceLabels = { SCOPING: "范围确认", CALCULATING: "计算中", EXPERT_REVIEW: "专家复核", DELIVERABLE_READY: "报告就绪" };
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

  function setCustomerDestination(serviceId, page) {
    const validService = serviceRegistry[serviceId]?.roles.includes(state.role) ? serviceId : null;
    state.currentService = validService;
    state.page = validService && activeServiceNav(validService).some(([id]) => id === page)
      ? page
      : validService ? activeServiceNav(validService)[0][0] : "services-hub";
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
      else setCustomerDestination(null, "services-hub");
    } else state.page = defaultPages[state.role];
    state.loggedIn = true;
    window.sessionStorage.setItem("lumino-portal-session-role", state.role);
    loadPeriodState(); syncUiFromWorkflow();
    $("#loginScreen").hidden = true;
    $("#portal").hidden = false;
    $("#roleSelect").value = state.role;
    $("#settingsButton").hidden = !canManageOrganization();
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

  function syncShell() {
    const config = roleConfig[state.role];
    const crossYearPage = ["programs", "team", "org-settings", "annual-setup", ...globalCustomerPages].includes(state.page);
    $("#settingsButton").hidden = isCustomer() || !canManageOrganization();
    $("#companyName").textContent = isCustomer() ? state.organization.name : config.company;
    $("#companyContextLabel").textContent = isCustomer() ? "当前企业" : ["importer", "verifier", "supplier"].includes(state.role) ? "当前机构" : "当前工作区";
    $("#profileName").textContent = config.name;
    $("#profileInitial").textContent = config.initial;
    $("#profileRole").textContent = config.title;
    document.querySelector(".project-period").hidden = !isCustomer() || state.currentService !== "cbam" || ["customer_contrib", "customer_approver"].includes(state.role) || crossYearPage;
    $("#yearSelect").innerHTML = Object.entries(years).map(([value, data]) => `<option value="${value}">${data.label}</option>`).join("") + (canCreateYear() ? `<option value="new">＋ 创建新年度</option>` : "");
    $("#yearSelect").value = state.year;
    $("#quarterSelect").value = state.quarter;
    const nav = isCustomer()
      ? [...customerGlobalNav, ...(state.currentService ? [["__service__", "", serviceRegistry[state.currentService].name], ...activeServiceNav()] : [])]
      : config.nav;
    $("#roleNav").innerHTML = `<p class="nav-label">${iconLabel(state.role)}</p>` + nav.map(([id, icon, label, badge]) => id === "__service__" ? `<p class="nav-section-label">${safe(label)}</p>` : `
      <button class="nav-item ${state.page === id ? "active" : ""}" type="button" data-page="${id}" ${state.page === id ? 'aria-current="page"' : ""}>
        <span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ""}
      </button>`).join("");
    $("#settingsButton").classList.toggle("active", state.page === "org-settings");
    if (state.page === "org-settings") $("#settingsButton").setAttribute("aria-current", "page");
    else $("#settingsButton").removeAttribute("aria-current");
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
    const pageLabel = isCustomer()
      ? [...customerGlobalNav, ...activeServiceNav()].find(([id]) => id === state.page)?.[2]
      : roleConfig[state.role].nav.find(([id]) => id === state.page)?.[2];
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
      "resources": ["GLOBAL RESOURCES", "资源中心", `<div class="resource-list"><a href="../calculator/index.html"><strong>CBAM 成本试算工具</strong><span>打开公开工具 →</span></a><a href="../Lumino%20指南文章.dc.html"><strong>CBAM 操作指南</strong><span>查看知识文章 →</span></a><button type="button" data-page="shared-files"><strong>企业数据资产</strong><span>查看已授权资产与服务使用 →</span></button></div>`],
      "service-consultation": ["SERVICE CONSULTATION", `咨询${safe(serviceRegistry[context.serviceId]?.name || "专业服务")}`, drawerForm("service-consultation", "我们会把当前企业、账号角色和服务类型一并带给顾问；不会为尚未开放的服务创建工作空间。", `<input type="hidden" name="serviceId" value="${safe(context.serviceId || "")}">${formField("需求说明", '<textarea name="needs" rows="5" required placeholder="希望解决的问题、涉及产品或交付时间"></textarea>')}${formField("期望联系时间", '<input name="preferredAt" type="datetime-local" required>')}${formField("联系电话", '<input name="phone" type="tel" placeholder="电话或手机号码">')}${formField("联系邮箱", '<input name="email" type="email" placeholder="name@company.com">', "电话或邮箱至少填写一项")}`, "提交咨询")],
      "pcf-upload": ["PCF DATA PACK", "回传 PCF 数据包", drawerForm("pcf-upload", "请回传完整 Excel 模板，并可同时附上账单、台账和供应商声明。系统先校验表结构、单位、期间和证据引用；确认前不会进入正式计算。", `<div class="drawer-template-link"><div><span>项目模板 · HRC-01 · V1.0</span><strong>还没有填写模板？</strong><small>模板已预填产品、核算期、功能单位和系统边界。</small></div><a class="button button--secondary" href="../outputs/pcf-template/Lumino_PCF_%E6%95%B0%E6%8D%AE%E9%87%87%E9%9B%86%E6%A8%A1%E6%9D%BF_HRC-01.xlsx" download>下载模板</a></div><input type="hidden" name="templateVersion" value="PCF-DATA-PACK-1.0">${formField("核算期间", '<input name="period" value="2026-01-01 至 2026-09-30" readonly>')}<label class="upload-drop"><input name="file" type="file" accept=".xlsx" required><strong>选择已填写的 Excel 模板</strong><small>必须保留原工作表名称和字段结构</small></label><label class="upload-drop upload-drop--secondary"><input name="supportFiles" type="file" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png" multiple><strong>添加证明材料（可多选）</strong><small>账单、ERP 导出、采购或物流台账、供应商 PCF / EPD</small></label>${formField("回传说明", '<textarea name="note" rows="3" placeholder="例如：采购和能源数据已完成，供应商 PCF 尚在收集中"></textarea>')}`, "上传并开始校验")],
      "pcf-report-preview": ["PCF REPORT PREVIEW", "产品碳足迹报告预览", `<div class="document-sheet"><small>PREVIEW · ${workflowEngine.get("PCF-2026-001")?.status === "DELIVERABLE_READY" ? "REV 1" : "DRAFT"}</small><h3>热轧非合金钢卷产品碳足迹报告</h3><dl><div><dt>核算目标</dt><dd>客户披露与供应链响应</dd></div><div><dt>系统边界</dt><dd>从摇篮到大门</dd></div><div><dt>功能单位</dt><dd>1 吨热轧非合金钢卷</dd></div><div><dt>结果</dt><dd>2.18 tCO₂e / t 产品</dd></div><div><dt>计算版本</dt><dd>PCF Run 01</dd></div></dl><p>结果仅用于原型演示。正式报告需完成专家复核、方法说明和证据完整性检查。</p></div>`],
      "generic-action": [context.eyebrow || "ACTION", context.title || "完成操作", drawerForm("generic-action", context.description || "补充必要信息后执行。动作、理由和影响范围会写入审计记录。", `${commonRole}${formField(context.fieldLabel || "处理说明", `<textarea rows="4" required placeholder="${context.placeholder || "说明处理内容或判断依据"}"></textarea>`)}${formField("责任人", '<select><option>我负责</option><option>转交项目协调人</option><option>转交制备专家</option><option>转交运营</option></select>')}${formField("期望完成时间", '<input type="date" value="2026-10-15">')}`, context.submitLabel || "确认并记录")],
      "record-detail": [context.eyebrow || "DETAIL", context.title || "记录详情", `<div class="detail-ledger">${commonRole}<dl><div><dt>对象</dt><dd>${context.object || `华星钢铁 · ${state.year}`}</dd></div><div><dt>当前状态</dt><dd>${context.status || "处理中"}</dd></div><div><dt>负责人</dt><dd>${context.owner || roleConfig[state.role].name}</dd></div><div><dt>权限范围</dt><dd>${context.scope || "当前服务订单与已授权数据"}</dd></div><div><dt>最近更新</dt><dd>今天 09:20</dd></div></dl><section><strong>当前需要处理</strong><p>${context.description || "查看记录、确认下一步，并保留处理依据。"}</p></section></div><footer class="drawer-actions"><button class="button button--secondary" type="button" data-close-drawer>关闭</button>${context.action ? `<button class="button button--primary" type="button" data-drawer="generic-action" data-drawer-label="${context.action}">${context.action}</button>` : ""}</footer>`],
    };
    return templates[id] || templates["record-detail"];
  }

  let drawerReturnFocus = null;
  function openDrawer(id, context = {}) {
    drawerReturnFocus = document.activeElement;
    state.drawer = { id, context };
    const [eyebrow, title, body] = drawerTemplate(id, context);
    $("#drawerEyebrow").textContent = eyebrow;
    $("#drawerTitle").textContent = title;
    $("#drawerBody").innerHTML = body;
    $("#drawerLayer").hidden = false;
    $("#drawer").querySelector("button, input, select, textarea, [href]")?.focus();
    $("#portal").inert = true;
    $("#portal").setAttribute("aria-hidden", "true");
    document.body.classList.add("drawer-open");
  }

  function closeDrawer() {
    $("#drawerLayer").hidden = true;
    $("#portal").inert = false;
    $("#portal").removeAttribute("aria-hidden");
    document.body.classList.remove("drawer-open");
    state.drawer = null;
    drawerReturnFocus?.focus?.();
  }
