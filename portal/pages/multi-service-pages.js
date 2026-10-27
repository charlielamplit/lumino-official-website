"use strict";

  const pcfSteps = ["SCOPING", "COLLECTING", "NEEDS_CONFIRMATION", "CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY"];

  function serviceEntryPage(serviceId) {
    if (serviceId === "cbam") return state.role === "customer_contrib" ? "contributor-work" : state.role === "customer_approver" ? "approvals" : "work";
    if (serviceId === "pcf") return state.role === "customer_contrib" ? "pcf-data" : state.role === "customer_approver" ? "pcf-report" : "pcf-scope";
    return null;
  }

  function servicePrimaryAction(service) {
    if (!service.roles.includes(state.role)) return `<button class="button button--secondary" type="button" data-drawer="service-consultation" data-service-id="${service.id}">预约咨询</button>`;
    const page = serviceEntryPage(service.id);
    const label = service.id === "pcf" ? (workflowEngine.get("PCF-2026-001")?.status === "SCOPING" ? "开始 PCF 项目" : "继续 PCF 项目")
      : state.role === "customer_contrib" ? "查看分配给我" : state.role === "customer_approver" ? "处理待审批事项" : "继续当前工作";
    return `<button class="button button--primary" type="button" data-service-enter="${service.id}" data-page-target="${page}">${label}</button>`;
  }

  function renderServicesHub() {
    const cards = Object.values(serviceRegistry).map((service, index) => `<article class="service-card service-card--${service.status}">
      <header><span class="service-index">0${index + 1}</span>${statusChip(service.statusLabel, service.status === "active" ? "ok" : service.status === "pilot" ? "warn" : "")}</header>
      <p class="service-code">${service.code}</p><h2>${service.name}</h2><p>${service.description}</p>
      ${service.id === "cbam" ? `<div class="service-current"><strong>${state.role === "customer_contrib" ? "2 项材料待补充" : state.role === "customer_approver" ? "2 项决定待审批" : "Q3 数据采集 · 68%"}</strong><span>下一步已按你的角色筛选</span></div>` : service.id === "pcf" ? `<div class="service-current"><strong>${workflowStateLabel(workflowEngine.get("PCF-2026-001")?.status || "SCOPING")}</strong><span>热轧非合金钢卷 · 试点项目</span></div>` : ""}
      <footer>${servicePrimaryAction(service)}</footer></article>`).join("");
    $("#main").innerHTML = `${pageHeader("LUMINO SERVICE PORTAL", "服务总览", statusChip("6 项企业服务"))}<p class="page-lead">从一个企业入口进入已开通服务。尚未开放的服务只接受咨询，不会创建空工作空间。</p><section class="service-grid" aria-label="企业服务">${cards}</section>`;
  }

  function renderSharedTasks() {
    const roleRows = {
      customer_contrib: [["CBAM", "补充江苏二厂天然气账单", "陈浩", "今天", "data"], ["PCF", "上传购电与产量证明", "陈浩", "10 月 24 日", "pcf-data"]],
      customer_approver: [["CBAM", "审批默认值并行路径", "赵海峰", "今天", "approvals"], ["PCF", "等待专家提交报告复核", "赵海峰", "待提交", "pcf-report"]],
      customer_owner: [["CBAM", "确认 Agent 提取的天然气数据", "周岚", "今天", "data"], ["PCF", "确认核算边界与主要输入", "周岚", "10 月 23 日", "pcf-boundary"], ["CBAM", "跟进供应商实测数据", "采购负责人", "已逾期 2 天", "products"]],
      customer_admin: [["CBAM", "确认 Q3 数据包完整性", "周岚", "今天", "data"], ["PCF", "确认核算边界与主要输入", "周岚", "10 月 23 日", "pcf-boundary"], ["CBAM", "复核服务成员授权", "企业管理员", "10 月 31 日", "org-settings"]],
    };
    const rows = (roleRows[state.role] || []).map(([service, object, owner, due, page]) => `<tr><td><span class="service-tag">${service}</span></td><td><strong>${object}</strong></td><td>${owner}</td><td>${due}</td><td><button class="text-button" type="button" ${globalCustomerPages.has(page) ? `data-page="${page}"` : `data-service-enter="${service.toLowerCase()}" data-page-target="${page}"`}>继续处理 →</button></td></tr>`).join("");
    $("#main").innerHTML = `${pageHeader("CROSS-SERVICE WORK", "我的任务", statusChip(`${(roleRows[state.role] || []).length} 项待办`, "warn"))}<p class="page-lead">仅聚合你在当前企业、对象和服务范围内有权处理的工作。</p><section class="panel shared-table"><table><thead><tr><th>服务</th><th>对象 / 下一步</th><th>负责人</th><th>截止状态</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }

  function renderSharedFiles() {
    const typeLabels = { organization: "企业主档", facility: "设施主档", product: "产品主档", evidence: "原始证据", energyConsumption: "能源活动", productionOutput: "产量活动", supplierDeclaration: "供应商声明", shipmentEvent: "发运事件" };
    const statusLabels = { DRAFT: "草稿", PROPOSED: "Agent 提议", NEEDS_CONFIRMATION: "待确认", CONFIRMED: "企业已确认", CONFLICTED: "存在冲突", SUPERSEDED: "已被替代", ARCHIVED: "已归档" };
    const bindingLabels = { PROPOSED: "建议复用", PENDING_CONFIRMATION: "待本服务确认", CONFIRMED: "已确认使用", REJECTED: "已拒绝", SUPERSEDED: "已被替代" };
    const assets = assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role });
    const allBindings = assetRegistry.bindings();
    const pendingBindings = allBindings.filter((item) => item.status === "PENDING_CONFIRMATION");
    const attentionAssets = assets.filter((item) => ["PROPOSED", "NEEDS_CONFIRMATION", "CONFLICTED"].includes(item.status));
    const evidenceCount = assets.filter((item) => item.type === "evidence").length;
    const reusableCount = assets.filter((item) => assetRegistry.bindingsForAsset(item.id).length > 1).length;
    const serviceName = (id) => id === "cbam" ? "CBAM" : id === "pcf" ? "PCF" : id.toUpperCase();
    const qualityText = (asset) => asset.quality?.status === "verified" ? "已验证" : asset.quality?.status === "usable" ? "可使用" : asset.quality?.status === "needs_review" ? "需复核" : "待评估";
    const coverage = (asset) => asset.temporal?.periodStart && asset.temporal?.periodEnd ? `${asset.temporal.periodStart} — ${asset.temporal.periodEnd}` : asset.temporal?.validFrom ? `${asset.temporal.validFrom} 起` : "长期主档";
    const rows = assets.map((asset) => {
      const bindings = assetRegistry.bindingsForAsset(asset.id);
      const serviceTags = bindings.length ? bindings.map((binding) => `<span class="service-tag ${binding.serviceId === "pcf" ? "pilot" : ""}" title="${safe(bindingLabels[binding.status] || binding.status)}">${safe(serviceName(binding.serviceId))}</span>`).join(" ") : '<span class="asset-unused">尚未用于服务</span>';
      const issue = asset.quality?.issues?.[0] || "无开放质量问题";
      return `<tr><td><span class="asset-kind">${safe(typeLabels[asset.type] || asset.type)}</span><strong>${safe(asset.name)}</strong><small>${safe(asset.id)} · Rev ${asset.revision}</small></td><td><strong>${safe(coverage(asset))}</strong><small>${safe(asset.steward?.ownerName || "责任人待分配")}</small></td><td>${serviceTags}</td><td><span class="record-state ${asset.status === "CONFIRMED" ? "ok" : "warn"}">${safe(statusLabels[asset.status] || asset.status)}</span><small>${safe(qualityText(asset))} · ${safe(issue)}</small></td><td><button class="text-button" type="button" data-drawer="record-detail" data-drawer-label="${safe(asset.name)}" data-drawer-object="${safe(asset.versionId)}" data-drawer-status="${safe(statusLabels[asset.status] || asset.status)}" data-drawer-owner="${safe(asset.steward?.ownerName || "待分配")}" data-drawer-scope="${safe(bindings.map((item) => `${serviceName(item.serviceId)}：${bindingLabels[item.status] || item.status}`).join("；") || "尚未绑定服务")}" data-drawer-description="${safe(`来源、质量、历史版本与服务使用相互独立。${issue}`)}">查看资产 →</button></td></tr>`;
    }).join("");
    const primaryAttention = assets.some((item) => item.id === "REC-HX-POWER-2026Q3") && pendingBindings.some((item) => item.assetId === "REC-HX-POWER-2026Q3" && item.serviceId === "pcf");
    $("#main").innerHTML = `${pageHeader("ENTERPRISE DATA ASSETS · FRAMEWORK 0.2.0", "企业数据资产", statusChip(`${assets.length} 项当前资产`))}
      <p class="page-lead">企业数据只维护一次；各项服务引用明确版本，并分别确认用途、范围和计算血缘。</p>
      ${primaryAttention ? `<section class="asset-attention" aria-labelledby="assetAttentionTitle"><div><span>当前需要处理</span><h2 id="assetAttentionTitle">确认购入电力是否用于 PCF 产品分配</h2><p>CBAM 已确认使用企业电力事实；PCF 仍需独立确认产品范围和分配方法，原始账单不会被复制。</p></div><button class="button button--primary" type="button" data-service-enter="pcf" data-page-target="pcf-data">进入 PCF 确认</button></section>` : ""}
      <dl class="asset-register-summary" aria-label="数据资产摘要"><div><dt>当前资产</dt><dd>${assets.length}</dd><span>按角色和对象范围过滤</span></div><div><dt>原始证据</dt><dd>${evidenceCount}</dd><span>原文件保持不可变</span></div><div><dt>跨服务复用</dt><dd>${reusableCount}</dd><span>每项服务独立确认</span></div><div><dt>待处理</dt><dd>${attentionAssets.length + pendingBindings.length}</dd><span>事实提议与服务绑定</span></div></dl>
      <section class="asset-catalog" aria-labelledby="assetCatalogTitle"><header><div><span>ASSET REGISTER</span><h2 id="assetCatalogTitle">当前可访问的数据资产</h2><p>列表只展示当前企业和当前角色有权访问的最新版本；历史修订仍保留在资产详情中。</p></div><button class="button button--secondary" type="button" data-drawer="upload-evidence">登记新资料</button></header><div class="asset-table-wrap"><table><thead><tr><th>资产</th><th>覆盖范围 / 责任人</th><th>服务使用</th><th>状态 / 质量</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5">当前授权范围内暂无数据资产。</td></tr>'}</tbody></table></div></section>
      <section class="asset-governance" aria-label="数据资产处理原则"><article><span>AGENT STEWARDSHIP</span><h2>Agent 负责识别与建议，不负责越权确认</h2><ol><li>识别文件、期间、单位和业务对象</li><li>生成带来源引用的待确认记录</li><li>检测重复、冲突和跨服务复用机会</li><li>由授权人员确认后生成新资产版本</li></ol></article><article><span>CROSS-SERVICE CONTRACT</span><h2>复用资产，不复用结论</h2><p>服务必须通过绑定引用具体资产版本，并单独记录用途、转换、分配、确认和输入快照。一个服务的确认不会改变其他服务。</p><a class="text-button" href="../docs/enterprise-data-asset-framework.md" target="_blank" rel="noopener">查看标准框架 v0.2.0 →</a></article></section>`;
  }

  function renderSharedDeliverables() {
    const pcfCase = workflowEngine.get("PCF-2026-001");
    const ready = pcfCase?.status === "DELIVERABLE_READY";
    $("#main").innerHTML = `${pageHeader("CONTROLLED OUTPUTS", "交付中心")}<p class="page-lead">在这里查看版本与交付状态；审批、锁定和正式操作仍回到对应服务频道完成。</p><section class="delivery-ledger"><article><div><span class="service-tag">CBAM</span><h2>年度监测计划 / 监测报告</h2><p>Rev 3 · 当前适用 · 尚未锁定</p></div><button class="text-button" data-service-enter="cbam" data-page-target="deliverables">进入 CBAM 处理 →</button></article><article><div><span class="service-tag pilot">PCF</span><h2>热轧非合金钢卷 PCF 报告</h2><p>${ready ? "Rev 1 · 报告就绪" : "Draft · 等待专家复核"}</p></div><button class="text-button" data-service-enter="pcf" data-page-target="pcf-report">${ready ? "查看报告" : "查看复核状态"} →</button></article></section>`;
  }

  function renderSharedOrganization() {
    if (canManageOrganization()) { renderOrganizationSettings(); return; }
    const scope = state.role === "customer_contrib" ? "仅分配给我的任务与材料" : state.role === "customer_approver" ? "待审批对象与受控交付物" : "当前企业已开通服务与项目对象";
    $("#main").innerHTML = `${pageHeader("ENTERPRISE ACCESS", "企业与权限", statusChip("只读"))}<p class="page-lead">权限由企业角色、服务范围和业务对象共同决定；本页不会展示你无权访问的成员或服务数据。</p><section class="panel permission-self"><h2>我的有效权限</h2><dl><div><dt>企业</dt><dd>${safe(state.organization.name)}</dd></div><div><dt>当前角色</dt><dd>${safe(roleConfig[state.role].title)}</dd></div><div><dt>授权范围</dt><dd>${scope}</dd></div><div><dt>可进入服务</dt><dd>CBAM、产品碳足迹 PCF</dd></div></dl><button class="button button--secondary" data-drawer="permission-audit">查看权限来源</button></section>`;
  }

  const pcfStepLabels = {
    SCOPING: "范围确认",
    COLLECTING: "数据采集",
    NEEDS_CONFIRMATION: "事实确认",
    CALCULATING: "碳足迹计算",
    EXPERT_REVIEW: "专家复核",
    DELIVERABLE_READY: "报告就绪",
  };

  function pcfChannelHeader(title, description) {
    const item = workflowEngine.get("PCF-2026-001");
    const index = Math.max(0, pcfSteps.indexOf(item?.status));
    return `${pageHeader("PRODUCT CARBON FOOTPRINT · PILOT", title, statusChip(workflowStateLabel(item?.status || "SCOPING"), workflowStateTone(item?.status)))}
      <div class="pcf-shell">
        <section class="pcf-context" aria-label="当前 PCF 项目">
          <div class="pcf-context__identity"><span>PCF · 试点项目</span><strong>热轧非合金钢卷</strong><small>HRC-01 · 华星钢铁有限公司</small></div>
          <p>${description}</p>
          <button class="text-button" type="button" data-page="services-hub">返回服务总览 <span aria-hidden="true">↗</span></button>
        </section>
        <ol class="pcf-progress" aria-label="PCF 项目进度">${pcfSteps.map((step, i) => `<li class="${i < index ? "done" : i === index ? "current" : ""}" ${i === index ? 'aria-current="step"' : ""}><span aria-hidden="true">${i < index ? "✓" : i + 1}</span><small>${pcfStepLabels[step]}</small></li>`).join("")}</ol>
      </div>`;
  }

  function pcfRecovery(message, detail, action, attributes) {
    return `<section class="pcf-recovery" role="status"><div><span class="pcf-kicker">需要处理</span><h2>${message}</h2><p>${detail}</p></div>${actionButton(action, "secondary", attributes)}</section>`;
  }

  function pcfProductOptions() {
    const products = assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role, type: "product" });
    if (!products.length) return "<option>暂无产品主档</option>";
    return products.map((product) => {
      const code = product.payload?.internalCode || product.id;
      return `<option value="${safe(product.id)}" ${product.id === "PRD-HRC-01" ? "selected" : ""}>${safe(product.name)} · ${safe(code)}</option>`;
    }).join("");
  }

  function pcfPowerContext() {
    const power = assetRegistry.get("REC-HX-POWER-2026Q3");
    const evidence = assetRegistry.get("EVD-HX-POWER-2026Q3");
    const powerBinding = assetRegistry.bindings({ serviceId: "pcf", assetId: "REC-HX-POWER-2026Q3" })[0];
    const evidenceBinding = assetRegistry.bindings({ serviceId: "pcf", assetId: "EVD-HX-POWER-2026Q3" })[0];
    const product = assetRegistry.get("PRD-HRC-01");
    const snapshot = assetRegistry.snapshots({ serviceId: "pcf", caseId: "PCF-2026-001" })[0];
    const run = assetRegistry.calculationRuns({ serviceId: "pcf", caseId: "PCF-2026-001" })[0];
    const value = power?.payload?.originalValue ? Number(power.payload.originalValue).toLocaleString("zh-CN") : "—";
    const unit = power?.payload?.originalUnit || "MWh";
    const period = power?.temporal?.periodStart && power?.temporal?.periodEnd
      ? `${power.temporal.periodStart.slice(0, 7)} 至 ${power.temporal.periodEnd.slice(0, 7)}`
      : "期间待确认";
    return { power, evidence, powerBinding, evidenceBinding, product, snapshot, run, value, unit, period, bindingConfirmed: powerBinding?.status === "CONFIRMED" };
  }

  function renderPcfScope() {
    const status = workflowEngine.get("PCF-2026-001")?.status;
    const org = assetRegistry.get("ORG-HX-001");
    $("#main").innerHTML = `${pcfChannelHeader("确定核算目标", "先把产品、用途和期间说清楚，后续边界、数据与报告都将继承这里的定义。")}
      <div class="pcf-layout">
        <section class="pcf-card pcf-form" aria-labelledby="pcfScopeTitle">
          <header class="pcf-card__header"><div><span class="pcf-kicker">STEP 01 · PROJECT BRIEF</span><h2 id="pcfScopeTitle">项目范围</h2></div><small>3 项必填 · ${safe(org?.name || "企业主档")}</small></header>
          <div class="pcf-field-grid">
            <label><span>核算产品</span><small>来自企业数据资产产品主档</small><select name="pcfProductId">${pcfProductOptions()}</select></label>
            <label><span>核算目标</span><small>决定报告用途与需要披露的说明</small><select><option>客户披露与供应链响应</option><option>内部减排分析</option></select></label>
            <label class="pcf-field--wide"><span>核算期间</span><small>活动数据应覆盖同一生产期间</small><input value="2026-01-01 至 2026-09-30"></label>
          </div>
          <footer class="pcf-card__actions"><p>确认后仍可在专家复核前提出修订。</p>${status === "SCOPING" ? actionButton("确认目标，继续定义边界", "primary", 'data-action="pcf-confirm-scope"') : actionButton("查看边界定义", "secondary", 'data-page="pcf-boundary"')}</footer>
        </section>
        <aside class="pcf-agent-note" aria-labelledby="pcfAgentScope"><span class="pcf-agent-mark" aria-hidden="true">✦</span><div><span class="pcf-kicker">PCF AGENT · 准备提示</span><h2 id="pcfAgentScope">下一步会确认三件事</h2><ol><li>系统边界到哪里</li><li>哪些生产过程属于本产品</li><li>电力、燃料和主要原材料来自哪里</li></ol><p>Agent 的建议不会自动成为正式事实，仍需由你确认。</p></div></aside>
      </div>`;
  }

  function renderPcfBoundary() {
    const item = workflowEngine.get("PCF-2026-001");
    const boundaryAction = item?.status === "SCOPING"
      ? actionButton("先确认核算目标", "secondary", 'data-page="pcf-scope"')
      : item?.status === "COLLECTING"
        ? actionButton("确认边界，开始采集数据", "primary", 'data-action="pcf-confirm-boundary"')
        : actionButton("查看活动数据", "secondary", 'data-page="pcf-data"');
    $("#main").innerHTML = `${pcfChannelHeader("边界与产品", "明确哪些生命周期阶段被纳入，以及最终结果对应的功能单位。")}
      <div class="pcf-layout">
        <section class="pcf-card pcf-form" aria-labelledby="pcfBoundaryTitle">
          <header class="pcf-card__header"><div><span class="pcf-kicker">STEP 02 · SYSTEM BOUNDARY</span><h2 id="pcfBoundaryTitle">核算边界</h2></div><small>当前状态：${workflowStateLabel(item?.status)}</small></header>
          <div class="pcf-field-grid">
            <label><span>系统边界</span><small>选择纳入核算的生命周期范围</small><select><option>从摇篮到大门</option><option>从大门到大门</option></select></label>
            <label><span>功能单位</span><small>所有活动数据和结果的共同基准</small><input value="1 吨热轧非合金钢卷"></label>
            <label class="pcf-field--wide"><span>纳入的生产过程</span><small>按产品实际生产路径确认</small><textarea rows="3">炼铁、炼钢、连铸、热轧及厂内运输</textarea></label>
            <label class="pcf-field--wide"><span>主要输入</span><small>用于生成后续活动数据清单</small><textarea rows="3">铁矿石、焦炭、废钢、电力、天然气</textarea></label>
          </div>
          <footer class="pcf-card__actions"><p>确认后，系统将据此建立活动数据清单。</p>${boundaryAction}</footer>
        </section>
        <aside class="pcf-agent-note pcf-agent-note--proposal" aria-labelledby="pcfAgentBoundary"><span class="pcf-agent-mark" aria-hidden="true">✦</span><div><span class="pcf-kicker">PCF AGENT · 边界建议</span><h2 id="pcfAgentBoundary">建议采用“从摇篮到大门”</h2><p>依据当前产品配置，建议纳入上游原料、能源和厂内生产，暂不包括销售运输。</p><dl><div><dt>纳入</dt><dd>上游原料、生产、厂内运输</dd></div><div><dt>排除</dt><dd>销售运输、使用与报废</dd></div></dl><small>这是待确认提议，不会自动写入正式核算。</small></div></aside>
      </div>`;
  }

  function renderPcfData() {
    const item = workflowEngine.get("PCF-2026-001");
    const pack = workflowEngine.list({ type: "evidence" }).find((record) => record.metadata?.serviceId === "pcf");
    const ctx = pcfPowerContext();
    const showAssetFact = Boolean(ctx.power) && ["COLLECTING", "NEEDS_CONFIRMATION", "CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY"].includes(item?.status);
    const evidenceReady = Boolean(pack) || showAssetFact;
    const factConfirmed = ctx.bindingConfirmed || ["CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY"].includes(item?.status);
    const canConfirmBinding = !factConfirmed && ctx.powerBinding && ["PROPOSED", "PENDING_CONFIRMATION"].includes(ctx.powerBinding.status)
      && ["COLLECTING", "NEEDS_CONFIRMATION"].includes(item?.status);
    const productLabel = ctx.product ? `${ctx.product.name}` : "热轧非合金钢卷";
    const evidenceId = ctx.evidence?.id || "EVD-HX-POWER-2026Q3";
    const evidenceName = pack?.metadata?.filename || ctx.evidence?.payload?.fileName || "企业电力证据";
    const domainRows = [
      ["01", "产品与边界", "功能单位、核算期、系统边界与分配规则", "项目协调人", "14 / 14", "已确认", "ok", "pcf-boundary", "查看定义"],
      ["02", "原材料与前体", "铁矿石、焦炭、废钢、辅料及供应商信息", "采购", evidenceReady ? "5 / 5" : "0 / 5", evidenceReady ? "已导入" : "待填写", evidenceReady ? "ok" : "warn", "pcf-upload", evidenceReady ? "查看记录" : "回传模板"],
      ["03", "能源与过程排放", "购电、燃料、蒸汽、制冷剂和直接过程排放", "生产 / EHS", evidenceReady ? (factConfirmed ? "4 / 4" : "3 / 4") : "0 / 4", evidenceReady ? (factConfirmed ? "已确认" : "1 项待确认") : "待填写", evidenceReady ? (factConfirmed ? "ok" : "warn") : "warn", evidenceReady ? "record-detail" : "pcf-upload", evidenceReady ? "核对数据" : "回传模板"],
      ["04", "上游与厂内运输", "运输对象、路线、方式、距离、质量与装载率", "物流 / 采购", evidenceReady ? "3 / 3" : "0 / 3", evidenceReady ? "已导入" : "待填写", evidenceReady ? "ok" : "warn", "pcf-upload", evidenceReady ? "查看记录" : "回传模板"],
      ["05", "产量、联产品与分配", "目标产品产量、联产品及共用过程分配依据", "生产 / 财务", evidenceReady ? "2 / 2" : "0 / 2", evidenceReady ? "已导入" : "关键缺口", evidenceReady ? "ok" : "danger", "pcf-upload", evidenceReady ? "查看记录" : "优先补充"],
      ["06", "废弃物与处理路径", "废物数量、处理方式、回收比例和处置运输", "EHS", evidenceReady ? "2 / 2" : "0 / 2", evidenceReady ? "已导入" : "待填写", evidenceReady ? "ok" : "warn", "pcf-upload", evidenceReady ? "查看记录" : "回传模板"],
      ["07", "供应商 PCF", "供应商声明值、边界、方法、一次数据比例和核查状态", "采购", evidenceReady ? "0 / 2" : "0 / 2", "按需填写", "neutral", "pcf-upload", "查看要求"],
    ];
    const domainHtml = domainRows.map(([number, name, description, owner, count, status, tone, drawer, label]) => `<article class="pcf-domain-row">
      <span class="pcf-domain-number">${number}</span><div class="pcf-domain-name"><strong>${name}</strong><small>${description}</small></div>
      <div class="pcf-domain-owner"><span>责任</span><strong>${owner}</strong></div><div class="pcf-domain-count"><span>记录</span><strong>${count}</strong></div>
      <span class="pcf-domain-status pcf-domain-status--${tone}">${status}</span><button class="text-button" type="button" ${drawer === "pcf-boundary" ? 'data-page="pcf-boundary"' : `data-drawer="${drawer}"${drawer === "record-detail" ? ` data-drawer-label="${safe(ctx.power?.name || "能源与过程数据")}" data-drawer-object="${safe(ctx.power?.versionId || "REC-HX-POWER-2026Q3")}" data-drawer-status="${factConfirmed ? "PCF 已确认使用" : "1 项待确认"}" data-drawer-description="核对购入电力的期间、数值、单位、产品用途与证据引用。资产版本 ${safe(ctx.power?.versionId || "")}；证据 ${safe(evidenceId)}。"` : ""}`}>${label} →</button>
    </article>`).join("");
    const latestImport = evidenceReady ? `<section class="pcf-import-review" id="pcfEvidenceReview" aria-labelledby="pcfImportTitle">
      <header><div><span class="pcf-kicker">ASSET BINDING · ${safe(pack?.metadata?.templateVersion || "ENTERPRISE POOL")}</span><h2 id="pcfImportTitle">${safe(evidenceName)}</h2><p>活动数据引用企业资产池中的确定版本；PCF 绑定确认不会改变 CBAM 或其他服务状态。</p></div>${statusChip(factConfirmed ? "绑定已确认" : "1 项待确认", factConfirmed ? "ok" : "warn")}</header>
      <div class="pcf-import-checks"><div><span>企业资产</span><strong>${safe(ctx.power?.id || "—")}</strong><small>Rev ${safe(String(ctx.power?.revision || 1))} · ${safe(ctx.power?.status || "")}</small></div><div><span>服务绑定</span><strong>${safe(ctx.powerBinding?.id || "—")}</strong><small>${safe(ctx.powerBinding?.status || "未绑定")}</small></div><div><span>证明材料</span><strong>${safe(evidenceId)}</strong><small>${safe(ctx.evidence?.payload?.documentType || "energy_invoice")}</small></div><div><span>CBAM 复用</span><strong>独立确认</strong><small>不共享本服务结论</small></div></div>
      <div class="pcf-proposed-fact"><div><span class="pcf-kicker">${factConfirmed ? "SERVICE BINDING CONFIRMED" : "PENDING SERVICE BINDING"}</span><h3>${safe(ctx.power?.name || "上海一厂购入电力")}</h3><p>来源资产 ${safe(ctx.power?.versionId || "—")} · ${safe(ctx.period)}</p></div><dl><div><dt>活动数据</dt><dd>${safe(ctx.value)} ${safe(ctx.unit)}</dd></div><div><dt>用途</dt><dd>${safe(productLabel)}</dd></div><div><dt>证据</dt><dd>${safe(evidenceId)}</dd></div></dl>${canConfirmBinding ? actionButton("确认这项 PCF 绑定", "primary", 'data-action="pcf-confirm-proposal"') : statusChip(factConfirmed ? "已确认" : "等待范围确认", factConfirmed ? "ok" : "warn")}</div>
      <footer><p>同一材料可以供 CBAM 引用，但每个服务的确认状态与计算血缘相互独立。</p><button class="button button--secondary" type="button" data-drawer="pcf-upload">回传修订版或补充材料</button></footer>
    </section>` : `<section class="pcf-awaiting-pack"><span class="pcf-kicker">WAITING FOR DATA PACK</span><h2>尚未进入数据采集</h2><p>先确认核算边界，系统将引用企业资产池中的电力与证据；也可下载 Excel 模板后整体回传。</p><button class="button button--primary" type="button" data-drawer="pcf-upload">上传已填写模板</button></section>`;
    $("#main").innerHTML = `${pcfChannelHeader("活动数据", "使用项目模板协调各部门填报，并把每项活动数据连接到来源文件、确认记录和后续计算。")}
      <section class="pcf-template-band" aria-labelledby="pcfTemplateTitle"><div><span class="pcf-kicker">PCF DATA PACK · HRC-01 · V1.0</span><h2 id="pcfTemplateTitle">先下载项目模板，再整体回传</h2><p>模板已预填产品、核算期间和“从摇篮到大门”边界；回传后会映射到企业资产池中的 ${safe(ctx.power?.id || "能源记录")}。</p><div class="pcf-template-actions"><a class="button button--secondary" href="../outputs/pcf-template/Lumino_PCF_%E6%95%B0%E6%8D%AE%E9%87%87%E9%9B%86%E6%A8%A1%E6%9D%BF_HRC-01.xlsx" download>下载 Excel 采集模板</a><button class="button button--primary" type="button" data-drawer="pcf-upload">上传已填写模板</button></div></div><aside><div><strong>10</strong><span>个工作表<br>含说明与证据索引</span></div><ul><li>原材料、能源、运输、产量与废弃物</li><li>供应商 PCF、分配依据和数据质量</li><li>下拉单位、日期格式与证明材料索引</li></ul></aside></section>
      <ol class="pcf-collection-flow" aria-label="模板采集流程"><li class="done"><span>1</span><div><strong>下载项目模板</strong><small>边界信息已预填</small></div></li><li class="${evidenceReady ? "done" : "current"}"><span>2</span><div><strong>分工填写</strong><small>采购、生产、EHS、物流与财务</small></div></li><li class="${evidenceReady ? "done" : ""}"><span>3</span><div><strong>整体回传 / 资产引用</strong><small>模板与企业资产池对齐</small></div></li><li class="${evidenceReady ? "current" : ""}"><span>4</span><div><strong>校验并确认绑定</strong><small>先修复缺口，再进入计算</small></div></li></ol>
      <section class="pcf-domain-ledger" aria-labelledby="pcfDomainsTitle"><header><div><span class="pcf-kicker">LIFE CYCLE INVENTORY</span><h2 id="pcfDomainsTitle">数据域清单</h2><p>这里管理核算所需的活动数据，不直接要求业务人员理解排放因子或法规字段。</p></div><div class="pcf-domain-summary"><strong>${evidenceReady ? (factConfirmed ? "16 / 16" : "15 / 16") : "14 / 30"}</strong><span>${evidenceReady ? (factConfirmed ? "活动数据已确认" : "活动数据待确认") : "范围字段已预填"}</span></div></header><div>${domainHtml}</div></section>
      ${latestImport}`;
  }

  function renderPcfResults() {
    const item = workflowEngine.get("PCF-2026-001");
    const ctx = pcfPowerContext();
    const snapshotId = ctx.snapshot?.id || "SNAP-PCF-HRC-01";
    const runId = ctx.run?.id || "ARUN-PCF-001";
    const canRun = item?.status === "CALCULATING";
    const blocked = ["SCOPING", "COLLECTING", "NEEDS_CONFIRMATION"].includes(item?.status) || !ctx.bindingConfirmed;
    const resultDetail = `<section class="pcf-result-detail"><div class="pcf-stage-table"><header><span class="pcf-kicker">RESULT BREAKDOWN</span><h2>生命周期阶段结果</h2></header><table><thead><tr><th>阶段</th><th>排放量</th><th>占比</th><th>数据基础</th></tr></thead><tbody><tr><td>原材料与前体</td><td>1.395 tCO₂e</td><td>64.0%</td><td>供应商数据 + 行业因子</td></tr><tr><td>购入能源</td><td>0.414 tCO₂e</td><td>19.0%</td><td>${safe(ctx.power?.versionId || "电力资产")} + 区域电网因子</td></tr><tr><td>燃料与过程排放</td><td>0.262 tCO₂e</td><td>12.0%</td><td>实测燃料与工艺数据</td></tr><tr><td>运输、废弃物及其他</td><td>0.109 tCO₂e</td><td>5.0%</td><td>实际路线 + 处理路径</td></tr></tbody></table></div><aside class="pcf-quality-register"><span class="pcf-kicker">METHOD & DATA QUALITY</span><h2>方法与数据质量</h2><dl><div><dt>一次活动数据覆盖</dt><dd>78%</dd></div><div><dt>排放因子覆盖</dt><dd>100%</dd></div><div><dt>分配方法</dt><dd>质量分配</dd></div><div><dt>生物源碳 / 移除</dt><dd>不适用</dd></div><div><dt>因子集</dt><dd>CN-EF-2026.1</dd></div><div><dt>输入快照</dt><dd>${safe(snapshotId)}</dd></div></dl><p>数据质量、排除项和不确定性将在报告中单独说明。</p></aside></section>`;
    $("#main").innerHTML = `${pcfChannelHeader("计算与排放热点", "基于已确认事实和固定因子版本生成可重现的计算草稿，并识别主要排放来源。")}${state.pcfCalculationFailed ? pcfRecovery("计算未完成", "排放因子版本读取失败。已确认的数据和输入快照均已保留，可安全重试。", "重新加载因子并计算", 'data-action="pcf-retry-calculation"') : blocked ? pcfRecovery("活动数据尚未确认", "完成数据域校验并确认待处理服务绑定后，才能建立输入快照和运行计算。", "返回活动数据", 'data-page="pcf-data"') : canRun ? `<section class="pcf-calculation-ready"><div><span class="pcf-kicker">STEP 04 · READY TO CALCULATE</span><h2>输入已锁定，可以生成计算草稿</h2><p>本次运行将锁定绑定 ${safe(ctx.powerBinding?.id || "BIND-REC-POWER-PCF")} 引用的资产版本 ${safe(ctx.powerBinding?.assetVersionId || ctx.power?.versionId || "")}。运行完成后，输入快照不会被后续上传覆盖。</p>${actionButton("运行确定性计算", "primary", 'data-action="pcf-run-calculation"')}</div><dl><div><dt>确认绑定</dt><dd>${safe(ctx.powerBinding?.id || "—")}</dd></div><div><dt>资产版本</dt><dd>${safe(ctx.powerBinding?.assetVersionId || "—")}</dd></div><div><dt>因子集</dt><dd>CN-EF-2026.1</dd></div><div><dt>功能单位</dt><dd>1 吨产品</dd></div></dl></section>` : `<section class="result-summary"><div class="pcf-result-total"><span class="pcf-kicker">${safe(runId)} · 计算草稿</span><strong>2.18</strong><span>tCO₂e / t 产品</span><p>因子集 CN-EF-2026.1<br>输入快照 ${safe(snapshotId)}</p></div><div class="hotspot-list"><header><div><span class="pcf-kicker">EMISSION HOTSPOTS</span><h2>排放热点</h2></div>${statusChip(ctx.snapshot?.status === "STALE" ? "已过期" : "可重现", ctx.snapshot?.status === "STALE" ? "warn" : "ok")}</header><ol><li style="--share:64%"><span>钢铁上游原料</span><b>64%</b></li><li style="--share:19%"><span>购入电力</span><b>19%</b></li><li style="--share:12%"><span>燃料与过程排放</span><b>12%</b></li><li style="--share:5%"><span>厂内运输及其他</span><b>5%</b></li></ol><footer><p>结果尚未成为正式报告，需完成专家复核。</p><button class="text-button" data-page="pcf-report">进入专家复核 →</button></footer></div></section>${resultDetail}`}`;
  }

  function renderPcfReport() {
    const item = workflowEngine.get("PCF-2026-001");
    const ctx = pcfPowerContext();
    const snapshotId = ctx.snapshot?.id || "SNAP-PCF-HRC-01";
    const runId = ctx.run?.id || "ARUN-PCF-001";
    const productName = ctx.product?.name || "热轧非合金钢卷";
    const ready = item?.status === "DELIVERABLE_READY";
    const inReview = item?.status === "EXPERT_REVIEW";
    const reportHeader = `<section class="pcf-report-overview"><div><span class="pcf-kicker">PCF REPORT · ${ready ? "REV 1" : "WORKING DRAFT"}</span><h2>${safe(productName)}产品碳足迹报告</h2><p>方法边界、活动数据、排放因子、计算血缘与热点分析将形成同一受控版本。</p></div><dl><div><dt>计算运行</dt><dd>${inReview || ready ? safe(runId) : "尚未生成"}</dd></div><div><dt>版本</dt><dd>${ready ? "Rev 1" : "Draft"}</dd></div><div><dt>状态</dt><dd>${workflowStateLabel(item?.status)}</dd></div></dl></section>`;
    const reportOutline = `<section class="pcf-report-outline" aria-labelledby="pcfReportOutline"><header><div><span class="pcf-kicker">REPORT CONTENTS</span><h2 id="pcfReportOutline">报告内容与完成状态</h2></div><small>${ready ? "9 / 9 已完成" : inReview ? "8 / 9 已完成" : "3 / 9 已准备"}</small></header><ol><li class="done"><span>01</span><div><strong>研究目标、预期用途与受众</strong><small>披露用途、产品和核算期间</small></div></li><li class="done"><span>02</span><div><strong>功能单位与产品系统</strong><small>产品描述、参考流和生产技术</small></div></li><li class="done"><span>03</span><div><strong>系统边界与排除项</strong><small>生命周期阶段、截断与排除理由</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>04</span><div><strong>生命周期清单与证据</strong><small>活动数据、供应商数据和证据索引</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>05</span><div><strong>分配、数据质量与方法选择</strong><small>分配依据、代表性和一次数据比例</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>06</span><div><strong>排放因子与计算血缘</strong><small>因子来源、版本、GWP 与输入快照</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>07</span><div><strong>结果、生命周期阶段与热点</strong><small>总量、阶段贡献和主要排放源</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>08</span><div><strong>限制、不确定性与解释</strong><small>假设、缺口、敏感项和使用限制</small></div></li><li class="${ready ? "done" : "current"}"><span>09</span><div><strong>专家复核与版本声明</strong><small>复核意见、修订记录和受控交付</small></div></li></ol></section>`;
    $("#main").innerHTML = `${pcfChannelHeader("复核与报告", "把边界、清单、证据、计算、数据质量与限制组织为同一受控版本，再由专家完成最终复核。")}${reportHeader}${reportOutline}${inReview ? `<section class="pcf-review-grid"><div class="pcf-card review-checklist"><header class="pcf-card__header"><div><span class="pcf-kicker">STEP 05 · EXPERT REVIEW</span><h2>专家复核清单</h2></div><small>3 / 4 已完成</small></header><ul><li class="done"><span>✓</span><div><strong>核算目标与功能单位一致</strong><small>与项目范围定义一致</small></div></li><li class="done"><span>✓</span><div><strong>活动数据已关联证明材料</strong><small>${safe(ctx.power?.versionId || "资产版本")} · ${safe(ctx.evidence?.id || "EVD-HX-POWER-2026Q3")}</small></div></li><li class="done"><span>✓</span><div><strong>确定性计算可重现</strong><small>${safe(runId)} · ${safe(snapshotId)}</small></div></li><li><span>4</span><div><strong>方法说明、限制与不确定性待签署</strong><small>完成后生成受控版本 Rev 1</small></div></li></ul><footer class="pcf-card__actions"><p>复核完成前，客户只能查看工作草稿。</p>${state.role === "customer_approver" ? actionButton("查看当前草稿", "secondary", 'data-drawer="pcf-report-preview"') : actionButton("完成复核并生成 Rev 1", "primary", 'data-action="pcf-complete-review"')}</footer></div><aside class="pcf-version-note"><span class="pcf-kicker">VERSION CONTROL</span><h2>本版将锁定什么</h2><dl><div><dt>系统边界</dt><dd>从摇篮到大门</dd></div><div><dt>活动数据</dt><dd>${safe(ctx.powerBinding?.assetVersionId || "已确认资产版本")}</dd></div><div><dt>输入快照</dt><dd>${safe(snapshotId)}</dd></div><div><dt>因子集</dt><dd>CN-EF-2026.1</dd></div></dl><p>后续更正将生成新修订版，不覆盖本次复核记录。</p></aside></section>` : !ready ? pcfRecovery("报告尚未就绪", "需要先完成数据域确认与确定性计算；已经确认的范围内容会保留在报告草稿中。", "查看计算状态", 'data-page="pcf-results"') : `<section class="pcf-report-ready"><div><span class="pcf-ready-mark" aria-hidden="true">✓</span><span class="pcf-kicker">CONTROLLED OUTPUT · REV 1</span><h2>报告已通过复核，可以预览和交付</h2><p>生成于 2026-10-21 · ${safe(runId)} · 输入快照 ${safe(snapshotId)}${ctx.snapshot?.locked ? " · 已锁定" : ""}</p><div>${actionButton("预览 PCF 报告", "primary", 'data-drawer="pcf-report-preview"')}<button class="button button--secondary" data-page="shared-deliverables">在交付中心查看</button></div></div><dl><div><dt>核算结果</dt><dd>2.18 tCO₂e / t 产品</dd></div><div><dt>系统边界</dt><dd>从摇篮到大门</dd></div><div><dt>一次数据覆盖</dt><dd>78%</dd></div><div><dt>复核状态</dt><dd>专家复核完成</dd></div></dl></section>`}`;
  }

  function renderMultiServicePage() {
    if (state.page === "services-hub") { renderServicesHub(); return true; }
    if (state.page === "shared-tasks") { renderSharedTasks(); return true; }
    if (state.page === "shared-files") { renderSharedFiles(); return true; }
    if (state.page === "shared-deliverables") { renderSharedDeliverables(); return true; }
    if (state.page === "org-settings") { renderSharedOrganization(); return true; }
    if (state.page === "pcf-scope") { renderPcfScope(); return true; }
    if (state.page === "pcf-boundary") { renderPcfBoundary(); return true; }
    if (state.page === "pcf-data") { renderPcfData(); return true; }
    if (state.page === "pcf-results") { renderPcfResults(); return true; }
    if (state.page === "pcf-report") { renderPcfReport(); return true; }
    return false;
  }
