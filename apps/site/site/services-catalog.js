(function (root) {
  "use strict";
  const L = (zh, en) => ({ zh, en });
  const services = Object.freeze([
    {
      id: "cbam", code: "CBAM", href: "/apps/site/services/cbam/",
      name: L("欧盟碳边境调节", "EU CBAM"),
      desc: L("按设施与产品整理嵌入排放，形成进口商可直接使用的季度 / 年度数据包，并准备核查所需的证据链。", "Organise installation- and product-level embedded emissions into packs importers can file, with an evidence trail for verification."),
      who: L("向欧盟出口钢铁、铝、水泥、化肥、氢、电力等覆盖产品的生产企业", "Producers exporting covered goods (steel, aluminium, cement, fertilisers, hydrogen, electricity, etc.) to the EU"),
      basis: "Regulation (EU) 2023/956",
      steps: [
        [L("锁定范围", "Lock scope"), L("产品 CN 编码、生产配置与设施边界写死，避免中途改口径", "Freeze CN codes, production configs and installation boundaries")],
        [L("对齐计量与前体", "Meters & precursors"), L("产量、燃料、外购电与前体声明按月对齐", "Align monthly output, fuels, purchased power and precursor statements")],
        [L("核算与对照", "Calculate & compare"), L("实际值与默认值并排，标出缺口与假设", "Run actual vs default side by side; flag gaps and assumptions")],
        [L("交付与复用", "Deliver & reuse"), L("进口商数据包、设施说明与下一周期模板", "Importer pack, installation note and next-period template")],
      ],
      deliv: [L("进口商数据包", "Importer data package"), L("设施排放说明", "Installation emissions note"), L("核查支持材料", "Verification support pack")],
    },
    {
      id: "pcf", code: "PCF", href: "/apps/site/services/pcf/",
      name: L("产品碳足迹", "Product carbon footprint"),
      desc: L("按客户指定的功能单位与系统边界，核算摇篮到大门结果，并给出可谈判的工序热点。", "Cradle-to-gate results to the buyer’s unit and boundary, with process hotspots you can act on."),
      who: L("收到品牌、OEM 或采购方碳足迹模板的供应商", "Suppliers asked to fill brand, OEM or procurement footprint templates"),
      basis: "ISO 14067 · PAS 2050",
      steps: [
        [L("对齐模板", "Align template"), L("功能单位、截断规则与报告字段先与客户确认", "Confirm functional unit, cut-offs and report fields with the customer")],
        [L("采集清单", "Collect inventory"), L("原料、能源、外发加工与运输活动数据", "Materials, energy, subcontract and transport data")],
        [L("核算与热点", "Calculate & hotspots"), L("因子匹配、共产品分配与贡献排序", "Factor matching, co-product allocation and contribution ranking")],
        [L("报告与模板", "Report & template"), L("复核后的报告，以及可给下一批款号复用的采集表", "Reviewed report plus a collection sheet reusable for the next SKUs")],
      ],
      deliv: [L("碳足迹报告", "Footprint report"), L("排放热点分析", "Hotspot analysis"), L("供应商数据模板", "Supplier data template")],
    },
    {
      id: "esg", code: "ESG", href: "/apps/site/services/esg/",
      name: L("ESG 报告", "ESG reporting"),
      desc: L("把客户或融资框架拆成议题、指标与证据责任人，编成可版本化的报告，而不是每年从零拼附件。", "Turn customer or financing frameworks into topics, metrics and evidence owners—so you are not rebuilding attachments every year."),
      who: L("首次或定期编制 ESG / 可持续报告，或需要回应供应链审核的企业", "Companies writing a first or annual ESG report, or answering supply-chain audits"),
      basis: "GRI · ISSB · ESRS",
      steps: [
        [L("议题筛选", "Materiality"), L("对照框架与客户问卷，圈定真正要披露的议题", "Map frameworks and customer surveys to the topics that matter")],
        [L("指标与口径", "Metrics"), L("为每项指标写清定义、期间与数据责任人", "Define each metric, period and data owner")],
        [L("证据架", "Evidence shelf"), L("证书、许可、盘查结果挂进同一索引", "Index certificates, permits and inventory results together")],
        [L("成稿与审阅", "Draft & review"), L("撰写、内部审阅与对外版本锁定", "Draft, internal review and lock the external version")],
      ],
      deliv: [L("ESG 报告", "ESG report"), L("指标表", "Metrics table"), L("证据目录", "Evidence index")],
    },
    {
      id: "inventory", code: "GHG", href: "/apps/site/services/ghg-inventory/",
      name: L("碳盘查", "GHG inventory"),
      desc: L("统一组织与运营边界，按范围一、二（必要时三）建立可年度复用的排放底数，供披露、客户问卷与产品核算共用。", "Align organisational and operational boundaries into a reusable Scope 1–2 (and Scope 3 where needed) base for disclosure, surveys and product work."),
      who: L("需要集团或厂区层面排放数据，并希望一次整理、多年复用的企业", "Companies that need group- or site-level emissions and want one base reused for years"),
      basis: "GHG Protocol · ISO 14064-1",
      steps: [
        [L("边界与清单", "Boundaries"), L("组织、厂区与运营边界，列出排放源", "Set organisation, site and operational boundaries; list sources")],
        [L("活动数据", "Activity data"), L("燃料、外购电热、工艺与逸散按同一分类核对", "Reconcile fuels, purchased power/heat, process and fugitive data")],
        [L("核算", "Calculate"), L("因子版本锁定，缺失数据规则写清", "Lock factor versions and missing-data rules")],
        [L("报告", "Report"), L("盘查报告、源清单与可改进项", "Inventory report, source register and improvement options")],
      ],
      deliv: [L("盘查报告", "Inventory report"), L("排放源清单", "Emissions source register"), L("口径与版本说明", "Definition and version note")],
    },
    {
      id: "assets", code: "EAC", href: "/apps/site/services/carbon-assets/",
      name: L("碳资产与绿证", "Carbon assets & EACs"),
      desc: L("按用电曲线与客户声明要求，测算自建、直购与绿证组合，并整理可注销、可声明的证据。", "Size on-site, direct-purchase and certificate mixes against your load curve and claim rules, with retirement-ready evidence."),
      who: L("需要向客户证明可再生电力使用，或规划厂区绿电路径的企业", "Companies that must prove renewable power use or plan a site renewable pathway"),
      basis: "I-REC · GEC",
      steps: [
        [L("需求", "Needs"), L("年用电、峰值曲线与客户可接受的证明形式", "Annual use, peak curve and accepted evidence formats")],
        [L("路径组合", "Pathway mix"), L("自建、直购电与绿证的量级与成本区间", "On-site, PPA and certificate volumes with cost bands")],
        [L("采购与注销", "Source & retire"), L("采购执行与注销台账", "Procurement and retirement ledger")],
        [L("声明材料", "Claims"), L("厂区占比或产品可用声明的边界说明", "What may be claimed at site vs product level")],
      ],
      deliv: [L("采购方案", "Sourcing plan"), L("注销凭证", "Retirement records"), L("声明材料", "Claim documentation")],
    },
    {
      id: "export", code: "TRADE", href: "/apps/site/services/export-compliance/",
      name: L("出口合规服务", "Export compliance"),
      desc: L("按目标市场列出材料、标识、文件与碳相关要求，标出与现有检测、声明的差距后再补齐。", "List material, labelling, document and carbon-related duties by market, mark gaps against current tests and claims, then close them."),
      who: L("进入新市场，或同时面对包装、产品与碳相关出口要求的制造企业", "Manufacturers entering new markets or facing packaging, product and carbon export duties together"),
      basis: L("按目标市场", "By target market"),
      steps: [
        [L("市场矩阵", "Market matrix"), L("目标国 / 客户要求对照表", "Target-country / customer requirement map")],
        [L("差距", "Gaps"), L("证书、检测与声明缺口排序", "Rank certificate, test and claim gaps")],
        [L("补齐", "Close gaps"), L("补测、改结构或改声明路径", "Retest, redesign or change the claim path")],
        [L("交付", "Deliver"), L("文件包与跟进清单", "Document pack and follow-up list")],
      ],
      deliv: [L("要求清单", "Requirements checklist"), L("差距分析", "Gap analysis"), L("文件包", "Document pack")],
    },
  ]);

  root.LuminoServicesCatalog = services;
  root.LuminoServiceById = Object.fromEntries(services.map((s) => [s.id, s]));
  root.LuminoServiceByCode = Object.fromEntries(services.map((s) => [s.code, s]));
})(typeof window !== "undefined" ? window : globalThis);
