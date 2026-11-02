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
      answer: L("先不要直接填数。先固定四件事：进口商要求的期间与模板、产品与 CN Code、生产厂区与产线、是否有需要纳入的前体材料。再按这个范围收集产量、燃料、外购电热和供应商声明。", "Do not start by filling numbers. First fix four things: the importer period and template, product and CN code, producing site and line, and any precursors in scope. Then collect output, fuels, purchased energy and supplier statements against that scope."),
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

  const toolRoutes = Object.freeze([
    {
      id: "tool-cn-code",
      intent: "cn_code_lookup",
      status: "published",
      version: "1.0.0",
      reviewedAt: "2026-11-02",
      reviewer: "Lumino CBAM 服务负责人",
      topicIds: ["cn_code_lookup"],
      keywords: ["cn code", "cn-code", "hs code", "taric", "海关编码", "商品编码", "查cn", "查 cn", "查hs", "查 hs"],
      answer: L("可以先使用现有工具。CBAM 试算器可从已支持的 CN Code 列表选择产品并进行成本试算；编码指南用于理解 HS、CN 和 TARIC 的关系与核对顺序。这些入口不替代正式海关归类或专家复核。", "Use the existing tools first. The CBAM calculator lets you select from supported CN codes and estimate cost; the code guide explains HS, CN and TARIC and the checking order. These tools do not replace formal customs classification or expert review."),
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
    contentVersion: "2026-11-02.2",
    reviewCycleDays: 120,
    topics,
    sources,
    fixedAnswers,
    toolRoutes
  });
});
