"use strict";

  function goldenPathBanner(playbookId) {
    const stage = cbamGoldenPath.stage(playbookId);
    const labels = { not_started: "可开始", in_progress: "进行中", waiting_human: `等待 ${stage.assignee || "具名处理人"}`, blocked: "前置阻断", failed: "需要处理", done: "已完成", done_external: "已进入外部流程" };
    const tone = ["done", "done_external"].includes(stage.state) ? "" : ["blocked", "failed", "waiting_human"].includes(stage.state) ? "warn" : "locked";
    return `<section class="privacy-band" role="status" aria-label="Q3 演示场景状态">
      <strong>Q3 演示场景</strong>
      <span>${safe(labels[stage.state] || stage.state)}${stage.recovery ? ` · ${safe(stage.recovery)}` : ""} · 页面与 Agent 使用同一工作流状态。</span>
      <span class="status-chip ${tone}">${safe(playbookId.toUpperCase())}</span>
      <button class="text-button" type="button" data-action="cbam-reset-demo">重置演示</button>
    </section>`;
  }

  function customerQuestion() {
    if (state.year === "2028") return `
      <p class="question-count">年度变化确认 · 第 1 项</p>
      <h2>2028 年还会使用这 2 个生产设施吗？</h2>
      <p class="why">我从 2027 年带入的是设施结构，不是年度数值。确认后，我会继续询问新增生产线、产品和供应商变化。</p>
      <div class="answer-row"><button class="answer-button" type="button" data-answer="设施没有变化">是，没有变化</button><button class="answer-button" type="button" data-answer="设施发生变化">有新增或停用</button><button class="answer-button secondary" type="button" data-answer="不确定">我不确定</button><button class="answer-button secondary" type="button" data-answer="delegate">交给生产同事</button></div>`;
    if (state.year === "2025") return lockedYearBanner();
    if (state.year === "2027") return `
      <p class="question-count">年度范围确认 · 第 1 项</p>
      <h2>2027 年还会使用当前这 2 座生产设施吗？</h2>
      <p class="why">系统只带入企业、产品与设施结构，不会复制 2026 年的产量、能耗、计算结果或批准状态。</p>
      <div class="answer-row"><button class="answer-button" type="button" data-answer="设施没有变化">是，没有变化</button><button class="answer-button" type="button" data-answer="设施发生变化">有新增或停用</button><button class="answer-button secondary" type="button" data-answer="不确定">我不确定</button><button class="answer-button secondary" type="button" data-answer="delegate">交给生产同事</button></div>`;
    if (state.answer) return `
      <div class="agent-result"><strong>已记录：${state.answer === "delegate" ? "已交给生产负责人" : state.answer}</strong><p>Agent 已更新待确认理解，正式数据不会被直接覆盖。</p><button class="text-button" type="button" data-action="revise-answer">修改回答</button></div>`;
    return `
      <p class="question-count">今天第 1 个问题 · 预计 1 分钟</p>
      <h2>生产热轧卷时使用的钢坯，是你们自己生产的吗？</h2>
      <p class="why">这会决定钢坯的排放数据从内部生产记录获取，还是向供应商索取。你不需要判断它属于哪类“前体”。</p>
      ${state.questionHelpOpen ? '<div class="question-explainer"><strong>为什么现在问？</strong><p>产品和生产配置决定后，Agent 才能生成准确的材料清单、监测计划任务和供应商请求。此处只记录业务事实。</p></div>' : ""}
      <div class="answer-row"><button class="answer-button" type="button" data-answer="是，钢坯自产">是，自己生产</button><button class="answer-button" type="button" data-answer="不是，从供应商采购">不是，向外采购</button><button class="answer-button secondary" type="button" data-answer="不确定">我不确定</button><button class="answer-button secondary" type="button" data-answer="delegate">交给同事</button></div>`;
  }

  function cbamWorkQueueItems(profile) {
    const locked = profile.mode === "archived";
    const planned = profile.mode === "planned";
    if (locked) {
      return [
        { title: "Communication Package 已交付", sub: "NordWerk GmbH · 已接收", state: "已完成", tone: "ok", go: "查看", attrs: 'data-page="deliverables"' },
        { title: "核查报告已归档", sub: "Verification Report · Rev 1", state: "已封存", tone: "locked", go: "查看", attrs: 'data-page="deliverables"' },
      ];
    }
    if (planned) {
      return [
        { title: "确认年度产品与设施范围", sub: "核对从上一年度引用的结构与本年变化", state: "现在可做", tone: "warn", go: "开始确认", attrs: 'data-page="products"' },
        { title: "生成年度监测计划草稿", sub: "范围确认后由 Agent 和专家准备", state: "下一步", tone: "locked", go: "查看要求", attrs: 'data-page="deliverables"' },
        { title: "安排 Q1 数据责任人", sub: "不会复制上一年度季度数值", state: "待范围确认", tone: "locked", go: "查看团队", attrs: 'data-page="team"' },
      ];
    }
    const actor = roleConfig[state.role].name;
    const fromCenter = sharedCenterViews.tasks({ role: state.role, actor }).items
      .filter((task) => task.serviceCode === "CBAM" || task.serviceId === "cbam")
      .map((task) => ({
        title: task.title,
        sub: `${task.object} · ${task.nextStep}`,
        state: task.due?.tone === "danger" ? "已逾期" : task.due?.label || "待处理",
        tone: task.due?.tone === "danger" ? "danger" : task.due?.tone === "warn" ? "warn" : "",
        go: "处理",
        attrs: `data-page="${safe(task.page || "data")}"`,
      }));
    if (fromCenter.length) return fromCenter;
    if (state.findingResolved) {
      return [
        { title: "完成监测计划的剩余缺口", sub: "已确认事实会自动复用", state: "今天", tone: "warn", go: "去处理", attrs: 'data-page="deliverables"' },
        { title: "等待专家复核 Run 05", sub: "王晨制备 · 李娜独立复核", state: "处理中", tone: "", go: "查看结果", attrs: 'data-page="results"' },
        { title: "继续跟进供应商实测数据", sub: "默认值并行路径不会停止供应商请求", state: "等待中", tone: "locked", go: "查看", attrs: 'data-page="products"' },
      ];
    }
    if (state.factConfirmed) {
      return [
        { title: "处理前体排放数据缺口", sub: "FND-PRE-004 · 北方特钢", state: "已逾期", tone: "danger", go: "处理", attrs: 'data-page="results"' },
        { title: "复核 Run 05 成本变化", sub: "确认新增能源数据带来的影响", state: "待决定", tone: "warn", go: "查看", attrs: 'data-page="results"' },
        { title: "完成 Q3 数据包", sub: "NordWerk GmbH · 10 月 31 日", state: "进行中", tone: "", go: "查看", attrs: 'data-page="deliverables"' },
      ];
    }
    if (state.uploadAdded) {
      return [
        { title: "确认 Agent 提取的能源数据", sub: "核对用量、账期与设施", state: "待确认", tone: "warn", go: "核对", attrs: 'data-page="data"' },
        { title: "处理前体排放数据缺口", sub: "FND-PRE-004 · 北方特钢", state: "已逾期", tone: "danger", go: "处理", attrs: 'data-page="results"' },
        { title: "完成 Q3 数据包", sub: "NordWerk GmbH · 10 月 31 日", state: "进行中", tone: "", go: "查看", attrs: 'data-page="deliverables"' },
      ];
    }
    return [
      { title: "处理前体排放数据缺口", sub: "FND-PRE-004 · 北方特钢", state: "已逾期 3 天", tone: "danger", go: "处理", attrs: 'data-action="resolve-finding"' },
      { title: `上传 ${state.quarter} 能源证明`, sub: `上海一厂 · ${quarterMeta[state.quarter].months}`, state: "待上传", tone: "warn", go: "上传", attrs: 'data-action="mock-upload"' },
      { title: "完成 Q3 数据包", sub: "NordWerk GmbH · 10 月 31 日", state: "进行中", tone: "", go: "查看", attrs: 'data-page="deliverables"' },
    ];
  }

  function cbamWorkNext(profile, openCount) {
    if (profile.mode === "archived") return "";
    if (profile.mode === "planned") {
      return `<section class="next-action" aria-label="下一步">
        <div class="next-action__copy">
          <small class="next-action__kicker">下一步 · 年度准备</small>
          <strong>确认 ${state.year} 年的产品、工厂与进口商</strong>
          <span>系统已引用长期主档作为建议；确认变化后再生成监测计划草稿和 Q1 任务。</span>
        </div>
        <button class="button button--primary" type="button" data-page="products">确认年度范围<span aria-hidden="true">→</span></button>
      </section>`;
    }
    if (state.findingResolved) {
      return `<section class="next-action" aria-label="下一步">
        <div class="next-action__copy">
          <small class="next-action__kicker">下一步 · CBAM</small>
          <strong>检查报告与交付准备度</strong>
          <span>季度数据路径已记录；现在检查监测计划和年度文件还缺什么。</span>
        </div>
        <button class="button button--primary" type="button" data-page="deliverables">检查报告与交付<span aria-hidden="true">→</span></button>
      </section>`;
    }
    if (state.factConfirmed) {
      return `<section class="next-action" aria-label="下一步">
        <div class="next-action__copy">
          <small class="next-action__kicker">下一步 · 1 / ${Math.max(openCount, 1)}</small>
          <strong>处理前体排放数据缺口</strong>
          <span>FND-PRE-004 已逾期。选择补数、等待供应商或受控默认值后，${state.quarter} 计算才能继续。</span>
        </div>
        <button class="button button--primary" type="button" data-page="results">选择处理路径<span aria-hidden="true">→</span></button>
      </section>`;
    }
    if (state.uploadAdded) {
      return `<section class="next-action" aria-label="下一步">
        <div class="next-action__copy">
          <small class="next-action__kicker">下一步 · CBAM</small>
          <strong>确认 Agent 提取的能源数据</strong>
          <span>核对用量、账期和设施。确认后才会产生新计算版本。</span>
        </div>
        <button class="button button--primary" type="button" data-page="data">核对提取结果<span aria-hidden="true">→</span></button>
      </section>`;
    }
    return `<section class="next-action" aria-label="下一步">
      <div class="next-action__copy">
        <small class="next-action__kicker">下一步 · 1 / ${Math.max(openCount, 1)}</small>
        <strong>处理前体排放数据缺口</strong>
        <span>已逾期 3 天，阻塞 ${state.quarter} 计算与 NordWerk 数据包交付（10 月 31 日）。</span>
      </div>
      <button class="button button--primary" type="button" data-action="resolve-finding">选择处理路径<span aria-hidden="true">→</span></button>
    </section>`;
  }

  function renderCustomer() {
    if (renderMultiServicePage()) return;
    if (state.page !== "work") return renderCustomerSecondary();
    const profile = annualProfile();
    const locked = profile.mode === "archived";
    const planned = profile.mode === "planned";
    const org = state.organization?.name || "华星钢铁";
    const queue = cbamWorkQueueItems(profile);
    const openCount = queue.filter((item) => !["已完成", "已封存", "已回执"].includes(item.state)).length;
    const progress = Number(profile.quarters?.[state.quarter]?.[1] ?? profile.progress ?? 0);
    const progressNote = locked
      ? "全年数据包、年度报告与核查已锁定为快照。"
      : planned
        ? "季度数据不会跨年度复制，确认范围后从 Q1 开始产生。"
        : state.findingResolved
          ? "前体路径已记录；剩余能源证明与数据包收尾。"
          : "截止 10 月 31 日交付 NordWerk GmbH。剩余：前体数据、能源证明。";
    const quarterTone = (tone) => tone === "ok" ? "is-ok" : tone === "warn" ? "is-warn" : "is-muted";
    const quarterRows = Object.entries(profile.quarters || {}).map(([q, [label, , tone]]) => `
      <li class="cbam-work__quarter ${quarterTone(tone)}"><span>${q} 数据包</span><strong>${safe(label)}</strong></li>`).join("");

    const yearStateCard = locked
      ? `<section class="cbam-work__state" aria-label="年度已封存">
          <header><span class="cbam-work__state-icon" aria-hidden="true"></span><strong>${state.year} 年度已封存，只读</strong></header>
          <p>Q1–Q4 数据包、年度排放报告、核查与交付已锁定为快照。如需更正，请创建更正修订，原快照保持不变。</p>
          <div class="cbam-work__state-actions">
            <button class="button button--primary" type="button" data-drawer="generic-action" data-drawer-label="创建 Amendment Revision">创建更正修订</button>
            <button class="text-button" type="button" data-page="deliverables">查看封存的交付物</button>
          </div>
        </section>`
      : planned
        ? `<section class="cbam-work__state" aria-label="年度尚未开始">
          <strong>${state.year} 年度尚未开始</strong>
          <p>可以先确认范围、产品与设施变化和监测方法。季度数据和计算结果不会跨年度复制，会在 ${state.year} Q1 开始后逐季产生。</p>
          <ul class="cbam-work__inherit">
            <li>继承为待确认：企业主体、设施、产品与 CN Code 候选</li>
            <li>复制为草稿：工艺、供应商、职责与数据源映射</li>
            <li>不复制：产量、能耗、计算、报告与核查结论</li>
          </ul>
          <div class="cbam-work__state-actions">
            <button class="button button--primary" type="button" data-page="products">开始确认 ${state.year} 范围</button>
          </div>
        </section>`
        : "";

    const queueCard = (locked || planned) ? "" : `
      <div class="cbam-work__board">
        <section class="cbam-work__queue ds-card" aria-label="${state.quarter} 待办">
          <header class="ds-card__head">
            <h2>${state.quarter} 数据包 · 我的待办</h2>
            <span>${openCount || queue.length} 项未完成</span>
          </header>
          <ul class="cbam-work__list">
            ${queue.map((item) => `
              <li>
                <button type="button" class="cbam-work__row" ${item.attrs}>
                  <span class="cbam-work__row-copy"><strong>${safe(item.title)}</strong><small>${safe(item.sub)}</small></span>
                  <span class="status-chip ${item.tone === "danger" ? "danger" : item.tone === "warn" ? "warn" : item.tone === "ok" ? "" : item.tone === "locked" ? "locked" : ""}">${safe(item.state)}</span>
                  <span class="cbam-work__go">${safe(item.go)} →</span>
                </button>
              </li>`).join("")}
          </ul>
        </section>
        <aside class="cbam-work__progress ds-card" aria-label="${state.quarter} 数据包进度">
          <strong>${state.quarter} 数据包进度</strong>
          <span class="cbam-work__pct">${progress}%</span>
          <span class="cbam-work__bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, progress))}%"></i></span>
          <p>${safe(progressNote)}</p>
          <ul class="cbam-work__quarters">${quarterRows}</ul>
          ${stageGatePanelHtml("cbam", { variant: "rail" })}
        </aside>
      </div>`;

    $("#main").innerHTML = `
      <div class="cbam-work" data-template="T1">
        ${pageHeader(`${org} / CBAM`, "当前工作", `<div class="head-actions">${window.LuminoAgentRuntime?.agentPageAction?.() || ""}${statusChip(`${state.year} · ${years[state.year]?.short || profile.position}`, years[state.year]?.chip === "warn" ? "warn" : years[state.year]?.chip === "locked" ? "locked" : "")}</div>`)}
        ${state.online ? "" : '<div class="offline-banner" role="status"><strong>当前处于离线状态</strong><span>你仍可查看本页，但上传、分享和状态变更将在恢复网络后才能提交。</span></div>'}
        ${state.importedTrial && state.year === String(state.importedTrial.year) ? `<section class="trial-handoff"><div><small>来自免费成本试算</small><strong>${safe(state.importedTrial.cnCode)} · ${safe(state.importedTrial.quantity.toLocaleString("zh-CN"))} 吨</strong><p>估算成本 ¥${safe(state.importedTrial.estimatedCostCny.toLocaleString("zh-CN"))}。这只是线索，确认产品与工厂后才会建立正式事实。</p></div><button class="button button--secondary" type="button" data-action="review-trial">核对并转为项目</button></section>` : ""}
        ${cbamWorkNext(profile, openCount || queue.length)}
        ${yearStateCard}
        ${queueCard}
      </div>`;
  }

  function renderCustomerSecondary() {
    if (state.page === "services") return renderServices();
    if (state.page === "programs") return renderPrograms();
    if (state.page === "contributor-work") return renderContributorWork();
    if (state.page === "approvals") return renderApprovals();
    if (state.page === "roadmap") return renderRoadmap();
    if (state.page === "products") return renderProducts();
    if (state.page === "data") return renderData();
    if (state.page === "results") return renderResults();
    if (state.page === "deliverables") return renderDeliverables();
    if (state.page === "team") return renderTeam();
    if (state.page === "annual-setup") return renderAnnualSetup();
    if (state.page === "org-settings") return renderOrganizationSettings();
    if (state.page === "workflow-governance") return renderWorkflowGovernance();
  }

  function renderWorkflowGovernance() {
    const flows = Object.entries(workflowStates).map(([id, flow]) => workflowCard(id, flow)).join("");
    const annual = workflowEngine.deriveAnnualCycle({ year: state.year });
    const annualLabels = { SCOPING: "范围确认", COLLECTING: "数据收集中", INTERNAL_REVIEW: "内部复核中", IN_VERIFICATION: "核查中", VERIFIED: "已核查", LOCKED: "已锁定" };
    const auditRows = workflowEngine.events().filter((item) => item.actor !== "SYSTEM_SEED").slice(0, 8).map((item) => `<tr><td>${safe(new Date(item.at).toLocaleString("zh-CN", { hour12: false }))}</td><td><strong>${safe(item.objectId)}</strong><small>${safe(item.type)}</small></td><td>${safe(item.from ? `${workflowStateLabel(item.from)} → ${workflowStateLabel(item.to)}` : workflowStateLabel(item.to))}</td><td>${safe(item.actor)}</td><td>${safe(item.reason)}</td><td>Rev ${item.objectRevision}</td></tr>`).join("");
    $("#main").innerHTML = `
      ${pageHeader("OBJECT STATES & RESPONSIBILITY", "状态与责任", statusChip(annualLabels[annual.status] || annual.status, annual.blockers.length ? "warn" : "ok"))}
      ${objectContext([["企业", state.organization.name], ["年度", state.year], ["当前季度", state.quarter], ["服务订单", state.year === "2026" ? "SO-2026-018 · Rev 2" : state.year === "2025" ? "SO-2025-002 · 已结案" : "待关联 2027 范围"]])}
      <div class="responsibility-notice"><strong>不要把“项目进行中”当作唯一状态。</strong><p>季度交付、设施年度排放报告、核查、进口商接收和 Lumino 履约可以并行推进。每个对象维护自己的状态、负责人和版本。</p></div>
      <section class="workflow-grid">${flows}</section>
      <section class="panel wide-panel"><div class="panel-head"><div><h2>审计时间线</h2><span>只追加；展示最近 8 条用户或系统迁移</span></div>${statusChip(`${annual.blockers.length} 个开放阻塞`, annual.blockers.length ? "warn" : "ok")}</div><table class="data-table"><thead><tr><th>时间</th><th>对象</th><th>变更</th><th>操作者</th><th>理由</th><th>版本</th></tr></thead><tbody>${auditRows || '<tr><td colspan="6">尚无用户发起的状态变更。</td></tr>'}</tbody></table></section>
      <section class="panel wide-panel"><div class="panel-head"><div><h2>年度聚合规则</h2><span>Annual Cycle 只读显示，不反向覆盖子对象</span></div></div><table class="data-table"><thead><tr><th>年度显示</th><th>聚合条件</th><th>不代表</th><th>责任方</th></tr></thead><tbody><tr><td><strong>数据收集中</strong></td><td>至少一个开放季度包处于收集中</td><td>年度报告已生成</td><td>项目协调人</td></tr><tr><td><strong>年度制备中</strong></td><td>设施年度数据齐备，报告尚未锁定</td><td>核查已通过</td><td>制备专家</td></tr><tr><td><strong>核查中</strong></td><td>至少一个设施已送核查且未完成</td><td>所有设施均已核查</td><td>第三方核查员</td></tr><tr><td><strong>交付完成</strong></td><td>所有约定接收方均确认收到对应版本</td><td>欧盟申报人已完成法定申报</td><td>运营 + 接收方</td></tr></tbody></table></section>`;
  }

  function renderServices() {
    const admin = state.role === "customer_admin";
    $("#main").innerHTML = `
      ${pageHeader("SERVICE ENTITLEMENTS", admin ? "服务与订单" : "我的服务", statusChip("SO-2026-018 · 履约中"))}
      <section class="service-hero"><div><small>LUMINO SERVICE ORDER</small><h2>2026 年度 CBAM 全流程服务</h2><p>合同 CT-2025-044 · 华星钢铁有限公司 · 2025-11-01 至 2027-03-31</p></div><div><small>服务负责人</small><strong>林晓 · 客户运营</strong><span>王晨 · 制备专家 / 李娜 · 独立复核</span></div></section>
      <div class="content-split service-layout">
        <section class="panel"><div class="panel-head"><div><h2>订单覆盖范围</h2><span>客户确认版本 · Rev 2</span></div>${admin ? '<button class="button button--secondary" type="button" data-drawer="service-scope">申请变更</button>' : ""}</div><dl class="scope-grid"><div><dt>申报年度</dt><dd>2026</dd></div><div><dt>设施</dt><dd>2 座</dd></div><div><dt>产品</dt><dd>4 类 / 7 个配置</dd></div><div><dt>欧盟进口商</dt><dd>3 家</dd></div><div><dt>服务模块</dt><dd>建档、核算、监测计划、核查支持、交付</dd></div><div><dt>SLA</dt><dd>专业问题 2 个工作日</dd></div></dl></section>
        <aside class="panel"><div class="panel-head"><h2>约定交付物</h2></div><ol class="compact-checklist"><li><span>↻</span><div><strong>季度进口商数据包</strong><small>Q1–Q4 · 按进口商范围生成</small></div></li><li><span>✓</span><div><strong>年度监测计划</strong><small>草稿 Rev 3 · 准备复核</small></div></li><li><span>→</span><div><strong>年度排放报告与核查包</strong><small>全年数据完成后生成并核查</small></div></li></ol></aside>
      </div>
      ${admin ? `<section class="panel wide-panel order-governance"><div class="panel-head"><div><h2>订单治理</h2><span>暂停、终止、验收和范围变更均保留版本与理由</span></div></div><div class="governance-actions"><button class="button button--secondary" type="button" data-staff-action="已提交暂停服务申请，等待运营评估影响">申请暂停</button><button class="button button--secondary" type="button" data-drawer="service-scope">申请范围变更</button><button class="button button--secondary" type="button" data-staff-action="已打开服务订单验收清单">查看验收条件</button><button class="text-button danger-link" type="button" data-staff-action="已提交终止服务申请，正式终止前不会撤销当前访问">申请终止服务</button></div></section>` : ""}
      <section class="panel wide-panel"><div class="panel-head"><div><h2>出口订单与发运覆盖</h2><span>业务订单不会与 Lumino 服务订单混用</span></div><button class="text-button" type="button" data-drawer="shipping-import">导入发运台账</button></div><table class="data-table"><thead><tr><th>进口商</th><th>申报期间</th><th>发运批次</th><th>产品覆盖</th><th>数量状态</th><th>数据范围</th></tr></thead><tbody><tr><td><strong>NordWerk GmbH</strong><small>德国</small></td><td>2026 Q1–Q3</td><td>18</td><td>热轧卷、镀层板</td><td><span class="record-state ok">已对账</span></td><td>仅本进口商可见交付包</td></tr><tr><td><strong>EuroFab S.r.l.</strong><small>意大利</small></td><td>2026 Q2–Q3</td><td>7</td><td>型钢</td><td><span class="record-state warn">缺 1 批数量</span></td><td>仅本进口商可见交付包</td></tr></tbody></table></section>`;
  }

  function renderPrograms() {
    const nextYearRow = state.yearCreated ? `<tr><td><strong>2028</strong></td><td><span class="status-chip warn">变化确认</span></td><td>待关联</td><td>周岚</td><td>结构待确认</td><td><button class="text-button" type="button" data-action="enter-program" data-year="2028">进入年度工作</button></td></tr>` : "";
    $("#main").innerHTML = `
      ${pageHeader("ANNUAL PROGRAMS & SERVICE", "年度与订单", `<div class="head-actions"><button class="button button--secondary" type="button" data-page="services">查看服务订单</button>${actionButton("创建新年度", "primary", 'data-action="open-year-setup"')}</div>`)}
      <section class="annual-overview" aria-label="年度状态总览"><article><small>2025</small><strong>完整年度</strong><span>Q1–Q4、排放报告、核查和交付均已完成</span></article><article class="current"><small>2026</small><strong>当前执行年度</strong><span>Q1、Q2 已完成 · Q3 进行中 · Q4 未开始</span></article><article><small>2027</small><strong>待开始 · 可准备</strong><span>可确认范围、产品变化和监测方法</span></article></section>
      <section class="panel wide-panel"><div class="panel-head"><div><h2>华星钢铁 CBAM Program</h2><span>三个年度覆盖完整、进行中与待开始状态</span></div></div><table class="data-table program-table"><thead><tr><th>年度</th><th>当前阶段</th><th>服务订单</th><th>项目协调人</th><th>数据状态</th><th>可执行动作</th></tr></thead><tbody>${nextYearRow}<tr><td><strong>2027</strong></td><td><span class="status-chip warn">待开始 · 可准备</span></td><td>待关联 2027 服务范围</td><td>周岚</td><td>年度范围 8%</td><td><button class="text-button" type="button" data-action="enter-program" data-year="2027">进入年度准备</button></td></tr><tr><td><strong>2026</strong></td><td><span class="status-chip">Q3 数据采集中</span></td><td>SO-2026-018</td><td>周岚</td><td>Q1、Q2 完成 · Q3 68%</td><td><button class="text-button" type="button" data-action="enter-program" data-year="2026">继续年度工作</button></td></tr><tr><td><strong>2025</strong></td><td><span class="status-chip locked">完整归档</span></td><td>SO-2025-002</td><td>周岚</td><td>Q1–Q4 及年度文件完成</td><td><button class="text-button" type="button" data-action="enter-program" data-year="2025">查看完整档案</button></td></tr></tbody></table></section>`;
  }

  function renderContributorWork() {
    $("#main").innerHTML = `
      ${pageHeader(`${state.year} · ASSIGNED TO ME`, "分配给我的工作", statusChip("仅显示上海一厂范围"))}
      <div class="privacy-band"><strong>你当前是数据贡献者</strong><span>可以回答和上传自己负责的材料；无法查看其他设施、完整报告或成员权限。</span></div>
      <section class="panel task-focus"><div><small>${state.quarter} · 今天到期 · 约 3 分钟</small><h2>请上传上海一厂 ${quarterMeta[state.quarter].endMonth}天然气账单</h2><p>Agent 会提取账期与用量；上传结果先进入待确认区，不会直接进入正式核算。</p></div><button class="button button--primary" type="button" data-action="mock-upload">上传账单</button></section>
      <section class="panel wide-panel"><div class="panel-head"><h2>我的任务</h2><span>2 项</span></div><div class="record-list"><article class="record"><span class="record-code">GAS</span><div><strong>${quarterMeta[state.quarter].endMonth}天然气账单</strong><p>${state.year} ${state.quarter} · 上海一厂 · 今天到期</p></div><span class="record-state warn">待上传</span></article><article class="record"><span class="record-code">LINE</span><div><strong>确认热轧线 2 是否检修</strong><p>只需回答实际发生的情况</p></div><span class="record-state">待回答</span></article></div></section>`;
  }

  function renderApprovals() {
    const queueItems = `
      <button type="button" class="stack-row active" data-drawer="record-detail" data-drawer-label="默认值并行路径" data-drawer-object="AP-2026-014" data-drawer-status="等待内部审批" data-drawer-action="批准并记录理由"><span>风险路径 · 今天</span><strong>供应商数据未返回，是否暂用默认值？</strong><small>影响 37% 总排放 · 不影响继续采集</small></button>
      <button type="button" class="stack-row" data-drawer="record-detail" data-drawer-label="NordWerk Communication Package" data-drawer-object="2026 Q1–Q3 · 2 个产品" data-drawer-status="待审批交付范围"><span>交付范围 · 周五</span><strong>NordWerk Communication Package</strong><small>2 个产品 · 2026 Q1–Q3</small></button>`;
    const decisionPoints = `
      <li><span>¥</span><div><strong>当前成本影响</strong><small>较目标情景约增加 ¥230k</small></div></li>
      <li><span>✓</span><div><strong>可以撤回</strong><small>供应商数据通过核查后创建新计算版本</small></div></li>
      <li><span>→</span><div><strong>批准后</strong><small>锁定本路径快照；Finding 保持开放，实测返回后可开新版本</small></div></li>`;
    $("#main").innerHTML = reviewSuiteShell({
      meta: `${state.year} · INTERNAL APPROVAL`,
      title: "待我审批",
      aside: statusChip("2 项等待决定", "warn"),
      note: "批准只记录路径决定，不会关闭 Finding，也不会覆盖已锁定的历史计算。",
      queueTitle: "审批队列",
      queueMeta: "<span>按成本与交付影响排序</span>",
      queueItems,
      decisionKicker: "DECISION AP-2026-014",
      decisionTitle: "默认值并行路径",
      decisionLead: "批准后，团队会继续向供应商索取实测数据，同时以保守默认值维持当前进度。",
      decisionPoints,
      approveLabel: "批准并记录理由",
      approveAttrs: 'data-workflow-transition="APPROVED" data-object-id="AP-2026-014"',
      rejectLabel: "退回补充",
      rejectAttrs: 'data-workflow-transition="REJECTED" data-object-id="AP-2026-014"',
    });
  }

  /**
   * 全年流程数据（对齐原型 v3：5 阶段 stepper + 详情 + 关键日期）
   * status: done | cur | todo
   */
  function cbamRoadmapModel() {
    const y = Number(state.year);
    const year = String(state.year);
    const stLbl = {
      done: { label: "已完成", chip: "ok", bar: "done", sc: "done" },
      cur: { label: "进行中", chip: "warn", bar: "cur", sc: "cur" },
      todo: { label: "未开始", chip: "locked", bar: "todo", sc: "todo" },
    };

    let sts;
    if (year === "2025") sts = ["done", "done", "done", "done", "done"];
    else if (year === "2027") sts = ["cur", "todo", "todo", "todo", "todo"];
    else sts = ["done", "done", "cur", "todo", "todo"];

    const doneAt = year === "2025"
      ? ["2025-01-15 确认", "2025-02-10 锁定", "Q1–Q4 均已回执", "2026-02-26 锁定", "2026-04-30 交付并封存"]
      : ["2026-01-12 确认", "2026-02-03 锁定", "", "", ""];
    const curTxt = year === "2027"
      ? ["可以开始确认 2027 范围", "", "", "", ""]
      : ["", "", `${state.quarter === "Q3" ? "Q3 采集中" : state.quarter} · Q3 截止 10 月 31 日`, "", ""];

    const stages = [
      {
        n: "01", t: "年度范围", when: `${y} 年 1 月`,
        d: "确认申报关系、出口欧盟的产品与 CN Code、涉及的工厂。产品与设施是跨年度主档，年度项目只引用。",
        who: "你 · Lumino 专家",
        outs: ["申报关系：NordWerk GmbH", "产品范围 · CN 7208 39 00", "设施：上海一厂"],
        gate: "上一年度封存后开始",
      },
      {
        n: "02", t: "监测计划", when: `${y} 年 1–2 月`,
        d: "每类数据用什么方法、从哪里来、由谁负责；默认值的使用条件也在这里约定。锁定后生成每季度的材料请求。",
        who: "王晨 制备 · 李娜 复核 · 你确认",
        outs: [`监测计划 MP-${y} v2`, "数据源分工 9 项", "默认值使用规则"],
        gate: "需要年度范围确认",
      },
      {
        n: "03", t: "季度数据循环", when: `${y} Q1–Q4`,
        d: "每季度重复：材料请求 → 上传与 Agent 提取 → 你确认 → 计算与复核 → 数据包共享给进口商并回执。",
        who: "你 · 数据贡献者 · Lumino 专家",
        quarters: true,
        gate: "需要监测计划锁定",
      },
      {
        n: "04", t: "年度排放报告", when: `${y + 1} 年 1–2 月`,
        d: "汇总四个季度已锁定的计算，形成年度排放与隐含排放报告，附前体与默认值使用说明。",
        who: "王晨 制备 · 李娜 复核 · 内部审批人批准",
        outs: ["年度排放报告", "前体与默认值使用说明", "证据清单"],
        gate: "需要 Q4 数据包回执",
      },
      {
        n: "05", t: "核查与交付", when: `${y + 1} 年 3–4 月`,
        d: "第三方核查员审阅报告与证据并出具结论，之后交付进口商用于其年度申报，年度项目随之封存。",
        who: "Veritas Climate 核查 · 你确认交付",
        outs: ["核查结论", "交付 NordWerk GmbH", "年度快照封存"],
        gate: "需要年度报告锁定",
      },
    ];

    const curIdx = Math.max(0, sts.indexOf("cur"));
    const sel = state.roadStage != null && state.roadStage >= 0 && state.roadStage <= 4
      ? state.roadStage
      : curIdx;

    const stageCards = stages.map((g, i) => {
      const k = sts[i];
      const meta = stLbl[k];
      return {
        ...g,
        i,
        k,
        st: meta.label,
        chip: meta.chip,
        bar: meta.bar,
        sc: meta.sc,
        selected: i === sel,
      };
    });

    const g = stages[sel];
    const k = sts[sel];
    const meta = stLbl[k];
    const metaK = k === "done" ? "完成" : k === "cur" ? "当前" : "开始条件";
    const metaV = k === "done"
      ? (doneAt[sel] || "已完成")
      : k === "cur"
        ? (curTxt[sel] || "进行中")
        : g.gate;

    let quarters = [];
    if (g.quarters) {
      if (year === "2026") {
        quarters = [
          { q: "Q1", st: "已回执", chip: "ok", d: "4 月 28 日 NordWerk 回执", live: true },
          { q: "Q2", st: "已回执", chip: "ok", d: "8 月 2 日 NordWerk 回执", live: true },
          { q: "Q3", st: "采集中", chip: "warn", d: "截止 10 月 31 日交付", live: true },
          { q: "Q4", st: "未开始", chip: "locked", d: "2027 年 1 月 1 日开启", live: false },
        ];
      } else if (year === "2025") {
        quarters = ["Q1", "Q2", "Q3", "Q4"].map((q) => ({ q, st: "已回执", chip: "ok", d: "已封存", live: false }));
      } else {
        quarters = ["Q1", "Q2", "Q3", "Q4"].map((q) => ({ q, st: "未开始", chip: "locked", d: "监测计划锁定后开启", live: false }));
      }
    }

    const outsLabel = k === "done" ? "产出" : "将产出";
    const outs = (g.outs || []).map((t) => ({
      t,
      done: k === "done",
    }));

    /* 阶段动作：与原型一致 — 未开始阶段不显示主按钮 */
    let btn = null;
    if (sel === 0) btn = { label: "产品与工厂 →", page: "products" };
    else if (sel === 1 && k !== "todo") btn = { label: "查看监测计划", action: "plan-toast" };
    else if (sel === 2 && year === "2026") btn = { label: "季度数据 →", page: "data" };
    else if ((sel === 3 || sel === 4) && year === "2025") btn = { label: "报告与交付 →", page: "deliverables" };

    let dates;
    if (year === "2025") {
      dates = [
        { d: "2026-02-26", t: "年度排放报告锁定", hot: false },
        { d: "2026-04-30", t: "交付 NordWerk，年度封存", hot: false },
        { d: "之后", t: "如需更正，创建更正修订", hot: false },
      ];
    } else if (year === "2027") {
      dates = [
        { d: "2027-01", t: "确认 2027 年度范围", hot: true },
        { d: "2027-02", t: "更新监测计划", hot: false },
        { d: "2027-04-30", t: "Q1 数据包交付", hot: false },
      ];
    } else {
      dates = [
        { d: "10 月 31 日", t: "Q3 数据包交付 NordWerk", hot: true },
        { d: "2027-01-01", t: "Q4 数据采集开始", hot: false },
        { d: "2027-01-31", t: "Q4 数据包交付", hot: false },
        { d: "2027-02-28", t: "年度排放报告锁定", hot: false },
        { d: "2027-03", t: "第三方核查", hot: false },
        { d: "2027-04-30", t: "年度交付，2026 封存", hot: false },
      ];
    }

    return {
      year,
      sel,
      curIdx,
      stageCards,
      detail: {
        n: g.n,
        when: g.when,
        t: g.t,
        d: g.d,
        who: g.who,
        st: meta.label,
        chip: meta.chip,
        metaK,
        metaV,
        hasQ: !!g.quarters,
        quarters,
        hasOuts: !g.quarters,
        outsLabel,
        outs,
        btn,
      },
      dates,
    };
  }

  function renderRoadmap() {
    const model = cbamRoadmapModel();
    const org = state.organization?.name || "华星钢铁有限公司";
    const chip = statusChip(
      years[state.year]?.short || `${state.year}`,
      years[state.year]?.chip === "warn" ? "warn" : years[state.year]?.chip === "locked" ? "locked" : ""
    );

    const stageNav = model.stageCards.map((r) => `
      <button type="button" class="road-stage${r.selected ? " is-selected" : ""} is-${r.sc}" data-road-stage="${r.i}" aria-pressed="${r.selected}" ${r.selected ? 'aria-current="step"' : ""}>
        <span class="road-stage__meta"><span class="road-stage__n">${r.n}</span><span class="road-stage__st">${safe(r.st)}</span></span>
        <strong class="road-stage__title">${safe(r.t)}</strong>
        <small class="road-stage__when">${safe(r.when)}</small>
      </button>`).join("");

    const detail = model.detail;
    const quarterRows = detail.hasQ
      ? detail.quarters.map((q) => {
        const activeQ = q.live && state.quarter === q.q;
        /* 只用 data-quarter，避免与通用 [data-page] 抢先处理导致未切季度 */
        const attrs = q.live
          ? `data-quarter="${q.q}" data-page-target="data" type="button"`
          : `type="button" disabled aria-disabled="true"`;
        return `
          <button class="road-q${activeQ ? " is-active" : ""}${q.live ? "" : " is-disabled"}" ${attrs}>
            <b class="road-q__q">${q.q}</b>
            <span class="road-q__d">${safe(q.d)}</span>
            <span class="status-chip ${q.chip === "ok" ? "" : q.chip}">${safe(q.st)}</span>
            <span class="road-q__go">${q.live ? "季度数据 →" : ""}</span>
          </button>`;
      }).join("")
      : "";

    const outRows = detail.hasOuts
      ? `<div class="road-outs">
          <small>${safe(detail.outsLabel)}</small>
          ${detail.outs.map((x) => `
            <span class="road-out${x.done ? " is-done" : ""}">
              <span class="road-out__mark" aria-hidden="true">${x.done ? "✓" : ""}</span>
              <span>${safe(x.t)}</span>
            </span>`).join("")}
        </div>`
      : "";

    let btnHtml = "";
    if (detail.btn) {
      if (detail.btn.page) {
        btnHtml = `<div class="road-detail__foot"><button type="button" class="button button--secondary" data-page="${detail.btn.page}">${safe(detail.btn.label)}</button></div>`;
      } else if (detail.btn.action) {
        btnHtml = `<div class="road-detail__foot"><button type="button" class="button button--secondary" data-road-action="${detail.btn.action}">${safe(detail.btn.label)}</button></div>`;
      }
    }

    const dateRows = model.dates.map((d) => `
      <div class="road-date${d.hot ? " is-hot" : ""}">
        <b>${safe(d.d)}</b>
        <span>${safe(d.t)}</span>
      </div>`).join("");

    $("#main").innerHTML = `
      ${pageHeader(`${safe(org)} / CBAM`, "全年流程", `<div class="head-actions">${window.LuminoAgentRuntime?.agentPageAction?.() || ""}${chip}</div>`)}
      <section class="road-page" aria-label="全年流程">
        <nav class="road-stages" aria-label="五个阶段">${stageNav}</nav>
        <div class="road-body">
          <article class="road-detail panel">
            <header class="road-detail__head">
              <div class="road-detail__eyebrow">
                <small>阶段 ${detail.n} · ${safe(detail.when)}</small>
                <span class="status-chip ${detail.chip === "ok" ? "" : detail.chip}">${safe(detail.st)}</span>
              </div>
              <strong class="road-detail__title">${safe(detail.t)}</strong>
              <p class="road-detail__desc">${safe(detail.d)}</p>
            </header>
            <dl class="road-detail__kv">
              <div><dt>负责</dt><dd>${safe(detail.who)}</dd></div>
              <div><dt>${safe(detail.metaK)}</dt><dd>${safe(detail.metaV)}</dd></div>
            </dl>
            ${quarterRows ? `<div class="road-qs" role="list">${quarterRows}</div>` : ""}
            ${outRows}
            ${btnHtml}
          </article>
          <aside class="road-dates panel">
            <div class="panel-head"><h2>关键日期</h2></div>
            <div class="road-dates__list">${dateRows}</div>
            <p class="road-dates__note">进口商的年度申报由进口商完成，截止日期以欧盟规定为准。</p>
          </aside>
        </div>
      </section>`;
  }

  function cbamDataModel() {
    const energyDone = state.uploadAdded && state.factConfirmed;
    const energyReview = state.uploadAdded && !state.factConfirmed;
    const outputDone = Boolean(state.outputConfirmed);
    const fndOk = Boolean(state.findingResolved);
    const tone = (label, kind) => {
      if (kind === "ok") return { state: label, tone: "", go: "详情" };
      if (kind === "warn") return { state: label, tone: "warn", go: kind === "warn" && label.includes("待确认") ? "核对 →" : "查看" };
      if (kind === "danger") return { state: label, tone: "danger", go: label.includes("缺") ? "上传 →" : "处理 →" };
      return { state: label, tone: "locked", go: label.includes("补充") ? "上传 →" : "查看" };
    };
    const energySt = energyDone
      ? { ...tone("已确认", "ok"), src: "电力账单 · 天然气计量表", v: "12,480 MWh", vc: "", open: "" }
      : energyReview
        ? { ...tone("待确认", "warn"), go: "核对 →", src: "Agent 提取 · 2 份文件", v: "…", vc: "is-warn", open: 'data-drawer="extract-energy"' }
        : { ...tone("缺材料", "danger"), go: "上传 →", src: "未上传", v: "—", vc: "is-muted", open: 'data-action="mock-upload"' };
    const outSt = outputDone
      ? { ...tone("已确认", "ok"), src: "生产月报 7–9 月.xlsx", v: "38,400 t", vc: "", open: "" }
      : { ...tone("待确认", "warn"), go: "核对 →", src: "Agent 提取 · 生产月报 7–9 月", v: "38,400 t", vc: "is-warn", open: 'data-drawer="extract-output"' };
    const preSt = fndOk
      ? { ...tone("默认值 · 复核中", "warn"), go: "查看", src: "EU 默认值表 3", v: "1.85 tCO₂e/t", vc: "is-warn", open: 'data-action="resolve-finding"' }
      : { ...tone("缺口 · 逾期 3 天", "danger"), go: "处理 →", src: "北方特钢 · 未提供", v: "—", vc: "is-muted", open: 'data-action="resolve-finding"' };
    const dieselSt = state.dieselDone
      ? { ...tone("已确认", "ok"), src: "叉车柴油台账 Q3", v: "6.2 t", vc: "", open: "" }
      : { ...tone("建议补充", "locked"), go: "上传 →", src: "未提供", v: "—", vc: "is-muted", open: 'data-action="mock-upload"' };

    const mk = (id, cat, name, req, st) => ({
      id, cat, name, req, src: st.src, v: st.v, state: st.state, tone: st.tone, go: st.go, vc: st.vc || "",
      attrs: st.open || `data-drawer="cbam-data-item" data-item-id="${id}"`,
      danger: st.tone === "danger",
    });

    const groups = [
      {
        id: "output", label: "产量", note: "计算分母",
        items: [
          mk("out-qty", "产量", "热轧非合金钢卷 · Q3 产量", "必填 · 按产品", outSt),
          mk("out-cn", "产量", "产品 CN Code", "必填 · 产品主档", { ...tone("已确认", "ok"), src: "产品主档 v2", v: "7208 39 00", vc: "", open: "" }),
        ],
      },
      {
        id: "energy", label: "能源", note: "直接与间接排放",
        items: [
          mk("en-power", "能源", "购入电力", "必填 · 按月", { ...energySt, v: energyDone ? "12,480 MWh" : energySt.v }),
          mk("en-gas", "能源", "天然气", "必填 · 季度汇总", { ...energySt, v: energyDone ? "1.86 百万 m³" : energySt.v }),
          mk("en-diesel", "能源", "厂内运输柴油", "可选 · Agent 建议补充", dieselSt),
        ],
      },
      {
        id: "ship", label: "发运", note: "出口至欧盟",
        items: [
          mk("ship-nord", "发运", "发往 NordWerk GmbH", "必填 · 按进口商", { ...tone("已确认", "ok"), src: "发运台账 Q3", v: "12,000 t", vc: "", open: "" }),
          mk("ship-docs", "发运", "报关与提单", "证明材料", { ...tone("已确认", "ok"), src: "3 份文件", v: "3 份", vc: "", open: "" }),
        ],
      },
      {
        id: "pre", label: "前体", note: "钢坯隐含排放",
        items: [
          mk("pre-emiss", "前体", "钢坯实测排放 · 北方特钢", "必填 · 或受控默认值", preSt),
          mk("pre-qty", "前体", "钢坯采购量", "必填", { ...tone("已确认", "ok"), src: "采购台账 Q3", v: "41,000 t", vc: "", open: "" }),
        ],
      },
    ];
    const cat = state.dataCat || "all";
    const all = groups.flatMap((g) => g.items);
    const sum = (items) => {
      const bad = items.filter((i) => i.tone === "danger").length;
      const pend = items.filter((i) => i.tone === "warn").length;
      const done = items.filter((i) => i.state === "已确认").length;
      if (bad) return { state: `${bad} 项缺失`, tone: "danger" };
      if (pend) return { state: `${pend} 项待确认`, tone: "warn" };
      if (done === items.length) return { state: "已齐全", tone: "" };
      return { state: "处理中", tone: "locked" };
    };
    const cats = [{ id: "all", label: "全部", items: all }, ...groups].map((g) => ({
      id: g.id,
      label: g.label,
      count: `${g.items.filter((i) => i.state === "已确认").length} / ${g.items.length}`,
      ...sum(g.items),
      on: cat === g.id,
    }));
    const done = all.filter((i) => i.state === "已确认").length;
    const flow = [
      { n: "1", t: `企业事实 · ${done}/${all.length} 已确认`, d: "Agent 提取后由你确认，原文件不可修改", ok: true },
      { n: "2", t: "Q3 计算 Run", d: !fndOk ? "被前体缺口阻塞" : !energyDone || !outputDone ? "等待能源与产量确认" : "可以运行 · 生成新版本", ok: false },
      { n: "3", t: "NordWerk 数据包", d: "10 月 31 日 · 共享后等待回执", ok: false },
    ];
    return {
      groups: groups.filter((g) => cat === "all" || g.id === cat),
      cats,
      flow,
      next: !energyDone
        ? { kicker: "本季度数据 · 下一步", title: energyReview ? "核对 Q3 能源用量" : "上传 Q3 能源材料", desc: energyReview ? "Agent 已提取电力与天然气用量，确认后写入企业事实。" : "上传电力账单与天然气计量表，Agent 提取后由你确认。", label: energyReview ? "去核对" : "上传材料", attrs: energyReview ? 'data-drawer="extract-energy"' : 'data-action="mock-upload"' }
        : !outputDone
          ? { kicker: "本季度数据 · 下一步", title: "确认 Q3 产量提取结果", desc: "产量确认后用于计算分母，并更新发往欧盟的数量口径。", label: "去确认", attrs: 'data-drawer="extract-output"' }
          : !fndOk
            ? { kicker: "本季度数据 · 下一步", title: "处理前体排放数据缺口", desc: "选择受控默认值或继续等待供应商，才能解锁 Q3 计算。", label: "选择处理路径", attrs: 'data-action="resolve-finding"' }
            : { kicker: "本季度数据 · 下一步", title: "去计算与成本重新计算", desc: "能源、产量与前体路径已确认，可锁定输入生成 Run-0418。", label: "去计算", attrs: 'data-page="results"' },
    };
  }

  function renderData() {
    const profile = annualProfile();
    const org = state.organization?.name || "华星钢铁";
    const chip = statusChip(`${state.year} · ${years[state.year]?.short || profile.position}`, years[state.year]?.chip === "warn" ? "warn" : years[state.year]?.chip === "locked" ? "locked" : "");
    if (state.role === "customer_contrib") {
      $("#main").innerHTML = `
        ${pageHeader(`${org} / CBAM`, "我的材料", statusChip("上海一厂 · 限定范围"))}
        <div class="privacy-band"><strong>最小可见范围</strong><span>这里仅显示分配给你的设施与材料。其他设施、供应商和完整计算结果保持隐藏。</span></div>
        <section class="panel wide-panel"><div class="panel-head"><h2>${state.quarter} 我负责的材料</h2><button class="button button--primary" type="button" data-action="mock-upload">上传材料</button></div><div class="record-list"><article class="record"><span class="record-code">BILL</span><div><strong>上海一厂电力账单 · ${quarterMeta[state.quarter].months}</strong><p>已解析 3/3 · 等待项目协调人确认</p></div><span class="record-state ok">已上传</span></article><article class="record"><span class="record-code">GAS</span><div><strong>上海一厂天然气账单 · ${quarterMeta[state.quarter].endMonth}</strong><p>今天到期</p></div><span class="record-state warn">待上传</span></article></div></section>`;
      return;
    }
    if (profile.mode !== "active" || state.year !== "2026") {
      $("#main").innerHTML = `
        <div class="cbam-data" data-template="T2">
          ${pageHeader(`${org} / CBAM`, "季度数据", `<div class="head-actions">${window.LuminoAgentRuntime?.agentPageAction?.() || ""}${chip}</div>`)}
          <section class="cbam-work__state" aria-label="年度季度数据">
            <strong>${state.year === "2025" ? "2025 年度季度数据已封存" : `${state.year} 年度尚无季度数据`}</strong>
            <p>${state.year === "2025" ? "Q1–Q4 数据已随年度快照锁定，只读查看；更正需在「当前工作」创建更正修订。" : "季度数据会在该年度 Q1 开始后逐季产生，不从上一年度复制。"}</p>
            <div class="cbam-work__state-actions">
              <button class="button button--secondary" type="button" data-action="enter-program" data-year="2026">切换到 2026 · Q3</button>
            </div>
          </section>
        </div>`;
      return;
    }

    const model = cbamDataModel();
    $("#main").innerHTML = `
      <div class="cbam-data" data-template="T2">
        ${pageHeader(`${org} / CBAM`, "季度数据", `<div class="head-actions">${window.LuminoAgentRuntime?.agentPageAction?.() || ""}${chip}<button class="button button--secondary" type="button" data-action="mock-upload">上传材料</button></div>`)}
        ${goldenPathBanner("p06")}
        <div class="cbam-data__cats" role="tablist" aria-label="数据类别">
          ${model.cats.map((c) => `
            <button type="button" role="tab" class="cbam-data__cat ${c.on ? "is-on" : ""}" aria-selected="${c.on}" data-data-cat="${safe(c.id)}">
              <span><strong>${safe(c.label)}</strong><small>${safe(c.count)}</small></span>
              <em class="${c.tone}"><i aria-hidden="true"></i>${safe(c.state)}</em>
            </button>`).join("")}
        </div>
        <div class="cbam-data__body">
          <section class="cbam-data__table ds-card" aria-label="季度数据项">
            <div class="cbam-data__head" role="row">
              <span>数据项</span><span>来源</span><span>Q3 数值</span><span>状态</span><span></span>
            </div>
            ${model.groups.map((g) => `
              <div class="cbam-data__group">
                <div class="cbam-data__group-head"><span>${safe(g.label)}</span><small>${safe(g.note)}</small></div>
                ${g.items.map((d) => `
                  <button type="button" class="cbam-data__row ${d.danger ? "is-danger" : ""}" ${d.attrs}>
                    <span class="cbam-data__name"><strong>${safe(d.name)}</strong><small>${safe(d.req)}</small></span>
                    <span class="cbam-data__src" title="${safe(d.src)}">${safe(d.src)}</span>
                    <span class="cbam-data__val ${d.vc}">${safe(d.v)}</span>
                    <span class="status-chip ${d.tone}">${safe(d.state)}</span>
                    <span class="cbam-work__go">${safe(d.go)}</span>
                  </button>`).join("")}
              </div>`).join("")}
          </section>
          <aside class="cbam-data__aside" aria-label="确认后流向">
            <section class="cbam-data__flow">
              <strong>确认后流向</strong>
              <ol>${model.flow.map((f) => `
                <li>
                  <span class="${f.ok ? "is-ok" : ""}">${safe(f.n)}</span>
                  <div><b>${safe(f.t)}</b><small>${safe(f.d)}</small></div>
                </li>`).join("")}</ol>
            </section>
            <p class="cbam-data__note">季度数据不跨年度复制。切换到 Q1、Q2 可查看已回执的数据包；产品、设施与 CN Code 在「产品与工厂」维护。</p>
          </aside>
        </div>
        ${nextAction(model.next.kicker, model.next.title, model.next.desc, model.next.label, model.next.attrs)}
      </div>`;
  }

  function cbamProductCatalog() {
    const fromAssets = {};
    assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role, type: "product" }).forEach((asset) => {
      const key = asset.payload?.uiKey || asset.payload?.internalCode?.toLowerCase() || asset.id;
      fromAssets[key] = {
        code: asset.payload?.internalCode || asset.id,
        name: asset.name,
        cn: asset.payload?.cnLabel || (asset.payload?.cnCodes?.length ? `CN ${asset.payload.cnCodes.join(" / ")}` : "CN Code 待确认"),
        summary: asset.payload?.summary || "生产配置待完善",
        scope: asset.payload?.scopeYears || ["2026"],
        assetId: asset.id,
        versionId: asset.versionId,
        status: asset.status,
      };
    });
    return {
      hrc: fromAssets.hrc || { code: "HRC-01", name: "热轧非合金钢卷", cn: "CN 待确认", summary: "待同步资产池", scope: ["2026"] },
      coated: fromAssets.coated || { code: "CTS-01", name: "镀层钢板", cn: "CN 待确认", summary: "待同步资产池", scope: ["2026"] },
      section: fromAssets.section || { code: "SEC-01", name: "型钢", cn: "CN 待确认", summary: "待同步资产池", scope: ["2026"] },
      wire: fromAssets.wire || { code: "WRD-01", name: "非合金钢盘条", cn: "CN 待确认", summary: "待同步资产池", scope: ["2026"] },
      cold: { code: "CRS-02", name: "冷轧非合金钢板", cn: state.productCnCodes.length ? `CN ${state.productCnCodes.join(" / ")} · 候选待确认` : "CN Code 尚未设置 · 可由 Agent 建议", summary: "尚未添加生产配置", scope: state.productYears },
      ...fromAssets,
    };
  }

  function cbamFacilityOptions() {
    return assetRegistry.catalog({ tenantId: "TNT-0018", role: state.role, type: "facility" });
  }

  /**
   * 产品与工厂（对齐原型 v3）
   * — 出口产品范围表 + 生产配置流程链 + 设施卡
   */
  function cbamProductsModel() {
    const year = String(state.year);
    const pd = state.prodDec || {};
    const locked = year === "2025";
    const scopeLabel = `${year} 范围`;

    const PRODS = [
      { id: "p1", name: "热轧非合金钢卷", cn: "7208 39 00", fac: "上海一厂", route: "热轧", pre: "钢坯 · 北方特钢", qty: "46,800 t", src: "发运台账 · 报关单 42 份" },
      { id: "p2", name: "冷轧薄板", cn: "7209 17 90", fac: "上海一厂", route: "酸洗冷轧", pre: "热轧卷 · 厂内", qty: "0 t", src: "报关单 11 份 · 均发往东南亚" },
      { id: "p3", name: "热镀锌板", cn: "7210 49 00", fac: "上海一厂", route: "热镀锌（待确认）", pre: "冷轧卷 · 厂内", qty: "180 t", src: "9 月报关单 1 份 · 首次出现", cand: true },
    ];

    const rows = PRODS.map((p) => {
      const dec = locked ? null : pd[p.id];
      const ask = Boolean(p.cand) && !dec && !locked;
      let stateLabel;
      let chip;
      if (dec === "in") {
        stateLabel = p.cand ? "已纳入 · 专家确认中" : "纳入";
        chip = "ok";
      } else if (dec === "out") {
        stateLabel = "不纳入 · 已记录理由";
        chip = "locked";
      } else if (p.id === "p1") {
        stateLabel = locked ? "纳入 · 已封存" : "纳入";
        chip = "ok";
      } else if (p.id === "p2") {
        stateLabel = "不纳入 · 无出口欧盟";
        chip = "locked";
      } else {
        stateLabel = "待判断";
        chip = "warn";
      }
      return {
        ...p,
        ask,
        settled: !ask,
        stateLabel,
        chip,
        pending: ask,
        drawerDesc: `生产设施：${p.fac}，工序：${p.route}；前体：${p.pre}。近 12 个月出口欧盟 ${p.qty}，来源：${p.src}。产品主档跨年度使用，修改会生成新版本；已锁定的季度计算继续引用旧版本。`,
      };
    });

    const nIn = PRODS.filter((p) => {
      if (locked) return p.id === "p1";
      return pd[p.id] === "in" || (!pd[p.id] && p.id === "p1");
    }).length;
    const prodCount = `${nIn} 项在 ${year} 范围 · ${PRODS.length} 项已识别`;

    const intro = year === "2025"
      ? "2025 年度引用的产品与生产配置已随年度快照封存，以下为当前主档，供对照。"
      : year === "2027"
        ? "产品与设施是跨年度主档。确认 2027 范围前，以下显示当前主档与待继承项；修改会生成新版本。"
        : "产品与设施是跨年度主档，2026 年度项目引用其中的产品与生产配置。修改会生成新版本，已锁定的季度计算不受影响。";

    const pendingP3 = !pd.p3 && year === "2026";
    const agentNote = pendingP3
      ? "9 月 18 日的报关单出现 CN 7210 49 00（热镀锌板，180 t），不在 2026 年度范围内。纳入后需要补充镀锌工序的能源数据；如果是贸易转口，请选择不纳入。"
      : null;

    const node = (k, t, kind) => {
      const kinds = {
        pre: { kind: "pre" },
        proc: { kind: "proc" },
        prod: { kind: "prod" },
        out: { kind: "out" },
        pend: { kind: "pend" },
      };
      return { k, t, ...(kinds[kind] || kinds.proc) };
    };
    const withArrows = (list) => list.map((n, i) => ({ ...n, arrow: i < list.length - 1 }));
    const p3in = !locked && pd.p3 === "in";
    const p3out = !locked && pd.p3 === "out";
    const routes = [
      {
        t: "热轧线",
        note: "天然气与电力在加热炉、轧机分别计量",
        nodes: withArrows([
          node("前体 · 外购", "钢坯 · 北方特钢", "pre"),
          node("工序", "加热炉 + 热轧", "proc"),
          node("CBAM · 7208", "热轧非合金钢卷", "prod"),
        ]),
      },
      {
        t: "冷轧与镀锌线",
        note: "共用电力，需按产线分摊",
        nodes: withArrows([
          node("前体 · 厂内", "热轧卷", "pre"),
          node("工序", "酸洗 + 冷轧", "proc"),
          node("不在范围 · 7209", "冷轧薄板", "out"),
          node("工序", "热镀锌", "proc"),
          node(
            p3in ? "CBAM · 7210" : p3out ? "不在范围 · 7210" : "候选 · 7210",
            "热镀锌板",
            p3in ? "prod" : p3out ? "out" : "pend"
          ),
        ]),
      },
    ];

    const facRows = [
      {
        name: "上海一厂",
        code: "FAC-HX-SH01 · v4",
        proc: "热轧、酸洗冷轧、热镀锌",
        scope: "CBAM 与 PCF 共用此主档",
        st: year === "2027" ? "继承主档 · 待确认" : "在范围",
        chip: year === "2027" ? "warn" : "ok",
      },
      {
        name: "无锡二厂",
        code: "FAC-HX-WX02 · v2",
        proc: "精整与仓储",
        scope: "不生产出口欧盟产品",
        st: "不在范围",
        chip: "locked",
      },
    ];

    return {
      year,
      locked,
      scopeLabel,
      intro,
      prodCount,
      rows,
      agentNote,
      routes,
      facRows,
      nextPending: pendingP3,
    };
  }

  function renderProducts() {
    const model = cbamProductsModel();
    const org = state.organization?.name || "华星钢铁有限公司";
    const chip = statusChip(
      years[state.year]?.short || `${state.year}`,
      years[state.year]?.chip === "warn" ? "warn" : years[state.year]?.chip === "locked" ? "locked" : ""
    );

    const productRows = model.rows.map((p) => `
      <div class="prod-row${p.pending ? " is-pending" : ""}">
        <div class="prod-row__name">
          <button type="button" class="prod-row__link"
            data-drawer="record-detail"
            data-drawer-eyebrow="产品主档 · CN ${safe(p.cn)}"
            data-drawer-label="${safe(p.name)}"
            data-drawer-object="${safe(p.fac)} · ${safe(p.route)}"
            data-drawer-status="${safe(p.stateLabel)}"
            data-drawer-description="${safe(p.drawerDesc)}">${safe(p.name)}</button>
          <small><b>${safe(p.qty)}</b> · ${safe(p.src)}</small>
        </div>
        <span class="prod-row__cn">${safe(p.cn)}</span>
        <div class="prod-row__cfg">
          <span>${safe(p.fac)} · ${safe(p.route)}</span>
          <small>前体：${safe(p.pre)}</small>
        </div>
        <div class="prod-row__scope">
          ${p.ask ? `
            <button type="button" class="button button--primary button--sm" data-prod-decide="in" data-prod-id="${p.id}">纳入范围</button>
            <button type="button" class="button button--secondary button--sm" data-prod-decide="out" data-prod-id="${p.id}">不纳入</button>
          ` : `<span class="status-chip ${p.chip === "ok" ? "" : p.chip}">${safe(p.stateLabel)}</span>`}
        </div>
      </div>`).join("");

    const routeBlocks = model.routes.map((rt) => `
      <div class="prod-route">
        <div class="prod-route__head">
          <strong>${safe(rt.t)}</strong>
          <small>${safe(rt.note)}</small>
        </div>
        <div class="prod-route__nodes">
          ${rt.nodes.map((n) => `
            <span class="prod-node is-${n.kind}">
              <small>${safe(n.k)}</small>
              <span>${safe(n.t)}</span>
            </span>
            ${n.arrow ? '<span class="prod-node__arrow" aria-hidden="true">→</span>' : ""}
          `).join("")}
        </div>
      </div>`).join("");

    const facBlocks = model.facRows.map((f) => `
      <div class="prod-fac">
        <div class="prod-fac__top">
          <strong>${safe(f.name)}</strong>
          <span class="status-chip ${f.chip === "ok" ? "" : f.chip}">${safe(f.st)}</span>
        </div>
        <small class="prod-fac__code">${safe(f.code)}</small>
        <span class="prod-fac__proc">${safe(f.proc)}</span>
        <span class="prod-fac__scope">${safe(f.scope)}</span>
      </div>`).join("");

    const agentBar = model.agentNote
      ? `<div class="prod-agent" role="note"><b>AGENT</b><span>${safe(model.agentNote)}</span></div>`
      : "";

    const next = model.locked
      ? ""
      : model.nextPending
        ? nextAction(
          "当前任务 · 产品范围",
          "判断热镀锌板是否纳入 2026",
          "Agent 从 9 月报关单识别出新 CN。纳入需补镀锌能源数据；贸易转口可选不纳入。",
          "查看待判断项",
          'data-prod-scroll="pending"',
          "secondary"
        )
        : nextAction(
          "当前任务 · 范围已核对",
          "继续季度数据采集",
          "产品与生产配置范围明确后，按监测计划收集本季材料。",
          "前往季度数据",
          'data-page="data"',
          "secondary"
        );

    $("#main").innerHTML = `
      ${pageHeader(`${safe(org)} / CBAM`, "产品与工厂", `<div class="head-actions">${window.LuminoAgentRuntime?.agentPageAction?.() || ""}${chip}</div>`)}
      <section class="prod-page" aria-label="产品与工厂">
        <p class="prod-intro">${safe(model.intro)}</p>

        <section class="panel prod-table">
          <div class="panel-head">
            <h2>出口欧盟的产品</h2>
            <small>${safe(model.prodCount)}</small>
          </div>
          <div class="prod-table__head" aria-hidden="true">
            <span>产品 · 近 12 月出口欧盟</span>
            <span>CN Code</span>
            <span>生产配置 · 前体</span>
            <span>${safe(model.scopeLabel)}</span>
          </div>
          <div class="prod-table__body">${productRows}</div>
          ${agentBar}
        </section>

        <div class="prod-split">
          <section class="panel prod-routes">
            <div class="panel-head">
              <h2>生产配置 · 上海一厂</h2>
              <small>决定排放如何归属到产品</small>
            </div>
            ${routeBlocks}
          </section>
          <section class="panel prod-facilities">
            <div class="panel-head">
              <h2>设施</h2>
              <button type="button" class="text-button" data-prod-action="facilities">企业设置中管理 →</button>
            </div>
            ${facBlocks}
          </section>
        </div>
        ${next}
      </section>`;
  }

  function cbamCalcStatus() {
    const energyDone = state.uploadAdded && state.factConfirmed;
    const outputDone = Boolean(state.outputConfirmed);
    if (state.findingResolved && energyDone && outputDone) return "current";
    if (energyDone && outputDone && !state.findingResolved) return "blocked";
    return "partial";
  }

  function renderResults() {
    const profile = annualProfile();
    const org = state.organization?.name || "华星钢铁";
    const chip = statusChip(`${state.year} · ${years[state.year]?.short || profile.position}`, years[state.year]?.chip === "warn" ? "warn" : years[state.year]?.chip === "locked" ? "locked" : "");
    if (profile.mode !== "active" || state.year !== "2026") {
      $("#main").innerHTML = `
        <div class="cbam-results" data-template="T5">
          ${pageHeader(`${org} / CBAM`, "计算与成本", `<div class="head-actions">${window.LuminoAgentRuntime?.agentPageAction?.() || ""}${chip}</div>`)}
          <section class="cbam-work__state" aria-label="年度计算结果">
            <strong>${state.year === "2025" ? "2025 计算结果已锁定在年度快照中" : `${state.year} 尚无计算结果`}</strong>
            <p>计算结果随年度切换；2025 的计算版本已锁定，2027 尚无计算。可切换到 2026 · Q3 查看当前演示情景。</p>
            <div class="cbam-work__state-actions">
              <button class="button button--secondary" type="button" data-action="enter-program" data-year="2026">切换到 2026 · Q3</button>
            </div>
          </section>
        </div>`;
      return;
    }

    const st = cbamCalcStatus();
    const pathLabels = { parallel: "供应商请求 + 默认值并行", supplier: "等待供应商实测数据", conservative: "本期采用保守默认值" };
    const decisionPanel = state.findingChoiceOpen && !state.findingResolved ? `<section class="panel decision-panel"><div class="decision-copy"><small>PATH DECISION · GAP-PRE-004</small><h2>钢坯数据暂时怎么处理？</h2><p>这项决定只影响当前计算版本，不会停止向供应商索取实测数据，也可以在新证据通过后撤回。</p></div><div class="decision-options" role="group" aria-label="选择数据处理路径"><button type="button" class="decision-option ${state.dataPathChoice === "parallel" ? "selected" : ""}" data-path-choice="parallel" aria-pressed="${state.dataPathChoice === "parallel"}"><strong>建议：两条路径并行</strong><span>先用默认值保持进度，同时继续追踪供应商数据</span></button><button type="button" class="decision-option ${state.dataPathChoice === "supplier" ? "selected" : ""}" data-path-choice="supplier" aria-pressed="${state.dataPathChoice === "supplier"}"><strong>等待供应商数据</strong><span>结果更完整，但当前核算和交付会继续等待</span></button><button type="button" class="decision-option ${state.dataPathChoice === "conservative" ? "selected" : ""}" data-path-choice="conservative" aria-pressed="${state.dataPathChoice === "conservative"}"><strong>本期使用默认值</strong><span>最快形成结果，预计证书成本最高</span></button></div><div class="decision-footer"><button class="button button--secondary" type="button" data-action="close-path-choice">暂不决定</button><button class="button button--primary" type="button" data-action="confirm-data-path" ${state.dataPathChoice ? "" : "disabled"}>确认${state.dataPathChoice ? `：${pathLabels[state.dataPathChoice]}` : "处理路径"}</button></div></section>` : "";

    const energyDone = state.uploadAdded && state.factConfirmed;
    const outputDone = Boolean(state.outputConfirmed);
    const blockers = [
      energyDone
        ? { k: "Q3 能源用量", d: "已确认", done: true, go: "", attrs: "", diff: "电力 v2 → v3", mark: "✓", danger: false }
        : state.uploadAdded
          ? { k: "Q3 能源用量", d: "待你确认", done: false, go: "去确认 →", attrs: 'data-page="data"', diff: "", mark: "", danger: false }
          : { k: "Q3 能源用量", d: "未上传", done: false, go: "去处理 →", attrs: 'data-page="data"', diff: "", mark: "", danger: false },
      outputDone
        ? { k: "Q3 产量", d: "已确认", done: true, go: "", attrs: "", diff: "预估 38,000 → 38,400 t", mark: "✓", danger: false }
        : { k: "Q3 产量", d: "Agent 已提取，待你确认", done: false, go: "去确认 →", attrs: 'data-drawer="extract-output"', diff: "", mark: "", danger: false },
      state.findingResolved
        ? { k: "前体排放", d: "受控默认值 · 专家复核中", done: true, go: "", attrs: "", diff: "默认值 1.85", mark: "✓", danger: false }
        : { k: "前体排放", d: "缺口未处理，计算无法运行", done: false, go: "去处理 →", attrs: 'data-action="resolve-finding"', diff: "", mark: "!", danger: true },
    ];
    const runMeta = {
      partial: {
        id: "Run-0412", state: "预估 · 数据未齐", tone: "warn",
        title: "Q3 数据尚未齐全，当前为预估结果",
        desc: "Run-0412 基于 10 月 15 日的电力 v2 与预估产量。完成下列确认后即可重新计算。",
        top: "ink", btn: null,
      },
      blocked: {
        id: "Run-0412", state: "被阻塞", tone: "danger",
        title: "前体缺口未处理，无法运行新计算",
        desc: "能源与产量已确认。先为前体排放选择处理路径，计算才能锁定全部输入。",
        top: "danger",
        btn: { label: "选择处理路径", attrs: 'data-action="resolve-finding"', primary: true },
      },
      current: {
        id: "Run-0418", state: "当前 · 专家复核中", tone: "",
        title: "Q3 计算已更新",
        desc: "结果已提交 Lumino 专家王晨复核，复核通过后写入 Q3 数据包。",
        top: "green",
        btn: { label: "去完成数据包", attrs: 'data-page="work"', primary: false },
      },
    }[st];
    const fresh = st === "current";
    const ind = fresh ? "0.38" : "0.37";
    const scenarios = [
      { name: "纯默认值", tag: "参考口径", tone: "locked", applied: false, pending: false, d: "0.30", i: "0.45", p: "1.85", total: "2.60" },
      { name: "前体默认 + 自身实测", tag: "当前适用", tone: "", applied: true, pending: false, d: "0.21", i: ind, p: "1.85", total: (0.21 + Number(ind) + 1.85).toFixed(2) },
      { name: "全链路实测", tag: "需供应商数据", tone: "warn", applied: false, pending: true, d: "0.21", i: ind, p: "1.52", total: (0.21 + Number(ind) + 1.52).toFixed(2) },
    ];
    const price = 82.32;
    const exportT = 12000;
    const cost = (total) => {
      const v = Number(total) * exportT * price;
      return `€${(v / 10000).toFixed(1)} 万`;
    };
    const baseCost = Number(scenarios[0].total) * exportT * price;
    const scenarioRows = [
      ["直接排放", "tCO₂e / t 产品", scenarios.map((c) => ({ t: Number(c.d).toFixed(2) }))],
      ["间接排放 · 电力", "tCO₂e / t 产品", scenarios.map((c) => ({ t: Number(c.i).toFixed(2), note: c.name === "纯默认值" ? "" : (fresh ? "电力 v3" : "电力 v2 · 已过期"), noteWarn: !fresh && c.name !== "纯默认值" }))],
      ["前体排放 · 钢坯", "tCO₂e / t 产品", scenarios.map((c) => ({ t: Number(c.p).toFixed(2), note: c.pending ? "待核查 · 供应商估计值" : "EU 默认值表 3", noteWarn: c.pending }))],
      ["隐含排放合计", "tCO₂e / t 产品", scenarios.map((c) => ({ t: c.total })), true],
      ["Q3 出口隐含排放", "tCO₂e · × 12,000 t", scenarios.map((c) => ({ t: Math.round(Number(c.total) * exportT).toLocaleString("en-US") })), false],
      ["预估证书成本", "€82.32 / tCO₂e", scenarios.map((c, i) => {
        const v = Number(c.total) * exportT * price;
        const delta = v - baseCost;
        return { t: cost(c.total), note: i === 0 ? "基准" : `较默认 −€${(Math.abs(delta) / 10000).toFixed(1)} 万`, noteWarn: c.pending, noteOk: !c.pending && i > 0 };
      }), true],
    ];

    const runHistory = [
      ...(fresh ? [{ id: "Run-0418", t: "Q3 正式输入 · 电力 v3、产量 v1、前体默认值", d: "今天 · 周岚 发起", state: "当前 · 复核中", tone: "" }] : []),
      { id: "Run-0412", t: "Q3 中期 · 电力 v2、产量预估", d: "10 月 15 日 · 周岚 发起", state: fresh ? "已被替代" : "预估", tone: fresh ? "locked" : "warn" },
      { id: "Run-0405", t: "Q3 首次预估 · 仅 7 月数据", d: "9 月 30 日 · Agent 自动", state: "已被替代", tone: "locked" },
    ];

    $("#main").innerHTML = `
      <div class="cbam-results" data-template="T5">
        ${pageHeader(`${org} / CBAM`, "计算与成本", `<div class="head-actions">${window.LuminoAgentRuntime?.agentPageAction?.() || ""}${chip}</div>`)}
        ${goldenPathBanner("p07")}
        ${decisionPanel}
        <section class="cbam-run ${runMeta.top === "danger" ? "cbam-run--danger" : runMeta.top === "green" ? "cbam-run--ok" : ""}" aria-label="当前计算版本">
          <div class="cbam-run__head">
            <div class="cbam-run__copy">
              <span class="cbam-run__meta"><small>当前计算版本</small><b>${runMeta.id}</b><span class="status-chip ${runMeta.tone}">${runMeta.state}</span></span>
              <strong>${runMeta.title}</strong>
              <span>${runMeta.desc}</span>
            </div>
            ${runMeta.btn ? `<button class="button button--${runMeta.btn.primary ? "primary" : "secondary"}" type="button" ${runMeta.btn.attrs}>${runMeta.btn.label}<span aria-hidden="true">→</span></button>` : ""}
          </div>
          ${st === "current" ? "" : `<ul class="cbam-run__blockers">${blockers.map((r) => `
            <li>
              <button type="button" class="cbam-run__blocker" ${r.attrs || "disabled"}>
                <span class="cbam-run__dot ${r.done ? "is-done" : r.danger ? "is-danger" : ""}" aria-hidden="true">${safe(r.mark)}</span>
                <span class="cbam-run__blocker-copy"><strong>${safe(r.k)}</strong><small>${safe(r.d)}</small></span>
                <span class="cbam-run__diff">${safe(r.diff)}</span>
                <span class="cbam-work__go">${safe(r.go)}</span>
              </button>
            </li>`).join("")}</ul>`}
        </section>

        <section class="cbam-scenario ds-card" aria-label="三情景对比">
          <header class="ds-card__head">
            <h2>三情景同口径对比 · 热轧非合金钢卷 · 出口 12,000 t</h2>
            <span>${fresh ? "基于 Run-0418" : "基于 Run-0412 · 输入已更新，数值可能变化"}</span>
          </header>
          <div class="cbam-scenario__grid" role="table">
            <div class="cbam-scenario__corner" role="columnheader">口径</div>
            ${scenarios.map((c) => `<div class="cbam-scenario__colhead ${c.applied ? "is-applied" : ""}" role="columnheader"><strong>${safe(c.name)}</strong><span class="status-chip ${c.tone}">${safe(c.tag)}</span></div>`).join("")}
            ${scenarioRows.map(([k, unit, cells, emph]) => `
              <div class="cbam-scenario__label ${emph ? "is-emph" : ""}" role="rowheader"><span>${safe(k)}</span><small>${safe(unit)}</small></div>
              ${cells.map((cell, i) => `<div class="cbam-scenario__cell ${scenarios[i].applied ? "is-applied" : ""} ${emph ? "is-emph" : ""}" role="cell"><strong>${safe(cell.t)}</strong>${cell.note ? `<small class="${cell.noteWarn ? "is-warn" : cell.noteOk ? "is-ok" : ""}">${safe(cell.note)}</small>` : ""}</div>`).join("")}
            `).join("")}
          </div>
          <p class="cbam-scenario__note">证书价格采用 2026 Q3 €82.32 / tCO₂e（季度价格），未扣除免费配额与原产国已付碳价。演示数据，不构成报价或合规结论。“待核查”数值依赖尚未确认的供应商数据。</p>
        </section>

        <div class="cbam-results__bottom">
          <section class="cbam-history ds-card" aria-label="计算版本记录">
            <header class="ds-card__head"><h2>计算版本记录</h2><span>新计算生成新版本，不覆盖旧结果</span></header>
            <ul class="cbam-history__list">${runHistory.map((h) => `
              <li>
                <button type="button" class="cbam-history__row" data-drawer="calc-run-detail" data-run-id="${safe(h.id)}" aria-label="查看 ${safe(h.id)} 详情">
                  <b>${safe(h.id)}</b>
                  <span><strong>${safe(h.t)}</strong><small>${safe(h.d)}</small></span>
                  <span class="status-chip ${h.tone}">${safe(h.state)}</span>
                </button>
              </li>`).join("")}</ul>
          </section>
          <aside class="cbam-results__aside" aria-label="页面说明">
            <strong>这一页回答什么</strong>
            <p>当前数据下 Q3 隐含排放是多少、换一种数据路径成本差多少。正式结果需经 Lumino 专家复核后进入数据包。</p>
          </aside>
        </div>
      </div>`;
  }

  function cbamDeliverableGroups() {
    const locked = annualProfile().mode === "archived";
    const planned = annualProfile().mode === "planned";
    const packageObject = workflowEngine.get("PKG-2026-Q3-NORDWERK");
    const packageLabels = { COLLECTING: ["草稿 · 未就绪", "locked"], READY_FOR_REVIEW: ["待复核", "warn"], APPROVED: ["生成中", "warn"], PACKAGE_READY: ["已就绪 · 待共享", "warn"], SHARED: ["已共享 · 待回执", "warn"], ACKNOWLEDGED: ["已回执", ""], FROZEN: ["已封存", ""] };
    const q3State = locked ? ["已回执", ""] : (packageLabels[packageObject?.status] || ["草稿 · 未就绪", "locked"]);
    const quarterly = planned ? [
      { id: "q1", name: `${state.year} Q1 数据包 · 热轧非合金钢卷`, code: "尚未生成", to: "NordWerk GmbH", when: "范围确认后生成", state: "未开始", tone: "locked", go: "详情", dim: true },
    ] : [
      { id: "q3", name: "2026 Q3 数据包 · 热轧非合金钢卷", code: `PKG-2026-Q3-NORDWERK · Rev ${packageObject?.revision || 1}`, to: "NordWerk GmbH · Anna", when: locked ? "已回执" : "本原型不执行对外发送", state: q3State[0], tone: q3State[1], go: packageObject?.status === "PACKAGE_READY" ? "查看待共享版本 →" : "详情", mine: packageObject?.status === "PACKAGE_READY" && !locked },
      { id: "q2", name: "2026 Q2 数据包 · 热轧非合金钢卷", code: "PKG-2026-Q2-NORDWERK · Rev 2", to: "NordWerk GmbH · Anna", when: "8 月 4 日回执", state: "已回执", tone: "", go: "详情" },
      { id: "q1", name: "2026 Q1 数据包 · 热轧非合金钢卷", code: "PKG-2026-Q1-NORDWERK · Rev 1", to: "NordWerk GmbH · Anna", when: "4 月 26 日回执", state: "已回执", tone: "", go: "详情" },
      { id: "q4", name: "2026 Q4 数据包 · 热轧非合金钢卷", code: "PKG-2026-Q4-NORDWERK", to: "NordWerk GmbH", when: "Q4 开始后生成", state: "未开始", tone: "locked", go: "详情", dim: true },
    ];
    const annual = locked ? [
      { id: "aer25", name: "2025 年度排放报告", code: "AER-2025 · Amendment R0", to: "Veritas Climate · 已核查", when: "2026-04-30 锁定", state: "已锁定 · 已核查", tone: "", go: "详情" },
      { id: "ver25", name: "设施核查报告", code: "VER-2025-SH01 · Rev 1", to: "Veritas Climate", when: "2026-04-22", state: "已核查", tone: "", go: "详情" },
    ] : planned ? [
      { id: "mp26", name: `${state.year} 年度监测计划`, code: "尚未生成", to: "内部", when: "范围确认后", state: "未开始", tone: "locked", go: "详情", dim: true },
    ] : [
      { id: "mp26", name: "2026 年度监测计划", code: "MP-2026 · Rev 3", to: "内部 · 已适用", when: "本年度方法已建立", state: "当前适用", tone: "", go: "详情" },
      { id: "aer26", name: "2026 年度排放报告", code: "AER-2026 · 尚未生成", to: "Veritas Climate · 核查", when: "Q4 数据确认后开始", state: "未开始", tone: "locked", go: "详情", dim: true },
      { id: "ver26", name: "设施核查报告", code: "尚未生成", to: "第三方核查员", when: "年度报告批准后", state: "未开始", tone: "locked", go: "详情", dim: true },
    ];
    return [
      { label: "季度数据包 · 发给进口商", note: "每季度一份，按进口商", rows: quarterly },
      { label: "年度报告与核查", note: "年度申报由欧盟申报人完成", rows: annual },
    ];
  }

  function renderDeliverables() {
    const profile = annualProfile();
    const org = state.organization?.name || "华星钢铁";
    const chip = statusChip(`${state.year} · ${years[state.year]?.short || profile.position}`, years[state.year]?.chip === "warn" ? "warn" : years[state.year]?.chip === "locked" ? "locked" : "");
    const groups = cbamDeliverableGroups();
    const states = [
      ["草稿", "locked"],
      ["已就绪", "warn"],
      ["已共享 · 待回执", "warn"],
      ["已回执", ""],
    ];
    $("#main").innerHTML = `
      <div class="cbam-reports" data-template="T2">
        ${pageHeader(`${org} / CBAM`, "报告与交付", `<div class="head-actions">${window.LuminoAgentRuntime?.agentPageAction?.() || ""}${chip}</div>`)}
        ${goldenPathBanner("p08")}
        <p class="shared-legend cbam-reports__legend" role="note">
          <span class="cbam-reports__legend-label">数据包状态</span>
          ${states.map(([t, tone], i) => `<span class="cbam-reports__state"><i class="${tone === "warn" ? "is-warn" : tone === "locked" ? "is-muted" : "is-ok"}"></i>${t}${i < states.length - 1 ? "<em>→</em>" : ""}</span>`).join("")}
          <span class="cbam-reports__legend-note">已共享 ≠ 已接收；回执由进口商确认后才出现</span>
        </p>
        <section class="ds-table shared-list shared-list--deliverables cbam-reports__table" aria-label="CBAM 交付物">
          <table>
            <colgroup><col class="shared-col--svc"><col class="shared-col--main"><col class="shared-col--recipient"><col class="shared-col--state"><col class="shared-col--go"></colgroup>
            <thead><tr><th>服务</th><th>交付物</th><th>接收方 · 更新</th><th>状态</th><th></th></tr></thead>
            <tbody>
              ${groups.map((g) => `
                <tr class="cbam-reports__group"><td colspan="5"><span>${safe(g.label)}</span><small>${safe(g.note)}</small></td></tr>
                ${g.rows.map((d) => `
                  <tr class="shared-row ${d.mine ? "is-mine" : ""} ${d.dim ? "is-dim" : ""}" data-drawer="${d.mine ? "cbam-package" : "cbam-deliv-detail"}" data-deliv-id="${safe(d.id)}" tabindex="0" role="button">
                    <td data-label="服务"><span class="shared-code">CBAM</span></td>
                    <td data-label="交付物"><strong>${safe(d.name)}</strong><small class="mono">${safe(d.code)}</small></td>
                    <td data-label="接收方 · 更新"><strong>${safe(d.to)}</strong><small>${safe(d.when)}</small></td>
                    <td data-label="状态"><span class="status-chip ${d.tone}">${safe(d.state)}</span></td>
                    <td data-label="操作" class="shared-row__go">${safe(d.go)}</td>
                  </tr>`).join("")}
              `).join("")}
            </tbody>
          </table>
        </section>
        <p class="shared-footnote">交付物由本频道的计算版本生成；锁定后只读，更正生成新修订号。</p>
      </div>`;
  }

  function renderTeam() {
    const admin = state.role === "customer_admin";
    const invitedRows = state.invitedMembers.map((member) => `<tr><td><strong>${safe(member.email.split("@")[0])}</strong><small>${safe(member.email)}</small></td><td>${safe(member.role)}</td><td>${safe(member.scope)}</td><td>企业管理员邀请</td><td><span class="record-state warn">等待接受 · ${safe(member.expiresAt)}</span></td></tr>`).join("");
    $("#main").innerHTML = `
      ${pageHeader("ORGANIZATION & ACCESS", admin ? "成员与授权" : "团队与权限", admin ? actionButton("邀请成员", "primary", 'data-action="invite-member"') : statusChip("项目范围只读"))}
      <div class="permission-summary"><div><small>企业成员</small><strong>${12 + state.invitedMembers.length}</strong></div><div><small>Lumino 服务团队</small><strong>3</strong></div><div><small>待接受邀请</small><strong>${state.invitedMembers.length}</strong></div><p>权限按企业、年度、设施和数据敏感级别共同计算。Agent 不会扩大成员已有权限。</p></div>
      <section class="panel wide-panel"><div class="panel-head"><h2>项目成员</h2><button class="text-button" type="button" data-drawer="permission-audit">查看权限审计</button></div><table class="data-table"><thead><tr><th>成员</th><th>角色</th><th>数据范围</th><th>授权来源</th><th>状态</th></tr></thead><tbody>
        <tr><td><strong>周岚</strong><small>zhou.lan@huaxing.cn</small></td><td>企业管理员 / 协调人</td><td>全部年度 · 全部设施</td><td>企业级角色</td><td><span class="record-state ok">有效</span></td></tr>
        <tr><td><strong>陈浩</strong><small>生产部</small></td><td>数据贡献者</td><td>2026 · 上海一厂</td><td>任务 + 设施范围</td><td><span class="record-state warn">2 项待办</span></td></tr>
        <tr><td><strong>王晨</strong><small>Lumino 制备专家</small></td><td>制备专家</td><td>SO-2026-018 · 2026</td><td>服务订单授权</td><td><span class="record-state ok">2027-03 到期</span></td></tr>
        <tr><td><strong>李娜</strong><small>Lumino 复核中心</small></td><td>独立复核专家</td><td>待复核快照</td><td>工作包 WP-REV-03</td><td><span class="record-state ok">有效</span></td></tr>
        <tr><td><strong>NordWerk GmbH</strong><small>欧盟进口商</small></td><td>外部接收方</td><td>2025 · 已分享产品范围</td><td>交付分享授权</td><td><span class="record-state">只读</span></td></tr>${invitedRows}
      </tbody></table></section>
      <div class="security-note"><strong>最小权限原则</strong><p>商务和运营默认看不到 BOM、供应商价格与原始凭证；管理员临时访问客户内容必须说明原因并写入审计。</p><button class="text-button" type="button" data-drawer="permission-audit">查看权限矩阵 →</button></div>`;
  }

  function renderOrganizationSettings() {
    if (!canManageOrganization()) {
      state.page = defaultPages[state.role];
      render();
      toast("只有企业管理员可以维护长期主档。");
      return;
    }
    state.currentService = null;
    const section = settingsNavItems.some(([id]) => id === state.settingsSection) ? state.settingsSection : "members";
    state.settingsSection = section;
    const seededFacilities = cbamFacilityOptions().map((facility) => ({
      code: facility.payload?.internalCode || facility.id,
      name: facility.name,
      activity: facility.payload?.activity || "生产活动待补充",
      status: facility.payload?.operationalStatus || (facility.status === "CONFIRMED" ? "在用" : "待确认"),
      assetId: facility.id,
      versionId: facility.versionId,
    }));
    const facilities = [...seededFacilities, ...state.facilities];
    const facilityRows = facilities.map((facility) => `<article class="record"><span class="record-code">${safe(facility.code)}</span><div><strong>${safe(facility.name)}</strong><p>${safe(facility.activity || "生产活动待补充")}${facility.assetId ? ` · ${safe(facility.assetId)}` : ""}</p></div><button class="record-state ${facility.status === "在用" ? "ok" : "warn"}" type="button" data-drawer="record-detail" data-drawer-label="${safe(facility.name)}" data-drawer-object="${safe(facility.versionId || `设施 ${facility.code}`)}" data-drawer-status="${safe(facility.status)}" data-drawer-description="查看设施版本、生产活动、年度引用和数据源。">查看</button></article>`).join("");
    const invitedRows = state.invitedMembers.map((member) => `<tr><td><strong>${safe(member.email.split("@")[0])}</strong><small>${safe(member.email)}</small></td><td>${safe(member.role)}</td><td>${safe(member.scope)}</td><td><span class="record-state warn">邀请中 · ${safe(member.expiresAt)}</span></td></tr>`).join("");
    const orgAsset = assetRegistry.get("ORG-HX-001");
    const titles = {
      org: "企业信息",
      facilities: "设施",
      members: "成员与角色",
      services: "服务与订单",
      security: "安全与登录",
      audit: "审计记录",
    };
    const asides = {
      org: actionButton("编辑企业资料", "primary", 'data-action="toggle-org-edit"'),
      facilities: actionButton("新建设施", "primary", 'data-drawer="new-facility"'),
      members: actionButton("邀请成员", "primary", 'data-action="invite-member"'),
      services: actionButton("查看年度与订单", "secondary", 'data-page="programs"'),
      security: statusChip("演示策略", "warn"),
      audit: actionButton("打开权限矩阵", "secondary", 'data-drawer="permission-audit"'),
    };
    const bodies = {
      org: `
        <div class="master-data-note"><div><strong>长期主档，不绑死某个年度</strong><p>企业信息写入资产池；年度项目引用当时有效版本，修改不会覆盖已锁定年度。</p></div><span class="status-chip">主档完整度 91%</span></div>
        <article class="panel master-section"><div class="panel-head"><div><h2>法定主体</h2><span>${safe(orgAsset?.versionId || "ORG-HX-001")} · 当前有效</span></div><span class="record-state ok">已验证</span></div>
          <dl class="master-fields"><div><dt>法定名称</dt><dd>${safe(state.organization.name)}</dd></div><div><dt>统一社会信用代码</dt><dd>${safe(state.organization.code)}</dd></div><div><dt>注册地址</dt><dd>${safe(state.organization.address)}</dd></div><div><dt>企业管理员</dt><dd>周岚 · zhoulan@huaxing-steel.cn</dd></div></dl>
        </article>`,
      facilities: `
        <article class="panel master-section"><div class="panel-head"><div><h2>生产设施</h2><span>企业数据资产 · ${facilities.length} 座</span></div><button class="text-button" type="button" data-drawer="new-facility">＋ 新建设施</button></div>
          <div class="record-list">${facilityRows || systemStatePanel({ code: "empty", title: "还没有设施", reason: "新建设施后，才能纳入年度范围与材料请求。", primary: { label: "新建设施", attrs: 'data-drawer="new-facility"' } })}</div>
        </article>`,
      members: `
        <div class="permission-summary"><div><small>企业成员</small><strong>${12 + state.invitedMembers.length}</strong></div><div><small>待接受邀请</small><strong>${state.invitedMembers.length}</strong></div><div><small>可见范围</small><strong>按角色</strong></div><p>「可见范围」列对应邀请激活时的说明；Agent 不会扩大成员已有权限。</p></div>
        <section class="panel wide-panel"><div class="panel-head"><h2>成员与角色</h2><button class="text-button" type="button" data-drawer="permission-audit">查看权限审计</button></div>
          <table class="data-table"><thead><tr><th>成员</th><th>角色</th><th>可见范围</th><th>状态</th></tr></thead><tbody>
            <tr><td><strong>周岚</strong><small>zhoulan@huaxing-steel.cn</small></td><td>企业管理员</td><td>全部服务与设置</td><td><span class="record-state ok">已启用</span></td></tr>
            <tr><td><strong>赵海峰</strong><small>zhaohf@huaxing-steel.cn</small></td><td>内部审批人</td><td>待审批报告与结果摘要</td><td><span class="record-state ok">已启用</span></td></tr>
            <tr><td><strong>陈浩</strong><small>chenhao@huaxing-steel.cn</small></td><td>数据贡献者</td><td>CBAM · 上海一厂材料请求</td><td><span class="record-state ok">已启用</span></td></tr>
            <tr><td><strong>王晨</strong><small>Lumino 制备专家</small></td><td>服务团队</td><td>SO-2026-018 · 制备范围</td><td><span class="record-state ok">订单授权</span></td></tr>
            ${invitedRows}
          </tbody></table>
        </section>`,
      services: `
        <article class="panel master-section"><div class="panel-head"><div><h2>服务与订单</h2><span>跨年度履约视图</span></div></div>
          <div class="responsibility-grid">
            <div><small>CBAM</small><strong>SO-2026-018</strong><span>2026 Q3 进行中 · 林晓负责</span></div>
            <div><small>PCF</small><strong>试点订单</strong><span>热轧非合金钢卷 · 核算声明</span></div>
            <div><small>合同窗口</small><strong>CT-2025-044</strong><span>至 2027-03-31</span></div>
          </div>
          <footer class="pcf-card__actions" style="margin-top:var(--space-md)"><p>范围变更走申请，不会立即覆盖当前服务订单。</p>${actionButton("申请范围变更", "secondary", 'data-drawer="service-scope"')}${actionButton("打开年度与订单", "primary", 'data-page="programs"')}</footer>
        </article>`,
      security: `
        <article class="panel master-section"><div class="panel-head"><div><h2>安全与登录</h2><span>企业策略 · 演示</span></div></div>
          <dl class="master-fields">
            <div><dt>SSO 域名</dt><dd>huaxing-steel.cn · 模拟企业 IdP</dd></div>
            <div><dt>密码登录</dt><dd>允许非 SSO 域名使用 Lumino 密码</dd></div>
            <div><dt>会话时长</dt><dd>14 天保持登录 · 闲置 8 小时需重新验证</dd></div>
            <div><dt>二次验证</dt><dd>本轮原型不做 MFA；正式产品见后续工单</dd></div>
          </dl>
          <p class="settings-shell__hint">保存策略会写入审计；不会静默改变已登录会话的权限边界。</p>
          <div class="action-bar">${actionButton("保存策略（演示）", "primary", 'data-staff-action="企业登录策略已记录到审计"')}</div>
        </article>`,
      audit: `
        <article class="panel master-section"><div class="panel-head"><div><h2>审计记录</h2><span>最近 7 天</span></div><button class="text-button" type="button" data-drawer="permission-audit">完整权限矩阵</button></div>
          <table class="data-table"><thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th></tr></thead><tbody>
            <tr><td>今天 09:18</td><td>周岚</td><td>邀请成员</td><td>sunyue@huaxing-steel.cn</td></tr>
            <tr><td>昨天 16:42</td><td>周岚</td><td>更新企业主档</td><td>ORG-HX-001 · Rev 4</td></tr>
            <tr><td>10 月 8 日</td><td>系统</td><td>SSO 域名校验通过</td><td>huaxing-steel.cn</td></tr>
          </tbody></table>
        </article>`,
    };
    $("#main").innerHTML = settingsShell({
      title: titles[section] || "企业设置",
      aside: asides[section] || "",
      section,
      body: bodies[section] || bodies.members,
    });
  }

  function renderAnnualSetup() {
    if (!canCreateYear()) {
      state.page = defaultPages[state.role];
      render();
      toast("只有企业管理员可以创建新年度。");
      return;
    }
    $("#main").innerHTML = `
      ${pageHeader("NEW ANNUAL COMPLIANCE CYCLE", "创建 2028 年度", statusChip("尚未创建", "warn"))}
      <section class="year-setup"><div class="year-step active"><span>01</span><div><small>基线年度</small><strong>使用 2027 的结构，不复制年度数值</strong><p>设施、产品和工艺作为待确认建议带入；产量、能耗、采购量和核算结果不会复制。</p></div></div><div class="year-step"><span>02</span><div><small>变化确认</small><strong>Agent 将询问今年发生了什么变化</strong><p>新增产品、生产线、供应商、外包工序和能源类型会单独确认。</p></div></div><div class="year-step"><span>03</span><div><small>新年度规则</small><strong>重新解析 2028 Rulepack 与报告模板</strong><p>默认值、benchmark、必填字段和交付模板全部按新年度生成。</p></div></div></section>
      <section class="panel inheritance-panel"><div class="panel-head"><div><h2>2027 → 2028 继承清单</h2><span>继承的是可复用结构；年度事实和结论始终重新取得</span></div><span class="status-chip">创建前预览</span></div><div class="inheritance-table"><div class="inheritance-row"><strong>企业、设施、产品、CN Code 候选</strong><span>引用当前有效主档，作为待确认结构</span><em class="inherit yes">可继承</em></div><div class="inheritance-row"><strong>工艺、供应商、职责与数据源映射</strong><span>复制为新年度草稿，Agent 逐项询问变化</span><em class="inherit review">继承后确认</em></div><div class="inheritance-row"><strong>监测方法章节</strong><span>复制为新修订草稿，必须经专家年度复核</span><em class="inherit review">继承后复核</em></div><div class="inheritance-row"><strong>季度产量、能耗、采购与发运数据</strong><span>不得跨年度复制，按 Q1–Q4 重新采集</span><em class="inherit no">不继承</em></div><div class="inheritance-row"><strong>默认值、证书价格、核算结果与批准状态</strong><span>按 2028 Rulepack 重新计算，不沿用历史结论</span><em class="inherit no">不继承</em></div><div class="inheritance-row"><strong>年度报告、核查包与 Findings</strong><span>保留历史只读快照，新年度创建独立版本</span><em class="inherit no">不继承</em></div></div><div class="year-setup-actions"><button class="button button--secondary" type="button" data-page="programs">取消</button><button class="button button--primary" type="button" data-action="create-year">创建年度并返回年度列表</button></div></section>`;
  }
