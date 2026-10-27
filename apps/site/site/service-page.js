(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const list = items => items.map(item => `<li>${esc(item)}</li>`).join('');
  const root = document.getElementById('service-root');
  const id = document.body.dataset.service;
  const service = window.LuminoPublicServices && window.LuminoPublicServices[id];

  if (!service) {
    root.innerHTML = '<section class="section"><div class="wrap"><h1 class="section-title">服务页不存在</h1><p class="lede">请返回服务总览重新选择。</p></div></section>';
    return;
  }

  const statusTone = item => item.status === 'active' ? '' : item.status === 'pilot' ? ' status--pilot' : item.status === 'soon' ? ' status--soon' : ' status--planned';
  const status = item => `<span class="status${statusTone(item)}">${esc(item.statusLabel)}</span>`;
  const actions = item => `<div class="hero-actions"><a class="button button--primary" href="${esc(item.ctaHref)}">${esc(item.primaryActionLabel)} →</a><a class="button button--secondary" href="/Lumino%20%E5%AE%98%E7%BD%91.dc.html#services">返回服务总览</a></div>`;
  const closing = (item, title, copy) => `<section class="service-closing"><div class="wrap"><div><p class="eyebrow">START WITH A REAL CASE</p><h2>${esc(title)}</h2></div><p>${esc(copy)}</p><a class="button button--secondary" href="${esc(item.ctaHref)}">${esc(item.primaryActionLabel)} →</a></div></section>`;
  const stageValidation = item => !Array.isArray(item.stages) || !item.stages.length ? '' : `<section class="service-section service-section--wash"><div class="wrap"><div class="service-heading"><p class="eyebrow">STEP VALIDATION</p><h2>每一步都有对应校验。</h2><p>未满足门槛时，后续步骤不会被当作已就绪；规则由 Agent 内核执行，公开页只说明要求。</p></div><ol class="stage-path">${item.stages.map((stage, index) => `<li><span class="stage-path__index">${String(index + 1).padStart(2, '0')}</span><div><h3>${esc(stage.title)}</h3><p>${esc(stage.validationSummary || stage.detail)}</p></div></li>`).join('')}</ol></div></section>`;

  function renderCbam(item) {
    root.innerHTML = `<section class="special-service-hero special-service-hero--cbam">
      <div class="wrap special-service-hero__grid">
        <div class="special-service-hero__copy">
          <div class="service-folio"><span>01 / ACTIVE SERVICE</span>${status(item)}</div>
          <p class="eyebrow">CARBON BORDER ADJUSTMENT MECHANISM</p>
          <h1>欧盟碳边境合规</h1>
          <p class="special-service-hero__lead">从产品与编码范围开始，把工厂、生产配置、活动数据和证明材料组织成可核查、可修订、可持续交付的 CBAM 工作底稿。</p>
          ${actions(item)}
        </div>
        <aside class="service-dossier" aria-label="CBAM 服务工作档案">
          <header><span>DELIVERY CONTROL</span><strong>CBAM 工作档案</strong><em>演示结构</em></header>
          <dl>
            <div><dt>工作对象</dt><dd>产品 · 工厂 · 生产配置</dd></div>
            <div><dt>执行周期</dt><dd>年度项目 · 期间数据包</dd></div>
            <div><dt>数据路径</dt><dd>适用默认值 / 实际排放数据</dd></div>
            <div><dt>受控输出</dt><dd>计算版本 · 证明索引 · 交付包</dd></div>
          </dl>
          <footer><span>范围</span><i></i><span>数据</span><i></i><span>核算</span><i></i><span>交付</span></footer>
        </aside>
      </div>
    </section>

    <section class="service-section service-section--paper"><div class="wrap decision-layout">
      <div class="decision-intro"><p class="eyebrow">START WITH DECISIONS</p><h2>先判断要做什么，<br>再开始收数据。</h2><p>项目启动时先形成范围决定记录。无法确认的内容进入待办，不会被系统默认为正式事实。</p></div>
      <ol class="question-register">
        <li><span>01</span><div><strong>哪些产品进入当前项目范围？</strong><p>记录产品、候选编码、目标市场与适用期间。</p></div><em>范围决定</em></li>
        <li><span>02</span><div><strong>由哪个工厂和生产配置形成？</strong><p>连接设施、工艺路线、前体来源与责任人。</p></div><em>对象关系</em></li>
        <li><span>03</span><div><strong>本期采用哪条数据路径？</strong><p>识别适用方法、数据缺口和需要专家确认的事项。</p></div><em>方法记录</em></li>
        <li><span>04</span><div><strong>交付给谁，锁定哪个版本？</strong><p>明确进口方、交付范围、审批人与修订规则。</p></div><em>交付约定</em></li>
      </ol>
    </div></section>

    <section class="service-section service-section--ink"><div class="wrap">
      <div class="service-heading service-heading--light"><p class="eyebrow">CONTROLLED DELIVERY CHAIN</p><h2>不是一次填表，<br>是一条持续履约链。</h2><p>每一步都留下对象、责任人、输入版本和下一步门槛。</p></div>
      <ol class="delivery-chain">
        <li><span>01</span><div><small>SCOPE</small><h3>范围与编码</h3><p>确认产品、期间和候选编码，登记仍需关务或专家判断的内容。</p></div><strong>范围决定记录</strong></li>
        <li><span>02</span><div><small>STRUCTURE</small><h3>产品与生产关系</h3><p>建立产品、工厂、工艺路线和前体来源之间的版本化关系。</p></div><strong>生产配置底稿</strong></li>
        <li><span>03</span><div><small>COLLECTION</small><h3>期间数据与证据</h3><p>按设施和期间收集产量、能源、材料及供应商证明，并确认提取事实。</p></div><strong>数据包与缺口</strong></li>
        <li><span>04</span><div><small>CALCULATION</small><h3>计算与差异检查</h3><p>锁定输入、方法和规则版本，保留重新计算与异常处理记录。</p></div><strong>可复现计算版本</strong></li>
        <li><span>05</span><div><small>DELIVERY</small><h3>复核与交付</h3><p>专家复核关键判断，审批后锁定报告、证明索引和对外交付版本。</p></div><strong>受控交付包</strong></li>
      </ol>
    </div></section>
    ${stageValidation(item)}

    <section class="service-section service-section--wash"><div class="wrap">
      <div class="service-heading"><p class="eyebrow">DATA PATH</p><h2>数据路径不同，<br>控制要求也不同。</h2><p>路径选择不是用户随意切换的计算选项，必须按产品、期间、可用证据和适用规则确认。</p></div>
      <div class="data-paths">
        <article><header><span>PATH A</span><em>按适用规则确认</em></header><h3>默认值路径</h3><p>用于尚不具备完整实际排放数据的场景。页面需要清楚显示采用依据、适用期间和局限，不能把默认值包装成企业实测结果。</p><ul><li>产品和编码范围</li><li>适用参数与来源版本</li><li>缺口和后续改进路径</li></ul></article>
        <article><header><span>PATH B</span><em>需要证据和复核</em></header><h3>实际排放数据路径</h3><p>以设施、生产配置、活动数据和前体信息为基础。每个关键事实都需要来源、确认人、版本和计算血缘。</p><ul><li>设施与生产配置</li><li>活动数据与供应商信息</li><li>输入快照与复核记录</li></ul></article>
      </div>
    </div></section>

    <section class="service-section service-section--paper"><div class="wrap evidence-layout">
      <div class="service-heading"><p class="eyebrow">EVIDENCE REGISTER</p><h2>资料进入平台后，<br>要变成可追问的记录。</h2><p>同一材料可以被其他服务引用，但 CBAM 的用途、确认和计算仍然独立。</p></div>
      <div class="record-table" role="table" aria-label="CBAM 数据与证据示例">
        <div class="record-table__head" role="row"><span>对象</span><span>典型资料</span><span>平台记录</span></div>
        <div role="row"><strong>产品</strong><span>产品说明、候选编码、出口范围</span><em>产品版本与范围决定</em></div>
        <div role="row"><strong>工厂</strong><span>设施信息、工艺路线、计量点</span><em>生产配置与责任范围</em></div>
        <div role="row"><strong>活动数据</strong><span>产量、能源、材料与前体台账</span><em>期间事实与质量状态</em></div>
        <div role="row"><strong>证明材料</strong><span>账单、供应商声明、方法说明</span><em>证据版本与引用关系</em></div>
        <div role="row"><strong>交付结果</strong><span>计算、报告、审批与发送记录</span><em>锁定版本与修订历史</em></div>
      </div>
    </div></section>

    <section class="service-section service-section--paper"><div class="wrap boundary-layout">
      <div><p class="eyebrow">SERVICE BOUNDARY</p><h2>交付合规工作底稿，<br>不制造确定性的假象。</h2></div>
      <div class="boundary-register"><header><span>当前能力边界</span><em>${esc(item.reviewedAt)}</em></header><ul>${list(item.boundaries)}</ul><p>具体法规、编码、参数和数据路径必须按对应期间与项目范围核对。</p></div>
    </div></section>
    ${closing(item, '从一组真实产品和工厂开始。', '已有项目可以继续当前工作；首次开展可先确认范围、资料现状和交付对象。')}`;
  }

  function renderPcf(item) {
    root.innerHTML = `<section class="special-service-hero special-service-hero--pcf">
      <div class="wrap special-service-hero__grid">
        <div class="special-service-hero__copy">
          <div class="service-folio"><span>02 / PILOT SERVICE</span>${status(item)}</div>
          <p class="eyebrow">PRODUCT CARBON FOOTPRINT</p>
          <h1>产品碳足迹</h1>
          <p class="special-service-hero__lead">从核算目标、功能单位和系统边界开始，用版本化模板收集生命周期清单，再锁定输入、因子和方法形成可复现的计算与报告草稿。</p>
          ${actions(item)}
        </div>
        <aside class="study-declaration" aria-label="PCF 核算声明示例">
          <header><span>STUDY DECLARATION</span><strong>核算声明 · Draft 02</strong><em>试点</em></header>
          <dl>
            <div><dt>核算对象</dt><dd>热轧非合金钢卷</dd></div>
            <div><dt>功能单位</dt><dd>1 吨出厂产品</dd></div>
            <div><dt>系统边界</dt><dd>从摇篮到大门</dd></div>
            <div><dt>参考期间</dt><dd>2026-01 — 2026-09</dd></div>
          </dl>
          <footer><span>边界待确认</span><span>模板 v0.4</span><span>演示数据</span></footer>
        </aside>
      </div>
    </section>

    <section class="service-section service-section--paper"><div class="wrap declaration-layout">
      <div class="service-heading"><p class="eyebrow">STUDY FOUNDATION</p><h2>先定义研究问题，<br>再要求企业提供数据。</h2><p>功能单位和边界改变，数据需求与最终结果也会改变。它们必须由责任人确认，不能由 Agent 自动决定。</p></div>
      <dl class="declaration-ledger">
        <div><dt>01 · 目标与用途</dt><dd>为什么核算、结果提供给谁、是否用于外部沟通。</dd></div>
        <div><dt>02 · 产品与参考流</dt><dd>产品规格、生产地点，以及实现功能单位所需的产品数量。</dd></div>
        <div><dt>03 · 功能单位</dt><dd>结果的归一化基础，例如 1 吨出厂产品或 1 件产品。</dd></div>
        <div><dt>04 · 系统边界</dt><dd>纳入哪些生命周期阶段、排除什么，以及截断和分配规则。</dd></div>
      </dl>
    </div></section>

    <section class="service-section service-section--yellow"><div class="wrap">
      <div class="service-heading"><p class="eyebrow">TEMPLATE EXCHANGE</p><h2>模板不是附件，<br>是一次受控的数据交换。</h2><p>模板必须根据已确认的产品系统生成。回传后先校验结构、单位和证据，再由用户确认正式事实。</p></div>
      <ol class="template-exchange">
        <li><span>01</span><div><small>EXPORT</small><h3>按范围导出模板</h3><p>带出产品、期间、生命周期阶段、所需字段和模板版本。</p></div><em>示例模板 · XLSX</em></li>
        <li><span>02</span><div><small>RETURN</small><h3>企业填写并回传</h3><p>材料、能源、运输、产量、共产品和证明材料保持来源关系。</p></div><em>示例回传批次</em></li>
        <li><span>03</span><div><small>VALIDATE</small><h3>校验结构和单位</h3><p>识别缺项、单位不匹配、重复记录和边界外数据，不直接静默修正。</p></div><em>生成问题清单</em></li>
        <li><span>04</span><div><small>CONFIRM</small><h3>确认服务事实</h3><p>Agent 提议与原始文件并列展示，授权用户确认后进入输入快照。</p></div><em>等待企业确认</em></li>
      </ol>
    </div></section>
    ${stageValidation(item)}

    <section class="service-section service-section--ink"><div class="wrap">
      <div class="service-heading service-heading--light"><p class="eyebrow">LIFE CYCLE INVENTORY</p><h2>把产品拆成生命周期，<br>把每个数字放回来源。</h2><p>不适用的阶段仍然保留为空并记录理由，避免边界在计算过程中悄悄变化。</p></div>
      <div class="lifecycle-track" aria-label="PCF 生命周期阶段">
        <div><span>01</span><strong>原材料获取</strong><small>材料 · 上游数据</small></div>
        <div><span>02</span><strong>原材料运输</strong><small>质量 · 距离 · 方式</small></div>
        <div><span>03</span><strong>生产制造</strong><small>能源 · 工艺 · 产量</small></div>
        <div><span>04</span><strong>分销运输</strong><small>按边界启用</small></div>
        <div><span>05</span><strong>使用阶段</strong><small>按边界启用</small></div>
        <div><span>06</span><strong>废弃与回收</strong><small>按边界启用</small></div>
      </div>
      <div class="inventory-register">
        <header><span>清单条目</span><span>活动数据</span><span>因子与单位</span><span>质量状态</span></header>
        <div><strong>热轧卷主要原料</strong><span>1.08 t / t 产品</span><span>数据集待匹配</span><em>供应商数据</em></div>
        <div><strong>购入电力</strong><span>0.46 MWh / t 产品</span><span>kgCO₂e / MWh</span><em>实测 · 已确认</em></div>
        <div><strong>原料公路运输</strong><span>1.08 t × 286 km</span><span>kgCO₂e / tkm</span><em>距离待确认</em></div>
        <footer>示例结构 · 不代表正式核算结果</footer>
      </div>
    </div></section>

    <section class="service-section service-section--paper"><div class="wrap audit-layout">
      <div class="service-heading"><p class="eyebrow">AUDITABLE CALCULATION</p><h2>七个步骤，<br>每一步都能回看。</h2><p>AI 可以帮助推理结构、识别缺口和提出匹配建议；正式计算只读取已锁定的输入与规则版本。</p></div>
      <ol class="audit-pipeline">
        <li><span>01</span><strong>LCA 结构推理</strong><em>待确认建议</em></li>
        <li><span>02</span><strong>排放清单拆解</strong><em>生命周期结构</em></li>
        <li><span>03</span><strong>活动数据推算／确认</strong><em>来源与质量</em></li>
        <li><span>04</span><strong>运输距离与活动建模</strong><em>路线与假设</em></li>
        <li><span>05</span><strong>排放因子及单位匹配</strong><em>数据集与版本</em></li>
        <li><span>06</span><strong>确定性计算</strong><em>输入快照与 Run</em></li>
        <li><span>07</span><strong>热点解读与减排建议</strong><em>与结果分层</em></li>
      </ol>
    </div></section>

    <section class="service-section service-section--wash"><div class="wrap report-layout">
      <div class="service-heading"><p class="eyebrow">CONTROLLED REPORT</p><h2>报告不是一个 PDF，<br>而是一组被锁定的版本。</h2><p>报告草稿同时记录方法、数据质量、限制和复核意见。后续更正生成新修订版，不覆盖历史。</p></div>
      <div class="report-lock">
        <header><div><span>PCF REPORT</span><strong>受控报告草稿</strong></div><em>Rev 01</em></header>
        <div class="report-lock__grid"><span>核算声明</span><span>系统边界</span><span>生命周期清单</span><span>因子与分配</span><span>计算快照</span><span>热点与质量</span><span>限制与不确定性</span><span>专家复核</span></div>
        <footer><p>锁定：资产版本 · 模板版本 · 因子版本 · 计算运行 · 报告模板</p><b>试点能力</b></footer>
      </div>
    </div></section>

    <section class="service-section service-section--paper"><div class="wrap boundary-layout">
      <div><p class="eyebrow">PILOT BOUNDARY</p><h2>试点可以验证路径，<br>不能假装已经生产化。</h2></div>
      <div class="boundary-register"><header><span>当前能力边界</span><em>${esc(item.reviewedAt)}</em></header><ul>${list(item.boundaries)}</ul><p>正式项目仍需确认适用标准、产品类别规则、数据集许可和复核范围。</p></div>
    </div></section>
    ${closing(item, '从一个产品和一项明确用途开始。', '先确认功能单位、系统边界和现有资料，再决定模板与核算工作量。')}`;
  }

  function renderGeneric(item) {
    const planned = item.claimState === 'PLANNED';
    root.innerHTML = `<section class="service-hero"><div class="wrap service-hero__grid"><div>${status(item)}<p class="eyebrow" style="margin-top:24px">${esc(item.code)} SERVICE</p><h1 class="display">${esc(item.name)}</h1><p class="lede" style="margin-top:22px">${esc(item.promise)}</p><div class="hero-actions" style="margin-top:28px"><a class="button button--primary" href="${esc(item.ctaHref)}">${esc(item.primaryActionLabel)} →</a><a class="button button--secondary" href="/Lumino%20%E5%AE%98%E7%BD%91.dc.html#services">返回服务总览</a></div></div><aside class="service-meta" aria-label="服务说明"><div class="meta-row"><span>当前状态</span><strong>${esc(item.statusLabel)}</strong></div><div class="meta-row"><span>能力声明</span><strong>${esc(item.claimState)}</strong></div><div class="meta-row"><span>适用对象</span><strong>${esc(item.audience)}</strong></div><div class="meta-row"><span>最后审查</span><strong>${esc(item.reviewedAt)}</strong></div></aside></div></section>
    <section class="section"><div class="wrap editorial-grid"><div><p class="eyebrow">WHEN TO USE</p><h2 class="section-title">什么情况下，需要这项服务。</h2></div><div class="ledger">${item.triggers.map((trigger, index) => `<div class="ledger-row"><span>${String(index + 1).padStart(2, '0')}</span><div><p>${esc(trigger)}</p></div></div>`).join('')}</div></div></section>
    <section class="section section--wash"><div class="wrap"><div class="split-list"><div><h2 class="list-title">你需要提供什么</h2><ul class="plain-list">${list(item.inputs)}</ul></div><div><h2 class="list-title">${planned ? '计划交付什么' : '你会得到什么'}</h2><ul class="plain-list">${list(item.deliverables)}</ul></div></div></div></section>
    <section class="section"><div class="wrap editorial-grid"><div><p class="eyebrow">${planned ? 'PLANNED PATH' : 'WORKFLOW'}</p><h2 class="section-title">${planned ? '拟议的服务路径' : '从范围到交付'}</h2><p class="lede" style="margin-top:16px">${planned ? '以下为规划中的服务结构，正式开放前不会在门户创建工作空间。' : '每一步都保留输入、确认、规则与版本。'}</p></div><ol class="process">${list(item.process)}</ol></div></section>
    <section class="section section--wash"><div class="wrap"><p class="eyebrow">SHARED DATA ASSETS</p><h2 class="section-title">可以复用资料，不会混用结论。</h2><p class="lede" style="margin-top:16px">以下企业资产可在授权范围内跨服务引用；本服务仍单独记录用途、处理、确认和计算血缘。</p><div class="responsibility" style="margin-top:40px">${item.assets.map((asset, index) => `<div><span class="service-code">${String(index + 1).padStart(2, '0')}</span><h3>${esc(asset)}</h3><p>使用时锁定具体资产版本。</p></div>`).join('')}</div></div></section>
    <section class="section"><div class="wrap editorial-grid"><div><p class="eyebrow">BOUNDARIES</p><h2 class="section-title">我们会主动说清的边界。</h2></div><div class="boundary"><h3>${planned ? '规划状态说明' : '专业与交付边界'}</h3><ul>${list(item.boundaries)}</ul></div></div></section>
    <section class="cta-band"><div class="wrap"><div><h2 class="section-title">${planned ? '先说清需求，再决定是否建立服务。' : '从一个真实产品或交付开始。'}</h2><p>${planned ? '咨询请求只用于收集场景和联系需求，不代表服务已经上线。' : '已有项目可进入门户；尚未建立项目可先预约诊断。'}</p></div><a class="button" style="color:var(--paper)" href="${esc(item.ctaHref)}">${esc(item.primaryActionLabel)} →</a></div></section>`;
  }

  if (id === 'cbam') renderCbam(service);
  else if (id === 'pcf') renderPcf(service);
  else renderGeneric(service);
})();
