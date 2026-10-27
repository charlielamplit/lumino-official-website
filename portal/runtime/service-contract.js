(function (root, factory) {
  const contract = factory();
  if (typeof module === "object" && module.exports) module.exports = contract;
  if (root) root.LuminoServiceContract = contract;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  return Object.freeze({
    cbam: Object.freeze({ id: "cbam", name: "欧盟碳边境合规", status: "active", statusLabel: "已开通", publicRoute: "/services/cbam/", primaryActionLabel: "进入 CBAM 频道" }),
    pcf: Object.freeze({ id: "pcf", name: "产品碳足迹", status: "pilot", statusLabel: "试点", publicRoute: "/services/pcf/", primaryActionLabel: "申请或继续试点" }),
    esg: Object.freeze({ id: "esg", name: "ESG 报告", status: "soon", statusLabel: "即将上线", publicRoute: "/services/esg/", primaryActionLabel: "预约咨询" }),
    inventory: Object.freeze({ id: "inventory", name: "企业碳盘查", status: "planned", statusLabel: "规划中", publicRoute: "/services/ghg-inventory/", primaryActionLabel: "预约咨询" }),
    assets: Object.freeze({ id: "assets", name: "碳资产与绿证", status: "planned", statusLabel: "规划中", publicRoute: "/services/carbon-assets/", primaryActionLabel: "预约咨询" }),
    export: Object.freeze({ id: "export", name: "出口合规服务", status: "planned", statusLabel: "规划中", publicRoute: "/services/export-compliance/", primaryActionLabel: "预约咨询" })
  });
});
