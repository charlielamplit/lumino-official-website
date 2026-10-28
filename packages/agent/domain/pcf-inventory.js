(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfInventory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const INVENTORY_VERSION = "0.1.0";

  function buildDomainLedger(input) {
    input = input || {};
    const declaration = input.declaration || {};
    const boundary = input.boundary || {};
    const template = input.template || {};
    const bindings = Array.isArray(input.bindings) ? input.bindings : [];
    const powerBinding = bindings.find(function (item) { return item.assetId === "REC-HX-POWER-2026Q3" || /POWER/i.test(item.id || ""); });
    const templateDomains = Array.isArray(template.domains) ? template.domains : [];
    const templateReady = ["VALIDATED", "VALIDATED_PARTIAL"].includes(template.status);
    const boundaryReady = boundary.status === "CONFIRMED" || boundary.confirmed;

    const rows = [
      {
        id: "scope",
        number: "01",
        name: "产品与边界",
        description: "功能单位、核算期、系统边界与分配规则",
        owner: "项目协调人",
        count: declaration.confirmed && boundaryReady ? "14 / 14" : "0 / 14",
        status: declaration.confirmed && boundaryReady ? "已确认" : "待确认",
        tone: declaration.confirmed && boundaryReady ? "ok" : "warn",
        action: "pcf-boundary",
        label: "查看定义"
      }
    ];

    function domainFromTemplate(domainId, fallbackName, owner, drawer) {
      const found = templateDomains.find(function (item) { return item.id === domainId; });
      if (!templateReady || !found) {
        return {
          id: domainId,
          number: "",
          name: fallbackName,
          description: "",
          owner: owner,
          count: "0 / —",
          status: boundaryReady ? "待回传模板" : "待确认边界",
          tone: "warn",
          action: "pcf-upload",
          label: "回传模板"
        };
      }
      const count = found.imported + " / " + found.expected;
      let status = "已导入";
      let tone = "ok";
      let label = "查看记录";
      let action = drawer;
      if (found.status === "gap") {
        status = "存在缺口";
        tone = "danger";
        label = "优先补充";
        action = "pcf-upload";
      } else if (found.status === "missing") {
        status = "待填写";
        tone = "warn";
        label = "回传模板";
        action = "pcf-upload";
      } else if (found.status === "optional") {
        status = "按需填写";
        tone = "neutral";
        label = "查看要求";
      }
      if (domainId === "energy" && powerBinding) {
        if (powerBinding.status === "CONFIRMED") {
          status = "已确认";
          tone = "ok";
          label = "核对数据";
          action = "record-detail";
        } else if (["PROPOSED", "PENDING_CONFIRMATION"].includes(powerBinding.status)) {
          status = "1 项待确认";
          tone = "warn";
          label = "核对数据";
          action = "record-detail";
        }
      }
      return {
        id: domainId,
        number: "",
        name: found.name || fallbackName,
        description: "",
        owner: owner,
        count: count,
        status: status,
        tone: tone,
        action: action,
        label: label,
        bindingId: domainId === "energy" ? (powerBinding && powerBinding.id) : null
      };
    }

    const material = domainFromTemplate("materials", "原材料与前体", "采购", "pcf-upload");
    material.number = "02";
    material.description = "铁矿石、焦炭、废钢、辅料及供应商信息";
    rows.push(material);

    const energy = domainFromTemplate("energy", "能源与过程排放", "生产 / EHS", "record-detail");
    energy.number = "03";
    energy.description = "购电、燃料、蒸汽、制冷剂和直接过程排放";
    rows.push(energy);

    const transport = domainFromTemplate("transport", "上游与厂内运输", "物流 / 采购", "pcf-upload");
    transport.number = "04";
    transport.description = "运输对象、路线、方式、距离、质量与装载率";
    rows.push(transport);

    const output = domainFromTemplate("output", "产量、联产品与分配", "生产 / 财务", "pcf-upload");
    output.number = "05";
    output.description = "目标产品产量、联产品及共用过程分配依据";
    rows.push(output);

    const waste = domainFromTemplate("waste", "废弃物与处理路径", "EHS", "pcf-upload");
    waste.number = "06";
    waste.description = "废物数量、处理方式、回收比例和处置运输";
    rows.push(waste);

    const supplier = domainFromTemplate("supplier", "供应商 PCF", "采购", "pcf-upload");
    supplier.number = "07";
    supplier.description = "供应商声明值、边界、方法、一次数据比例和核查状态";
    rows.push(supplier);

    const required = rows.filter(function (row) { return row.id !== "supplier"; });
    const readyCount = required.filter(function (row) { return row.tone === "ok"; }).length;
    return {
      schemaVersion: INVENTORY_VERSION,
      rows: rows,
      summary: {
        ready: readyCount,
        total: required.length,
        templateStatus: template.status || "UPLOADED",
        bindingConfirmed: Boolean(powerBinding && powerBinding.status === "CONFIRMED")
      }
    };
  }

  return { INVENTORY_VERSION: INVENTORY_VERSION, buildDomainLedger: buildDomainLedger };
});
