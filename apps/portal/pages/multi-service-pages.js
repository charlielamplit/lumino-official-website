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
      if (state.role === "customer_contrib") return { title: "2 项材料待补充", detail: "按你的分工筛选" };
      if (state.role === "customer_approver") return { title: "2 项决定待审批", detail: "按你的授权筛选" };
      return { title: "Q3 数据采集 · 68%", detail: "2026 年度进行中" };
    }
    if (service.id === "pcf") {
      return { title: workflowStateLabel(workflowEngine.get("PCF-2026-001")?.status || "SCOPING"), detail: "热轧非合金钢卷 · 试点" };
    }
    return null;
  }

  function renderServicesHub() {
    const firstVisit = typeof hasSeenCustomerHub === "function" ? !hasSeenCustomerHub() : true;
    if (typeof markCustomerHubSeen === "function") markCustomerHubSeen();

    const services = Object.values(serviceRegistry);
    const open = services.filter((service) => service.roles.includes(state.role) && service.entryPage);
    const catalog = services.filter((service) => !(service.roles.includes(state.role) && service.entryPage));

    const openRows = open.map((service, index) => {
      const progress = serviceProgressLine(service);
      return `<article class="service-row service-row--${service.status}">
        <span class="service-row__index">${String(index + 1).padStart(2, "0")}</span>
        <div class="service-row__identity">
          <div class="service-row__title">
            <span class="service-row__code">${safe(service.code)}</span>
            <h2>${safe(service.name)}</h2>
            ${statusChip(service.statusLabel, service.status === "active" ? "ok" : service.status === "pilot" ? "warn" : "")}
          </div>
          ${progress ? `<p class="service-row__progress"><strong>${safe(progress.title)}</strong><span>· ${safe(progress.detail)}</span></p>` : `<p class="service-row__progress">${safe(service.description)}</p>`}
        </div>
        <div class="service-row__action">${servicePrimaryAction(service, { compact: true })}</div>
      </article>`;
    }).join("");

    const catalogRows = catalog.map((service) => `<li class="service-catalog__item">
      <span class="service-catalog__code">${safe(service.code)}</span>
      <div><strong>${safe(service.name)}</strong><small>${safe(service.description)}</small></div>
      ${statusChip(service.statusLabel || "可咨询", "")}
      ${servicePrimaryAction(service, { compact: true })}
    </li>`).join("");

    const lead = firstVisit
      ? "首次进入：先看本企业开通了哪些服务频道。日常续办请用「工作台」；要处理的事项清单在「我的任务」。"
      : "这里是服务目录：开通、切换或预约咨询。日常续办请回「工作台」，不要把这里当待办列表。";

    $("#main").innerHTML = `
      <div class="service-hub-shell">
        <header class="page-head page-head--compact">
          <div><p>SERVICE CATALOG</p><h1>服务目录</h1></div>
          ${statusChip(`${open.length} 项已开通 · ${catalog.length} 项可咨询`)}
        </header>
        <p class="page-lead page-lead--aligned">${lead}</p>
        <section class="service-hub" aria-label="企业服务">
          <div class="service-hub__group">
            <header class="service-hub__label"><span>已开通频道</span><small>进入后在频道内工作</small></header>
            <div class="service-row-list" aria-label="已开通服务">${openRows || `<p class="service-hub__empty">当前角色还没有可进入的服务。</p>`}</div>
          </div>
          <div class="service-hub__group service-hub__group--catalog">
            <header class="service-hub__label"><span>尚未开通</span><small>只接受咨询，不生成空工作区</small></header>
            <ul class="service-catalog" aria-label="可咨询服务">${catalogRows}</ul>
          </div>
        </section>
      </div>`;
  }

  function renderWorkbench() {
    const actor = roleConfig[state.role].name;
    const taskView = sharedCenterViews.tasks({ role: state.role, actor });
    const deliveryView = sharedCenterViews.deliverables({ role: state.role, actor });
    const assetView = assetViews.overview({ role: state.role, serviceId: null, facet: "attention" });
    const openServices = Object.values(serviceRegistry).filter((service) => service.roles.includes(state.role) && service.entryPage);
    const focus = taskView.items[0] || null;
    const nextTasks = taskView.items.slice(1, 3);
    const attentionAssets = (assetView.items || []).slice(0, 2);
    const orgName = state.organization?.name || "当前企业";

    const focusBlock = focus
      ? `<section class="workbench-focus" aria-labelledby="workbenchFocusTitle">
          <div class="workbench-focus__copy">
            <span class="workbench-kicker">现在先做这一件</span>
            <h2 id="workbenchFocusTitle">${safe(focus.title)}</h2>
            <p>${safe(focus.object)} · ${safe(focus.nextStep)}</p>
            <div class="workbench-focus__meta">
              <span class="service-tag ${focus.serviceId === "pcf" ? "pilot" : ""}">${safe(focus.serviceCode)}</span>
              <span class="due-state due-state--${safe(focus.due.tone)}">${safe(focus.due.label)}</span>
              <span class="workbench-focus__owner">${safe(focus.owner)}</span>
            </div>
          </div>
          <div class="workbench-focus__actions">
            <button class="button button--primary" type="button" data-service-enter="${safe(focus.serviceId)}" data-page-target="${safe(focus.page)}">继续处理</button>
            <button class="button button--secondary" type="button" data-page="shared-tasks">打开任务清单</button>
          </div>
        </section>`
      : `<section class="workbench-focus workbench-focus--empty" aria-labelledby="workbenchFocusTitle">
          <div class="workbench-focus__copy">
            <span class="workbench-kicker">当前没有紧急事项</span>
            <h2 id="workbenchFocusTitle">可以从已开通频道继续推进</h2>
            <p>待办会随工作流出现在这里；要开通新频道时再去「服务目录」。</p>
          </div>
          <div class="workbench-focus__actions">
            <button class="button button--primary" type="button" data-page="services-hub">打开服务目录</button>
          </div>
        </section>`;

    const servicePulse = openServices.map((service) => {
      const progress = serviceProgressLine(service);
      const page = serviceEntryPage(service.id);
      return `<article class="workbench-channel workbench-channel--${service.status}">
        <span class="workbench-channel__code">${safe(service.code)}</span>
        <div class="workbench-channel__body">
          <strong>${safe(service.name)}</strong>
          <small>${progress ? `${safe(progress.title)} · ${safe(progress.detail)}` : safe(service.description)}</small>
        </div>
        <button class="text-button" type="button" data-service-enter="${safe(service.id)}" data-page-target="${safe(page)}">进入频道 →</button>
      </article>`;
    }).join("");

    const queuePreview = nextTasks.length
      ? `<ol class="workbench-queue">${nextTasks.map((task, index) => `<li>
          <span class="workbench-queue__n">${String(index + 2).padStart(2, "0")}</span>
          <div><strong>${safe(task.title)}</strong><small>${safe(task.serviceCode)} · ${safe(task.nextStep)}</small></div>
          <span class="due-state due-state--${safe(task.due.tone)}">${safe(task.due.label)}</span>
          <button class="text-button" type="button" data-service-enter="${safe(task.serviceId)}" data-page-target="${safe(task.page)}">打开 →</button>
        </li>`).join("")}</ol>
        <footer class="workbench-section__footer"><button class="text-button" type="button" data-page="shared-tasks">完整清单共 ${safe(taskView.summary.total)} 项 →</button></footer>`
      : `<p class="workbench-quiet">${taskView.summary.total ? "其余事项请到「我的任务」按清单处理。" : "暂无其他待办。"}</p>`;

    const assetPreview = attentionAssets.length
      ? `<ul class="workbench-asset-preview">${attentionAssets.map(({ asset, primaryIssue }) => `<li>
          <div><strong>${safe(asset.name)}</strong><small>${safe(primaryIssue || assetPlainSummary(asset))}</small></div>
          <button class="text-button" type="button" data-drawer="asset-detail" data-asset-id="${safe(asset.id)}">详情 →</button>
        </li>`).join("")}</ul>
        <footer class="workbench-section__footer"><button class="text-button" type="button" data-page="shared-files">打开数据资产 →</button></footer>`
      : `<p class="workbench-quiet">没有需要立刻处理的资产问题。<button class="text-button" type="button" data-page="shared-files">查看资产 →</button></p>`;

    $("#main").innerHTML = `
      <div class="workbench">
        <header class="workbench__head">
          <div>
            <p class="workbench-kicker">WORKBENCH · ${safe(state.year)} ${safe(state.quarter)}</p>
            <h1>工作台</h1>
            <p class="workbench__lead">${safe(orgName)} · ${safe(roleConfig[state.role].title)}。这里回答「接下来做什么」；频道入口看下方，完整待办去「我的任务」，开通／切换去「服务目录」。</p>
          </div>
          ${statusChip(viewChipLabel(taskView), taskView.summary.urgent ? "warn" : "ok")}
        </header>

        ${focusBlock}

        <section class="workbench-channels" aria-labelledby="workbenchChannelsTitle">
          <header class="workbench-section-label">
            <div>
              <h2 id="workbenchChannelsTitle">进行中的频道</h2>
              <p>服务是工作空间，不是待办列表。</p>
            </div>
            <button class="text-button" type="button" data-page="services-hub">服务目录 →</button>
          </header>
          <div class="workbench-channel-list">${servicePulse || `<p class="workbench-quiet">还没有可进入的频道。<button class="text-button" type="button" data-page="services-hub">去开通 →</button></p>`}</div>
        </section>

        <div class="workbench-split">
          <section class="workbench-stack" aria-labelledby="workbenchQueueTitle">
            <header class="workbench-section-label">
              <div>
                <h2 id="workbenchQueueTitle">焦点之后</h2>
                <p>预览而已；逐项处理请用任务清单。</p>
              </div>
            </header>
            ${queuePreview}
          </section>
          <section class="workbench-stack" aria-labelledby="workbenchAssetsTitle">
            <header class="workbench-section-label">
              <div>
                <h2 id="workbenchAssetsTitle">资产留意</h2>
                <p>待确认绑定与质量问题。</p>
              </div>
            </header>
            ${assetPreview}
          </section>
        </div>

        <section class="workbench-delivery" aria-label="交付动态">
          <span class="workbench-kicker">DELIVERABLES</span>
          <dl>
            <div><dt>受控交付</dt><dd>${safe(deliveryView.summary.total)}</dd></div>
            <div><dt>复核中</dt><dd>${safe(deliveryView.summary.inReview)}</dd></div>
            <div><dt>已锁定</dt><dd>${safe(deliveryView.summary.locked)}</dd></div>
            <div><dt>已发送</dt><dd>${safe(deliveryView.summary.delivered)}</dd></div>
          </dl>
          <button class="text-button" type="button" data-page="shared-deliverables">交付中心 →</button>
        </section>

        <aside class="workbench-agent" aria-label="协调提示">
          <span class="workbench-kicker">LUMINO · 协调提示</span>
          <p>先处理焦点；Agent 只提建议，确认由你或授权同事完成。换频道或开通新品时，打开「服务目录」。</p>
        </aside>
      </div>`;
  }

  function viewChipLabel(taskView) {
    if (taskView.summary.urgent) return `${taskView.summary.urgent} 项紧急`;
    if (taskView.summary.total) return `${taskView.summary.total} 项待办`;
    return "暂无紧急事项";
  }

  function renderSharedTasks() {
    const view = sharedCenterViews.tasks({ role: state.role, actor: roleConfig[state.role].name });
    const rows = view.items.map((task) => `<tr>
      <td data-label="服务"><span class="service-tag ${task.serviceId === "pcf" ? "pilot" : ""}">${safe(task.serviceCode)}</span></td>
      <td data-label="任务 / 下一步"><strong>${safe(task.title)}</strong><small>${safe(task.object)} · ${safe(task.nextStep)}</small><span class="source-reference">${safe(task.sourceId)} · Rev ${safe(task.sourceRevision)}</span></td>
      <td data-label="负责人">${safe(task.owner)}</td>
      <td data-label="截止状态"><span class="due-state due-state--${safe(task.due.tone)}">${safe(task.due.label)}</span></td>
      <td data-label="操作"><button class="text-button" type="button" data-service-enter="${safe(task.serviceId)}" data-page-target="${safe(task.page)}">继续处理 →</button></td>
    </tr>`).join("");
    const empty = `<tr class="shared-empty-row"><td colspan="5"><strong>暂时没有需要你处理的事项</strong><p>已完成的、或超出你授权范围的任务不会出现在这里。可回到工作台查看服务进度，或从「服务」进入频道。</p><button class="text-button" type="button" data-page="workbench">返回工作台 →</button></td></tr>`;
    $("#main").innerHTML = `
      <div class="task-ledger-shell">
        ${pageHeader("TASK LEDGER", "我的任务", statusChip(`${view.summary.total} 项待办`, view.summary.urgent ? "warn" : "ok"))}
        <p class="page-lead page-lead--aligned">完整待办清单（动词：确认／上传／审批）。「服务目录」是频道清单，「工作台」只给焦点与摘要。</p>
        <dl class="shared-center-summary" aria-label="任务摘要"><div><dt>当前待办</dt><dd>${view.summary.total}</dd></div><div><dt>今天或已逾期</dt><dd>${view.summary.urgent}</dd></div><div><dt>涉及服务</dt><dd>${view.summary.services}</dd></div><div><dt>授权范围</dt><dd>${safe(roleConfig[state.role].title)}</dd></div></dl>
        <section class="panel shared-table shared-task-ledger" aria-label="已授权任务"><table><thead><tr><th>服务</th><th>任务 / 下一步</th><th>负责人</th><th>截止状态</th><th></th></tr></thead><tbody>${rows || empty}</tbody></table></section>
      </div>`;
  }

  function renderSharedFiles() {
    const facet = state.assetFacet || "attention";
    const assetView = assetViews.overview({ role: state.role, serviceId: state.currentService, facet });
    const { assets, items: assetItems, bindings: visibleBindings, facets, summary } = assetView;
    const qualityText = (asset) => asset.quality?.status === "verified" ? "已验证" : asset.quality?.status === "usable" ? "可使用" : asset.quality?.status === "needs_review" ? "需复核" : "待评估";
    const rows = assetItems.map(({ asset, bindings, hasPendingBinding, primaryIssue }) => {
      const serviceTags = bindings.length
        ? bindings.map((binding) => `<span class="service-tag ${binding.serviceId === "pcf" ? "pilot" : ""}" title="${safe(assetBindingLabels[binding.status] || binding.status)}">${safe(assetServiceName(binding.serviceId))}</span>`).join(" ")
        : '<span class="asset-unused">尚未用于服务</span>';
      return `<tr>
        <td data-label="资产"><span class="asset-kind">${safe(assetTypeLabels[asset.type] || asset.type)}</span><strong>${safe(asset.name)}</strong><small>${safe(assetPlainSummary(asset))} · ${safe(asset.versionId)}</small></td>
        <td data-label="覆盖范围 / 责任人"><strong>${safe(assetCoverageText(asset))}</strong><small>${safe(assetSubjectText(asset))} · ${safe(asset.steward?.ownerName || "责任人待分配")}</small></td>
        <td data-label="服务使用">${serviceTags}</td>
        <td data-label="状态 / 质量"><span class="record-state ${asset.status === "CONFIRMED" && !hasPendingBinding ? "ok" : "warn"}">${safe(assetStatusLabels[asset.status] || asset.status)}</span><small>${safe(qualityText(asset))} · ${safe(primaryIssue || "无开放质量问题")}</small></td>
        <td data-label="操作"><button class="text-button" type="button" data-drawer="asset-detail" data-asset-id="${safe(asset.id)}">查看详情 →</button></td>
      </tr>`;
    }).join("");
    const primaryAttention = assets.some((item) => item.id === "REC-HX-POWER-2026Q3") && visibleBindings.some((item) => item.assetId === "REC-HX-POWER-2026Q3" && item.serviceId === "pcf" && ["PROPOSED", "PENDING_CONFIRMATION"].includes(item.status));
    const facetBar = `<div class="asset-facets" role="tablist" aria-label="数据资产分面">${facets.map(({ id, label, count }) => `<button type="button" class="asset-facet ${facet === id ? "active" : ""}" data-asset-facet="${id}" role="tab" aria-selected="${facet === id}">${label}<span>${count}</span></button>`).join("")}</div>`;
    $("#main").innerHTML = `${pageHeader("ENTERPRISE DATA ASSETS · FRAMEWORK 0.2.0", "企业数据资产", statusChip(`${assets.length} 项当前资产`))}
      <p class="page-lead">先处理当前一件事。详情侧栏说明来源、确认状态、服务使用与版本影响。</p>
      ${primaryAttention ? `<section class="asset-attention" aria-labelledby="assetAttentionTitle"><div><span>当前需要处理</span><h2 id="assetAttentionTitle">确认购入电力是否用于 PCF 产品分配</h2><p>CBAM 已确认使用企业电力事实；PCF 仍需独立确认产品范围和分配方法，原始账单不会被复制。</p></div><div class="asset-attention__actions"><button class="button button--primary" type="button" data-service-enter="pcf" data-page-target="pcf-data">进入 PCF 确认</button><button class="button button--secondary" type="button" data-drawer="asset-detail" data-asset-id="REC-HX-POWER-2026Q3">查看电力资产</button></div></section>` : ""}
      <dl class="asset-register-summary" aria-label="数据资产摘要"><div><dt>当前资产</dt><dd>${summary.total}</dd><span>按角色和对象范围过滤</span></div><div><dt>原始证据</dt><dd>${summary.evidence}</dd><span>原文件保持不可变</span></div><div><dt>跨服务复用</dt><dd>${summary.reusable}</dd><span>每项服务独立确认</span></div><div><dt>待处理</dt><dd>${summary.attention}</dd><span>事实提议与服务绑定</span></div></dl>
      ${facetBar}
      <section class="asset-catalog" aria-labelledby="assetCatalogTitle"><header><div><span>ASSET REGISTER</span><h2 id="assetCatalogTitle">${facet === "attention" ? "需要你处理的资产" : "当前分面的数据资产"}</h2><p>点「查看详情」可核对接来源、绑定、版本与修订影响。</p></div><button class="button button--secondary" type="button" data-drawer="upload-evidence">登记新资料</button></header><div class="asset-table-wrap"><table><thead><tr><th>资产</th><th>覆盖范围 / 责任人</th><th>服务使用</th><th>状态 / 质量</th><th></th></tr></thead><tbody>${rows || `<tr class="shared-empty-row"><td colspan="5"><strong>这一分面暂时没有资产</strong><p>${facet === "attention" ? "没有待你确认的绑定或质量问题。可切换到「全部」查看企业资产池。" : "可切换分面，或登记新资料进入资产池。"}</p><button class="text-button" type="button" data-asset-facet="all">查看全部资产 →</button></td></tr>`}</tbody></table></div></section>
      <section class="asset-governance" aria-label="数据资产处理原则"><article><span>AGENT STEWARDSHIP</span><h2>Agent 负责识别与建议，不负责越权确认</h2><ol><li>识别文件、期间、单位和业务对象</li><li>生成带来源引用的待确认记录</li><li>检测重复、冲突和跨服务复用机会</li><li>由授权人员确认后生成新资产版本</li></ol></article><article><span>CROSS-SERVICE CONTRACT</span><h2>复用资产，不复用结论</h2><p>服务必须通过绑定引用具体资产版本，并单独记录用途、转换、分配、确认和输入快照。一个服务的确认不会改变其他服务。</p><a class="text-button" href="../docs/enterprise-data-asset-framework.md" target="_blank" rel="noopener">查看标准框架 v0.2.0 →</a></article></section>`;
  }

  function renderSharedDeliverables() {
    const view = sharedCenterViews.deliverables({ role: state.role, actor: roleConfig[state.role].name });
    const rows = view.items.map((item) => `<article class="delivery-ledger-row">
      <div class="delivery-ledger-row__identity"><span class="service-tag ${item.serviceId === "pcf" ? "pilot" : ""}">${safe(item.serviceCode)}</span><div><h2>${safe(item.name)}</h2><p>${safe(item.object)} · ${safe(item.version)} · ${safe(item.id)}</p></div></div>
      <span class="record-state ${["已锁定", "已共享", "已交付", "已回执", "已封存", "核查完成"].includes(item.status) ? "ok" : ["内部复核", "待复核", "核查中", "整改中"].includes(item.status) ? "warn" : ""}">${safe(item.status)}</span>
      <dl class="delivery-control-line" aria-label="${safe(item.name)}控制状态"><div><dt>审批</dt><dd>${safe(item.controls.approval)}</dd></div><div><dt>锁定</dt><dd>${safe(item.controls.lock)}</dd></div><div><dt>交付</dt><dd>${safe(item.controls.delivery)}</dd></div></dl>
      <div class="delivery-ledger-row__action"><small>${item.snapshotId ? `输入快照 ${safe(item.snapshotId)}` : `工作流记录 Rev ${safe(item.workflowRevision)}`}</small><button class="text-button" type="button" data-service-enter="${safe(item.serviceId)}" data-page-target="${safe(item.page)}">进入服务处理 →</button></div>
    </article>`).join("");
    const empty = `<section class="shared-empty-state"><span>NO AUTHORIZED OUTPUTS</span><h2>还没有可查看的交付物</h2><p>报告或数据包在对应服务里生成、且你有权限后，会出现在这里。正式锁定与发送仍回服务频道完成。</p><button class="button button--secondary" type="button" data-page="services-hub">查看服务</button></section>`;
    $("#main").innerHTML = `${pageHeader("CONTROLLED OUTPUTS", "交付中心", statusChip(`${view.summary.total} 项交付物`))}
      <p class="page-lead">查看报告与数据包的版本、审批和交付状态；正式操作回到对应服务完成。</p>
      <dl class="shared-center-summary" aria-label="交付物摘要"><div><dt>受控交付物</dt><dd>${view.summary.total}</dd></div><div><dt>复核处理中</dt><dd>${view.summary.inReview}</dd></div><div><dt>已锁定</dt><dd>${view.summary.locked}</dd></div><div><dt>已发送 / 回执</dt><dd>${view.summary.delivered}</dd></div></dl>
      ${rows ? `<section class="delivery-ledger" aria-label="已授权交付物">${rows}</section>` : empty}`;
  }

  function renderSharedOrganization() {
    if (canManageOrganization()) { renderOrganizationSettings(); return; }
    const scope = state.role === "customer_contrib" ? "仅分配给我的任务与材料" : state.role === "customer_approver" ? "待审批对象与受控交付物" : "当前企业已开通服务与项目对象";
    $("#main").innerHTML = `${pageHeader("ENTERPRISE ACCESS", "企业与权限", statusChip("只读"))}<p class="page-lead">这里只显示你当前能看到的范围；无权访问的成员与服务数据不会出现。</p><section class="panel permission-self"><h2>我的有效权限</h2><dl><div><dt>企业</dt><dd>${safe(state.organization.name)}</dd></div><div><dt>当前角色</dt><dd>${safe(roleConfig[state.role].title)}</dd></div><div><dt>授权范围</dt><dd>${scope}</dd></div><div><dt>可进入服务</dt><dd>CBAM、产品碳足迹 PCF</dd></div></dl><button class="button button--secondary" data-drawer="permission-audit">查看权限来源</button></section>`;
  }

  const pcfStepLabels = {
    SCOPING: "核算声明",
    COLLECTING: "活动数据",
    NEEDS_CONFIRMATION: "绑定确认",
    CALCULATING: "碳足迹计算",
    EXPERT_REVIEW: "独立复核",
    DELIVERABLE_READY: "报告就绪",
  };

  function pcfChannelHeader(title, description) {
    const item = workflowEngine.get("PCF-2026-001");
    const declaration = item?.metadata?.declaration || {};
    const product = assetRegistry.get(declaration.productId || item?.metadata?.productId || "PRD-HRC-01");
    const productName = declaration.productName || product?.name || "热轧非合金钢卷";
    const productCode = product?.payload?.internalCode || "HRC-01";
    const index = Math.max(0, pcfSteps.indexOf(item?.status));
    return `${pageHeader("PRODUCT CARBON FOOTPRINT · PILOT", title, statusChip(workflowStateLabel(item?.status || "SCOPING"), workflowStateTone(item?.status)))}
      <div class="pcf-shell">
        <section class="pcf-context" aria-label="当前 PCF 项目">
          <div class="pcf-context__identity"><span>PCF · 试点项目</span><strong>${safe(productName)}</strong><small>${safe(productCode)} · 华星钢铁有限公司${declaration.confirmed ? ` · ${safe(declaration.functionalUnit || "")}` : ""}</small></div>
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
      ${stageGatePanelHtml("pcf")}`;
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
      ${stageGatePanelHtml("pcf")}`;
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
    const ledger = window.LuminoPcfInventory
      ? window.LuminoPcfInventory.buildDomainLedger({
        declaration: item?.metadata?.declaration,
        boundary: item?.metadata?.boundary,
        template,
        bindings: [ctx.powerBinding, ctx.evidenceBinding].filter(Boolean),
      })
      : { rows: [], summary: { ready: 0, total: 0 } };
    const domainHtml = (ledger.rows || []).map((row) => `<article class="pcf-domain-row">
      <span class="pcf-domain-number">${safe(row.number)}</span><div class="pcf-domain-name"><strong>${safe(row.name)}</strong><small>${safe(row.description)}</small></div>
      <div class="pcf-domain-owner"><span>责任</span><strong>${safe(row.owner)}</strong></div><div class="pcf-domain-count"><span>记录</span><strong>${safe(row.count)}</strong></div>
      <span class="pcf-domain-status pcf-domain-status--${safe(row.tone)}">${safe(row.status)}</span><button class="text-button" type="button" ${row.action === "pcf-boundary" ? 'data-page="pcf-boundary"' : row.action === "pcf-upload" ? 'data-drawer="pcf-upload"' : `data-drawer="record-detail" data-drawer-label="${safe(ctx.power?.name || "能源与过程数据")}" data-drawer-object="${safe(ctx.power?.versionId || "REC-HX-POWER-2026Q3")}" data-drawer-status="${factConfirmed ? "PCF 已确认使用" : "1 项待确认"}" data-drawer-description="核对购入电力的期间、数值、单位、产品用途与证据引用。资产版本 ${safe(ctx.power?.versionId || "")}；证据 ${safe(evidenceId)}。"`}>${safe(row.label)} →</button>
    </article>`).join("");
    const declarationReady = Boolean(item?.metadata?.declaration?.confirmed) || (item && !["NOT_STARTED", "SCOPING"].includes(item.status));
    const boundaryReady = Boolean(item?.metadata?.boundary?.confirmed) || item?.metadata?.boundary?.status === "CONFIRMED";
    const validationBanner = !declarationReady ? `<section class="pcf-recovery" role="status"><div><span class="pcf-kicker">DECLARATION REQUIRED</span><h2>请先确认核算声明</h2><p>功能单位、期间和用途确认后，才能采集活动数据。</p></div>${actionButton("前往核算声明", "primary", 'data-page="pcf-scope"')}</section>`
      : !boundaryReady ? `<section class="pcf-recovery" role="status"><div><span class="pcf-kicker">BOUNDARY REQUIRED</span><h2>请先确认系统边界</h2><p>纳入／排除与截断规则确认后，模板字段才有稳定范围。</p></div>${actionButton("前往系统边界", "primary", 'data-page="pcf-boundary"')}</section>`
      : templateInvalid ? `<section class="pcf-recovery" role="alert"><div><span class="pcf-kicker">TEMPLATE VALIDATION FAILED</span><h2>模板校验未通过</h2><p>${safe((template.issues || []).map((entry) => entry.message).join("；") || "请修正后重新回传。")}</p><ul>${(template.issues || []).map((entry) => `<li><strong>${safe(entry.code)}</strong> · ${safe(entry.recovery || "修正后重传")}</li>`).join("")}</ul></div>${actionButton("重新回传模板", "primary", 'data-drawer="pcf-upload"')}</section>`
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
      ${stageGatePanelHtml("pcf")}`;
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
      ${state.pcfCalculationFailed ? pcfRecovery("计算未完成", "排放因子版本读取失败。已确认的数据和输入快照均已保留，可安全重试。", "重新加载因子并计算", 'data-action="pcf-retry-calculation"') : blocked ? pcfRecovery("活动数据尚未确认", "完成模板校验并确认待处理服务绑定后，才能建立输入快照和运行计算。", "返回活动数据", 'data-page="pcf-data"') : needsFactors ? pcfRecovery("排放因子适用性未确认", "系统已按匹配逻辑给出推荐；请确认适用性，或改选备选后再确认。无需自行检索因子库。", "确认推荐因子适用性", 'data-action="pcf-confirm-factors"') : canRun ? `<section class="pcf-calculation-ready"><div><span class="pcf-kicker">STEP 04 · READY TO CALCULATE</span><h2>输入已锁定，可以生成计算草稿</h2><p>本次运行使用逐项清单和固定因子执行确定性计算。原型中除购入电力外的清单行为明示演示输入，不可正式披露。</p>${actionButton("运行确定性计算", "primary", 'data-action="pcf-run-calculation"')}</div><dl><div><dt>确认绑定</dt><dd>${safe(ctx.powerBinding?.id || "—")}</dd></div><div><dt>资产版本</dt><dd>${safe(ctx.powerBinding?.assetVersionId || "—")}</dd></div><div><dt>因子集</dt><dd>${safe(factors?.setId || "CN-EF-2026.1")}</dd></div><div><dt>功能单位</dt><dd>${safe(item?.metadata?.declaration?.functionalUnit || "1 吨产品")}</dd></div></dl></section>` : hasResult && ctx.snapshot?.status === "STALE" ? `${pcfRecovery("输入快照已过期（STALE）", "上游资产或绑定已修订；当前计算结果不可再作为正式依据。请回到活动数据确认绑定后重新运行计算。", "返回活动数据", 'data-page="pcf-data"')}<section class="result-summary" aria-disabled="true"><div class="pcf-result-total"><span class="pcf-kicker">${safe(runId)} · STALE</span><strong>${safe(calculation?.total ?? "—")}</strong><span>${safe(calculation?.unit || "tCO₂e / t 产品")}</span><p>历史结果保留供对照，不可直接进入独立复核。</p></div></section>` : hasResult ? `<section class="result-summary"><div class="pcf-result-total"><span class="pcf-kicker">${safe(runId)} · ${calculation?.formalUseAllowed ? "受控计算草稿" : "演示计算草稿"}</span><strong>${safe(calculation?.total ?? "—")}</strong><span>${safe(calculation?.unit || "tCO₂e / t 产品")}</span><p>${calculation?.formalUseAllowed ? "已固定正式输入" : "含演示清单·不可正式披露"}<br>输入快照 ${safe(snapshotId)}</p></div><div class="hotspot-list"><header><div><span class="pcf-kicker">EMISSION HOTSPOTS</span><h2>排放热点</h2></div>${statusChip("可重现", "ok")}</header><ol>${hotspotList || "<li><span>暂无热点</span><b>—</b></li>"}</ol><footer><p>结果尚未成为正式报告，需替换演示输入并完成独立复核。</p><button class="text-button" data-page="pcf-report">进入独立复核 →</button></footer></div></section>${resultDetail}` : pcfRecovery("尚未生成计算草稿", "确认因子后运行确定性计算，结果会写入可追溯的 Run 与热点结构。", "确认因子适用性", 'data-action="pcf-confirm-factors"')}
      ${stageGatePanelHtml("pcf")}`;
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
      ${stageGatePanelHtml("pcf")}`;
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
