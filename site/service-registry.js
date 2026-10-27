(function (root, factory) {
  const services = factory(root && root.LuminoServiceContract);
  if (typeof module === "object" && module.exports) module.exports = services;
  if (root) root.LuminoPublicServices = services;
})(typeof window !== "undefined" ? window : globalThis, function (contract) {
  "use strict";
  const base = contract || (typeof require === "function" ? require("../portal/runtime/service-contract.js") : {});
  const reviewedAt = "2026-10-27";
  const withBase = (id, detail) => Object.freeze({ ...base[id], reviewedAt, ...detail });
  return Object.freeze({
    cbam: withBase("cbam", {
      code: "CBAM", claimState: "SUPPORTED", promise: "把分散的产品、生产与供应链数据，组织成经得起追问的 CBAM 交付。",
      audience: "出口欧盟的钢铁、铝等覆盖品类制造商，以及需要收集供应商数据的欧盟进口方。",
      triggers: ["欧盟客户要求交付产品与工厂排放数据", "需要判断 CN Code、范围和申报期", "需要在缺省值和实际排放路径之间做决策"],
      inputs: ["产品、CN/HS 编码与出口范围", "工厂、工艺、产量与能源台账", "前体材料、供应商声明与证明材料"],
      deliverables: ["产品和工厂范围决定记录", "按申报期组织的数据包与缺口清单", "计算结果、版本说明与受控交付件"],
      process: ["判定产品与年度范围", "建立产品、工厂和供应链关系", "按期收集并确认活动数据", "执行确定性计算与异常检查", "专家复核、锁定并交付"],
      assets: ["企业、工厂与产品主档", "能源、材料、产量与发运记录", "供应商声明、票据与核查证据"],
      boundaries: ["不代表监管方或第三方认证机构", "试算不等于正式核算", "具体法规、编码与参数必须按对应申报期核对"],
      ctaHref: "/portal/?service=cbam&page=work"
    }),
    pcf: withBase("pcf", {
      code: "PCF", claimState: "PILOT", promise: "从功能单位和系统边界开始，建立可复现、可复核的产品碳足迹。",
      audience: "被客户、采购、供应链或出口市场要求提供产品碳足迹的制造企业。",
      triggers: ["客户要求产品级碳足迹或数据交换", "企业需要识别产品排放热点", "既有台账完整，但边界、分配和因子口径未统一"],
      inputs: ["产品、功能单位、核算目标与期间", "标准模板导出、填写后再导入的活动数据", "材料、能源、运输、产量和证明材料"],
      deliverables: ["系统边界、功能单位与生命周期清单", "确定性计算、阶段结果与排放热点", "不确定性、敏感性说明与版本化 PCF 报告草稿"],
      process: ["确认目标、功能单位和边界", "拆解生命周期阶段与排放清单", "导出模板、导入活动数据并确认事实", "匹配运输、排放因子和单位", "计算、热点分析、专家复核与报告"],
      assets: ["产品、工厂、工艺与供应商主档", "材料流、能源、运输和产量记录", "排放因子引用、分配规则与证据"],
      boundaries: ["当前为交互原型和试点链路，不接真实计算与报告后端", "Agent 不得自动确认边界、分配方法或正式事实", "正式项目必须由授权人员与专家复核"],
      ctaHref: "/portal/?service=pcf&page=pcf-scope"
    }),
    esg: withBase("esg", {
      code: "ESG", claimState: "PLANNED", promise: "将议题、指标、证据和披露版本组织成可持续协作的报告过程。",
      audience: "需要筹备或改进 ESG 报告、客户披露或年度指标管理的企业。",
      triggers: ["报告资料分散在多部门且口径不一", "年度指标缺少责任人、证据和版本记录", "需要先明确报告目标和适用框架"],
      inputs: ["报告目标、读者与预计时间", "组织范围、议题、政策与既有披露", "环境、社会和治理指标及证据"],
      deliverables: ["规划中：议题与指标结构", "规划中：数据缺口、责任人与证据索引", "规划中：报告草稿、审批和发布版本"],
      process: ["咨询并确认报告目标", "拟定议题、指标和责任范围", "收集数据与证据", "质量检查和内容编制", "复核、审批和版本发布"],
      assets: ["组织、设施与责任人", "年度指标、政策、证据与披露内容", "CBAM、PCF 和碳盘查已确认数据的受控引用"],
      boundaries: ["服务尚未开放，当前不创建工作空间", "适用披露框架必须在正式项目中确认", "当前页面仅用于说明计划与收集需求"], ctaHref: "/Lumino%20联系.dc.html?serviceId=esg&source=service-page"
    }),
    inventory: withBase("inventory", {
      code: "GHG", claimState: "PLANNED", promise: "计划将组织边界、排放源和年度记录建立为可更新的企业碳盘查底座。",
      audience: "需要建立组织级排放清单、年度基线或为 ESG/PCF 提供基础数据的企业。",
      triggers: ["各工厂和部门能源与活动数据分散", "组织边界、基准年和排放源口径未统一", "需要将盘查结果用于其他披露或产品核算"],
      inputs: ["组织结构、设施和运营边界", "能源、工艺、物料、废弃物和出行等活动数据", "基准年、计算口径与历史记录"],
      deliverables: ["规划中：组织边界与排放源清单", "规划中：分类计算、数据质量与年度变化说明", "规划中：盘查报告与证据索引"],
      process: ["咨询并界定组织与运营边界", "识别排放源与数据责任人", "采集、确认与质量检查", "计算、差异分析与复核", "报告和年度版本管理"],
      assets: ["组织、设施、活动与责任人", "能源、排放源、计量记录与因子引用", "年度快照、更正和证据"],
      boundaries: ["服务尚未开放，页面不表示已可正式核算", "组织边界、基准年和因子口径须在项目中确认", "不代替第三方核查或认证"], ctaHref: "/Lumino%20联系.dc.html?serviceId=inventory&source=service-page"
    }),
    assets: withBase("assets", {
      code: "EAC", claimState: "PLANNED", promise: "计划把绿电、绿证与相关凭证纳入可追溯的需求、持有与履约记录。",
      audience: "需要梳理绿色电力、环境属性凭证或与产品/工厂目标匹配需求的企业。",
      triggers: ["客户或内部目标要求使用绿色电力或凭证", "持有、分配、核销与证据分散", "需要判断哪些凭证可用于特定工厂、期间或披露"],
      inputs: ["设施、用电期间与目标范围", "持有或拟获取的凭证和合同材料", "客户、市场或内部披露要求"],
      deliverables: ["规划中：需求与可用性清单", "规划中：凭证、期间、设施与用途匹配记录", "规划中：履约证据包与历史版本"],
      process: ["咨询并确认需求和用途", "整理持有、合同与凭证", "检查时间、地域、设施和用途匹配", "记录分配、使用和核销", "组织履约证据"],
      assets: ["设施、期间和能源消费记录", "凭证、合同、签发方和有效期", "分配、核销、用途和证据版本"],
      boundaries: ["服务尚未开放", "不提供交易撮合、交易执行或收益承诺", "凭证的适用性须按目标市场与用途核对"], ctaHref: "/Lumino%20联系.dc.html?serviceId=assets&source=service-page"
    }),
    export: withBase("export", {
      code: "TRADE", claimState: "PLANNED", promise: "计划将目标市场要求、产品对象、证据和交付版本组织成可维护的出口合规路径。",
      audience: "面对多市场、多产品和多客户合规要求，需要统一管理交付证据的出口企业。",
      triggers: ["客户要求、法规文件和内部责任人分散", "同一资料被多个市场和客户反复索取", "需要知道规则变化影响了哪些产品与交付"],
      inputs: ["目标市场、产品、客户与交付时间", "现有证书、技术文件、测试和声明", "企业、产品、供应商与责任人信息"],
      deliverables: ["规划中：市场—产品—要求矩阵", "规划中：证据缺口、任务与责任人", "规划中：受控交付包、回执和历史版本"],
      process: ["咨询并确认市场与产品范围", "建立要求与证据矩阵", "分配缺口任务与责任人", "复核文件和版本", "组织客户交付与后续更正"],
      assets: ["企业、产品、市场与客户关系", "法规要求、证书、测试和技术文件", "任务、审批、交付、回执与更正历史"],
      boundaries: ["服务尚未开放", "不声称覆盖所有国家、行业或法规", "具体适用性需由项目专家按时点和目标市场确认"], ctaHref: "/Lumino%20联系.dc.html?serviceId=export&source=service-page"
    })
  });
});
