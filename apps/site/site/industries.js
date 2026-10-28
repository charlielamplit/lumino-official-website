(function (root) {
  "use strict";
  const L = (zh, en) => ({ zh, en });
  const industries = Object.freeze([
    {
      id: "steel",
      name: L("钢铁", "Steel"),
      tagline: L("把车间计量与产品申报对齐，撑住季度窗口", "Align shop meters with product filings for tight quarterly windows"),
      background: L(
        "钢铁是 CBAM 覆盖的核心品类。热轧、冷轧与长材往往共用能源计量，但进口商与下游客户要的是设施与产品级数据；焦炭、球团、生铁等前体声明又分散在上游。我们从产线边界、CN 编码与前体缺口一起理顺，而不是只交一份总表。",
        "Steel sits at the centre of CBAM. Hot, cold and long mills often share meters, while importers and OEMs want installation- and product-level figures—and coke, pellet and pig-iron statements sit upstream. We start with line boundaries, CN codes and precursor gaps—not a plant total."
      ),
      challenge: L(
        "热轧、冷轧与长材产线的能源计量往往按车间汇总，进口商却要求按产品与设施拆分；焦炭、球团等前体声明分散在供应商手中，季度交付窗口又短。",
        "Energy meters often sit at shop-floor level, while importers want product- and installation-level splits. Precursor statements for coke and pellets sit with suppliers, and quarterly windows are tight."
      ),
      helps: [
        [L("按时交出进口商数据包", "Deliver importer packs on time"), L("按产线与 CN 编码整理嵌入排放，并排实际值与默认值", "Organise embedded emissions by line and CN code; run actual vs default")],
        [L("回应汽车 / 家电产品碳要求", "Answer OEM / appliance footprint asks"), L("钢卷、型材等主产品形成可复用的摇篮到大门结果", "Cradle-to-gate results for coil and sections that can be reused")],
        [L("建立可按工序复盘的底数", "Build a process-level baseline"), L("统一厂区口径，支撑后续季度与客户问卷", "Align site definitions for later quarters and customer surveys")],
        [L("补齐前体与证据链", "Close precursor and evidence gaps"), L("列出焦炭、球团等缺口与可接受的证明形式", "List coke/pellet gaps and acceptable evidence formats")],
      ],
      chain: [
        L("锁定产品—产线—CN 编码", "Lock product–line–CN links"),
        L("对齐计量点与前体", "Align meters and precursors"),
        L("核算与对照", "Calculate and compare"),
        L("交付数据包与下季模板", "Deliver pack and next-quarter template"),
      ],
      reqs: [
        [L("欧盟进口商申报", "EU importer filings"), L("设施边界、CN 编码、直接与间接排放口径需与当期规则一致", "Installation boundary, CN codes and direct/indirect scopes must match the current period")],
        [L("汽车 / 家电客户索取", "OEM / appliance requests"), L("钢卷、型材等主产品常被要求提供产品级碳数据", "Coil and sections are often asked for product-level carbon data")],
        [L("内部减排与对标", "Internal reduction & benchmarking"), L("需要可按工序复盘的热点，而不是一张总表", "Need process-level hotspots, not a single plant total")],
      ],
      packages: [
        {
          title: L("设施嵌入排放数据包", "Installation embedded-emissions pack"),
          tag: "CBAM",
          body: L("按高炉—转炉或电炉路线梳理计量点，整理产量、燃料、外购电与前体，形成可给进口商的季度 / 年度数据包。", "Map BOF or EAF routes and meters, organise output, fuels, purchased power and precursors into a quarterly/annual pack for importers."),
          bullets: [
            L("CN 编码与生产配置对照表", "CN code ↔ production configuration map"),
            L("前体（焦炭、球团、生铁等）缺口清单", "Precursor gap list (coke, pellets, pig iron…)"),
            L("实际值与默认值对照说明", "Actual vs default value note"),
          ],
        },
        {
          title: L("主产品碳足迹（钢卷 / 型材）", "Primary product footprints (coil / sections)"),
          tag: "PCF",
          body: L("以出厂吨产品为功能单位，划定摇篮到大门边界，把炼钢、轧制与外购坯料分摊清楚，回应下游采购问卷。", "Use per-tonne leaving the gate as the functional unit, set cradle-to-gate boundaries, and allocate melting, rolling and bought billets for buyer questionnaires."),
          bullets: [
            L("系统边界与共产品分配记录", "Boundary and co-product allocation record"),
            L("工序热点（烧结 / 高炉 / 轧钢）", "Process hotspots (sinter / BF / rolling)"),
            L("可复用的供应商活动数据模板", "Reusable supplier activity template"),
          ],
        },
        {
          title: L("全厂基准年盘查底座", "Site baseline inventory"),
          tag: "GHG",
          body: L("先统一组织与运营边界，把各厂区燃料、外购电、外购热核对到同一口径，作为后续 CBAM 与客户问卷的共同底数。", "Align organisational and operational boundaries first, then reconcile fuels, purchased power and heat across sites as a shared base for CBAM and customer surveys."),
          bullets: [
            L("排放源与责任人清单", "Source and owner register"),
            L("厂区数据口径差异说明", "Cross-site definition notes"),
            L("年度版本与更正规则", "Annual versioning and correction rules"),
          ],
        },
      ],
      prepare: [
        L("各产线产量与发运台账（按月）", "Monthly output and shipment ledgers by line"),
        L("燃料、蒸汽、外购电发票与计量点对照", "Fuel, steam and power invoices mapped to meters"),
        L("前体采购合同、成分或供应商声明", "Precursor contracts, assays or supplier statements"),
        L("现行出口产品清单与候选 CN 编码", "Current export list with candidate CN codes"),
      ],
    },
    {
      id: "aluminium",
      name: L("铝及铝制品", "Aluminium"),
      tagline: L("电耗、绿电与边界切分，决定申报与低碳铝门槛", "Power, renewables and boundary cuts decide filings and low-carbon thresholds"),
      background: L(
        "铝业排放高度依赖电力。原铝电解、铸造与后续挤压 / 轧制若不分开记账，加工厂容易被当成电解厂申报；绿电合同与产品声明的时段也常对不齐。我们把间接排放、前体铝液 / 铝锭与可再生证明一并说清，再进入申报与低碳沟通。",
        "Aluminium is power-heavy. If primary smelting, casting and later extrusion/rolling are not booked separately, fabricators get filed as smelters; green-power contracts often misalign with product claim periods. We clarify indirect emissions, liquid/ingot precursors and renewable proof together before filings and low-carbon talks."
      ),
      challenge: L("电解电耗决定排放量级；电网因子、绿电合同与铝液 / 铝锭 / 型材的边界切分，会同时影响进口商申报和下游「低碳铝」采购门槛。", "Smelting power dominates the footprint. Grid factors, green-power contracts and where you cut liquid metal, ingot and extrusion change both importer filings and low-carbon aluminium thresholds."),
      helps: [
        [L("分清电解与加工的申报边界", "Split smelting vs fabrication filings"), L("避免把挤压 / 轧制厂按电解厂口径报送", "Keep extrusion/rolling plants from being filed as smelters")],
        [L("支撑低碳铝 / 再生铝沟通", "Support low-carbon / recycled talks"), L("按合金与路线给出可说明的强度与热点", "Intensity and hotspots by alloy and route")],
        [L("绿电声明可对上生产期间", "Align renewable claims with production"), L("用电曲线、凭证有效期与可声明量对齐", "Match load curves, certificate validity and claimable volume")],
        [L("间接排放因子可追溯", "Traceable indirect-emission factors"), L("电网或直购电来源与版本写进证据", "Cite grid or direct-purchase sources and versions")],
      ],
      chain: [
        L("分线路界定电解与加工", "Separate smelting and fabrication"),
        L("登记外购铝液 / 铝锭", "Register bought liquid / ingot"),
        L("核算电力与阳极热点", "Calculate power and anode hotspots"),
        L("匹配绿电 / 绿证声明", "Match green-power / EAC claims"),
      ],
      reqs: [
        [L("含间接排放的进口申报", "Importer filings with indirect emissions"), L("电力来源与因子版本必须可追溯", "Power mix and factor versions must be traceable")],
        [L("低碳铝 / 再生铝证明", "Low-carbon / recycled aluminium claims"), L("客户用碳强度阈值筛选供应商", "Buyers screen suppliers with intensity thresholds")],
        [L("绿电与绿证匹配", "Renewable power matching"), L("声明时段需与生产期间对齐", "Claim periods must align with production periods")],
      ],
      packages: [
        {
          title: L("电解与加工分段排放整理", "Smelting vs fabrication split"),
          tag: "CBAM",
          body: L("把原铝电解、铸造与后续挤压 / 轧制分开记账，写清外购铝液或铝锭的前体路径，避免把加工厂当成电解厂申报。", "Book primary smelting, casting and later extrusion/rolling separately, and document bought liquid metal or ingot pathways so fabricators are not filed as smelters."),
          bullets: [
            L("电解槽系列与铸造炉边界图", "Potline and casting-furnace boundary map"),
            L("外购铝液 / 铝锭前体表", "Bought liquid / ingot precursor table"),
            L("间接排放电力因子引用", "Indirect-emission power factor citation"),
          ],
        },
        {
          title: L("铝锭 / 型材产品碳足迹", "Ingot & extrusion footprints"),
          tag: "PCF",
          body: L("按客户指定合金与表面处理路径核算，突出电力与阳极消耗热点，支持「低碳牌号」沟通。", "Calculate by the alloy and finishing route the customer names, highlight power and anode hotspots, and support low-carbon grade discussions."),
          bullets: [
            L("合金—工艺路线矩阵", "Alloy–process route matrix"),
            L("电力与阳极消耗分摊", "Power and anode allocation"),
            L("再生料掺入比例记录", "Scrap blend ratio record"),
          ],
        },
        {
          title: L("绿电合同与声明材料", "Green-power contracts and claims"),
          tag: "EAC",
          body: L("对照用电曲线与生产期间，整理绿电 / 绿证持有、注销与可用于产品声明的部分，避免时段错配。", "Match load curves to production periods, organise green-power/EAC holdings and retirements, and isolate what may be claimed on products."),
          bullets: [
            L("用电期间与凭证有效期对照", "Consumption vs certificate validity check"),
            L("可声明量测算", "Claimable volume estimate"),
            L("客户可接受的证明形式清单", "Accepted evidence formats list"),
          ],
        },
      ],
      prepare: [
        L("电解与加工分线路的电度与产量", "kWh and output by smelting vs fabrication line"),
        L("电网因子或直购电合同文本", "Grid factors or PPA / direct-purchase contracts"),
        L("阳极、氟化盐等主要辅料台账", "Anode and bath-material ledgers"),
        L("再生铝来源与掺入比例记录", "Scrap sources and blend ratios"),
      ],
    },
    {
      id: "textile",
      name: L("纺织服装", "Textiles & apparel"),
      tagline: L("从面料到成衣，把品牌模板跑通并留下可复用边界", "Run brand templates from fabric to garment—and keep a reusable boundary"),
      background: L(
        "品牌把碳足迹与 ESG 问卷压到纱线、染整与成衣工厂。功能单位（每米 / 每件）、染化料与蒸汽分摊、外发加工是否入界，会直接决定数字能不能对上。我们先锁边界与采集模板，再做热点分析与年度证据架，把供应链碳环节一次打通。",
        "Brands push footprints and ESG surveys onto yarn, dye and CMT mills. Functional unit (per metre / piece), dyestuff and steam allocation, and whether subcontractors are in-scope decide whether numbers reconcile. We lock the boundary and templates first, then hotspots and an annual evidence shelf—linking carbon along the supply chain in one pass."
      ),
      challenge: L("纱线、染整、成衣往往跨多家工厂；品牌要的是面料或成衣级结果，但染化料、蒸汽与外发加工数据分散，分配规则一变结果就变。", "Yarn, dyeing and cut-make often span many mills. Brands want fabric or garment results, while dyes, steam and subcontract data are scattered—and allocation rules change the number."),
      helps: [
        [L("按品牌模板交付碳足迹", "Deliver footprints on the brand template"), L("功能单位、截断与字段先与客户对齐", "Align unit, cut-offs and fields with the brand first")],
        [L("标出染整与蒸汽热点", "Mark dyeing and steam hotspots"), L("给采购与工厂同一套可谈判语言", "One language for merchandising and mills")],
        [L("年度 ESG / Higg 类问卷可复用", "Reuse ESG / Higg-style surveys"), L("议题—指标—证据挂责任人，避免每年重拼", "Topic–metric–evidence with owners—no yearly rebuild")],
        [L("外发染厂数据可回传", "Get dye-house data back"), L("发放统一采集表，列出缺口", "One collection sheet and a gap list")],
      ],
      chain: [
        L("与品牌锁定边界与单位", "Lock boundary and unit with brand"),
        L("向染厂 / 织厂发放模板", "Send templates to dye/weave houses"),
        L("核算并解读热点", "Calculate and read hotspots"),
        L("沉淀证据架与下季版本", "Shelf evidence and next-season version"),
      ],
      reqs: [
        [L("品牌供应商碳足迹", "Brand supplier footprints"), L("常指定 ISO 14067 与固定功能单位（如每米 / 每件）", "Often specify ISO 14067 and a fixed unit (per metre / per piece)")],
        [L("年度 ESG / Higg 类问卷", "Annual ESG / Higg-style surveys"), L("需要可追溯的证据目录，而不是一次性填空", "Need a lasting evidence index, not one-off form filling")],
        [L("减排目标与热点", "Reduction targets and hotspots"), L("先有基准年，才能谈同比下降", "A baseline year is required before year-on-year cuts")],
      ],
      packages: [
        {
          title: L("面料 / 成衣系统边界与模板", "Fabric / garment boundary and template"),
          tag: "PCF",
          body: L("与品牌对齐功能单位和截断规则后，按纺纱—织造—染整—成衣拆清单，向染厂与面料商发放可回传的采集模板。", "After agreeing functional unit and cut-offs with the brand, split spinning–weaving–dyeing–CMT and send returnable templates to dye houses and mills."),
          bullets: [
            L("款号 / 面料编号对照", "Style / fabric ID map"),
            L("染化料与蒸汽分摊规则", "Dyestuff and steam allocation rules"),
            L("外发加工数据缺口清单", "Subcontract data gap list"),
          ],
        },
        {
          title: L("染整与蒸汽热点解读", "Dyeing and steam hotspot read-out"),
          tag: "PCF",
          body: L("在首批款号跑通后，标出高耗能工序与可议价的上游环节，形成给采购与工厂的共同语言。", "Once first styles run, mark energy-heavy steps and negotiable upstream links so merchandising and mills share one language."),
          bullets: [
            L("工序贡献排序", "Process contribution ranking"),
            L("可改进项与数据条件", "Improvement options and data conditions"),
            L("下一季可复用的边界版本", "Reusable boundary version for next season"),
          ],
        },
        {
          title: L("供应商 ESG 证据架", "Supplier ESG evidence shelf"),
          tag: "ESG",
          body: L("把品牌问卷拆成指标与证据条目，指定厂内责任人，避免每年从聊天记录和扫描件重新拼。", "Break brand questionnaires into metrics and evidence items with site owners, so you are not rebuilding from chats and scans each year."),
          bullets: [
            L("议题—指标—证据对照表", "Topic–metric–evidence map"),
            L("证书与检测报告索引", "Certificate and lab-report index"),
            L("问卷回答底稿（可版本化）", "Versioned questionnaire base answers"),
          ],
        },
      ],
      prepare: [
        L("主销面料 / 款号清单与工艺路线", "Key fabrics / styles and process routes"),
        L("染厂、织厂用电与蒸汽记录", "Dye- and weave-house power and steam records"),
        L("染化料采购与配方摘要", "Dyestuff purchases and recipe summaries"),
        L("品牌问卷模板与往年填报稿", "Brand survey templates and prior replies"),
      ],
    },
    {
      id: "packaging",
      name: L("包装", "Packaging"),
      tagline: L("材料声明、工厂排放与产品碳，一次对齐给品牌", "Align material claims, plant emissions and product carbon for brands"),
      background: L(
        "包装企业常同时面对欧盟包装规则、品牌可持续采购与客户范围三请求。纸、塑、金属产线并存时，口径不一会让集团对不上数。我们按「材料—工厂—产品」一并整理：先做 SKU / 结构碳数据卡，再统一多厂区盘查，并按出口市场排合规优先级。",
        "Packagers face EU packaging rules, brand sourcing policies and customer Scope 3 asks together. Mixed paper, plastics and metal lines break group numbers. We link material, plant and product in one pass: SKU/structure carbon cards, then multi-site inventory, then market-by-market compliance priorities."
      ),
      challenge: L("同一集团里纸、塑、金属产线并存；客户既要材料成分与可回收说明，也要工厂排放和产品碳数据，欧盟包装规则还在收紧时间表。", "Paper, plastics and metal lines often sit in one group. Customers want material and recyclability notes plus plant emissions and product carbon—while EU packaging rules tighten."),
      helps: [
        [L("给采购可转发的材料与碳数据卡", "One-pager buyers can forward"), L("克重、再生比例与单位排放写在一页", "Grammage, recycled share and per-unit emissions on one page")],
        [L("多厂区口径对齐", "Align multi-site definitions"), L("纸 / 塑 / 金属厂能汇总到集团", "Paper, plastics and metal sites roll up to the group")],
        [L("出口市场合规有优先级", "Prioritise export-market duties"), L("标识、材料限制与文件差距先排序", "Rank labelling, material limits and file gaps")],
        [L("回应品牌可持续采购问卷", "Answer brand sourcing surveys"), L("材料声明与碳强度可同时给出", "Material claims and carbon intensity together")],
      ],
      chain: [
        L("梳理主销结构与材料", "Map key structures and materials"),
        L("统一厂区边界与能源分类", "Align site boundaries and energy classes"),
        L("核算 SKU / 结构碳数据", "Calculate SKU / structure carbon"),
        L("对照目标市场补文件", "Close target-market document gaps"),
      ],
      reqs: [
        ["EU PPWR", L("材料、可回收设计与相关披露要求在过渡期内陆续生效", "Material, recyclability and disclosure duties phase in during the transition")],
        [L("品牌可持续采购", "Brand sustainable sourcing"), L("常同时要材料声明与碳强度", "Often asks for material claims and carbon intensity together")],
        [L("客户范围三数据请求", "Customer Scope 3 requests"), L("需要可按工厂汇总的组织级数据", "Need organisation data that rolls up by plant")],
      ],
      packages: [
        {
          title: L("包装产品材料与碳数据卡", "Packaging product material & carbon card"),
          tag: "PCF",
          body: L("按 SKU 或材料结构整理克重、再生料比例与摇篮到大门排放，做成采购可直接转发的一页卡。", "Per SKU or material structure, capture grammage, recycled content and cradle-to-gate emissions into a one-pager buyers can forward."),
          bullets: [
            L("结构 BOM 与克重", "Structure BOM and grammage"),
            L("再生 / 生物基比例", "Recycled / bio-based share"),
            L("单位产品排放与主要贡献", "Per-unit emissions and main drivers"),
          ],
        },
        {
          title: L("多厂区组织盘查", "Multi-site organisational inventory"),
          tag: "GHG",
          body: L("统一纸、塑、金属厂的边界与燃料分类，解决「同一集团、不同口径」导致客户对不上数的问题。", "Align boundaries and fuel categories across paper, plastics and metal plants so group numbers stop conflicting in customer files."),
          bullets: [
            L("厂区—产品线对照", "Site–product-line map"),
            L("外购电与自备热力分列", "Purchased power vs on-site heat split"),
            L("可汇总到集团的年度快照", "Group-roll-up annual snapshot"),
          ],
        },
        {
          title: L("目标市场合规清单（包装）", "Target-market compliance checklist (packaging)"),
          tag: "TRADE",
          body: L("按出口市场列出包装标识、材料限制与文件要求，标出与现有检测、声明的差距，再决定补测或改结构。", "List labelling, material limits and file requirements by export market, mark gaps against current tests and claims, then decide retest or redesign."),
          bullets: [
            L("市场—要求矩阵", "Market–requirement matrix"),
            L("现有证书 / 检测缺口", "Certificate / test gaps"),
            L("改结构或补测优先级", "Redesign vs retest priority"),
          ],
        },
      ],
      prepare: [
        L("主销包装结构与材料规格书", "Key pack structures and material specs"),
        L("各厂区能源与产量月报", "Monthly energy and output by site"),
        L("再生料采购凭证或比例声明", "Recycled-content purchases or attestations"),
        L("目标出口市场与客户问卷样本", "Target markets and sample customer surveys"),
      ],
    },
    {
      id: "chem",
      name: L("化工", "Chemicals"),
      tagline: L("按工艺路线拆开直接与间接排放，再谈披露", "Split direct and indirect emissions by route before disclosure"),
      background: L(
        "化肥、氢及部分前体已进入边境调节范围；合成氨、电解氢等路线不同，物料平衡与证明要求就不同。工艺排放与燃烧排放缠在一起时，装置边界没画清就无法核查。我们从装置级拆分做起，再挂上融资或客户需要的 ESG 指标。",
        "Fertilisers, hydrogen and some precursors are in CBAM scope. Ammonia and electrolytic hydrogen routes change mass balance and evidence. When process and combustion emissions tangle, unclear unit boundaries block verification. We start with unit-level splits, then attach ESG metrics for financing or customers."
      ),
      challenge: L("化肥、氢及部分前体已进入边境调节范围；工艺排放与燃烧排放缠在一起，路线（合成氨、电解氢等）一变，数据和证明要求就变。", "Fertilisers, hydrogen and some precursors are in scope. Process and combustion emissions tangle together—and ammonia or electrolytic hydrogen routes change both data and evidence."),
      helps: [
        [L("按装置拆开工艺与燃烧排放", "Split process vs combustion by unit"), L("物料平衡与监测能对上", "Mass balance and monitors reconcile")],
        [L("化肥 / 氢等产品可申报", "File fertiliser / hydrogen products"), L("直接、间接与前体分列清楚", "Direct, indirect and precursors listed clearly")],
        [L("装置级盘查可对标", "Unit-level inventory for benchmarks"), L("为产品申报提供可汇总底数", "A roll-up base for product filings")],
        [L("披露与融资指标不打架", "Keep disclosure and financing aligned"), L("ESG 证据引用同一套盘查结果", "ESG evidence cites the same inventory")],
      ],
      chain: [
        L("画出装置与物料平衡", "Draw units and mass balance"),
        L("分列工艺 / 燃烧 / 前体", "Split process / combustion / precursors"),
        L("核算并锁定因子版本", "Calculate and lock factor versions"),
        L("挂接披露指标与证据", "Attach disclosure metrics and evidence"),
      ],
      reqs: [
        [L("化肥 / 氢等产品申报", "Fertiliser / hydrogen filings"), L("需按工艺路线区分直接与间接排放", "Direct vs indirect emissions by production route")],
        [L("工艺排放可核查", "Verifiable process emissions"), L("物料平衡与在线监测要能对上", "Mass balance and online monitors must reconcile")],
        [L("融资与上市披露", "Financing and listing disclosure"), L("需要组织级排放与治理指标并行", "Organisation emissions and governance metrics in parallel")],
      ],
      packages: [
        {
          title: L("工艺路线与前体排放拆分", "Route and precursor emissions split"),
          tag: "CBAM",
          body: L("按装置画出合成、转化、提纯边界，把燃料燃烧与工艺反应排放分开，并登记外购氨、氢等前体。", "Draw synthesis, conversion and purification boundaries by unit, separate fuel combustion from process reactions, and register bought ammonia or hydrogen precursors."),
          bullets: [
            L("装置边界与物料平衡草图", "Unit boundary and mass-balance sketch"),
            L("工艺 / 燃烧排放分列底稿", "Process vs combustion working paper"),
            L("前体采购与默认值适用说明", "Precursor purchases and default-value note"),
          ],
        },
        {
          title: L("装置级温室气体盘查", "Unit-level GHG inventory"),
          tag: "GHG",
          body: L("以装置或厂区为对象建立范围一、二清单，服务内部对标，也为产品级申报提供可汇总底数。", "Build Scope 1–2 inventories by unit or site for internal benchmarking and as a roll-up base for product filings."),
          bullets: [
            L("排放源分类（燃烧、工艺、逸散）", "Source classes (combustion, process, fugitive)"),
            L("监测与缺失数据规则", "Monitoring and missing-data rules"),
            L("年度盘查报告结构", "Annual inventory report structure"),
          ],
        },
        {
          title: L("披露用 ESG 指标骨架", "ESG metrics skeleton for disclosure"),
          tag: "ESG",
          body: L("按融资或客户框架选定议题，挂上已有的安全、排放与治理证据，避免环境数据与 ESG 报告各写各的。", "Pick topics from financing or customer frameworks and attach existing safety, emissions and governance evidence so EHS and ESG stop diverging."),
          bullets: [
            L("议题与指标清单", "Topic and metric list"),
            L("证据责任人", "Evidence owners"),
            L("与盘查结果的引用关系", "Links to inventory results"),
          ],
        },
      ],
      prepare: [
        L("主产品工艺流程图与设计产能", "Process flow diagrams and nameplate capacity"),
        L("燃料、原料与中间体进出厂记录", "Fuel, feedstock and intermediate movements"),
        L("在线监测或手工分析记录", "Online monitor or lab analysis logs"),
        L("外购氨 / 氢 / 电力合同", "Bought ammonia / hydrogen / power contracts"),
      ],
    },
    {
      id: "elec",
      name: L("电子电器", "Electronics"),
      tagline: L("零部件碳、厂区绿电与审核资料，同一季也能理顺", "Part carbon, site renewables and audit files—sorted in one season"),
      background: L(
        "品牌与整机厂把范围三压到一级供应商：指定模板要零部件碳足迹，供应链目标要可再生电力占比，审核又抽查证书与冲突矿物。我们把「器件通道—厂区绿电—ESG 资料夹」串成一条可重复路径，而不是每来一份问卷重开一轮。",
        "Brands and OEMs push Scope 3 onto tier-1 suppliers: locked templates for part footprints, renewable-power share targets, and audits that pull certificates and conflict minerals. We string a repeatable path—component lane, site renewables, ESG dossier—instead of restarting with every questionnaire."
      ),
      challenge: L("品牌与整机厂把范围三压到一级供应商：既要零部件碳足迹，又要厂区可再生电力比例，还要应付名目繁多的 ESG 审核表。", "Brands and OEMs push Scope 3 onto tier-1 suppliers: part footprints, site renewable-power shares and a stack of ESG audit sheets."),
      helps: [
        [L("按客户模板回传零部件碳数据", "Return part carbon on the customer template"), L("BOM、边界与字段一次对齐", "Align BOM, boundary and fields once")],
        [L("厂区可再生占比可声明", "Claimable site renewable share"), L("自建、直购与绿证组合可测算", "Size on-site, PPA and certificate mixes")],
        [L("客户审核资料随取随用", "Audit files ready to pull"), L("证书、许可与排放数据进同一索引", "Certificates, permits and emissions in one index")],
        [L("减少同一季多头问卷的重复劳动", "Cut repeat work across same-season surveys"), L("预填底稿与敏感资料分级", "Draft answers and sensitivity tiers")],
      ],
      chain: [
        L("选定关键料号与客户模板", "Pick key parts and customer templates"),
        L("建立 BOM—活动—因子通道", "Build BOM–activity–factor lane"),
        L("测算厂区绿电路径", "Size site renewable pathway"),
        L("沉淀审核用 ESG 资料夹", "Shelf ESG dossier for audits"),
      ],
      reqs: [
        [L("零部件 / 整机碳数据", "Part / product carbon data"), L("常要求按客户模板回传，单位与边界写死", "Often locked to the customer’s template, unit and boundary")],
        [L("厂区可再生电力占比", "Site renewable-power share"), L("供应链 100% 绿电目标向下分解", "Supply-chain 100% renewable targets cascaded down")],
        [L("客户 ESG / 责任采购审核", "Customer ESG / responsible-sourcing audits"), L("证书、劳工与环境证据要随时可调", "Certificates and labour/environment evidence must be ready to pull")],
      ],
      packages: [
        {
          title: L("关键零部件碳足迹通道", "Key-component footprint lane"),
          tag: "PCF",
          body: L("先选占总成本或客户点名的器件，固定功能单位与系统边界，建立可重复的 BOM—活动数据—因子匹配流程。", "Start with cost-driving or customer-named parts, lock functional unit and boundary, and set a repeatable BOM–activity–factor path."),
          bullets: [
            L("BOM 层级与外购件列表", "BOM levels and bought-out parts"),
            L("SMT / 组装能耗分摊", "SMT / assembly energy allocation"),
            L("客户模板字段对照", "Customer-template field map"),
          ],
        },
        {
          title: L("厂区绿电路径与占比测算", "Site renewable path and share"),
          tag: "EAC",
          body: L("按用电曲线测算自建、直购与绿证组合，算出可向客户声明的可再生占比，并准备注销证明。", "Size on-site, direct-purchase and certificate mixes against the load curve, compute a claimable renewable share and prepare retirement proof."),
          bullets: [
            L("年用电与峰值曲线摘要", "Annual use and peak-curve summary"),
            L("路径组合与成本量级", "Pathway mix and cost magnitude"),
            L("声明与注销台账格式", "Claim and retirement ledger format"),
          ],
        },
        {
          title: L("客户审核用 ESG 资料夹", "ESG dossier for customer audits"),
          tag: "ESG",
          body: L("把常被抽查的环境许可、体系证书、冲突矿物与排放数据放进同一索引，按客户问卷预填底稿。", "Index environmental permits, system certificates, conflict-minerals and emissions data in one place, with draft answers for common questionnaires."),
          bullets: [
            L("证书与许可有效期看板", "Certificate and permit expiry board"),
            L("问卷题库与标准答法", "Question bank with standard replies"),
            L("敏感资料分级与可见范围", "Sensitivity tiers and visibility"),
          ],
        },
      ],
      prepare: [
        L("主销料号 BOM 与外协清单", "Key part numbers, BOMs and subcontract list"),
        L("厂区月度电、气、产量", "Monthly site power, gas and output"),
        L("现有体系证书与客户审核报告", "Existing system certificates and audit reports"),
        L("绿电 / 绿证合同或意向", "Green-power / EAC contracts or LOIs"),
      ],
    },
  ]);
  root.LuminoIndustries = industries;
})(typeof window !== "undefined" ? window : globalThis);
