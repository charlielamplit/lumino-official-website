"use strict";

  function renderExpert() {
    if (state.page !== "queue") return renderStaffSecondary("expert");
    $("#main").innerHTML = `
      <div data-template="T1">
      ${pageHeader("工作队列 · 制备专家", "今天最重要：确认钢坯前体来源", '<p class="head-note">按计算影响、截止日期和置信度排序。任何修改都保留理由、规则版本与重算记录。</p>')}
      <div class="metric-line"><div><span>待判断</span><strong>12</strong><small>项</small></div><div><span>阻塞核算</span><strong>5</strong><small>项</small></div><div><span>本周到期</span><strong>7</strong><small>项</small></div><div><span>待独立复核</span><strong>3</strong><small>项</small></div></div>
      <div class="staff-layout">
        <section class="panel"><div class="panel-head"><h2>案件队列</h2><button class="text-button" type="button" data-drawer="record-detail" data-drawer-label="判断队列筛选">筛选 ▾</button></div><div class="case-list">
          <button class="case-item active" type="button" data-drawer="record-detail" data-drawer-label="确认钢坯前体来源" data-drawer-object="华星钢铁 · 2026 Q3" data-drawer-status="阻塞正式核算" data-drawer-action="进入案件工作台"><span><strong>华星钢铁 · 2026 Q3</strong><em>高影响</em></span><p>确认钢坯前体来源</p><small>阻塞正式核算 · 今天</small></button>
          <button class="case-item" type="button" data-drawer="record-detail" data-drawer-label="分配方法与产量口径" data-drawer-object="远航铝业 · 2026" data-drawer-status="Finding #24"><span><strong>远航铝业 · 2026</strong><em>核查中</em></span><p>分配方法与产量口径不一致</p><small>Finding #24 · 4 小时后</small></button>
          <button class="case-item" type="button" data-drawer="record-detail" data-drawer-label="CN Code 候选冲突" data-drawer-object="新锐紧固件 · 2027"><span><strong>新锐紧固件 · 2027</strong></span><p>CN Code 候选存在冲突</p><small>需查看产品说明 · 明天</small></button>
          <button class="case-item" type="button" data-drawer="record-detail" data-drawer-label="供应商排放数据边界" data-drawer-object="北辰化工 · 2027"><span><strong>北辰化工 · 2027</strong></span><p>供应商排放数据边界不完整</p><small>证据已上传 · 周五</small></button>
        </div></section>
        <section class="panel case-detail"><div class="case-meta"><span class="status-chip warn">阻塞核算</span><span class="status-chip">置信度 71%</span></div><h2>钢坯是自产，还是外购前体？</h2><p>客户原话：“一部分从集团北方厂调过来，一部分从本地供应商买。”Agent 判断不能用单一答案覆盖全部批次。</p>
          <div class="comparison"><article><small>Agent Proposal</small><strong>按采购台账将 63% 标记为外购，37% 标记为集团内部供应。</strong></article><article><small>Canonical Data</small><strong>尚未确认 · 当前年度核算被阻塞</strong></article></div>
          <div class="evidence-box"><h3>依据与版本</h3><p>采购台账_2026_Q3.xlsx · Sheet 供应商明细；生产说明_v2.pdf；Rulepack EU-CBAM-2026.3。Q3 新增“北方特钢”来源。</p></div>
          <div class="action-bar"><button class="button button--primary" type="button" data-staff-action="接受并拆分来源">接受并拆分来源</button><button class="button button--secondary" type="button" data-staff-action="修改 Agent 建议">修改建议</button><button class="button button--secondary" type="button" data-staff-action="退回客户确认并说明所需业务事实">退回客户确认</button></div>
        </section>
      </div>
      </div>`;
  }

  function renderOps() {
    if (state.page === "leads") return renderLeadsInbox();
    if (state.page === "knowledge") return renderKnowledgeInbox();
    if (state.page === "workflow-governance") return renderWorkflowGovernance();
    if (state.page !== "portfolio") return renderStaffSecondary("ops");
    $("#main").innerHTML = `
      ${pageHeader("OPERATIONS PORTFOLIO", "本周有 8 个项目需要干预。", '<p class="head-note">这里显示节奏、责任人和阻塞类别，不默认展示客户 BOM、账单全文或供应商价格。</p>')}
      <div class="metric-line"><div><span>数据采集</span><strong>18</strong><small>项目</small></div><div><span>内部复核</span><strong>7</strong><small>项目</small></div><div><span>核查中</span><strong>5</strong><small>项目</small></div><div><span>SLA 风险</span><strong>8</strong><small>项目</small></div></div>
      <div class="callout"><strong>建议动作：</strong> 两名专家本周负载超过 90%。将 3 个低复杂度 CN Code 复核任务转派给备用专家，可恢复 2 个项目的交付日期。</div>
      <section class="panel wide-panel"><div class="panel-head"><h2>项目组合</h2><button class="text-button" type="button" data-staff-action="生成仅含项目状态、SLA 与责任人的进度摘要">导出进度摘要</button></div><table class="data-table"><thead><tr><th>客户 / 年度</th><th>阶段</th><th>准备度</th><th>主要阻塞</th><th>负责人</th><th>SLA</th></tr></thead><tbody>
        <tr><td><strong>华星钢铁</strong><small>2026 · Q3</small></td><td><span class="status-chip">数据采集</span></td><td class="bar-cell">68%<span class="mini-bar"><i style="width:68%"></i></span></td><td>供应商来源待确认</td><td>王晨</td><td>2 天</td></tr>
        <tr><td><strong>远航铝业</strong><small>2026</small></td><td><span class="status-chip warn">核查整改</span></td><td class="bar-cell">88%<span class="mini-bar"><i style="width:88%"></i></span></td><td>Finding #24</td><td>李明</td><td><strong class="text-danger">今天</strong></td></tr>
        <tr><td><strong>新锐紧固件</strong><small>2027</small></td><td><span class="status-chip">范围确认</span></td><td class="bar-cell">31%<span class="mini-bar"><i style="width:31%"></i></span></td><td>CN Code 待专家判断</td><td>王晨</td><td>4 天</td></tr>
        <tr><td><strong>北辰化工</strong><small>2027</small></td><td><span class="status-chip warn">采集延期</span></td><td class="bar-cell">48%<span class="mini-bar"><i style="width:48%"></i></span></td><td>外部供应商未回复</td><td>周敏</td><td><strong class="text-danger">逾期 1 天</strong></td></tr>
      </tbody></table></section>`;
  }

  function serviceLabel(id) {
    return ({ cbam: "CBAM", pcf: "PCF", esg: "ESG", inventory: "碳盘查", assets: "碳资产", export: "出口合规" })[id] || id;
  }

  function leadStatusChip(status) {
    const labels = window.LuminoLeadsClient?.STATUS_LABELS || {};
    const warn = ["new", "claimed"].includes(status);
    return `<span class="status-chip${warn ? " warn" : ""}">${safe(labels[status] || status || "new")}</span>`;
  }

  function refreshPublicLeads(options = {}) {
    const client = window.LuminoLeadsClient;
    if (!client) {
      state.publicLeads = [];
      state.leadsSource = "none";
      if (options.render !== false && ["sales", "ops"].includes(state.role) && state.page === "leads") render();
      return Promise.resolve();
    }
    if (!state.publicLeads?.length) state.publicLeads = client.readLocal();
    return client.fetchLeads().then(({ leads, source }) => {
      state.publicLeads = leads;
      state.leadsSource = source;
      if (!state.selectedLeadId && leads[0]) state.selectedLeadId = leads[0].id;
      if (state.selectedLeadId && !leads.some((lead) => lead.id === state.selectedLeadId)) {
        state.selectedLeadId = leads[0]?.id || null;
      }
      if (options.render !== false && ["sales", "ops"].includes(state.role) && state.page === "leads") render();
    });
  }

  function renderLeadsInbox() {
    const leads = Array.isArray(state.publicLeads) ? state.publicLeads : [];
    const selected = leads.find((lead) => lead.id === state.selectedLeadId) || leads[0] || null;
    if (selected && state.selectedLeadId !== selected.id) state.selectedLeadId = selected.id;
    const openCount = leads.filter((lead) => lead.status === "new").length;
    const claimedCount = leads.filter((lead) => lead.status === "claimed").length;
    const sourceNote = state.leadsSource === "api+local"
      ? "已合并服务端线索库与本机缓存。"
      : state.leadsSource === "local"
        ? "当前显示本机线索箱（静态预览或 API 未接通时）。"
        : "线索客户端未加载。";

    const listHtml = leads.length
      ? leads.map((lead) => {
          const active = selected && selected.id === lead.id ? " active" : "";
          const services = (lead.services || []).map(serviceLabel).join(" · ") || "未选服务";
          return `<button class="case-item${active}" type="button" data-lead-select="${safe(lead.id)}"><span><strong>${safe(lead.company)}</strong><em>${safe(lead.name)}</em></span><p>${safe(services)}</p><small>${leadStatusChip(lead.status)} · ${safe(String(lead.createdAt || "").slice(0, 16).replace("T", " "))}</small></button>`;
        }).join("")
      : `<div class="callout"><strong>暂无公开线索。</strong>官网联系表或试算解锁提交后会出现在此收件箱。客户租户角色不会看到本池。</div>`;

    const detailHtml = selected
      ? `<div class="case-meta">${leadStatusChip(selected.status)}${selected.localOnly ? '<span class="status-chip">本机</span>' : '<span class="status-chip">已入库</span>'}</div>
          <h2>${safe(selected.company)}</h2>
          <p>${safe(selected.note || "（无需求说明）")}</p>
          <dl class="detail-ledger" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0">
            <div><dt>联系人</dt><dd>${safe(selected.name)}</dd></div>
            <div><dt>回执号</dt><dd>${safe(selected.id)}</dd></div>
            <div><dt>手机 / 微信</dt><dd>${safe(selected.phone || "—")}</dd></div>
            <div><dt>邮箱</dt><dd>${safe(selected.email || "—")}</dd></div>
            <div><dt>行业</dt><dd>${safe(selected.industry || "—")}</dd></div>
            <div><dt>时间要求</dt><dd>${safe(selected.timeline || "—")}</dd></div>
            <div><dt>服务</dt><dd>${safe((selected.services || []).map(serviceLabel).join("、") || "—")}</dd></div>
            <div><dt>来源</dt><dd>${safe(selected.source || "—")}</dd></div>
            <div><dt>认领人</dt><dd>${safe(selected.claimedBy || "未认领")}</dd></div>
            <div><dt>更新</dt><dd>${safe(String(selected.updatedAt || selected.createdAt || "").replace("T", " ").slice(0, 19))}</dd></div>
          </dl>
          ${(selected.notes || []).length ? `<div class="evidence-box"><h3>备注</h3>${selected.notes.map((note) => `<p><small>${safe(note.by)} · ${safe(String(note.at || "").slice(0, 16))}</small><br>${safe(note.text)}</p>`).join("")}</div>` : ""}
          <div class="action-bar">
            ${selected.status === "new" ? `<button class="button button--primary" type="button" data-lead-action="claim" data-lead-id="${safe(selected.id)}">认领</button>` : ""}
            ${selected.status === "claimed" || selected.status === "new" ? `<button class="button button--secondary" type="button" data-lead-action="qualify" data-lead-id="${safe(selected.id)}">确认意向</button><button class="button button--secondary" type="button" data-lead-action="disqualify" data-lead-id="${safe(selected.id)}">排除</button>` : ""}
            ${["qualified", "claimed"].includes(selected.status) ? `<button class="button button--primary" type="button" data-lead-action="convert" data-lead-id="${safe(selected.id)}">标记已转化</button>` : ""}
            <button class="button button--secondary" type="button" data-lead-action="note" data-lead-id="${safe(selected.id)}">添加备注</button>
            <button class="button button--secondary" type="button" data-lead-action="refresh">刷新</button>
          </div>`
      : `<p class="muted">选择左侧线索查看详情。专家与客户角色默认不可见未成交线索池。</p>`;

    $("#main").innerHTML = `
      ${pageHeader("PUBLIC LEADS INBOX", "官网与试算线索收件箱", `<p class="head-note">${sourceNote} 仅商务 / 运营可见；成交后再开客户租户。</p>`)}
      <div class="metric-line"><div><span>全部</span><strong>${leads.length}</strong></div><div><span>待认领</span><strong>${openCount}</strong></div><div><span>跟进中</span><strong>${claimedCount}</strong></div><div><span>角色</span><strong>${safe(roleConfig[state.role].title)}</strong></div></div>
      <div class="privacy-band"><strong>边界</strong><span>此处是销售漏斗前端，不是完整 CRM；不含生产证据与专家内部意见。</span></div>
      <div class="staff-layout">
        <section class="panel"><div class="panel-head"><h2>线索列表</h2><button class="text-button" type="button" data-lead-action="refresh">刷新</button></div><div class="case-list">${listHtml}</div></section>
        <section class="panel case-detail">${detailHtml}</section>
      </div>`;

    if (!state.leadsHydrated) {
      state.leadsHydrated = true;
      refreshPublicLeads({ render: true });
    }
  }

  function renderSales() {
    if (state.page === "leads") return renderLeadsInbox();
    if (state.page === "knowledge") return renderKnowledgeInbox();
    return renderStaffSecondary("sales");
  }

  function knowledgeStatusChip(status) {
    const labels = window.LuminoKnowledgeClient?.STATUS_LABELS || {};
    const warn = status === "draft";
    const muted = status === "archived";
    return `<span class="status-chip${warn ? " warn" : ""}${muted ? "" : ""}">${safe(labels[status] || status || "draft")}</span>`;
  }

  function refreshKnowledgeArticles(options = {}) {
    const client = window.LuminoKnowledgeClient;
    const roles = ["sales", "ops", "platform_admin"];
    if (!client) {
      state.knowledgeArticles = [];
      state.knowledgeSource = "none";
      if (options.render !== false && roles.includes(state.role) && state.page === "knowledge") render();
      return Promise.resolve();
    }
    return client.fetchArticles({ publicOnly: false }).then(({ articles, source }) => {
      state.knowledgeArticles = articles;
      state.knowledgeSource = source;
      if (!state.selectedKnowledgeId && articles[0]) state.selectedKnowledgeId = articles[0].id;
      if (state.selectedKnowledgeId && !articles.some((a) => a.id === state.selectedKnowledgeId)) {
        state.selectedKnowledgeId = articles[0]?.id || null;
      }
      if (options.render !== false && roles.includes(state.role) && state.page === "knowledge") render();
    }).catch(() => {
      state.knowledgeArticles = [];
      state.knowledgeSource = "none";
      if (options.render !== false && roles.includes(state.role) && state.page === "knowledge") render();
    });
  }

  function renderKnowledgeInbox() {
    const articles = Array.isArray(state.knowledgeArticles) ? state.knowledgeArticles : [];
    const selected = articles.find((a) => a.id === state.selectedKnowledgeId) || articles[0] || null;
    if (selected && state.selectedKnowledgeId !== selected.id) state.selectedKnowledgeId = selected.id;
    const published = articles.filter((a) => a.status === "published").length;
    const draft = articles.filter((a) => a.status === "draft").length;
    const archived = articles.filter((a) => a.status === "archived").length;
    const sourceNote = state.knowledgeSource === "api"
      ? "已连接知识库 API；状态变更会写入服务端覆盖层。"
      : state.knowledgeSource === "catalog"
        ? "当前读取静态 catalog（本地预览）。状态变更会先写入本机缓存。"
        : "知识库客户端未加载。";

    const listHtml = articles.length
      ? articles.map((article) => {
          const active = selected && selected.id === article.id ? " active" : "";
          const title = article.title?.zh || article.title?.en || article.id;
          return `<button class="case-item${active}" type="button" data-knowledge-select="${safe(article.id)}"><span><strong>${safe(title)}</strong><em>${safe(article.serviceId || "")}</em></span><p>${safe(article.typeLabel?.zh || article.type || "")} · ${safe(article.industryLabel?.zh || "")}</p><small>${knowledgeStatusChip(article.status)} · ${safe(article.updatedAt || "")}</small></button>`;
        }).join("")
      : `<div class="callout"><strong>暂无文章。</strong>在 <code>apps/site/knowledge/catalog.json</code> 与 <code>content/</code> 中维护 Markdown 后会出现在此。</div>`;

    const publicUrl = selected && window.LuminoKnowledgeClient
      ? window.LuminoKnowledgeClient.publicHref(selected.id)
      : "#";
    const detailHtml = selected
      ? `<div class="case-meta">${knowledgeStatusChip(selected.status)}<span class="status-chip">${safe(selected.serviceId || "—")}</span></div>
          <h2>${safe(selected.title?.zh || selected.id)}</h2>
          <p>${safe(selected.lead?.zh || "")}</p>
          <p class="muted">${safe(selected.title?.en || "")}</p>
          <dl class="detail-ledger" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0">
            <div><dt>ID</dt><dd>${safe(selected.id)}</dd></div>
            <div><dt>更新</dt><dd>${safe(selected.updatedAt || "—")}</dd></div>
            <div><dt>类型</dt><dd>${safe(selected.typeLabel?.zh || selected.type || "—")}</dd></div>
            <div><dt>行业</dt><dd>${safe(selected.industryLabel?.zh || "—")}</dd></div>
            <div><dt>中文 MD</dt><dd><code style="font-size:12px">${safe(selected.paths?.zh || "—")}</code></dd></div>
            <div><dt>英文 MD</dt><dd><code style="font-size:12px">${safe(selected.paths?.en || "—")}</code></dd></div>
          </dl>
          ${(selected.notes || []).length ? `<div class="evidence-box"><h3>备注</h3>${selected.notes.map((note) => `<p><small>${safe(note.by)} · ${safe(String(note.at || "").slice(0, 16))}</small><br>${safe(note.text)}</p>`).join("")}</div>` : ""}
          <div class="action-bar">
            ${selected.status !== "published" ? `<button class="button button--primary" type="button" data-knowledge-action="publish" data-knowledge-id="${safe(selected.id)}">发布</button>` : ""}
            ${selected.status === "published" ? `<button class="button button--secondary" type="button" data-knowledge-action="draft" data-knowledge-id="${safe(selected.id)}">改回草稿</button>` : ""}
            ${selected.status !== "archived" ? `<button class="button button--secondary" type="button" data-knowledge-action="archive" data-knowledge-id="${safe(selected.id)}">下架</button>` : `<button class="button button--secondary" type="button" data-knowledge-action="draft" data-knowledge-id="${safe(selected.id)}">恢复为草稿</button>`}
            <button class="button button--secondary" type="button" data-knowledge-action="note" data-knowledge-id="${safe(selected.id)}">添加备注</button>
            <a class="button button--secondary" href="${safe(publicUrl)}" target="_blank" rel="noopener">预览官网</a>
            <button class="button button--secondary" type="button" data-knowledge-action="refresh">刷新</button>
          </div>
          <p class="muted" style="margin-top:12px">正文以 Git 中的 Markdown 为准；此处只改发布状态与备注，不提供富文本编辑。</p>`
      : `<p class="muted">选择左侧文章管理发布状态。客户租户不可见本页。</p>`;

    $("#main").innerHTML = `
      ${pageHeader("KNOWLEDGE CATALOG", "官网知识库运营", `<p class="head-note">${sourceNote} 运营 / 商务 / 平台管理员可改状态；正文仍走 PR。</p>`)}
      <div class="metric-line"><div><span>全部</span><strong>${articles.length}</strong></div><div><span>已发布</span><strong>${published}</strong></div><div><span>草稿</span><strong>${draft}</strong></div><div><span>已下架</span><strong>${archived}</strong></div></div>
      <div class="privacy-band"><strong>边界</strong><span>状态覆盖写在服务端 data 层或本机缓存；catalog.json + content/*.md 仍是 Git 源。</span></div>
      <div class="staff-layout">
        <section class="panel"><div class="panel-head"><h2>文章列表</h2><button class="text-button" type="button" data-knowledge-action="refresh">刷新</button></div><div class="case-list">${listHtml}</div></section>
        <section class="panel case-detail">${detailHtml}</section>
      </div>`;

    if (!state.knowledgeHydrated) {
      state.knowledgeHydrated = true;
      refreshKnowledgeArticles({ render: true });
    }
  }

  function renderStaffSecondary(role) {
    if (role === "expert" && state.page === "case-workspace") {
      $("#main").innerHTML = `${pageHeader("AUTHORIZED CASE WORKSPACE", "华星钢铁 · 2026 Q3", statusChip("WP-CALC-026 · 已分派"))}
        <div class="privacy-band"><strong>授权边界</strong><span>SO-2026-018 · 2 座设施 · 4 个产品 · 有效至 2027-03-31。合同价格、回款与商务备注不可见。</span></div>
        <section class="case-ledger"><div><small>服务订单</small><strong>SO-2026-018</strong><span>年度全流程服务</span></div><div><small>工作包</small><strong>WP-CALC-026</strong><span>计算与报告制备</span></div><div><small>当前规则</small><strong>EU-CBAM-2026.3</strong><span>Report Schema 3.2</span></div><div><small>专业 SLA</small><strong>余 1 天 6 小时</strong><span>运营：林晓</span></div></section>
        <div class="content-split case-workspace"><section class="panel"><div class="panel-head"><div><h2>对象与证据关系</h2><span>同一事实，不同视图</span></div><button class="text-button" type="button" data-staff-action="已打开证据定位器">查看原件</button></div><div class="relationship-map"><div><small>产品</small><strong>热轧非合金钢卷</strong><span>CN 7208 · 已确认</span></div><i>→</i><div><small>生产配置</small><strong>上海一厂 · 外购钢坯</strong><span>43% 年度产量</span></div><i>→</i><div><small>前体</small><strong>北方特钢钢坯</strong><span>Communication Form 待补</span></div></div><div class="comparison"><article><small>客户业务回答</small><strong>“集团北方厂和本地供应商都有，需要按采购批次区分。”</strong></article><article><small>Canonical Data</small><strong>63% 外购 / 37% 集团内部供应 · 待复核</strong></article></div></section><aside class="panel"><div class="panel-head"><h2>计算与修订</h2></div><ol class="compact-checklist"><li><span>04</span><div><strong>Calculation Run 04</strong><small>当前认可 · 2026-10-08</small></div></li><li><span>03</span><div><strong>Run 03</strong><small>供应商映射调整后失效</small></div></li><li><span>!</span><div><strong>1 个开放 Finding</strong><small>供应商边界说明不完整</small></div></li></ol><div class="action-bar"><button class="button button--primary" type="button" data-staff-action="已创建带理由的重算请求">发起重算</button><button class="button button--secondary" type="button" data-page="findings">查看 Finding</button></div></aside></div>`;
      return;
    }
    if (role === "expert" && state.page === "findings") {
      $("#main").innerHTML = `${pageHeader("EXPERT FINDINGS", "Findings", '<p class="head-note">Finding 只能在证据、规则或具名风险接受满足条件后关闭，Agent 无权自行关闭。</p>')}
        <div class="metric-line"><div><span>开放</span><strong>7</strong></div><div><span>客户响应中</span><strong>4</strong></div><div><span>等待重算</span><strong>2</strong></div><div><span>逾期</span><strong>1</strong></div></div>
        <section class="panel wide-panel"><div class="panel-head"><h2>跨项目发现</h2><button class="text-button" type="button">严重性 ▾</button></div><table class="data-table"><thead><tr><th>Finding</th><th>客户 / 年度</th><th>影响</th><th>负责人</th><th>状态</th><th>下一步</th></tr></thead><tbody>
          <tr><td><strong>PRE-004</strong><small>供应商排放数据缺失</small></td><td>华星钢铁 · 2026 Q3</td><td>37% 总排放</td><td>王晨</td><td><span class="record-state warn">已响应</span></td><td><button class="text-button" type="button" data-staff-action="已发起证据复核">复核证据</button></td></tr>
          <tr><td><strong>VER-018</strong><small>月度电耗异常</small></td><td>远航铝业 · 2026</td><td>核查结论</td><td>李明</td><td><span class="record-state warn">待客户</span></td><td>今天到期</td></tr>
          <tr><td><strong>CLS-009</strong><small>CN Code 候选冲突</small></td><td>新锐紧固件 · 2027</td><td>适用范围</td><td>王晨</td><td><span class="record-state">专家判断</span></td><td>查看产品说明</td></tr>
          <tr><td><strong>ENE-012</strong><small>账单未关联设施</small></td><td>华星钢铁 · 2026 Q3</td><td>间接排放</td><td>周岚</td><td><span class="record-state">非阻塞</span></td><td>客户确认</td></tr>
        </tbody></table></section>`;
      return;
    }
    if (role === "reviewer" && state.page === "review") {
      const pcfCase = workflowEngine.get("PCF-2026-001");
      const pcfReport = workflowEngine.get("PCF-RPT-2026-001-R1");
      if (pcfCase?.status === "EXPERT_REVIEW") {
        $("#main").innerHTML = reviewSuiteShell({
          meta: "INDEPENDENT PCF REVIEW",
          title: "复核与锁定",
          aside: statusChip("1 个 PCF 待复核", "warn"),
          note: "客户已确认业务事实，计算引擎已生成可重现草稿；只有独立复核员可以批准并锁定本报告版本。",
          queueTitle: "待复核交付件",
          queueMeta: '<span class="record-state warn">优先</span>',
          queueItems: `
            <div class="stack-row active"><span>华星钢铁 · 产品碳足迹</span><strong>热轧非合金钢卷 PCF 报告</strong><small>${safe(pcfReport?.id || "PCF-RPT-2026-001-R1")} · ${safe(pcfReport ? workflowStateLabel(pcfReport.status) : "草稿待生成")}</small></div>
            <div class="stack-row"><span>华星钢铁 · 2026 Q3</span><strong>CBAM 数据包 Rev 2</strong><small>制备：王晨 · 常规队列</small></div>`,
          decisionKicker: "PCF REPORT · REV 1 DRAFT",
          decisionTitle: "热轧非合金钢卷产品碳足迹报告",
          decisionLead: "计算运行 ARUN-PCF-001 已固定输入快照；批准后将锁定报告与 SNAP-PCF-HRC-01，不再静默替换输入版本。",
          decisionPoints: `
            <li><span>✓</span><div><strong>目标、功能单位与边界一致</strong><small>从摇篮到大门 · 1 吨产品</small></div></li>
            <li><span>✓</span><div><strong>证据与服务绑定可追溯</strong><small>企业资产确认与 PCF 使用确认相互独立</small></div></li>
            <li><span>✓</span><div><strong>确定性计算可重现</strong><small>ARUN-PCF-001 · CN-EF-2026.1</small></div></li>
            <li><span>4</span><div><strong>复核限制、不确定性与版本声明</strong><small>由当前独立复核员具名完成</small></div></li>`,
          approveLabel: "批准并锁定 Rev 1",
          approveAttrs: 'data-action="pcf-complete-review"',
          secondaryLabel: "查看报告草稿",
          secondaryAttrs: 'data-drawer="pcf-report-preview"',
        });
        return;
      }
      $("#main").innerHTML = reviewSuiteShell({
        meta: "INDEPENDENT REVIEW",
        title: "复核与锁定",
        aside: statusChip("3 个待复核", "warn"),
        note: "你不能批准自己制备的最终交付件。下列项目已自动排除制单人与复核人相同的情况。",
        queueTitle: "待复核交付件",
        queueMeta: '<button class="text-button" type="button" data-drawer="record-detail" data-drawer-label="复核队列排序">按风险排序</button>',
        queueItems: `
          <button type="button" class="stack-row active" data-drawer="record-detail" data-drawer-label="Q3 计算与数据包 Rev 2" data-drawer-object="华星钢铁 · 2026 Q3" data-drawer-status="待独立复核"><span>华星钢铁 · 2026 Q3</span><strong>Q3 计算与数据包 Rev 2</strong><small>制备：王晨 · 与当前复核人不同</small></button>
          <button type="button" class="stack-row" data-drawer="record-detail" data-drawer-label="排放报告 Amendment 2" data-drawer-object="远航铝业 · 2026"><span>远航铝业 · 2026</span><strong>排放报告 Amendment 2</strong><small>制备：李明 · 1 小时前</small></button>
          <button type="button" class="stack-row" data-drawer="record-detail" data-drawer-label="Calculation Run 08" data-drawer-object="北辰化工 · 2027"><span>北辰化工 · 2027</span><strong>Calculation Run 08</strong><small>制备：周敏 · 昨天</small></button>`,
        decisionKicker: "QUARTERLY PACKAGE · REV 2",
        decisionTitle: "华星钢铁 2026 Q3 数据包",
        decisionLead: "22 项要素中 21 项已通过结构校验；1 项采用具名风险接受。",
        decisionPoints: `
          <li><span>✓</span><div><strong>范围与工艺一致</strong><small>4 个产品、2 个设施均有确认关系</small></div></li>
          <li><span>✓</span><div><strong>证据血缘完整</strong><small>42 条事实可回溯至 28 份材料</small></div></li>
          <li><span>!</span><div><strong>供应商数据仍使用默认值</strong><small>客户已批准保守路径，Finding 保持开放</small></div></li>`,
        approveLabel: "复核通过",
        approveAttrs: 'data-action="cbam-review-calculation"',
        rejectLabel: "退回修改",
        rejectAttrs: 'data-staff-action="退回复核件并要求制备人修改"',
      });
      return;
    }
    if (role === "ops" && state.page === "engagements") {
      $("#main").innerHTML = `${pageHeader("SERVICE ORDER DELIVERY", "订单履约", statusChip("3 个需要运营动作", "warn"))}
        <div class="privacy-band"><strong>运营可见范围</strong><span>可管理服务范围、SLA、团队与交接；不展示合同价格、客户 BOM、供应商价格或原始凭证正文。</span></div>
        <section class="panel wide-panel"><div class="panel-head"><div><h2>履约中的服务订单</h2><span>合同签署后由商务正式移交</span></div><button class="text-button" type="button">服务负责人 ▾</button></div><table class="data-table"><thead><tr><th>服务订单</th><th>客户 / 年度</th><th>购买范围</th><th>团队</th><th>SLA / 健康度</th><th>运营动作</th></tr></thead><tbody><tr><td><strong>SO-2026-018</strong><small>年度全流程</small></td><td>华星钢铁 · 2026 Q3</td><td>2 设施 · 4 产品 · 3 进口商</td><td>林晓 / 王晨 / 李娜</td><td><span class="record-state ok">正常</span><small>下次交付 10 月 18 日</small></td><td><button class="text-button" type="button" data-staff-action="已打开华星钢铁履约详情">管理履约</button></td></tr><tr><td><strong>SO-2026-011</strong><small>核查支持</small></td><td>远航铝业 · 2026</td><td>1 设施 · 2 产品</td><td>孙宁 / 李明</td><td><span class="record-state warn">Finding 逾期</span></td><td><button class="text-button" type="button" data-staff-action="已创建运营升级单">创建升级单</button></td></tr><tr><td><strong>SO-2027-022</strong><small>首年建档</small></td><td>北辰化工 · 2027</td><td>范围待客户确认</td><td>待分配专家</td><td><span class="record-state warn">待启动</span></td><td><button class="text-button" type="button" data-staff-action="已进入项目启动与人员分派">启动项目</button></td></tr></tbody></table></section>`;
      return;
    }
    if (role === "ops" && state.page === "handoffs") {
      $("#main").innerHTML = `${pageHeader("CONTROLLED HANDOFFS", "交接中心", statusChip("2 项等待接收", "warn"))}
        <section class="handoff-flow" aria-label="标准交接链"><span class="done">商务</span><i>→</i><span class="current">运营</span><i>→</i><span>制备专家</span><i>→</i><span>独立复核</span><i>→</i><span>客户审批</span></section>
        <section class="panel wide-panel"><div class="panel-head"><div><h2>待处理交接</h2><span>每次交接都有范围、资料、完成条件和接收确认</span></div></div><table class="data-table"><thead><tr><th>交接单</th><th>从 / 到</th><th>服务订单</th><th>交接内容</th><th>完成条件</th><th>状态</th></tr></thead><tbody><tr><td><strong>HO-2027-043</strong><small>今天 09:20</small></td><td>商务 → 运营</td><td>SO-2027-022</td><td>已签合同、客户联系人、首年建档范围</td><td>运营确认团队与启动日</td><td><button class="button button--primary" type="button" data-staff-action="已接收交接并启动 SLA">接收</button></td></tr><tr><td><strong>HO-2026-041</strong><small>昨天</small></td><td>专家 → 客户</td><td>SO-2026-018</td><td>供应商默认值风险路径</td><td>客户审批人具名决定</td><td><span class="record-state warn">等待客户</span></td></tr></tbody></table></section>`;
      return;
    }
    if (role === "ops" && state.page === "sla") {
      $("#main").innerHTML = `${pageHeader("SERVICE LEVEL CONTROL", "SLA 与阻塞", '<p class="head-note">运营看到“哪类材料、谁负责、何时到期”，不会展开材料正文或逐项排放底稿。</p>')}
        <div class="metric-line"><div><span>今日到期</span><strong>5</strong></div><div><span>已逾期</span><strong>2</strong></div><div><span>等待客户</span><strong>9</strong></div><div><span>等待专家</span><strong>6</strong></div></div>
        <section class="panel wide-panel"><div class="panel-head"><h2>需要干预</h2><button class="text-button" type="button">责任方 ▾</button></div><table class="data-table"><thead><tr><th>项目</th><th>阻塞类别</th><th>责任方</th><th>已等待</th><th>承诺时间</th><th>运营动作</th></tr></thead><tbody>
          <tr><td><strong>远航铝业 · 2026</strong><small>核查整改</small></td><td>客户解释月度异常</td><td>孙哲 · EHS</td><td>3 天</td><td class="text-danger">今天 16:00</td><td><button class="text-button" type="button" data-staff-action="已发送温和提醒">提醒</button></td></tr>
          <tr><td><strong>华星钢铁 · 2026 Q3</strong><small>数据采集</small></td><td>供应商来源确认</td><td>周岚 · 协调人</td><td>18 小时</td><td>明天</td><td>已安排 Agent 任务</td></tr>
          <tr><td><strong>北辰化工 · 2027</strong><small>供应商协同</small></td><td>外部回函</td><td>采购部</td><td>6 天</td><td class="text-danger">逾期 1 天</td><td><button class="text-button" type="button" data-staff-action="已升级给客户协调人">升级</button></td></tr>
        </tbody></table></section>`;
      return;
    }
    if (role === "ops" && state.page === "resources") {
      $("#main").innerHTML = `${pageHeader("CAPACITY & EXCEPTIONS", "资源与异常", statusChip("2 项需调度", "warn"))}
        <div class="content-split"><section class="panel workload-panel"><div class="panel-head"><h2>专家本周负载</h2><button class="text-button" type="button" data-drawer="record-detail" data-drawer-label="专家排期与容量" data-drawer-object="本周全部工作包" data-drawer-action="发起任务调度">查看排期</button></div><div class="workload-list">
          <div><span><strong>王晨</strong><small>钢铁 · 6 个项目</small></span><b>94%</b><i><em style="width:94%"></em></i></div>
          <div><span><strong>李明</strong><small>铝 · 5 个项目</small></span><b>88%</b><i><em style="width:88%"></em></i></div>
          <div><span><strong>周敏</strong><small>化工 · 4 个项目</small></span><b>71%</b><i><em style="width:71%"></em></i></div>
          <div><span><strong>赵宁</strong><small>钢铁 · 2 个项目</small></span><b>46%</b><i><em style="width:46%"></em></i></div>
        </div></section><aside class="panel"><div class="panel-head"><h2>系统与人工升级</h2></div><div class="stack-list"><div class="stack-row"><span>文件解析</span><strong>1 个 Excel 列头无法识别</strong><small>已转人工映射 · 12 分钟前</small></div><div class="stack-row"><span>权限</span><strong>供应商任务链接即将过期</strong><small>北辰化工 · 余 4 小时</small></div><div class="stack-row"><span>规则</span><strong>2027 Rulepack 校验完成</strong><small>无失败运行</small></div></div></aside></div>`;
      return;
    }
    if (role === "sales" && state.page === "quotes") {
      $("#main").innerHTML = `${pageHeader("COMMERCIAL PIPELINE", "报价与合同", statusChip("4 个等待反馈", "warn"))}
        <section class="panel wide-panel"><div class="panel-head"><h2>进行中的方案</h2><button class="button button--primary" type="button" data-staff-action="已创建方案草稿">新建方案</button></div><table class="data-table"><thead><tr><th>客户</th><th>服务范围</th><th>方案阶段</th><th>预计启动</th><th>合规数据</th><th>下一动作</th></tr></thead><tbody>
          <tr><td><strong>华星钢铁</strong><small>Q-2027-041</small></td><td>2 设施 · 4 产品 · 年度服务</td><td><span class="record-state warn">客户评审</span></td><td>2026-11-01</td><td class="privacy-cell">仅里程碑摘要</td><td>周五跟进</td></tr>
          <tr><td><strong>新锐紧固件</strong><small>Q-2027-044</small></td><td>适用性诊断 + 首年建档</td><td><span class="record-state">准备中</span></td><td>待确认</td><td class="privacy-cell">尚未授权</td><td>完成产品范围</td></tr>
          <tr><td><strong>北辰化工</strong><small>Q-2027-038</small></td><td>核算 + 核查支持</td><td><span class="record-state ok">已签署</span></td><td>2026-10-15</td><td class="privacy-cell">项目状态可见</td><td><button class="text-button" type="button" data-staff-action="已生成服务订单 SO-2027-022 与交接单 HO-2027-043">合同转订单</button></td></tr>
        </tbody></table></section>`;
      return;
    }
    if (role === "sales" && state.page === "accounts") {
      $("#main").innerHTML = `${pageHeader("ACCOUNT RELATIONSHIPS", "客户关系", '<p class="head-note">仅显示客户授权的结果摘要、服务里程碑与商业动作；专家意见和生产底稿不会出现在这里。</p>')}
        <div class="account-grid"><article><small>年度服务客户</small><h2>华星钢铁</h2><p>2026 Q1、Q2 已完成，Q3 数据采集达到 68%；2027 年度已进入可准备状态。</p><dl><div><dt>关系负责人</dt><dd>陈宇</dd></div><div><dt>下次会议</dt><dd>10 月 12 日</dd></div><div><dt>续费信号</dt><dd>2027 年度准备</dd></div></dl><button class="button button--primary" type="button" data-staff-action="已记录客户沟通">记录沟通</button></article><article><small>核查支持客户</small><h2>远航铝业</h2><p>2026 正在核查整改。商务只看到可能影响交付日期，不展示 Finding 证据内容。</p><dl><div><dt>关系负责人</dt><dd>陈宇</dd></div><div><dt>项目里程碑</dt><dd>核查整改</dd></div><div><dt>续费时间</dt><dd>12 月</dd></div></dl><button class="button button--secondary" type="button" data-drawer="record-detail" data-drawer-label="远航铝业商务记录" data-drawer-scope="会议、报价、合同与续费信号">查看商务记录</button></article></div>`;
    }
  }

  function renderExternalRole() {
    if (state.role === "importer") {
      if (state.page === "importer-questions") {
        $("#main").innerHTML = `${pageHeader("RECIPIENT QUESTIONS", "问题与回执", statusChip("1 项等待确认", "warn"))}
          ${objectContext([["接收方", "NordWerk GmbH"], ["期间", "2026 Q3"], ["产品范围", "热轧卷、镀层板"], ["访问有效期", "2026-12-31"]])}
          <section class="panel wide-panel"><div class="panel-head"><div><h2>与数据包有关的问题</h2><span>只展示本进口商获授权的范围</span></div></div><div class="record-list"><article class="record"><span class="record-code">Q-03</span><div><strong>请确认 Q3 发运数量是否包含退运批次</strong><p>Lumino 运营已回应：退运批次 SH-091 已排除，修订版 Package Rev 2 等待你确认。</p></div><button class="button button--primary" type="button" data-staff-action="已确认收到 Package Rev 2">确认收到修订版</button></article></div></section>`;
        return;
      }
      $("#main").innerHTML = `${pageHeader("AUTHORIZED RECIPIENT VIEW", "收到的数据包", statusChip("仅限 NordWerk 范围"))}
        <div class="responsibility-notice"><strong>正式申报由你方授权 CBAM 申报人完成。</strong><p>Lumino 和出口商提供经批准或核查的数据支持包；平台不会把“收到数据包”自动标记为“已完成法定申报”。</p></div>
        ${objectContext([["出口商", "华星钢铁有限公司"], ["进口商", "NordWerk GmbH"], ["授权范围", "2 个产品 · 18 批发运"], ["分享授权", "DS-2026-031"]])}
        <section class="panel wide-panel"><div class="panel-head"><div><h2>可接收文件</h2><span>每个版本均记录分享、下载和接收回执</span></div></div><table class="data-table"><thead><tr><th>文件</th><th>期间 / 范围</th><th>版本</th><th>数据状态</th><th>接收状态</th><th>动作</th></tr></thead><tbody><tr><td><strong>Communication Package</strong><small>进口商字段映射</small></td><td>2026 Q3 · 热轧卷、镀层板</td><td>Rev 2</td><td><span class="record-state ok">已批准</span></td><td><span class="record-state warn">已分享 · 待回执</span></td><td><button class="button button--primary" type="button" data-staff-action="已下载并确认收到 2026 Q3 Package Rev 2">下载并确认收到</button></td></tr><tr><td><strong>年度申报支持包</strong><small>不是申报回执</small></td><td>2026 全年</td><td>—</td><td><span class="record-state">未开始</span></td><td>—</td><td>等待年度核查</td></tr></tbody></table></section>`;
      return;
    }
    if (state.role === "verifier") {
      const findings = state.page === "verification-findings";
      $("#main").innerHTML = findings ? `${pageHeader("EXTERNAL VERIFICATION FINDINGS", "核查发现", statusChip("3 项开放", "warn"))}
        ${objectContext([["核查机构", "Veritas Climate GmbH"], ["设施", "上海浦东一厂"], ["年度", "2026"], ["快照", "VS-2026-02 · 已锁定"]])}
        <section class="panel wide-panel"><div class="panel-head"><div><h2>核查发现</h2><span>客户与 Lumino 不能通过内部风险接受关闭</span></div><button class="button button--primary" type="button" data-staff-action="已创建外部核查 Finding">提出 Finding</button></div><table class="data-table"><thead><tr><th>编号</th><th>问题</th><th>状态</th><th>等待谁</th><th>下一步</th></tr></thead><tbody><tr><td>VER-018</td><td><strong>5 月电耗异常</strong><small>需说明产量或检修影响</small></td><td><span class="record-state warn">已回应 · 验证中</span></td><td>核查员</td><td><button class="text-button" type="button" data-staff-action="已验证回应并关闭 VER-018">验证并关闭</button></td></tr><tr><td>VER-021</td><td><strong>钢坯边界证明不足</strong></td><td><span class="record-state">已分派</span></td><td>客户</td><td>等待材料</td></tr></tbody></table></section>` : `${pageHeader("AUTHORIZED VERIFICATION", "核查案件", statusChip("2 个获授权案件"))}
        <div class="privacy-band"><strong>核查授权边界</strong><span>只能查看被锁定的设施快照与抽样证据。客户其他年度、进口商商业信息和未授权原始材料不可见。</span></div>
        <section class="panel wide-panel"><div class="panel-head"><h2>我的核查案件</h2></div><table class="data-table"><thead><tr><th>设施 / 年度</th><th>快照</th><th>排放报告</th><th>抽样</th><th>状态</th><th>动作</th></tr></thead><tbody><tr><td><strong>上海浦东一厂 · 2026</strong><small>华星钢铁</small></td><td>VS-2026-02</td><td>OER Rev 2 · 已锁定</td><td>12 / 18 项</td><td><span class="record-state warn">核查中</span></td><td><button class="text-button" type="button" data-page="verification-findings">查看 Findings</button></td></tr><tr><td><strong>江苏二厂 · 2026</strong><small>华星钢铁</small></td><td>VS-2026-01</td><td>OER Rev 1 · 已锁定</td><td>未开始</td><td><span class="record-state">已计划</span></td><td>10 月 19 日开始</td></tr></tbody></table></section>`;
      return;
    }
    const history = state.page === "supplier-history";
    $("#main").innerHTML = history ? `${pageHeader("SUPPLIER SUBMISSIONS", "已提交记录", statusChip("仅限北方特钢供货范围"))}
      <section class="panel wide-panel"><div class="panel-head"><div><h2>版本与处理结果</h2><span>提交后由客户或专家复核，不会直接成为已核查数据</span></div></div><table class="data-table"><thead><tr><th>请求</th><th>供货期间</th><th>提交版本</th><th>处理状态</th><th>下一步</th></tr></thead><tbody><tr><td>SR-2026-014</td><td>2026 Q1–Q2</td><td>Rev 2 · 9 月 28 日</td><td><span class="record-state ok">已接受</span></td><td>无需操作</td></tr><tr><td>SR-2026-019</td><td>2026 Q3</td><td>Rev 1 · 10 月 8 日</td><td><span class="record-state warn">需澄清边界</span></td><td><button class="text-button" type="button" data-page="supplier-requests">补充说明</button></td></tr></tbody></table></section>` : `${pageHeader("SUPPLIER DATA REQUESTS", "数据请求", statusChip("2 项待处理", "warn"))}
      <div class="responsibility-notice"><strong>你只需提供自己供货范围内的事实和证明。</strong><p>平台不会向你展示买方的其他供应商、产品成本或完整年度排放。专业字段可由 Agent 从材料中提取，再请你确认。</p></div>
      <section class="panel wide-panel"><div class="panel-head"><h2>待处理请求</h2></div><div class="record-list"><article class="record"><span class="record-code">Q3</span><div><strong>外购非合金钢坯排放数据</strong><p>供货给华星钢铁 · 2026 Q3 · 采购批次 PO-73•• 至 PO-91••</p></div><button class="button button--primary" type="button" data-drawer="generic-action" data-drawer-label="提交 Q3 供应商数据">上传现有材料</button></article><article class="record"><span class="record-code">CL</span><div><strong>说明钢坯系统边界</strong><p>专家希望确认是否包含石灰与合金材料排放；可用日常生产语言回答。</p></div><button class="button button--secondary" type="button" data-drawer="generic-action" data-drawer-label="回答系统边界问题">回答问题</button></article></div></section>`;
  }

  function renderPlatformRole() {
    if (state.page === "knowledge") return renderKnowledgeInbox();
    if (state.role === "support") {
      const jobs = state.page === "job-health";
      $("#main").innerHTML = jobs ? `${pageHeader("PROCESSING JOBS", "任务运行", statusChip("1 个失败运行", "warn"))}
        <div class="privacy-band"><strong>默认脱敏</strong><span>支持人员可查看作业编号、租户、错误码和元数据；查看客户文件正文需要限时紧急访问并经批准。</span></div>
        <section class="panel wide-panel"><div class="panel-head"><h2>解析与计算任务</h2></div><table class="data-table"><thead><tr><th>作业</th><th>租户</th><th>类型</th><th>状态</th><th>错误</th><th>恢复</th></tr></thead><tbody><tr><td>JOB-88142</td><td>华星钢铁</td><td>Excel 解析</td><td><span class="record-state warn">失败</span></td><td>列头无法识别 · 不含正文</td><td><button class="text-button" type="button" data-staff-action="已使用相同输入重试 JOB-88142">重试</button></td></tr><tr><td>JOB-88138</td><td>北辰化工</td><td>计算运行</td><td><span class="record-state ok">成功</span></td><td>—</td><td>无需操作</td></tr></tbody></table></section>` : `${pageHeader("PLATFORM SUPPORT", "支持工单", statusChip("4 个处理中"))}
        <section class="panel wide-panel"><div class="panel-head"><div><h2>按最小权限处理</h2><span>账号、配置和故障支持不等于客户数据访问权</span></div></div><table class="data-table"><thead><tr><th>工单</th><th>租户</th><th>问题</th><th>可见范围</th><th>状态</th><th>动作</th></tr></thead><tbody><tr><td>SUP-2041</td><td>华星钢铁</td><td>成员邀请未收到</td><td>账号与邀请元数据</td><td><span class="record-state warn">处理中</span></td><td><button class="text-button" type="button" data-staff-action="已重新发送成员邀请">重新发送</button></td></tr><tr><td>SUP-2038</td><td>远航铝业</td><td>文件解析失败</td><td>作业元数据</td><td><span class="record-state">等待客户</span></td><td>请客户重传</td></tr></tbody></table></section>`;
      return;
    }
    const content = state.page === "rulepacks" ? `${pageHeader("RULEPACK GOVERNANCE", "规则包", statusChip("EU-CBAM-2027.1 · 生效"))}
      <section class="panel wide-panel"><div class="panel-head"><div><h2>发布与回滚</h2><span>规则包变更不会静默覆盖历史计算</span></div><button class="button button--primary" type="button" data-staff-action="已创建规则包候选版本">创建候选版本</button></div><table class="data-table"><thead><tr><th>规则包</th><th>状态</th><th>影响范围</th><th>验证</th><th>动作</th></tr></thead><tbody><tr><td>EU-CBAM-2027.1</td><td><span class="record-state ok">生效</span></td><td>2027 新计算运行</td><td>128 / 128 通过</td><td>查看发布记录</td></tr><tr><td>EU-CBAM-2027.2-rc1</td><td><span class="record-state warn">候选</span></td><td>影子运行</td><td>124 / 128</td><td><button class="text-button" type="button" data-staff-action="已打开失败用例">查看 4 个失败</button></td></tr></tbody></table></section>` : state.page === "audit-events" ? `${pageHeader("AUDIT & BREAK-GLASS", "审计与紧急访问", statusChip("1 项待复核", "warn"))}
      <div class="responsibility-notice"><strong>平台管理员默认不能读取客户业务内容。</strong><p>紧急访问必须说明原因、限定对象与时长，由另一名授权人批准，并对客户可见。</p></div><section class="panel wide-panel"><div class="panel-head"><h2>访问事件</h2></div><table class="data-table"><thead><tr><th>事件</th><th>对象</th><th>原因</th><th>时限</th><th>状态</th></tr></thead><tbody><tr><td>BG-2027-008</td><td>JOB-88142 · 单一文件</td><td>排查重复解析失败</td><td>15 分钟</td><td><span class="record-state warn">等待双人批准</span></td></tr><tr><td>AUD-82911</td><td>租户配置</td><td>更新 SSO 域名</td><td>已完成</td><td><span class="record-state ok">已审计</span></td></tr></tbody></table></section>` : `${pageHeader("TENANT GOVERNANCE", "租户治理", statusChip("业务内容默认不可见"))}
      <section class="panel wide-panel"><div class="panel-head"><div><h2>租户与身份状态</h2><span>这里只显示治理元数据</span></div></div><table class="data-table"><thead><tr><th>租户</th><th>身份</th><th>数据区域</th><th>保留策略</th><th>健康度</th></tr></thead><tbody><tr><td><strong>华星钢铁</strong><small>TNT-0018</small></td><td>SSO 已配置 · 14 成员</td><td>EU + CN 元数据</td><td>4 年 + 合同约定</td><td><span class="record-state ok">正常</span></td></tr><tr><td><strong>北辰化工</strong><small>TNT-0022</small></td><td>密码登录 · 7 成员</td><td>EU</td><td>配置待确认</td><td><span class="record-state warn">需检查</span></td></tr></tbody></table></section>`;
    $("#main").innerHTML = content;
  }
