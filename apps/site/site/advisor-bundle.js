/* auto-built advisor runtime - do not edit; run: node scripts/build-advisor-bundle.mjs */

(function (root, factory) {
  "use strict";
  const catalog = factory();
  if (typeof module === "object" && module.exports) module.exports = catalog;
  root.LuminoAdvisorCatalog = catalog;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const L = (zh, en) => Object.freeze({ zh, en });
  const reply = (id, zh, en) => Object.freeze({ id, label: L(zh, en) });
  const source = (id, zh, en, url) => Object.freeze({ id, title: L(zh, en), url });

  const sources = Object.freeze({
    services: source("services-catalog", "Lumino 服务目录", "Lumino service catalog", "/apps/site/Lumino%20官网.dc.html#services"),
    cbamCodes: source("cbam-hs-cn-codes", "HS / CN / TARIC 编码核对指南", "HS / CN / TARIC code guide", "/knowledge/article?id=cbam-hs-cn-codes"),
    cbamData: source("cbam-importer-data", "CBAM 进口商数据准备", "Preparing CBAM importer data", "/knowledge/article?id=cbam-importer-data"),
    cbamPcf: source("cbam-vs-pcf", "CBAM 与产品碳足迹的区别", "CBAM vs product carbon footprint", "/knowledge/article?id=cbam-vs-pcf"),
    cbamPrecursors: source("cbam-precursors", "CBAM 前体材料准备", "CBAM precursor preparation", "/knowledge/article?id=cbam-precursors"),
    cbamDefaults: source("cbam-default-vs-actual", "CBAM 默认值与实际值", "CBAM defaults vs actuals", "/knowledge/article?id=cbam-default-vs-actual"),
    ghg: source("ghg-scope-cut", "Scope 1 / 2 / 3 初步划分", "Introducing Scope 1 / 2 / 3", "/knowledge/article?id=ghg-scope-cut"),
    ghgFirstYear: source("ghg-inventory-first-year", "组织温室气体盘查首年起步", "GHG inventory year-one start", "/knowledge/article?id=ghg-inventory-first-year"),
    pcfData: source("pcf-data-collection", "产品碳足迹活动数据采集", "PCF activity-data collection", "/knowledge/article?id=pcf-data-collection"),
    pcfHotspots: source("pcf-hotspots-reduction", "产品碳足迹热点与减排叙事", "PCF hotspots and reduction story", "/knowledge/article?id=pcf-hotspots-reduction"),
    eudrCsddd: source("eudr-csddd-exporter-prep", "EUDR 与 CSDDD 出口准备", "EUDR and CSDDD exporter prep", "/knowledge/article?id=eudr-csddd-exporter-prep")
  });

  const topics = Object.freeze([
    { id: "cbam_scope", label: L("我的产品是否可能涉及 CBAM？", "Could my product be covered by CBAM?") },
    { id: "cbam_data_start", label: L("进口商让我准备碳数据，从哪里开始？", "An importer wants carbon data. Where do I start?") },
    { id: "cbam_vs_pcf", label: L("CBAM 和产品碳足迹有什么区别？", "What is the difference between CBAM and PCF?") },
    { id: "pcf_data_start", label: L("产品碳足迹要从哪里采数据？", "Where should we start collecting PCF data?") },
    { id: "esg_ghg", label: L("客户要求 ESG、碳盘查或 Scope 1/2/3", "A customer asks for ESG, a GHG inventory or Scope 1/2/3") },
    { id: "inventory_first_year", label: L("组织碳盘查第一年怎么起步？", "How should a first-year GHG inventory start?") },
    { id: "eudr_csddd", label: L("EUDR 或 CSDDD，出口工厂先备什么？", "EUDR or CSDDD — what should exporters prepare first?") },
    { id: "renewable_power", label: L("想规划绿电、绿证或可再生能源证明", "Plan renewable power, certificates or proof") },
    { id: "service_triage", label: L("不确定需要哪项服务", "I am not sure which service I need") }
  ]);

  const fixedAnswers = Object.freeze([
    {
      id: "answer-cbam-scope",
      topicId: "cbam_scope",
      intent: "cbam_scope",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino 服务内容负责人",
      answer: L("是否涉及 CBAM 不能只看产品名称，需要核对欧盟进口端使用的 CN Code、产品类别和当期覆盖范围。我可以先帮你确定应查哪些信息，但不会直接作出正式编码认定。", "CBAM coverage cannot be decided from a product name alone. Check the CN code used by the EU importer, the product category and the rules for the relevant period. I can help identify what to verify, but not make a formal customs-classification decision."),
      nextQuestion: L("你的主要出口产品属于哪一类？", "Which category best matches your main export product?"),
      suggestedReplies: [reply("steel", "钢铁", "Iron and steel"), reply("aluminium", "铝", "Aluminium"), reply("other-cbam", "水泥、化肥、氢或其他", "Cement, fertiliser, hydrogen or other"), reply("unknown", "我不确定", "I am not sure")],
      serviceId: "cbam",
      sourceIds: ["cbam-hs-cn-codes"],
      cta: { type: "tool", label: L("查看编码核对方法", "View the code-checking guide"), url: "/knowledge/article?id=cbam-hs-cn-codes" }
    },
    {
      id: "answer-cbam-data-start",
      topicId: "cbam_data_start",
      intent: "cbam_data_start",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino 服务内容负责人",
      answer: L("先不要直接承诺提交一份笼统的“CBAM 报告”。可以先回复客户：请确认所需文件或模板、涉及的产品与 CN Code、报告期间、生产设施、截止时间，以及是否需要前体材料数据。确认边界后，再按要求准备产量、燃料、外购电热、工艺排放和供应商声明。", "Do not immediately promise a generic ‘CBAM report’. Reply by asking the customer to confirm the required file or template, products and CN codes, reporting period, producing installation, deadline, and whether precursor data is needed. Once the scope is confirmed, prepare output, fuels, purchased energy, process emissions and supplier statements."),
      nextQuestion: L("进口商是否已给你模板或提交时限？", "Has the importer provided a template or deadline?"),
      suggestedReplies: [reply("template", "有模板", "I have a template"), reply("deadline", "只有时限", "Only a deadline"), reply("request-only", "只是口头要求", "Only an informal request"), reply("unknown", "不确定", "I am not sure")],
      serviceId: "cbam",
      sourceIds: ["cbam-importer-data", "cbam-precursors", "cbam-default-vs-actual"],
      cta: { type: "knowledge", label: L("查看资料准备清单", "View the preparation checklist"), url: "/knowledge/article?id=cbam-importer-data" }
    },
    {
      id: "answer-cbam-vs-pcf",
      topicId: "cbam_vs_pcf",
      intent: "cbam_vs_pcf",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino 服务内容负责人",
      answer: L("CBAM 主要服务于欧盟进口合规，按覆盖编码、设施、工艺和前体规则整理嵌入排放。产品碳足迹则围绕功能单位和生命周期边界回答产品的碳影响。底层能源和物料台账可以复用，但不能直接共用同一结论。", "CBAM supports EU import compliance using covered codes, installations, routes and precursor rules. A PCF answers a product-impact question around a functional unit and life-cycle boundary. Underlying energy and material ledgers can be reused, but the conclusions cannot simply be copied."),
      nextQuestion: L("现在是谁要求你提供这份数据？", "Who is asking you for this information?"),
      suggestedReplies: [reply("eu-importer", "欧盟进口商", "EU importer"), reply("brand", "品牌或客户采购", "Brand or customer procurement"), reply("both", "两者都要", "Both"), reply("internal", "企业内部管理", "Internal management")],
      serviceId: "cbam",
      secondaryServiceId: "pcf",
      sourceIds: ["cbam-vs-pcf"],
      cta: { type: "knowledge", label: L("查看完整区别", "Read the full comparison"), url: "/knowledge/article?id=cbam-vs-pcf" }
    },
    {
      id: "answer-esg-ghg",
      topicId: "esg_ghg",
      intent: "esg_ghg_triage",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino 服务内容负责人",
      answer: L("这三类要求的交付物不同：ESG 通常是报告或评级问卷；碳盘查是组织层面的温室气体底账；Scope 1/2/3 是盘查中的排放边界分类。先确认对方要什么交付物，再决定服务。", "These asks lead to different deliverables: ESG usually means a report or rating questionnaire; a GHG inventory is an organisation-level emissions ledger; Scope 1/2/3 are boundary categories within that inventory. First identify the requested deliverable."),
      nextQuestion: L("对方要的是哪种交付物？", "What deliverable are they asking for?"),
      suggestedReplies: [reply("report", "ESG 报告", "ESG report"), reply("questionnaire", "客户或评级问卷", "Customer or rating questionnaire"), reply("inventory", "组织碳盘查", "GHG inventory"), reply("scope-data", "Scope 1/2/3 数据", "Scope 1/2/3 data")],
      serviceId: "inventory",
      secondaryServiceId: "esg",
      sourceIds: ["ghg-scope-cut", "ghg-inventory-first-year"],
      cta: { type: "knowledge", label: L("查看 Scope 划分", "View the Scope guide"), url: "/knowledge/article?id=ghg-scope-cut" }
    },
    {
      id: "answer-pcf-data-start",
      topicId: "pcf_data_start",
      intent: "pcf_data_start",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino 服务内容负责人",
      answer: L("先锁定代表产品和功能单位，再按材料、能源、运输（若在边界内）、废弃四类建最小采集清单，并给每个过程指定数据主人与证据位置。边界没定清楚前，不要全品类铺开采数。", "First lock representative products and the functional unit. Then build a minimum collection list across materials, energy, in-boundary transport and waste, with a data owner and evidence location for each process. Do not expand to every SKU before the boundary is clear."),
      nextQuestion: L("你现在更卡在哪一步？", "Where are you stuck right now?"),
      suggestedReplies: [reply("boundary", "系统边界还没定", "Boundary not locked"), reply("collect", "不知道采哪些数", "Unsure what to collect"), reply("hotspot", "算完了但不会讲热点", "Have a result, unclear hotspots"), reply("unknown", "不确定", "Not sure")],
      serviceId: "pcf",
      sourceIds: ["pcf-data-collection", "pcf-hotspots-reduction"],
      cta: { type: "knowledge", label: L("查看采集清单", "View the collection guide"), url: "/knowledge/article?id=pcf-data-collection" }
    },
    {
      id: "answer-inventory-first-year",
      topicId: "inventory_first_year",
      intent: "inventory_first_year",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino 服务内容负责人",
      answer: L("首年目标不是一次完美，而是组织边界写清楚、Scope 1/2 站得住，Scope 3 只先做 2–4 个高相关类别。底层能源台账可以以后复用到产品足迹，但结论页不要混用。", "Year one is not perfection: write down the organisational boundary, make Scope 1/2 reliable, and limit Scope 3 to two to four relevant categories. Energy ledgers can later support product footprints, but keep the conclusion pages separate."),
      nextQuestion: L("你现在有哪些现成资料？", "What evidence do you already have?"),
      suggestedReplies: [reply("bills", "有电费/燃料账单", "Energy bills available"), reply("sites", "有多厂清单", "Multi-site list ready"), reply("scope3", "客户点名要 Scope 3", "Customer asked for Scope 3"), reply("unknown", "还很少", "Very little so far")],
      serviceId: "inventory",
      sourceIds: ["ghg-inventory-first-year", "ghg-scope-cut"],
      cta: { type: "knowledge", label: L("查看首年起步指南", "View the year-one guide"), url: "/knowledge/article?id=ghg-inventory-first-year" }
    },
    {
      id: "answer-eudr-csddd",
      topicId: "eudr_csddd",
      intent: "eudr_csddd",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino 服务内容负责人",
      answer: L("EUDR 关注特定商品是否可追溯、是否与毁林无关；CSDDD 关注公司层面的尽职管理与价值链责任。两者都可能传到出口工厂，但证据包不同：前者常要地块与批次追溯，后者更要政策、风险评估和申诉渠道。", "EUDR focuses on commodity traceability and deforestation-free evidence; CSDDD focuses on company due diligence across the value chain. Both can cascade to exporters, with different packs: plot and lot evidence versus policies, risk assessments and grievance channels."),
      nextQuestion: L("客户主要按哪一类来催？", "Which ask is the customer pushing?"),
      suggestedReplies: [reply("eudr", "商品追溯 / EUDR", "Commodity traceability / EUDR"), reply("csddd", "尽职管理 / CSDDD", "Due diligence / CSDDD"), reply("both", "两者都提到", "Both mentioned"), reply("unknown", "说不清", "Not clear")],
      serviceId: "export",
      sourceIds: ["eudr-csddd-exporter-prep"],
      cta: { type: "knowledge", label: L("查看出口准备说明", "View the exporter briefing"), url: "/knowledge/article?id=eudr-csddd-exporter-prep" }
    },
    {
      id: "answer-renewable-power",
      topicId: "renewable_power",
      intent: "renewable_power",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino 服务内容负责人",
      answer: L("绿电、绿证和自建电源不是只比价格。需要先确认年用电、目标比例、客户接受的凭证、地域与时间匹配，再比较自建、直购和证书组合。", "Renewable power, certificates and on-site generation should not be compared on price alone. First confirm annual load, target share, accepted evidence, geography and time matching; then compare on-site, direct purchase and certificate mixes."),
      nextQuestion: L("你现在有客户指定的凭证或目标比例吗？", "Has the customer specified an accepted certificate or target share?"),
      suggestedReplies: [reply("specified", "已指定", "Yes, specified"), reply("target-only", "只有比例目标", "Only a target share"), reply("planning", "内部规划中", "Internal planning"), reply("unknown", "还不确定", "Not sure yet")],
      serviceId: "assets",
      sourceIds: ["services-catalog"],
      cta: { type: "service", label: L("查看碳资产与绿证服务", "View renewable-power services"), url: "/apps/site/services/carbon-assets/" }
    },
    {
      id: "answer-service-triage",
      topicId: "service_triage",
      intent: "service_triage",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino 服务内容负责人",
      answer: L("可以先不选服务。最有效的做法是确认「谁提出要求、要什么交付物、什么时候要」。我们会据此推荐一项主服务，必要时附一项关联服务。", "You do not need to choose a service first. The most useful approach is: who made the request, what deliverable they expect, and when it is due. We can then recommend one primary service and, only if needed, one related service."),
      nextQuestion: L("是谁向你提出了要求？", "Who made the request?"),
      suggestedReplies: [reply("eu-importer", "欧盟进口商", "EU importer"), reply("customer", "客户或品牌", "Customer or brand"), reply("regulator", "监管或市场准入", "Regulator or market access"), reply("internal", "公司内部", "Internal team"), reply("unknown", "不确定", "Not sure")],
      serviceId: null,
      sourceIds: ["services-catalog"],
      cta: { type: "contact", label: L("查看全部服务", "View all services"), url: "/apps/site/Lumino%20官网.dc.html#services" }
    }
  ]);

  // Every visible reply has a reviewed deterministic outcome. Keeping these
  // outcomes in the catalog makes the full flow auditable and prevents a
  // preset choice from falling through to a model-generated answer.
  const replyOutcomes = Object.freeze({
    cbam_scope: Object.freeze({
      steel: L("钢铁产品是 CBAM 的重点范围之一，但仍要按欧盟进口端使用的 8 位 CN Code 核对具体货物。先向进口商确认申报编码，再用编码指南检查对应品类和工艺范围。", "Iron and steel are core CBAM sectors, but the exact goods still need to be checked against the eight-digit CN code used by the EU importer. Confirm that declared code first, then check the covered category and production route."),
      aluminium: L("铝产品可能属于 CBAM，但不能只凭材质名称判断。请先取得进口商使用的 8 位 CN Code，并确认产品形态与生产工艺，再核对当期覆盖范围。", "Aluminium products may fall under CBAM, but material name alone is not enough. Obtain the eight-digit CN code used by the importer and confirm product form and production route before checking current coverage."),
      "other-cbam": L("水泥、化肥、氢等品类中只有特定 CN Code 被覆盖，并非同类产品全部自动纳入。先整理产品说明、现有 HS Code 和欧盟进口编码，再逐项核对。", "Only specified CN codes in sectors such as cement, fertilisers and hydrogen are covered; not every related product is automatically in scope. Gather the product description, current HS code and EU import code for a line-by-line check."),
      unknown: L("先准备产品中英文名称、用途、材质或成分、生产工艺，以及出口报关使用的 HS Code，并向欧盟进口商索取其申报的 CN Code。若无法取得或双方编码不一致，保留两套编码和产品资料，不自行下结论，转海关归类或专业复核。", "Prepare the product name, use, material or composition, production process and export HS code, and ask the EU importer for its declared CN code. If the code is unavailable or the two sides disagree, retain both codes and the product evidence and seek customs-classification or specialist review rather than deciding it yourself.")
    }),
    cbam_data_start: Object.freeze({
      template: L("先锁定模板版本、报告期间、提交口径和截止时间，再把每个字段映射到产品、产量、燃料、电热、工艺排放和前体材料的数据来源。无法填写的字段单独列为缺口，不要用估算值直接覆盖。", "Lock the template version, reporting period, submission basis and deadline. Map every field to sources for products, output, fuels, electricity or heat, process emissions and precursors, and list missing fields as gaps rather than silently estimating them."),
      deadline: L("只有时限时，应立即向进口商确认使用的模板、产品 CN Code、报告期间、生产设施以及是否需要前体材料数据。同时先建立最小资料包：产量、燃料、电热、工艺和供应商声明。", "When only a deadline is known, immediately confirm the template, product CN code, reporting period, installation and precursor requirements with the importer. In parallel, assemble a minimum pack covering output, fuels, purchased energy, processes and supplier statements."),
      "request-only": L("先把口头要求转成书面需求，至少确认产品和 CN Code、数据期间、用途、模板、截止时间及接收方。未确认这些边界前，可以盘点数据来源，但不宜直接出正式数据表。", "Turn the informal request into a written brief covering product and CN code, data period, intended use, template, deadline and recipient. You can inventory data sources meanwhile, but should not issue a formal data sheet before those boundaries are confirmed."),
      unknown: L("先向进口商发送五个确认项：要哪些产品、使用什么 CN Code、覆盖哪个期间、采用哪份模板、何时提交。内部同时确认生产厂区和前体材料，这样可以快速形成可执行的数据清单。", "Ask the importer five things first: which products, which CN codes, what period, which template and what deadline. Internally confirm the producing sites and precursors so an actionable data list can be created quickly.")
    }),
    cbam_vs_pcf: Object.freeze({
      "eu-importer": L("欧盟进口商提出要求时，应优先按 CBAM 的编码、设施、工艺和前体规则准备嵌入排放数据。若对方同时要产品碳足迹，应另行确认功能单位和生命周期边界，不能直接把 CBAM 数值当作 PCF。", "When the EU importer is asking, prioritise CBAM data by code, installation, production route and precursor rules. If a product carbon footprint is also requested, confirm its functional unit and life-cycle boundary separately rather than reusing the CBAM result as the PCF."),
      brand: L("品牌或采购方通常更关注产品碳足迹或其指定问卷。先确认方法标准、功能单位、边界和验证要求；只有涉及欧盟进口申报且产品在覆盖编码内时，才另外启动 CBAM 路径。", "A brand or procurement team usually needs a product footprint or its own questionnaire. Confirm the method, functional unit, boundary and assurance requirement; start a separate CBAM track only where EU import reporting and covered codes apply."),
      both: L("两项要求可以共用产量、物料、能源和供应商数据底账，但应建立两套计算边界、字段映射和结论页。建议先做一张共用数据清单，再分别输出 CBAM 与 PCF 交付物。", "The two requests can share ledgers for output, materials, energy and suppliers, but need separate boundaries, field mappings and conclusions. Build one shared data inventory, then produce distinct CBAM and PCF deliverables."),
      internal: L("内部管理先明确目标：组织减排通常从碳盘查开始，产品设计或客户沟通通常用 PCF。只有存在欧盟进口合规需求时，CBAM 才应作为独立的合规工作流。", "For internal management, define the objective first: organisational reduction usually starts with a GHG inventory, while product design or customer communication usually calls for a PCF. CBAM should remain a separate compliance workflow when EU import obligations apply.")
    }),
    esg_ghg: Object.freeze({
      report: L("ESG 报告应先确定报告期间、组织范围、采用框架、重大议题和披露责任人，再建立指标与证据清单。碳盘查可以作为环境数据底座，但不能代替完整的 ESG 报告。", "For an ESG report, first define the reporting period, organisational scope, framework, material topics and disclosure owners, then create an indicator and evidence list. A GHG inventory can support environmental data but does not replace the full ESG report."),
      questionnaire: L("先取得原始问卷、评分说明和截止时间，把每一题标为已有证据、需补数据或需管理确认。回答应引用可追溯的制度、记录或指标，避免只写原则性承诺。", "Obtain the original questionnaire, scoring guidance and deadline. Mark each item as evidenced, data gap or management confirmation, and support responses with traceable policies, records or metrics rather than broad commitments."),
      inventory: L("组织碳盘查应先确定组织边界、基准年、运营边界和核算方法，再收集 Scope 1/2，并按相关性筛选 Scope 3。最终交付应包含清单、因子来源、假设和数据质量说明。", "A corporate GHG inventory should first set the organisational boundary, base year, operational boundary and method, then collect Scope 1/2 and screen relevant Scope 3 categories. The deliverable should include the inventory, factor sources, assumptions and data-quality notes."),
      "scope-data": L("先确认对方要的是总量、分项台账还是特定 Scope 类别，并确认组织范围、期间、单位和方法。Scope 1/2/3 不能只按费用科目机械分类，应按排放源和价值链关系判断。", "Confirm whether the requester needs totals, a detailed ledger or selected Scope categories, together with the organisational boundary, period, unit and method. Scope 1/2/3 should be classified by emission source and value-chain relationship, not merely by expense account.")
    }),
    pcf_data_start: Object.freeze({
      boundary: L("先写一页边界说明：产品与功能单位、生命周期起止点、纳入的工厂和工艺、时间与地域代表性、分配规则及排除项。边界确认后再发采集表，可避免大量返工。", "Write a one-page boundary note covering product and functional unit, life-cycle start and end, included sites and processes, temporal and geographic representativeness, allocation rules and exclusions. Confirm it before issuing data templates to avoid rework."),
      collect: L("最小采集清单包括产品产量与合格率、BOM 和材料用量、各工序能源、边界内运输、废料与处置，以及每项数据的期间、单位、负责人和证据。先从一个代表产品跑通。", "The minimum list covers product output and yield, BOM and material quantities, process energy, in-boundary transport, scrap and treatment, plus period, unit, owner and evidence for each item. Prove the flow with one representative product first."),
      hotspot: L("先把各阶段结果统一到同一功能单位，检查高贡献项是否由真实用量、排放因子或分配方法驱动，再区分可控与不可控热点。对外说明应同时写贡献、原因、数据质量和可执行的减排动作。", "Normalise all stages to the same functional unit, check whether major contributions are driven by quantities, factors or allocation, and separate controllable from less-controllable hotspots. External communication should cover contribution, cause, data quality and actionable reduction measures."),
      unknown: L("建议先选一个产量稳定、资料相对完整的代表产品，完成边界确认和最小数据清单，再决定是否扩展到其他型号。这样可以最快发现数据口径和分配难点。", "Choose one stable, well-documented representative product, confirm its boundary and minimum data list, and only then decide whether to expand to other models. This is the fastest way to expose data-basis and allocation issues.")
    }),
    inventory_first_year: Object.freeze({
      bills: L("先把连续 12 个月的电力、燃料、制冷剂和外购热力账单按法人、厂区和月份归集，并记录计量点与费用主体不一致的情况。随后补充排放源清单和缺失月份说明。", "Consolidate twelve months of electricity, fuel, refrigerant and purchased-heat records by legal entity, site and month, noting mismatches between meters and billed entities. Then add an emission-source register and document missing periods."),
      sites: L("先确定采用运营控制、财务控制还是股权比例，并列出所有法人、厂区、仓库和租赁地点的纳入理由。多厂数据应使用统一模板、单位和截止日期，并保留合并抵销规则。", "Choose operational control, financial control or equity share, and list the inclusion rationale for every entity, plant, warehouse and leased location. Use one template, units and cut-off across sites and retain consolidation and elimination rules."),
      scope3: L("先确认客户点名的 Scope 3 类别和数据粒度，再结合采购、物流、差旅、售出产品等价值链活动做相关性筛选。首年优先 2–4 个高相关类别，并区分供应商实测数据与估算。", "Confirm the Scope 3 categories and granularity named by the customer, then screen relevance across purchasing, logistics, travel, sold products and other value-chain activities. Prioritise two to four material categories in year one and distinguish supplier data from estimates."),
      unknown: L("从两张清单开始：组织与厂区清单，以及过去 12 个月能源和制冷剂资料清单。先完成 Scope 1/2 的边界与数据缺口图，再决定 Scope 3 的优先类别。", "Start with two lists: entities and sites, and twelve months of energy and refrigerant evidence. Complete the Scope 1/2 boundary and gap map first, then select priority Scope 3 categories.")
    }),
    eudr_csddd: Object.freeze({
      eudr: L("先确认产品是否属于相关商品范围，并建立供应商—批次—原料产地—地块的追溯链。资料通常包括地理位置、合法性证明、批次关联、风险评估与减缓记录；仅有供应商承诺通常不够。", "First confirm whether the product falls within the relevant commodity scope and build a supplier-to-lot-to-origin-to-plot traceability chain. Evidence commonly includes geolocation, legality, lot linkage, risk assessment and mitigation; a supplier declaration alone is usually insufficient."),
      csddd: L("先建立适用性与客户要求清单，再准备治理职责、价值链风险识别、供应商条款、申诉渠道、纠正和跟踪记录。重点是可运行的尽职管理过程，而不是单独一份政策文件。", "Create an applicability and customer-requirement list, then prepare governance roles, value-chain risk identification, supplier clauses, grievance channels, remediation and monitoring records. The focus is an operating due-diligence process, not a standalone policy."),
      both: L("可以共用供应商主数据和风险分层，但应分别建立 EUDR 的商品与地块证据矩阵，以及 CSDDD 的治理与尽职管理证据矩阵。为两条路径指定责任人和更新时间，避免一套文件混用。", "A shared supplier master and risk tiering can support both, but maintain separate evidence matrices for EUDR commodity and plot traceability and for CSDDD governance and due diligence. Assign owners and refresh dates to each track."),
      unknown: L("先请客户书面确认适用法规、涉及产品或原料、所需交付物和截止时间。拿到要求后，再判断是地块与批次追溯、公司尽职管理，还是两者都需要。", "Ask the customer to confirm in writing the applicable regulation, products or materials, required deliverable and deadline. Then determine whether plot and lot traceability, corporate due diligence or both are needed.")
    }),
    renewable_power: Object.freeze({
      specified: L("把指定凭证的标准、签发机构、适用地域、生产年份、时间匹配、核销主体和客户接受条件写成核对表。再对现有采购合同和证书逐项查缺口，避免购买后无法被客户认可。", "Turn the specified evidence into a checklist covering standard, issuer, geography, production vintage, time matching, retirement entity and customer acceptance. Compare current contracts and certificates against it before purchasing."),
      "target-only": L("先确定基准年用电量、目标年份与比例，并按厂区和负荷特征拆分。随后比较自建、直购和证书的可获得性、成本、凭证质量和年度匹配，形成分阶段组合方案。", "Set the baseline electricity use, target year and share, split by site and load profile. Then compare on-site generation, direct purchase and certificates on availability, cost, evidence quality and annual matching to form a phased portfolio."),
      planning: L("内部规划先盘点各厂区年用电、屋顶或场地条件、合同约束、预算和减排目标，再设计自建、绿电交易与证书的组合。应同时明确凭证归属和核销规则。", "For internal planning, inventory annual demand by site, roof or land potential, contract constraints, budget and reduction targets, then design a mix of on-site generation, renewable procurement and certificates, including ownership and retirement rules."),
      unknown: L("先确认购买目的、用电地域、覆盖期间、目标比例，以及客户或披露框架接受什么凭证。没有这些条件时不宜先选证书或报价。", "Confirm the purpose, electricity location, coverage period, target share and evidence accepted by the customer or disclosure framework. Do not select certificates or quotes before those conditions are known.")
    }),
    service_triage: Object.freeze({
      "eu-importer": L("这类要求通常先进入 CBAM 路径。请准备产品名称、进口商使用的 CN Code、报告期间、模板和截止时间；若对方还要求生命周期足迹，再单独增加 PCF 工作流。", "This usually starts with the CBAM track. Prepare the product name, importer CN code, reporting period, template and deadline; add a separate PCF track only if a life-cycle footprint is also required."),
      customer: L("先让客户明确交付物：产品碳足迹、ESG 报告或问卷、组织碳盘查，还是出口合规资料。拿到样表或原始要求后，才能准确匹配主服务。", "Ask the customer to name the deliverable: product footprint, ESG report or questionnaire, corporate GHG inventory, or export-compliance evidence. Obtain the original request or template before matching the primary service."),
      regulator: L("先记录具体法规或市场、产品范围、适用主体、司法辖区、提交形式和截止时间，再进入出口合规或专项核查。法规名称不清时，不应直接承诺结论。", "Record the exact regulation or market, product scope, obligated entity, jurisdiction, submission format and deadline before starting export compliance or a scoped review. Do not promise a conclusion while the legal basis is unclear."),
      internal: L("内部目标决定服务：组织减排与披露从碳盘查开始，产品设计与客户足迹从 PCF 开始，能源转型进入绿电与绿证规划。先选一个可量化目标和时间点。", "The internal objective determines the service: organisational reduction and disclosure start with a GHG inventory, product design and customer footprints with PCF, and energy transition with renewable-power planning. Choose one measurable objective and date first."),
      unknown: L("请先补齐三项最小信息：是谁提出要求、希望收到什么文件或数据、什么时候要。如果有邮件、问卷或模板，按原样提供，比先猜服务更有效。", "Provide three minimum facts first: who is asking, what file or data they expect, and when it is due. An original email, questionnaire or template is more useful than guessing the service.")
    })
  });

  const toolRoutes = Object.freeze([
    {
      id: "tool-cn-code",
      intent: "cn_code_lookup",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino CBAM 服务负责人",
      topicIds: ["cn_code_lookup"],
      keywords: ["cn code", "cn-code", "hs code", "hs 编码", "taric", "海关编码", "商品编码", "查cn", "查 cn", "查hs", "查 hs", "正式归类", "归类决定", "customs classification", "classify my goods", "正式 cn", "编码是多少", "认定我的", "告诉我编码"],
      answer: L("可以先使用现有合规工具。CBAM 试算器可从已支持的 CN Code 列表选择产品并进行成本试算；编码指南用于理解 HS、CN 和 TARIC 的关系与核对顺序。这些入口不替代正式海关归类或专家复核。", "Start with the available compliance tools. The CBAM calculator lets you select from supported CN codes and estimate cost; the code guide explains HS, CN and TARIC and the checking order. These tools do not replace formal customs classification or expert review."),
      links: [
        { type: "tool", label: L("进入 CBAM 试算器", "Open the CBAM calculator"), url: "/calculator" },
        { type: "knowledge", label: L("查看编码核对指南", "View the code-checking guide"), url: "/knowledge/article?id=cbam-hs-cn-codes" },
        { type: "contact", label: L("需要归类复核", "Request classification review"), url: "/apps/site/Lumino%20联系.dc.html?serviceId=cbam&source=homepage-advisor&topic=cn-code" }
      ],
      sourceIds: ["cbam-hs-cn-codes"]
    }
  ]);

  return Object.freeze({
    schemaVersion: "1.0.0",
    contentVersion: "2026-11-09.1",
    reviewCycleDays: 120,
    topics,
    sources,
    fixedAnswers,
    replyOutcomes,
    toolRoutes
  });
});

(function (root, factory) {
  "use strict";
  const schema = factory();
  if (typeof module === "object" && module.exports) module.exports = schema;
  root.LuminoAdvisorSchema = schema;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ANSWER_MODES = Object.freeze(["fixed", "tool_route", "retrieval_model", "general_model", "fallback"]);
  const CONFIDENCE = Object.freeze(["high", "medium", "low"]);
  const HANDOFF = Object.freeze(["none", "contact", "expert_required"]);

  function validateResponse(value) {
    const errors = [];
    if (!value || typeof value !== "object") return { ok: false, errors: ["response must be an object"] };
    if (typeof value.intent !== "string" || !value.intent) errors.push("intent is required");
    if (!ANSWER_MODES.includes(value.answer_mode)) errors.push("answer_mode is invalid");
    if (typeof value.answer !== "string" || !value.answer.trim()) errors.push("answer is required");
    if (!CONFIDENCE.includes(value.confidence)) errors.push("confidence is invalid");
    if (!Array.isArray(value.service_matches) || value.service_matches.length > 2) errors.push("service_matches must contain at most two items");
    if (!Array.isArray(value.suggested_replies) || value.suggested_replies.length > 5) errors.push("suggested_replies must contain at most five items");
    if (!Array.isArray(value.sources) || value.sources.length > 3) errors.push("sources must contain at most three items");
    if (!Array.isArray(value.links) || value.links.length > 3) errors.push("links must contain at most three items");
    if (!HANDOFF.includes(value.handoff)) errors.push("handoff is invalid");
    return { ok: errors.length === 0, errors };
  }

  return Object.freeze({ ANSWER_MODES, CONFIDENCE, HANDOFF, validateResponse });
});

(function (root, factory) {
  "use strict";
  const catalog = typeof module === "object" && module.exports ? require("./catalog.js") : root.LuminoAdvisorCatalog;
  const schema = typeof module === "object" && module.exports ? require("./schema.js") : root.LuminoAdvisorSchema;
  const router = factory(catalog, schema);
  if (typeof module === "object" && module.exports) module.exports = router;
  root.LuminoAdvisor = router;
})(typeof window !== "undefined" ? window : globalThis, function (catalog, schema) {
  "use strict";

  if (!catalog || !schema) throw new Error("Lumino advisor dependencies are missing");

  const topicKeywords = Object.freeze({
    cbam_vs_pcf: ["cbam和pcf", "cbam 和 pcf", "cbam vs pcf", "产品碳足迹有什么区别", "difference between cbam"],
    cbam_data_start: ["进口商", "碳数据", "cbam相关的报告", "cbam相关报告", "cbam报告", "importer data", "communication template", "准备什么数据", "customer asks for a cbam report"],
    pcf_data_start: ["产品碳足迹", "活动数据", "pcf data", "carbon footprint data", "功能单位", "系统边界怎么采", "collecting pcf", "pcf activity data", "activity data"],
    inventory_first_year: ["组织碳盘查", "首年盘查", "第一次盘查", "year one inventory", "first year ghg", "组织温室气体"],
    eudr_csddd: ["eudr", "csddd", "零毁林", "尽职管理", "毁林", "due diligence directive"],
    esg_ghg: ["scope 1", "scope1", "scope 2", "scope2", "scope 3", "scope3", "碳盘查", "ghg inventory", "esg报告", "esg 报告"],
    renewable_power: ["绿电", "绿证", "i-rec", "irec", "renewable power", "renewable certificate"],
    cbam_scope: ["是否涉及cbam", "是否属于cbam", "cbam范围", "cbam scope", "covered by cbam", "可能涉及 cbam", "涉及 cbam"],
    service_triage: ["不确定需要", "哪项服务", "which service", "not sure which service"]
  });

  function text(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.zh || value.en || "";
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[\s\u3000]+/g, " ").trim();
  }

  function isPublished(record, asOf) {
    if (!record || record.status !== "published" || !/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt || "") || !record.reviewer) return false;
    const reviewedAt = Date.parse(`${record.reviewedAt}T00:00:00Z`);
    const now = asOf ? Date.parse(`${asOf}T00:00:00Z`) : Date.now();
    const ageDays = (now - reviewedAt) / 86400000;
    return Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= catalog.reviewCycleDays;
  }

  function sourceById(id, lang) {
    const item = Object.values(catalog.sources).find((candidate) => candidate.id === id);
    return item ? { title: text(item.title, lang), url: item.url } : null;
  }

  function serviceMatch(serviceId, lang, priority) {
    if (!serviceId) return null;
    const names = {
      cbam: { zh: "欧盟碳边境调节", en: "EU CBAM" },
      pcf: { zh: "产品碳足迹", en: "Product carbon footprint" },
      esg: { zh: "ESG 报告", en: "ESG reporting" },
      inventory: { zh: "碳盘查", en: "GHG inventory" },
      assets: { zh: "碳资产与绿证", en: "Carbon assets and EACs" },
      export: { zh: "出口合规", en: "Export compliance" }
    };
    const name = names[serviceId] || { zh: serviceId, en: serviceId };
    return {
      service_id: serviceId,
      reason: lang === "en" ? `The current question maps to ${name.en}.` : `当前问题主要对应${name.zh}。`,
      priority
    };
  }

  function buildFixed(record, lang) {
    const services = [serviceMatch(record.serviceId, lang, 1), serviceMatch(record.secondaryServiceId, lang, 2)].filter(Boolean);
    const response = {
      schema_version: catalog.schemaVersion,
      content_version: catalog.contentVersion,
      topic_id: record.topicId,
      intent: record.intent,
      answer_mode: "fixed",
      answer: text(record.answer, lang),
      confidence: "high",
      service_matches: services,
      next_question: text(record.nextQuestion, lang) || null,
      suggested_replies: (record.suggestedReplies || []).map((item) => ({ id: item.id, label: text(item.label, lang) })).slice(0, 5),
      sources: (record.sourceIds || []).map((id) => sourceById(id, lang)).filter(Boolean).slice(0, 3),
      links: record.cta ? [{ type: record.cta.type, label: text(record.cta.label, lang), url: record.cta.url }] : [],
      cta: record.cta ? { type: record.cta.type, label: text(record.cta.label, lang), url: record.cta.url } : null,
      handoff: "none"
    };
    assertValid(response);
    return response;
  }

  function buildReplyOutcome(record, replyId, lang) {
    const response = buildFixed(record, lang);
    const allowed = (record.suggestedReplies || []).find((item) => item.id === replyId);
    if (!allowed) return response;
    const outcome = catalog.replyOutcomes && catalog.replyOutcomes[record.topicId] && catalog.replyOutcomes[record.topicId][replyId];
    if (!outcome) throw new Error(`Missing deterministic reply outcome: ${record.topicId}.${replyId}`);
    response.answer = text(outcome, lang);
    response.next_question = null;
    response.suggested_replies = [];
    assertValid(response);
    return response;
  }

  function buildToolRoute(record, lang) {
    const links = record.links.map((item) => ({ type: item.type, label: text(item.label, lang), url: item.url }));
    const response = {
      schema_version: catalog.schemaVersion,
      content_version: catalog.contentVersion,
      intent: record.intent,
      answer_mode: "tool_route",
      answer: text(record.answer, lang),
      confidence: "high",
      service_matches: [serviceMatch("cbam", lang, 1)],
      next_question: null,
      suggested_replies: [],
      sources: (record.sourceIds || []).map((id) => sourceById(id, lang)).filter(Boolean).slice(0, 3),
      links,
      cta: links[0] || null,
      handoff: "expert_required"
    };
    assertValid(response);
    return response;
  }

  function buildFallback(lang) {
    const response = {
      schema_version: catalog.schemaVersion,
      content_version: catalog.contentVersion,
      intent: "unresolved",
      answer_mode: "fallback",
      answer: lang === "en"
        ? "Here is a useful starting point: identify who is asking, the exact file or decision they need, and the deadline. Keep the original email, template or screenshot, then list what you already have and what is missing. Share any one of those details and I can turn it into a more specific action list."
        : "可以先从三个动作开始：确认是谁提出要求、具体要什么文件或判断、截止时间是什么；保留原始邮件、模板或截图；再列出已有资料和缺口。你补充其中任意一项，我就可以继续整理成更具体的行动清单。",
      confidence: "low",
      service_matches: [],
      next_question: lang === "en" ? "Who is asking, what do they expect, and when is it due?" : "是谁提出要求、希望收到什么、什么时候要？",
      suggested_replies: catalog.topics.slice(0, 5).map((item) => ({ id: item.id, label: text(item.label, lang) })),
      sources: [],
      links: [{ type: "contact", label: lang === "en" ? "Contact Lumino" : "联系 Lumino", url: "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor&topic=unresolved" }],
      cta: { type: "contact", label: lang === "en" ? "Contact Lumino" : "联系 Lumino", url: "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor&topic=unresolved" },
      handoff: "contact"
    };
    assertValid(response);
    return response;
  }

  function assertValid(response) {
    const result = schema.validateResponse(response);
    if (!result.ok) throw new Error(`Invalid advisor response: ${result.errors.join("; ")}`);
  }

  function inferTopic(inputText) {
    for (const [topicId, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((keyword) => inputText.includes(keyword))) return topicId;
    }
    return "";
  }

  function route(input) {
    const request = input || {};
    const lang = request.lang === "en" ? "en" : "zh";
    const inputText = normalize(request.text);
    const topicId = request.topicId || inferTopic(inputText);
    const asOf = request.asOf || "";

    const toolRoute = catalog.toolRoutes.find((record) => {
      if (!isPublished(record, asOf)) return false;
      if ((record.topicIds || []).includes(topicId)) return true;
      return inputText && record.keywords.some((keyword) => inputText.includes(normalize(keyword)));
    });
    if (toolRoute) return buildToolRoute(toolRoute, lang);

    const answer = catalog.fixedAnswers.find((record) => isPublished(record, asOf) && record.topicId === topicId);
    if (answer && request.replyId) return buildReplyOutcome(answer, request.replyId, lang);
    if (answer) return buildFixed(answer, lang);
    return buildFallback(lang);
  }

  function getTopics(lang) {
    const locale = lang === "en" ? "en" : "zh";
    return catalog.topics.map((item) => ({ id: item.id, label: text(item.label, locale) }));
  }

  return Object.freeze({ route, getTopics, normalize, schemaVersion: catalog.schemaVersion, contentVersion: catalog.contentVersion });
});

(function (root) {
  "use strict";

  const SESSION_KEY = "lumino.advisor.state.v1";
  const CLIENT_TIMEOUT_MS = 12000;
  const THINK_ROTATE_MS = 900;
  const DETERMINISTIC_DELAY_MIN_MS = 1000;
  const DETERMINISTIC_DELAY_MAX_MS = 4000;
  const i18n = root.LuminoI18n || { detectLang: () => "zh" };
  let panel = null;
  let trigger = null;
  let history = [];
  let runtimeFlags = { public_beta: true, lead_capture: false };
  let busy = false;
  let activeAbort = null;
  let printTimer = null;
  let thinkTimer = null;
  let lastRequest = null;
  let lastUserLabel = null;

  function trackMetric(payload) {
    try {
      const body = JSON.stringify(payload || {});
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/advisor-metrics", blob);
        return;
      }
      fetch("/api/advisor-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  }

  function lang() { return i18n.detectLang() === "en" ? "en" : "zh"; }
  function label(zh, en) { return lang() === "en" ? en : zh; }
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function prefersReducedMotion() {
    return root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function thinkingPhrases() {
    return lang() === "en"
      ? [
        "Analysing your question…",
        "Structuring the actionable points…",
        "Checking applicable conditions…",
      ]
      : [
        "分析你的问题…",
        "整理可执行要点…",
        "核对适用条件…",
      ];
  }

  function deterministicDelayMs() {
    return DETERMINISTIC_DELAY_MIN_MS
      + Math.floor(Math.random() * (DETERMINISTIC_DELAY_MAX_MS - DETERMINISTIC_DELAY_MIN_MS + 1));
  }

  function waitForDelay(milliseconds, signal) {
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve(false);
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve(true);
      }, milliseconds);
      const onAbort = () => {
        clearTimeout(timer);
        resolve(false);
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  function clearThinkTimer() {
    if (thinkTimer) {
      clearInterval(thinkTimer);
      thinkTimer = null;
    }
  }

  function startThinking(article) {
    const textNode = article?.querySelector(".advisor-answer__text");
    if (!textNode) return () => {};
    const phrases = thinkingPhrases();
    let index = 0;
    textNode.dataset.thinking = "1";
    textNode.textContent = phrases[0];
    announce(phrases[0]);
    clearThinkTimer();
    if (!prefersReducedMotion() && phrases.length > 1) {
      thinkTimer = setInterval(() => {
        index = (index + 1) % phrases.length;
        textNode.textContent = phrases[index];
      }, THINK_ROTATE_MS);
    }
    return () => {
      clearThinkTimer();
      textNode.dataset.thinking = "0";
    };
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, location.origin);
      if (url.origin !== location.origin) return "#";
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_) { return "#"; }
  }

  function loadState() {
    try {
      const state = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (state && Array.isArray(state.history)) {
        history = state.history.filter((item) => item?.topicId && item?.response?.answer_mode).slice(-8);
      }
    } catch (_) { history = []; }
  }

  function saveState() {
    try {
      const safeHistory = history.filter((item) => item.topicId && !item.freeText).slice(-8);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ history: safeHistory }));
    } catch (_) {}
  }

  function containsSensitiveInfo(value) {
    const input = String(value || "");
    return /\b1[3-9]\d{9}\b/.test(input) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(input) || /\b\d{15,18}[0-9xX]\b/.test(input);
  }

  function modeLabel(response) {
    const ui = response.ui_state || response.runtime?.ui_state;
    if (ui === "unavailable") return label("服务暂时不可用", "Service temporarily unavailable");
    if (ui === "basic_mode") return label("已切换到基础问答", "Switched to basic guidance");
    if (ui === "no_sources" || (response.answer_mode === "fallback" && !response.sources?.length && !ui)) {
      return label("行动建议", "Actionable next step");
    }
    if (response.answer_mode === "tool_route") return label("推荐合规工具", "Suggested compliance tool");
    if (response.answer_mode === "fixed") return label("服务说明", "Guidance");
    if (response.answer_mode === "retrieval_model") return label("初步判断", "Preliminary view");
    if (response.answer_mode === "general_model") return label("初步回应", "Initial guidance");
    return label("暂无法确认", "Unable to confirm");
  }

  function initialMarkup() {
    const topics = root.LuminoAdvisor.getTopics(lang());
    const topicTones = {
      cbam_scope: "green",
      cbam_data_start: "green",
      cbam_vs_pcf: "gold",
      pcf_data_start: "teal",
      esg_ghg: "blue",
      inventory_first_year: "blue",
      eudr_csddd: "gold",
      renewable_power: "green",
      service_triage: "teal",
    };
    const topicButton = (topic) => `<button class="advisor-topic" type="button" data-topic-id="${escapeHtml(topic.id)}" data-topic-tone="${topicTones[topic.id] || "green"}">
      <span class="advisor-topic__marker" aria-hidden="true"></span>
      <span class="advisor-topic__label">${escapeHtml(topic.label)}</span>
      <span class="advisor-topic__arrow" aria-hidden="true">→</span>
    </button>`;
    return `<section class="advisor-welcome">
      <p class="advisor-welcome__one">${label("用一句话提问，或点选话题", "Ask in one sentence, or pick a topic")}</p>
    </section>
    <div class="advisor-topics" aria-label="${label("预选话题", "Suggested topics")}">
      ${topics.map(topicButton).join("")}
    </div>`;
  }

  function extrasMarkup(response) {
    const replies = (response.suggested_replies || []).map((item) =>
      `<button class="advisor-reply" type="button" data-topic-id="${escapeHtml(response.topic_id || "")}" data-reply-id="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`
    ).join("");
    const links = (response.links || []).map((item, index) =>
      `<a class="advisor-link ${index === 0 ? "advisor-link--primary" : ""}" href="${escapeHtml(safeUrl(item.url))}" data-advisor-cta="${escapeHtml(item.type || "link")}" data-answer-mode="${escapeHtml(response.answer_mode || "")}">${escapeHtml(item.label)}</a>`
    ).join("");
    const sources = (response.sources || []).map((item) =>
      `<a href="${escapeHtml(safeUrl(item.url))}">${escapeHtml(item.title)} ↗</a>`
    ).join("");
    const retry = response.ui_state === "unavailable"
      ? `<button type="button" class="advisor-retry" data-advisor-retry>${label("重试", "Retry")}</button>`
      : "";
    return `
      ${response.next_question ? `<p class="advisor-answer__question">${escapeHtml(response.next_question)}</p>` : ""}
      ${replies ? `<div class="advisor-replies" role="group" aria-label="${label("可选回答", "Answer choices")}">${replies}</div>` : ""}
      ${(links || retry) ? `<div class="advisor-actions">${links}${retry}</div>` : ""}
      ${sources ? `<div class="advisor-sources"><span>${label("相关资料", "Related reading")}</span>${sources}</div>` : ""}`;
  }

  function answerShell(response, options = {}) {
    const printing = options.printing;
    const full = options.fullText != null ? options.fullText : (response.answer || "");
    return `<article class="advisor-turn advisor-turn--assistant" data-printing="${printing ? "1" : "0"}">
      <div class="advisor-answer">
        <span class="advisor-answer__mode">${modeLabel(response)}</span>
        <p class="advisor-answer__text">${escapeHtml(options.visibleText != null ? options.visibleText : full)}</p>
        <div class="advisor-answer__actions">
          ${printing ? `<button type="button" class="advisor-stop" data-advisor-stop>${label("停止", "Stop")}</button>` : ""}
          ${(!printing && full && options.canExpand) ? `<button type="button" class="advisor-expand" data-advisor-expand>${label("显示全文", "Show full answer")}</button>` : ""}
        </div>
        <div class="advisor-answer__extras">${printing ? "" : extrasMarkup(response)}</div>
      </div>
    </article>`;
  }

  function scrollToLatest() {
    const body = panel.querySelector(".advisor-widget__body");
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }

  function announce(message) {
    const status = panel.querySelector(".advisor-widget__status");
    status.textContent = "";
    requestAnimationFrame(() => { status.textContent = message; });
  }

  function setBusy(next) {
    busy = next;
    if (!panel) return;
    panel.classList.toggle("is-busy", next);
    const send = panel.querySelector(".advisor-widget__send");
    const stop = panel.querySelector(".advisor-widget__stop");
    const textarea = panel.querySelector("textarea");
    if (send) send.disabled = next;
    if (textarea) textarea.disabled = next;
    if (stop) stop.hidden = !next;
    panel.querySelectorAll(".advisor-topic, .advisor-reply").forEach((node) => {
      node.disabled = next;
    });
  }

  function clearPrintTimer() {
    if (printTimer) {
      clearTimeout(printTimer);
      printTimer = null;
    }
  }

  function stopActive(reason = "user_stop") {
    clearPrintTimer();
    clearThinkTimer();
    if (activeAbort) {
      try { activeAbort.abort(reason); } catch (_) {}
      activeAbort = null;
    }
  }

  function unavailableLocal(reason) {
    const response = root.LuminoAdvisor.route({ text: "", lang: lang() });
    response.answer_mode = "fallback";
    response.intent = "service_unavailable";
    response.ui_state = "unavailable";
    response.degradation_reason = reason;
    response.sources = [];
    response.suggested_replies = [];
    response.next_question = null;
    response.confidence = "low";
    response.handoff = "contact";
    response.answer = reason === "timeout"
      ? label("请求超时。这通常是网络或服务暂时繁忙，不代表没有相关资料。你可以重试。", "The request timed out. This usually means the network or service is busy — not that Lumino has no guidance. You can retry.")
      : label("暂时无法连接顾问服务。已保留你的问题，你可以重试，或改用下方话题 / 联系页。", "Could not reach the advisor service. Your question is kept — retry, choose a topic, or use the contact page.");
    response.links = [{
      type: "contact",
      label: label("联系 Lumino", "Contact Lumino"),
      url: "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor&topic=unavailable",
    }];
    response.cta = response.links[0];
    response.runtime = { source: "client_fallback", ui_state: "unavailable", degradation_reason: reason };
    return response;
  }

  function basicModeLocal(payloadReason) {
    const response = root.LuminoAdvisor.route({ text: lastRequest?.text || "", topicId: lastRequest?.topicId || "", lang: lang() });
    if (response.answer_mode === "fallback") {
      response.ui_state = "basic_mode";
      response.degradation_reason = payloadReason || "network";
      response.answer += label(
        " 在线服务暂时不可用，但你仍可以按以上步骤开始；稍后重试可获得更具体的回答。",
        " The online service is temporarily unavailable, but you can still start with these steps and retry later for a more specific answer."
      );
      return response;
    }
    response.ui_state = "basic_mode";
    response.degradation_reason = payloadReason || "network";
    return response;
  }

  async function readSse(response, handlers) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const lines = part.split("\n");
        let eventName = "message";
        const dataLines = [];
        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let data = {};
        try { data = JSON.parse(dataLines.join("\n")); } catch (_) { data = { text: dataLines.join("\n") }; }
        if (handlers[eventName]) handlers[eventName](data);
      }
    }
  }

  function printAnswer(article, fullText, onDone) {
    const textNode = article.querySelector(".advisor-answer__text");
    const actions = article.querySelector(".advisor-answer__actions");
    textNode.textContent = fullText;
    article.dataset.printing = "0";
    actions.innerHTML = "";
    article.dataset.fullText = fullText;
    onDone(true);
  }

  async function resolveResponse(request, article) {
    const payload = { ...request, lang: lang() };
    // Published fixed/tool answers are already in the browser bundle. Do not
    // spend a network round-trip or model budget on deterministic choices.
    if (payload.topicId && root.LuminoAdvisor?.route) {
      const local = root.LuminoAdvisor.route(payload);
      if (local?.answer && (local.answer_mode === "fixed" || local.answer_mode === "tool_route")) {
        const delayController = new AbortController();
        activeAbort = delayController;
        const completed = await waitForDelay(deterministicDelayMs(), delayController.signal);
        if (!completed) {
          const stopped = unavailableLocal("user_stop");
          stopped.answer = label("已停止处理。你可以重试，或继续选择话题。", "Stopped. You can retry or choose another topic.");
          stopped.ui_state = "unavailable";
          return stopped;
        }
        local.runtime = {
          ...(local.runtime || {}),
          source: "client_deterministic",
          model_configured: runtimeFlags.model_enabled !== false,
          ui_state: local.ui_state || "ok",
          degradation_reason: null,
        };
        return local;
      }
    }
    const controller = new AbortController();
    activeAbort = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), CLIENT_TIMEOUT_MS);
    try {
      const upstream = await fetch("/api/advisor?stream=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!upstream.ok) {
        const reason = upstream.status === 429 ? "rate_limited" : `http_${upstream.status}`;
        trackMetric({ type: "client", ok: false, timeout: false, answer_mode: "fallback", source: "error", degradation_reason: reason });
        // Static local previews return 404 HTML for /api/* — still answer from the bundled router.
        if (payload.topicId || payload.text) {
          try {
            return basicModeLocal(reason);
          } catch (_) {}
        }
        return unavailableLocal(reason);
      }
      const contentType = String(upstream.headers.get("content-type") || "");
      if (contentType.includes("text/event-stream") && upstream.body) {
        let finalPayload = null;
        let printed = "";
        // Buffer stream text only — deliberation + print are owned by appendExchange
        // so fixed answers do not flash as an instant dump.
        await readSse(upstream, {
          delta(data) {
            if (controller.signal.aborted) return;
            printed += data.text || "";
          },
          advisor(data) { finalPayload = data; },
          done() {},
        });
        if (finalPayload && finalPayload.answer) return finalPayload;
        if (printed) {
          return {
            answer_mode: "fallback",
            answer: printed,
            ui_state: "ok",
            suggested_replies: [],
            links: [],
            sources: [],
          };
        }
        return unavailableLocal("stream_incomplete");
      }
      const data = await upstream.json();
      if (data && data.answer_mode && data.answer) return data;
      return unavailableLocal("bad_payload");
    } catch (error) {
      const timedOut = error === "timeout" || error?.name === "TimeoutError" || error?.name === "AbortError" || String(error).includes("timeout");
      const userStop = String(error).includes("user_stop") || controller.signal.reason === "user_stop";
      if (userStop) {
        trackMetric({ type: "client", ok: false, answer_mode: "fallback", source: "error", degradation_reason: "user_stop" });
        const stopped = unavailableLocal("user_stop");
        stopped.answer = label("已停止生成。你可以重试，或继续选择话题。", "Generation stopped. You can retry or choose another topic.");
        stopped.ui_state = "unavailable";
        return stopped;
      }
      trackMetric({
        type: "client",
        timeout: timedOut,
        ok: false,
        answer_mode: "fallback",
        source: "error",
        degradation_reason: timedOut ? "timeout" : "network",
      });
      // Prefer basic local mode when a topic/text can still map; else unavailable.
      if (payload.topicId || payload.text) {
        try {
          return basicModeLocal(timedOut ? "timeout" : "network");
        } catch (_) {}
      }
      return unavailableLocal(timedOut ? "timeout" : "network");
    } finally {
      clearTimeout(timeout);
      // Keep activeAbort until appendExchange finishes deliberation/print so Stop still works.
    }
  }

  async function appendExchange(userLabel, request, options) {
    if (busy) return;
    lastRequest = { ...request };
    lastUserLabel = userLabel;
    setBusy(true);
    const thread = panel.querySelector(".advisor-thread");
    if (userLabel) thread.insertAdjacentHTML("beforeend", `<article class="advisor-turn advisor-turn--user"><p>${escapeHtml(userLabel)}</p></article>`);
    const pending = {
      answer_mode: "fallback",
      answer: "",
      ui_state: "ok",
      suggested_replies: [],
      links: [],
      sources: [],
    };
    thread.insertAdjacentHTML("beforeend", answerShell(pending, {
      printing: true,
      visibleText: thinkingPhrases()[0],
      fullText: "",
    }));
    const article = thread.querySelector(".advisor-turn--assistant:last-child");
    const stopThinking = startThinking(article);
    scrollToLatest();
    const started = performance.now();

    try {
      const response = await resolveResponse(request, article);
      stopThinking();

      const fullText = response.answer || "";
      article.querySelector(".advisor-answer__mode").textContent = modeLabel(response);
      article.dataset.fullText = fullText;
      const textNode = article.querySelector(".advisor-answer__text");
      if (textNode) textNode.textContent = "";

      await new Promise((resolve) => {
        let settled = false;
        const finish = (mode) => {
          if (settled) return;
          settled = true;
          clearPrintTimer();
          clearThinkTimer();
          article.dataset.printing = "0";
          article.querySelector(".advisor-answer__extras").innerHTML = extrasMarkup(response);
          if (mode === "stopped") {
            article.querySelector(".advisor-answer__actions").innerHTML =
              `<button type="button" class="advisor-expand" data-advisor-expand>${label("显示全文", "Show full answer")}</button>
               <button type="button" class="advisor-retry" data-advisor-retry>${label("重试", "Retry")}</button>`;
          } else {
            article.querySelector(".advisor-answer__actions").innerHTML = "";
          }
          resolve();
        };
        article.addEventListener("advisor:stop-print", () => finish("stopped"), { once: true });
        if (!fullText) {
          finish("done");
          return;
        }
        if (prefersReducedMotion()) {
          textNode.textContent = fullText;
          finish("done");
          return;
        }
        printAnswer(article, fullText, () => finish("done"));
      });

      history.push({ topicId: options?.topicId || request.topicId || "", userLabel, response, freeText: options?.freeText });
      saveState();
      trackMetric({
        type: "client",
        answer_mode: response.answer_mode,
        source: response.runtime?.source || "",
        handoff: response.handoff,
        has_sources: Boolean(response.sources?.length),
        latency_ms: Math.round(performance.now() - started),
        degradation_reason: response.degradation_reason || response.runtime?.degradation_reason || null,
        ok: response.ui_state !== "unavailable",
      });
      announce(response.answer);
    } finally {
      stopThinking();
      activeAbort = null;
      setBusy(false);
      scrollToLatest();
    }
  }

  function showSensitiveWarning() {
    const response = root.LuminoAdvisor.route({ text: "", lang: lang() });
    response.answer = label(
      "输入中可能包含联系方式或证件号码。为避免在公开顾问中提交个人信息，这段内容没有显示或保存。如需联系，请使用受控联系页。",
      "The input may contain contact or identity details. It was not displayed or saved. Use the controlled contact page if you want Lumino to contact you."
    );
    response.next_question = null;
    response.suggested_replies = [];
    response.ui_state = "ok";
    panel.querySelector(".advisor-thread").insertAdjacentHTML("beforeend", answerShell(response));
    announce(response.answer);
    scrollToLatest();
  }

  function reset() {
    stopActive("reset");
    clearPrintTimer();
    history = [];
    lastRequest = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    panel.querySelector(".advisor-thread").innerHTML = initialMarkup();
    panel.querySelector("textarea").value = "";
    setBusy(false);
    announce(label("已重新开始", "Started over"));
  }

  function restoredMarkup() {
    if (!history.length) return initialMarkup();
    return `<section class="advisor-resumed">
      <span>${label("已恢复当前标签页中的对话", "Conversation restored in this tab")}</span>
    </section>${history.map((item) => `${item.userLabel ? `<article class="advisor-turn advisor-turn--user"><p>${escapeHtml(item.userLabel)}</p></article>` : ""}${answerShell(item.response)}`).join("")}`;
  }

  function mount() {
    if (panel) return panel;
    loadState();
    panel = document.createElement("section");
    panel.className = "advisor-widget";
    panel.id = "lumino-advisor-widget";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "advisor-title");
    panel.innerHTML = `<header class="advisor-widget__head">
      <div class="advisor-widget__copy">
        <strong id="advisor-title">${label("Lumino 服务顾问", "Lumino Service Guide")}</strong>
        <p>${label("初步判断，帮助你快速定向", "Preliminary guidance to get oriented")}</p>
      </div>
      <div class="advisor-widget__head-actions">
        <button class="advisor-widget__reset" type="button" aria-label="${label("重新开始", "Start over")}" title="${label("重新开始", "Start over")}">
          <svg class="advisor-widget__reset-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"/></svg>
        </button>
        <button class="advisor-widget__close" type="button" aria-label="${label("关闭服务顾问", "Close service guide")}">×</button>
      </div>
    </header>
    <div class="advisor-widget__body"><div class="advisor-thread">${restoredMarkup()}</div></div>
    <form class="advisor-widget__composer">
      <textarea name="question" rows="1" maxlength="2000" placeholder="${label("用一句话描述你的问题……", "Describe your question in one sentence…")}" aria-label="${label("用一句话描述你的问题", "Describe your question in one sentence")}"></textarea>
      <button class="advisor-widget__stop" type="button" hidden>${label("停止", "Stop")}</button>
      <button class="advisor-widget__send" type="submit">${label("发送", "Send")}</button>
    </form>
    <footer class="advisor-widget__foot">${label("需要更有针对性的服务？", "Need more tailored support?")} <a class="advisor-widget__foot-link" href="/apps/site/Lumino%20联系.dc.html?source=advisor-foot">${label("联系我们", "Contact us")}</a></footer>
    <div class="advisor-widget__status" aria-live="polite" aria-atomic="true"></div>`;
    document.body.appendChild(panel);

    panel.querySelector(".advisor-widget__close").addEventListener("click", close);
    panel.querySelector(".advisor-widget__reset").addEventListener("click", reset);
    panel.querySelector(".advisor-widget__stop").addEventListener("click", () => stopActive("user_stop"));
    panel.querySelector(".advisor-thread").addEventListener("click", (event) => {
      const stopBtn = event.target.closest("[data-advisor-stop]");
      if (stopBtn) {
        const article = stopBtn.closest(".advisor-turn--assistant");
        stopActive("user_stop");
        clearPrintTimer();
        if (article) article.dispatchEvent(new Event("advisor:stop-print"));
        return;
      }
      const expand = event.target.closest("[data-advisor-expand]");
      if (expand) {
        const article = expand.closest(".advisor-turn--assistant");
        clearPrintTimer();
        const full = article?.dataset.fullText || article?.querySelector(".advisor-answer__text")?.textContent || "";
        const textNode = article.querySelector(".advisor-answer__text");
        if (textNode) textNode.textContent = full;
        article.dataset.printing = "0";
        expand.remove();
        return;
      }
      const retry = event.target.closest("[data-advisor-retry]");
      if (retry && lastRequest) {
        appendExchange(lastUserLabel || label("重试", "Retry"), lastRequest, { topicId: lastRequest.topicId, freeText: !lastRequest.topicId });
        return;
      }
      const cta = event.target.closest("[data-advisor-cta]");
      if (cta) {
        trackMetric({
          type: "cta",
          cta_type: cta.dataset.advisorCta || "link",
          answer_mode: cta.dataset.answerMode || "",
        });
      }
      if (busy) return;
      const topic = event.target.closest(".advisor-topic[data-topic-id]");
      if (topic) appendExchange(topic.textContent.trim(), { topicId: topic.dataset.topicId }, { topicId: topic.dataset.topicId });
      const reply = event.target.closest("[data-reply-id]");
      if (reply) appendExchange(reply.textContent.trim(), { topicId: reply.dataset.topicId, replyId: reply.dataset.replyId, text: reply.textContent.trim() }, { topicId: reply.dataset.topicId });
    });
    const form = panel.querySelector("form");
    const textarea = panel.querySelector("textarea");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (busy) return;
      const value = textarea.value.trim();
      if (!value) return;
      textarea.value = "";
      if (containsSensitiveInfo(value)) return showSensitiveWarning();
      appendExchange(value, { text: value }, { freeText: true });
    });
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        if (busy) stopActive("user_stop");
        else close();
      }
    });
    return panel;
  }

  function open(options) {
    trigger = options?.trigger || document.activeElement;
    if (options?.flags && typeof options.flags === "object") runtimeFlags = { ...runtimeFlags, ...options.flags };
    const element = mount();
    element.hidden = false;
    const toolRoot = document.querySelector(".tool-float");
    if (toolRoot) toolRoot.hidden = true;
    element.querySelector("textarea").focus({ preventScroll: true });
  }

  function close() {
    if (!panel) return;
    if (busy) stopActive("close");
    panel.hidden = true;
    const toolRoot = document.querySelector(".tool-float");
    if (toolRoot) toolRoot.hidden = false;
    if (trigger && typeof trigger.focus === "function") trigger.focus({ preventScroll: true });
  }

  root.LuminoAdvisorWidget = Object.freeze({ open, close, reset });
})(window);
