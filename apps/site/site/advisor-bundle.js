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
      keywords: ["cn code", "cn-code", "hs code", "hs 编码", "taric", "海关编码", "商品编码", "查cn", "查 cn", "查hs", "查 hs", "正式归类", "归类决定", "customs classification", "classify my goods", "正式 cn", "编码是多少", "认定我的", "告诉我编码"],
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

(function (root, factory) {
  "use strict";
  const schema = factory();
  if (typeof module === "object" && module.exports) module.exports = schema;
  root.LuminoAdvisorSchema = schema;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ANSWER_MODES = Object.freeze(["fixed", "tool_route", "retrieval_model", "fallback"]);
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
    cbam_data_start: ["进口商", "碳数据", "importer data", "communication template", "准备什么数据"],
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

  function buildReplyOutcome(record, replyId, replyLabel, lang) {
    const response = buildFixed(record, lang);
    const allowed = (record.suggestedReplies || []).find((item) => item.id === replyId);
    if (!allowed) return response;
    const selected = replyLabel || text(allowed.label, lang);
    response.answer = lang === "en"
      ? `Recorded: ${selected}. Next, use the reading or service entry below. A formal conclusion still needs the relevant business facts and, where applicable, specialist review.`
      : `已记录：${selected}。接下来可先查看下方资料或服务入口。正式结论仍需结合相关业务事实，必要时由专业人员复核。`;
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
        ? "I cannot confirm that from the guidance available here yet. Choose a topic below, or use the contact page for a scoped review."
        : "目前这里的说明还不足以确认这个问题。你可以选择下方话题，或通过联系页申请有范围的人工复核。",
      confidence: "low",
      service_matches: [],
      next_question: lang === "en" ? "Which topic is closest to your question?" : "以下哪个话题最接近你的问题？",
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
    if (answer && request.replyId) return buildReplyOutcome(answer, request.replyId, request.text, lang);
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
  const CHUNK_MS = 28;
  // Deterministic answers resolve in milliseconds; hold a short deliberation so
  // the UI does not feel like a canned dump. Model paths already wait upstream.
  const THINK_MIN_FIXED_MS = 1400;
  const THINK_MIN_DEFAULT_MS = 700;
  const THINK_MIN_REDUCED_MS = 320;
  const THINK_ROTATE_MS = 900;
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
        "Checking published guidance…",
        "Structuring the actionable points…",
        "Checking wording boundaries…",
      ]
      : [
        "对照已发布说明…",
        "整理可执行要点…",
        "核对表述边界…",
      ];
  }

  function minDeliberationMs(answerMode) {
    if (prefersReducedMotion()) return THINK_MIN_REDUCED_MS;
    if (answerMode === "fixed" || answerMode === "tool_route") return THINK_MIN_FIXED_MS;
    if (answerMode === "retrieval_model") return THINK_MIN_REDUCED_MS;
    return THINK_MIN_DEFAULT_MS;
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

  function waitMs(ms, signal) {
    const duration = Math.max(0, Number(ms) || 0);
    if (!duration) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(), duration);
      if (!signal) return;
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });
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
      return label("没有足够依据", "Not enough published basis");
    }
    if (response.answer_mode === "tool_route") return label("推荐工具", "Suggested tool");
    if (response.answer_mode === "fixed") return label("服务说明", "Guidance");
    if (response.answer_mode === "retrieval_model") return label("初步判断", "Preliminary view");
    return label("暂无法确认", "Unable to confirm");
  }

  function initialMarkup() {
    const topics = root.LuminoAdvisor.getTopics(lang());
    return `<section class="advisor-welcome">
      <p class="advisor-welcome__one">${label("用一句话提问，或点选话题", "Ask in one sentence, or pick a topic")}</p>
    </section>
    <div class="advisor-topics" aria-label="${label("预选话题", "Suggested topics")}">
      ${topics.map((topic) => `<button class="advisor-topic" type="button" data-topic-id="${escapeHtml(topic.id)}">${escapeHtml(topic.label)}</button>`).join("")}
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
      ${replies ? `<div class="advisor-replies">${replies}</div>` : ""}
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
      const unavailable = unavailableLocal(payloadReason || "network");
      unavailable.ui_state = "basic_mode";
      unavailable.answer = label(
        "已切换到基础问答模式（本地固定说明）。在线服务暂时不可用，你可以重试获取完整结果。",
        "Switched to basic guidance (local fixed answers). Online service is temporarily unavailable — retry for the full path."
      );
      return unavailable;
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
    if (prefersReducedMotion()) {
      textNode.textContent = fullText;
      article.dataset.printing = "0";
      actions.innerHTML = "";
      onDone(true);
      return;
    }
    let index = 0;
    const step = () => {
      index = Math.min(fullText.length, index + 12);
      textNode.textContent = fullText.slice(0, index);
      scrollToLatest();
      if (index >= fullText.length) {
        article.dataset.printing = "0";
        actions.innerHTML = "";
        onDone(true);
        return;
      }
      printTimer = setTimeout(step, CHUNK_MS);
    };
    actions.innerHTML = `<button type="button" class="advisor-stop" data-advisor-stop>${label("停止", "Stop")}</button>
      <button type="button" class="advisor-expand" data-advisor-expand>${label("显示全文", "Show full answer")}</button>`;
    article.dataset.fullText = fullText;
    step();
  }

  async function resolveResponse(request, article) {
    const payload = { ...request, lang: lang() };
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
      const elapsed = performance.now() - started;
      const remainingThink = minDeliberationMs(response.answer_mode) - elapsed;
      if (remainingThink > 0 && !activeAbort?.signal?.aborted) {
        await waitMs(remainingThink, activeAbort?.signal);
      }
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
