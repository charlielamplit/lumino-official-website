"use strict";

  const roleConfig = {
    customer_owner: {
      name: "周岚", initial: "周", title: "项目协调人", company: "华星钢铁有限公司",
      nav: [
        ["work", "◉", "当前工作", "1"], ["roadmap", "→", "全年流程"], ["services", "▣", "服务与范围"],
        ["products", "◇", "产品与工厂"], ["data", "▦", "季度数据", "2"],
        ["results", "∿", "计算与成本", "2"], ["deliverables", "□", "报告与交付"],
        ["team", "◎", "团队与权限"]
      ]
    },
    customer_admin: {
      name: "周岚", initial: "周", title: "企业管理员", company: "华星钢铁有限公司",
      nav: [["work", "◉", "当前工作", "1"], ["roadmap", "→", "全年流程"], ["products", "◇", "产品与工厂"], ["data", "▦", "季度数据", "2"], ["results", "∿", "计算与成本", "2"], ["deliverables", "□", "报告与交付"], ["programs", "▣", "年度与订单"], ["team", "◎", "企业与权限", "2"]]
    },
    customer_contrib: {
      name: "陈浩", initial: "陈", title: "数据贡献者", company: "华星钢铁有限公司",
      nav: [["contributor-work", "◉", "分配给我", "2"], ["data", "▦", "我的材料"]]
    },
    customer_approver: {
      name: "赵海峰", initial: "赵", title: "内部审批人", company: "华星钢铁有限公司",
      nav: [["approvals", "✓", "待我审批", "2"], ["deliverables", "□", "合规交付"], ["results", "∿", "结果摘要"]]
    },
    expert: {
      name: "王晨", initial: "王", title: "CBAM 制备专家", company: "Lumino 服务团队",
      nav: [["queue", "◉", "判断队列", "12"], ["case-workspace", "▣", "案件工作台"], ["findings", "!", "Findings", "7"]]
    },
    reviewer: {
      name: "李娜", initial: "李", title: "独立复核专家", company: "Lumino 复核中心",
      nav: [["review", "✓", "复核与锁定", "3"]]
    },
    ops: {
      name: "林晓", initial: "林", title: "客户运营", company: "Lumino 项目中心",
      nav: [["engagements", "▣", "订单履约", "3"], ["workflow-governance", "∿", "状态与责任"], ["portfolio", "◉", "项目组合", "8"], ["handoffs", "→", "交接中心", "2"], ["sla", "◷", "SLA 与阻塞", "5"], ["resources", "◎", "资源与异常"]]
    },
    sales: {
      name: "陈宇", initial: "陈", title: "商务顾问", company: "Lumino 商务中心",
      nav: [["leads", "◉", "线索与客户", "6"], ["quotes", "◇", "报价与合同", "4"], ["accounts", "◎", "客户关系"]]
    },
    importer: {
      name: "Anna", initial: "A", title: "欧盟进口商 / 申报人", company: "NordWerk GmbH",
      nav: [["received-packages", "□", "收到的数据包", "2"], ["importer-questions", "?", "问题与回执", "1"]]
    },
    verifier: {
      name: "Marta", initial: "M", title: "第三方核查员", company: "Veritas Climate GmbH",
      nav: [["verification-cases", "✓", "核查案件", "2"], ["verification-findings", "!", "核查发现", "3"]]
    },
    supplier: {
      name: "刘明", initial: "刘", title: "前体供应商", company: "北方特钢有限公司",
      nav: [["supplier-requests", "→", "数据请求", "2"], ["supplier-history", "□", "已提交记录"]]
    },
    support: {
      name: "许言", initial: "许", title: "平台支持", company: "Lumino 平台团队",
      nav: [["support-cases", "◉", "支持工单", "4"], ["job-health", "◷", "任务运行", "1"]]
    },
    platform_admin: {
      name: "顾清", initial: "顾", title: "平台管理员", company: "Lumino 平台团队",
      nav: [["tenant-governance", "◎", "租户治理"], ["rulepacks", "▣", "规则包"], ["audit-events", "□", "审计与紧急访问", "1"]]
    }
  };

  const customerGlobalNav = [
    ["services-hub", "▦", "服务总览"],
    ["shared-tasks", "✓", "我的任务"],
    ["shared-files", "□", "数据资产"],
    ["shared-deliverables", "↗", "交付中心"],
    ["org-settings", "◎", "企业与权限"],
  ];

  const serviceRegistry = {
    cbam: {
      ...window.LuminoServiceContract.cbam,
      id: "cbam", serviceId: "cbam", code: "CBAM", name: "欧盟碳边境合规", status: "active", statusLabel: "已开通",
      agent: "CBAM Agent", description: "从年度范围、季度数据到核查和进口商交付。",
      entryPage: "work", roles: ["customer_admin", "customer_owner", "customer_contrib", "customer_approver"],
      primaryAction: { default: "继续当前工作", customer_contrib: "查看分配给我", customer_approver: "处理待审批事项" }, consultation: { enabled: false },
      nav: [
        ["work", "◉", "当前工作", "1"], ["roadmap", "→", "全年流程"], ["products", "◇", "产品与工厂"],
        ["data", "▦", "季度数据", "2"], ["results", "∿", "计算与成本", "2"], ["deliverables", "□", "报告与交付"],
      ],
    },
    pcf: {
      ...window.LuminoServiceContract.pcf,
      id: "pcf", serviceId: "pcf", code: "PCF", name: "产品碳足迹", status: "pilot", statusLabel: "试点",
      agent: "PCF Agent", description: "建立产品边界、活动数据和可追溯的碳足迹报告。",
      entryPage: "pcf-scope", roles: ["customer_admin", "customer_owner", "customer_contrib", "customer_approver"],
      primaryAction: { default: "开始或继续 PCF 项目" }, consultation: { enabled: false },
      nav: [
        ["pcf-scope", "◎", "核算声明"], ["pcf-boundary", "◇", "系统边界"], ["pcf-data", "▦", "活动数据", "1"],
        ["pcf-results", "∿", "计算与热点"], ["pcf-report", "□", "复核与受控报告"],
      ],
    },
    esg: { ...window.LuminoServiceContract.esg, serviceId: "esg", code: "ESG", agent: "ESG Agent", description: "组织议题、指标、证据与披露内容协同。", entryPage: null, roles: [], primaryAction: { default: "预约咨询" }, consultation: { enabled: true, requestType: "service_consultation" } },
    inventory: { ...window.LuminoServiceContract.inventory, serviceId: "inventory", code: "GHG", agent: "盘查 Agent", description: "组织边界、排放源、活动数据与盘查报告。", entryPage: null, roles: [], primaryAction: { default: "预约咨询" }, consultation: { enabled: true, requestType: "service_consultation" } },
    assets: { ...window.LuminoServiceContract.assets, serviceId: "assets", code: "EAC", agent: "资产 Agent", description: "碳资产与绿色电力证书的需求梳理和履约支持。", entryPage: null, roles: [], primaryAction: { default: "预约咨询" }, consultation: { enabled: true, requestType: "service_consultation" } },
    export: { ...window.LuminoServiceContract.export, serviceId: "export", code: "TRADE", agent: "出口合规 Agent", description: "面向出口法规、材料与交付要求的协同支持。", entryPage: null, roles: [], primaryAction: { default: "预约咨询" }, consultation: { enabled: true, requestType: "service_consultation" } },
  };

  const globalCustomerPages = new Set(customerGlobalNav.map(([id]) => id));
  const servicePages = new Set(Object.values(serviceRegistry).flatMap((service) => (service.nav || []).map(([id]) => id)));

  const years = {
    "2027": { label: "2027 · 待开始", short: "待开始 · 可准备", progress: 8, chip: "warn" },
    "2026": { label: "2026 · Q3 进行中", short: "Q3 数据采集中", progress: 68, chip: "active" },
    "2025": { label: "2025 · 完整归档", short: "已完成 · 已封存", progress: 100, chip: "locked" }
  };

  const annualProfiles = {
    "2025": {
      mode: "archived", defaultQuarter: "Q4", step: 5, progress: 100,
      position: "年度已完成并封存", foundation: "4 个产品 · 2 座工厂 · 监测计划 Rev 2",
      quarters: { Q1: ["已冻结", 100, "ok"], Q2: ["已冻结", 100, "ok"], Q3: ["已冻结", 100, "ok"], Q4: ["已冻结", 100, "ok"] },
      monitoring: ["已锁定 · Rev 2", "2025-03-15"], emissions: ["已核查 · Rev 1", "2026-03-08"], verification: ["核查完成", "无开放 Finding"],
    },
    "2026": {
      mode: "active", defaultQuarter: "Q3", step: 3, progress: 68,
      position: "Q3 数据采集中", foundation: "4 个产品 · 2 座工厂 · 监测计划 Rev 3",
      quarters: { Q1: ["已完成", 100, "ok"], Q2: ["已完成", 100, "ok"], Q3: ["采集中", 68, "warn"], Q4: ["未开始", 0, ""] },
      monitoring: ["当前适用 · Rev 3", "本年度方法已建立"], emissions: ["尚未生成", "年度关账后生成"], verification: ["尚未开始", "年度报告批准后启动"],
    },
    "2027": {
      mode: "planned", defaultQuarter: "Q1", step: 1, progress: 8,
      position: "年度准备 · 待确认范围", foundation: "已引用企业主档 · 产品与工厂待年度确认",
      quarters: { Q1: ["待计划", 0, ""], Q2: ["待计划", 0, ""], Q3: ["待计划", 0, ""], Q4: ["待计划", 0, ""] },
      monitoring: ["待生成年度草稿", "范围确认后开始"], emissions: ["未开始", "等待年度数据"], verification: ["未开始", "等待年度报告"],
    },
  };

  const certificatePrices2026 = {
    Q1: { price: "€75.36", published: "2026-04-07" },
    Q2: { price: "€75.28", published: "2026-07-06" },
    Q3: { price: "€82.32", published: "2026-10-05" },
    Q4: { price: "待发布", published: "预计 2027-01-04" },
  };
  const quarterMeta = {
    Q1: { months: "1–3 月", endMonth: "3 月" },
    Q2: { months: "4–6 月", endMonth: "6 月" },
    Q3: { months: "7–9 月", endMonth: "9 月" },
    Q4: { months: "10–12 月", endMonth: "12 月" },
  };

  const workflowStates = {
    productMaster: {
      label: "企业产品主档", cadence: "企业 × 产品 × 有效期版本", current: "ACTIVE",
      states: ["DRAFT", "ACTIVE", "SUSPENDED", "RETIRED"],
      next: "核对下一年度引用范围；历史快照不回写"
    },
    cnDecision: {
      label: "CN Code 决定", cadence: "产品 × 编码 × 有效期", current: "UNDER_REVIEW",
      states: ["SUGGESTED", "UNDER_REVIEW", "CONFIRMED", "SUPERSEDED"],
      next: "关务确认 72083900 的商品描述与依据"
    },
    shipment: {
      label: "出口发运匹配", cadence: "发运批次 × 季度 × 进口商", current: "NEEDS_REVIEW",
      states: ["IMPORTED", "MATCHING", "NEEDS_REVIEW", "RECONCILED", "INCLUDED", "FROZEN"],
      next: "确认 EuroFab 退运批次是否排除"
    },
    evidence: {
      label: "证据处理", cadence: "文件版本 × 事实范围", current: "PARSED",
      states: ["UPLOADED", "SECURITY_SCANNED", "PARSED", "CLASSIFIED", "LINKED", "REVIEWED", "ACCEPTED", "ARCHIVED"],
      next: "项目协调人确认账期、设施和提取值"
    },
    calculation: {
      label: "计算运行", cadence: "输入快照 × 规则包 × 价格版本", current: "CURRENT",
      states: ["QUEUED", "RUNNING", "SUCCEEDED", "CURRENT", "STALE", "SUPERSEDED"],
      next: "供应商映射变化后创建 Run 05"
    },
    finding: {
      label: "Finding", cadence: "问题 × 对象 × 来源", current: "VALIDATING",
      states: ["OPEN", "TRIAGED", "ASSIGNED", "RESPONSE_SUBMITTED", "VALIDATING", "RESOLVED", "CLOSED"],
      next: "专家验证客户回应；外部核查 Finding 不可内部风险接受"
    },
    quarterlyPackage: {
      label: "季度数据包", cadence: "季度 × 进口商范围", current: "COLLECTING",
      states: ["NOT_STARTED", "PLANNED", "COLLECTING", "READY_FOR_REVIEW", "APPROVED", "PACKAGE_READY", "SHARED", "ACKNOWLEDGED", "FROZEN"],
      next: "补齐 Q3 天然气账单与 1 批发运数量"
    },
    emissionsReport: {
      label: "设施年度排放报告", cadence: "年度 × 设施", current: "DRAFT",
      states: ["DRAFT", "GENERATED", "VALIDATED", "INTERNAL_REVIEW", "APPROVED", "LOCKED", "SHARED", "DELIVERED", "ACKNOWLEDGED"],
      next: "全年数据齐备后生成上海一厂 Rev 1"
    },
    verification: {
      label: "设施核查报告", cadence: "年度 × 设施 × 核查机构", current: "NOT_STARTED",
      states: ["NOT_STARTED", "PLANNED", "IN_VERIFICATION", "REMEDIATION", "VERIFIED", "DELIVERED", "ACKNOWLEDGED"],
      next: "先完成年度排放报告内部复核"
    },
    importerSupport: {
      label: "进口商年度申报支持包", cadence: "年度 × 进口商", current: "NOT_STARTED",
      states: ["NOT_STARTED", "DRAFT", "VALIDATED", "APPROVED", "LOCKED", "SHARED", "ACKNOWLEDGED"],
      next: "等待年度核查结论；正式申报由欧盟申报人完成"
    },
    serviceOrder: {
      label: "Lumino 服务订单", cadence: "订单版本", current: "ACTIVE",
      states: ["DRAFT", "PENDING_CUSTOMER_CONFIRMATION", "SIGNED_PENDING_HANDOFF", "PENDING_OPS_ACCEPTANCE", "ACTIVATING", "ACTIVE", "PENDING_ACCEPTANCE", "COMPLETED", "CLOSED"],
      next: "下一里程碑：Q3 数据包交付"
    },
    workPackage: {
      label: "专家工作包", cadence: "任务授权", current: "IN_PROGRESS",
      states: ["DRAFT", "READY", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "SUBMITTED", "REVIEWED", "DONE"],
      next: "王晨提交 Run 05；李娜独立复核"
    },
    handoff: {
      label: "跨角色交接", cadence: "交接单 × 工作包", current: "SENT",
      states: ["PROPOSED", "SENT", "ACCEPTED", "CLOSED"],
      next: "运营接收商务交接后启动 SLA"
    },
    approval: {
      label: "具名审批", cadence: "决定对象 × 版本", current: "IN_REVIEW",
      states: ["PENDING", "IN_REVIEW", "APPROVED", "WITHDRAWN", "SUPERSEDED"],
      next: "内部审批人查看差异、依据和影响后决定"
    }
  };

  const workflowObjectRefs = {
    productMaster: ["PRD-HRC-01", "productMaster"], cnDecision: ["CN-HRC-72083900", "cnDecision"], shipment: ["SHP-2026-Q3-EUROFAB", "shipment"],
    evidence: ["EVD-HX-POWER-2026Q3", "evidence"], calculation: ["RUN-04", "calculationRun"], finding: ["FND-PRE-004", "finding"],
    quarterlyPackage: ["PKG-2026-Q3-NORDWERK", "quarterlyPackage"], emissionsReport: ["OER-2026-SH01-R1", "formalArtifact"],
    verification: ["VER-2026-SH01", "verification"], importerSupport: ["IDS-2026-NORDWERK-R1", "formalArtifact"],
    serviceOrder: ["SO-2026-018-R2", "serviceOrder"], workPackage: ["WP-CALC-026", "workPackage"], handoff: ["HO-2026-043", "handoff"], approval: ["AP-2026-014", "approval"],
  };

  const workflowEngine = new window.LuminoWorkflow.WorkflowEngine({ storage: window.localStorage });
  workflowEngine.seed([
    { id: "PRD-HRC-01", type: "productMaster", status: "ACTIVE", owner: "周岚", scope: "热轧非合金钢卷" },
    { id: "CN-HRC-72083900", type: "cnDecision", status: "UNDER_REVIEW", owner: "关务负责人", scope: "PRD-HRC-01" },
    { id: "SHP-2026-Q3-EUROFAB", type: "shipment", status: "NEEDS_REVIEW", owner: "外贸负责人", year: "2026", quarter: "Q3", scope: "EuroFab S.r.l." },
    { id: "EVD-HX-POWER-2026Q3", type: "evidence", status: "ACCEPTED", owner: "周岚", year: "2026", quarter: "Q3", scope: "上海一厂电力账单", metadata: { assetId: "EVD-HX-POWER-2026Q3", activityAssetId: "REC-HX-POWER-2026Q3" } },
    { id: "FACT-2026-Q3-GAS", type: "fact", status: "MISSING", owner: "周岚", year: "2026", quarter: "Q3", scope: "江苏二厂天然气用量", metadata: { facilityAssetId: "FAC-JS-02" } },
    { id: "RUN-04", type: "calculationRun", status: "CURRENT", owner: "王晨", year: "2026", quarter: "Q3", dependsOn: ["FACT-2026-Q3-GAS"], metadata: { rulepack: "EU-CBAM-2026.3" } },
    { id: "FND-PRE-004", type: "finding", status: "OPEN", owner: "王晨", year: "2026", quarter: "Q3", metadata: { source: "INTERNAL", severity: "HIGH" } },
    { id: "PKG-2026-Q3-NORDWERK", type: "quarterlyPackage", status: "COLLECTING", owner: "周岚", year: "2026", quarter: "Q3", scope: "NordWerk GmbH" },
    { id: "OER-2026-SH01-R1", type: "formalArtifact", status: "DRAFT", owner: "王晨", year: "2026", scope: "上海一厂", metadata: { artifactType: "OPERATOR_EMISSIONS_REPORT", facilityAssetId: "FAC-SH-01" } },
    { id: "VER-2026-SH01", type: "verification", status: "NOT_STARTED", owner: "Veritas Climate GmbH", year: "2026", scope: "上海一厂", metadata: { facilityAssetId: "FAC-SH-01" } },
    { id: "IDS-2026-NORDWERK-R1", type: "formalArtifact", status: "DRAFT", owner: "林晓", year: "2026", scope: "NordWerk GmbH", metadata: { artifactType: "IMPORTER_DECLARATION_SUPPORT" } },
    { id: "SO-2026-018-R2", type: "serviceOrder", status: "ACTIVE", owner: "林晓", year: "2026", scope: "华星钢铁 CBAM 全流程服务" },
    { id: "WP-CALC-026", type: "workPackage", status: "IN_PROGRESS", owner: "王晨", year: "2026", scope: "计算与报告制备" },
    { id: "HO-2026-043", type: "handoff", status: "SENT", owner: "林晓", year: "2026", scope: "商务 → 运营" },
    { id: "AP-2026-014", type: "approval", status: "IN_REVIEW", owner: "赵海峰", year: "2026", scope: "默认值并行路径" },
  ].map((object) => ({ ...object, metadata: { serviceId: "cbam", ...(object.metadata || {}) } })));
  workflowEngine.seed([
    { id: "PCF-2026-001", type: "serviceCase", status: "SCOPING", owner: "周岚", year: "2026", scope: "热轧非合金钢卷 · 从摇篮到大门", metadata: {
      serviceId: "pcf",
      productId: "PRD-HRC-01",
      declaration: {
        schemaVersion: "0.1.0",
        productId: "PRD-HRC-01",
        productName: "热轧非合金钢卷",
        goal: "客户披露与供应链响应",
        intendedUse: "向下游客户与进口商提供可追溯的产品碳足迹信息",
        audience: "客户、供应链伙伴与内部管理",
        functionalUnit: "1 吨热轧非合金钢卷",
        referenceFlow: "1 吨出厂热轧非合金钢卷",
        periodStart: "2026-01-01",
        periodEnd: "2026-09-30",
        period: "2026-01-01 至 2026-09-30",
        geography: "中国 · 生产设施所在地",
        technology: "高炉—转炉、连铸与热轧",
        confirmed: false,
        confirmedAt: null,
        confirmedBy: null
      },
      boundary: {
        schemaVersion: "0.1.0",
        boundaryType: "从摇篮到大门",
        functionalUnitRef: "1 吨热轧非合金钢卷",
        includedProcesses: ["上游原料开采与加工", "炼铁", "炼钢", "连铸", "热轧", "厂内运输与能源使用"],
        excludedItems: ["销售运输", "产品使用阶段", "报废与回收（除非客户另有要求）"],
        cutOffRule: "单项贡献低于最终结果 1% 且合计不超过 5% 的辅料与耗材可截断",
        cutOffRationale: "符合常见钢铁产品从摇篮到大门披露实践；截断项需在报告中列示",
        primaryInputs: ["铁矿石", "焦炭", "废钢", "电力", "天然气"],
        status: "PROPOSED",
        proposalId: null,
        promptId: null,
        confirmed: false,
        confirmedAt: null,
        confirmedBy: null
      },
      template: {
        schemaVersion: "0.1.0",
        packVersion: "PCF-DATA-PACK-1.0",
        filename: "",
        status: "NOT_UPLOADED",
        scenario: "valid",
        supportFileCount: 0,
        issues: [],
        domains: [],
        validatedAt: null,
        agentTaskId: null
      },
      factors: null
    } },
  ]);

  const assetRegistry = new window.LuminoAssets.AssetRegistry({ storage: window.localStorage });
  const agentTaskEngine = new window.LuminoAgentRuntime.AgentTaskEngine({
    storage: window.localStorage,
    capabilities: window.LuminoAgentCapabilities,
  });
  assetRegistry.seed({
    assets: [
      {
        id: "ORG-HX-001", type: "organization", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "华星钢铁有限公司",
        payload: { legalName: "华星钢铁有限公司", registrationCode: "91310000••••••••3X", country: "CN" },
        quality: { status: "verified", completeness: 1, traceability: 1, issues: [] },
        access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
        steward: { ownerName: "周岚", ownerRole: "customer_admin" }, tags: ["企业主档"],
      },
      {
        id: "FAC-SH-01", type: "facility", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "上海一厂",
        subjectRefs: { organizationId: "ORG-HX-001" }, payload: { internalCode: "SH-01", activity: "高炉—转炉、轧制与镀层 · 3 条生产线", country: "CN", region: "上海", operationalStatus: "在用" },
        quality: { status: "verified", completeness: 0.96, traceability: 1, issues: [] },
        access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
        steward: { ownerName: "生产管理部", assignedRole: "customer_contrib" }, tags: ["设施主档"],
      },
      {
        id: "FAC-JS-02", type: "facility", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "江苏二厂",
        subjectRefs: { organizationId: "ORG-HX-001" }, payload: { internalCode: "JS-02", activity: "电弧炉与型钢 · 2 条生产线", country: "CN", region: "江苏", operationalStatus: "在用" },
        quality: { status: "verified", completeness: 0.9, traceability: 1, issues: [] },
        access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
        steward: { ownerName: "生产管理部", assignedRole: "customer_contrib" }, tags: ["设施主档"],
      },
      {
        id: "PRD-HRC-01", type: "product", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "热轧非合金钢卷",
        subjectRefs: { facilityId: "FAC-SH-01" }, payload: { internalCode: "HRC-01", uiKey: "hrc", cnCodes: ["72083900"], cnLabel: "CN 7208 候选已由关务确认", summary: "3 个生产配置", scopeYears: ["2025", "2026", "2027"], specification: "企业销售产品" },
        quality: { status: "usable", completeness: 0.92, traceability: 1, issues: [] },
        access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
        steward: { ownerName: "产品管理", assignedRole: "customer_owner" }, tags: ["产品主档"],
      },
      {
        id: "PRD-CTS-01", type: "product", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "镀层钢板",
        subjectRefs: { facilityId: "FAC-SH-01" }, payload: { internalCode: "CTS-01", uiKey: "coated", cnCodes: ["72103000"], cnLabel: "CN 7210 候选 · 待关务复核", summary: "1 个生产配置 · 缺外包证明", scopeYears: ["2025", "2026", "2027"] },
        quality: { status: "usable", completeness: 0.8, traceability: 0.9, issues: ["外包镀层证明待补充"] },
        access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
        steward: { ownerName: "产品管理", assignedRole: "customer_owner" }, tags: ["产品主档"],
      },
      {
        id: "PRD-SEC-01", type: "product", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "型钢",
        subjectRefs: { facilityId: "FAC-JS-02" }, payload: { internalCode: "SEC-01", uiKey: "section", cnCodes: ["72161000"], cnLabel: "CN 7216 已确认", summary: "1 个生产配置", scopeYears: ["2025", "2026", "2027"] },
        quality: { status: "usable", completeness: 0.88, traceability: 1, issues: [] },
        access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
        steward: { ownerName: "产品管理", assignedRole: "customer_owner" }, tags: ["产品主档"],
      },
      {
        id: "PRD-WRD-01", type: "product", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "非合金钢盘条",
        subjectRefs: { facilityId: "FAC-JS-02" }, payload: { internalCode: "WRD-01", uiKey: "wire", cnCodes: ["72131000"], cnLabel: "CN 7213 已确认", summary: "2 个生产配置", scopeYears: ["2025", "2026", "2027"] },
        quality: { status: "usable", completeness: 0.86, traceability: 1, issues: [] },
        access: { confidentiality: "general", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
        steward: { ownerName: "产品管理", assignedRole: "customer_owner" }, tags: ["产品主档"],
      },
      {
        id: "EVD-HX-POWER-2026Q3", type: "evidence", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "上海一厂 2026 Q3 电力账单",
        subjectRefs: { facilityId: "FAC-SH-01" }, temporal: { periodStart: "2026-07-01", periodEnd: "2026-09-30", recordedAt: "2026-10-08T09:15:00Z" },
        payload: { fileName: "上海一厂_2026Q3_电力账单.pdf", mediaType: "application/pdf", fileSize: 2480000, contentHash: "sha256:demo-power-2026q3", documentType: "energy_invoice", issuedBy: "国网上海市电力公司", securityScanStatus: "passed", parseStatus: "parsed" },
        provenance: { sourceType: "upload", sourceAssetIds: [] }, quality: { status: "usable", completeness: 1, accuracy: 0.95, consistency: 1, timeliness: 1, uniqueness: 1, traceability: 1, methodologicalFit: null, issues: [] },
        access: { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: ["customer_approver"], metadataVisible: true, retentionPolicyId: "RET-COMPLIANCE-10Y" },
        steward: { ownerName: "EHS 部门", assignedRole: "customer_contrib" }, tags: ["能源", "原始证据"],
      },
      {
        id: "REC-HX-POWER-2026Q3", type: "energyConsumption", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "上海一厂购入电力",
        subjectRefs: { facilityId: "FAC-SH-01", counterpartyId: "ORG-GRID-SH" }, temporal: { periodStart: "2026-07-01", periodEnd: "2026-09-30", recordedAt: "2026-10-08T09:18:00Z" },
        payload: { metricCode: "energy.electricity.purchased", originalValue: "12480", originalUnit: "MWh", normalizedValue: "12480000", normalizedUnit: "kWh", conversionRuleId: "UNIT-MWH-KWH@1.0.0", dataOrigin: "invoice" },
        provenance: { sourceType: "agent-extraction", sourceAssetIds: ["EVD-HX-POWER-2026Q3"], extractionRuleVersion: "extract-energy@1.0.0", confirmedBy: "周岚", confirmedAt: "2026-10-09T02:00:00Z" },
        quality: { status: "usable", completeness: 1, accuracy: 0.9, consistency: 1, timeliness: 1, uniqueness: 1, traceability: 1, methodologicalFit: null, issues: [] },
        access: { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: ["customer_approver"], metadataVisible: true },
        steward: { ownerName: "EHS 部门", assignedRole: "customer_contrib" }, tags: ["能源", "活动数据", "可跨服务复用"],
      },
      {
        id: "EVD-HX-SHIPMENT-2026Q3", type: "evidence", status: "CONFIRMED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "2026 Q3 出口发运台账",
        temporal: { periodStart: "2026-07-01", periodEnd: "2026-09-30", recordedAt: "2026-10-06T06:20:00Z" },
        payload: { fileName: "2026Q3_出口发运台账.xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contentHash: "sha256:demo-shipment-2026q3", documentType: "shipment_ledger", securityScanStatus: "passed", parseStatus: "parsed" },
        provenance: { sourceType: "upload", sourceAssetIds: [] }, quality: { status: "usable", completeness: 0.94, traceability: 1, issues: ["1 个退运批次待确认"] },
        access: { confidentiality: "highly_sensitive", visibility: "restricted", allowedRoles: ["customer_approver"], metadataVisible: true },
        steward: { ownerName: "外贸部", assignedRole: "customer_owner" }, tags: ["发运", "原始证据"],
      },
      {
        id: "REC-HX-OUTPUT-2026YTD", type: "productionOutput", status: "NEEDS_CONFIRMATION", tenantId: "TNT-0018", ownerOrganizationId: "ORG-HX-001", name: "热轧非合金钢卷累计产量",
        subjectRefs: { facilityId: "FAC-SH-01", productId: "PRD-HRC-01" }, temporal: { periodStart: "2026-01-01", periodEnd: "2026-09-30", recordedAt: "2026-10-10T04:00:00Z" },
        payload: { metricCode: "production.output", originalValue: "8400", originalUnit: "t", normalizedValue: "8400", normalizedUnit: "t", dataOrigin: "erp" },
        provenance: { sourceType: "agent-extraction", sourceAssetIds: ["EVD-HX-SHIPMENT-2026Q3"], extractionRuleVersion: "extract-output@0.4.0" },
        quality: { status: "needs_review", completeness: 0.86, accuracy: null, consistency: 0.75, timeliness: 1, uniqueness: 1, traceability: 0.8, methodologicalFit: null, issues: ["需确认出口量与生产量口径"] },
        access: { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
        steward: { ownerName: "生产 / 财务", assignedRole: "customer_owner" }, tags: ["产量", "待确认"],
      },
      {
        id: "DECL-SUPPLIER-PCF-001", type: "supplierDeclaration", status: "PROPOSED", tenantId: "TNT-0018", ownerOrganizationId: "ORG-NORTH-STEEL", name: "北方特钢钢坯 PCF 声明",
        subjectRefs: { productId: "PRD-BILLET-01", counterpartyId: "ORG-NORTH-STEEL" }, temporal: { validFrom: "2025-01-01", validTo: "2026-12-31", recordedAt: "2026-10-18T03:30:00Z" },
        payload: { declaredValue: "1.62", declaredUnit: "tCO2e/t", boundary: "cradle-to-gate", verificationStatus: "supplier_asserted" },
        provenance: { sourceType: "agent-extraction", sourceAssetIds: ["EVD-SUPPLIER-PCF-001"], extractionRuleVersion: "extract-supplier-pcf@0.2.0" },
        quality: { status: "needs_review", completeness: 0.72, accuracy: null, consistency: 0.8, timeliness: 0.9, uniqueness: 1, traceability: 0.6, methodologicalFit: null, issues: ["方法与系统边界待专家确认"] },
        access: { confidentiality: "sensitive", visibility: "service_bound", allowedRoles: [], metadataVisible: true },
        steward: { ownerName: "采购部", assignedRole: "customer_owner" }, tags: ["供应商", "PCF", "待确认"],
      },
    ],
    bindings: [
      { id: "BIND-EVD-POWER-CBAM", serviceId: "cbam", caseId: "CBAM-2026-Q3", assetId: "EVD-HX-POWER-2026Q3", status: "CONFIRMED", usagePurpose: "季度能源证据", scopeId: "FAC-SH-01" },
      { id: "BIND-EVD-POWER-PCF", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "EVD-HX-POWER-2026Q3", status: "PENDING_CONFIRMATION", usagePurpose: "产品能源证据", scopeId: "PCF-SCOPE-HRC-01" },
      { id: "BIND-REC-POWER-CBAM", serviceId: "cbam", caseId: "CBAM-2026-Q3", assetId: "REC-HX-POWER-2026Q3", status: "CONFIRMED", usagePurpose: "季度间接排放", scopeId: "FAC-SH-01" },
      { id: "BIND-REC-POWER-PCF", serviceId: "pcf", caseId: "PCF-2026-001", assetId: "REC-HX-POWER-2026Q3", status: "PENDING_CONFIRMATION", usagePurpose: "产品活动数据用途", scopeId: "PCF-SCOPE-HRC-01", allocationRuleId: "MASS-ALLOCATION@1" },
      { id: "BIND-EVD-SHIP-CBAM", serviceId: "cbam", caseId: "CBAM-2026-Q3", assetId: "EVD-HX-SHIPMENT-2026Q3", status: "CONFIRMED", usagePurpose: "出口发运对账", scopeId: "CBAM-2026-Q3" },
    ],
    lineage: [
      { id: "LIN-POWER-EXTRACT", fromAssetId: "EVD-HX-POWER-2026Q3", toAssetId: "REC-HX-POWER-2026Q3", activityType: "AGENT_EXTRACTION", agentType: "agent", agentId: "asset-agent", ruleVersion: "extract-energy@1.0.0" },
      { id: "LIN-SHIP-OUTPUT", fromAssetId: "EVD-HX-SHIPMENT-2026Q3", toAssetId: "REC-HX-OUTPUT-2026YTD", activityType: "AGENT_EXTRACTION", agentType: "agent", agentId: "asset-agent", ruleVersion: "extract-output@0.4.0" },
    ],
    transformations: [
      {
        id: "ALLOC-HRC-ELECTRICITY@1",
        tenantId: "TNT-0018",
        serviceId: "pcf",
        caseId: "PCF-2026-001",
        ruleType: "mass_allocation",
        ruleVersion: "1.0.0",
        name: "热轧卷电力质量分配",
        description: "按产品产量对购入电力进行质量分配",
        parameters: { method: "mass", productId: "PRD-HRC-01" },
        inputAssetVersionIds: ["REC-HX-POWER-2026Q3@1"],
        status: "ACTIVE",
      },
    ],
  });

  const defaultPages = { customer_admin: "services-hub", customer_owner: "services-hub", customer_contrib: "services-hub", customer_approver: "services-hub", expert: "queue", reviewer: "review", ops: "engagements", sales: "leads", importer: "received-packages", verifier: "verification-cases", supplier: "supplier-requests", support: "support-cases", platform_admin: "tenant-governance" };
  const incoming = new URLSearchParams(window.location.search);
  const incomingYear = incoming.get("year") || "2027";
  const incomingCnCode = incoming.get("cnCode") || "72081000";
  const incomingSector = incoming.get("sector") || "Iron and Steel";
  const incomingQuantity = Number(incoming.get("quantity"));
  const incomingEstimate = Number(incoming.get("estimatedCostCny"));
  const importedTrial = incoming.get("source") === "calculator" ? {
    year: /^20\d{2}$/.test(incomingYear) ? incomingYear : "2027",
    cnCode: /^\d{4,10}$/.test(incomingCnCode) ? incomingCnCode : "72081000",
    sector: incomingSector.replace(/[<>]/g, "").slice(0, 80) || "Iron and Steel",
    quantity: Number.isFinite(incomingQuantity) && incomingQuantity > 0 ? Math.min(incomingQuantity, 1e9) : 10000,
    estimatedCostCny: Number.isFinite(incomingEstimate) && incomingEstimate >= 0 ? Math.min(incomingEstimate, 1e12) : 3822222,
  } : null;
  const portalStateStorageKey = "lumino-multiservice-portal-ui-v2";
  let restoredPortalState = {};
  try { restoredPortalState = JSON.parse(window.localStorage.getItem(portalStateStorageKey) || "{}"); } catch (_) { restoredPortalState = {}; }
  const state = {
    role: "customer_owner", page: "services-hub", currentService: null, year: "2026", quarter: "Q3", loggedIn: false, answer: null,
    importedTrial, uploadAdded: false, factConfirmed: false, findingResolved: false,
    yearCreated: false, deliveryExpanded: null, productAdded: false,
    configurationAdded: false, orgEditing: false, selectedProduct: "hrc",
    productYears: [], productCnCodes: [], questionHelpOpen: false, findingChoiceOpen: false, dataPathChoice: null,
    drawer: null, assetFacet: "attention", periodData: {}, productOverrides: {}, configurationDrafts: {}, facilities: [], invitedMembers: [], consultationRequests: [], actionBusy: false,
    pcfCalculationFailed: incoming.get("scenario") === "pcf-calculation-failed",
    onboardingDismissed: window.localStorage.getItem("lumino-portal-onboarding") === "dismissed", online: navigator.onLine,
    organization: (() => {
      const org = assetRegistry.get("ORG-HX-001");
      return {
        name: org?.payload?.legalName || org?.name || "华星钢铁有限公司",
        code: org?.payload?.registrationCode || "91310000••••••••3X",
        address: org?.payload?.address || "上海市浦东新区临港工业区 88 号",
        assetId: "ORG-HX-001",
      };
    })(),
    ...restoredPortalState,
  };
  if (state.yearCreated && !years["2028"]) years["2028"] = { label: "2028 · 变化确认", short: "变化确认中", progress: 8, chip: "warn" };
  const $ = (selector) => document.querySelector(selector);
