"use strict";

  function customerQuestion() {
    if (state.year === "2028") return `
      <p class="question-count">年度变化确认 · 第 1 项</p>
      <h2>2028 年还会使用这 2 个生产设施吗？</h2>
      <p class="why">我从 2027 年带入的是设施结构，不是年度数值。确认后，我会继续询问新增生产线、产品和供应商变化。</p>
      <div class="answer-row"><button class="answer-button" type="button" data-answer="设施没有变化">是，没有变化</button><button class="answer-button" type="button" data-answer="设施发生变化">有新增或停用</button><button class="answer-button secondary" type="button" data-answer="不确定">我不确定</button><button class="answer-button secondary" type="button" data-answer="delegate">交给生产同事</button></div>`;
    if (state.year === "2025") return `
      <div class="locked-banner"><b aria-hidden="true">⌾</b><p><strong>2025 年度已锁定。</strong><br>这是交付时的 Rev 1 快照。如需更正，将创建新的 Amendment Revision。</p></div>`;
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

  function renderCustomer() {
    if (renderMultiServicePage()) return;
    if (state.page !== "work") return renderCustomerSecondary();
    const year = years[state.year];
    const profile = annualProfile();
    const locked = profile.mode === "archived";
    const planned = profile.mode === "planned";
    const currentStep = journeyStage();
    const stepNames = ["年度范围", "监测计划", "Q1–Q4 数据循环", "年度排放报告", "核查与交付"];
    const homeTitle = locked ? "查看完整年度档案" : planned ? `下一步：确认 ${state.year} 年度范围` : state.findingResolved ? "下一步：检查年度报告准备度" : state.factConfirmed ? "下一步：选择缺口数据的处理方式" : state.uploadAdded ? "下一步：确认 Agent 提取结果" : `下一步：上传 ${state.quarter} 天然气账单`;
    const coordinatorNext = locked ? ""
      : state.findingResolved
        ? nextAction("当前唯一下一步", "检查年度报告准备度", "季度数据路径已记录；现在检查监测计划和年度文件还缺什么。", "检查报告与交付", 'data-page="deliverables"')
        : state.factConfirmed
          ? nextAction("当前唯一下一步", "选择缺口数据的处理方式", "比较默认值、当前实测和等待供应商数据的成本与时间影响。", "比较并做决定", 'data-page="results"')
          : state.uploadAdded
            ? nextAction("当前唯一下一步", "确认 Agent 提取的天然气数据", "核对用量、账期和设施。确认后才会产生新计算版本。", "核对提取结果", 'data-page="data"')
            : planned
              ? nextAction("当前唯一下一步", `确认 ${state.year} 年的产品、工厂与进口商`, "系统已引用长期主档作为建议；确认变化后再生成年度监测计划和季度任务。", "确认年度范围", 'data-page="products"')
              : nextAction("当前唯一下一步", `上传 ${state.quarter} 的 ${quarterMeta[state.quarter].endMonth}天然气账单`, "产品、工厂和监测方法已建立。现在只需补齐当期数据，Agent 会自动提取。", "上传当期账单", 'data-action="mock-upload"');
    const taskRows = locked ? `
      <li class="task-row"><span class="task-number">✓</span><div><strong>Communication Package 已交付</strong><small>进口商：NordWerk GmbH · 已接收</small></div><time>2026-03-18</time></li>
      <li class="task-row"><span class="task-number">✓</span><div><strong>核查报告已归档</strong><small>Verification Report · Rev 1</small></div><time>2026-03-12</time></li>`
      : planned ? `
      <li class="task-row"><span class="task-number">1</span><div><strong>确认年度产品与设施范围</strong><small>核对从 2026 年引用的结构和本年变化</small></div><div class="task-row-action"><time>现在可做</time><button class="text-button" type="button" data-page="products">开始确认</button></div></li>
      <li class="task-row"><span class="task-number">2</span><div><strong>生成年度监测计划草稿</strong><small>范围确认后由 Agent 和专家准备</small></div><div class="task-row-action"><time>下一步</time><button class="text-button" type="button" data-page="deliverables">查看要求</button></div></li>
      <li class="task-row"><span class="task-number">3</span><div><strong>安排 Q1 数据责任人</strong><small>不会复制 2026 年的季度数值</small></div><div class="task-row-action"><time>待范围确认</time><button class="text-button" type="button" data-page="team">查看团队</button></div></li>`
      : state.findingResolved ? `
      <li class="task-row"><span class="task-number">1</span><div><strong>完成监测计划的 4 个缺口</strong><small>已确认事实会自动复用，无需重新填写</small></div><div class="task-row-action"><time>今天</time><button class="text-button" type="button" data-page="deliverables">去处理</button></div></li>
      <li class="task-row"><span class="task-number">2</span><div><strong>等待专家复核 Run 05</strong><small>王晨制备 · 李娜独立复核</small></div><div class="task-row-action"><time>处理中</time><button class="text-button" type="button" data-page="results">查看结果</button></div></li>
      <li class="task-row"><span class="task-number">3</span><div><strong>继续跟进供应商实测数据</strong><small>默认值并行路径不会停止供应商请求</small></div><div class="task-row-action"><time>已等待 6 天</time><button class="text-button" type="button" data-page="products">查看配置</button></div></li>`
      : state.factConfirmed ? `
      <li class="task-row"><span class="task-number">1</span><div><strong>处理钢坯数据缺口</strong><small>比较默认值并行、等待供应商和保守默认值</small></div><div class="task-row-action"><time>现在</time><button class="text-button" type="button" data-page="results">选择路径</button></div></li>
      <li class="task-row"><span class="task-number">2</span><div><strong>复核 Run 05 成本变化</strong><small>确认新增天然气数据带来的影响</small></div><div class="task-row-action"><time>待决定</time><button class="text-button" type="button" data-page="results">查看</button></div></li>`
      : `
      <li class="task-row"><span class="task-number">1</span><div><strong>上传 ${quarterMeta[state.quarter].endMonth}天然气账单</strong><small>补齐 ${state.quarter} 数据包；Agent 会识别用量、账期和设施</small></div><div class="task-row-action"><time>今天</time><button class="text-button" type="button" data-page="data">去处理</button></div></li>
      <li class="task-row"><span class="task-number">2</span><div><strong>确认钢坯供应商数据路径</strong><small>可转发给采购负责人，不阻塞其他产品</small></div><div class="task-row-action"><time>10 月 12 日</time><button class="text-button" type="button" data-page="products">查看</button></div></li>
      <li class="task-row"><span class="task-number">3</span><div><strong>复核 Q3 产品覆盖</strong><small>确认本季度发运涉及的产品与进口商</small></div><div class="task-row-action"><time>10 月 15 日</time><button class="text-button" type="button" data-page="products">查看</button></div></li>`;
    const upcomingRows = locked ? taskRows : planned ? taskRows : state.findingResolved ? `
      <li class="task-row"><span class="task-number">→</span><div><strong>专家复核当前计算版本</strong><small>王晨制备 · 李娜独立复核</small></div><time>系统自动流转</time></li>
      <li class="task-row"><span class="task-number">→</span><div><strong>继续跟进供应商实测数据</strong><small>并行路径不会阻塞年度工作</small></div><time>已委派采购</time></li>` : state.factConfirmed ? `
      <li class="task-row"><span class="task-number">→</span><div><strong>对方案进行具名审批</strong><small>批准默认值并行路径后才可交付</small></div><time>内部审批人</time></li>
      <li class="task-row"><span class="task-number">→</span><div><strong>准备 ${state.quarter} 进口商数据包</strong><small>根据已批准的数据路径生成</small></div><time>后续自动进入</time></li>` : `
      <li class="task-row"><span class="task-number">→</span><div><strong>确认 Agent 提取结果</strong><small>核对账期、设施和用量</small></div><time>上传后</time></li>
      <li class="task-row"><span class="task-number">→</span><div><strong>计算本季度结果并处理数据缺口</strong><small>系统会比较默认值与实测值</small></div><time>数据确认后</time></li>`;
    const showAgentQuestion = planned || Boolean(state.configurationDrafts[state.selectedProduct] && !state.answer);
    $("#main").innerHTML = `
      ${pageHeader(`${state.year} ANNUAL COMPLIANCE CYCLE`, homeTitle, yearBadge())}
      ${state.online ? "" : '<div class="offline-banner" role="status"><strong>当前处于离线状态</strong><span>你仍可查看本页，但上传、分享和状态变更将在恢复网络后才能提交。</span></div>'}
      ${onboardingGuide()}
      <div class="customer-layout">
        <section class="customer-main">
          ${state.importedTrial && state.year === String(state.importedTrial.year) ? `<section class="trial-handoff"><div><small>来自免费成本试算</small><strong>${safe(state.importedTrial.cnCode)} · ${safe(state.importedTrial.quantity.toLocaleString("zh-CN"))} 吨</strong><p>估算成本 ¥${safe(state.importedTrial.estimatedCostCny.toLocaleString("zh-CN"))}。这只是线索，确认产品与工厂后才会建立正式事实。</p></div><button class="button button--secondary" type="button" data-action="review-trial">核对并转为项目</button></section>` : ""}
          <section class="project-position"><div><small>当前年度状态</small><strong>${state.year} · ${profile.position}</strong></div><div><small>${planned ? "已引用的基础" : "已建立的基础"}</small><strong>${profile.foundation}</strong></div><button class="text-button" type="button" data-page="roadmap">查看全年流程 →</button></section>
          <div class="journey-mini">${stepNames.map((name, index) => `<span class="${index + 1 < currentStep || locked ? "done" : index + 1 === currentStep ? "current" : ""}" title="${name}"><i></i><small>${index + 1}</small></span>`).join("")}</div>
          ${stageGatePanelHtml("cbam")}
          ${coordinatorNext}
          ${showAgentQuestion ? `<section class="panel agent-task secondary-agent-task">
            <div class="agent-task-top"><div class="agent-identity"><span class="agent-mark" aria-hidden="true">✦</span><div><strong>Lumino 协调 Agent</strong><small>把业务事实转换为合规数据</small></div></div><button class="text-button" type="button" data-action="explain-question" aria-expanded="${state.questionHelpOpen}">为什么问这些？</button></div>
            <div class="agent-task-body">${customerQuestion()}</div>
          </section>` : ""}
          <section class="panel"><div class="panel-head"><div><h2>${locked ? "年度记录" : "完成当前步骤后"}</h2><small>${locked ? "只读档案" : "这些暂时不需要你处理"}</small></div></div>
            <ol class="task-list">
              ${upcomingRows}
            </ol>
          </section>
        </section>
        <aside class="panel context-rail" aria-label="当前工作依据">
          <div class="context-intro"><p>WHY THIS IS NEXT</p><h2>${locked ? "交付时的正式事实快照" : "为什么现在做这一步"}</h2></div>
          <section class="context-section"><h3>${planned ? "年度准备依据" : locked ? "封存范围" : "前置基础已建立"}</h3><dl class="fact-list"><div><dt>企业与设施</dt><dd>${planned ? "引用主档 · 待确认" : "已确认"}</dd></div><div><dt>年度产品范围</dt><dd>${planned ? "待确认" : "4 个产品"}</dd></div><div><dt>监测计划</dt><dd>${profile.monitoring[0]}</dd></div><div><dt>当前周期</dt><dd>${planned ? "年度准备" : `${state.year} · ${state.quarter}`}</dd></div><div><dt>年度进度</dt><dd>${profile.progress}%</dd></div></dl></section>
          <section class="context-section"><h3>这一步的作用</h3><p class="source-line"><span>▣</span> ${planned ? "确认今年实际涉及的产品、工厂和进口商。" : locked ? "保留交付时的正式事实、版本和回执。" : "补齐当期活动数据和可追溯证据。"}</p><p class="source-line"><span>→</span> ${planned ? "确认后生成监测计划草稿和 Q1 材料清单。" : locked ? "如需调整，创建 Amendment，不覆盖原档案。" : "完成后自动进入排放计算和默认值对比，无需自己填专业表格。"}</p></section>
          <section class="context-section"><button class="text-button" type="button" data-page="roadmap">查看完整业务路径 →</button></section>
        </aside>
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
    $("#main").innerHTML = `
      ${pageHeader(`${state.year} · INTERNAL APPROVAL`, "待我审批", statusChip("2 项等待决定", "warn"))}
      <div class="approval-board"><section class="panel"><div class="panel-head"><h2>审批队列</h2><span>按成本与交付影响排序</span></div><div class="stack-list"><button type="button" class="stack-row active" data-drawer="record-detail" data-drawer-label="默认值并行路径" data-drawer-object="AP-2026-014" data-drawer-status="等待内部审批"><span>风险路径 · 今天</span><strong>供应商数据未返回，是否暂用默认值？</strong><small>影响 37% 总排放 · 不影响继续采集</small></button><button type="button" class="stack-row" data-drawer="record-detail" data-drawer-label="NordWerk Communication Package" data-drawer-object="2026 Q1–Q3 · 2 个产品"><span>交付范围 · 周五</span><strong>NordWerk Communication Package</strong><small>2 个产品 · 2026 Q1–Q3</small></button></div></section><section class="panel review-sheet"><small>DECISION AP-2026-014</small><h2>默认值并行路径</h2><p>批准后，团队会继续向供应商索取实测数据，同时以保守默认值维持当前进度。批准不会关闭 Finding。</p><ol><li><span>¥</span><div><strong>当前成本影响</strong><small>较目标情景约增加 ¥230k</small></div></li><li><span>✓</span><div><strong>可以撤回</strong><small>供应商数据通过核查后创建新计算版本</small></div></li></ol><div class="action-bar"><button class="button button--primary" type="button" data-workflow-transition="APPROVED" data-object-id="AP-2026-014">批准并记录理由</button><button class="button button--secondary" type="button" data-workflow-transition="REJECTED" data-object-id="AP-2026-014">退回补充</button></div></section></div>`;
  }

  function journeyStage() {
    const profile = annualProfile();
    if (profile.mode === "active" && state.findingResolved) return 4;
    return profile.step;
  }

  function renderRoadmap() {
    const profile = annualProfile();
    const steps = [
      { no: "01", name: "年度范围", desc: "确认企业、工厂、产品、CN Code 和进口商", owner: "企业管理员 + 项目协调人", result: "年度范围快照", page: "products" },
      { no: "02", name: "年度监测计划", desc: "确定取数方法、责任人、证据和内部控制", owner: "Agent + CBAM 专家", result: "监测计划", page: "deliverables" },
      { no: "03", name: "Q1–Q4 数据循环", desc: "每季收集产量、能源、发运和前体数据，计算并反馈进口商", owner: "协调人 + 数据负责人", result: "季度数据集与 Communication Package", page: "data" },
      { no: "04", name: "年度排放报告", desc: "汇总全年获批准数据，形成设施年度排放报告", owner: "CBAM 制备专家", result: "年度排放报告", page: "deliverables" },
      { no: "05", name: "核查与交付", desc: "完成独立复核、第三方核查，并向进口商交付申报支持包", owner: "核查员 + Lumino + 客户", result: "已核查年度档案", page: "deliverables" },
    ];
    const current = journeyStage();
    const locked = profile.mode === "archived";
    const planned = profile.mode === "planned";
    const active = steps[current - 1];
    $("#main").innerHTML = `
      ${pageHeader(`${state.year} · CBAM WORKFLOW`, locked ? "这个年度已完整完成" : planned ? "这个年度尚未开始，但可以先准备" : "从年度范围到核查交付", `<div class="head-actions">${yearBadge()}${locked ? "" : '<button class="button button--secondary" type="button" data-page="work">返回当前工作</button>'}</div>`)}
      <section class="guide-overview">
        <div><small>ONE BUSINESS ROUTE</small><h2>五个阶段就是客户看到的全部主流程。</h2><p>年度范围和监测计划建立一次；Q1–Q4 重复收数、计算和反馈；年底再形成排放报告并完成核查。</p></div>
        <div class="guide-now"><small>当前位置</small><strong>${locked ? "5/5 · 年度已封存" : `${current}/5 · ${active.name}`}</strong><span>${locked ? "Q1–Q4、年度报告、核查和交付均已完成。" : active.desc}</span><button class="button button--primary" type="button" data-page="${active.page}">${locked ? "查看年度档案" : planned ? "开始年度准备" : "继续当前工作"}<b aria-hidden="true">→</b></button></div>
      </section>
      <nav class="platform-flow five-stage-flow" aria-label="CBAM 端到端操作流程">${steps.map((step, index) => {
        const stateClass = index + 1 < current || locked ? "done" : index + 1 === current ? "current" : "";
        const content = `<span>${index + 1 < current || locked ? "✓" : step.no}</span><strong>${step.name}</strong><small>${step.desc}</small>`;
        return `<button class="flow-node ${stateClass}" type="button" data-page="${step.page}" ${index + 1 === current ? 'aria-current="step"' : ""}>${content}</button>`;
      }).join("")}</nav>
      <section class="cadence-map" aria-label="季度与年度工作节奏"><div><small>QUARTERLY · 每季重复</small><strong>Q1 → Q2 → Q3 → Q4</strong><p>每季收集产量、发运、能源和前体数据，核算后向进口商提供 Communication Package。</p><button class="text-button" type="button" data-page="data">查看 ${state.quarter} 数据包 →</button></div><div><small>ANNUAL · 年度主线</small><strong>监测计划 → 排放报告 → 核查</strong><p>监测计划规定全年方法；年终汇总设施排放报告，完成核查并支持进口商申报。</p><button class="text-button" type="button" data-page="deliverables">查看年度文件 →</button></div></section>
      <div class="roadmap-layout">
        <section class="panel step-focus"><div class="panel-head"><h2>${locked ? "年度交付记录" : `${active.name}：当前状态`}</h2><span>${locked ? "100% · Rev 1" : planned ? "8% · 年度准备" : `${state.quarter} · ${profile.progress}%`}</span></div>
          <div class="step-checks">${locked ? `<div class="complete"><b>✓</b><span><strong>Q1–Q4 数据包全部完成</strong><small>进口商分享与回执记录已封存</small></span></div><div class="complete"><b>✓</b><span><strong>年度排放报告与核查包已交付</strong><small>所有版本和审计记录可追溯</small></span></div>` : planned ? `<div class="complete"><b>✓</b><span><strong>企业长期主档已引用</strong><small>不会复制上一年度的产量、能源和计算结果</small></span></div><div><b>1</b><span><strong>确认产品、工厂和进口商范围</strong><small>完成后生成监测计划草稿和 Q1 任务</small></span><button class="text-button" type="button" data-page="products">开始确认</button></div>` : `<div class="complete"><b>✓</b><span><strong>Q1 与 Q2 已完成</strong><small>季度数据、计算版本和进口商数据包均已形成</small></span></div><div class="complete"><b>✓</b><span><strong>产品、工厂和监测计划已建立</strong><small>这些内容无需 Q3 重复填写</small></span></div><div><b>!</b><span><strong>${quarterMeta[state.quarter].endMonth}天然气账单</strong><small>Q3 当前唯一需要客户操作的阻塞项</small></span><button class="text-button" type="button" data-action="mock-upload">上传账单</button></div>`}</div>
        </section>
        <aside class="panel gate-panel"><div class="panel-head"><h2>完成后发生什么</h2></div><div><span class="gate-count">→</span><p>${locked ? "年度保持只读；如需更正，将创建新的 Amendment Revision。" : planned ? "Agent 生成年度监测计划草稿、责任矩阵和 Q1 材料清单。" : "Agent 提取并请你确认数据，然后生成新计算 Run，对比默认值成本，再准备进口商数据包。"}</p><button class="button button--secondary" type="button" data-page="work">返回当前工作</button></div></aside>
      </div>`;
  }

  function renderData() {
    const locked = isLockedYear();
    const profile = annualProfile();
    const planned = profile.mode === "planned";
    const currentPeriod = quarterMeta[state.quarter];
    if (state.role === "customer_contrib") {
      $("#main").innerHTML = `
        ${pageHeader(`${state.year} · MY EVIDENCE`, "我的材料", statusChip("上海一厂 · 限定范围"))}
        <div class="privacy-band"><strong>最小可见范围</strong><span>这里仅显示分配给你的设施与材料。其他设施、供应商和完整计算结果保持隐藏。</span></div>
        <section class="panel wide-panel"><div class="panel-head"><h2>${state.quarter} 我负责的材料</h2><button class="button button--primary" type="button" data-action="mock-upload">上传材料</button></div><div class="record-list"><article class="record"><span class="record-code">BILL</span><div><strong>上海一厂电力账单 · ${quarterMeta[state.quarter].months}</strong><p>已解析 3/3 · 等待项目协调人确认</p></div><span class="record-state ok">已上传</span></article><article class="record"><span class="record-code">GAS</span><div><strong>上海一厂天然气账单 · ${quarterMeta[state.quarter].endMonth}</strong><p>今天到期</p></div><span class="record-state warn">待上传</span></article></div></section>`;
      return;
    }
    const periods = Object.entries(profile.quarters).map(([quarter, values]) => {
      if (profile.mode === "active" && quarter === "Q3" && state.uploadAdded) return [quarter, "采集中", 84, "warn"];
      return [quarter, ...values];
    });
    const gasState = state.uploadAdded ? '<span class="record-state ok">已解析</span>' : '<span class="record-state warn">待补</span>';
    const dataHeaderAction = locked ? yearBadge() : planned ? statusChip("先完成年度准备", "warn") : actionButton("上传本季度材料", "secondary", 'data-action="mock-upload"');
    const periodRecords = locked
      ? `<article class="record"><span class="record-code">DATA</span><div><strong>${state.quarter} 季度数据集</strong><p>产量、能源、前体与发运数据 · 最终版本</p></div><span class="record-state ok">已冻结</span></article><article class="record"><span class="record-code">PACK</span><div><strong>${state.quarter} Communication Package</strong><p>已分享并记录进口商回执</p></div><span class="record-state ok">已归档</span></article>`
      : planned
        ? `<article class="record"><span class="record-code">Q1</span><div><strong>Q1 材料清单尚未生成</strong><p>年度范围和监测计划确认后，Agent 将按岗位生成任务。</p></div><span class="record-state">待年度准备</span></article>`
        : (() => {
          const power = assetRegistry.get("REC-HX-POWER-2026Q3");
          const powerEvidence = assetRegistry.get("EVD-HX-POWER-2026Q3");
          const powerBinding = assetRegistry.bindings({ serviceId: "cbam", assetId: "REC-HX-POWER-2026Q3" })[0];
          const shName = assetRegistry.get("FAC-SH-01")?.name || "上海一厂";
          const jsName = assetRegistry.get("FAC-JS-02")?.name || "江苏二厂";
          const powerValue = power?.payload?.originalValue ? `${Number(power.payload.originalValue).toLocaleString("zh-CN")} ${power.payload.originalUnit}` : "已解析";
          return `<article class="record"><span class="record-code">BILL</span><div><strong>电力账单 · ${currentPeriod.months}</strong><p>${safe(shName)} · ${safe(powerEvidence?.id || "EVD-HX-POWER-2026Q3")} · ${safe(powerValue)} · ${safe(powerBinding?.status || "已关联")}</p></div><span class="record-state ok">资产已绑定</span></article><article class="record"><span class="record-code">GAS</span><div><strong>天然气账单 · ${currentPeriod.months}</strong><p>${safe(jsName)} · FAC-JS-02 · ${state.uploadAdded ? "已解析 3/3" : `缺 ${currentPeriod.endMonth}`}</p></div>${gasState}</article><article class="record"><span class="record-code">PRE</span><div><strong>钢坯供应商数据</strong><p>北方特钢 · 请求已发送</p></div><span class="record-state warn">等待外部</span></article>`;
        })();
    const reviewStep = state.uploadAdded ? `<section class="panel extraction-review"><div><small>AGENT EXTRACTION · 写入企业资产池后待确认</small><h2>${currentPeriod.endMonth}天然气：18,420 Nm³</h2><p>识别自“${safe(assetRegistry.get("FAC-JS-02")?.name || "江苏二厂")}天然气账单_${state.year}-${currentPeriod.endMonth.replace(" 月", "").padStart(2, "0")}.pdf”，账期与设施 FAC-JS-02 已匹配。确认后将登记为能源资产并绑定 CBAM。</p></div>${state.factConfirmed ? '<span class="status-chip">已确认并进入 Run 05</span>' : '<button class="button button--primary" type="button" data-action="confirm-fact">确认提取结果</button>'}</section>` : "";
    const dataNext = planned
      ? nextAction("年度准备", "先确认 2027 年度范围", "季度数据不从 2026 年复制。确认产品、工厂、进口商和监测方法后，系统会生成 Q1 材料清单。", "确认年度范围", 'data-page="products"')
      : !state.uploadAdded
        ? nextAction("当前季度任务", `先补齐 ${state.quarter} 的 ${currentPeriod.endMonth}天然气账单`, "上传后 Agent 会提取用量、账期和设施，你只需核对结果。", "演示上传并解析", 'data-action="mock-upload"')
      : !state.factConfirmed
        ? nextAction("当前任务 · 3/5", "确认 Agent 提取的数据", "确认前不会进入正式核算，也不会覆盖历史记录。", "确认提取结果", 'data-action="confirm-fact"')
        : nextAction("当前任务 · 3/5 已完成", "查看成本与数据路径", "新数据已进入待复核计算版本，下一步选择默认值或实测数据路径。", "查看更新结果", 'data-page="results"');
    $("#main").innerHTML = `
      ${pageHeader(`${state.year} · ${state.quarter} QUARTERLY DATA`, `${state.quarter} 数据与证据`, dataHeaderAction)}
      <section class="cadence-notice"><div><small>季度工作包</small><strong>每个季度独立检查数据完整度、计算版本和进口商反馈</strong></div><p>季度数据持续累积到年度数据集；监测计划、年度排放报告和核查在年度层管理。</p></section>
      ${locked ? '<div class="privacy-band"><strong>年度快照只读</strong><span>新材料必须通过更正申请进入 Amendment 草稿，不会覆盖 Rev 1。</span><button class="text-button" type="button" data-staff-action="已创建年度更正申请">发起更正</button></div>' : ""}
      ${planned ? '<div class="privacy-band"><strong>季度数据尚未开始</strong><span>你可以浏览 Q1–Q4 结构，但应先完成年度范围和监测计划准备。</span><button class="text-button" type="button" data-page="roadmap">查看开始条件</button></div>' : ""}
      <section class="period-grid" aria-label="选择季度数据包">${periods.map(([label, status, coverage, tone]) => {
        const price = state.year === "2026" ? certificatePrices2026[label].price : state.year >= "2027" ? "按周价格" : "不适用";
        return `<button type="button" class="period-card ${tone} ${state.quarter === label ? "selected" : ""}" data-quarter="${label}" aria-pressed="${state.quarter === label}"><div><small>${label}</small><span class="record-state ${tone}">${status}</span></div><strong>${coverage}%</strong><p>数据与证据覆盖</p><i><em style="width:${coverage}%"></em></i><ul><li>产品数量 ${coverage ? "✓" : "—"}</li><li>能源数据 ${coverage > 70 ? "✓" : coverage ? "待补" : "—"}</li><li>前体数据 ${coverage > 90 ? "✓" : coverage ? "缺 1 项" : "—"}</li><li>证书价格 ${price}</li></ul></button>`;
      }).join("")}</section>
      ${planned || locked ? "" : reviewStep}
      ${planned || locked ? "" : `<section class="asset-capsule-panel" aria-label="本季度已关联的企业数据资产"><header><div><span>ENTERPRISE ASSETS IN USE</span><h2>这些材料来自企业数据资产</h2><p>看得懂的是业务含义；点胶囊可查看来源、确认状态，以及是否也被 PCF 使用。</p></div></header><div class="asset-capsule-row">${assetCapsule("REC-HX-POWER-2026Q3", { serviceId: "cbam" })}${assetCapsule("EVD-HX-POWER-2026Q3", { serviceId: "cbam" })}${assetCapsule("REC-HX-OUTPUT-2026YTD", { serviceId: "cbam" })}</div></section>`}
      <div class="content-split data-layout"><section class="panel flat-panel"><div class="panel-head"><h2>${state.quarter} ${locked ? "归档记录" : planned ? "准备状态" : "本期材料"}</h2>${planned || locked ? "" : '<button class="text-button" type="button">责任人 ▾</button>'}</div><div class="record-list">${periodRecords}</div></section><aside class="panel trace-panel"><div class="panel-head"><h2>${planned ? "开始 Q1 前" : locked ? "档案包含" : `${state.quarter} 进入核算前`}</h2></div><ol class="trace-list">${planned ? '<li><span>01</span><div><strong>确认年度范围</strong><small>产品、设施、配置、CN Code 和进口商</small></div></li><li><span>02</span><div><strong>确认监测方法</strong><small>取数方式、职责、证据和内部控制</small></div></li>' : locked ? '<li><span>✓</span><div><strong>季度正式事实</strong><small>保留确认人与证据血缘</small></div></li><li><span>✓</span><div><strong>计算与交付版本</strong><small>保留规则包、价格与回执</small></div></li>' : `<li><span>01</span><div><strong>期间完整</strong><small>${state.uploadAdded ? "账期已覆盖，无重复或缺月" : `仍缺 ${currentPeriod.endMonth}天然气`}</small></div></li><li><span>02</span><div><strong>对象已关联</strong><small>设施、产品配置和前体明确</small></div></li><li><span>03</span><div><strong>证据可回溯</strong><small>文件版本与位置已记录</small></div></li><li><span>04</span><div><strong>异常已处理</strong><small>冲突有具名裁决</small></div></li>`}</ol></aside></div>
      ${locked ? "" : dataNext}`;
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

  function renderProducts() {
    const locked = state.year === "2025";
    const products = cbamProductCatalog();
    Object.entries(state.productOverrides).forEach(([id, overrides]) => {
      if (products[id]) products[id] = { ...products[id], ...overrides };
    });
    const productKeys = ["hrc", "coated", "section", "wire"].filter((key) => products[key]);
    if (state.productAdded) productKeys.push("cold");
    const count = productKeys.length;
    if (!products[state.selectedProduct] || (state.selectedProduct === "cold" && !state.productAdded)) state.selectedProduct = "hrc";
    const selected = products[state.selectedProduct];
    const shFacility = assetRegistry.get("FAC-SH-01")?.name || "上海一厂";
    const jsFacility = assetRegistry.get("FAC-JS-02")?.name || "江苏二厂";
    const productRow = (id) => `<button class="product-row ${state.selectedProduct === id ? "active" : ""}" type="button" data-product="${id}" aria-pressed="${state.selectedProduct === id}"><span>${safe(products[id].code)}</span><strong>${safe(products[id].name)}</strong><small>${safe(products[id].summary)}${products[id].assetId ? ` · ${safe(products[id].assetId)}` : ""}</small><em>${products[id].scope.length ? `纳入 ${safe(products[id].scope.join(" / "))}` : "尚未纳入年度项目"}</em></button>`;
    const configurationDraft = state.configurationDrafts[state.selectedProduct];
    const configurations = state.selectedProduct === "hrc" ? `<article><div class="config-top"><span>A</span><div><strong>${safe(shFacility)} · 自产钢坯</strong><small>高炉—转炉长流程 · 有效期 2025–至今 · FAC-SH-01</small></div><span class="record-state ok">37% 产量</span></div><dl><div><dt>主要前体</dt><dd>自产钢水、钢坯</dd></div><div><dt>数据路径</dt><dd>自身实测</dd></div><div><dt>单位排放</dt><dd>1.72 tCO₂e/t</dd></div></dl></article><article><div class="config-top"><span>B</span><div><strong>${safe(shFacility)} · 外购钢坯</strong><small>供应商甲 / 北方特钢 · 采购批次区分</small></div><span class="record-state warn">43% 产量</span></div><dl><div><dt>主要前体</dt><dd>外购非合金钢坯</dd></div><div><dt>数据路径</dt><dd>前体默认 + 自身实测</dd></div><div><dt>单位排放</dt><dd>1.96 tCO₂e/t</dd></div></dl></article><article><div class="config-top"><span>C</span><div><strong>${safe(jsFacility)} · 电弧炉</strong><small>供应商乙钢坯 · 订单号区分 · FAC-JS-02</small></div><span class="record-state ok">20% 产量</span></div><dl><div><dt>主要前体</dt><dd>外购低碳钢坯</dd></div><div><dt>数据路径</dt><dd>全链路实测 · 待核查</dd></div><div><dt>单位排放</dt><dd>1.31 tCO₂e/t</dd></div></dl></article>` : state.selectedProduct === "cold" ? `<div class="configuration-empty"><span>✦</span><h3>还没有生产配置</h3><p>告诉 Agent 这个产品在哪里生产、用了什么原料，我们会生成待确认的配置草稿。</p></div>` : `<article><div class="config-top"><span>A</span><div><strong>${safe(shFacility)} · 标准生产路径</strong><small>已从上一年度带入结构，待确认本年变化</small></div><span class="record-state warn">待完善</span></div><dl><div><dt>主要前体</dt><dd>待 Agent 确认</dd></div><div><dt>数据路径</dt><dd>暂用默认值</dd></div><div><dt>单位排放</dt><dd>待核算</dd></div></dl></article>`;
    $("#main").innerHTML = `
      ${pageHeader(`${state.year} · PRODUCT & SUPPLY CHAIN`, "产品与供应链", locked ? yearBadge() : actionButton("＋ 新建产品", "primary", 'data-action="toggle-product-form"'))}
      <div class="product-workspace">
        <section class="panel product-index"><div class="panel-head"><div><h2>企业产品主档</h2><small>来自企业数据资产 · ${state.year} 年度范围</small></div><span>${count} 个</span></div><div class="product-list">${productKeys.map(productRow).join("")}</div><div class="product-index-foot"><button class="text-button" type="button" data-drawer="generic-action" data-drawer-label="Excel 批量导入产品">Excel 批量导入</button><button class="text-button" type="button" data-drawer="record-detail" data-drawer-label="重复产品检查" data-drawer-status="未发现重复项">查找重复</button></div></section>
        <section class="product-detail">
          <div class="product-title"><div><small>PRODUCT MASTER · ${selected.assetId || "UI"} · ${state.selectedProduct === "cold" ? "DRAFT" : (selected.status || "ACTIVE")}</small><h2>${safe(selected.name)}</h2><p>${safe(selected.code)} · ${safe(selected.cn)}${selected.versionId ? ` · ${safe(selected.versionId)}` : ""}</p><div class="product-year-line">适用年度 ${safe(selected.scope.join(" · ") || "尚未纳入年度项目")}</div></div><div>${locked ? '<span class="status-chip locked">快照只读</span>' : '<button class="button button--secondary" type="button" data-drawer="manage-cn">管理 CN Code</button><button class="button button--secondary" type="button" data-drawer="manage-years">管理年度</button><button class="button button--secondary" type="button" data-action="edit-product">编辑主档</button><button class="button button--secondary" type="button" data-staff-action="产品将从未来年度候选中停用">停用</button>'}</div></div>
          <section class="configuration-section"><div class="section-heading"><div><h3>生产配置</h3><p>同一销售产品可以有不同工厂、工艺和前体来源；分别核算后再汇总。</p></div>${locked ? "" : `<button class="button button--secondary" type="button" data-action="add-configuration">＋ 添加配置</button>`}</div>
            <div class="configuration-list">${configurations}${configurationDraft ? `<article class="new-config"><div class="config-top"><span>${state.selectedProduct === "hrc" ? "D" : "A"}</span><div><strong>${safe(configurationDraft.facility)} · ${safe(configurationDraft.precursor)}</strong><small>${safe(configurationDraft.process)}${configurationDraft.basis ? ` · ${safe(configurationDraft.basis)}` : ""}</small></div><span class="record-state warn">草稿</span></div><button class="text-button" type="button" data-page="work">让 Agent 帮我确认专业字段 →</button></article>` : ""}</div>
          </section>
        </section>
      </div>
      ${locked ? "" : configurationDraft && !state.answer ? nextAction("当前任务 · 2/5", "让 Agent 补齐新配置", "用业务语言确认工厂、工艺和钢坯来源；无需填写专业字段。", "回答配置问题", 'data-page="work"', "secondary") : nextAction("当前任务 · 2/5 已核对", "收集本期数据与证据", "产品范围确定后，Agent 已生成按责任人拆分的材料清单。", "继续收集材料", 'data-page="data"', "secondary")}`;
  }

  function renderResults() {
    const profile = annualProfile();
    if (profile.mode === "planned") {
      $("#main").innerHTML = `
        ${pageHeader(`${state.year} · CALCULATION READINESS`, "计算与成本", yearBadge())}
        <section class="empty-workspace"><small>YEAR NOT STARTED</small><h2>2027 年尚未产生计算结果</h2><p>可以提前确认产品、工厂、CN Code、进口商和监测方法；季度活动数据、证书价格与计算结论不会从 2026 年复制。</p><div class="empty-checks"><span>✓ 企业长期主档已引用</span><span>○ 年度产品范围待确认</span><span>○ 监测计划待生成</span><span>○ Q1 数据尚未开始</span></div><button class="button button--primary" type="button" data-page="products">确认年度范围 <b aria-hidden="true">→</b></button></section>`;
      return;
    }
    if (profile.mode === "archived") {
      $("#main").innerHTML = `
        ${pageHeader(`${state.year} · FINAL CALCULATION`, "年度计算结果", yearBadge())}
        <section class="scenario-intro archived-summary"><div><small>FINAL · LOCKED</small><strong>2025 年最终认可结果</strong><p>Calculation Run 12 · Rulepack EU-CBAM-2025.4 · 与年度排放报告 Rev 1 和核查报告绑定。</p></div><div class="recognized-saving"><small>最终证书成本估算</small><strong>¥3.61m</strong><span>相对默认基线减少 ¥0.94m</span></div></section>
        <section class="annual-result-grid"><article><small>数据覆盖</small><strong>92% 实测</strong><span>8% 经批准默认值</span></article><article><small>单位排放</small><strong>1.76 tCO₂e/t</strong><span>4 个产品加权结果</span></article><article><small>核查状态</small><strong>已核查</strong><span>无开放 Finding</span></article><article><small>档案状态</small><strong>已封存</strong><span>更正需创建 Amendment</span></article></section>
        ${nextAction("完整年度档案", "查看报告、核查和进口商回执", "最终结果保持只读，所有版本和依据均可追溯。", "查看年度交付", 'data-page="deliverables"')}`;
      return;
    }
    const resolved = state.findingResolved;
    const pathLabels = { parallel: "供应商请求 + 默认值并行", supplier: "等待供应商实测数据", conservative: "本期采用保守默认值" };
    const decisionPanel = state.findingChoiceOpen && !resolved ? `<section class="panel decision-panel"><div class="decision-copy"><small>PATH DECISION · GAP-PRE-004</small><h2>钢坯数据暂时怎么处理？</h2><p>这项决定只影响当前计算版本，不会停止向供应商索取实测数据，也可以在新证据通过后撤回。</p></div><div class="decision-options" role="group" aria-label="选择数据处理路径"><button type="button" class="decision-option ${state.dataPathChoice === "parallel" ? "selected" : ""}" data-path-choice="parallel" aria-pressed="${state.dataPathChoice === "parallel"}"><strong>建议：两条路径并行</strong><span>先用默认值保持进度，同时继续追踪供应商数据</span></button><button type="button" class="decision-option ${state.dataPathChoice === "supplier" ? "selected" : ""}" data-path-choice="supplier" aria-pressed="${state.dataPathChoice === "supplier"}"><strong>等待供应商数据</strong><span>结果更完整，但当前核算和交付会继续等待</span></button><button type="button" class="decision-option ${state.dataPathChoice === "conservative" ? "selected" : ""}" data-path-choice="conservative" aria-pressed="${state.dataPathChoice === "conservative"}"><strong>本期使用默认值</strong><span>最快形成结果，预计证书成本最高</span></button></div><div class="decision-footer"><button class="button button--secondary" type="button" data-action="close-path-choice">暂不决定</button><button class="button button--primary" type="button" data-action="confirm-data-path" ${state.dataPathChoice ? "" : "disabled"}>确认${state.dataPathChoice ? `：${pathLabels[state.dataPathChoice]}` : "处理路径"}</button></div></section>` : "";
    $("#main").innerHTML = `
      ${pageHeader(`${state.year} · ${state.quarter} DATA STRATEGY`, `${state.quarter} 成本与结果`, yearBadge())}
      <section class="certificate-price-strip"><div><small>2026 OFFICIAL CBAM CERTIFICATE PRICES</small><strong>2026 年按季度；2027 年起按周平均价格</strong><p>单位为 €/tCO₂，更新至 2026-10-10。项目计算必须保存实际采用的期间与价格版本。<a href="https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/price-cbam-certificates_en" target="_blank" rel="noopener">欧盟委员会原始价格页 ↗</a></p></div>${Object.entries(certificatePrices2026).map(([quarter, data]) => `<button type="button" class="price-cell ${state.year === "2026" && state.quarter === quarter ? "active" : ""}" data-quarter="${quarter}" aria-pressed="${state.year === "2026" && state.quarter === quarter}"><small>${quarter}</small><strong>${data.price}</strong><span>${data.published}</span></button>`).join("")}</section>
      <section class="scenario-intro"><div><small>当前认可路径 · ${state.quarter}</small><strong>自身实测 + 前体默认</strong><p>同一产品、数量、期间、证书价格和规则版本下比较。实测并不保证一定降低成本。</p></div><div class="recognized-saving"><small>相对默认基线已确认减少</small><strong>¥1.08m</strong><span>另有约 ¥0.47m 潜在变化待核查</span></div></section>
      <section class="scenario-board">
        <article><header><span>A</span><div><small>DEFAULT BASELINE</small><h2>默认基线</h2></div></header><strong>¥4.90m</strong><p>预计证书成本</p><dl><div><dt>数据构成</dt><dd>100% 适用默认值</dd></div><div><dt>单位排放</dt><dd>2.34 tCO₂e/t</dd></div><div><dt>准备工作</dt><dd>产品范围与数量</dd></div></dl><span class="scenario-state">保守比较基线</span></article>
        <article class="current"><header><span>B</span><div><small>CURRENT RECOGNIZED</small><h2>自身实测 + 前体默认</h2></div></header><strong>¥3.82m</strong><p>当前认可结果</p><dl><div><dt>数据构成</dt><dd>76% 实测 / 24% 默认</dd></div><div><dt>单位排放</dt><dd>1.83 tCO₂e/t</dd></div><div><dt>合规要求</dt><dd>监测计划、自身数据、核查</dd></div></dl><span class="scenario-state ok">当前核算 Run 04</span></article>
        <article><header><span>C</span><div><small>TARGET SCENARIO</small><h2>全链路实测</h2></div></header><strong>¥3.35m</strong><p>情景值 · 尚未认可</p><dl><div><dt>数据构成</dt><dd>预计 94% 实测</dd></div><div><dt>单位排放</dt><dd>1.60 tCO₂e/t</dd></div><div><dt>仍需完成</dt><dd>供应商数据与上游核查</dd></div></dl><span class="scenario-state warn">潜在变化，不是节省承诺</span></article>
      </section>
      ${decisionPanel}
      <section class="panel reduction-ledger"><div class="panel-head"><div><h2>${state.quarter} 成本变化台账</h2><span>每一项变化都能回到当期工作、证据与计算版本</span></div><button class="text-button" type="button">查看计算假设</button></div><table class="data-table"><thead><tr><th>已完成 / 待完成工作</th><th>替代内容</th><th>影响数量</th><th>排放强度变化</th><th>证书成本影响</th><th>认可状态</th></tr></thead><tbody><tr><td><strong>完成上海一厂实测</strong><small>年度监测计划 Rev 3</small></td><td>工厂默认值</td><td>6,500 t</td><td>2.10 → 1.72</td><td class="text-success"><strong>−¥620k</strong></td><td><span class="record-state ok">已复核</span></td></tr><tr><td><strong>获得供应商甲数据</strong><small>${state.quarter} Communication Form 草稿</small></td><td>钢坯默认值</td><td>2,100 t</td><td>1.85 → 1.54</td><td class="text-warning"><strong>约 −¥230k</strong></td><td><span class="record-state warn">待核查</span></td></tr><tr><td><strong>补齐 ${state.quarter} 天然气</strong><small>江苏二厂</small></td><td>缺失期估算</td><td>1 个季度</td><td>待计算</td><td>待计算</td><td><span class="record-state">待材料</span></td></tr></tbody></table><p class="scenario-disclaimer">情景金额为演示。实际结果可能升高或降低，以适用规则、认可数据、核查结论和当期证书价格为准；监测、核查和供应商协作成本应另行评估。</p></section>
      <div class="content-split result-content">
        <section class="panel flat-panel"><div class="panel-head"><h2>需要处理的缺口</h2><span>${resolved ? "1" : "2"} 个阻塞项</span></div><div class="finding-list">
          <article class="finding ${resolved ? "resolved" : ""}"><span class="finding-level">高</span><div><strong>${resolved ? "钢坯数据路径已确定" : "钢坯供应商排放数据缺失"}</strong><p>${resolved ? `已选择“${pathLabels[state.dataPathChoice] || pathLabels.parallel}”，等待后续证据。` : "影响两个产品的前体嵌入排放。可以向供应商索取，或先使用保守默认值。"}</p><small>GAP-PRE-004 · 影响 37% 总排放</small></div>${resolved ? `<span class="record-state ok">已记录决定</span>` : `<button class="button button--secondary" type="button" data-action="resolve-finding">选择处理方式</button>`}</article>
          <article class="finding"><span class="finding-level medium">中</span><div><strong>6 月电费单尚未关联设施</strong><p>Agent 已识别用电量，需要确认账单覆盖一厂还是两座设施。</p><small>GAP-ENE-012 · 不影响当前试算</small></div><button class="button button--secondary" type="button" data-page="work">去确认</button></article>
        </div></section>
        <aside class="panel trace-panel"><div class="panel-head"><h2>结果从哪里来</h2></div><ol class="trace-list"><li><span>01</span><div><strong>业务事实</strong><small>42 条已确认 · 3 条待确认</small></div></li><li><span>02</span><div><strong>活动数据与证据</strong><small>28 份材料 · 76% 实测覆盖</small></div></li><li><span>03</span><div><strong>确定性计算</strong><small>Engine 0.4 · Run 04</small></div></li><li><span>04</span><div><strong>规则校验</strong><small>EU-CBAM-2026.3 · 2 个 Finding</small></div></li></ol><button class="text-button trace-action" type="button">查看完整计算血缘 →</button></aside>
      </div>
      ${resolved ? nextAction("当前季度任务已完成", `准备 ${state.quarter} 进口商数据包`, "季度数据路径已记录；年度监测计划、排放报告和核查继续在年度交付区管理。", "检查季度与年度交付", 'data-page="deliverables"') : nextAction("当前季度任务", "先处理阻塞的数据路径", "明确临时使用默认值还是等待供应商数据，当前季度才能形成可交付版本。", "选择处理方式", 'data-action="resolve-finding"')}`;
  }

  function renderDeliverables() {
    const profile = annualProfile();
    const locked = profile.mode === "archived";
    const planned = profile.mode === "planned";
    const docs = [
      ["monitoring", "年度监测计划 / 监测报告", profile.monitoring[0], profile.monitoring[1]],
      ["emissions", "年度排放报告", profile.emissions[0], profile.emissions[1]],
      ["verification", "年度核查与 Verification Package", profile.verification[0], profile.verification[1]],
    ];
    const deliverySource = locked
      ? "最终事实 · Calculation Run 12 · Rulepack EU-CBAM-2025.4 · 已绑定核查快照。"
      : planned
        ? "尚未形成年度正式事实；当前仅引用长期主档，范围确认后才创建年度版本。"
        : "企业正式事实 · Calculation Run 04 · Rulepack EU-CBAM-2026.3 · 未确认项以 GAP 标记。";
    $("#main").innerHTML = `
      ${pageHeader(`${state.year} · COMPLIANCE DELIVERABLES`, "合规交付", yearBadge())}
      <div class="delivery-intro"><div><small>TWO CADENCES</small><strong>${locked ? "季度记录与年度文件均已封存" : planned ? "年度文件尚未开始，可以提前准备" : "季度反馈持续推进，年度文件集中完成"}</strong><p>${locked ? "所有文件保留交付时版本、规则和接收记录。" : planned ? "先确认年度范围，再生成监测计划草稿；年度排放报告和核查不会从上一年度复制。" : "季度数据包用于持续向进口商反馈；监测计划、排放报告和核查属于年度合规闭环。"}</p></div><div class="stage-line"><i class="${locked ? "done" : planned ? "current" : "done"}"></i><i class="${locked ? "done" : ""}"></i><i class="${locked ? "done" : ""}"></i><i class="${locked ? "done" : ""}"></i></div></div>
      <div class="responsibility-notice compact"><strong>交付支持不等于法定申报完成。</strong><p>季度包用于持续反馈；设施年度排放报告和核查报告按年度形成。正式年度 CBAM 申报与证书责任由欧盟进口商/授权 CBAM 申报人承担。</p></div>
      <section class="cadence-deliverables"><article class="panel"><div class="panel-head"><div><h2>季度数据包与进口商反馈</h2><small>运营节奏 · 每季重复</small></div><button class="text-button" type="button" data-page="data">查看 ${state.quarter} 数据</button></div><div class="quarter-package-list">${Object.entries(profile.quarters).map(([quarter, values]) => `<button type="button" class="quarter-package ${state.quarter === quarter ? "active" : ""}" data-quarter="${quarter}" aria-pressed="${state.quarter === quarter}"><span>${quarter}</span><strong>${locked ? "已交付 · 已回执" : values[0]}</strong><small>Communication Package</small></button>`).join("")}</div></article><article class="panel annual-rule"><div class="panel-head"><div><h2>年度排放与核查</h2><small>年度节奏 · 按设施形成</small></div></div><ol><li><span>01</span><div><strong>年度监测计划</strong><small>定义全年一致的监测方法、职责和控制</small></div></li><li><span>02</span><div><strong>设施年度排放报告</strong><small>基于全年批准数据，按设施形成</small></div></li><li><span>03</span><div><strong>设施核查报告</strong><small>由获授权的第三方核查员出具并关联报告版本</small></div></li></ol></article></section>
      <div class="guide-section-head"><div><small>ANNUAL DELIVERABLES</small><h2>年度文件与核查状态</h2></div><p>季度包不会替代年度报告与核查。</p></div>
      <section class="delivery-list">${docs.map(([id, name, status, note], index) => `<article class="delivery-row ${state.deliveryExpanded === id ? "expanded" : ""}"><span class="delivery-index">0${index + 1}</span><div><small>${["PLAN", "REPORT", "VERIFY"][index]}</small><h2>${name}</h2><p>${status}</p>${state.deliveryExpanded === id ? `<div class="delivery-detail"><strong>来源和版本</strong><p>${deliverySource}</p>${planned ? "" : `<button class="button button--secondary" type="button" data-action="document-preview">预览演示文件</button>`}</div>` : ""}</div><span class="delivery-note">${note}</span><button class="round-action" type="button" data-delivery="${id}" aria-label="展开 ${name}">${state.deliveryExpanded === id ? "−" : "+"}</button></article>`).join("")}</section>
      ${locked ? nextAction("年度已封存", "返回全年流程", "查看季度循环和年度闭环的完成记录。", "查看完整记录", 'data-page="roadmap"') : planned ? nextAction("年度准备", "先确认 2027 年度范围", "范围确认后，Agent 才会生成本年度监测计划草稿和 Q1 材料清单。", "确认年度范围", 'data-page="products"') : nextAction("年度工作", "继续完成 Q3 数据", "Q1、Q2 已完成；当前先完成 Q3，年度关账后再生成排放报告并启动核查。", "返回当前工作", 'data-page="work"')}`;
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
    const seededFacilities = cbamFacilityOptions().map((facility) => ({
      code: facility.payload?.internalCode || facility.id,
      name: facility.name,
      activity: facility.payload?.activity || "生产活动待补充",
      status: facility.payload?.operationalStatus || (facility.status === "CONFIRMED" ? "在用" : "待确认"),
      assetId: facility.id,
      versionId: facility.versionId,
    }));
    const facilityRows = [
      ...seededFacilities,
      ...state.facilities,
    ].map((facility) => `<article class="record"><span class="record-code">${safe(facility.code)}</span><div><strong>${safe(facility.name)}</strong><p>${safe(facility.activity || "生产活动待补充")}${facility.assetId ? ` · ${safe(facility.assetId)}` : ""}</p></div><button class="record-state ${facility.status === "在用" ? "ok" : "warn"}" type="button" data-drawer="record-detail" data-drawer-label="${safe(facility.name)}" data-drawer-object="${safe(facility.versionId || `设施 ${facility.code}`)}" data-drawer-status="${safe(facility.status)}" data-drawer-description="查看设施版本、生产活动、年度引用和数据源。">查看</button></article>`).join("");
    const facilityCount = seededFacilities.length + state.facilities.length;
    const orgAsset = assetRegistry.get("ORG-HX-001");
    $("#main").innerHTML = `
      ${pageHeader("PROGRAM MASTER DATA", "企业设置", actionButton("编辑企业资料", "secondary", 'data-action="toggle-org-edit"'))}
      <div class="master-data-note"><div><strong>这里维护长期主档</strong><p>企业、设施与产品写入企业数据资产池；年度项目引用当时有效的版本，修改不会覆盖已锁定年度。</p></div><span class="status-chip">主档完整度 91%</span></div>
      <div class="settings-layout"><nav class="settings-nav" aria-label="企业设置导航"><button class="active" type="button" data-drawer="organization-edit">企业与法定主体</button><button type="button" data-drawer="record-detail" data-drawer-label="生产设施主档" data-drawer-object="${facilityCount} 座设施">生产设施 <span>${facilityCount}</span></button><button type="button" data-drawer="permission-audit">组织与职责 <span>8</span></button><button type="button" data-drawer="record-detail" data-drawer-label="仪表与数据源" data-drawer-object="14 个数据源">仪表与数据源 <span>14</span></button><button type="button" data-drawer="record-detail" data-drawer-label="欧盟进口商目录" data-drawer-object="3 家进口商">欧盟进口商 <span>3</span></button><button type="button" data-drawer="record-detail" data-drawer-label="供应商目录" data-drawer-object="12 家供应商">供应商目录 <span>12</span></button><button type="button" data-drawer="permission-audit">授权与审计</button></nav>
        <section class="settings-main">
          <article class="panel master-section"><div class="panel-head"><div><h2>法定主体</h2><span>${safe(orgAsset?.versionId || "ORG-HX-001")} · 当前有效</span></div><span class="record-state ok">已验证</span></div><dl class="master-fields"><div><dt>法定名称</dt><dd>${safe(state.organization.name)}</dd></div><div><dt>统一社会信用代码</dt><dd>${safe(state.organization.code)}</dd></div><div><dt>注册地址</dt><dd>${safe(state.organization.address)}</dd></div><div><dt>企业管理员</dt><dd>周岚 · zhou.lan@huaxing.cn</dd></div></dl></article>
          <article class="panel master-section"><div class="panel-head"><div><h2>生产设施</h2><span>企业数据资产 · ${facilityCount} 座</span></div><button class="text-button" type="button" data-drawer="new-facility">＋ 新建设施</button></div><div class="record-list">${facilityRows}</div></article>
          <article class="panel master-section"><div class="panel-head"><div><h2>组织与职责</h2><span>新年度会询问是否变化</span></div><button class="text-button" type="button" data-drawer="permission-audit">查看全部 8 个职责</button></div><div class="responsibility-grid"><div><small>企业管理员</small><strong>周岚</strong><span>账号与长期主档</span></div><div><small>CBAM 协调人</small><strong>周岚</strong><span>年度项目推进</span></div><div><small>生产数据</small><strong>陈浩</strong><span>${safe(assetRegistry.get("FAC-SH-01")?.name || "上海一厂")}</span></div><div><small>内部审批</small><strong>赵总</strong><span>交付与风险路径</span></div></div></article>
        </section>
      </div>`;
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
