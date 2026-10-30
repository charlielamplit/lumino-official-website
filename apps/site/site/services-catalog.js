(function (root) {
  "use strict";
  const L = (zh, en) => ({ zh, en });
  const services = Object.freeze([
    {
      id: "cbam", code: "CBAM", href: "/apps/site/services/cbam/",
      name: L("欧盟碳边境调节", "EU CBAM"),
      desc: L(
        "面向对欧出口企业：从适用范围与 CN 编码确认，到工艺与前体梳理、嵌入排放核算、证据与进口商数据包交付，建立可核查、可更新的 CBAM 数据体系。",
        "For EU exporters: from scope and CN-code confirmation through process and precursor mapping, embedded-emissions calculation, evidence and importer packs—building a verifiable, updatable CBAM data system."
      ),
      who: L("向欧盟出口钢铁、铝、水泥、化肥、氢、电力等覆盖产品的生产企业及为其供货的关键前体供应商", "Producers exporting covered goods (steel, aluminium, cement, fertilisers, hydrogen, electricity, etc.) to the EU, and key precursor suppliers"),
      basis: "Regulation (EU) 2023/956",
      scenariosTitle: L("主要管理挑战", "Key management challenges"),
      scenarios: [
        [L("规则边界难一次定准", "Rules are hard to lock once"), L("CN 编码、适用工艺、前体与申报义务缠在一起，口径一偏，后面整季数据都要返工。", "CN codes, routes, precursors and filing duties tangle; one wrong boundary forces a full-quarter rework.")],
        [L("厂内与上游数据不齐", "Plant and precursor data gaps"), L("电、气、产量按车间汇总，焦炭/球团等声明缺失，进口商要的设施级字段对不上。", "Power, gas and output sit at shop totals; coke/pellet statements are missing; installation fields importers need do not map.")],
        [L("实际值与默认值难取舍", "Actual vs default unclear"), L("不知道何时可用实测、何时只能用默认值，也不知如何并排说明给进口商。", "Unclear when measured data applies versus defaults, and how to present both to the importer.")],
        [L("核查与交付难持续", "Verification hard to sustain"), L("季度窗口短，证据散落邮箱；下季又要从零拼。", "Quarterly windows are short; evidence lives in inboxes; next quarter starts from scratch.")],
      ],
      steps: [
        [L("锁定范围与编码", "Lock scope & codes"), L("产品、产线配置、设施边界与 CN 编码写死，避免中途改口径", "Freeze products, line configs, installation boundaries and CN codes")],
        [L("梳理工艺与前体", "Map process & precursors"), L("生产流程、能源点与前体材料、可接受证明形式一次列清", "List process, energy points, precursors and acceptable evidence")],
        [L("对齐计量与台账", "Align meters & ledgers"), L("产量、燃料、外购电按月重切到产品/设施", "Re-cut monthly output, fuels and purchased power to product/installation")],
        [L("核算与对照", "Calculate & compare"), L("实际值与默认值并排，标缺口与假设", "Run actual vs default side by side; flag gaps and assumptions")],
        [L("证据与进口商包", "Evidence & importer pack"), L("设施说明、数据表与可复用填报模板一并交付", "Deliver installation note, tables and a reusable filing template")],
        [L("季度复用", "Quarterly reuse"), L("固化采集口径，支撑下一窗口快速更新", "Lock collection rules so the next window updates fast")],
      ],
      prepare: [
        L("出口产品清单与 CN 编码（或海关归类依据）", "Export product list and CN codes (or classification basis)"),
        L("厂区/设施示意与主要产线配置", "Site/installation sketch and main line configs"),
        L("近月产量、燃料、外购电热台账", "Recent output, fuel and purchased power/heat ledgers"),
        L("前体采购与供应商声明（如有）", "Precursor purchases and supplier statements if any"),
        L("进口商或客户已发的填报模板", "Any importer or customer filing templates already received"),
      ],
      standards: ["EU CBAM 2023/956", "Implementing acts (as applicable)", "Default / actual value rules"],
      deliv: [
        L("进口商季度 / 年度数据包", "Importer quarterly / annual data pack"),
        L("设施嵌入排放说明", "Installation embedded-emissions note"),
        L("前体缺口与证明形式表", "Precursor gap and evidence-format table"),
        L("下一窗口可复用填报模板", "Reusable template for the next window"),
      ],
      boundaries: [
        L("本服务交付核算与证据整理，不替代欧盟侧进口商的法定申报义务。", "We deliver calculation and evidence organisation; we do not replace the importer’s statutory filing duty."),
        L("免费配额、原产国碳价抵扣等完整情形需按当期规则与项目约定单独确认。", "Free allocation and origin carbon-price offsets need separate confirmation under current rules and the engagement."),
      ],
      consultAsk: [
        L("主要出口产品与目标进口国", "Main export products and destination markets"),
        L("是否已收到进口商数据模板或时限", "Whether an importer template or deadline already exists"),
        L("厂区数量与是否有关键前体外购", "Number of sites and key purchased precursors"),
      ],
    },
    {
      id: "pcf", code: "PCF", href: "/apps/site/services/pcf/",
      name: L("产品碳足迹", "Product carbon footprint"),
      desc: L(
        "基于生命周期评价思路，锁定功能单位与系统边界，归集原料、能源与运输等活动数据，匹配因子并核算，形成专业、可复核、可追溯的产品碳足迹成果，支撑客户要求、市场准入与低碳改进。",
        "Using an LCA approach: lock functional unit and boundary, collect materials, energy and transport data, match factors and calculate—delivering a professional, reviewable, traceable footprint for customer asks, market access and abatement."
      ),
      who: L("收到品牌、OEM 或采购方碳足迹 / ISO 14067 模板的供应商，以及需要产品级碳数据做绿色采购或准入的制造企业", "Suppliers asked to fill brand, OEM or ISO 14067 templates, and manufacturers needing product-level carbon data for green procurement or market access"),
      basis: "ISO 14067 · PAS 2050 · ISO 14040/14044",
      scenariosTitle: L("主要应用场景", "Typical use cases"),
      scenarios: [
        [L("客户与供应链要求", "Customer & supply-chain asks"), L("品牌或链主要求按指定模板核算、报送并可验证的产品碳数据。", "Brands or chain leaders require footprint data on a set template, reportable and verifiable.")],
        [L("市场准入与绿色贸易", "Market access & green trade"), L("目标市场强化产品碳信息时，先建立符合适用规则的产品碳基础数据。", "When target markets tighten product-carbon asks, build a rule-aligned product carbon base.")],
        [L("绿色采购与产品评价", "Green procurement"), L("为采购评分、低碳产品认定提供可核验依据。", "Provide verifiable data for procurement scores and low-carbon product claims.")],
        [L("低碳设计与热点改进", "Low-carbon design"), L("识别原料、工序、运输热点，支撑材料替代与工艺优化。", "Spot material, process and transport hotspots to guide substitution and process change.")],
      ],
      steps: [
        [L("对齐模板与边界", "Align template & boundary"), L("功能单位、截断规则、生命周期阶段与报告字段先与客户确认", "Confirm functional unit, cut-offs, life-cycle stages and report fields with the customer")],
        [L("活动数据采集", "Collect activity data"), L("原料、能源、外发加工、包装与运输清单", "Materials, energy, subcontract, packaging and transport")],
        [L("因子匹配与核算", "Factors & calculation"), L("因子版本锁定、共产品分配与贡献排序", "Lock factor versions, co-product allocation and contribution ranking")],
        [L("校验与热点", "Check & hotspots"), L("结果核验，标出可谈判的工序热点", "Validate results and mark actionable process hotspots")],
        [L("报告与复用表", "Report & reuse sheet"), L("复核后的报告，以及下一批款号可复用的采集表", "Reviewed report plus a collection sheet for the next SKUs")],
      ],
      prepare: [
        L("目标产品/款号与客户模板（如有）", "Target products/SKUs and customer template if any"),
        L("物料清单（BOM）与主要供应商", "BOM and key suppliers"),
        L("工序能耗、蒸汽、外发加工说明", "Process energy, steam and subcontract notes"),
        L("包装与主要运输方式", "Packaging and main transport modes"),
        L("已有检测、声明或既往碳足迹报告", "Existing tests, claims or prior footprint reports"),
      ],
      standards: ["ISO 14067", "ISO 14040 / 14044", "PAS 2050", "GHG Protocol Product Standard", "PEF (where required)"],
      deliv: [
        L("产品碳足迹报告", "Product carbon footprint report"),
        L("排放热点与贡献分析", "Hotspot and contribution analysis"),
        L("供应商 / 款号采集模板", "Supplier / SKU collection template"),
        L("边界与假设版本说明", "Boundary and assumption version note"),
      ],
      boundaries: [
        L("第三方核查或认证需另约范围；本服务默认交付可送审的核算与报告材料。", "Third-party verification or certification is scoped separately; default delivery is calculation and report materials ready for review."),
        L("客户指定因子库或软件格式时，以书面确认的模板为准。", "Where the customer mandates a factor set or software format, the confirmed template prevails."),
      ],
      consultAsk: [
        L("产品名称、功能单位与客户模板", "Product name, functional unit and customer template"),
        L("系统边界要求（摇篮到大门 / 其他）", "Boundary ask (cradle-to-gate or other)"),
        L("款号数量与是否含外发染整等工序", "Number of SKUs and whether subcontract dyeing etc. is in scope"),
      ],
    },
    {
      id: "esg", code: "ESG", href: "/apps/site/services/esg/",
      name: L("ESG 报告", "ESG reporting"),
      desc: L(
        "围绕适用框架识别、重要议题、指标体系、数据与证据管理、报告编制与内部审阅，帮助企业形成规范、可信、可追溯的披露成果，并沉淀可复用的 ESG 数据基础。",
        "From framework selection and material topics through metrics, evidence, drafting and internal review—building a credible, traceable disclosure and a reusable ESG data base."
      ),
      who: L("首次或定期编制 ESG / 可持续报告，或需要回应供应链审核、评级问卷的企业", "Companies writing a first or annual ESG report, or answering supply-chain audits and rating surveys"),
      basis: "GRI · ISSB / IFRS S1–S2 · ESRS · 交易所相关指引（按适用）",
      scenariosTitle: L("ESG 三大维度（披露视角）", "E · S · G (disclosure lens)"),
      scenarios: [
        [L("环境 E", "Environmental"), L("气候、能源资源、污染物与废弃物等绩效及绿色转型实践。", "Climate, energy and resources, pollutants and waste, and green-transition practice.")],
        [L("社会 S", "Social"), L("员工权益、职业健康安全、产品与供应链责任、社区等。", "Labour, H&S, product and supply-chain responsibility, community.")],
        [L("治理 G", "Governance"), L("治理架构、商业道德、风险内控、合规与信息安全等。", "Governance structure, ethics, risk and controls, compliance and information security.")],
        [L("证据与数据资产", "Evidence & data assets"), L("议题—指标—证据挂责任人，避免每年从邮件和扫描件重拼。", "Topic–metric–evidence with owners—so you are not rebuilding from mail and scans each year.")],
      ],
      steps: [
        [L("明确披露要求与边界", "Requirements & boundary"), L("客户、融资方或交易所要求对照，确定报告边界", "Map customer, lender or exchange asks; set report boundary")],
        [L("重要议题筛选", "Materiality"), L("圈定真正要披露的议题，去掉无效字段", "Select topics that matter; drop noise fields")],
        [L("指标与责任分工", "Metrics & owners"), L("定义、期间、数据责任人写清", "Define each metric, period and data owner")],
        [L("采集并核验证据", "Collect & check evidence"), L("证书、许可、盘查结果挂进同一索引", "Index certificates, permits and inventory results")],
        [L("编制与内部审阅", "Draft & review"), L("成稿、内部审议与对外版本锁定", "Draft, internal review and lock the external version")],
        [L("披露与改进", "Disclose & improve"), L("发布后沉淀复用口径，准备下一周期", "After release, keep reusable definitions for the next cycle")],
      ],
      prepare: [
        L("目标框架或客户 / 评级问卷", "Target framework or customer / rating questionnaire"),
        L("上一年报告或已有指标表（如有）", "Prior report or metrics table if any"),
        L("组织架构与主要制度清单", "Org chart and key policy list"),
        L("环境、安全、劳工相关证书与许可", "EHS and labour certificates and permits"),
        L("已有温室气体盘查或产品碳结果（如有）", "Existing GHG inventory or product footprints if any"),
      ],
      standards: ["GRI", "ISSB / IFRS S1–S2", "ESRS (where applicable)", "SASB (sector topics)", "CDP / EcoVadis surveys (as required)"],
      deliv: [
        L("ESG / 可持续报告", "ESG / sustainability report"),
        L("议题—指标对照表", "Topic–metric map"),
        L("证据目录与责任人表", "Evidence index with owners"),
        L("下一年可复用口径说明", "Reusable definitions for next year"),
      ],
      boundaries: [
        L("评级平台代填或鉴证服务需单独约定。", "Rating-platform filing or assurance is scoped separately."),
        L("框架冲突时以书面确认的优先适用顺序为准。", "When frameworks conflict, the confirmed priority order applies."),
      ],
      consultAsk: [
        L("披露对象（客户 / 融资 / 交易所）", "Audience (customer / financing / exchange)"),
        L("是否已有指定框架或问卷", "Whether a framework or questionnaire is already set"),
        L("希望覆盖的厂区或法人范围", "Sites or legal entities to cover"),
      ],
    },
    {
      id: "inventory", code: "GHG", href: "/apps/site/services/ghg-inventory/",
      name: L("碳盘查", "GHG inventory"),
      desc: L(
        "系统确认组织边界与排放源，归集 Scope 1 / 2 及必要的 Scope 3，量化并校验后形成完整、可信、可追溯的组织碳排放底账，支撑披露、客户问卷、减排目标与产品核算共用。",
        "Confirm organisational boundaries and sources, collect Scope 1/2 and Scope 3 where needed, quantify and check—producing a complete, credible, traceable inventory base for disclosure, surveys, targets and product work."
      ),
      who: L("需要集团或厂区层面排放底数，并希望一次整理、多年复用的企业", "Companies that need a group- or site-level emissions base and want one inventory reused for years"),
      basis: "GHG Protocol · ISO 14064-1",
      scenariosTitle: L("主要应用场景", "Typical use cases"),
      scenarios: [
        [L("建立碳排放底账", "Build the emissions base"), L("摸清规模、结构与主要来源，作为后续碳管理统一基线。", "See scale, structure and main sources as the shared baseline for carbon management.")],
        [L("ESG 与气候披露", "ESG & climate disclosure"), L("为报告与 CDP 等问卷提供规范、可追溯的温室气体数据。", "Supply consistent, traceable GHG data for reports and CDP-style surveys.")],
        [L("客户与供应链要求", "Customer & supply-chain asks"), L("回应品牌对组织碳排放与减排表现的调查与验证。", "Answer brand surveys on organisational emissions and abatement.")],
        [L("减排目标与转型", "Targets & transition"), L("识别重点源与基线，支撑科学碳目标或碳中和路径讨论。", "Identify key sources and baseline for science-based or net-zero pathway talks.")],
      ],
      steps: [
        [L("界定组织与运营边界", "Set boundaries"), L("核算主体、厂区与运营控制范围写清", "Define entity, sites and operational control")],
        [L("识别排放源", "Identify sources"), L("燃料、外购电热、工艺、逸散等分类建档", "Catalogue fuels, purchased power/heat, process and fugitive sources")],
        [L("归集活动数据", "Collect activity data"), L("按同一分类核对台账与缺口", "Reconcile ledgers under one classification; flag gaps")],
        [L("量化与校验", "Quantify & check"), L("因子版本锁定，缺失数据规则写明", "Lock factor versions and missing-data rules")],
        [L("盘查报告", "Inventory report"), L("排放清单、源清单与可改进项", "Inventory, source register and improvement options")],
        [L("审查与持续监测", "Review & monitor"), L("内部审阅；外部核查另约；固化年度更新口径", "Internal review; external verification scoped separately; lock annual update rules")],
      ],
      prepare: [
        L("组织架构与纳入盘查的法人 / 厂区列表", "Org chart and entities/sites in scope"),
        L("燃料、外购电热、制冷剂等台账", "Fuel, purchased power/heat and refrigerant ledgers"),
        L("工艺说明与主要排放设施清单", "Process notes and main emitting assets"),
        L("基准年诉求（如有）", "Base-year preference if any"),
        L("既往盘查或能源审计报告（如有）", "Prior inventory or energy audit if any"),
      ],
      standards: ["GHG Protocol Corporate Standard", "ISO 14064-1", "Scope 3 Standard (where included)", "ISO 14064-3 (verification, if scoped)"],
      deliv: [
        L("组织温室气体盘查报告", "Organisational GHG inventory report"),
        L("排放源清单", "Emissions source register"),
        L("口径、因子与版本说明", "Definitions, factors and version note"),
        L("年度更新采集表", "Annual update collection sheet"),
      ],
      boundaries: [
        L("Scope 3 类别默认按重要性纳入，完整十五类需书面确认。", "Scope 3 categories are included by materiality unless all fifteen are confirmed in writing."),
        L("外部核查 / 鉴证不在默认交付内。", "External verification / assurance is not in the default delivery."),
      ],
      consultAsk: [
        L("纳入范围的厂区或法人", "Sites or legal entities in scope"),
        L("是否需要 Scope 3 及优先类别", "Whether Scope 3 is needed and which categories first"),
        L("用途（披露 / 客户问卷 / 目标设定）", "Use (disclosure / customer survey / target setting)"),
      ],
    },
    {
      id: "assets", code: "EAC", href: "/apps/site/services/carbon-assets/",
      name: L("碳资产与绿证", "Carbon assets & EACs"),
      desc: L(
        "按用电曲线与客户可接受的证明形式，测算自建、直购与绿证组合，整理采购、注销与声明边界，形成可向客户出示的可再生电力证据包。",
        "Against your load curve and accepted claim formats, size on-site, direct-purchase and certificate mixes, then organise procurement, retirement and claim boundaries into an evidence pack customers can accept."
      ),
      who: L("需要向客户证明可再生电力使用，或规划厂区绿电路径的出口与制造企业", "Exporters and manufacturers that must prove renewable power use or plan a site renewable pathway"),
      basis: "I-REC · GEC · 客户声明规则（按适用）",
      scenariosTitle: L("主要应用场景", "Typical use cases"),
      scenarios: [
        [L("客户可再生电力声明", "Customer renewable claims"), L("采购方要求厂区或产品层面的绿电占比证明。", "Buyers ask for site- or product-level renewable share proof.")],
        [L("绿证采购与注销", "Certificates & retirement"), L("明确买多少、在哪注销、声明口径如何写。", "Decide volume, where to retire and how claims may be worded.")],
        [L("自建 / 直购与绿证组合", "On-site / PPA + certificates"), L("按负荷曲线粗看路径与成本区间，再落地采购。", "Size pathway and cost bands against the load curve, then procure.")],
        [L("与产品碳 / CBAM 口径衔接", "Link to PCF / CBAM"), L("避免厂区声明与产品核算各说各话。", "Keep site claims aligned with product and CBAM accounting.")],
      ],
      steps: [
        [L("需求与证明形式", "Needs & evidence formats"), L("年用电、峰值与客户可接受凭证类型", "Annual use, peaks and accepted evidence types")],
        [L("路径组合测算", "Pathway mix"), L("自建、直购电与绿证的量级与成本区间", "On-site, PPA and certificate volumes with cost bands")],
        [L("采购与注销台账", "Source & retire"), L("执行采购并建立注销记录", "Procure and keep a retirement ledger")],
        [L("声明边界说明", "Claim boundary"), L("厂区占比与产品可用声明分别写清", "Separate what may be claimed at site vs product level")],
        [L("证据包交付", "Evidence pack"), L("注销凭证与声明材料一并归档", "Archive retirement proofs with claim materials")],
      ],
      prepare: [
        L("年用电量与尽量完整的负荷曲线", "Annual electricity use and load curve if available"),
        L("现有屋顶光伏 / 直购电合同（如有）", "Existing rooftop PV or PPA contracts if any"),
        L("客户对绿电 / 绿证的书面要求", "Written customer requirements on renewables / EACs"),
        L("目标可再生占比或年份", "Target renewable share or year"),
      ],
      standards: ["I-REC", "GEC", "Customer claim rules", "Relevant market attribute schemes"],
      deliv: [
        L("绿电路径与采购方案", "Renewable pathway and sourcing plan"),
        L("注销台账与凭证索引", "Retirement ledger and proof index"),
        L("声明边界与话术说明", "Claim boundary and wording note"),
      ],
      boundaries: [
        L("绿证交易执行与资金结算可由客户自行或指定券商完成；我们聚焦核算、路径与证据。", "Certificate trading and settlement may be done by you or a broker; we focus on sizing, pathway and evidence."),
        L("产品碳足迹中的电力因子替换需与 PCF / CBAM 项目口径一并确认。", "Replacing electricity factors inside a PCF must align with PCF / CBAM engagement rules."),
      ],
      consultAsk: [
        L("年用电与目标可再生占比", "Annual use and target renewable share"),
        L("客户接受的证明形式（绿证类型等）", "Accepted evidence formats (certificate types etc.)"),
        L("是否已有自建或直购电", "Whether on-site or direct-purchase power already exists"),
      ],
    },
    {
      id: "export", code: "TRADE", href: "/apps/site/services/export-compliance/",
      name: L("出口合规服务", "Export compliance"),
      desc: L(
        "按目标市场整理材料、标识、文件与碳相关要求，对照现有检测与声明标出差距，再补测、改结构或改声明路径，交付可跟进的文件包——碳与产品合规放在同一张作战图上。",
        "Map material, labelling, document and carbon-related duties by market, mark gaps against current tests and claims, then retest, redesign or change the claim path—putting carbon and product compliance on one map."
      ),
      who: L("进入新市场，或同时面对包装、产品安全与碳相关出口要求的制造企业", "Manufacturers entering new markets or facing packaging, product-safety and carbon export duties together"),
      basis: L("按目标市场法规与客户规范", "By target-market rules and customer specs"),
      scenariosTitle: L("主要应用场景", "Typical use cases"),
      scenarios: [
        [L("新市场准入", "New market entry"), L("一次性摸清目标国对材料、标识与文件的硬性要求。", "Map hard requirements on materials, labelling and documents for the target country.")],
        [L("包装与产品法规叠加", "Packaging + product rules"), L("PPWR 类包装要求与产品安全、碳信息同时出现时，避免多头应对。", "When packaging rules (e.g. PPWR-style), product safety and carbon info arrive together, avoid siloed responses.")],
        [L("碳相关出口义务", "Carbon-related export duties"), L("CBAM、产品碳信息与客户问卷和检测证书排在同一差距表里。", "Put CBAM, product-carbon asks and customer surveys on one gap list with test certificates.")],
        [L("供应链文件包", "Supply-chain document pack"), L("给进口商或品牌一份可跟进的证书与声明清单。", "Give importers or brands a followable certificate and claim checklist.")],
      ],
      steps: [
        [L("市场与客户矩阵", "Market & customer matrix"), L("目标国 / 客户要求对照表", "Target-country / customer requirement map")],
        [L("差距排序", "Rank gaps"), L("证书、检测、标识与声明缺口按紧急度排序", "Rank certificate, test, labelling and claim gaps by urgency")],
        [L("补齐路径", "Close gaps"), L("补测、改结构、改包装或改声明", "Retest, redesign, rework packaging or change claims")],
        [L("文件包与跟进", "Pack & follow-up"), L("交付文件包与责任人跟进清单", "Deliver document pack and owner follow-up list")],
        [L("与碳服务衔接", "Link carbon services"), L("需要 CBAM / PCF / ESG 时转入对应服务，共用已收集资料", "Hand off to CBAM / PCF / ESG when needed, reusing collected files")],
      ],
      prepare: [
        L("目标市场与主要客户名单", "Target markets and key customers"),
        L("现有检测报告、证书与标签样张", "Existing test reports, certificates and label samples"),
        L("产品材质与包装结构说明", "Material and packaging structure notes"),
        L("已收到的客户合规问卷或合同条款", "Customer compliance questionnaires or contract clauses already received"),
      ],
      standards: [L("按目标市场（如欧盟产品/包装相关法规）", "By target market (e.g. EU product/packaging rules)"), L("客户规范与合同附件", "Customer specs and contract annexes")],
      deliv: [
        L("要求与差距清单", "Requirements and gap checklist"),
        L("补齐行动计划", "Close-the-gap action plan"),
        L("出口合规文件包", "Export compliance document pack"),
      ],
      boundaries: [
        L("检测机构送检与出证费用通常由客户或指定实验室结算。", "Lab testing and certificate fees are usually settled by you or the nominated lab."),
        L("法律意见书或诉讼支持不在本服务默认范围。", "Legal opinions or litigation support are outside the default scope."),
      ],
      consultAsk: [
        L("目标市场与产品类别", "Target markets and product categories"),
        L("最紧急的客户或监管时限", "Most urgent customer or regulatory deadline"),
        L("是否已并行需要 CBAM 或产品碳足迹", "Whether CBAM or PCF is needed in parallel"),
      ],
    },
  ]);

  root.LuminoServicesCatalog = services;
  root.LuminoServiceById = Object.fromEntries(services.map((s) => [s.id, s]));
  root.LuminoServiceByCode = Object.fromEntries(services.map((s) => [s.code, s]));
})(typeof window !== "undefined" ? window : globalThis);
