"use strict";

  const pcfSteps = ["SCOPING", "COLLECTING", "NEEDS_CONFIRMATION", "CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY"];

  function serviceEntryPage(serviceId) {
    if (serviceId === "cbam") return state.role === "customer_contrib" ? "contributor-work" : state.role === "customer_approver" ? "approvals" : "work";
    if (serviceId === "pcf") return state.role === "customer_contrib" ? "pcf-data" : state.role === "customer_approver" ? "pcf-report" : "pcf-scope";
    return null;
  }

  function servicePrimaryAction(service, { compact = false } = {}) {
    if (!service.roles.includes(state.role)) {
      return compact
        ? `<button class="text-button" type="button" data-drawer="service-consultation" data-service-id="${service.id}">预约咨询 →</button>`
        : `<button class="button button--secondary" type="button" data-drawer="service-consultation" data-service-id="${service.id}">预约咨询</button>`;
    }
    const page = serviceEntryPage(service.id);
    const label = service.id === "pcf" ? (workflowEngine.get("PCF-2026-001")?.status === "SCOPING" ? "开始项目" : "继续项目")
      : state.role === "customer_contrib" ? "查看分配" : state.role === "customer_approver" ? "处理审批" : "继续工作";
    return compact
      ? `<button class="button button--primary button--compact" type="button" data-service-enter="${service.id}" data-page-target="${page}">${label}</button>`
      : `<button class="button button--primary" type="button" data-service-enter="${service.id}" data-page-target="${page}">${label}</button>`;
  }

  function serviceProgressLine(service) {
    if (service.id === "cbam") {
      if (state.role === "customer_contrib") return { title: "2 项材料待补充", detail: "按你的分工筛选", percent: 40 };
      if (state.role === "customer_approver") return { title: "2 项决定待审批", detail: "按你的授权筛选", percent: 55 };
      return { title: "Q3 数据采集", detail: "2026 年度进行中", percent: 68 };
    }
    if (service.id === "pcf") {
      const status = workflowEngine.get("PCF-2026-001")?.status || "SCOPING";
      const idx = Math.max(0, pcfSteps.indexOf(status));
      return {
        title: workflowStateLabel(status),
        detail: "热轧非合金钢卷",
        percent: Math.round(((idx + 1) / pcfSteps.length) * 100),
        pilot: true,
      };
    }
    return null;
  }

  function serviceOverviewFacts(service) {
    if (service.id === "cbam") return [
      ["产品范围", "4 个"],
      ["生产设施", "2 座"],
      ["发运批次", "18 批"],
    ];
    if (service.id === "pcf") {
      const progress = serviceProgressLine(service);
      return [
        ["足迹项目", "1 项"],
        ["核算产品", "1 个"],
        ["当前阶段", progress?.title || "核算声明"],
      ];
    }
    const scope = {
      esg: [["工作范围", "议题与指标"], ["数据对象", "披露证据"], ["交付方向", "ESG 报告"]],
      inventory: [["工作范围", "组织边界"], ["数据对象", "排放源"], ["交付方向", "盘查报告"]],
      assets: [["工作范围", "绿电需求"], ["数据对象", "证书资产"], ["交付方向", "履约记录"]],
      export: [["工作范围", "法规识别"], ["数据对象", "出口材料"], ["交付方向", "合规交付"]],
    };
    return scope[service.id] || [["工作范围", "待确认"], ["数据对象", "待确认"], ["交付方向", "服务成果"]];
  }

  function serviceOverviewAction(service) {
    const page = serviceEntryPage(service.id);
    if (page) return `data-service-enter="${safe(service.id)}" data-page-target="${safe(page)}"`;
    return `data-drawer="service-consultation" data-service-id="${safe(service.id)}" data-drawer-label="${safe(service.name)}"`;
  }

  function serviceOverviewIcon(service) {
    const icon = {
      cbam: "landmark",
      pcf: "footprints",
      esg: "notebook-tabs",
      inventory: "cloud-cog",
      assets: "leaf",
      export: "ship",
    }[service.id] || "layers-3";
    const url = lucideIcon(icon);
    return `<span class="service-overview-card__icon" aria-hidden="true"><i style="-webkit-mask-image:url(${url});mask-image:url(${url})"></i></span>`;
  }

  function serviceOverviewCard(service) {
    const facts = serviceOverviewFacts(service);
    return `<article class="service-overview-card">
      <header>
        <span class="service-overview-card__identity">${serviceOverviewIcon(service)}<span class="service-overview-card__code">${safe(service.code)}</span></span>
        <button class="service-overview-card__enter" type="button" ${serviceOverviewAction(service)} aria-label="查看${safe(service.name)}">查看服务 <span aria-hidden="true">→</span></button>
      </header>
      <div class="service-overview-card__copy">
        <h3>${safe(service.name)}</h3>
        <p>${safe(service.description)}</p>
      </div>
      <dl>${facts.map(([label, value]) => `<div><dt>${safe(label)}</dt><dd>${safe(value)}</dd></div>`).join("")}</dl>
    </article>`;
  }

  function serviceOverviewContent() {
    const services = Object.values(serviceRegistry);
    return `<div class="service-overview-backdrop" aria-hidden="true"></div>
      <div class="service-overview-dialog" role="dialog" aria-labelledby="serviceOverviewTitle" aria-describedby="serviceOverviewIntro">
        <header class="service-overview-head">
          <div>
            <span class="service-overview-kicker">LUMINO SERVICES · ${services.length} 项服务</span>
            <h2 id="serviceOverviewTitle">应对全球绿色要求，我们全程陪伴。</h2>
            <p id="serviceOverviewIntro">从碳边境调节、产品碳足迹到 ESG 报告，在此汇总企业可用服务与当前范围；选择一项即可进入对应工作。</p>
          </div>
          <div class="service-overview-actions">
            <button type="button" data-service-overview="collapse" aria-label="收起服务总览"><span aria-hidden="true">−</span><em>收起</em></button>
            <button type="button" data-service-overview="close" aria-label="关闭服务总览"><span aria-hidden="true">×</span><em>关闭</em></button>
          </div>
        </header>
        <div class="service-overview-grid">${services.map(serviceOverviewCard).join("")}</div>
        <footer class="service-overview-foot">
          <span>统计范围：华星钢铁 · 2026 年当前演示数据</span>
          <button class="text-button" type="button" data-service-overview="close">进入工作台 →</button>
        </footer>
      </div>`;
  }

  function syncServiceOverview() {
    const layer = $("#serviceOverviewLayer");
    const dock = $("#serviceOverviewDock");
    if (!layer || !dock) return;
    const mode = isCustomer() && state.loggedIn ? (state.serviceOverviewMode || "open") : "closed";
    if (mode === "open") {
      const wasHidden = layer.hidden;
      if (!layer.innerHTML || layer.dataset.role !== state.role) {
        layer.innerHTML = serviceOverviewContent();
        layer.dataset.role = state.role;
      }
      layer.hidden = false;
      dock.hidden = true;
      document.body.classList.add("service-overview-open");
      if (wasHidden) queueMicrotask(() => layer.querySelector("[data-service-overview='collapse']")?.focus());
      return;
    }
    layer.hidden = true;
    dock.hidden = mode !== "collapsed";
    document.body.classList.remove("service-overview-open");
  }

  function setServiceOverviewMode(mode) {
    state.serviceOverviewMode = mode;
    syncServiceOverview();
    if (mode === "open") queueMicrotask(() => $("#serviceOverviewLayer [data-service-overview='collapse']")?.focus());
    if (mode === "collapsed") queueMicrotask(() => $("#serviceOverviewDock")?.focus());
    if (mode === "closed") queueMicrotask(() => $("#main")?.focus({ preventScroll: true }));
  }

  function renderServicesHub() {
    const services = Object.values(serviceRegistry);
    $("#main").innerHTML = `
      <div class="service-hub-shell">
        ${pageHeader(`${services.length} 项企业服务`, "服务总览")}
        <div class="service-overview-grid service-overview-grid--page">${services.map(serviceOverviewCard).join("")}</div>
      </div>`;
  }

  function workbenchGreeting(name) {
    const hour = new Date().getHours();
    const hello = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
    return `${hello}，${name}`;
  }

  function orgShortName(name = "") {
    return String(name).replace(/(股份)?有限公司$/u, "").trim() || name || "当前企业";
  }

  function renderWorkbench() {
    const actor = roleConfig[state.role].name;
    const taskView = sharedCenterViews.tasks({ role: state.role, actor });
    const openServices = Object.values(serviceRegistry).filter((service) => service.roles.includes(state.role) && service.entryPage);
    const consultServices = Object.values(serviceRegistry).filter((service) => !(service.roles.includes(state.role) && service.entryPage));
    const focus = taskView.items[0] || null;
    const queueTasks = taskView.items.slice(0, 5);
    const crumb = orgShortName(state.organization?.name);

    const nextAction = focus
      ? `<section class="next-action" aria-labelledby="workbenchFocusTitle">
          <div class="next-action__copy">
            <small class="next-action__kicker">今天最重要 · ${safe(focus.serviceCode || "任务")}</small>
            <strong id="workbenchFocusTitle">${safe(focus.title)}</strong>
            <span>${safe(focus.due.label)}，${safe(focus.nextStep)}</span>
          </div>
          <button class="button button--primary" type="button" data-service-enter="${safe(focus.serviceId)}" data-page-target="${safe(focus.page)}">继续处理<span aria-hidden="true">→</span></button>
        </section>`
      : `<section class="next-action next-action--done" aria-label="待办已完成">
          <div class="next-action__copy">
            <strong>你在本季度的待办已全部处理</strong>
            <span>等待中的事项会在对方回复后出现在这里，并发送通知。</span>
          </div>
          <button class="button button--secondary" type="button" data-page="shared-tasks">查看全部任务</button>
        </section>`;

    const queuePreview = queueTasks.length
      ? `<ul class="workbench-queue">${queueTasks.map((task) => `<li data-service-enter="${safe(task.serviceId)}" data-page-target="${safe(task.page)}" role="button" tabindex="0">
          <span class="workbench-queue__code">${safe(task.serviceCode)}</span>
          <div class="workbench-queue__body"><strong>${safe(task.title)}</strong><small>${safe(task.object)} · ${safe(task.nextStep)}</small></div>
          <span class="status-chip ${task.due.tone === "danger" ? "danger" : task.due.tone === "warn" ? "warn" : ""}">${safe(task.due.label)}</span>
          <span class="workbench-queue__go">处理</span>
        </li>`).join("")}</ul>`
      : `<p class="workbench-quiet">暂无待办。</p>`;

    const serviceCards = openServices.map((service) => {
      const progress = serviceProgressLine(service);
      const page = serviceEntryPage(service.id);
      const tone = progress?.pilot ? "warn" : "ok";
      const status = progress?.pilot ? "试点" : "已开通";
      const meta = progress?.pilot ? (progress.detail || "") : `${state.year} · ${state.quarter}`;
      return `<button class="workbench-service-card" type="button" data-service-enter="${safe(service.id)}" data-page-target="${safe(page)}">
        <span class="workbench-service-card__top">
          <span class="mono workbench-service-card__code ${tone === "warn" ? "is-warn" : ""}">${safe(service.code)} · ${status}</span>
          <span class="workbench-service-card__meta">${safe(meta)}</span>
        </span>
        <strong>${safe(service.name)}</strong>
        ${progress && !progress.pilot ? `<span class="progress-bar" aria-hidden="true"><i style="width:${progress.percent}%"></i></span>` : ""}
        <span class="workbench-service-card__foot">
          <span>${progress ? `${safe(progress.title)}${progress.percent && !progress.pilot ? ` ${progress.percent}%` : ""}` : safe(service.description)}</span>
          <span class="workbench-service-card__go">进入频道 →</span>
        </span>
      </button>`;
    }).join("");

    const consultLink = consultServices.length
      ? `<button class="workbench-consult-link" type="button" data-service-overview="open">
          <span>ESG、碳盘查等 ${consultServices.length} 项服务</span>
          <span>查看全部服务 →</span>
        </button>`
      : "";

    $("#main").innerHTML = `
      <div class="workbench" data-template="T1">
        <header class="workbench__head">
          <div>
            <p class="workbench__meta">${safe(crumb)}</p>
            <h1>${safe(workbenchGreeting(actor))}</h1>
          </div>
        </header>

        ${nextAction}

        <div class="workbench-grid workbench-grid--proto">
          <section class="ds-card workbench-todo" aria-labelledby="workbenchQueueTitle">
            <header class="ds-card__head">
              <h2 id="workbenchQueueTitle">我的待办 · 所有服务</h2>
              <button class="text-button" type="button" data-page="shared-tasks">全部任务 →</button>
            </header>
            ${queuePreview}
          </section>
          <div class="workbench-col workbench-col--services">
            ${serviceCards || `<p class="workbench-quiet">暂无开通服务。</p>`}
            ${consultLink}
          </div>
        </div>
      </div>`;
  }

  function taskBucket(task) {
    return /等待|供应商|回执/.test(`${task.nextStep || ""}${task.title || ""}`) ? "waiting" : "open";
  }

  function taskStateLabel(task) {
    if (task.due?.tone === "danger") return ["已逾期", "danger"];
    if (taskBucket(task) === "waiting") return ["等待中", "warn"];
    if (task.due?.tone === "warn") return ["待处理", "warn"];
    return ["进行中", "ok"];
  }

  function renderSharedTasks() {
    const view = sharedCenterViews.tasks({ role: state.role, actor: roleConfig[state.role].name });
    const tab = state.taskTab || "open";
    const waiting = view.items.filter((task) => taskBucket(task) === "waiting");
    const open = view.items.filter((task) => taskBucket(task) === "open");
    const filtered = tab === "waiting" ? waiting
      : tab === "done" ? []
      : tab === "all" ? view.items
      : open;
    const titleMap = { open: "待处理", waiting: "等待他人", done: "已完成", all: "全部任务" };
    const meta = `${view.summary.total} 项跨服务任务${view.summary.urgent ? ` · ${view.summary.urgent} 项紧急` : ""}`;
    const rows = filtered.map((task) => {
      const [stateLabel, tone] = taskStateLabel(task);
      return `<tr class="shared-row" data-service-enter="${safe(task.serviceId)}" data-page-target="${safe(task.page)}" tabindex="0" role="button">
        <td data-label="服务"><span class="shared-code">${safe(task.serviceCode)}</span></td>
        <td data-label="任务"><strong>${safe(task.title)}</strong><small>${safe(task.object)} · ${safe(task.nextStep)}</small></td>
        <td data-label="截止">${safe(task.due.label)}</td>
        <td data-label="状态"><span class="status-chip ${tone === "danger" ? "danger" : tone === "warn" ? "warn" : ""}">${safe(stateLabel)}</span></td>
        <td data-label="操作" class="shared-row__go">处理 →</td>
      </tr>`;
    }).join("");
    const empty = `<tr class="shared-empty-row"><td colspan="5">${systemStatePanel({
      code: "empty",
      title: tab === "done" ? "还没有已完成任务" : "这一分类下暂时没有任务",
      reason: tab === "done" ? "完成后的任务会保留在这里，便于回溯。" : "可切换左侧分类，或返回工作台查看摘要。",
      canDo: ["切换「待处理 / 等待他人 / 全部」", "返回工作台"],
      primary: { label: "返回工作台", attrs: 'data-page="workbench"' },
    })}</td></tr>`;
    const org = state.organization?.name || "华星钢铁";
    $("#main").innerHTML = listPageShell({
      meta: `${org} / 我的任务`,
      title: titleMap[tab] || "我的任务",
      aside: statusChip(meta),
      body: `<section class="ds-table shared-list shared-list--tasks" aria-label="已授权任务"><table><colgroup><col class="shared-col--svc"><col class="shared-col--main"><col class="shared-col--due"><col class="shared-col--state"><col class="shared-col--go"></colgroup><thead><tr><th>服务</th><th>任务</th><th>截止</th><th>状态</th><th></th></tr></thead><tbody>${rows || empty}</tbody></table></section>`,
    });
  }

  function renderSharedFiles() {
    const facet = state.assetFacet || "attention";
    const assetView = assetViews.overview({ role: state.role, serviceId: null, facet });
    const { items: assetItems, facets } = assetView;
    const title = facets.find((item) => item.id === facet)?.label || "数据资产";
    const org = state.organization?.name || "华星钢铁";
    const rows = assetItems.map(({ asset, bindings, hasPendingBinding, primaryIssue }) => {
      const serviceTags = bindings.length
        ? [...new Set(bindings.map((binding) => assetServiceName(binding.serviceId)))].join(" ")
        : "—";
      const tone = asset.status === "CONFIRMED" && !hasPendingBinding ? "ok" : "warn";
      const statusText = hasPendingBinding && asset.status === "CONFIRMED"
        ? "PCF 待确认"
        : (assetStatusLabels[asset.status] || asset.status);
      return `<tr class="shared-row" data-drawer="asset-detail" data-asset-id="${safe(asset.id)}" tabindex="0" role="button">
        <td data-label="资产"><small class="shared-type">${safe(assetTypeLabels[asset.type] || asset.type)}</small><strong>${safe(asset.name)}</strong><small class="mono">${safe(asset.versionId)}</small></td>
        <td data-label="期间 · 责任"><strong>${safe(assetCoverageText(asset))}</strong><small>${safe(asset.steward?.ownerName || assetSubjectText(asset) || "责任人待分配")}</small></td>
        <td data-label="服务使用"><span class="mono">${safe(serviceTags)}</span></td>
        <td data-label="状态"><span class="status-chip ${tone === "ok" ? "" : "warn"}">${safe(statusText)}</span>${primaryIssue ? `<small>${safe(primaryIssue)}</small>` : ""}</td>
        <td data-label="操作" class="shared-row__go">详情 →</td>
      </tr>`;
    }).join("");
    $("#main").innerHTML = listPageShell({
      meta: `${org} / 数据资产`,
      title,
      aside: `<button class="button button--secondary" type="button" data-drawer="upload-evidence">登记新资料</button>`,
      body: `<section class="ds-table shared-list shared-list--assets" aria-label="数据资产列表"><table><colgroup><col class="shared-col--asset"><col class="shared-col--period"><col class="shared-col--svc-use"><col class="shared-col--state"><col class="shared-col--go"></colgroup><thead><tr><th>资产</th><th>期间 · 责任</th><th>服务使用</th><th>状态</th><th></th></tr></thead><tbody>${rows || `<tr class="shared-empty-row"><td colspan="5">${systemStatePanel({
        code: "empty",
        title: "这一分类暂时没有资产",
        reason: facet === "attention" ? "没有待你确认的绑定或质量问题。" : "可切换左侧分类，或登记新资料。",
        canDo: ["切换资产分类", "登记新资料"],
        primary: { label: "登记新资料", attrs: 'data-drawer="upload-evidence"' },
      })}</td></tr>`}</tbody></table></section>`,
      footnote: `<p class="shared-footnote">状态由列表第一行承担；详情在右侧 Drawer 打开，主操作跳回对应服务频道。</p>`,
    });
  }

  function renderSharedDeliverables() {
    const view = sharedCenterViews.deliverables({ role: state.role, actor: roleConfig[state.role].name });
    const df = state.delivFilter || "all";
    const filtered = view.items.filter((item) => df === "all" || (df === "mine" ? item.mine : item.serviceCode === df));
    const titleMap = { all: "全部交付物", mine: "待我处理", CBAM: "CBAM 交付物", PCF: "PCF 交付物" };
    const org = state.organization?.name || "华星钢铁";
    const toneFor = (item) => ["已锁定", "已共享", "已交付", "已回执", "已封存", "核查完成"].includes(item.status) ? "ok"
      : ["内部复核", "待复核", "核查中", "整改中", "采集中"].includes(item.status) ? "warn" : "locked";
    const rows = filtered.map((item) => `<tr class="shared-row" data-service-enter="${safe(item.serviceId)}" data-page-target="${safe(item.page)}" tabindex="0" role="button">
      <td data-label="服务"><span class="shared-code">${safe(item.serviceCode)}</span></td>
      <td data-label="交付物"><strong>${safe(item.name)}</strong><small class="mono">${safe(item.id)} · ${safe(item.version)}</small></td>
      <td data-label="接收方 · 更新"><strong>${safe(item.recipient)}</strong><small>${safe(item.when)}</small></td>
      <td data-label="状态"><span class="status-chip ${toneFor(item) === "ok" ? "" : toneFor(item) === "warn" ? "warn" : "locked"}">${safe(item.status)}</span></td>
      <td data-label="操作" class="shared-row__go">${item.mine ? "去处理 →" : "详情 →"}</td>
    </tr>`).join("");
    const empty = `<tr class="shared-empty-row"><td colspan="5">${systemStatePanel({
      code: "empty",
      title: "这一分类下暂时没有交付物",
      reason: "报告或数据包在对应服务里生成后会出现在这里。",
      canDo: ["切换左侧分类", "进入 CBAM / PCF 服务"],
      primary: { label: "返回工作台", attrs: 'data-page="workbench"' },
    })}</td></tr>`;
    $("#main").innerHTML = listPageShell({
      meta: `${org} / 交付中心`,
      title: titleMap[df] || "交付中心",
      aside: statusChip(`${view.summary.total} 项交付物`),
      body: `<p class="shared-legend" role="note"><span>已共享 ≠ 已接收</span><span>回执由进口商确认后才出现</span><span>正式操作仍回到对应服务频道</span></p>
      <section class="ds-table shared-list shared-list--deliverables" aria-label="已授权交付物"><table><colgroup><col class="shared-col--svc"><col class="shared-col--main"><col class="shared-col--recipient"><col class="shared-col--state"><col class="shared-col--go"></colgroup><thead><tr><th>服务</th><th>交付物</th><th>接收方 · 更新</th><th>状态</th><th></th></tr></thead><tbody>${rows || empty}</tbody></table></section>`,
      footnote: `<p class="shared-footnote">交付中心汇总只读查看；共享、审批等操作在对应服务频道或详情中完成。</p>`,
    });
  }

  function renderSharedOrganization() {
    if (canManageOrganization()) { renderOrganizationSettings(); return; }
    const scope = state.role === "customer_contrib" ? "仅分配给我的任务与材料" : state.role === "customer_approver" ? "待审批对象与受控交付物" : "当前企业已开通服务与项目对象";
    $("#main").innerHTML = `<div class="portal-shell">
      ${pageHeader("只显示你当前可见的范围", "企业与权限", statusChip("只读", "locked"))}
      <section class="permission-self ds-card">
        <header class="ds-card__head"><h2>我的有效权限</h2><button class="text-button" type="button" data-drawer="permission-audit">查看权限来源</button></header>
        <dl>
          <div><dt>企业</dt><dd>${safe(state.organization.name)}</dd></div>
          <div><dt>当前角色</dt><dd>${safe(roleConfig[state.role].title)}</dd></div>
          <div><dt>授权范围</dt><dd>${scope}</dd></div>
          <div><dt>可进入服务</dt><dd>CBAM、产品碳足迹 PCF</dd></div>
        </dl>
      </section>
    </div>`;
  }

  const pcfStepLabels = {
    SCOPING: "核算声明",
    COLLECTING: "活动数据",
    NEEDS_CONFIRMATION: "绑定确认",
    CALCULATING: "碳足迹计算",
    EXPERT_REVIEW: "独立复核",
    DELIVERABLE_READY: "报告就绪",
  };

  function pcfStepNav(page = state.page) {
    const chain = [
      ["pcf-scope", "核算声明"],
      ["pcf-boundary", "系统边界"],
      ["pcf-data", "活动数据"],
      ["pcf-results", "计算与热点"],
      ["pcf-report", "复核与报告"],
    ];
    const index = Math.max(0, chain.findIndex(([id]) => id === page));
    const prev = index > 0 ? { label: `上一步：${chain[index - 1][1]}`, attrs: `data-page="${chain[index - 1][0]}"` } : { label: "返回服务目录", attrs: 'data-page="services-hub"' };
    const next = index < chain.length - 1
      ? { label: `继续：${chain[index + 1][1]}`, attrs: `data-page="${chain[index + 1][0]}"` }
      : { label: "返回工作台", attrs: 'data-page="workbench"' };
    const hints = {
      "pcf-scope": "确认后进入系统边界；草稿会自动保留。",
      "pcf-boundary": "边界写入后，活动数据模板按此范围生成。",
      "pcf-data": "完成校验与绑定确认后，才能进入计算。",
      "pcf-results": "计算草稿可重现；正式披露需经独立复核。",
      "pcf-report": "锁定后输入版本不可覆盖，只能开新修订。",
    };
    return stepFlowFooter({ prev, next, hint: hints[page] || "" });
  }

  function pcfChannelHeader(title, description) {
    const item = workflowEngine.get("PCF-2026-001");
    const declaration = item?.metadata?.declaration || {};
    const product = assetRegistry.get(declaration.productId || item?.metadata?.productId || "PRD-HRC-01");
    const productName = declaration.productName || product?.name || "热轧非合金钢卷";
    const productCode = product?.payload?.internalCode || "HRC-01";
    const index = Math.max(0, pcfSteps.indexOf(item?.status));
    return `${pageHeader(`PCF · ${safe(productCode)} · 试点`, title, statusChip(workflowStateLabel(item?.status || "SCOPING"), workflowStateTone(item?.status)))}
      <div class="pcf-shell" data-template="T4">
        <section class="pcf-context" aria-label="当前 PCF 项目">
          <div class="pcf-context__identity"><span>试点项目</span><strong>${safe(productName)}</strong><small>${safe(productCode)} · 华星钢铁有限公司${declaration.confirmed ? ` · ${safe(declaration.functionalUnit || "")}` : ""}</small></div>
          <p class="pcf-channel-lead">${description}</p>
          <button class="text-button" type="button" data-page="services-hub">返回服务</button>
        </section>
        <ol class="pcf-progress" aria-label="PCF 工作流状态">${pcfSteps.map((step, i) => `<li class="${i < index ? "done" : i === index ? "current" : ""}" ${i === index ? 'aria-current="step"' : ""}><span aria-hidden="true">${i < index ? "✓" : i + 1}</span><small>${pcfStepLabels[step]}</small></li>`).join("")}</ol>
      </div>`;
  }

  function pcfRecovery(message, detail, action, attributes) {
    return `<section class="pcf-recovery" role="status"><div><span class="pcf-kicker">NEXT STEP</span><h2>${message}</h2><p>${detail}</p></div>${actionButton(action, "primary", attributes)}</section>`;
  }

  function pcfProductOptions(selectedId = "PRD-HRC-01") {
    const products = assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role, type: "product" });
    if (!products.length) return "<option value=\"\">暂无产品主档</option>";
    return products.map((product) => {
      const code = product.payload?.internalCode || product.id;
      return `<option value="${safe(product.id)}" ${product.id === selectedId ? "selected" : ""}>${safe(product.name)} · ${safe(code)}</option>`;
    }).join("");
  }

  function pcfDeclarationView() {
    const item = workflowEngine.get("PCF-2026-001");
    const stored = item?.metadata?.declaration || {};
    const product = assetRegistry.get(stored.productId || item?.metadata?.productId || "PRD-HRC-01");
    const defaults = window.LuminoPcfDeclaration
      ? window.LuminoPcfDeclaration.defaultsForProduct(product)
      : {};
    const declaration = window.LuminoPcfDeclaration
      ? window.LuminoPcfDeclaration.normalize(stored, defaults)
      : { ...defaults, ...stored };
    return { item, product, declaration, confirmed: Boolean(declaration.confirmed) };
  }


  function pcfFactorContext(item) {
    const declaration = item?.metadata?.declaration || {};
    const ctx = pcfPowerContext();
    return {
      declaration,
      facilityGeography: declaration.geography || "中国 · 上海",
      siteLabel: ctx.power?.name || "",
      powerUnit: ctx.unit || "MWh",
      activities: [
        { id: "energy", name: ctx.power?.name || "购入电力", domain: "能源", unit: ctx.unit || "MWh", type: "purchased_electricity" }
      ],
      assumePurchasedElectricity: true
    };
  }

  function pcfRecommendedFactors(item) {
    if (!window.LuminoPcfFactors) return null;
    if (item?.metadata?.factors) return item.metadata.factors;
    return window.LuminoPcfFactors.recommendSet
      ? window.LuminoPcfFactors.recommendSet(pcfFactorContext(item))
      : window.LuminoPcfFactors.defaultSet(pcfFactorContext(item));
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
    const { item, product, declaration, confirmed } = pcfDeclarationView();
    const status = item?.status;
    const org = assetRegistry.get("ORG-HX-001");
    const goals = (window.LuminoPcfDeclaration?.GOAL_OPTIONS || ["客户披露与供应链响应", "内部减排分析", "产品比较与设计改进"])
      .map((goal) => `<option value="${safe(goal)}" ${declaration.goal === goal ? "selected" : ""}>${safe(goal)}</option>`).join("");
    const readOnly = confirmed || status !== "SCOPING";
    const lockAttr = readOnly ? "disabled" : "";
    $("#main").innerHTML = `${pcfChannelHeader("核算声明与功能单位", "先确认产品、用途、功能单位和期间；确认后才会进入边界与清单。")}
      <div class="pcf-layout">
        <section class="pcf-card pcf-form" aria-labelledby="pcfScopeTitle">
          <header class="pcf-card__header"><div><span class="pcf-kicker">STEP 01 · STUDY DECLARATION</span><h2 id="pcfScopeTitle">核算声明</h2></div><small>${confirmed ? "已确认 · 可追溯" : "8 项必填"} · ${safe(org?.name || "企业主档")}</small></header>
          <div class="pcf-field-grid" data-pcf-declaration-fields>
            <label><span>核算产品</span><small>从企业产品主档选择</small><select name="productId" ${lockAttr}>${pcfProductOptions(declaration.productId || "PRD-HRC-01")}</select></label>
            <label><span>核算目标</span><small>影响报告深度</small><select name="goal" ${lockAttr}>${goals}</select></label>
            <label class="pcf-field--wide"><span>预期用途</span><small>结果将如何被使用</small><input name="intendedUse" ${lockAttr} value="${safe(declaration.intendedUse || "")}" placeholder="例如：向下游客户提供可追溯的产品碳足迹"></label>
            <label class="pcf-field--wide"><span>报告受众</span><small>谁会阅读本声明</small><input name="audience" ${lockAttr} value="${safe(declaration.audience || "")}" placeholder="例如：客户、供应链伙伴与内部管理"></label>
            <label><span>功能单位</span><small>活动数据与结果的共同基准</small><input name="functionalUnit" ${lockAttr} value="${safe(declaration.functionalUnit || "")}" required></label>
            <label><span>参考流</span><small>与功能单位对应的产品数量描述</small><input name="referenceFlow" ${lockAttr} value="${safe(declaration.referenceFlow || "")}" required></label>
            <label><span>期间开始</span><small>活动数据覆盖起点</small><input name="periodStart" type="date" ${lockAttr} value="${safe(declaration.periodStart || "")}" required></label>
            <label><span>期间结束</span><small>活动数据覆盖终点</small><input name="periodEnd" type="date" ${lockAttr} value="${safe(declaration.periodEnd || "")}" required></label>
            <label class="pcf-field--wide"><span>地理与技术适用性</span><small>结果适用的地点与生产技术</small><input name="geography" ${lockAttr} value="${safe([declaration.geography, declaration.technology].filter(Boolean).join(" · "))}" placeholder="中国 · 高炉—转炉、连铸与热轧"></label>
          </div>
          <footer class="pcf-card__actions">
            <p>${confirmed
              ? `已由 ${safe(declaration.confirmedBy || "授权人员")} 确认；后续步骤继承本声明，修订需在独立复核前提出。`
              : "确认后写入正式声明；Agent 不能代替你确认。"}</p>
            ${status === "SCOPING" && !confirmed
              ? actionButton("确认核算声明，继续定义边界", "primary", 'data-action="pcf-confirm-scope"')
              : actionButton("查看边界定义", "secondary", 'data-page="pcf-boundary"')}
          </footer>
        </section>
        <aside class="pcf-agent-note" aria-labelledby="pcfAgentScope"><span class="pcf-agent-mark" aria-hidden="true">✦</span><div><span class="pcf-kicker">PCF AGENT · 准备提示</span><h2 id="pcfAgentScope">声明确认后将据此准备</h2><ol><li>系统边界与截断建议</li><li>与 ${safe(product?.name || declaration.productName || "所选产品")} 对应的过程清单</li><li>能源、原料与运输的模板字段</li></ol><dl><div><dt>当前产品</dt><dd>${safe(declaration.productName || product?.name || "未选择")}</dd></div><div><dt>功能单位</dt><dd>${safe(declaration.functionalUnit || "待填写")}</dd></div><div><dt>期间</dt><dd>${safe(declaration.period || "待填写")}</dd></div></dl><p>以上为 Agent 提议，确认前不会成为正式事实。</p></div></aside>
      </div>
      ${stageGatePanelHtml("pcf", { variant: "footer" })}
      ${pcfStepNav()}`;
  }

  function pcfBoundaryView() {
    const item = workflowEngine.get("PCF-2026-001");
    const declaration = item?.metadata?.declaration || {};
    const stored = item?.metadata?.boundary || {};
    const defaults = window.LuminoPcfBoundary
      ? window.LuminoPcfBoundary.defaultsFromDeclaration(declaration)
      : {};
    const boundary = window.LuminoPcfBoundary
      ? window.LuminoPcfBoundary.normalize(stored, defaults)
      : { ...defaults, ...stored };
    const suggestion = window.LuminoPcfBoundary
      ? window.LuminoPcfBoundary.suggest(declaration)
      : null;
    return {
      item,
      declaration,
      boundary,
      suggestion,
      confirmed: Boolean(boundary.confirmed) || boundary.status === "CONFIRMED",
      declarationReady: Boolean(declaration.confirmed) || (item && !["NOT_STARTED", "SCOPING"].includes(item.status)),
    };
  }

  function renderPcfBoundary() {
    const { item, declaration, boundary, suggestion, confirmed, declarationReady } = pcfBoundaryView();
    const canEdit = declarationReady && !confirmed && ["COLLECTING", "SCOPING"].includes(item?.status);
    const lockAttr = canEdit ? "" : "disabled";
    const typeOptions = (window.LuminoPcfBoundary?.BOUNDARY_TYPES || ["从摇篮到大门", "从大门到大门", "从摇篮到坟墓"])
      .map((type) => `<option value="${safe(type)}" ${boundary.boundaryType === type ? "selected" : ""}>${safe(type)}</option>`).join("");
    const boundaryAction = !declarationReady
      ? actionButton("先确认核算声明", "secondary", 'data-page="pcf-scope"')
      : confirmed
        ? actionButton("查看活动数据", "secondary", 'data-page="pcf-data"')
        : actionButton("确认系统边界，开始采集数据", "primary", 'data-action="pcf-confirm-boundary"');
    const proposal = suggestion?.proposal;
    $("#main").innerHTML = `${pcfChannelHeader("系统边界", "明确生命周期范围与截断；功能单位继承声明，Agent 不能改写。")}
      <div class="pcf-layout">
        <section class="pcf-card pcf-form" aria-labelledby="pcfBoundaryTitle">
          <header class="pcf-card__header"><div><span class="pcf-kicker">STEP 02 · SYSTEM BOUNDARY</span><h2 id="pcfBoundaryTitle">系统边界</h2></div><small>${confirmed ? "已确认 · 可追溯" : "待确认"} · ${workflowStateLabel(item?.status)}</small></header>
          <div class="pcf-field-grid" data-pcf-boundary-fields>
            <label><span>系统边界类型</span><small>决定纳入的生命周期阶段</small><select name="boundaryType" ${lockAttr}>${typeOptions}</select></label>
            <label><span>功能单位（只读）</span><small>继承核算声明，确认边界时不得改写</small><input name="functionalUnitRef" value="${safe(declaration.functionalUnit || boundary.functionalUnitRef || "")}" disabled></label>
            <label class="pcf-field--wide"><span>纳入的生产过程</span><small>按产品实际路径列出；可用顿号或换行分隔</small><textarea name="includedProcesses" rows="3" ${lockAttr}>${safe((boundary.includedProcesses || []).join("、") || boundary.includedProcessesText || "")}</textarea></label>
            <label class="pcf-field--wide"><span>排除项</span><small>明确不纳入核算的阶段或活动</small><textarea name="excludedItems" rows="3" ${lockAttr}>${safe((boundary.excludedItems || []).join("、") || boundary.excludedItemsText || "")}</textarea></label>
            <label class="pcf-field--wide"><span>截断规则</span><small>允许省略的小贡献项及上限</small><textarea name="cutOffRule" rows="2" ${lockAttr}>${safe(boundary.cutOffRule || "")}</textarea></label>
            <label class="pcf-field--wide"><span>截断理由</span><small>说明为何可接受该截断</small><textarea name="cutOffRationale" rows="2" ${lockAttr}>${safe(boundary.cutOffRationale || "")}</textarea></label>
            <label class="pcf-field--wide"><span>主要输入</span><small>用于生成后续活动数据清单</small><textarea name="primaryInputs" rows="2" ${lockAttr}>${safe((boundary.primaryInputs || []).join("、") || boundary.primaryInputsText || "")}</textarea></label>
          </div>
          <footer class="pcf-card__actions">
            <p>${confirmed
              ? `已由 ${safe(boundary.confirmedBy || "授权人员")} 确认；后续模板与清单将继承本边界。`
              : "确认会写入工作流元数据。Agent 提议可以填入表单，但不能代替你确认。"}</p>
            ${boundaryAction}
          </footer>
        </section>
        <aside class="pcf-agent-note pcf-agent-note--proposal" aria-labelledby="pcfAgentBoundary"><span class="pcf-agent-mark" aria-hidden="true">✦</span><div><span class="pcf-kicker">PCF AGENT · proposal_only</span><h2 id="pcfAgentBoundary">${safe(proposal ? `建议采用“${proposal.boundaryType}”` : "边界建议待生成")}</h2><p>${safe(suggestion?.summary || "确认核算声明后，将基于产品生成边界建议。")}</p><dl><div><dt>纳入</dt><dd>${safe((proposal?.includedProcesses || []).slice(0, 4).join("、") || "—")}</dd></div><div><dt>排除</dt><dd>${safe((proposal?.excludedItems || []).slice(0, 3).join("、") || "—")}</dd></div><div><dt>截断</dt><dd>${safe(proposal?.cutOffRule || "—")}</dd></div></dl><small>prompt: ${safe(suggestion?.promptId || "pcf.suggest_boundary")} · 不会自动写入正式核算。</small>${canEdit && proposal ? `<div class="pcf-card__actions" style="margin-top:var(--space-sm)">${actionButton("将建议填入表单", "secondary", 'data-action="pcf-apply-boundary-proposal"')}</div>` : ""}</div></aside>
      </div>
      ${stageGatePanelHtml("pcf", { variant: "footer" })}
      ${pcfStepNav()}`;
  }

  function renderPcfData() {
    const item = workflowEngine.get("PCF-2026-001");
    const pack = workflowEngine.list({ type: "evidence" }).find((record) => record.metadata?.serviceId === "pcf");
    const ctx = pcfPowerContext();
    const template = item?.metadata?.template || {};
    const templateInvalid = template.status === "INVALID";
    const templateReady = ["VALIDATED", "VALIDATED_PARTIAL"].includes(template.status);
    const showAssetFact = Boolean(ctx.power) && ["COLLECTING", "NEEDS_CONFIRMATION", "CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY"].includes(item?.status);
    const evidenceReady = Boolean(pack) || showAssetFact || templateReady;
    const factConfirmed = ctx.bindingConfirmed || ["CALCULATING", "EXPERT_REVIEW", "DELIVERABLE_READY"].includes(item?.status);
    const canConfirmBinding = !factConfirmed && ctx.powerBinding && ["PROPOSED", "PENDING_CONFIRMATION"].includes(ctx.powerBinding.status)
      && ["COLLECTING", "NEEDS_CONFIRMATION"].includes(item?.status)
      && templateReady
      && !templateInvalid;
    const productLabel = ctx.product ? `${ctx.product.name}` : "热轧非合金钢卷";
    const evidenceId = ctx.evidence?.id || "EVD-HX-POWER-2026Q3";
    const evidenceName = pack?.metadata?.filename || template.filename || ctx.evidence?.payload?.fileName || "企业电力证据";
    const energyValue = ctx.value && ctx.value !== "—"
      ? `购入电力 ${ctx.value} ${ctx.unit || "MWh"}`
      : "";
    const ledger = window.LuminoPcfInventory
      ? window.LuminoPcfInventory.buildDomainLedger({
        declaration: item?.metadata?.declaration,
        boundary: item?.metadata?.boundary,
        template,
        bindings: [ctx.powerBinding, ctx.evidenceBinding].filter(Boolean),
        valueHints: {
          energy: energyValue || undefined,
          output: item?.metadata?.declaration?.referenceFlow || undefined,
        },
      })
      : { rows: [], summary: { ready: 0, total: 0 } };
    const domainHtml = (ledger.rows || []).map((row) => `<article class="pcf-domain-row">
      <span class="pcf-domain-number">${safe(row.number)}</span><div class="pcf-domain-name"><strong>${safe(row.name)}</strong><small>${safe(row.description)}</small></div>
      <div class="pcf-domain-value"><span>关键数值</span><strong title="${safe(row.value || "—")}">${safe(row.value || "—")}</strong><small>${safe(row.count)} 项</small></div>
      <div class="pcf-domain-owner"><span>责任</span><strong>${safe(row.owner)}</strong></div>
      <span class="pcf-domain-status pcf-domain-status--${safe(row.tone)}">${safe(row.status)}</span><button class="text-button" type="button" ${row.action === "pcf-boundary" ? 'data-page="pcf-boundary"' : row.action === "pcf-upload" ? 'data-drawer="pcf-upload"' : `data-drawer="record-detail" data-drawer-label="${safe(ctx.power?.name || "能源与过程数据")}" data-drawer-object="${safe(ctx.power?.versionId || "REC-HX-POWER-2026Q3")}" data-drawer-status="${factConfirmed ? "PCF 已确认使用" : "1 项待确认"}" data-drawer-description="核对购入电力的期间、数值、单位、产品用途与证据引用。资产版本 ${safe(ctx.power?.versionId || "")}；证据 ${safe(evidenceId)}。当前数值：${safe(row.value || "—")}。"`}>${safe(row.label)} →</button>
    </article>`).join("");
    const declarationReady = Boolean(item?.metadata?.declaration?.confirmed) || (item && !["NOT_STARTED", "SCOPING"].includes(item.status));
    const boundaryReady = Boolean(item?.metadata?.boundary?.confirmed) || item?.metadata?.boundary?.status === "CONFIRMED";
    const validationBanner = !declarationReady ? `<section class="pcf-recovery" role="status"><div><span class="pcf-kicker">DECLARATION REQUIRED</span><h2>请先确认核算声明</h2><p>功能单位、期间和用途确认后，才能采集活动数据。</p></div>${actionButton("前往核算声明", "primary", 'data-page="pcf-scope"')}</section>`
      : !boundaryReady ? `<section class="pcf-recovery" role="status"><div><span class="pcf-kicker">BOUNDARY REQUIRED</span><h2>请先确认系统边界</h2><p>纳入／排除与截断规则确认后，模板字段才有稳定范围。</p></div>${actionButton("前往系统边界", "primary", 'data-page="pcf-boundary"')}</section>`
      : templateInvalid ? systemStatePanel({
        code: "error",
        title: "模板校验未通过",
        reason: (template.issues || []).map((entry) => entry.message).join("；") || "请修正后重新回传。",
        errorCode: (template.issues || [])[0]?.code || "ERR-PCF-TEMPLATE",
        canDo: (template.issues || []).slice(0, 3).map((entry) => entry.recovery || entry.message).filter(Boolean),
        primary: { label: "重新回传模板", attrs: 'data-drawer="pcf-upload"' },
        secondary: { label: "返回系统边界", attrs: 'data-page="pcf-boundary"' },
      })
      : ["UPLOADED", "VALIDATING", "PARSING"].includes(template.status) ? systemStatePanel({
        code: "loading",
        title: "正在校验数据包",
        reason: "系统正在检查表结构、单位、期间和证据引用。预计约 1 分钟；完成后会在任务中提醒你确认绑定。",
        canDo: ["可以先去处理其他任务", "校验完成后回到本页确认服务绑定"],
        primary: { label: "去处理其他任务", attrs: 'data-page="workbench"' },
        secondary: { label: "查看服务目录", attrs: 'data-page="services-hub"' },
      })
      : template.status === "VALIDATED_PARTIAL" ? `<section class="pcf-recovery" role="status"><div><span class="pcf-kicker">PARTIAL VALIDATION</span><h2>模板部分通过，仍有数据域缺口</h2><p>可先核对已映射资产，但建议补齐缺口后再确认全部绑定。</p></div>${actionButton("回传修订版", "secondary", 'data-drawer="pcf-upload"')}</section>`
      : "";
    const latestImport = evidenceReady && !templateInvalid ? `<section class="pcf-import-review" id="pcfEvidenceReview" aria-labelledby="pcfImportTitle">
      <header><div><span class="pcf-kicker">ASSET BINDING · ${safe(template.packVersion || pack?.metadata?.templateVersion || "ENTERPRISE POOL")}</span><h2 id="pcfImportTitle">${safe(evidenceName)}</h2><p>活动数据引用企业资产池中的确定版本；PCF 绑定确认不会改变 CBAM 或其他服务状态。</p></div>${statusChip(factConfirmed ? "绑定已确认" : (templateReady ? "1 项待确认" : "待校验"), factConfirmed ? "ok" : "warn")}</header>
      <div class="pcf-import-checks"><div><span>企业资产</span><strong>${safe(ctx.power?.id || "—")}</strong><small>Rev ${safe(String(ctx.power?.revision || 1))} · ${safe(ctx.power?.status || "")}</small></div><div><span>服务绑定</span><strong>${safe(ctx.powerBinding?.id || "—")}</strong><small>${safe(ctx.powerBinding?.status || "未绑定")}</small></div><div><span>模板状态</span><strong>${safe(template.status || "未上传")}</strong><small>${safe(template.filename || "等待回传")}</small></div><div><span>CBAM 复用</span><strong>独立确认</strong><small>不共享本服务结论</small></div></div>
      <div class="pcf-proposed-fact"><div><span class="pcf-kicker">${factConfirmed ? "SERVICE BINDING CONFIRMED" : "PENDING SERVICE BINDING"}</span><h3>${safe(ctx.power?.name || "上海一厂购入电力")}</h3><p>来源资产 ${safe(ctx.power?.versionId || "—")} · ${safe(ctx.period)}</p></div><dl><div><dt>活动数据</dt><dd>${safe(ctx.value)} ${safe(ctx.unit)}</dd></div><div><dt>用途</dt><dd>${safe(productLabel)}</dd></div><div><dt>证据</dt><dd>${safe(evidenceId)}</dd></div></dl>${canConfirmBinding ? actionButton("确认这项 PCF 绑定", "primary", 'data-action="pcf-confirm-proposal"') : statusChip(factConfirmed ? "已确认" : (templateReady ? "等待确认" : "等待模板校验"), factConfirmed ? "ok" : "warn")}</div>
      <div class="asset-capsule-row" aria-label="关联企业数据资产">${assetCapsule("REC-HX-POWER-2026Q3", { serviceId: "pcf" })}${assetCapsule("EVD-HX-POWER-2026Q3", { serviceId: "pcf" })}${assetCapsule("PRD-HRC-01", { serviceId: "pcf" })}</div>
      <footer><p>同一材料可以供 CBAM 引用，但每个服务的确认状态与计算血缘相互独立。点胶囊可打开资产详情侧栏。</p><button class="button button--secondary" type="button" data-drawer="pcf-upload">回传修订版或补充材料</button></footer>
    </section>` : `<section class="pcf-awaiting-pack"><span class="pcf-kicker">WAITING FOR DATA PACK</span><h2>${templateInvalid ? "请先修复模板问题" : "尚未进入数据采集"}</h2><p>先确认系统边界，再回传 Excel 模板；校验通过后才会生成待确认绑定。</p><button class="button button--primary" type="button" data-drawer="pcf-upload">上传已填写模板</button></section>`;
    const summaryLabel = factConfirmed ? "活动数据已确认" : templateReady ? "活动数据待确认" : "等待模板校验";
    $("#main").innerHTML = `${pcfChannelHeader("活动数据", "用项目模板分工填报；每项数据连到来源、确认记录和后续计算。")}
      ${validationBanner}
      <section class="pcf-template-band" aria-labelledby="pcfTemplateTitle"><div><span class="pcf-kicker">PCF DATA PACK · HRC-01 · V1.0</span><h2 id="pcfTemplateTitle">先下载项目模板，再整体回传</h2><p>模板继承已确认的核算声明与系统边界；回传后先做结构／单位校验，再映射到企业资产池中的 ${safe(ctx.power?.id || "能源记录")}。</p><div class="pcf-template-actions"><a class="button button--secondary" href="../outputs/pcf-template/Lumino_PCF_%E6%95%B0%E6%8D%AE%E9%87%87%E9%9B%86%E6%A8%A1%E6%9D%BF_HRC-01.xlsx" download>下载 Excel 采集模板</a><button class="button button--primary" type="button" data-drawer="pcf-upload">上传已填写模板</button></div></div><aside><div><strong>10</strong><span>个工作表<br>含说明与证据索引</span></div><ul><li>原材料、能源、运输、产量与废弃物</li><li>供应商 PCF、分配依据和数据质量</li><li>结构、单位与证据引用校验</li></ul></aside></section>
      <ol class="pcf-collection-flow" aria-label="模板采集流程"><li class="done"><span>1</span><div><strong>下载项目模板</strong><small>边界信息已预填</small></div></li><li class="${evidenceReady ? "done" : "current"}"><span>2</span><div><strong>分工填写</strong><small>采购、生产、EHS、物流与财务</small></div></li><li class="${templateReady ? "done" : evidenceReady ? "current" : ""}"><span>3</span><div><strong>整体回传 / 校验</strong><small>结构、单位、证据索引</small></div></li><li class="${factConfirmed ? "done" : templateReady ? "current" : ""}"><span>4</span><div><strong>确认服务绑定</strong><small>Agent 提议需人工确认</small></div></li></ol>
      <section class="pcf-domain-ledger" aria-labelledby="pcfDomainsTitle"><header><div><span class="pcf-kicker">LIFE CYCLE INVENTORY</span><h2 id="pcfDomainsTitle">数据域清单</h2><p>清单状态由模板校验结果与服务绑定投影，不再使用页面硬编码计数。</p></div><div class="pcf-domain-summary"><strong>${safe(ledger.summary.ready)} / ${safe(ledger.summary.total)}</strong><span>${safe(summaryLabel)}</span></div></header><div>${domainHtml}</div></section>
      ${latestImport}
      ${stageGatePanelHtml("pcf", { variant: "footer" })}
      ${pcfStepNav()}`;
  }

  function renderPcfResults() {
    const item = workflowEngine.get("PCF-2026-001");
    const ctx = pcfPowerContext();
    const calculation = item?.metadata?.calculation || null;
    const snapshotId = calculation?.snapshotId || ctx.snapshot?.id || "SNAP-PCF-HRC-01";
    const runId = calculation?.runId || ctx.run?.id || "ARUN-PCF-001";
    const factors = pcfRecommendedFactors(item);
    const factorsConfirmed = Boolean(factors?.confirmed) || ((factors?.items || []).length > 0 && (factors?.items || []).every((row) => row.applicabilityConfirmed));
    const canRun = item?.status === "CALCULATING" && factorsConfirmed;
    const blocked = ["SCOPING", "COLLECTING", "NEEDS_CONFIRMATION"].includes(item?.status) || !ctx.bindingConfirmed;
    const needsFactors = ctx.bindingConfirmed && !factorsConfirmed && !["EXPERT_REVIEW", "DELIVERABLE_READY"].includes(item?.status);
    const hasResult = Boolean(calculation) || ["EXPERT_REVIEW", "DELIVERABLE_READY"].includes(item?.status);
    const rec = factors?.recommendation || null;
    const factorRows = (factors?.items || []).map((row) => {
      const alts = (rec?.alternativesByNeed && row.needId && rec.alternativesByNeed[row.needId]) || [];
      const altButtons = (!factorsConfirmed && alts.length)
        ? `<div class="pcf-factor-alts"><span>改选备选</span>${alts.map((alt) => `<button class="text-button" type="button" data-action="pcf-select-factor-alt" data-need-id="${safe(row.needId)}" data-dataset-id="${safe(alt.datasetId)}">${safe(alt.name)} · ${safe(alt.matchScore)}</button>`).join("")}</div>`
        : "";
      const reasons = (row.matchReasons || []).slice(0, 3).map((reason) => safe(reason)).join("；");
      const roleLabel = row.role === "manual_override" ? "用户改选" : row.role === "recommended" ? "系统推荐" : "候选";
      return `<tr>
      <td><strong>${safe(row.name)}</strong><small>${safe(roleLabel)}${row.matchScore != null ? ` · 分 ${safe(row.matchScore)}` : ""}</small>${reasons ? `<small class="pcf-match-reasons">${reasons}</small>` : ""}</td>
      <td>${safe(row.datasetId)} · ${safe(row.version)}</td>
      <td>${safe(row.geographyLabel || row.geography)} / ${safe(row.year)}</td>
      <td>${safe(row.value)} ${safe(row.numeratorUnit)}/${safe(row.denominatorUnit)}</td>
      <td>${row.applicabilityConfirmed || factorsConfirmed ? "已确认" : "待确认"}${altButtons}</td>
    </tr>`;
    }).join("");
    const gapNote = (rec?.gaps || []).length
      ? `<p class="pcf-factor-gaps" role="status">目录缺口 ${rec.gaps.length} 项：${safe(rec.gaps.map((gap) => gap.label).join("、"))}。系统已登记，不要求你自行检索专业库。</p>`
      : "";
    const factorPanel = `<section class="pcf-card" aria-labelledby="pcfFactorTitle"><header class="pcf-card__header"><div><span class="pcf-kicker">EMISSION FACTORS</span><h2 id="pcfFactorTitle">${safe(factors?.setName || "系统推荐排放因子")}</h2></div><small>${safe(factors?.setId || "CN-EF-MATCH")} · ${factorsConfirmed ? "适用性已确认" : "待确认适用性"}</small></header>
      <div class="pcf-factor-rec-banner" role="status"><strong>${safe(rec?.summary || "系统已自动匹配因子")}</strong><span>按活动、地域、年份与单位评分推荐。你只需确认，或改选备选；不必自行检索专业库。</span></div>
      <div class="pcf-stage-table"><table><thead><tr><th>推荐因子与匹配理由</th><th>数据集 / 版本</th><th>地域 / 年份</th><th>数值与单位</th><th>确认／改选</th></tr></thead><tbody>${factorRows || "<tr><td colspan='5'>系统尚未生成推荐；请刷新推荐。</td></tr>"}</tbody></table></div>
      ${gapNote}
      <footer class="pcf-card__actions"><p>确认适用性不会改写活动数据；未确认前不能运行正式计算。改选后需重新确认。</p><p class="pcf-factor-disclaimer"><small>sourceKind=${safe(factors?.sourceKind || "matcher_recommendation")} · 只读目录种子 · 推荐由匹配逻辑完成</small></p>${factorsConfirmed ? statusChip("因子已确认", "ok") : `<div class="pcf-card__action-row">${actionButton("刷新系统推荐", "secondary", 'data-action="pcf-refresh-factor-recommendations"')}${actionButton("确认推荐因子适用性", "primary", 'data-action="pcf-confirm-factors"')}</div>`}</footer>
    </section>`;
    const stages = calculation?.stages || [];
    const hotspots = calculation?.hotspots || [];
    const stageRows = stages.map((row) => `<tr><td>${safe(row.name)}${row.included === false ? "<small>本次边界外</small>" : ""}</td><td>${row.included === false ? "—" : `${safe(row.value)} ${safe(row.unit)}`}</td><td>${row.included === false ? "—" : `${Math.round((row.share || 0) * 1000) / 10}%`}</td><td>${safe(row.basis)}</td></tr>`).join("");
    const lineRows = (calculation?.lineItems || []).map((row) => `<tr>
      <td><strong>${safe(row.name)}</strong><small>${safe(row.stageId)} · ${safe(row.id)}${row.included === false ? " · 边界外" : ""}</small></td>
      <td>${safe(row.activity?.value)} ${safe(row.activity?.unit)}</td>
      <td>${safe(row.factor?.id)}<small>${safe(row.factor?.value)} ${safe(row.factor?.numeratorUnit)}/${safe(row.factor?.denominatorUnit)}</small></td>
      <td>${safe(row.emissionTCO2e)} tCO2e</td>
      <td>${safe(row.activity?.sourceLabel || row.activity?.sourceKind || "—")}<small>${safe(row.activity?.sourceId || row.evidenceId || "未关联证据")}</small></td>
    </tr>`).join("");
    const hotspotList = hotspots.map((row) => `<li style="--share:${Math.round((row.share || 0) * 100)}%"><span>${safe(row.name)}</span><b>${safe(row.shareLabel || `${Math.round((row.share || 0) * 100)}%`)}</b></li>`).join("");
    const dq = calculation?.dataQuality || {};
    const resultDetail = `<section class="pcf-result-detail"><div class="pcf-stage-table"><header><span class="pcf-kicker">RESULT BREAKDOWN</span><h2>生命周期阶段结果</h2></header><table><thead><tr><th>阶段</th><th>排放量</th><th>占比</th><th>数据基础</th></tr></thead><tbody>${stageRows || "<tr><td colspan='4'>尚未生成计算结果</td></tr>"}</tbody></table></div><aside class="pcf-quality-register"><span class="pcf-kicker">METHOD & DATA QUALITY</span><h2>方法与数据质量</h2><dl><div><dt>一次活动数据覆盖</dt><dd>${dq.primaryActivityCoverage != null ? `${Math.round(dq.primaryActivityCoverage * 100)}%` : "—"}</dd></div><div><dt>证据完整度</dt><dd>${dq.completeness != null ? `${Math.round(dq.completeness * 100)}%` : "—"}</dd></div><div><dt>Tier 1 / 2 / 3</dt><dd>${dq.tier1Percentage != null ? `${safe(dq.tier1Percentage)}% / ${safe(dq.tier2Percentage)}% / ${safe(dq.tier3Percentage)}%` : "—"}</dd></div><div><dt>分配方法</dt><dd>${safe(dq.allocationMethod || "—")}</dd></div><div><dt>因子集</dt><dd>${safe(calculation?.factorSetId || factors?.setId || "CN-EF-2026.1")}</dd></div><div><dt>输入快照</dt><dd>${safe(snapshotId)}</dd></div></dl><p>${(calculation?.limitations || ["数据质量、排除项和不确定性将在报告中单独说明。"]).map((item) => safe(item)).join("；")}</p></aside></section>
      <section class="pcf-card" aria-labelledby="pcfLedgerTitle"><header class="pcf-card__header"><div><span class="pcf-kicker">CALCULATION LEDGER</span><h2 id="pcfLedgerTitle">逐项计算台账</h2></div><small>${safe(calculation?.lineItems?.length || 0)} 项 · ${safe(calculation?.ruleVersion || "尚未计算")}</small></header><div class="pcf-stage-table"><table><thead><tr><th>清单项</th><th>活动数据</th><th>排放因子</th><th>排放量</th><th>数据来源</th></tr></thead><tbody>${lineRows || "<tr><td colspan='5'>运行计算后显示逐项台账</td></tr>"}</tbody></table></div><footer class="pcf-card__actions"><p>每一行都保留活动数据、单位换算、因子标识、分配比例和证据来源，可在复核时逐项追溯。</p></footer></section>`;
    $("#main").innerHTML = `${pcfChannelHeader("计算与排放热点", "确认系统推荐的因子适用后，再生成可重现的计算草稿与热点。")}
      ${factorPanel}
      ${state.pcfCalculationFailed ? systemStatePanel({
        code: "error",
        title: "计算未完成",
        reason: "排放因子版本读取失败。已确认的数据和输入快照均已保留，可安全重试。",
        errorCode: "ERR-PCF-FACTOR-01",
        canDo: ["重试不会覆盖已确认的活动数据", "可先返回活动数据核对绑定", "若持续失败，联系支持并附上错误编号"],
        primary: { label: "重新加载因子并计算", attrs: 'data-action="pcf-retry-calculation"' },
        secondary: { label: "返回活动数据", attrs: 'data-page="pcf-data"' },
      }) : blocked ? pcfRecovery("活动数据尚未确认", "完成模板校验并确认待处理服务绑定后，才能建立输入快照和运行计算。", "返回活动数据", 'data-page="pcf-data"') : needsFactors ? pcfRecovery("排放因子适用性未确认", "系统已按匹配逻辑给出推荐；请确认适用性，或改选备选后再确认。无需自行检索因子库。", "确认推荐因子适用性", 'data-action="pcf-confirm-factors"') : canRun ? `<section class="pcf-calculation-ready"><div><span class="pcf-kicker">STEP 04 · READY TO CALCULATE</span><h2>输入已锁定，可以生成计算草稿</h2><p>本次运行使用逐项清单和固定因子执行确定性计算。原型中除购入电力外的清单行为明示演示输入，不可正式披露。</p>${actionButton("运行确定性计算", "primary", 'data-action="pcf-run-calculation"')}</div><dl><div><dt>确认绑定</dt><dd>${safe(ctx.powerBinding?.id || "—")}</dd></div><div><dt>资产版本</dt><dd>${safe(ctx.powerBinding?.assetVersionId || "—")}</dd></div><div><dt>因子集</dt><dd>${safe(factors?.setId || "CN-EF-2026.1")}</dd></div><div><dt>功能单位</dt><dd>${safe(item?.metadata?.declaration?.functionalUnit || "1 吨产品")}</dd></div></dl></section>` : hasResult && ctx.snapshot?.status === "STALE" ? `${staleSnapshotPanel({ snapshotId, runId, resumePage: "pcf-data" })}<section class="result-summary" aria-disabled="true"><div class="pcf-result-total"><span class="pcf-kicker">${safe(runId)} · STALE</span><strong>${safe(calculation?.total ?? "—")}</strong><span>${safe(calculation?.unit || "tCO₂e / t 产品")}</span><p>历史结果保留供对照，不可直接进入独立复核。</p></div></section>` : hasResult ? `<section class="result-summary"><div class="pcf-result-total"><span class="pcf-kicker">${safe(runId)} · ${calculation?.formalUseAllowed ? "受控计算草稿" : "演示计算草稿"}</span><strong>${safe(calculation?.total ?? "—")}</strong><span>${safe(calculation?.unit || "tCO₂e / t 产品")}</span><p>${calculation?.formalUseAllowed ? "已固定正式输入" : "含演示清单·不可正式披露"}<br>输入快照 ${safe(snapshotId)}</p></div><div class="hotspot-list"><header><div><span class="pcf-kicker">EMISSION HOTSPOTS</span><h2>排放热点</h2></div>${statusChip("可重现", "ok")}</header><ol>${hotspotList || "<li><span>暂无热点</span><b>—</b></li>"}</ol><footer><p>结果尚未成为正式报告，需替换演示输入并完成独立复核。</p><button class="text-button" data-page="pcf-report">进入独立复核 →</button></footer></div></section>${resultDetail}` : pcfRecovery("尚未生成计算草稿", "确认因子后运行确定性计算，结果会写入可追溯的 Run 与热点结构。", "确认因子适用性", 'data-action="pcf-confirm-factors"')}
      ${stageGatePanelHtml("pcf", { variant: "footer" })}
      ${pcfStepNav()}`;
  }

  function renderPcfReport() {
    const item = workflowEngine.get("PCF-2026-001");
    const ctx = pcfPowerContext();
    const calculation = item?.metadata?.calculation || {};
    const reportLock = item?.metadata?.reportLock || workflowEngine.get("PCF-RPT-2026-001-R1")?.metadata?.reportLock || null;
    const snapshotId = reportLock?.snapshotId || calculation.snapshotId || ctx.snapshot?.id || "SNAP-PCF-HRC-01";
    const runId = reportLock?.runId || calculation.runId || ctx.run?.id || "ARUN-PCF-001";
    const productName = item?.metadata?.declaration?.productName || ctx.product?.name || "热轧非合金钢卷";
    const boundaryType = item?.metadata?.boundary?.boundaryType || calculation.boundaryType || "从摇篮到大门";
    const ready = item?.status === "DELIVERABLE_READY";
    const inReview = item?.status === "EXPERT_REVIEW";
    const formalReady = Boolean(reportLock?.formalUseAllowed ?? calculation?.formalUseAllowed);
    const reportArtifact = workflowEngine.get("PCF-RPT-2026-001-R1");
    const lockRows = (reportLock?.items || []).map((row) => `<tr><td>${safe(row.kind)}</td><td>${safe(row.id)}</td><td>${safe(row.versionLabel)}</td><td>${safe(row.status)}</td><td>${safe(row.note)}</td></tr>`).join("");
    const lockPanel = reportLock ? `<section class="pcf-card" aria-labelledby="pcfLockTitle"><header class="pcf-card__header"><div><span class="pcf-kicker">LOCKED INPUTS</span><h2 id="pcfLockTitle">本版锁定的输入</h2></div><small>${safe(reportLock.reportRevision)} · ${safe(reportLock.items.length)} 项</small></header>
      <div class="pcf-stage-table"><table><thead><tr><th>类型</th><th>对象</th><th>版本 / 标识</th><th>状态</th><th>说明</th></tr></thead><tbody>${lockRows}</tbody></table></div>
      <footer class="pcf-card__actions"><p>${safe(reportLock.statement)}</p><small>锁定人 ${safe(reportLock.lockedBy || "—")} · ${safe(reportLock.lockedAt || "")}</small></footer>
    </section>` : "";
    const reportHeader = `<section class="pcf-report-overview"><div><span class="pcf-kicker">PCF REPORT · ${ready ? "REV 1" : "WORKING DRAFT"}</span><h2>${safe(productName)}产品碳足迹报告</h2><p>方法边界、活动数据、排放因子、计算血缘与热点分析将形成同一受控版本。</p></div><dl><div><dt>计算运行</dt><dd>${inReview || ready ? safe(runId) : "尚未生成"}</dd></div><div><dt>版本</dt><dd>${ready ? "Rev 1" : "Draft"}</dd></div><div><dt>报告对象</dt><dd>${safe(reportArtifact ? workflowStateLabel(reportArtifact.status) : "尚未生成")}</dd></div></dl></section>`;
    const reportOutline = `<section class="pcf-report-outline" aria-labelledby="pcfReportOutline"><header><div><span class="pcf-kicker">REPORT CONTENTS</span><h2 id="pcfReportOutline">报告内容与完成状态</h2></div><small>${ready ? "9 / 9 已完成" : inReview ? "8 / 9 已完成" : "3 / 9 已准备"}</small></header><ol><li class="done"><span>01</span><div><strong>核算声明：目标、用途与受众</strong><small>${safe(item?.metadata?.declaration?.goal || "披露用途、产品和核算期间")}</small></div></li><li class="done"><span>02</span><div><strong>功能单位与产品系统</strong><small>${safe(item?.metadata?.declaration?.functionalUnit || "产品描述、参考流和生产技术")}</small></div></li><li class="done"><span>03</span><div><strong>系统边界与排除项</strong><small>${safe(boundaryType)}</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>04</span><div><strong>生命周期清单与证据</strong><small>活动数据、供应商数据和证据索引</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>05</span><div><strong>分配、数据质量与方法选择</strong><small>${safe(calculation?.dataQuality?.allocationMethod || "分配依据与一次数据比例")}</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>06</span><div><strong>排放因子与计算血缘</strong><small>${safe(calculation?.factorSetId || "因子来源、版本与输入快照")}</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>07</span><div><strong>结果、生命周期阶段与热点</strong><small>${calculation?.total != null ? `${safe(calculation.total)} ${safe(calculation.unit)}` : "总量、阶段贡献和主要排放源"}</small></div></li><li class="${inReview || ready ? "done" : ""}"><span>08</span><div><strong>限制、不确定性与解释</strong><small>${safe((calculation?.limitations || [])[0] || "假设、缺口、敏感项和使用限制")}</small></div></li><li class="${ready ? "done" : "current"}"><span>09</span><div><strong>专家复核与版本声明</strong><small>${ready ? `已锁定 ${safe(reportLock?.items?.length || 0)} 项输入` : "复核意见、修订记录和受控交付"}</small></div></li></ol></section>`;
    $("#main").innerHTML = `${pcfChannelHeader("复核与报告", "把边界、清单、计算与限制收成同一受控版本，再完成独立复核。")}
      ${reportHeader}${reportOutline}${lockPanel}
      ${inReview ? `<section class="pcf-review-grid"><div class="pcf-card review-checklist"><header class="pcf-card__header"><div><span class="pcf-kicker">STEP 05 · INDEPENDENT REVIEW</span><h2>独立复核清单</h2></div><small>3 / 4 已完成</small></header><ul><li class="done"><span>✓</span><div><strong>核算目标与功能单位一致</strong><small>${safe(item?.metadata?.declaration?.functionalUnit || "与项目范围定义一致")}</small></div></li><li class="done"><span>✓</span><div><strong>活动数据已关联证明材料</strong><small>${safe(ctx.power?.versionId || "资产版本")} · ${safe(ctx.evidence?.id || "EVD-HX-POWER-2026Q3")}</small></div></li><li class="done"><span>✓</span><div><strong>确定性计算可重现</strong><small>${safe(runId)} · ${safe(snapshotId)}</small></div></li><li><span>4</span><div><strong>方法说明、限制与不确定性待签署</strong><small>完成后锁定受控版本 Rev 1 及全部输入版本</small></div></li></ul><footer class="pcf-card__actions"><p>已提交 Lumino 独立复核；客户可查看草稿，但不能代替复核员锁定版本。</p>${actionButton("查看当前草稿", "secondary", 'data-drawer="pcf-report-preview"')}</footer></div><aside class="pcf-version-note"><span class="pcf-kicker">VERSION CONTROL</span><h2>本版将锁定什么</h2><dl><div><dt>系统边界</dt><dd>${safe(boundaryType)}</dd></div><div><dt>活动数据</dt><dd>${safe(ctx.powerBinding?.assetVersionId || "已确认资产版本")}</dd></div><div><dt>输入快照</dt><dd>${safe(snapshotId)}</dd></div><div><dt>因子集</dt><dd>${safe(calculation?.factorSetId || item?.metadata?.factors?.setId || "CN-EF-2026.1")}</dd></div></dl><p>后续更正将生成新修订版，不覆盖本次复核记录。</p></aside></section>` : !ready ? pcfRecovery("报告尚未就绪", "需要先完成数据域确认与确定性计算；已经确认的范围内容会保留在报告草稿中。", "查看计算状态", 'data-page="pcf-results"') : `<section class="pcf-report-ready"><div><span class="pcf-ready-mark" aria-hidden="true">✓</span><span class="pcf-kicker">${formalReady ? "CONTROLLED OUTPUT" : "PROTOTYPE OUTPUT"} · REV 1</span><h2>${formalReady ? "报告已通过复核，可以预览和交付" : "演示报告已完成复核流程，可预览但不可对外交付"}</h2><p>${safe(reportArtifact?.id || "PCF-RPT-2026-001-R1")} · ${safe(runId)} · 输入快照 ${safe(snapshotId)}${ctx.snapshot?.locked || reportLock ? " · 已锁定" : ""}</p><div>${actionButton("预览 PCF 报告", "primary", 'data-drawer="pcf-report-preview"')}${formalReady ? '<button class="button button--secondary" type="button" data-page="shared-deliverables">在交付中心查看</button>' : ""}</div></div><dl><div><dt>核算结果</dt><dd>${safe(calculation?.total ?? reportLock?.total ?? "—")} ${safe(calculation?.unit || reportLock?.unit || "tCO₂e / t 产品")}</dd></div><div><dt>系统边界</dt><dd>${safe(boundaryType)}</dd></div><div><dt>锁定输入</dt><dd>${safe(reportLock?.items?.length || 0)} 项</dd></div><div><dt>版本用途</dt><dd>${formalReady ? "受控交付" : "原型演示"}</dd></div></dl></section>`}
      ${stageGatePanelHtml("pcf", { variant: "footer" })}
      ${pcfStepNav()}`;
  }

  function renderMultiServicePage() {
    if (state.page === "workbench") { renderWorkbench(); return true; }
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
