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

  $("#loginForm").addEventListener("submit", (event) => { event.preventDefault(); login("customer_owner"); });
  document.querySelectorAll("[data-demo-role]").forEach((button) => button.addEventListener("click", () => login(button.dataset.demoRole)));
  $("#logoutButton").addEventListener("click", logout);
  $("#settingsButton").addEventListener("click", () => { if (canManageOrganization()) { state.page = "org-settings"; render(); } });
  document.querySelector(".company-switch").addEventListener("click", () => {
    if (canManageOrganization()) { state.page = "org-settings"; render(); return; }
    openDrawer("record-detail", { title: isCustomer() ? "当前企业" : "当前工作区", object: isCustomer() ? state.organization.name : roleConfig[state.role].company, status: "由账号与授权决定", description: "正式产品会在这里切换你有权访问的企业或工作区；当前原型固定展示一个上下文。" });
  });
  $("#roleSelect").addEventListener("change", (event) => {
    state.role = event.target.value;
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
  document.addEventListener("click", (event) => {
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
      });
      return;
    }
    const facetButton = event.target.closest("[data-asset-facet]");
    if (facetButton) {
      state.assetFacet = facetButton.dataset.assetFacet;
      persistPortalState();
      render();
      return;
    }
    const serviceEntry = event.target.closest("[data-service-enter]");
    if (serviceEntry) {
      setCustomerDestination(serviceEntry.dataset.serviceEnter, serviceEntry.dataset.pageTarget);
      persistPortalState(); render(); closeDrawer();
      $("#sidebar").classList.remove("open");
      $("#main").focus({ preventScroll: true });
      return;
    }
    const nav = event.target.closest("[data-page]");
    if (nav) {
      const page = nav.dataset.page;
      if (!canAccessPage(page)) {
        toast("当前角色或服务范围无权进入该页面。");
        return;
      }
      if (globalCustomerPages.has(page)) state.currentService = null;
      state.page = page;
      persistPortalState(); render(); closeDrawer();
      $("#sidebar").classList.remove("open"); $("#mobileMenu").setAttribute("aria-expanded", "false"); $("#mobileMenu").setAttribute("aria-label", "打开导航"); $("#main").focus({ preventScroll: true }); return;
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
    const quarter = event.target.closest("[data-quarter]");
    if (quarter) { savePeriodState(); state.quarter = quarter.dataset.quarter; loadPeriodState(); syncUiFromWorkflow(); render(); toast(`正在查看 ${state.year} ${state.quarter} 数据包。`); return; }
    const workflowTransition = event.target.closest("[data-workflow-transition]");
    if (workflowTransition) {
      if (!canPerformPortalAction("workflow-approval")) {
        toast(portalActionDenial("workflow-approval"));
        return;
      }
      try {
        const target = workflowTransition.dataset.workflowTransition;
        const objectId = workflowTransition.dataset.objectId;
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
          moveWorkflow("PCF-2026-001", ["CALCULATING"], "PCF 服务绑定已确认"); state.page = "pcf-results"; persistPortalState(); render(); toast("PCF 绑定已确认；CBAM 的确认状态不受影响。");
        } catch (error) { toast(error.message); }
      }
      if (action === "pcf-retry-calculation") { state.pcfCalculationFailed = false; render(); toast("排放因子已重新加载，可以再次运行计算。"); }
      if (action === "pcf-run-calculation") {
        if (!assertStageGate("pcf", "inventory").ok) return;
        if (!assertStageGate("pcf", "factors").ok) return;
        try {
          const actor = { ...workflowActor(), reason: "锁定 PCF 输入快照并运行确定性计算" };
          const powerBinding = assetRegistry.bindings({ serviceId: "pcf", assetId: "REC-HX-POWER-2026Q3" })[0];
          const evidenceBinding = assetRegistry.bindings({ serviceId: "pcf", assetId: "EVD-HX-POWER-2026Q3" })[0];
          const bindingIds = [powerBinding?.id, evidenceBinding?.id].filter(Boolean);
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
          if (!assetRegistry.getCalculationRun("ARUN-PCF-001")) {
            assetRegistry.createCalculationRun({
              id: "ARUN-PCF-001",
              tenantId: "TNT-0018",
              serviceId: "pcf",
              caseId: "PCF-2026-001",
              snapshotId: "SNAP-PCF-HRC-01",
              status: "SUCCEEDED",
              ruleVersion: "CN-EF-2026.1",
              workflowObjectId: "RUN-PCF-001",
              resultSummary: { total: "2.18", unit: "tCO2e/t" },
            }, actor);
          }
          assetRegistry.markCurrent("ARUN-PCF-001", { ...workflowActor(), reason: "设为当前 PCF 计算结果" });
          ensureWorkflowObject({ id: "RUN-PCF-001", type: "calculationRun", status: "QUEUED", owner: "PCF Agent", year: "2026", dependsOn: ["FACT-PCF-001-ELECTRICITY"], metadata: { serviceId: "pcf", rulepack: "CN-EF-2026.1", assetSnapshotId: "SNAP-PCF-HRC-01", assetRunId: "ARUN-PCF-001" } });
          moveWorkflow("RUN-PCF-001", ["RUNNING", "SUCCEEDED", "CURRENT"], "使用确认资产版本和固定因子集完成 PCF Run 01");
          ensureWorkflowObject({ id: "PCF-RPT-2026-001-R1", type: "formalArtifact", status: "DRAFT", owner: "PCF 专家", year: "2026", scope: "热轧非合金钢卷", metadata: { serviceId: "pcf", artifactType: "PCF_REPORT", calculationRunId: "RUN-PCF-001", assetSnapshotId: "SNAP-PCF-HRC-01", assetRunId: "ARUN-PCF-001" } });
          if (workflowEngine.get("PCF-RPT-2026-001-R1")?.status === "DRAFT") {
            moveWorkflow("PCF-RPT-2026-001-R1", ["GENERATED", "VALIDATED", "INTERNAL_REVIEW"], "生成报告草稿并提交独立复核");
          }
          moveWorkflow("PCF-2026-001", ["EXPERT_REVIEW"], "确定性计算草稿已生成并进入专家复核"); state.page = "pcf-report"; persistPortalState(); render(); toast("PCF 计算已生成，输入快照 SNAP-PCF-HRC-01 已锁定资产版本。");
        } catch (error) { toast(error.message); }
      }
      if (action === "pcf-complete-review") {
        if (!assertStageGate("pcf", "calc-hotspot").ok) return;
        try {
          if (assetRegistry.getSnapshot("SNAP-PCF-HRC-01")?.status !== "LOCKED") {
            assetRegistry.lockSnapshot("SNAP-PCF-HRC-01", { ...workflowActor(), reason: "专家复核完成，锁定报告输入快照" });
          }
          ensureWorkflowObject({ id: "PCF-RPT-2026-001-R1", type: "formalArtifact", status: "DRAFT", owner: "PCF 专家", year: "2026", scope: "热轧非合金钢卷", metadata: { serviceId: "pcf", artifactType: "PCF_REPORT", calculationRunId: "RUN-PCF-001", assetSnapshotId: "SNAP-PCF-HRC-01", assetRunId: "ARUN-PCF-001" } });
          const report = workflowEngine.get("PCF-RPT-2026-001-R1");
          if (report?.status === "DRAFT") moveWorkflow("PCF-RPT-2026-001-R1", ["GENERATED", "VALIDATED", "INTERNAL_REVIEW"], "生成报告草稿并提交独立复核");
          if (workflowEngine.get("PCF-RPT-2026-001-R1")?.status === "INTERNAL_REVIEW") {
            moveWorkflow("PCF-RPT-2026-001-R1", ["APPROVED"], "独立复核员批准方法、证据与计算血缘");
            workflowEngine.transition("PCF-RPT-2026-001-R1", "LOCKED", { ...workflowActor(), reason: "锁定 PCF 报告 Rev 1", metadata: { snapshotId: "SNAP-PCF-HRC-01" } });
          }
          moveWorkflow("PCF-2026-001", ["DELIVERABLE_READY"], "独立复核完成且报告版本已锁定");
          persistPortalState(); render(); toast("独立复核已完成，PCF 报告 Rev 1 已锁定并就绪。");
        } catch (error) { toast(error.message); }
      }
      if (action === "dismiss-onboarding") { state.onboardingDismissed = true; window.localStorage.setItem("lumino-portal-onboarding", "dismissed"); render(); toast("快速引导已收起；可随时从“操作指南”查看完整流程。"); }
      if (action === "start-onboarding") { state.onboardingDismissed = true; window.localStorage.setItem("lumino-portal-onboarding", "dismissed"); render(); document.querySelector(".agent-task")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
      if (action === "replay-onboarding") { state.onboardingDismissed = false; window.localStorage.removeItem("lumino-portal-onboarding"); state.page = "work"; render(); document.querySelector(".onboarding-guide")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
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
          const evidenceId = `EVD-${state.year}-${state.quarter}-GAS`;
          const factId = `FACT-${state.year}-${state.quarter}-GAS`;
          const gasAssetId = `REC-HX-GAS-${state.year}${state.quarter}`;
          const actor = { ...workflowActor(), reason: "确认江苏二厂天然气提取结果并写入企业资产池" };
          if (!assetRegistry.get(evidenceId)) {
            assetRegistry.register({
              id: evidenceId, type: "evidence", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001",
              name: `江苏二厂 ${state.year} ${state.quarter} 天然气账单`,
              subjectRefs: { facilityId: "FAC-JS-02" },
              temporal: { periodStart: `${state.year}-07-01`, periodEnd: `${state.year}-09-30`, recordedAt: new Date().toISOString() },
              payload: { fileName: `江苏二厂天然气账单_${state.year}-09.pdf`, documentType: "energy_invoice", mediaType: "application/pdf" },
              access: { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
            }, { ...actor, role: "customer_owner", reason: "登记天然气证据资产" });
          }
          if (!assetRegistry.get(gasAssetId)) {
            assetRegistry.register({
              id: gasAssetId, type: "energyConsumption", status: "NEEDS_CONFIRMATION", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001",
              name: "江苏二厂购入天然气",
              subjectRefs: { facilityId: "FAC-JS-02" },
              temporal: { periodStart: `${state.year}-07-01`, periodEnd: `${state.year}-09-30`, recordedAt: new Date().toISOString() },
              payload: { metricCode: "energy.natural_gas.purchased", originalValue: "18420", originalUnit: "Nm3", normalizedValue: "18420", normalizedUnit: "Nm3", dataOrigin: "invoice" },
              provenance: { sourceType: "agent-extraction", sourceAssetIds: [evidenceId], extractionRuleVersion: "extract-gas@1.0.0" },
              access: { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
            }, { ...actor, role: "customer_owner", reason: "登记天然气活动数据" });
          }
          if (assetRegistry.get(gasAssetId)?.status !== "CONFIRMED") {
            assetRegistry.confirm(gasAssetId, { ...actor, role: "customer_owner", basis: "核对账单账期、设施与用量" });
          }
          const gasBindingId = `BIND-REC-GAS-CBAM-${state.year}${state.quarter}`;
          if (!assetRegistry.bindings({ id: gasBindingId }).length) {
            assetRegistry.bind({ id: gasBindingId, serviceId: "cbam", caseId: `CBAM-${state.year}-${state.quarter}`, assetId: gasAssetId, usagePurpose: "季度直接排放", scopeId: "FAC-JS-02" }, actor);
            assetRegistry.confirmBinding(gasBindingId, { ...actor, role: "customer_owner", basis: "确认纳入 CBAM 季度核算" });
          }
          ensureWorkflowObject({ id: evidenceId, type: "evidence", status: "PARSED", owner: roleConfig[state.role].name, year: state.year, quarter: state.quarter, scope: "天然气账单", metadata: { assetId: evidenceId, activityAssetId: gasAssetId, facilityAssetId: "FAC-JS-02" } });
          moveWorkflow(evidenceId, ["CLASSIFIED", "LINKED", "REVIEWED", "ACCEPTED"], "项目协调人确认证据的账期、设施与提取值");
          ensureWorkflowObject({ id: factId, type: "fact", status: "MISSING", owner: roleConfig[state.role].name, year: state.year, quarter: state.quarter, scope: "天然气用量", metadata: { assetId: gasAssetId } });
          moveWorkflow(factId, ["PROPOSED", "NEEDS_CONFIRMATION", "CONFIRMED"], "已将通过复核的证据确认为本期业务事实", { evidenceId, assetId: gasAssetId });
          workflowEngine.invalidateDependents(factId, { ...workflowActor(), reason: `事实 ${factId} 已确认，原当前计算版本失效` });
          const runId = `RUN-05-${state.year}-${state.quarter}`;
          ensureWorkflowObject({ id: runId, type: "calculationRun", status: "QUEUED", owner: "王晨", year: state.year, quarter: state.quarter, dependsOn: [factId], metadata: { rulepack: `EU-CBAM-${state.year}.1`, activityAssetId: gasAssetId } });
          moveWorkflow(runId, ["RUNNING", "SUCCEEDED", "CURRENT"], "以已确认事实创建新计算版本");
          state.factConfirmed = true; persistPortalState(); render(); toast("提取结果已写入企业资产池并确认；旧计算版本已失效，Run 05 成为当前版本。");
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

  document.addEventListener("submit", (event) => {
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
        const file = formData.get("file");
        const supportFileCount = activeDrawerForm.querySelector('[name="supportFiles"]')?.files?.length || 0;
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
            filename: file?.name || "Lumino_PCF_数据采集模板_HRC-01.xlsx",
            materialType: "PCF 数据包",
            templateVersion: String(formData.get("templateVersion") || "PCF-DATA-PACK-1.0"),
            supportFileCount,
            assetId: "EVD-HX-POWER-2026Q3",
            activityAssetId: "REC-HX-POWER-2026Q3",
            productAssetId: "PRD-HRC-01",
          },
        });
        try {
          const serialNo = "pcf-datapack-EVD-PCF-DATAPACK-001";
          const task = agentTaskEngine.submit({
            serialNo,
            businessType: "PCF_DATA_PACK_VALIDATE",
            tenantId: "TNT-0018",
            caseId: "PCF-2026-001",
            input: { evidenceId: "EVD-PCF-DATAPACK-001", templateVersion: String(formData.get("templateVersion") || "PCF-DATA-PACK-1.0"), supportFileCount, filename: file?.name || "Lumino_PCF_数据采集模板_HRC-01.xlsx" },
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
            summary: "模板结构校验通过；提出 PCF 服务绑定待确认",
          };
          setSubmitBusyLabel(submitButton, "校验中…");
          toast(`Agent 任务 ${task.id} 已提交，正在轮询…`);
          runAgentTaskWithPolling({
            taskId: task.id,
            pendingResult,
            onStatus: (snapshot) => setSubmitBusyLabel(submitButton, snapshot.status === "PROCESSING" ? "处理中…" : "提交中…"),
            onReady: (completed) => {
              try {
                if (!assetRegistry.get("REC-HX-POWER-2026Q3")) {
                  window.LuminoProposalBridge.applyTaskResult(assetRegistry, completed, { tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001" });
                } else if (!assetRegistry.bindings({ id: "BIND-REC-POWER-PCF" }).length) {
                  assetRegistry.bind({
                    id: "BIND-REC-POWER-PCF", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-HX-POWER-2026Q3",
                    usagePurpose: "产品活动数据", scopeId: "PRD-HRC-01", status: "PROPOSED",
                  }, { actor: "PCF Agent", role: "agent", reason: `Agent 任务 ${completed.id} 提出 PCF 绑定` });
                }
                moveWorkflow("EVD-PCF-DATAPACK-001", ["SECURITY_SCANNED", "PARSED"], `PCF Agent 任务 ${completed.id} 完成（proposal_only）`, { confirmationScope: "pcf-only", importedRecords: 16, supportFileCount, assetId: "EVD-HX-POWER-2026Q3", agentTaskId: completed.id });
                if (workflowEngine.get("PCF-2026-001")?.status === "SCOPING") moveWorkflow("PCF-2026-001", ["COLLECTING"], "开始采集 PCF 活动数据");
                moveWorkflow("PCF-2026-001", ["NEEDS_CONFIRMATION"], "PCF Agent 已提出待确认服务绑定");
                state.currentService = "pcf"; state.page = "pcf-data"; persistPortalState(); state.actionBusy = false; closeDrawer(); render();
                toast("数据包校验任务已完成：仅生成待确认绑定，不会自动确认 PCF 事实。");
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
        if (file && file.size > 30 * 1024 * 1024) {
          state.actionBusy = false;
          if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
          toast("文件超过 30 MB。请压缩或拆分后重试；已填写内容不会丢失。");
          return;
        }
        const evidenceId = `EVD-${state.year}-${state.quarter}-GAS`;
        const activityAssetId = `REC-HX-GAS-${state.year}${state.quarter}`;
        const bindingId = `BIND-REC-GAS-CBAM-${state.year}${state.quarter}`;
        const facilityName = String(formData.get("facility") || "设施待确认");
        const facilityAsset = assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role, type: "facility" }).find((item) => item.name === facilityName);
        const facilityAssetId = facilityAsset?.id || "FAC-JS-02";
        const filename = file?.name || "demo-evidence.pdf";
        try {
          if (!assetRegistry.get(evidenceId)) {
            assetRegistry.register({
              id: evidenceId, type: "evidence", status: "NEEDS_CONFIRMATION", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001",
              name: `${facilityName} ${state.year} ${state.quarter} 能源账单`,
              subjectRefs: { facilityId: facilityAssetId },
              temporal: { periodStart: `${state.year}-07-01`, periodEnd: `${state.year}-09-30`, recordedAt: new Date().toISOString() },
              payload: { fileName: filename, documentType: "energy_invoice", mediaType: "application/pdf", materialType: String(formData.get("type") || "能源账单") },
              access: { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
            }, { ...workflowActor(), reason: "上传证据文件进入企业资产池" });
          }
          ensureWorkflowObject({ id: evidenceId, type: "evidence", status: "UPLOADED", owner: roleConfig[state.role].name, year: state.year, quarter: state.quarter, scope: facilityName, metadata: { filename, materialType: String(formData.get("type") || "能源账单"), facilityAssetId, assetId: evidenceId, agentSerialNo: `cbam-gas-${evidenceId}` } });
          moveWorkflow(evidenceId, ["SECURITY_SCANNED"], "文件已通过安全扫描，提交 Agent 提取任务", { filename, facilityAssetId });

          const serialNo = `cbam-gas-${evidenceId}`;
          const task = agentTaskEngine.submit({
            serialNo,
            businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
            tenantId: "TNT-0018",
            caseId: `CBAM-${state.year}-${state.quarter}`,
            input: { evidenceId, filename, facilityAssetId, year: state.year, quarter: state.quarter },
          }, { actor: roleConfig[state.role].name });

          const pendingResult = {
            proposals: [{
              proposalId: `PROP-${activityAssetId}`,
              assetId: activityAssetId,
              targetAssetType: "energyConsumption",
              tenantId: "TNT-0018",
              ownerOrganizationId: "ORG-HX-001",
              name: `${facilityName}购入天然气`,
              subjectRefs: { facilityId: facilityAssetId },
              temporal: { periodStart: `${state.year}-07-01`, periodEnd: `${state.year}-09-30`, recordedAt: new Date().toISOString() },
              sourceAssetIds: [evidenceId],
              proposedPatch: { metricCode: "energy.natural_gas.purchased", originalValue: "18420", originalUnit: "Nm3", normalizedValue: "18420", normalizedUnit: "Nm3", dataOrigin: "invoice" },
              binding: { id: bindingId, serviceId: "cbam", caseId: `CBAM-${state.year}-${state.quarter}`, usagePurpose: "季度直接排放", scopeId: facilityAssetId },
            }],
            summary: "已从账单提取天然气用量，等待企业确认",
          };
          setSubmitBusyLabel(submitButton, "提取中…");
          toast(`Agent 任务 ${task.id} 已提交（${serialNo}），正在轮询状态…`);
          runAgentTaskWithPolling({
            taskId: task.id,
            pendingResult,
            onStatus: (snapshot) => setSubmitBusyLabel(submitButton, snapshot.status === "PROCESSING" ? "Agent 处理中…" : "任务提交中…"),
            onReady: (completed) => {
              try {
                window.LuminoProposalBridge.applyTaskResult(assetRegistry, completed, {
                  tenantId: "TNT-0018",
                  ownerOrganizationId: "ORG-HX-001",
                  reason: "Agent 任务产出待确认活动数据提议",
                });
                moveWorkflow(evidenceId, ["PARSED"], `Agent 任务 ${completed.id} 已就绪（proposal_only）`, { agentTaskId: completed.id, activityAssetId, bindingId });
                state.uploadAdded = true;
                persistPortalState();
                state.actionBusy = false;
                closeDrawer(); render();
                toast(completed.status === "READY_PARTIAL"
                  ? "材料已上传；Agent 仅部分提取成功，请核对后确认事实。"
                  : "轮询完成。Agent 已提交待确认提议，不会自动写成正式事实。");
              } catch (error) {
                state.actionBusy = false;
                if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
                toast(error.message || "写入提议失败");
              }
            },
            onError: (snapshot, error) => {
              state.actionBusy = false;
              if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButton.dataset.originalLabel; }
              toast(error?.message || snapshot?.errorMessage || "Agent 提取任务失败");
            },
          });
        } catch (error) {
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
