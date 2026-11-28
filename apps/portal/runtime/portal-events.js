"use strict";

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => element.classList.remove("show"), 2800);
  }

  function runAgentTaskWithPolling({ taskId, pendingResult, onStatus, onReady, onError, requiredPolls = 2, intervalMs = 450 }) {
    const tick = () => {
      try {
        const snapshot = agentTaskEngine.poll(taskId, { requiredPolls, pendingResult });
        if (typeof onStatus === "function") onStatus(snapshot);
        if (["READY", "READY_PARTIAL"].includes(snapshot.status)) {
          onReady(snapshot);
          return;
        }
        if (["FAILED", "SYNC_FAILED"].includes(snapshot.status)) {
          onError(snapshot, null);
          return;
        }
        window.setTimeout(tick, intervalMs);
      } catch (error) {
        onError(null, error);
      }
    };
    window.setTimeout(tick, intervalMs);
  }

  function setSubmitBusyLabel(submitButton, label) {
    if (!submitButton) return;
    submitButton.disabled = true;
    submitButton.textContent = label;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    }
    return btoa(binary);
  }

  function isStaffEmail(email) {
    const domain = String(email || "").split("@")[1]?.toLowerCase() || "";
    return domain === "lumino.tech" || domain === "esgai.cn";
  }

  function isValidWorkEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || "").trim());
  }

  function clearStaffSession() {
    try { sessionStorage.removeItem("lumino-staff-session-token"); } catch (_) {}
    try { sessionStorage.removeItem("lumino-leads-staff-key"); } catch (_) {}
    try { sessionStorage.removeItem("lumino-staff-profile"); } catch (_) {}
    state.publicLeads = [];
    state.selectedLeadId = null;
    state.leadsHydrated = false;
    state.leadsError = null;
  }

  function saveStaffSession(payload) {
    if (!payload?.staffKey) return;
    try { sessionStorage.setItem("lumino-staff-session-token", payload.staffKey); } catch (_) {}
    // Temporary compatibility for knowledge-client until it adopts bearer sessions.
    try { sessionStorage.setItem("lumino-leads-staff-key", payload.staffKey); } catch (_) {}
    try {
      sessionStorage.setItem("lumino-staff-profile", JSON.stringify({
        email: payload.email,
        name: payload.name,
        role: payload.role,
      }));
    } catch (_) {}
    state.publicLeads = [];
    state.selectedLeadId = null;
    state.leadsHydrated = false;
    state.leadsError = null;
  }

  async function staffPasswordLogin(email, password) {
    const response = await fetch("/api/staff-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    const parsed = window.LuminoLeadsClient?.parseApiResponse
      ? window.LuminoLeadsClient.parseApiResponse(response, data, "登录失败")
      : {
          ok: response.ok && data.ok !== false,
          data: data.data && typeof data.data === "object" ? data.data : data,
          error: typeof data.error === "string" ? data.error : data.error?.message || "登录失败",
        };
    if (!parsed.ok) {
      const error = new Error(parsed.error || "登录失败");
      error.code = parsed.code;
      error.requestId = parsed.requestId;
      throw error;
    }
    return parsed.data;
  }

  const portalCustomerTokenKey = "lumino-portal-customer-token";
  const localDemoPreview = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  let customerCnCatalog = [];
  let customerCnCatalogPromise;
  let customerCnExisting = new Set();
  const customerCnSelected = new Set();
  let customerWorkspaceStep = null;
  let customerPortalView = "home";
  let customerProductTab = "products";
  let customerDataTab = "data";
  let customerPortalData = null;
  const realCustomerPages = Array.from(document.querySelectorAll("#customerPages [data-customer-view-panel]"));
  const customerSectorLabels = { "Iron and Steel": "钢铁", Aluminium: "铝", Cement: "水泥", Fertiliser: "化肥", Hydrogen: "氢" };

  function mountRealCustomerPages() {
    if (realCustomerPages[0]?.parentElement === $("#main")) return;
    $("#main").replaceChildren(...realCustomerPages);
  }

  function unmountRealCustomerPages() {
    const bank = $("#customerPages");
    if (realCustomerPages[0]?.parentElement === bank) return;
    bank.append(...realCustomerPages);
    $("#portal").classList.remove("portal--real-customer");
  }

  function clearRealCustomerViewData() {
    customerPortalData = null;
    customerCnExisting = new Set();
    customerCnSelected.clear();
    customerProductTab = "products";
    customerDataTab = "data";
    for (const panel of realCustomerPages) {
      if (!["setup", "cbam"].includes(panel.dataset.customerViewPanel)) panel.replaceChildren();
    }
    $("#customerCbamWorkFrame").replaceChildren();
    $("#customerProductionLinksHint").textContent = "";
    $("#customerProductionLinkFeedback").textContent = "";
    $("#customerProductionLinksList").replaceChildren();
    $("#customerProductionLinkForm").reset();
    delete $("#customerProductionLinkForm").dataset.recordId;
    for (const name of ["productId", "facilityId"]) $("#customerProductionLinkForm").elements.namedItem(name).replaceChildren();
    $("#customerMaterialPlanHint").textContent = "";
    $("#customerMaterialPlanFeedback").textContent = "";
    $("#customerMaterialPlanList").replaceChildren();
    $("#customerMaterialPlanForm").reset();
    $("#customerMaterialPlanForm").elements.facilityId.replaceChildren();
    $("#customerEvidenceForm").reset();
    $("#customerEvidenceForm").elements.materialRequestId.replaceChildren();
    $("#customerEvidenceForm").hidden = true;
    $("#customerEvidenceHint").textContent = "先建立材料计划草稿。";
    $("#customerEvidenceFeedback").textContent = "";
    $("#customerEvidenceList").replaceChildren();
    $("#customerTenantName").value = "";
    $("#customerSetupForm").reset();
    $("#customerTenantDisplayName").textContent = "";
    $("#customerTenantEditForm").reset();
    $("#customerProjectDetail").textContent = "";
    delete $("#customerProjectSummary").dataset.projectId;
    $("#customerProductList").replaceChildren();
    $("#customerFacilityList").replaceChildren();
    $("#customerProductCount").textContent = "";
    $("#customerFacilityCount").textContent = "";
    document.querySelectorAll("[data-customer-record]").forEach(resetCustomerRecordForm);
    $("#customerCnSelected").replaceChildren();
    $("#customerCnResults").replaceChildren();
    $("#customerCnSelectedCount").textContent = "0";
    $("#customerCnSearch").value = "";
    $("#customerCnPaste").value = "";
    for (const selector of ["#customerCnSearchStatus", "#customerCnPasteFeedback", "#customerCnSaveFeedback", "#customerOverviewHint", "#customerSetupError"]) $(selector).textContent = "";
    $("#customerOverviewProducts").textContent = "0";
    $("#customerOverviewFacilities").textContent = "0";
  }

  function alignCustomerRail() {
    if (!customerPortalData || !window.matchMedia("(max-width: 820px)").matches) return;
    const rail = $("#shellRail");
    const active = rail.querySelector('[aria-current="page"]');
    if (!active) return;
    const railRect = rail.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.left < railRect.left || activeRect.right > railRect.right) {
      rail.scrollLeft += activeRect.left - railRect.left - (railRect.width - activeRect.width) / 2;
    }
  }

  window.addEventListener("resize", () => window.requestAnimationFrame(alignCustomerRail));

  function syncRealCustomerShell(view, project) {
    const portal = $("#portal");
    portal.classList.add("portal--real-customer");
    $("#demoWorkspaceLabel").hidden = true;
    $("#companyName").textContent = customerPortalData.tenant.name;
    $("#companyMark").textContent = customerPortalData.tenant.name.slice(0, 1);
    $("#companyContextLabel").hidden = true;
    $("#profileName").textContent = customerPortalData.user.name;
    $("#profileInitial").textContent = customerPortalData.user.name.slice(0, 1);
    $("#profileRole").textContent = customerPortalData.user.roles.includes("customer_admin") ? "企业管理员" : "企业成员";
    $("#projectPeriod").hidden = true;
    $("#agentTopbarSlot").replaceChildren();
    $("#serviceOverviewLayer").hidden = true;
    $("#serviceOverviewLayer").replaceChildren();
    $("#serviceOverviewDock").hidden = true;
    document.body.classList.remove("service-overview-open");
    $("#drawerLayer").hidden = true;
    $("#drawerBody").replaceChildren();
    $("#cmdkLayer").hidden = true;
    $("#cmdkResults").replaceChildren();
    $("#agentRuntimeLayer").hidden = true;
    $("#agentRuntimeLayer").replaceChildren();
    const cbamViews = new Set(["cbam", "annual", "products", "data-calculation", "cbam-deliverables", "setup"]);
    const inCbam = cbamViews.has(view);
    const railItems = customerGlobalNav.map(([demoPage, icon, label, short]) => [({ workbench: "home", "shared-tasks": "tasks", "shared-files": "assets", "shared-deliverables": "deliverables" })[demoPage], icon, label, short]);
    const customerRailButton = ([target, icon, label, short]) => railButton(target, icon, label, {
      customerView: target, short, code: target === "cbam" ? "CBAM" : null,
      active: target === view || (target === "cbam" && inCbam),
    });
    $("#shellRail").innerHTML = railItems.map(customerRailButton).join("")
      + '<span class="rail-divider" aria-hidden="true"></span>'
      + customerRailButton(["cbam", "CBAM", "欧盟碳边境合规", "CBAM"])
      + customerRailButton(["services", customerRailExtras.services[1], "服务目录", "服务"]);
    alignCustomerRail();
    const showSecondary = Boolean(project && inCbam);
    $("#sidebar").hidden = !showSecondary;
    document.querySelector(".portal-layout").classList.toggle("portal-layout--rail-only", !showSecondary);
    $("#sidebarChannel").hidden = !showSecondary;
    if (showSecondary) {
      $("#sidebarChannel").innerHTML = `<p class="sidebar-channel__eyebrow">CBAM · 已开通</p><strong>${safe(serviceRegistry.cbam.name)}</strong><span>${safe(project.year)} 年度项目</span>`;
      const pageMap = { work: "cbam", "annual-project": "annual", products: "products", "data-calculation": "data-calculation", deliverables: "cbam-deliverables" };
      $("#roleNav").innerHTML = serviceRegistry.cbam.nav.map(([demoPage, icon, label]) => {
        const target = pageMap[demoPage];
        return serviceNavButton(demoPage, icon, label, { customerView: target, active: target === view || (view === "setup" && target === "annual") });
      }).join("");
    } else $("#roleNav").replaceChildren();
    document.title = `${inCbam ? "CBAM" : "企业工作台"} · Lumino`;
  }

  async function loadCustomerCnCatalog() {
    if (customerCnCatalog.length) return customerCnCatalog;
    if (!customerCnCatalogPromise) customerCnCatalogPromise = fetch("/calculator/data/cn-codes.json")
      .then((response) => { if (!response.ok) throw new Error("CN 目录加载失败，请刷新重试"); return response.json(); })
      .then((rows) => {
        if (!Array.isArray(rows) || !rows.every((item) => item.cnCode && item.zh && item.sector)) throw new Error("CN 目录格式不正确");
        customerCnCatalog = rows;
        const datalist = $("#customerCnOptions");
        datalist.replaceChildren(...rows.map((item) => new Option(`${item.cnCode} · ${item.zh}`, item.cnCode)));
        if (state.importedTrial?.cnCode && rows.some((item) => item.cnCode === state.importedTrial.cnCode) && !customerCnExisting.has(state.importedTrial.cnCode)) customerCnSelected.add(state.importedTrial.cnCode);
        renderCustomerCnPicker();
        renderCustomerProductSectors();
        return rows;
      })
      .catch((error) => { customerCnCatalogPromise = null; $("#customerCnSearchStatus").textContent = error.message; throw error; });
    return customerCnCatalogPromise;
  }

  function renderCustomerCnPicker() {
    if (!customerCnCatalog.length) return;
    const query = $("#customerCnSearch").value.trim().toLowerCase();
    const codeQuery = query.replace(/\s+/g, "");
    const results = $("#customerCnResults");
    results.replaceChildren();
    const matches = !query ? [] : customerCnCatalog.filter((item) =>
      item.cnCode.includes(codeQuery) || item.zh.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
    );
    $("#customerCnSearchStatus").textContent = !query
      ? `目录有 ${customerCnCatalog.length} 条编码。输入品名或编码查看候选，也可批量粘贴完整编码。`
      : matches.length ? `找到 ${matches.length} 条候选${matches.length > 30 ? "，显示前 30 条，请继续缩小范围" : ""}。点击“加入”可连续选择。` : "没有找到匹配编码，请核对报关资料或更换关键词。";
    for (const item of matches.slice(0, 30)) {
      const row = document.createElement("li");
      const label = document.createElement("div");
      const code = document.createElement("strong");
      code.textContent = item.cnCode;
      const name = document.createElement("small");
      name.textContent = `${customerSectorLabels[item.sector] || item.sector} · ${item.zh}`;
      label.append(code, name);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button--secondary";
      button.disabled = customerCnExisting.has(item.cnCode);
      button.textContent = button.disabled ? "已保存" : customerCnSelected.has(item.cnCode) ? "移除" : "加入";
      button.setAttribute("aria-label", `${button.textContent} CN ${item.cnCode} ${item.zh}`);
      button.addEventListener("click", (event) => {
        if (customerCnSelected.has(item.cnCode)) customerCnSelected.delete(item.cnCode);
        else if (customerCnSelected.size < 50) customerCnSelected.add(item.cnCode);
        else { $("#customerCnSaveFeedback").textContent = "每次最多选择 50 个 CN 码，请先保存当前清单。"; return; }
        renderCustomerCnPicker();
        if (event.detail === 0) $("#customerCnSearch").focus();
      });
      row.append(label, button);
      results.append(row);
    }
    const selectedList = $("#customerCnSelected");
    selectedList.replaceChildren();
    for (const code of customerCnSelected) {
      const item = customerCnCatalog.find((row) => row.cnCode === code);
      if (!item) continue;
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${code} · ${customerSectorLabels[item.sector] || item.sector} · ${item.zh}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "link-button";
      remove.textContent = "移除";
      remove.setAttribute("aria-label", `移除 CN ${code}`);
      remove.addEventListener("click", (event) => {
        customerCnSelected.delete(code);
        renderCustomerCnPicker();
        if (event.detail === 0) $("#customerCnSearch").focus();
      });
      row.append(label, remove);
      selectedList.append(row);
    }
    $("#customerCnSelectedCount").textContent = String(customerCnSelected.size);
    $("#customerCnSelection").hidden = customerCnSelected.size === 0;
    $("#customerCnSave").disabled = customerCnSelected.size === 0;
  }

  function renderCustomerProductSectors() {
    if (!customerPortalData || !customerCnCatalog.length) return;
    for (const label of document.querySelectorAll("[data-product-id]")) {
      const record = customerPortalData.records?.find((item) => item.id === label.dataset.productId);
      const code = record?.cnCode;
      const catalog = customerCnCatalog.find((item) => item.cnCode === code);
      if (record && catalog) label.textContent = `CN ${code} · ${customerSectorLabels[catalog.sector] || catalog.sector} · ${record.name}`;
    }
  }

  async function portalCustomerApi(path, { method = "GET", body, token } = {}) {
    const response = await fetch(path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }).catch(() => { throw Object.assign(new Error("网络连接失败，请检查网络后重试"), { code: "NETWORK_ERROR" }); });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok !== true) {
      const code = payload.error?.code || "INTERNAL_ERROR";
      if (code === "AUTH_REQUIRED" && path === "/api/portal-workspace" && method !== "DELETE") {
        clearPortalCustomerSession();
        window.sessionStorage.removeItem("lumino-portal-session-mode");
        unmountRealCustomerPages();
        clearRealCustomerViewData();
        $("#portal").hidden = true;
        $("#loginScreen").hidden = false;
        setLoginStep("email", true);
      }
      const message = code === "AUTH_REQUIRED" ? "账号或密码错误，或登录已失效"
        : code === "RATE_LIMITED" ? "尝试次数过多，请 15 分钟后再试"
          : code === "DEPENDENCY_UNAVAILABLE" ? `${path === "/api/portal-login" ? "企业登录服务" : "项目服务"}暂不可用，请稍后重试或联系管理员`
            : code === "VALIDATION_FAILED" ? "请检查填写内容"
              : "服务暂时不可用，请稍后重试";
      throw Object.assign(new Error(message), { code, status: response.status });
    }
    return payload.data;
  }

  function clearPortalCustomerSession() {
    window.sessionStorage.removeItem(portalCustomerTokenKey);
    customerWorkspaceStep = null;
  }

  async function revokePortalCustomerSession() {
    const token = window.sessionStorage.getItem(portalCustomerTokenKey);
    clearPortalCustomerSession();
    unmountRealCustomerPages();
    clearRealCustomerViewData();
    if (token) {
      try { await portalCustomerApi("/api/portal-workspace", { method: "DELETE", token }); } catch (_) { /* Session expires server-side. */ }
    }
  }

  function resetCustomerRecordForm(form) {
    form.reset();
    delete form.dataset.recordId;
    form.querySelector('button[type="submit"]').textContent = {
      product: "保存产品", facility: "保存设施",
    }[form.dataset.customerRecord];
    form.querySelector("[data-customer-cancel]").hidden = true;
    if (form.dataset.customerRecord === "product") $("#customerProductManual").open = false;
  }

  function setCustomerPortalView(view, focus = false) {
    const cbamViews = new Set(["cbam", "annual", "products", "data-calculation", "cbam-deliverables"]);
    if (cbamViews.has(view) && !customerPortalData?.projects?.length) {
      customerWorkspaceStep = "identity";
      setCustomerWorkspaceStep("identity");
      view = "setup";
    }
    if (!["home", "services", "cbam", "annual", "products", "data-calculation", "cbam-deliverables", "tasks", "assets", "deliverables", "setup"].includes(view)) return;
    customerPortalView = view;
    document.querySelectorAll("[data-customer-view-panel]").forEach((panel) => { panel.hidden = panel.dataset.customerViewPanel !== view; });
    const project = customerPortalData?.projects?.[0];
    syncRealCustomerShell(view, project);
    if (focus) {
      const panel = document.querySelector(`[data-customer-view-panel="${view}"]`);
      const title = panel?.querySelector("h1");
      if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderCustomerPortalPages(data, project, counts) {
    renderTenantWorkbench(data, project, counts);
    document.querySelector('[data-customer-view-panel="services"]').innerHTML = servicesHubMarkup(data);
    renderTenantCbamWork(data, project, counts);
    const projectRecords = project ? (data.records || []).filter((record) => record.projectId === project.id) : [];
    const products = projectRecords.filter((record) => record.kind === "product");
    const facilities = projectRecords.filter((record) => record.kind === "facility");
    const links = projectRecords.filter((record) => record.kind === "production_link");
    const linkForm = $("#customerProductionLinkForm");
    const canEditLinks = project?.status === "SETUP_DRAFT" && data.user.roles.some((role) => ["customer_admin", "customer_owner"].includes(role));
    const canLink = canEditLinks && products.length > 0 && facilities.length > 0;
    linkForm.hidden = !canLink;
    $("#customerProductionLinksSetup").hidden = !canEditLinks || canLink;
    $("#customerProductionLinksHint").textContent = !project
      ? "先启动年度项目，再建立产品与设施关系。"
      : !products.length || !facilities.length
        ? "请先保存至少一个产品 CN 码和一座生产设施。"
        : links.length ? `已建立 ${links.length} 条生产关系，可继续补充或修改。` : "选择一个产品和实际生产它的设施；一个产品可以关联多座设施。";
    for (const [name, records, label] of [
      ["productId", products, (record) => `${record.cnCode} · ${record.name}`],
      ["facilityId", facilities, (record) => `${record.name} · ${record.location}`],
    ]) {
      const select = linkForm.elements.namedItem(name);
      const previous = select.value;
      select.replaceChildren(new Option("请选择", ""), ...records.map((record) => new Option(label(record), record.id)));
      if (records.some((record) => record.id === previous)) select.value = previous;
    }
    const linksList = $("#customerProductionLinksList");
    linksList.replaceChildren();
    for (const link of links) {
      const product = products.find((record) => record.id === link.productId);
      const facility = facilities.find((record) => record.id === link.facilityId);
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${product?.cnCode || "产品待核对"} · ${facility?.name || "设施待核对"}${link.processSummary ? ` · ${link.processSummary}` : ""}`;
      item.append(label);
      if (canLink) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "text-button";
        edit.textContent = "修改";
        edit.addEventListener("click", () => {
          linkForm.dataset.recordId = link.id;
          linkForm.elements.productId.value = link.productId;
          linkForm.elements.facilityId.value = link.facilityId;
          linkForm.elements.processSummary.value = link.processSummary || "";
          linkForm.querySelector('button[type="submit"]').textContent = "保存修改";
          $("#customerProductionLinkCancel").hidden = false;
          linkForm.elements.productId.focus();
        });
        item.append(edit);
      }
      linksList.append(item);
    }

    const linkedFacilityIds = new Set(links.map((link) => link.facilityId));
    const linkedFacilities = facilities.filter((facility) => linkedFacilityIds.has(facility.id));
    const planForm = $("#customerMaterialPlanForm");
    const previousFacility = planForm.elements.facilityId.value;
    const previousQuarter = planForm.elements.quarter.value;
    planForm.hidden = !canEditLinks || linkedFacilities.length === 0;
    planForm.elements.facilityId.replaceChildren(new Option("请选择设施", ""), ...linkedFacilities.map((facility) => new Option(facility.name, facility.id)));
    if (linkedFacilityIds.has(previousFacility)) planForm.elements.facilityId.value = previousFacility;
    planForm.elements.quarter.value = previousQuarter;
    const materialRequests = projectRecords.filter((record) => record.kind === "material_request" && record.dataItemCode === "NATURAL_GAS_NM3");
    $("#customerMaterialPlanHint").textContent = !project
      ? "先建立年度项目和生产关系。"
      : !linkedFacilities.length
        ? "先建立产品与设施的生产关系，再确定要收集的资料。"
        : materialRequests.length ? `已有 ${materialRequests.length} 条材料计划草稿。` : "只为实际使用天然气的设施建立草稿；无需一次列齐所有资料。";
    const materialList = $("#customerMaterialPlanList");
    materialList.replaceChildren();
    for (const request of materialRequests) {
      const item = document.createElement("li");
      item.textContent = `${request.title} · 草稿，尚未发送`;
      materialList.append(item);
    }
    const evidenceForm = $("#customerEvidenceForm");
    const priorRequestId = evidenceForm.elements.materialRequestId.value;
    const uploadEnabled = Boolean(data.capabilities?.evidenceUpload);
    const canUploadEvidence = ["SETUP_DRAFT", "ACTIVE"].includes(project?.status)
      && data.user.roles.some((role) => ["customer_admin", "customer_owner", "customer_contrib"].includes(role));
    evidenceForm.hidden = !uploadEnabled || !materialRequests.length || !canUploadEvidence;
    evidenceForm.elements.materialRequestId.replaceChildren(new Option("请选择设施与季度", ""),
      ...materialRequests.map((request) => new Option(request.title, request.id)));
    if (materialRequests.some((request) => request.id === priorRequestId)) evidenceForm.elements.materialRequestId.value = priorRequestId;
    $("#customerEvidenceHint").textContent = !uploadEnabled
      ? "正式文件上传尚未开通，请先保存材料计划；资料不会存入浏览器缓存。"
      : !materialRequests.length ? "先建立材料计划草稿，再上传对应设施和季度的文件。"
        : "每次上传都会保留一个新版本。上传后仍需核对用量，文件不会自动成为申报数据。";
    const evidenceList = $("#customerEvidenceList");
    evidenceList.replaceChildren();
    for (const evidence of (data.evidence || []).filter((item) => item.projectId === project?.id)) {
      const request = materialRequests.find((item) => item.id === evidence.materialRequestId);
      if (!request) continue;
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${request.title} · ${evidence.filename} · 版本 ${evidence.version}`;
      const download = document.createElement("button");
      download.type = "button";
      download.className = "text-button";
      download.textContent = uploadEnabled ? "下载" : "暂不可下载";
      download.disabled = !uploadEnabled;
      download.addEventListener("click", () => downloadCustomerEvidence(evidence, download));
      item.append(label, download);
      evidenceList.append(item);
    }

    renderTenantGlobalPages(data, project, projectRecords, links);
    renderTenantCbamDetails(data, project, projectRecords, counts, customerProductTab, customerDataTab);
  }

  function setCustomerWorkspaceStep(step, focus = false) {
    const hasProject = !$("#customerProjectSummary").hidden;
    if (!hasProject && step !== "identity") return;
    customerWorkspaceStep = step;
    document.querySelectorAll("[data-customer-step]").forEach((button) => {
      button.disabled = !hasProject && button.dataset.customerStep !== "identity";
      if (button.dataset.customerStep === step) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    document.querySelectorAll("[data-customer-step-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.customerStepPanel !== step;
    });
    if (focus) {
      const target = hasProject ? document.querySelector(`[data-customer-step-panel="${step}"] h3`) : $("#customerSetupForm h2");
      if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
      $("#customerSetupNav").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }

  function showCustomerWorkspace(data) {
    customerPortalData = data;
    mountRealCustomerPages();
    $("#loginScreen").hidden = true;
    $("#portal").hidden = false;
    $("#customerWorkspaceTitle").textContent = "启动 CBAM 年度项目";
    $("#customerWorkspaceIntro").textContent = "分步建立项目范围，完成后进入 CBAM 项目继续工作。";
    $("#customerTenantName").value = data.tenant.name;
    const project = data.projects?.[0];
    $("#customerSetupForm").hidden = Boolean(project);
    $("#customerProjectSummary").hidden = !project;
    const projectRecords = project ? (data.records || []).filter((record) => record.projectId === project.id) : [];
    const counts = Object.fromEntries(["product", "facility", "material_request", "production_link"].map((kind) => [kind, projectRecords.filter((record) => record.kind === kind).length]));
    for (const [step, label] of Object.entries({
      identity: project ? "已确认" : "待确认",
      product: counts.product ? `已保存 ${counts.product}` : "待设置",
      facility: counts.facility ? `已保存 ${counts.facility}` : "待设置",
      review: counts.product && counts.facility ? "可进入" : "待核对",
    })) $(`[data-customer-step-status="${step}"]`).textContent = label;
    if (!customerWorkspaceStep || (!project && customerWorkspaceStep !== "identity")) customerWorkspaceStep = !project ? "identity" : !counts.product ? "product" : !counts.facility ? "facility" : "review";
    renderCustomerPortalPages(data, project, counts);
    if (project) {
      $("#customerProjectDetail").textContent = `${data.tenant.name} · CBAM ${project.year} 年度项目 · ${counts.product && counts.facility ? "基础范围已建立" : "范围待完善"}`;
      $("#customerProjectSummary").dataset.projectId = project.id;
      const canEdit = project.status === "SETUP_DRAFT" && data.user.roles.some((role) => ["customer_admin", "customer_owner"].includes(role));
      document.querySelectorAll("[data-customer-record]").forEach((form) => { form.hidden = !canEdit; });
      $("#customerCnPicker").hidden = !canEdit;
      $("#customerProductManual").hidden = !canEdit;
      $("#customerTenantDisplay").hidden = false;
      $("#customerTenantDisplayName").textContent = data.tenant.name;
      $("#customerTenantEditButton").hidden = !canEdit;
      $("#customerTenantEditForm").hidden = true;
      $("#customerTenantEditForm").elements.tenantName.value = data.tenant.name;
      const descriptions = {
        product: (record) => `CN ${record.cnCode} · ${record.name}`,
        facility: (record) => `${record.name} · ${record.location}`,
      };
      for (const [kind, listId, countId] of [
        ["product", "customerProductList", "customerProductCount"],
        ["facility", "customerFacilityList", "customerFacilityCount"],
      ]) {
        const records = (data.records || []).filter((record) => record.projectId === project.id && record.kind === kind);
        const list = $(`#${listId}`);
        list.replaceChildren();
        for (const record of records) {
          const item = document.createElement("li");
          const label = document.createElement("span");
          label.textContent = descriptions[kind](record);
          if (kind === "product") label.dataset.productId = record.id;
          item.append(label);
          if (canEdit) {
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "link-button";
            edit.textContent = "修改";
            edit.setAttribute("aria-label", `修改${descriptions[kind](record)}`);
            edit.addEventListener("click", () => {
              const form = document.querySelector(`[data-customer-record="${kind}"]`);
              for (const [key, value] of Object.entries(record)) {
                const input = form.elements.namedItem(key);
                if (input) input.value = value;
              }
              form.dataset.recordId = record.id;
              if (kind === "product") $("#customerProductManual").open = true;
              form.querySelector('button[type="submit"]').textContent = "保存修改";
              form.querySelector("[data-customer-cancel]").hidden = false;
              form.scrollIntoView({ block: "nearest", behavior: "smooth" });
            });
            item.append(edit);
          }
          list.append(item);
        }
        $(`#${countId}`).textContent = `已保存 ${records.length} 项`;
      }
      customerCnExisting = new Set((data.records || []).filter((record) => record.projectId === project.id && record.kind === "product").map((record) => record.cnCode));
      for (const code of customerCnExisting) customerCnSelected.delete(code);
      if (canEdit) void loadCustomerCnCatalog().catch(() => {});
      renderCustomerCnPicker();
      renderCustomerProductSectors();
      $("#customerOverviewProducts").textContent = String(counts.product);
      $("#customerOverviewFacilities").textContent = String(counts.facility);
      $("#customerOverviewHint").textContent = counts.product && counts.facility
        ? "产品与生产设施已保存。核对后进入项目，查看范围与材料准备状态。"
        : "请先保存至少一个产品 CN 码和一座生产设施，才能完成引导。";
      $("#customerCompleteSetup").disabled = !counts.product || !counts.facility;
    }
    setCustomerWorkspaceStep(customerWorkspaceStep);
    setCustomerPortalView(customerPortalView);
    window.sessionStorage.setItem("lumino-portal-session-mode", "customer");
    window.sessionStorage.removeItem("lumino-portal-session-role");
  }

  async function restorePortalCustomerSession({ focus = false } = {}) {
    const token = window.sessionStorage.getItem(portalCustomerTokenKey);
    if (!token) return false;
    try {
      const data = await portalCustomerApi("/api/portal-workspace", { token });
      if (data.tenant.isDemo) {
        if (!portalDemoBootstrap) {
          window.sessionStorage.setItem("lumino-portal-session-mode", "portal-demo");
          window.location.reload();
          return true;
        }
        login("customer_owner", { demo: true, sessionMode: "portal-demo", restore: true });
      } else {
        showCustomerWorkspace(data);
        if (focus) setCustomerPortalView("home", true);
      }
      return true;
    } catch (_) {
      clearPortalCustomerSession();
      window.sessionStorage.removeItem("lumino-portal-session-mode");
      return false;
    }
  }

  async function portalCustomerPasswordLogin(email, password) {
    const session = await portalCustomerApi("/api/portal-login", { method: "POST", body: { email, password } });
    const url = new URL(window.location.href);
    for (const key of ["demoRole", "demoYear", "demoPage"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    window.sessionStorage.setItem(portalCustomerTokenKey, session.token);
    customerPortalView = "home";
    customerWorkspaceStep = null;
    customerProductTab = "products";
    customerDataTab = "data";
    if (!await restorePortalCustomerSession({ focus: true })) throw new Error("登录已建立，但工作区读取失败，请重试");
  }

  window.addEventListener("lumino:staff-session-expired", () => {
    clearStaffSession();
    if (["sales", "ops"].includes(state.role)) {
      logout();
      setLoginStep("email");
      toast("登录已过期，请重新登录后查看正式线索收件箱。");
    }
  });

  function updateLoginEmailHint(email) {
    const hint = $("#loginEmailHint");
    const submit = $("#loginForm")?.querySelector('[data-step-panel="email"] button[type="submit"]');
    if (!hint) return;
    const value = String(email || "").trim();
    hint.classList.remove("is-error", "is-muted");
    if (!value) {
      hint.textContent = "";
      if (submit) submit.disabled = true;
      return;
    }
    if (!isValidWorkEmail(value)) {
      hint.textContent = "请输入完整的工作邮箱";
      hint.classList.add("is-error");
      if (submit) submit.disabled = true;
      return;
    }
    if (isStaffEmail(value)) {
      hint.textContent = "员工账号：继续后输入密码";
    } else {
      hint.textContent = "继续后输入密码；登录后进入企业工作台";
      hint.classList.add("is-muted");
    }
    if (submit) submit.disabled = false;
  }

  function setLoginStep(step, focus = false) {
    const screen = $("#loginScreen");
    const form = $("#loginForm");
    if (screen) screen.dataset.loginStep = step;
    if (form) form.dataset.step = step;
    form?.querySelectorAll("[data-step-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.stepPanel !== step;
    });
    const email = ($("#loginEmail")?.value || "").trim();
    if (step === "email") updateLoginEmailHint(email);
    if (step === "setup" && $("#setupEmailLabel")) $("#setupEmailLabel").textContent = email;
    if (focus) {
      const panel = form?.querySelector(`[data-step-panel="${step}"]`);
      const target = panel?.querySelector("input:not([type=checkbox])") || panel?.querySelector("h2");
      if (target?.tagName === "H2") target.tabIndex = -1;
      window.setTimeout(() => target?.focus(), 0);
    }
  }

  function syncLoginEmailLabels(email) {
    const node = document.getElementById("passwordEmailLabel");
    if (node) node.textContent = email;
  }

  $("#loginEmail")?.addEventListener("input", (event) => updateLoginEmailHint(event.target.value));
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const step = $("#loginForm").dataset.step || "email";
    const email = ($("#loginEmail")?.value || "").trim();
    if (step === "email") {
      if (!isValidWorkEmail(email)) { updateLoginEmailHint(email || " "); toast("请输入有效的工作邮箱"); return; }
      syncLoginEmailLabels(email);
      setLoginStep("password", true);
      return;
    }
    if (step === "password") {
      const errorNode = $("#loginPasswordError");
      errorNode.hidden = true;
      errorNode.textContent = "";
      const password = $("#loginPassword")?.value || "";
      if (password.length < 6) { toast("请输入至少 6 位密码"); return; }
      if (isStaffEmail(email)) {
        const submit = $("#loginForm")?.querySelector('[data-step-panel="password"] button[type="submit"]');
        const original = submit?.textContent || "登录";
        try {
          if (submit) { submit.disabled = true; submit.textContent = "登录中…"; }
          const profile = await staffPasswordLogin(email, password);
          saveStaffSession(profile);
          login(profile.role, { demo: false });
          toast(`已登录 ${profile.name || profile.email}，可查看线索收件箱`);
        } catch (error) {
          clearStaffSession();
          toast(error.message || "员工登录失败");
        } finally {
          if (submit) { submit.disabled = false; submit.textContent = original; }
        }
        return;
      }
      const submit = $("#loginForm")?.querySelector('[data-step-panel="password"] button[type="submit"]');
      const original = submit?.textContent || "登录";
      try {
        if (submit) { submit.disabled = true; submit.textContent = "登录中…"; }
        await portalCustomerPasswordLogin(email, password);
      } catch (error) {
        errorNode.textContent = error.message || "登录失败，请重试";
        errorNode.hidden = false;
        toast(error.message || "登录失败");
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = original; }
      }
      return;
    }
  });
  document.querySelectorAll("[data-login-back]").forEach((button) => {
    button.addEventListener("click", () => setLoginStep("email", true));
  });
  if (!localDemoPreview && $("#demoRoleSelect")) $("#demoRoleSelect").closest(".demo-role-select").hidden = true;
  $("#demoRoleSelect")?.addEventListener("change", (event) => {
    if (!localDemoPreview) return;
    const role = event.target.value;
    if (!role || !roleConfig[role]) return;
    event.target.value = "";
    if (!portalDemoBootstrap) {
      window.sessionStorage.setItem("lumino-portal-session-mode", "demo");
      window.sessionStorage.setItem("lumino-portal-session-role", role);
      window.location.reload();
      return;
    }
    login(role, { demo: true });
  });
  const sendResetToast = () => {
    toast("密码重置尚未开放，请联系企业管理员或 Lumino 服务人员。");
  };
  $("#forgotPassword")?.addEventListener("click", sendResetToast);
  $("#forgotPasswordInline")?.addEventListener("click", sendResetToast);
  $("#activateInvite")?.addEventListener("click", () => {
    setLoginStep("setup", true);
  });
  setLoginStep("email");

  $("#customerSetupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const errorNode = $("#customerSetupError");
    errorNode.hidden = true;
    if (!$("#customerTenantConfirmed").checked) { errorNode.textContent = "请先核对企业名称"; errorNode.hidden = false; return; }
    try {
      submit.disabled = true;
      const token = window.sessionStorage.getItem(portalCustomerTokenKey);
      await portalCustomerApi("/api/portal-workspace", {
        method: "POST", token,
        body: { serviceYear: Number($("#customerServiceYear").value), confirmedTenantName: $("#customerTenantName").value },
      });
      customerWorkspaceStep = "product";
      showCustomerWorkspace(await portalCustomerApi("/api/portal-workspace", { token }));
      setCustomerWorkspaceStep("product", true);
    } catch (error) {
      errorNode.textContent = error.message || "创建失败，请重试";
      errorNode.hidden = false;
      if (error.code === "AUTH_REQUIRED") { await revokePortalCustomerSession(); $("#portal").hidden = true; $("#loginScreen").hidden = false; setLoginStep("email"); }
    } finally {
      submit.disabled = false;
    }
  });
  document.querySelectorAll("[data-customer-step], [data-customer-step-target]").forEach((button) => {
    button.addEventListener("click", () => setCustomerWorkspaceStep(button.dataset.customerStep || button.dataset.customerStepTarget, true));
  });
  $("#portal")?.addEventListener("click", (event) => {
    if (!$("#portal").classList.contains("portal--real-customer")) return;
    const tab = event.target.closest("[data-customer-tab]");
    if (tab && customerPortalData) {
      const [view, section] = tab.dataset.customerTab.split(":");
      if (view === "products" && ["products", "facilities", "changes"].includes(section)) customerProductTab = section;
      else if (view === "data-calculation" && ["data", "results", "cost"].includes(section)) customerDataTab = section;
      else return;
      const project = customerPortalData.projects?.[0];
      const records = (customerPortalData.records || []).filter((record) => record.projectId === project?.id);
      const counts = Object.fromEntries(["product", "facility", "material_request", "production_link"].map((kind) => [kind, records.filter((record) => record.kind === kind).length]));
      renderTenantCbamDetails(customerPortalData, project, records, counts, customerProductTab, customerDataTab);
      document.querySelector(`[data-customer-tab="${view}:${section}"]`)?.focus();
      return;
    }
    const button = event.target.closest("[data-customer-view]");
    if (!button) return;
    if (button.dataset.customerSetupStep) setCustomerWorkspaceStep(button.dataset.customerSetupStep);
    setCustomerPortalView(button.dataset.customerView, true);
  });
  $("#customerTenantEditButton")?.addEventListener("click", () => {
    $("#customerTenantDisplay").hidden = true;
    $("#customerTenantEditForm").hidden = false;
    $("#customerTenantEditForm").elements.tenantName.focus();
  });
  $("#customerTenantEditCancel")?.addEventListener("click", () => {
    $("#customerTenantEditForm").hidden = true;
    $("#customerTenantDisplay").hidden = false;
    $("#customerTenantEditButton").focus();
  });
  $("#customerTenantEditForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorNode = form.querySelector('[role="alert"]');
    const submit = form.querySelector('button[type="submit"]');
    errorNode.hidden = true;
    try {
      submit.disabled = true;
      const token = window.sessionStorage.getItem(portalCustomerTokenKey);
      await portalCustomerApi("/api/portal-workspace", { method: "PATCH", token, body: { operation: "rename_tenant", tenantName: form.elements.tenantName.value } });
      showCustomerWorkspace(await portalCustomerApi("/api/portal-workspace", { token }));
      $("#customerTenantEditButton").focus();
    } catch (error) {
      errorNode.textContent = error.message || "修改失败，请重试";
      errorNode.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
  function resetCustomerProductionLinkForm() {
    const form = $("#customerProductionLinkForm");
    form.reset();
    delete form.dataset.recordId;
    form.querySelector('button[type="submit"]').textContent = "保存生产关系";
    $("#customerProductionLinkCancel").hidden = true;
  }
  $("#customerProductionLinkCancel")?.addEventListener("click", () => {
    resetCustomerProductionLinkForm();
    $("#customerProductionLinkForm").elements.productId.focus();
  });
  $("#customerProductionLinkForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $("#customerProductionLinkFeedback");
    const submit = form.querySelector('button[type="submit"]');
    const recordId = form.dataset.recordId;
    const token = window.sessionStorage.getItem(portalCustomerTokenKey);
    const projectId = customerPortalData?.projects?.[0]?.id;
    if (!projectId) { feedback.textContent = "请先建立年度项目。"; return; }
    try {
      submit.disabled = true;
      feedback.textContent = "";
      await portalCustomerApi("/api/portal-workspace", {
        method: recordId ? "PATCH" : "PUT", token,
        body: recordId
          ? { operation: "update_record", recordId, kind: "production_link", record: Object.fromEntries(new FormData(form)) }
          : { projectId, kind: "production_link", record: Object.fromEntries(new FormData(form)) },
      });
      resetCustomerProductionLinkForm();
      showCustomerWorkspace(await portalCustomerApi("/api/portal-workspace", { token }));
      feedback.textContent = recordId ? "生产关系已更新。" : "生产关系已保存。";
    } catch (error) {
      feedback.textContent = error.message || "保存失败，请重试。";
    } finally {
      submit.disabled = false;
    }
  });
  $("#customerMaterialPlanForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $("#customerMaterialPlanFeedback");
    const submit = form.querySelector('button[type="submit"]');
    const token = window.sessionStorage.getItem(portalCustomerTokenKey);
    const projectId = customerPortalData?.projects?.[0]?.id;
    if (!projectId) { feedback.textContent = "请先建立年度项目。"; return; }
    try {
      submit.disabled = true;
      feedback.textContent = "";
      const result = await portalCustomerApi("/api/portal-workspace", {
        method: "PUT", token,
        body: { operation: "create_material_request", projectId, facilityId: form.elements.facilityId.value, quarter: Number(form.elements.quarter.value) },
      });
      showCustomerWorkspace(await portalCustomerApi("/api/portal-workspace", { token }));
      feedback.textContent = result.created ? "材料计划草稿已保存，尚未发送。" : "该设施与季度的草稿已在计划中。";
      feedback.tabIndex = -1;
      feedback.focus({ preventScroll: true });
    } catch (error) {
      feedback.textContent = error.message || "保存失败，请重试。";
    } finally {
      submit.disabled = false;
    }
  });
  async function downloadCustomerEvidence(evidence, button) {
    const feedback = $("#customerEvidenceFeedback");
    const token = window.sessionStorage.getItem(portalCustomerTokenKey);
    try {
      button.disabled = true;
      feedback.textContent = "正在下载文件…";
      const response = await fetch(`/api/portal-evidence?evidenceId=${encodeURIComponent(evidence.id)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (!response.ok) throw new Error("文件下载失败，请重新登录或稍后重试。");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = evidence.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      feedback.textContent = "文件已下载。";
    } catch (error) { feedback.textContent = error.message || "文件下载失败。"; }
    finally { button.disabled = false; }
  }
  $("#customerEvidenceForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $("#customerEvidenceFeedback");
    const button = form.querySelector('button[type="submit"]');
    const file = form.elements.evidenceFile.files?.[0];
    if (!file || file.size < 1 || file.size > 2097152 || !/\.(txt|csv)$/i.test(file.name)) {
      feedback.textContent = "请选择不超过 2 MiB 的 TXT 或 CSV 文件。";
      return;
    }
    try {
      button.disabled = true;
      feedback.textContent = "正在上传文件…";
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
        reader.onerror = () => reject(new Error("无法读取文件，请重试。"));
        reader.readAsDataURL(file);
      });
      await portalCustomerApi("/api/portal-evidence", {
        method: "POST", token: window.sessionStorage.getItem(portalCustomerTokenKey),
        body: { materialRequestId: form.elements.materialRequestId.value, filename: file.name, base64 },
      });
      form.elements.evidenceFile.value = "";
      showCustomerWorkspace(await portalCustomerApi("/api/portal-workspace", { token: window.sessionStorage.getItem(portalCustomerTokenKey) }));
      feedback.textContent = "文件已保存为新版本，请核对用量。";
    } catch (error) { feedback.textContent = error.message || "上传失败，请重试。"; }
    finally { button.disabled = false; }
  });
  $("#customerCnSearch")?.addEventListener("input", renderCustomerCnPicker);
  $("#customerCnPasteAdd")?.addEventListener("click", () => {
    const raw = $("#customerCnPaste").value.trim();
    const tokens = [...new Set(raw.split(/[\s,，;；、]+/).filter(Boolean))];
    if (!customerCnCatalog.length) { $("#customerCnPasteFeedback").textContent = "CN 目录仍在加载，请稍后重试。"; return; }
    const known = new Set(customerCnCatalog.map((item) => item.cnCode));
    const missing = tokens.filter((code) => !known.has(code));
    const already = tokens.filter((code) => known.has(code) && (customerCnExisting.has(code) || customerCnSelected.has(code)));
    const valid = tokens.filter((code) => known.has(code) && !customerCnExisting.has(code) && !customerCnSelected.has(code));
    const room = 50 - customerCnSelected.size;
    for (const code of valid.slice(0, room)) customerCnSelected.add(code);
    $("#customerCnPasteFeedback").textContent = [
      `已加入 ${Math.min(valid.length, room)} 个待保存编码。`,
      already.length ? `${already.length} 个已保存或已在待保存清单中。` : "",
      missing.length ? `${missing.length} 个未在目录中找到：${missing.slice(0, 5).join("、")}${missing.length > 5 ? "…" : ""}。` : "",
      valid.length > room ? "本次最多保存 50 个，请先保存当前清单。" : "",
    ].filter(Boolean).join(" ");
    renderCustomerCnPicker();
  });
  $("#customerCnSave")?.addEventListener("click", async () => {
    const button = $("#customerCnSave");
    const feedback = $("#customerCnSaveFeedback");
    const token = window.sessionStorage.getItem(portalCustomerTokenKey);
    const projectId = $("#customerProjectSummary").dataset.projectId;
    const cnCodes = [...customerCnSelected];
    try {
      button.disabled = true;
      const result = await portalCustomerApi("/api/portal-workspace", { method: "PUT", token, body: { operation: "add_products", projectId, cnCodes } });
      customerCnSelected.clear();
      showCustomerWorkspace(await portalCustomerApi("/api/portal-workspace", { token }));
      feedback.textContent = `已保存 ${result.created.length} 个产品${result.skippedCodes.length ? `，${result.skippedCodes.length} 个已在项目中` : ""}。可在上方逐项修改企业内部名称。`;
      feedback.tabIndex = -1;
      feedback.focus({ preventScroll: true });
    } catch (error) {
      feedback.textContent = error.message || "保存失败，请重试。";
      if (error.code === "AUTH_REQUIRED") { await revokePortalCustomerSession(); $("#portal").hidden = true; $("#loginScreen").hidden = false; setLoginStep("email"); }
    } finally {
      button.disabled = customerCnSelected.size === 0;
    }
  });
  document.querySelectorAll("[data-customer-record]").forEach((form) => {
    form.querySelector("[data-customer-cancel]").addEventListener("click", () => resetCustomerRecordForm(form));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorNode = form.querySelector('[role="alert"]');
      const submit = form.querySelector('button[type="submit"]');
      errorNode.hidden = true;
      const token = window.sessionStorage.getItem(portalCustomerTokenKey);
      const projectId = $("#customerProjectSummary").dataset.projectId;
      const kind = form.dataset.customerRecord;
      const recordId = form.dataset.recordId;
      try {
        submit.disabled = true;
        const record = Object.fromEntries(new FormData(form));
        if (kind === "product" && !(await loadCustomerCnCatalog()).some((item) => item.cnCode === record.cnCode)) throw new Error("该 CN 码不在当前目录中，请先搜索并核对完整编码。");
        await portalCustomerApi("/api/portal-workspace", {
          method: recordId ? "PATCH" : "PUT", token,
          body: { ...(recordId ? { operation: "update_record", recordId } : { projectId }), kind, record },
        });
        resetCustomerRecordForm(form);
        showCustomerWorkspace(await portalCustomerApi("/api/portal-workspace", { token }));
        if (kind === "product") $("#customerProductManual summary").focus();
      } catch (error) {
        errorNode.textContent = error.message || "保存失败，请重试";
        errorNode.hidden = false;
        if (error.code === "AUTH_REQUIRED") { await revokePortalCustomerSession(); $("#portal").hidden = true; $("#loginScreen").hidden = false; setLoginStep("email"); }
      } finally {
        submit.disabled = false;
      }
    });
  });
  function closeAccountMenu() {
    const panel = $("#accountMenu");
    if (!panel) return;
    panel.hidden = true;
    $("#profileButton")?.setAttribute("aria-expanded", "false");
  }
  $("#profileButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const panel = $("#accountMenu");
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    $("#profileButton").setAttribute("aria-expanded", String(open));
  });
  $("#accountMenu")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-account-action], #logoutButton");
    if (!item) return;
    if (item.id === "logoutButton") { closeAccountMenu(); clearStaffSession(); void revokePortalCustomerSession(); logout(); setLoginStep("email"); return; }
    if (item.dataset.accountAction === "workspace") {
      closeAccountMenu();
      logout();
      setLoginStep("email");
      return;
    }
    if (item.dataset.accountAction === "settings") {
      closeAccountMenu();
      if (!canManageOrganization()) { toast("只有企业管理员可以打开企业设置。"); return; }
      setCustomerDestination(null, "org-settings");
      if (item.dataset.settingsSection) state.settingsSection = item.dataset.settingsSection;
      render();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".account-menu")) closeAccountMenu();
  });

  function cmdkTargets() {
    const pages = isCustomer()
      ? [...customerGlobalNav, ...activeServiceNav()].map(([id, , label]) => ({
        kind: "页面",
        label,
        hay: id,
        run: () => {
          if (globalCustomerPages.has(id)) setCustomerDestination(null, id);
          else state.page = id;
          render();
        },
      }))
      : (roleConfig[state.role]?.nav || []).map(([id, , label]) => ({
        kind: "页面",
        label,
        hay: id,
        run: () => { state.page = id; render(); },
      }));
    let tasks = [];
    let assets = [];
    let deliverables = [];
    try {
      if (isCustomer()) {
        const actor = roleConfig[state.role].name;
        const taskView = sharedCenterViews.tasks({ role: state.role, actor });
        tasks = (taskView.items || []).slice(0, 6).map((task) => ({
          kind: "任务",
          label: task.title,
          hay: `${task.serviceCode || ""} ${task.sourceId || ""} ${task.object || ""}`,
          run: () => {
            setCustomerDestination(task.serviceId, task.page);
            render();
          },
        }));
        const assetView = assetViews.overview({ role: state.role, serviceId: null, facet: "all" });
        assets = (assetView.items || []).slice(0, 6).map(({ asset }) => ({
          kind: "资产",
          label: asset.name,
          hay: `${asset.id || ""} ${asset.versionId || ""}`,
          run: () => {
            state.currentService = null;
            state.page = "shared-files";
            render();
            openDrawer("asset-detail", { assetId: asset.id, title: asset.name });
          },
        }));
        const deliveryView = sharedCenterViews.deliverables({ role: state.role, actor });
        deliverables = (deliveryView.items || []).slice(0, 6).map((item) => ({
          kind: "交付",
          label: item.name,
          hay: `${item.id || ""} ${item.serviceCode || ""}`,
          run: () => {
            setCustomerDestination(item.serviceId, item.page);
            render();
          },
        }));
      }
    } catch (_) {
      /* keep page-only palette if view models unavailable */
    }
    return [...pages, ...tasks, ...assets, ...deliverables];
  }

  function renderCmdk(query) {
    const q = String(query || "").trim().toLowerCase();
    const items = cmdkTargets()
      .filter((item) => !q || `${item.label} ${item.kind} ${item.hay || ""}`.toLowerCase().includes(q))
      .slice(0, 9);
    const host = $("#cmdkResults");
    if (!host) return;
    if (!items.length) {
      host.innerHTML = `<p class="cmdk-empty">没有匹配结果</p>`;
      return;
    }
    host.innerHTML = items.map((item, index) => `
      <button type="button" class="cmdk-item" role="option" data-cmdk-index="${index}">
        <strong>${safe(item.label)}</strong><span>${safe(item.kind)}</span>
      </button>`).join("");
    host.querySelectorAll(".cmdk-item").forEach((button, index) => {
      button.addEventListener("click", () => {
        items[index].run();
        closeCmdk();
      });
    });
  }

  function openCmdk() {
    if ($("#portal")?.hidden || $("#portal").classList.contains("portal--real-customer")) return;
    $("#cmdkLayer").hidden = false;
    $("#cmdkInput").value = "";
    renderCmdk("");
    $("#cmdkInput").focus();
  }
  function closeCmdk() {
    if ($("#cmdkLayer")) $("#cmdkLayer").hidden = true;
  }
  $("#cmdkTrigger")?.addEventListener("click", openCmdk);
  $("#cmdkBackdrop")?.addEventListener("click", closeCmdk);
  $("#cmdkInput")?.addEventListener("input", (event) => renderCmdk(event.target.value));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      if ($("#portal")?.hidden) return;
      event.preventDefault();
      openCmdk();
    }
    if (event.key === "Escape" && $("#cmdkLayer") && !$("#cmdkLayer").hidden) {
      event.preventDefault();
      closeCmdk();
    }
    if (event.key === "Enter" && !event.shiftKey && event.target?.id === "agentInput") {
      event.preventDefault();
      window.LuminoAgentRuntime?.sendComposer?.();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target?.id === "agentInput") state.agentInput = event.target.value;
  });
  document.addEventListener("change", (event) => {
    window.LuminoAgentRuntime?.handleAgentChange?.(event);
  });

  $("#settingsButton")?.addEventListener("click", () => {
    if (!canManageOrganization()) return;
    state.currentService = null;
    state.page = "org-settings";
    state.settingsSection = state.settingsSection || "members";
    render();
  });
  document.querySelector(".company-switch").addEventListener("click", () => {
    if ($("#portal").classList.contains("portal--real-customer")) return;
    if (canManageOrganization()) {
      state.currentService = null;
      state.page = "org-settings";
      state.settingsSection = state.settingsSection || "org";
      render();
      return;
    }
    openDrawer("record-detail", { title: isCustomer() ? "当前企业" : "当前工作区", object: isCustomer() ? state.organization.name : roleConfig[state.role].company, status: "由账号与授权决定", description: "正式产品会在这里切换你有权访问的企业或工作区；当前原型固定展示一个上下文。" });
  });
  $("#roleSelect").addEventListener("change", (event) => {
    state.role = event.target.value;
    state.demoWorkspace = true;
    window.sessionStorage.setItem("lumino-portal-session-role", state.role);
    window.sessionStorage.setItem("lumino-portal-session-mode", "demo");
    if (customerRoles.has(state.role)) { state.year = "2026"; state.quarter = "Q3"; }
    state.currentService = null;
    state.page = defaultPages[state.role];
    render();
    toast(`已切换为${iconLabel(state.role)}。正式产品将由账号权限决定。`);
  });
  $("#yearSelect").addEventListener("change", (event) => {
    if (event.target.value === "new") {
      state.page = "annual-setup";
      render();
      return;
    }
    savePeriodState();
    state.year = event.target.value;
    state.quarter = annualProfile().defaultQuarter;
    state.roadStage = null;
    if (state.currentService === "cbam" && state.year === "2027" && workflowEngine.get("AUTH-CBAM-2027-001")?.status !== "ACTIVE") state.page = "service-start";
    else if (state.page === "service-start") state.page = "work";
    loadPeriodState(); syncUiFromWorkflow();
    render();
    toast(`已切换到 ${state.year} 年度，页面数据与版本已整体切换。`);
  });
  $("#quarterSelect").addEventListener("change", (event) => {
    savePeriodState();
    state.quarter = event.target.value;
    loadPeriodState(); syncUiFromWorkflow();
    render();
    toast(`已切换到 ${state.year} ${state.quarter} 数据包；年度主档和年度报告不受影响。`);
  });
  $("#mobileMenu").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#mobileMenu").setAttribute("aria-expanded", String(open));
    $("#mobileMenu").setAttribute("aria-label", open ? "关闭导航" : "打开导航");
  });
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#drawerBackdrop").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (window.LuminoAgentRuntime?.trapFocus?.(event)) return;
    if (event.key === "Escape" && state.agentOpen && window.LuminoAgentRuntime) {
      event.preventDefault();
      window.LuminoAgentRuntime.closeAgent();
      return;
    }
    if (event.key === "Escape"
      && $("#drawerLayer").hidden
      && $("#cmdkLayer").hidden
      && state.serviceOverviewMode === "open") {
      setServiceOverviewMode("collapsed");
      return;
    }
    if ($("#drawerLayer").hidden) return;
    if (event.key === "Escape") { closeDrawer(); return; }
    if (event.key === "Tab") {
      const focusable = [...$("#drawer").querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("click", async (event) => {
    // Tenant pages own their controls. Demo handlers below must never interpret
    // a real customer's button as a sample workflow or open a sample drawer.
    if ($("#portal").classList.contains("portal--real-customer") && event.target.closest("#portal")) return;
    if (window.LuminoAgentRuntime?.handleAgentEvent?.(event)) return;
    const overviewAction = event.target.closest("[data-service-overview]");
    if (overviewAction) {
      setServiceOverviewMode(overviewAction.dataset.serviceOverview);
      return;
    }
    const settingsSection = event.target.closest("[data-settings-section]");
    if (settingsSection) {
      if (!canManageOrganization()) { toast("只有企业管理员可以维护企业设置。"); return; }
      state.currentService = null;
      state.page = "org-settings";
      state.settingsSection = settingsSection.dataset.settingsSection || "members";
      persistPortalState();
      render();
      return;
    }
    const closeDrawerButton = event.target.closest("[data-close-drawer]");
    if (closeDrawerButton) { closeDrawer(); return; }
    const drawerTrigger = event.target.closest("[data-drawer]");
    if (drawerTrigger) {
      openDrawer(drawerTrigger.dataset.drawer, {
        title: drawerTrigger.dataset.drawerLabel || drawerTrigger.textContent.trim(),
        eyebrow: drawerTrigger.dataset.drawerEyebrow,
        object: drawerTrigger.dataset.drawerObject,
        status: drawerTrigger.dataset.drawerStatus,
        owner: drawerTrigger.dataset.drawerOwner,
        scope: drawerTrigger.dataset.drawerScope,
        description: drawerTrigger.dataset.drawerDescription,
        action: drawerTrigger.dataset.drawerAction,
        submitLabel: drawerTrigger.dataset.drawerSubmit,
        flow: drawerTrigger.dataset.flow,
        serviceId: drawerTrigger.dataset.serviceId,
        assetId: drawerTrigger.dataset.assetId,
        runId: drawerTrigger.dataset.runId,
        delivId: drawerTrigger.dataset.delivId,
        itemId: drawerTrigger.dataset.itemId,
      });
      return;
    }
    const dataCat = event.target.closest("[data-data-cat]");
    if (dataCat) {
      state.dataCat = dataCat.dataset.dataCat || "all";
      persistPortalState();
      render();
      return;
    }
    const facetButton = event.target.closest("[data-asset-facet]");
    if (facetButton) {
      state.assetFacet = facetButton.dataset.assetFacet;
      persistPortalState();
      render();
      return;
    }
    const taskTab = event.target.closest("[data-task-tab]");
    if (taskTab) {
      state.taskTab = taskTab.dataset.taskTab;
      persistPortalState();
      render();
      return;
    }
    const delivFilter = event.target.closest("[data-deliv-filter]");
    if (delivFilter) {
      state.delivFilter = delivFilter.dataset.delivFilter;
      persistPortalState();
      render();
      return;
    }
    const serviceEntry = event.target.closest("[data-service-enter]");
    if (serviceEntry) {
      if (serviceEntry.closest("#serviceOverviewLayer")) state.serviceOverviewMode = "closed";
      setCustomerDestination(serviceEntry.dataset.serviceEnter, serviceEntry.dataset.pageTarget);
      persistPortalState(); render(); closeDrawer();
      $("#sidebar").classList.remove("open");
      $("#main").focus({ preventScroll: true });
      return;
    }
    const onboardingAction = event.target.closest("[data-onboarding-action]");
    if (onboardingAction) {
      const action = onboardingAction.dataset.onboardingAction;
      const actor = { name: roleConfig[state.role].name, role: state.role };
      try {
        if (action === "confirm-scope") {
          if (!canPerformPortalAction("cbam-confirm-annual-scope")) { toast(portalActionDenial("cbam-confirm-annual-scope")); return; }
          cbamGoldenPath.command("p03", "confirm", actor, { included: ["HRC", "HDG"], excluded: ["CRC"], exclusionReason: "2027 年尚无出口欧盟计划" });
          render(); toast("2027 年度范围已确认；王晨可开始制备监测计划。"); return;
        }
        const form = document.querySelector("#cbamOnboardingForm");
        const currentStep = Number(form?.dataset.step) || 1;
        const data = form ? new FormData(form) : new FormData();
        if (["next", "create"].includes(action) && form && !form.reportValidity()) return;
        if (action === "next" && currentStep === 3 && data.getAll("products").length === 0) {
          toast("请至少选择一个产品候选，再继续下一步。");
          return;
        }
        const payload = { step: currentStep };
        if (currentStep === 1) payload.startingPoint = data.get("startingPoint") || "new";
        if (currentStep === 2) {
          payload.cadence = data.get("cadence") || "quarterly";
          payload.importer = data.get("importer") || "";
          payload.firstDeadline = data.get("firstDeadline") || "";
        }
        if (currentStep === 3) payload.products = data.getAll("products");
        if (action === "create") {
          if (!canPerformPortalAction("cbam-create-annual-project")) { toast(portalActionDenial("cbam-create-annual-project")); return; }
          cbamGoldenPath.command("p02", "create", actor, payload);
          render(); toast("CBAM 2027 年度项目已创建并启动收资；Agent 现可协助整理本年度材料。"); return;
        }
        const targetStep = action === "prev" ? currentStep - 1 : action === "next" ? currentStep + 1 : currentStep;
        cbamGoldenPath.command("p02", "save-draft", actor, { ...payload, step: targetStep });
        if (action === "save-exit") state.page = "work";
        render();
        if (action === "save-exit") toast("年度项目草稿已保存。");
      } catch (error) { toast(error.recovery || error.message); }
      return;
    }
    const monitoringAction = event.target.closest("[data-monitoring-action]");
    if (monitoringAction) {
      const action = monitoringAction.dataset.monitoringAction;
      const actor = { name: roleConfig[state.role].name, role: state.role };
      const permission = action === "prepare" ? "cbam-prepare-monitoring-plan" : action === "review" ? "cbam-review-monitoring-plan" : action === "sign" ? "cbam-sign-monitoring-plan" : "cbam-draft-invitations";
      if (!canPerformPortalAction(permission)) { toast(portalActionDenial(permission)); return; }
      try {
        if (action === "prepare") cbamGoldenPath.command("p04", "prepare", actor);
        if (action === "review") cbamGoldenPath.command("p04", "review", actor);
        if (action === "sign") cbamGoldenPath.command("p04", "sign", actor);
        if (action === "draft-invitations") cbamGoldenPath.command("p05", "draft-invitations", actor);
        render();
        toast(action === "prepare" ? "制备确认完成；等待李娜独立复核。" : action === "review" ? "独立复核完成；已发布客户审阅版。" : action === "sign" ? "监测计划已签收；材料清单继续按当前版本同步维护。" : "邀请草稿已生成；未发送、未开通账号。");
      } catch (error) { toast(error.recovery || error.message); }
      return;
    }
    const activationAction = event.target.closest("[data-activation-action]");
    if (activationAction) {
      if (activationAction.dataset.activationAction === "continue") {
        state.cbamEntryMode = "annual-project";
        state.page = "annual-project";
        render();
        return;
      }
      const activation = workflowEngine.get("AUTH-CBAM-2027-001");
      if (!activation || activation.status !== "PENDING_CUSTOMER_CONFIRMATION") { toast("当前启动单不在客户确认阶段。"); return; }
      if (!["customer_owner", "customer_admin"].includes(state.role) || roleConfig[state.role].name !== activation.owner) { toast(`该启动单需由 ${activation.owner} 线上确认。`); return; }
      try {
        workflowEngine.transition(activation.id, "ACTIVE", { actor: roleConfig[state.role].name, role: state.role, reason: "客户企业管理员线上确认 2027 CBAM 服务启动", metadata: { customerConfirmedBy: roleConfig[state.role].name, customerConfirmedAt: new Date().toISOString() } });
        state.cbamEntryMode = "annual-project";
        state.page = "annual-project";
        render();
        toast("2027 CBAM 服务已启动；下一步创建年度项目。");
      } catch (error) { toast(error.message); }
      return;
    }
    const cbamSection = event.target.closest("[data-cbam-section]");
    if (cbamSection) {
      const section = cbamSection.dataset.cbamSection;
      if (["products", "facilities", "changes"].includes(section)) {
        state.cbamProductView = section;
        state.page = "products";
      } else {
        state.cbamDataView = section;
        state.page = "data-calculation";
      }
      persistPortalState();
      render();
      return;
    }
    const productImport = event.target.closest("[data-product-import]");
    if (productImport) {
      toast("原型已展示最近一次导入差异；正式版本会先校验模板并生成逐字段提案。");
      return;
    }
    const nav = event.target.closest("[data-page]");
    if (nav) {
      const page = nav.dataset.page;
      if (!canAccessPage(page)) {
        showForbiddenPage(page);
        toast("当前角色或服务范围无权进入该页面。");
        return;
      }
      if (globalCustomerPages.has(page)) {
        /* 一级全局轨：进入跨服务页时二级筛选回到第一项 */
        setCustomerDestination(null, page);
      } else {
        state.page = page;
      }
      if (page === "leads") state.leadsHydrated = false;
      if (page === "knowledge") state.knowledgeHydrated = false;
      persistPortalState(); render(); closeDrawer();
      $("#sidebar").classList.remove("open"); $("#mobileMenu").setAttribute("aria-expanded", "false"); $("#mobileMenu").setAttribute("aria-label", "打开导航"); $("#main").focus({ preventScroll: true }); return;
    }
    const knowledgeSelect = event.target.closest("[data-knowledge-select]");
    if (knowledgeSelect) {
      state.selectedKnowledgeId = knowledgeSelect.dataset.knowledgeSelect;
      render();
      return;
    }
    const knowledgeAction = event.target.closest("[data-knowledge-action]");
    if (knowledgeAction) {
      const action = knowledgeAction.dataset.knowledgeAction;
      const articleId = knowledgeAction.dataset.knowledgeId || state.selectedKnowledgeId;
      const actor = roleConfig[state.role].name;
      const client = window.LuminoKnowledgeClient;
      if (action === "refresh") {
        state.knowledgeHydrated = false;
        refreshKnowledgeArticles({ render: true });
        toast("正在刷新知识库…");
        return;
      }
      if (!client || !articleId) { toast("知识库客户端不可用。"); return; }
      const run = async () => {
        if (action === "publish") {
          const result = await client.patchArticle(articleId, { status: "published", actor, note: "发布到官网" });
          if (!result.ok) { toast(result.error || "发布失败"); return; }
          toast("已发布");
        } else if (action === "draft") {
          const result = await client.patchArticle(articleId, { status: "draft", actor, note: "改回草稿" });
          if (!result.ok) { toast(result.error || "更新失败"); return; }
          toast("已改为草稿");
        } else if (action === "archive") {
          const result = await client.patchArticle(articleId, { status: "archived", actor, note: "下架" });
          if (!result.ok) { toast(result.error || "下架失败"); return; }
          toast("已下架");
        } else if (action === "note") {
          const text = window.prompt("添加备注", "");
          if (!text || !text.trim()) return;
          const result = await client.patchArticle(articleId, { note: text.trim(), actor });
          if (!result.ok) { toast(result.error || "备注失败"); return; }
          toast("备注已保存");
        } else {
          return;
        }
        state.knowledgeHydrated = false;
        await refreshKnowledgeArticles({ render: true });
      };
      run();
      return;
    }
    const leadSelect = event.target.closest("[data-lead-select]");
    if (leadSelect) {
      state.selectedLeadId = leadSelect.dataset.leadSelect;
      render();
      return;
    }
    const leadAction = event.target.closest("[data-lead-action]");
    if (leadAction) {
      const action = leadAction.dataset.leadAction;
      const leadId = leadAction.dataset.leadId || state.selectedLeadId;
      const actor = roleConfig[state.role].name;
      const client = window.LuminoLeadsClient;
      if (action === "refresh") {
        state.leadsHydrated = false;
        refreshPublicLeads({ render: true });
        toast("正在刷新线索收件箱…");
        return;
      }
      if (!client || !leadId) { toast("线索客户端不可用。"); return; }
      const run = async () => {
        const currentLead = (Array.isArray(state.publicLeads) ? state.publicLeads : [])
          .find((lead) => lead.id === leadId) || null;
        const revision = currentLead?.revision;
        if (revision == null) {
          toast("线索版本未知，请先刷新收件箱后再操作。");
          return;
        }
        if (action === "claim") {
          const result = await client.patchLead(leadId, { status: "claimed", claimedBy: actor, actor, revision });
          if (!result.ok) { toast(result.error || "认领失败"); return; }
          toast(`已认领 ${leadId}`);
        } else if (action === "qualify") {
          const result = await client.patchLead(leadId, { status: "qualified", actor, note: "确认有服务意向", revision });
          if (!result.ok) { toast(result.error || "更新失败"); return; }
          toast("已标记为确认意向");
        } else if (action === "disqualify") {
          const result = await client.patchLead(leadId, { status: "disqualified", actor, note: "排除跟进", revision });
          if (!result.ok) { toast(result.error || "更新失败"); return; }
          toast("已排除该线索");
        } else if (action === "convert") {
          const result = await client.patchLead(leadId, { status: "converted", actor, note: "已线下跟进或转项目", revision });
          if (!result.ok) { toast(result.error || "更新失败"); return; }
          toast("已标记转化（可继续在报价/订单中开户）");
        } else if (action === "note") {
          const text = window.prompt("添加备注", "");
          if (!text || !text.trim()) return;
          const result = await client.patchLead(leadId, { note: text.trim(), actor, revision });
          if (!result.ok) { toast(result.error || "备注失败"); return; }
          toast("备注已保存");
        } else {
          return;
        }
        state.leadsHydrated = false;
        await refreshPublicLeads({ render: true });
      };
      run();
      return;
    }
    const answer = event.target.closest("[data-answer]");
    if (answer) {
      if (isLockedYear()) { toast("锁定年度不能原位修改；请先创建更正申请。"); return; }
      state.answer = answer.dataset.answer; state.questionHelpOpen = false; persistPortalState(); render(); toast(state.answer === "delegate" ? "任务已转交给生产负责人，并保留当前上下文。下一步可以继续核对产品。" : "回答已保存为待确认建议。下一步请核对产品与生产配置。"); return;
    }
    const pathChoice = event.target.closest("[data-path-choice]");
    if (pathChoice) { state.dataPathChoice = pathChoice.dataset.pathChoice; persistPortalState(); render(); return; }
    const delivery = event.target.closest("[data-delivery]");
    if (delivery) { state.deliveryExpanded = state.deliveryExpanded === delivery.dataset.delivery ? null : delivery.dataset.delivery; render(); return; }
    const product = event.target.closest("[data-product]");
    if (product) { state.selectedProduct = product.dataset.product; state.configurationAdded = false; render(); return; }
    const prodDecide = event.target.closest("[data-prod-decide]");
    if (prodDecide) {
      if (isLockedYear()) { toast("锁定年度为不可变快照；请通过更正申请创建新修订版。"); return; }
      const id = prodDecide.dataset.prodId;
      const decision = prodDecide.dataset.prodDecide;
      if (id && (decision === "in" || decision === "out")) {
        state.prodDec = { ...(state.prodDec || {}), [id]: decision };
        persistPortalState();
        render();
        toast(decision === "in"
          ? "已纳入年度范围，并标记为待专家确认生产配置。"
          : "已记录不纳入，理由将写入审计记录。");
      }
      return;
    }
    const prodAction = event.target.closest("[data-prod-action]");
    if (prodAction) {
      const action = prodAction.dataset.prodAction;
      if (action === "facilities") {
        if (canManageOrganization()) {
          state.currentService = null;
          state.page = "org-settings";
          state.settingsSection = "facilities";
          persistPortalState();
          render();
        } else {
          openDrawer("record-detail", {
            eyebrow: "设施主档",
            title: "上海一厂 · 无锡二厂",
            object: "跨服务共用 · FAC-HX-SH01 / FAC-HX-WX02",
            status: "只读摘要",
            description: "上海一厂（热轧、酸洗冷轧、热镀锌）在 CBAM 范围内；无锡二厂（精整与仓储）不在范围。完整增删改由企业管理员在「企业设置 → 设施」维护。",
          });
        }
        return;
      }
    }
    const prodScroll = event.target.closest("[data-prod-scroll]");
    if (prodScroll) {
      const pending = document.querySelector(".prod-row.is-pending");
      if (pending) pending.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const roadStageBtn = event.target.closest("[data-road-stage]");
    if (roadStageBtn) {
      const idx = Number(roadStageBtn.dataset.roadStage);
      if (Number.isInteger(idx) && idx >= 0 && idx <= 4) {
        state.roadStage = idx;
        persistPortalState();
        render();
      }
      return;
    }
    const roadAction = event.target.closest("[data-road-action]");
    if (roadAction) {
      const action = roadAction.dataset.roadAction;
      if (action === "plan-toast") {
        state.page = "monitoring-plan";
        render();
        return;
      }
    }
    const quarter = event.target.closest("[data-quarter]");
    if (quarter) {
      savePeriodState();
      state.quarter = quarter.dataset.quarter;
      const targetPage = quarter.dataset.pageTarget || quarter.dataset.page;
      if (targetPage) state.page = targetPage;
      loadPeriodState();
      syncUiFromWorkflow();
      render();
      toast(`正在查看 ${state.year} ${state.quarter} 数据包。`);
      return;
    }
    const workflowTransition = event.target.closest("[data-workflow-transition]");
    if (workflowTransition) {
      if (!canPerformPortalAction("workflow-approval")) {
        toast(portalActionDenial("workflow-approval"));
        return;
      }
      try {
        const target = workflowTransition.dataset.workflowTransition;
        const objectId = workflowTransition.dataset.objectId;
        if (objectId === "AP-2026-014" && target === "APPROVED" && cbamGoldenPath.stage("p07").code === "REVIEW_REQUIRED") {
          toast("需要由李娜先完成 RUN-CBAM-2026Q3-001 独立复核。");
          return;
        }
        workflowEngine.transition(objectId, target, { ...workflowActor(), reason: target === "APPROVED" ? "内部审批人同意默认值并行路径" : "退回项目协调人补充判断依据" });
        render();
        toast(`AP-2026-014 已更新为“${workflowStateLabel(target)}”，审计事件已记录。`);
      } catch (error) { toast(error.message); }
      return;
    }
    const customerAction = event.target.closest("[data-action]");
    if (customerAction) {
      const action = customerAction.dataset.action;
      if (!canPerformPortalAction(action)) {
        toast(portalActionDenial(action));
        return;
      }
      if (action === "asset-confirm") {
        try {
          const assetId = customerAction.dataset.assetId;
          assetRegistry.confirm(assetId, { ...workflowActor(), reason: "确认企业数据资产事实", basis: "核对来源、期间与数值" });
          openDrawer("asset-detail", { assetId });
          toast("企业事实已确认；依赖此资产的服务绑定不会自动改变。");
        } catch (error) { toast(error.message); }
      }
      if (action === "cbam-review-calculation") {
        try {
          cbamGoldenPath.command("p07", "review", { name: roleConfig[state.role].name, role: state.role });
          render();
          toast("RUN-CBAM-2026Q3-001 已由李娜复核；接下来等待赵海峰处理 AP-2026-014。");
        } catch (error) { toast(error.recovery || error.message); }
      }
      if (action === "cbam-reset-demo") {
        const accepted = window.confirm("将清除本浏览器的 Portal 演示状态和本机服务保存的 CBAM 账单，再恢复固定演示场景。继续吗？");
        if (!accepted) return;
        try {
          for (const request of workflowEngine.list({ type: "workPackage" }).filter((item) => item.metadata?.evidenceId)) {
            await saveIntakeRecord("delete", { requestId: request.id });
          }
        } catch (error) { toast(error.message || "本机证据清除失败，演示未重置。"); return; }
        ["lumino-multiservice-workflow-v2", "lumino-agent-tasks-v1", "lumino-multiservice-portal-ui-v2"].forEach((key) => portalPrototypeStorage.removeItem(key));
        window.location.reload();
        return;
      }
      if (action === "asset-revise-confirm") {
        try {
          const assetId = customerAction.dataset.assetId;
          const current = assetRegistry.get(assetId);
          assetRegistry.revise(assetId, {
            status: current?.status === "CONFIRMED" ? "NEEDS_CONFIRMATION" : (current?.status || "NEEDS_CONFIRMATION"),
            provenance: { ...(current?.provenance || {}), lastRevisionPreview: true },
          }, { ...workflowActor(), reason: "按影响预览创建资产修订版", expectedRevision: current?.revision });
          openDrawer("asset-detail", { assetId });
          toast("已创建新修订版；未锁定快照已标为过期，服务绑定未自动切换。");
        } catch (error) { toast(error.message); }
      }
      if (action === "pcf-confirm-scope") {
        try {
          const fields = document.querySelector("[data-pcf-declaration-fields]");
          if (!fields) throw Object.assign(new Error("找不到核算声明表单"), { code: "PCF_DECL_FORM_MISSING" });
          const read = (name) => fields.querySelector(`[name="${name}"]`)?.value?.trim() || "";
          const productId = read("productId");
          const product = assetRegistry.get(productId);
          const geoRaw = read("geography");
          const [geography, ...techParts] = geoRaw.split("·").map((part) => part.trim()).filter(Boolean);
          const draft = window.LuminoPcfDeclaration.normalize({
            productId,
            productName: product?.name || productId,
            goal: read("goal"),
            intendedUse: read("intendedUse"),
            audience: read("audience"),
            functionalUnit: read("functionalUnit"),
            referenceFlow: read("referenceFlow"),
            periodStart: read("periodStart"),
            periodEnd: read("periodEnd"),
            geography: geography || geoRaw,
            technology: techParts.join(" · "),
          });
          const confirmed = window.LuminoPcfDeclaration.confirm(draft, workflowActor());
          const scopeLabel = `${confirmed.productName} · ${confirmed.functionalUnit}`;
          moveWorkflow("PCF-2026-001", ["COLLECTING"], "客户确认 PCF 核算声明", {
            productId: confirmed.productId,
            declaration: confirmed,
          });
          workflowEngine.patch("PCF-2026-001", {
            scope: scopeLabel,
            metadata: { productId: confirmed.productId, declaration: confirmed },
          }, { ...workflowActor(), reason: "同步核算声明到服务案例范围字段" });
          state.page = "pcf-boundary";
          persistPortalState();
          render();
          toast("核算声明已确认并写入工作流。下一步确认系统边界。");
        } catch (error) {
          toast(error.message || "核算声明不完整");
        }
      }
      if (action === "pcf-apply-boundary-proposal") {
        try {
          const item = workflowEngine.get("PCF-2026-001");
          if (!item?.metadata?.declaration?.confirmed && item?.status === "SCOPING") {
            toast("请先确认核算声明，再采纳边界建议。");
            return;
          }
          const suggestion = window.LuminoPcfBoundary.suggest(item?.metadata?.declaration || {});
          const fields = document.querySelector("[data-pcf-boundary-fields]");
          if (!fields) throw Object.assign(new Error("找不到系统边界表单"), { code: "PCF_BOUNDARY_FORM_MISSING" });
          const proposal = suggestion.proposal;
          const setValue = (name, value) => {
            const el = fields.querySelector(`[name="${name}"]`);
            if (el && !el.disabled) el.value = value;
          };
          setValue("boundaryType", proposal.boundaryType);
          setValue("includedProcesses", (proposal.includedProcesses || []).join("、"));
          setValue("excludedItems", (proposal.excludedItems || []).join("、"));
          setValue("cutOffRule", proposal.cutOffRule || "");
          setValue("cutOffRationale", proposal.cutOffRationale || "");
          setValue("primaryInputs", (proposal.primaryInputs || []).join("、"));
          workflowEngine.patch("PCF-2026-001", {
            metadata: {
              boundary: window.LuminoPcfBoundary.normalize({
                ...proposal,
                functionalUnitRef: item?.metadata?.declaration?.functionalUnit || proposal.functionalUnitRef,
                status: "PROPOSED",
                confirmed: false,
                confirmedAt: null,
                confirmedBy: null,
              }),
            },
          }, { ...workflowActor(), reason: "采纳 Agent 边界建议到待确认草稿（proposal_only）" });
          toast("已填入 Agent 边界建议。请人工核对后确认，不会自动生效。");
        } catch (error) {
          toast(error.message || "无法应用边界建议");
        }
      }
      if (action === "pcf-confirm-boundary") {
        if (!assertStageGate("pcf", "declaration").ok) return;
        try {
          const fields = document.querySelector("[data-pcf-boundary-fields]");
          if (!fields) throw Object.assign(new Error("找不到系统边界表单"), { code: "PCF_BOUNDARY_FORM_MISSING" });
          const read = (name) => fields.querySelector(`[name="${name}"]`)?.value?.trim() || "";
          const item = workflowEngine.get("PCF-2026-001");
          const declaration = item?.metadata?.declaration || {};
          const confirmed = window.LuminoPcfBoundary.confirm({
            boundaryType: read("boundaryType"),
            functionalUnitRef: declaration.functionalUnit || read("functionalUnitRef"),
            includedProcesses: read("includedProcesses"),
            excludedItems: read("excludedItems"),
            cutOffRule: read("cutOffRule"),
            cutOffRationale: read("cutOffRationale"),
            primaryInputs: read("primaryInputs"),
            proposalId: item?.metadata?.boundary?.proposalId || null,
            promptId: item?.metadata?.boundary?.promptId || null,
          }, workflowActor());
          workflowEngine.patch("PCF-2026-001", {
            scope: `${declaration.productName || item?.scope || "PCF"} · ${confirmed.boundaryType}`,
            metadata: { boundary: confirmed },
          }, { ...workflowActor(), reason: "客户确认 PCF 系统边界" });
          state.page = "pcf-data";
          persistPortalState();
          render();
          toast("系统边界已确认并写入工作流。请继续活动数据采集。");
        } catch (error) {
          toast(error.message || "系统边界不完整");
        }
      }
      if (action === "pcf-confirm-factors") {
        if (!assertStageGate("pcf", "inventory").ok) return;
        try {
          const item = workflowEngine.get("PCF-2026-001");
          const factorCtx = typeof pcfFactorContext === "function" ? pcfFactorContext(item) : { declaration: item?.metadata?.declaration || {} };
          const draft = item?.metadata?.factors || window.LuminoPcfFactors.recommendSet(factorCtx);
          const confirmed = window.LuminoPcfFactors.confirm(draft, workflowActor());
          workflowEngine.patch("PCF-2026-001", { metadata: { factors: confirmed } }, { ...workflowActor(), reason: "确认系统推荐排放因子适用性" });
          persistPortalState();
          render();
          toast("已确认系统推荐因子的适用性。可以进入确定性计算。");
        } catch (error) {
          toast(error.message || "因子确认失败");
        }
      }
      if (action === "pcf-refresh-factor-recommendations") {
        if (!assertStageGate("pcf", "inventory").ok) return;
        try {
          const item = workflowEngine.get("PCF-2026-001");
          const factorCtx = typeof pcfFactorContext === "function" ? pcfFactorContext(item) : { declaration: item?.metadata?.declaration || {} };
          const recommended = window.LuminoPcfFactors.recommendSet(factorCtx);
          workflowEngine.patch("PCF-2026-001", { metadata: { factors: recommended } }, { ...workflowActor(), reason: "按匹配逻辑刷新排放因子推荐" });
          persistPortalState();
          render();
          toast(recommended.recommendation?.summary || "已刷新系统推荐因子。");
        } catch (error) {
          toast(error.message || "刷新推荐失败");
        }
      }
      if (action === "pcf-select-factor-alt") {
        if (!assertStageGate("pcf", "inventory").ok) return;
        try {
          const item = workflowEngine.get("PCF-2026-001");
          const needId = button.dataset.needId;
          const datasetId = button.dataset.datasetId;
          const factorCtx = typeof pcfFactorContext === "function" ? pcfFactorContext(item) : { declaration: item?.metadata?.declaration || {} };
          const draft = item?.metadata?.factors || window.LuminoPcfFactors.recommendSet(factorCtx);
          const next = window.LuminoPcfFactors.selectAlternative(draft, needId, datasetId);
          workflowEngine.patch("PCF-2026-001", { metadata: { factors: next } }, { ...workflowActor(), reason: `改选因子备选 ${datasetId}` });
          persistPortalState();
          render();
          toast("已改选备选因子。请确认适用性后继续计算。");
        } catch (error) {
          toast(error.message || "改选失败");
        }
      }
      if (action === "pcf-confirm-proposal") {
        if (!assertStageGate("pcf", "boundary").ok) return;
        try {
          const actor = { ...workflowActor(), reason: "确认 PCF 使用企业购入电力资产", basis: "核对期间、产品用途与证据引用" };
          ["BIND-REC-POWER-PCF", "BIND-EVD-POWER-PCF"].forEach((bindingId) => {
            const binding = assetRegistry.bindings({ id: bindingId })[0];
            if (binding && ["PROPOSED", "PENDING_CONFIRMATION"].includes(binding.status)) {
              assetRegistry.confirmBinding(bindingId, actor);
            }
          });
          ensureWorkflowObject({ id: "FACT-PCF-001-ELECTRICITY", type: "fact", status: "MISSING", owner: roleConfig[state.role].name, year: "2026", scope: "上海一厂购入电力", metadata: { serviceId: "pcf", assetId: "REC-HX-POWER-2026Q3", assetVersionId: assetRegistry.get("REC-HX-POWER-2026Q3")?.versionId } });
          moveWorkflow("FACT-PCF-001-ELECTRICITY", ["PROPOSED", "NEEDS_CONFIRMATION", "CONFIRMED"], "用户独立确认 PCF 服务绑定", { evidenceId: "EVD-HX-POWER-2026Q3", assetId: "REC-HX-POWER-2026Q3" });
          if (["SCOPING", "COLLECTING"].includes(workflowEngine.get("PCF-2026-001")?.status)) moveWorkflow("PCF-2026-001", ["NEEDS_CONFIRMATION"], "进入 PCF 绑定确认");
          const currentCase = workflowEngine.get("PCF-2026-001");
          if (!currentCase?.metadata?.factors) {
            workflowEngine.patch("PCF-2026-001", {
              metadata: { factors: window.LuminoPcfFactors.recommendSet(typeof pcfFactorContext === "function" ? pcfFactorContext(currentCase) : { declaration: currentCase?.metadata?.declaration || {} }) },
            }, { ...workflowActor(), reason: "绑定确认后生成排放因子草稿" });
          }
          moveWorkflow("PCF-2026-001", ["CALCULATING"], "PCF 服务绑定已确认"); state.page = "pcf-results"; persistPortalState(); render(); toast("PCF 绑定已确认；下一步请确认排放因子适用性。");
        } catch (error) { toast(error.message); }
      }
      if (action === "pcf-retry-calculation") { state.pcfCalculationFailed = false; render(); toast("排放因子已重新加载，可以再次运行计算。"); }
      if (action === "pcf-run-calculation") {
        if (!assertStageGate("pcf", "inventory").ok) return;
        if (!assertStageGate("pcf", "factors").ok) return;
        try {
          const actor = { ...workflowActor(), reason: "创建 PCF 输入快照并运行确定性计算" };
          const caseItem = workflowEngine.get("PCF-2026-001");
          const powerBinding = assetRegistry.bindings({ serviceId: "pcf", assetId: "REC-HX-POWER-2026Q3" })[0];
          const evidenceBinding = assetRegistry.bindings({ serviceId: "pcf", assetId: "EVD-HX-POWER-2026Q3" })[0];
          const bindingIds = [powerBinding?.id, evidenceBinding?.id].filter(Boolean);
          const power = assetRegistry.get("REC-HX-POWER-2026Q3");
          const factors = caseItem?.metadata?.factors || window.LuminoPcfFactors.recommendSet(typeof pcfFactorContext === "function" ? pcfFactorContext(caseItem) : { declaration: caseItem?.metadata?.declaration || {} });
          if (!assetRegistry.getSnapshot("SNAP-PCF-HRC-01")) {
            assetRegistry.createSnapshot({
              id: "SNAP-PCF-HRC-01",
              tenantId: "TNT-0018",
              serviceId: "pcf",
              caseId: "PCF-2026-001",
              bindingIds,
              transformationIds: ["ALLOC-HRC-ELECTRICITY@1"],
              status: "CURRENT",
            }, actor);
          }
          const inventory = window.LuminoPcfCalculation.buildDemoInventory({
            declaration: caseItem?.metadata?.declaration,
            boundary: caseItem?.metadata?.boundary,
            factors,
            power,
          });
          const calculation = window.LuminoPcfCalculation.buildResult({
            declaration: caseItem?.metadata?.declaration,
            boundary: caseItem?.metadata?.boundary,
            factors,
            power,
            inventory,
            inputMode: "demo_seed",
            formalUseAllowed: false,
            ruleVersion: `pcf-deterministic@${window.LuminoPcfCalculation.CALC_VERSION}`,
            snapshotId: "SNAP-PCF-HRC-01",
            runId: "ARUN-PCF-001",
            actor,
          });
          if (!assetRegistry.getCalculationRun("ARUN-PCF-001")) {
            assetRegistry.createCalculationRun({
              id: "ARUN-PCF-001",
              tenantId: "TNT-0018",
              serviceId: "pcf",
              caseId: "PCF-2026-001",
              snapshotId: "SNAP-PCF-HRC-01",
              status: "SUCCEEDED",
              ruleVersion: calculation.factorSetId,
              workflowObjectId: "RUN-PCF-001",
              resultSummary: {
                total: String(calculation.total),
                unit: calculation.unit,
                stages: calculation.stages,
                hotspots: calculation.hotspots,
                lineItemCount: calculation.lineItems.length,
                inputMode: calculation.inputMode,
                formalUseAllowed: calculation.formalUseAllowed,
                dataQuality: calculation.dataQuality,
              },
            }, actor);
          }
          assetRegistry.markCurrent("ARUN-PCF-001", { ...workflowActor(), reason: "设为当前 PCF 计算结果" });
          ensureWorkflowObject({ id: "RUN-PCF-001", type: "calculationRun", status: "QUEUED", owner: "PCF Agent", year: "2026", dependsOn: ["FACT-PCF-001-ELECTRICITY"], metadata: { serviceId: "pcf", rulepack: calculation.factorSetId, assetSnapshotId: "SNAP-PCF-HRC-01", assetRunId: "ARUN-PCF-001" } });
          moveWorkflow("RUN-PCF-001", ["RUNNING", "SUCCEEDED", "CURRENT"], "使用确认资产版本和固定因子集完成 PCF Run 01");
          ensureWorkflowObject({
            id: "PCF-RPT-2026-001-R1",
            type: "formalArtifact",
            status: "DRAFT",
            owner: "PCF 专家",
            year: "2026",
            scope: caseItem?.metadata?.declaration?.productName || "热轧非合金钢卷",
            metadata: {
              serviceId: "pcf",
              artifactType: "PCF_REPORT",
              calculationRunId: "RUN-PCF-001",
              assetSnapshotId: "SNAP-PCF-HRC-01",
              assetRunId: "ARUN-PCF-001",
              factorSetId: calculation.factorSetId,
            },
          });
          if (workflowEngine.get("PCF-RPT-2026-001-R1")?.status === "DRAFT") {
            moveWorkflow("PCF-RPT-2026-001-R1", ["GENERATED", "VALIDATED", "INTERNAL_REVIEW"], "生成报告草稿并提交独立复核");
          }
          workflowEngine.patch("PCF-2026-001", {
            metadata: { calculation },
          }, { ...workflowActor(), reason: "写入结构化计算与热点结果" });
          moveWorkflow("PCF-2026-001", ["EXPERT_REVIEW"], "确定性计算草稿已生成并进入专家复核");
          state.page = "pcf-report";
          persistPortalState();
          render();
          toast(`PCF 演示计算已生成（${calculation.total} ${calculation.unit}）。输入快照 SNAP-PCF-HRC-01 已固定资产版本；当前清单仅用于验证流程，不可正式披露。`);
        } catch (error) { toast(error.message); }
      }
      if (action === "pcf-complete-review") {
        if (!assertStageGate("pcf", "calc-hotspot").ok) return;
        try {
          const caseItem = workflowEngine.get("PCF-2026-001");
          if (assetRegistry.getSnapshot("SNAP-PCF-HRC-01")?.status !== "LOCKED") {
            assetRegistry.lockSnapshot("SNAP-PCF-HRC-01", { ...workflowActor(), reason: "专家复核完成，锁定报告输入快照" });
          }
          ensureWorkflowObject({
            id: "PCF-RPT-2026-001-R1",
            type: "formalArtifact",
            status: "DRAFT",
            owner: "PCF 专家",
            year: "2026",
            scope: caseItem?.metadata?.declaration?.productName || "热轧非合金钢卷",
            metadata: { serviceId: "pcf", artifactType: "PCF_REPORT", calculationRunId: "RUN-PCF-001", assetSnapshotId: "SNAP-PCF-HRC-01", assetRunId: "ARUN-PCF-001" },
          });
          const report = workflowEngine.get("PCF-RPT-2026-001-R1");
          if (report?.status === "DRAFT") moveWorkflow("PCF-RPT-2026-001-R1", ["GENERATED", "VALIDATED", "INTERNAL_REVIEW"], "生成报告草稿并提交独立复核");
          if (workflowEngine.get("PCF-RPT-2026-001-R1")?.status === "INTERNAL_REVIEW") {
            moveWorkflow("PCF-RPT-2026-001-R1", ["APPROVED"], "独立复核员批准方法、证据与计算血缘");
            workflowEngine.transition("PCF-RPT-2026-001-R1", "LOCKED", { ...workflowActor(), reason: "锁定 PCF 报告 Rev 1", metadata: { snapshotId: "SNAP-PCF-HRC-01" } });
          }
          const snapshot = assetRegistry.getSnapshot("SNAP-PCF-HRC-01");
          const run = assetRegistry.getCalculationRun("ARUN-PCF-001");
          const reportLock = window.LuminoPcfReportLock.buildLockInventory({
            declaration: caseItem?.metadata?.declaration,
            boundary: caseItem?.metadata?.boundary,
            template: caseItem?.metadata?.template,
            factors: caseItem?.metadata?.factors,
            calculation: caseItem?.metadata?.calculation,
            snapshot,
            run,
            bindings: [
              assetRegistry.bindings({ id: "BIND-REC-POWER-PCF" })[0],
              assetRegistry.bindings({ id: "BIND-EVD-POWER-PCF" })[0],
            ].filter(Boolean),
            reportId: "PCF-RPT-2026-001-R1",
            reportRevision: "Rev 1",
            actor: workflowActor(),
          });
          workflowEngine.patch("PCF-2026-001", {
            metadata: { reportLock, calculation: { ...(caseItem?.metadata?.calculation || {}), status: "LOCKED" } },
          }, { ...workflowActor(), reason: "写入报告锁定输入版本清单" });
          workflowEngine.patch("PCF-RPT-2026-001-R1", {
            metadata: { reportLock, lockedInputCount: reportLock.items.length },
          }, { ...workflowActor(), reason: "报告对象挂载锁定清单" });
          moveWorkflow("PCF-2026-001", ["DELIVERABLE_READY"], "独立复核完成且报告版本已锁定");
          persistPortalState();
          render();
          toast(reportLock.formalUseAllowed
            ? `独立复核已完成。报告 Rev 1 已锁定 ${reportLock.items.length} 项输入版本。`
            : `原型复核流程已完成。演示报告 Rev 1 已锁定 ${reportLock.items.length} 项输入，不可对外交付。`);
        } catch (error) { toast(error.message); }
      }
      if (action === "dismiss-onboarding") { state.onboardingDismissed = true; portalPrototypeStorage.setItem("lumino-portal-onboarding", "dismissed"); render(); toast("快速引导已收起；可随时从“操作指南”查看完整流程。"); }
      if (action === "start-onboarding") { state.onboardingDismissed = true; portalPrototypeStorage.setItem("lumino-portal-onboarding", "dismissed"); render(); document.querySelector(".agent-task")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
      if (action === "replay-onboarding") { state.onboardingDismissed = false; portalPrototypeStorage.removeItem("lumino-portal-onboarding"); state.page = "work"; render(); document.querySelector(".onboarding-guide")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
      if (isLockedYear() && ["mock-upload", "toggle-product-form", "add-configuration", "edit-product", "confirm-fact", "resolve-finding"].includes(action)) { toast("锁定年度为不可变快照；请通过更正申请创建新修订版。"); return; }
      if (action === "open-year-setup") { state.page = "annual-setup"; render(); }
      if (action === "enter-program") {
        savePeriodState();
        state.year = customerAction.dataset.year || "2026";
        state.quarter = annualProfile().defaultQuarter;
        state.page = "work";
        loadPeriodState(); syncUiFromWorkflow();
        render();
        toast(`已进入 ${state.year} 年度项目协调视图。`);
      }
      if (action === "review-trial") { state.page = "products"; render(); toast("试算信息已作为待核对线索带入，不会直接写入正式数据。"); }
      if (action === "mock-upload") openDrawer("upload-evidence");
      if (action === "explain-question") { state.questionHelpOpen = !state.questionHelpOpen; render(); }
      if (action === "revise-answer") { state.answer = null; persistPortalState(); render(); toast("可以重新回答；原建议尚未写入正式数据。"); }
      if (action === "toggle-product-form") openDrawer("new-product");
      if (action === "add-configuration") openDrawer("new-configuration");
      if (action === "edit-product") {
        const selected = { ...({
          hrc: { name: "热轧非合金钢卷", code: "HRC-01" },
          coated: { name: "镀层钢板", code: "CTS-01" },
          section: { name: "型钢", code: "SEC-01" },
          wire: { name: "非合金钢盘条", code: "WRD-01" },
          cold: { name: "冷轧非合金钢板", code: "CRS-02" },
        }[state.selectedProduct] || { name: "热轧非合金钢卷", code: "HRC-01" }), ...(state.productOverrides[state.selectedProduct] || {}) };
        openDrawer("edit-product", { name: selected.name, code: selected.code });
      }
      if (action === "toggle-org-edit") openDrawer("organization-edit");
      if (action === "confirm-fact") {
        if (!assertStageGate("cbam", "scope-codes").ok) return;
        try {
          if (!canPerformPortalAction("cbam-confirm-quarter-data")) throw Object.assign(new Error(portalActionDenial("cbam-confirm-quarter-data")), { code: "FORBIDDEN" });
          const request = currentIntakeRequest();
          if (!request) throw Object.assign(new Error("当前期间没有可确认的材料请求。"), { code: "MATERIAL_REQUEST_REQUIRED" });
          const candidate = currentIntakeCandidate(request.id);
          if (!candidate) throw Object.assign(new Error("当前页面会话没有待确认候选，请重新上传演示账单。"), { code: "CANDIDATE_NOT_FOUND" });
          const evidenceId = candidate.evidenceId;
          const factId = `FACT-${state.year}-${state.quarter}-GAS`;
          const gasAssetId = candidate.assetId;
          const actor = { ...intakeActor(), reason: "确认能源账单演示提取结果并写入企业资产池" };
          const evidence = intakeEvidenceStore.get({ evidenceId, tenantId: intakeTenantId, actor });
          window.LuminoIntakeModel.assertConfirmAllowed({ candidate, evidence, request: { ...request, tenantId: request.metadata?.tenantId || intakeTenantId }, actor, expectedRevision: candidate.revision });
          const evidenceAsset = assetRegistry.get(evidenceId);
          const gasAsset = assetRegistry.get(gasAssetId);
          const gasBindingId = `BIND-${candidate.id}`;
          const gasBinding = assetRegistry.bindings({ id: gasBindingId })[0];
          if (!evidenceAsset || !gasAsset || !gasBinding) throw Object.assign(new Error("候选资产或绑定不完整，请重新上传演示账单。"), { code: "INTAKE_ASSET_MISSING" });
          if (evidenceAsset.subjectRefs?.facilityId !== candidate.facilityAssetId || gasAsset.subjectRefs?.facilityId !== candidate.facilityAssetId || gasBinding.scopeId !== candidate.facilityAssetId || gasBinding.assetId !== gasAssetId || gasAsset.payload?.originalValue !== candidate.proposedPatch.originalValue || gasAsset.provenance?.sourceAssetIds?.[0] !== evidenceId) throw Object.assign(new Error("候选与设施、证据或资产不一致，请重新上传。"), { code: "INTAKE_ASSET_MISMATCH" });
          await saveIntakeRecord("confirm", { requestId: request.id, candidateId: candidate.id, revision: candidate.revision, actor: actor.actor });
          if (assetRegistry.get(gasAssetId)?.status !== "CONFIRMED") {
            assetRegistry.confirm(gasAssetId, { ...actor, basis: "核对候选数值、单位、账期与设施" });
          }
          if (assetRegistry.get(evidenceId)?.status !== "CONFIRMED") assetRegistry.confirm(evidenceId, { ...actor, basis: "核对文件摘要、账期与材料请求" });
          if (assetRegistry.bindings({ id: gasBindingId })[0]?.status !== "CONFIRMED") assetRegistry.confirmBinding(gasBindingId, { ...actor, basis: "确认当前候选纳入 CBAM 季度核算" });
          moveWorkflow(evidenceId, ["CLASSIFIED", "LINKED", "REVIEWED", "ACCEPTED"], "具名客户确认证据、候选和材料请求血缘", { requestId: request.id, candidateId: candidate.id, candidateRevision: candidate.revision });
          ensureWorkflowObject({ id: factId, type: "fact", status: "MISSING", owner: roleConfig[state.role].name, year: state.year, quarter: state.quarter, scope: "天然气用量", metadata: { serviceId: "cbam" } });
          workflowEngine.patch(factId, { scope: `${assetRegistry.get(candidate.facilityAssetId)?.name || candidate.facilityAssetId}天然气用量`, metadata: { serviceId: "cbam", requestId: request.id, evidenceId, candidateId: candidate.id, candidateRevision: candidate.revision, assetId: gasAssetId, facilityAssetId: candidate.facilityAssetId, value: candidate.proposedPatch.originalValue, unit: candidate.proposedPatch.originalUnit, confirmedBy: actor.actor } }, { ...workflowActor(), reason: "将当前候选版本绑定到业务事实" });
          moveWorkflow(factId, ["PROPOSED", "NEEDS_CONFIRMATION", "CONFIRMED"], "已将通过复核的候选确认为本期业务事实", { requestId: request.id, evidenceId, candidateId: candidate.id, candidateRevision: candidate.revision, assetId: gasAssetId });
          workflowEngine.invalidateDependents(factId, { ...workflowActor(), reason: `事实 ${factId} 已确认，原当前计算版本失效` });
          intakeCandidateStore.confirm({ candidateId: candidate.id, tenantId: intakeTenantId, expectedRevision: candidate.revision, actor });
          workflowEngine.patch(request.id, { metadata: { ...request.metadata, evidenceId, candidateId: candidate.id, candidateRevision: candidate.revision, intakeStatus: "CONFIRMED" } }, { ...workflowActor(), reason: "材料请求完成具名确认" });
          const runId = `RUN-05-${state.year}-${state.quarter}`;
          ensureWorkflowObject({ id: runId, type: "calculationRun", status: "QUEUED", owner: "王晨", year: state.year, quarter: state.quarter, dependsOn: [factId], metadata: { rulepack: `EU-CBAM-${state.year}.1`, activityAssetId: gasAssetId } });
          moveWorkflow(runId, ["RUNNING", "SUCCEEDED", "CURRENT"], "以已确认事实创建新计算版本");
          state.factConfirmed = true; persistPortalState(); closeDrawer(); render(); toast("Q3 能源用量已确认", "生成企业事实 v1 · 下一步：确认 Q3 产量");
        } catch (error) { toast(error.message); }
      }
      if (action === "resolve-finding") { state.findingChoiceOpen = true; render(); document.querySelector(".decision-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
      if (action === "close-path-choice") { state.findingChoiceOpen = false; state.dataPathChoice = null; persistPortalState(); render(); }
      if (action === "confirm-data-path" && state.dataPathChoice) {
        try {
          moveWorkflow("FND-PRE-004", ["TRIAGED", "ASSIGNED", "RESPONSE_SUBMITTED", "VALIDATING"], `客户已选择数据处理路径：${state.dataPathChoice}`, { path: state.dataPathChoice });
          const packageId = `PKG-${state.year}-${state.quarter}-NORDWERK`;
          if (workflowEngine.get(packageId)?.status === "COLLECTING") moveWorkflow(packageId, ["READY_FOR_REVIEW"], "本季度关键事实和数据路径已确认");
          state.findingResolved = true; state.findingChoiceOpen = false; persistPortalState(); render(); toast("处理路径已提交并进入专家验证；Finding 尚未关闭。");
        } catch (error) { toast(error.message); }
      }
      if (action === "advance-workflow") {
        const flow = workflowView(customerAction.dataset.flow);
        const target = customerAction.dataset.target;
        if (["ACKNOWLEDGED", "LOCKED", "CLOSED"].includes(target)) { toast("该关键状态需要回执、快照或解决依据，不能快速推进。"); return; }
        try {
          workflowEngine.transition(flow.object.id, target, { ...workflowActor(), reason: `从状态中心执行下一步：${workflowStateLabel(target)}` });
          closeDrawer(); render(); toast(`${flow.object.id} 已推进至“${workflowStateLabel(target)}”。`);
        } catch (error) { toast(error.message); }
      }
      if (action === "document-preview") openDrawer("document-preview");
      if (action === "invite-member") openDrawer("invite-member");
      if (action === "confirm-output") {
        state.outputConfirmed = true;
        persistPortalState();
        closeDrawer();
        render();
        toast("Q3 产量已确认", "热轧非合金钢卷累计产量 → 企业已确认");
      }
      if (action === "demo-fix-field") {
        toast(`修正 ${customerAction.dataset.field || "字段"}`, "原型中修正会打开字段编辑，并保留 Agent 原值以供对照。");
      }
      if (action === "demo-calc-rerun") {
        closeDrawer();
        toast("演示：已记录重新计算请求", "正式引擎与 Run-0418 写入逻辑稍后接入。");
      }
      if (action === "demo-share-package") {
        closeDrawer();
        toast("演示：数据包已标记为待共享", "正式共享与回执逻辑稍后接入。");
      }
      if (action === "create-year") {
        savePeriodState();
        years["2028"] = { label: "2028 · 变化确认", short: "变化确认中", progress: 8, chip: "warn" };
        state.year = "2028";
        state.yearCreated = true;
        state.page = "programs";
        loadPeriodState(); syncUiFromWorkflow(); persistPortalState();
        render();
        toast("2028 年度已创建：只带入结构建议，未复制年度数值。可从列表进入协调视图确认变化。");
      }
      return;
    }
    const action = event.target.closest("[data-staff-action]");
    if (action) {
      openDrawer("generic-action", {
        eyebrow: `${iconLabel(state.role).toUpperCase()} ACTION`,
        title: action.textContent.trim() || "完成操作",
        description: `${action.dataset.staffAction}。请补充判断或处理依据；对象、操作者和时间会写入审计记录。`,
        submitLabel: action.textContent.trim().includes("通过") ? "确认通过" : "确认并记录",
      });
      return;
    }
    const detailButton = event.target.closest("button");
    const detailMessages = {
      "查找重复": "已扫描产品名称、编码和年度范围，未发现重复项。",
      "责任人 ▾": "责任人筛选包含财务、采购、生产和项目协调人。",
      "查看计算假设": "已打开 Run 05 的证书价格、默认值、benchmark 和汇率假设。",
      "查看完整计算血缘 →": "已打开从业务事实、证据到 Calculation Run 05 的完整血缘。",
      "查看权限矩阵 →": "已打开企业、年度、设施和数据敏感级别权限矩阵。",
    };
    if (detailButton && detailMessages[detailButton.textContent.trim()]) {
      openDrawer(detailButton.textContent.includes("权限") ? "permission-audit" : "record-detail", {
        title: detailButton.textContent.trim().replace(" →", ""),
        description: detailMessages[detailButton.textContent.trim()],
      });
      return;
    }
    if (detailButton && detailButton.closest("#main")) {
      openDrawer("record-detail", {
        title: detailButton.textContent.trim().replace(" ▾", "").replace(" →", "") || "查看详情",
        description: "此入口在原型中展示当前对象、角色权限和下一步。正式产品将根据筛选或所选记录加载对应数据。",
      });
    }
  });

  document.addEventListener("submit", async (event) => {
    const activeDrawerForm = event.target.closest("[data-drawer-form]");
    if (activeDrawerForm) {
      event.preventDefault();
      if (state.actionBusy) return;
      state.actionBusy = true;
      const submitButton = activeDrawerForm.querySelector('[type="submit"]');
      if (submitButton) { submitButton.disabled = true; submitButton.dataset.originalLabel = submitButton.textContent; submitButton.textContent = "正在保存…"; }
      const id = activeDrawerForm.dataset.drawerForm;
      const formData = new FormData(activeDrawerForm);
      const title = $("#drawerTitle").textContent;
      if (id === "service-consultation") {
        const phone = String(formData.get("phone") || "").trim();
        const email = String(formData.get("email") || "").trim();
        if (!phone && !email) {
          state.actionBusy = false;
          if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
          toast("请至少填写联系电话或联系邮箱。"); return;
        }
        if (!state.online) {
          state.actionBusy = false;
          if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
          toast("当前离线，咨询内容已保留在表单中；联网后可再次提交。"); return;
        }
        const serviceId = String(formData.get("serviceId") || "");
        const duplicate = state.consultationRequests.some((request) => request.serviceId === serviceId && request.status === "submitted");
        if (duplicate) {
          state.actionBusy = false; closeDrawer();
          toast("该服务的咨询已提交，无需重复发送。"); return;
        }
        state.consultationRequests.push({ id: `CONSULT-${Date.now()}`, serviceId, portalRole: state.role, requestType: "service_consultation", organization: { ...state.organization }, context: { serviceId, portalRole: state.role, requestType: "service_consultation", organization: { ...state.organization } }, user: roleConfig[state.role].name, needs: String(formData.get("needs") || ""), preferredAt: String(formData.get("preferredAt") || ""), phone, email, status: "submitted" });
        persistPortalState(); state.actionBusy = false; closeDrawer(); render();
        toast("咨询请求已在原型中记录，顾问将按期望时间联系。"); return;
      }
      if (id === "pcf-upload") {
        if (!assertStageGate("pcf", "boundary").ok) {
          state.actionBusy = false;
          if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
          return;
        }
        const file = formData.get("file");
        const supportFileCount = activeDrawerForm.querySelector('[name="supportFiles"]')?.files?.length || 0;
        const filename = file?.name || "Lumino_PCF_数据采集模板_HRC-01.xlsx";
        const templateVersion = String(formData.get("templateVersion") || "PCF-DATA-PACK-1.0");
        const scenario = String(formData.get("validationScenario") || "valid");
        const validation = window.LuminoPcfTemplate.validateUpload({
          filename,
          templateVersion,
          supportFileCount,
          scenario,
        });
        ensureWorkflowObject({
          id: "EVD-PCF-DATAPACK-001",
          type: "evidence",
          status: "UPLOADED",
          owner: roleConfig[state.role].name,
          year: "2026",
          scope: "PCF 数据包",
          metadata: {
            serviceId: "pcf",
            referencedBy: ["pcf", "cbam"],
            filename,
            materialType: "PCF 数据包",
            templateVersion,
            supportFileCount,
            validationScenario: scenario,
            assetId: "EVD-HX-POWER-2026Q3",
            activityAssetId: "REC-HX-POWER-2026Q3",
            productAssetId: "PRD-HRC-01",
          },
        });
        if (validation.status === "INVALID") {
          workflowEngine.patch("PCF-2026-001", { metadata: { template: validation } }, { ...workflowActor(), reason: "PCF 模板校验未通过" });
          state.currentService = "pcf";
          state.page = "pcf-data";
          persistPortalState();
          state.actionBusy = false;
          closeDrawer();
          render();
          toast(`模板校验未通过：${validation.issues.map((item) => item.message).join("；")}`);
          return;
        }
        try {
          const serialNo = `pcf-datapack-EVD-PCF-DATAPACK-001-${scenario}`;
          const existing = agentTaskEngine.getBySerialNo(serialNo);
          if (existing) {
            // allow re-upload demos by using unique serial when prior task exists
          }
          const task = agentTaskEngine.submit({
            serialNo: existing ? `${serialNo}-${Date.now()}` : serialNo,
            businessType: "PCF_DATA_PACK_VALIDATE",
            tenantId: "TNT-0018",
            caseId: "PCF-2026-001",
            input: { evidenceId: "EVD-PCF-DATAPACK-001", templateVersion, supportFileCount, filename, scenario, validationStatus: validation.status },
          }, { actor: roleConfig[state.role].name });
          const power = assetRegistry.get("REC-HX-POWER-2026Q3");
          const pendingResult = {
            proposals: [{
              proposalId: "PROP-PCF-POWER-BIND",
              assetId: "REC-HX-POWER-2026Q3",
              targetAssetType: "energyConsumption",
              tenantId: "TNT-0018",
              ownerOrganizationId: "ORG-HX-001",
              name: power?.name || "上海一厂购入电力",
              sourceAssetIds: ["EVD-HX-POWER-2026Q3"],
              proposedPatch: power?.payload || {},
              reviseIfExists: false,
              binding: { id: "BIND-REC-POWER-PCF", serviceId: "pcf", caseId: "PCF-2026-001", usagePurpose: "产品活动数据", scopeId: "PRD-HRC-01" },
            }],
            summary: validation.status === "VALIDATED_PARTIAL"
              ? "模板部分通过；能源域仍有缺口，仅生成待确认绑定"
              : "模板结构校验通过；提出 PCF 服务绑定待确认",
            partial: validation.status === "VALIDATED_PARTIAL",
            warnings: validation.status === "VALIDATED_PARTIAL" ? ["能源域仍有 1 项待补"] : [],
          };
          setSubmitBusyLabel(submitButton, "校验中…");
          toast(`Agent 任务 ${task.id} 已提交，正在轮询…`);
          runAgentTaskWithPolling({
            taskId: task.id,
            pendingResult,
            onStatus: (snapshot) => setSubmitBusyLabel(submitButton, snapshot.status === "PROCESSING" ? "处理中…" : "提交中…"),
            onReady: (completed) => {
              try {
                const sealed = { ...validation, agentTaskId: completed.id, validatedAt: new Date().toISOString() };
                if (!assetRegistry.get("REC-HX-POWER-2026Q3")) {
                  window.LuminoProposalBridge.applyTaskResult(assetRegistry, completed, { tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001" });
                } else if (!assetRegistry.bindings({ id: "BIND-REC-POWER-PCF" }).length) {
                  assetRegistry.bind({
                    id: "BIND-REC-POWER-PCF", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-HX-POWER-2026Q3",
                    usagePurpose: "产品活动数据", scopeId: "PRD-HRC-01", status: "PROPOSED",
                  }, { actor: "PCF Agent", role: "agent", reason: `Agent 任务 ${completed.id} 提出 PCF 绑定` });
                }
                const caseMeta = workflowEngine.get("PCF-2026-001")?.metadata || {};
                const factors = caseMeta.factors || window.LuminoPcfFactors.recommendSet({ declaration: caseMeta.declaration || {} });
                moveWorkflow("EVD-PCF-DATAPACK-001", ["SECURITY_SCANNED", "PARSED"], `PCF Agent 任务 ${completed.id} 完成（proposal_only）`, {
                  confirmationScope: "pcf-only",
                  importedRecords: sealed.domains.reduce((sum, item) => sum + (item.imported || 0), 0),
                  supportFileCount,
                  assetId: "EVD-HX-POWER-2026Q3",
                  agentTaskId: completed.id,
                  templateStatus: sealed.status,
                });
                workflowEngine.patch("PCF-2026-001", {
                  metadata: { template: sealed, factors },
                }, { ...workflowActor(), reason: "写入模板校验结果与因子草稿" });
                if (workflowEngine.get("PCF-2026-001")?.status === "SCOPING") moveWorkflow("PCF-2026-001", ["COLLECTING"], "开始采集 PCF 活动数据");
                if (workflowEngine.get("PCF-2026-001")?.status === "COLLECTING") {
                  moveWorkflow("PCF-2026-001", ["NEEDS_CONFIRMATION"], "PCF Agent 已提出待确认服务绑定");
                }
                state.currentService = "pcf"; state.page = "pcf-data"; persistPortalState(); state.actionBusy = false; closeDrawer(); render();
                toast(sealed.status === "VALIDATED_PARTIAL"
                  ? "模板部分通过：请先补齐缺口，再确认服务绑定。"
                  : "数据包校验通过：仅生成待确认绑定，不会自动确认 PCF 事实。");
              } catch (error) {
                state.actionBusy = false;
                if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
                toast(error.message || "PCF 绑定写入失败");
              }
            },
            onError: (snapshot, error) => {
              state.actionBusy = false;
              if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
              toast(error?.message || snapshot?.errorMessage || "PCF 模板校验任务失败");
            },
          });
        } catch (error) {
          state.actionBusy = false;
          if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
          toast(error.message || "PCF 模板校验任务失败");
        }
        return;
      }
      if (id === "upload-evidence") {
        const file = formData.get("file");
        const extractionMode = String(formData.get("extractionMode") || "model");
        const requestId = String(formData.get("requestId") || "");
        const request = currentIntakeRequest(requestId);
        const facilityName = String(formData.get("facility") || "设施待确认");
        const facilityAsset = assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role, type: "facility" }).find((item) => item.name === facilityName);
        const facilityAssetId = facilityAsset?.id;
        let submittedEvidenceId = null;
        let submittedTaskId = null;
        try {
          if (!canPerformPortalAction("cbam-upload-evidence")) throw Object.assign(new Error(portalActionDenial("cbam-upload-evidence")), { code: "FORBIDDEN" });
          if (!facilityAssetId) throw Object.assign(new Error("请选择当前企业有权访问的设施。"), { code: "FACILITY_REQUIRED" });
          if (!["model", "fixture"].includes(extractionMode)) throw new Error("请选择有效的提取方式。");
          window.LuminoIntakeModel.assertUploadAllowed(request, { name: file?.name, size: file?.size, year: state.year, quarter: state.quarter, extractionMode });
          const actor = intakeActor();
          const bytes = new Uint8Array(await file.arrayBuffer());
          const evidence = await intakeEvidenceStore.put({ requestId: request.id, annualCaseId: request.metadata?.annualCaseId || `CASE-CBAM-${state.year}`, year: state.year, quarter: state.quarter, facilityAssetId, filename: file.name, mediaType: file.type || "text/plain", bytes, tenantId: intakeTenantId, actor });
          await saveIntakeRecord("putEvidence", { evidence, base64: bytesToBase64(bytes) });
          const evidenceId = evidence.evidenceId;
          submittedEvidenceId = evidenceId;
          workflowEngine.patch(request.id, { metadata: { ...request.metadata, facilityAssetId, evidenceId, candidateId: null, candidateRevision: null, intakeStatus: "SUBMITTED" } }, { ...workflowActor(), reason: "新文件已提交，先前候选不可再确认" });
          const serialNo = `cbam-gas-${extractionMode}-${evidenceId}-r${workflowEngine.get(request.id).revision}`;
          if (!assetRegistry.get(evidenceId)) {
            assetRegistry.register({
              id: evidenceId, type: "evidence", status: "NEEDS_CONFIRMATION", tenantId: intakeTenantId, ownerOrganizationId: "ORG-HX-001",
              name: `${facilityName} ${state.year} ${state.quarter} 能源账单`,
              subjectRefs: { facilityId: facilityAssetId },
              temporal: { periodStart: `${state.year}-07-01`, periodEnd: `${state.year}-09-30`, recordedAt: new Date().toISOString() },
              payload: { fileName: evidence.filename, documentType: "energy_invoice", mediaType: evidence.mediaType, materialType: String(formData.get("type") || "能源账单"), requestId: request.id, contentSha256: evidence.contentSha256, byteLength: evidence.byteLength, extractionMode: extractionMode === "model" ? "model_gateway" : "demo_fixture" },
              access: { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
            }, { ...workflowActor(), reason: "上传证据文件进入企业资产池" });
          }
          ensureWorkflowObject({ id: evidenceId, type: "evidence", status: "UPLOADED", owner: roleConfig[state.role].name, year: state.year, quarter: state.quarter, scope: facilityName, metadata: { serviceId: "cbam", requestId: request.id, annualCaseId: evidence.annualCaseId, filename: evidence.filename, contentSha256: evidence.contentSha256, byteLength: evidence.byteLength, extractionMode: extractionMode === "model" ? "model_gateway" : "demo_fixture", materialType: String(formData.get("type") || "能源账单"), facilityAssetId, assetId: evidenceId, tenantId: intakeTenantId, agentSerialNo: serialNo } });
          moveWorkflow(evidenceId, ["SECURITY_SCANNED"], extractionMode === "model" ? "文件已读取并计算摘要，提交模型提取任务" : "演示文件已读取并计算摘要，提交本地规则提取任务", { filename: evidence.filename, facilityAssetId, requestId: request.id, contentSha256: evidence.contentSha256 });

          const task = agentTaskEngine.submit({
            serialNo,
            businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
            tenantId: intakeTenantId,
            caseId: request.metadata?.annualCaseId || `CASE-CBAM-${state.year}`,
            input: { requestId: request.id, evidenceId, filename: evidence.filename, contentSha256: evidence.contentSha256, facilityAssetId, year: state.year, quarter: state.quarter },
          }, { actor: roleConfig[state.role].name });
          submittedTaskId = task.id;

          let modelResult = null;
          if (extractionMode === "model") {
            setSubmitBusyLabel(submitButton, "模型提取中…");
            const reply = await fetch("/api/portal-intake-extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename: file.name, base64: bytesToBase64(bytes), facilityName, year: state.year, quarter: state.quarter }),
            });
            const payload = await reply.json().catch(() => null);
            if (!reply.ok || !payload?.extraction) throw Object.assign(new Error(payload?.message || "模型提取失败，请核对本地模型配置。"), { code: payload?.error || "MODEL_REQUEST_FAILED" });
            if (payload.contentSha256 !== evidence.contentSha256 || payload.extractionMode !== "model_gateway") throw new Error("模型提取结果与上传文件摘要不一致。");
            modelResult = payload;
          }
          const extracted = window.LuminoEnergyInvoiceExtractor.extractEnergyInvoice({ evidenceMeta: evidence, bytes, facilityAssetId, facilityName, caseId: request.metadata?.annualCaseId || `CASE-CBAM-${state.year}`, actor, modelExtraction: modelResult?.extraction, modelName: modelResult?.model, temporal: { periodStart: `${state.year}-07-01`, periodEnd: `${state.year}-09-30`, recordedAt: new Date().toISOString() } });
          const pendingResult = { proposals: extracted.proposals, summary: extracted.summary, warnings: extracted.warnings, partial: !extracted.proposals.length, allowEmpty: true };
          setSubmitBusyLabel(submitButton, "提取中…");
          toast(`${extractionMode === "model" ? "模型" : "本地规则"}任务 ${task.id} 已提交，正在处理…`);
          runAgentTaskWithPolling({
            taskId: task.id,
            pendingResult,
            onStatus: (snapshot) => setSubmitBusyLabel(submitButton, snapshot.status === "PROCESSING" ? "候选写入中…" : "任务提交中…"),
            onReady: async (completed) => {
              try {
                if (workflowEngine.get(request.id)?.metadata?.evidenceId !== evidenceId) {
                  state.actionBusy = false;
                  return;
                }
                if (completed.result.proposals.length) window.LuminoProposalBridge.applyTaskResult(assetRegistry, completed, {
                  tenantId: intakeTenantId,
                  ownerOrganizationId: "ORG-HX-001",
                  reason: `${extractionMode === "model" ? "模型" : "本地规则"}任务产出待确认活动数据提议`,
                });
                const candidate = extracted.candidate ? intakeCandidateStore.put(extracted.candidate) : null;
                if (candidate) await saveIntakeRecord("putCandidate", { candidate });
                moveWorkflow(evidenceId, ["PARSED"], candidate ? `${extractionMode === "model" ? "模型" : "本地规则"}任务 ${completed.id} 已就绪（proposal_only）` : `本地规则任务 ${completed.id} 无法识别演示字段`, { agentTaskId: completed.id, requestId: request.id, candidateId: candidate?.id || null, candidateRevision: candidate?.revision || null, candidateStatus: candidate?.status || "UNPARSEABLE", activityAssetId: candidate?.assetId || null, bindingId: candidate ? `BIND-${candidate.id}` : null });
                workflowEngine.patch(request.id, { metadata: { ...workflowEngine.get(request.id).metadata, candidateId: candidate?.id || null, candidateRevision: candidate?.revision || null, intakeStatus: candidate ? "AWAITING_CONFIRMATION" : "RETURNED" } }, { ...workflowActor(), reason: candidate ? "材料请求进入候选确认" : "演示提取无法识别，等待重新提交" });
                state.uploadAdded = Boolean(candidate);
                persistPortalState();
                state.actionBusy = false;
                closeDrawer(); render();
                toast(candidate
                  ? `${extractionMode === "model" ? "模型" : "本地规则"}提取完成，已生成待确认候选；不会自动写成正式事实。`
                  : "文件已登记，但演示提取无法识别 NATURAL_GAS_NM3；请修正 TXT/CSV 后重新提交。");
              } catch (error) {
                state.actionBusy = false;
                if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
                toast(error.message || "写入提议失败");
              }
            },
            onError: (snapshot, error) => {
              if (workflowEngine.get(request.id)?.metadata?.evidenceId === evidenceId) workflowEngine.patch(request.id, { metadata: { ...workflowEngine.get(request.id).metadata, intakeStatus: "RETURNED" } }, { ...workflowActor(), reason: "演示提取失败，等待重新提交" });
              state.actionBusy = false;
              if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
              toast(error?.message || snapshot?.errorMessage || "Agent 提取任务失败");
            },
          });
        } catch (error) {
          if (submittedTaskId) {
            try { agentTaskEngine.fail(submittedTaskId, error.code || "EXTRACTION_FAILED", error.message); } catch (_) {}
          }
          if (submittedEvidenceId && workflowEngine.get(request?.id)?.metadata?.evidenceId === submittedEvidenceId) {
            workflowEngine.patch(request.id, { metadata: { ...workflowEngine.get(request.id).metadata, intakeStatus: "RETURNED" } }, { ...workflowActor(), reason: "账单提取失败，等待重新提交" });
            render();
          }
          state.actionBusy = false;
          if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
          toast(error.message || "Agent 提取任务失败");
        }
        return;
      }
      if (id === "new-product") {
        state.productYears = formData.getAll("productYears");
        state.productCnCodes = String(formData.get("cnCodes") || "").split(/[，,;；\s]+/).map((code) => code.trim()).filter(Boolean);
        const productName = String(formData.get("productName") || "冷轧非合金钢板");
        const internalCode = String(formData.get("internalCode") || "CRS-02");
        const productAssetId = `PRD-${internalCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "NEW"}`;
        try {
          if (!assetRegistry.get(productAssetId)) {
            assetRegistry.register({
              id: productAssetId, type: "product", status: "NEEDS_CONFIRMATION", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: productName,
              payload: { internalCode, uiKey: "cold", cnCodes: state.productCnCodes, cnLabel: state.productCnCodes.length ? `CN ${state.productCnCodes.join(" / ")} · 候选待确认` : "CN Code 尚未设置", summary: "尚未添加生产配置", scopeYears: state.productYears },
              access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
            }, { ...workflowActor(), reason: "新建产品主档" });
          }
        } catch (error) { toast(error.message); }
        state.productOverrides.cold = {
          name: productName,
          code: internalCode,
          assetId: productAssetId,
          cnCandidates: state.productCnCodes,
          scope: state.productYears,
        };
        state.productAdded = true;
        state.selectedProduct = "cold";
        persistPortalState();
        state.actionBusy = false;
        closeDrawer(); render();
        toast(`产品主档已创建；${state.productYears.length ? `已纳入 ${state.productYears.join("、")} 年度` : "可稍后纳入年度项目"}。下一步请添加生产配置。`);
        return;
      }
      if (id === "new-configuration") {
        state.configurationAdded = true;
        state.configurationDrafts[state.selectedProduct] = {
          facility: String(formData.get("facility") || "设施待确认"),
          process: String(formData.get("process") || "工艺待确认"),
          precursor: String(formData.get("precursor") || "前体待确认"),
          basis: String(formData.get("basis") || ""),
        };
        state.answer = null;
        persistPortalState();
        state.actionBusy = false;
        closeDrawer(); render();
        toast("生产配置草稿已创建。下一步由 Agent 用业务问题确认工艺和前体来源。");
        return;
      }
      if (id === "edit-product") {
        state.productOverrides[state.selectedProduct] = {
          ...(state.productOverrides[state.selectedProduct] || {}),
          name: String(formData.get("productName") || ""),
          code: String(formData.get("internalCode") || ""),
        };
      }
      if (id === "manage-cn") {
        const candidate = String(formData.get("cnCode") || "").trim();
        if (candidate) {
          const existingCandidates = state.productOverrides[state.selectedProduct]?.cnCandidates || (state.selectedProduct === "cold" ? state.productCnCodes : []);
          const candidates = [...new Set([...existingCandidates, candidate])];
          state.productOverrides[state.selectedProduct] = {
            ...(state.productOverrides[state.selectedProduct] || {}),
            cnCandidates: candidates,
            cn: `CN ${candidates.join(" / ")} · 候选待确认`,
          };
          if (state.selectedProduct === "cold") state.productCnCodes = candidates;
        }
      }
      if (id === "manage-years") {
        const selectedYears = formData.getAll("productYears");
        state.productOverrides[state.selectedProduct] = {
          ...(state.productOverrides[state.selectedProduct] || {}),
          scope: selectedYears,
        };
        if (state.selectedProduct === "cold") state.productYears = selectedYears;
      }
      if (id === "new-facility") {
        const code = String(formData.get("facilityCode") || `FAC-${state.facilities.length + 3}`);
        const name = String(formData.get("facilityName") || "未命名设施");
        const activity = String(formData.get("activity") || "生产活动待补充");
        const status = String(formData.get("status") || "在建");
        const assetId = `FAC-${code.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || Date.now()}`;
        try {
          if (!assetRegistry.get(assetId)) {
            assetRegistry.register({
              id: assetId, type: "facility", status: "NEEDS_CONFIRMATION", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name,
              subjectRefs: { organizationId: "ORG-HX-001" },
              payload: { internalCode: code, activity, operationalStatus: status },
              access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
            }, { ...workflowActor(), reason: "新建设施主档" });
          }
        } catch (error) { toast(error.message); }
        state.facilities.push({ name, code, activity, status, assetId });
      }
      if (id === "invite-member") {
        state.invitedMembers.push({
          email: String(formData.get("email") || "pending@example.com"),
          role: String(formData.get("role") || "数据贡献者"),
          scope: String(formData.get("scope") || "仅分配给我的任务"),
          expiresAt: String(formData.get("expiresAt") || "未设置"),
        });
      }
      if (id === "organization-edit") {
        state.organization = {
          name: String(formData.get("organizationName") || state.organization.name),
          code: String(formData.get("organizationCode") || state.organization.code),
          address: String(formData.get("organizationAddress") || state.organization.address),
          assetId: state.organization.assetId || "ORG-HX-001",
        };
        try {
          if (assetRegistry.get("ORG-HX-001")) {
            assetRegistry.revise("ORG-HX-001", {
              name: state.organization.name,
              payload: { legalName: state.organization.name, registrationCode: state.organization.code, address: state.organization.address, country: "CN" },
              status: "NEEDS_CONFIRMATION",
            }, { ...workflowActor(), reason: "更新企业法定主体主档" });
          }
        } catch (error) { toast(error.message); }
        state.orgEditing = false;
      }
      persistPortalState();
      closeDrawer(); render();
      state.actionBusy = false;
      const completionMessages = {
        "edit-product": "产品主档新版本已保存。下一步检查年度范围和生产配置。",
        "manage-cn": "CN Code 候选已保存。下一步等待关务或专家确认并记录依据。",
        "manage-years": "产品年度范围已更新；锁定年度保持不变。",
        "service-scope": "范围变更申请已提交运营评估。当前服务订单不会被直接覆盖。",
        "shipping-import": "发运台账已进入列映射预览。下一步确认重复批次和进口商范围。",
        "invite-member": "成员邀请已创建。下一步由受邀人接受后生效。",
        "organization-edit": "企业主档版本已保存。新年度将引用生效日对应版本。",
        "new-facility": "设施主档已创建。下一步选择纳入的年度并配置生产活动。",
        "generic-action": `${title}已记录；对象、理由、责任人和时间已写入审计。`,
      };
      toast(completionMessages[id] || `${title}已保存；下一步状态已更新。`);
      return;
    }
  });
