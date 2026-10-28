(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfTemplate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TEMPLATE_VERSION = "0.1.0";
  const EXPECTED_PACK_VERSION = "PCF-DATA-PACK-1.0";
  const REQUIRED_SHEETS = Object.freeze([
    "说明", "产品与边界", "原材料", "能源", "运输", "产量与分配", "废弃物", "供应商PCF", "数据质量", "证据索引"
  ]);

  const DOMAIN_DEFS = Object.freeze([
    { id: "materials", name: "原材料与前体", expected: 5 },
    { id: "energy", name: "能源与过程排放", expected: 4 },
    { id: "transport", name: "上游与厂内运输", expected: 3 },
    { id: "output", name: "产量、联产品与分配", expected: 2 },
    { id: "waste", name: "废弃物与处理路径", expected: 2 },
    { id: "supplier", name: "供应商 PCF", expected: 2, optional: true }
  ]);

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function issue(code, message, recovery) {
    return { code: code, message: message, recovery: recovery || "修正后重新回传模板" };
  }

  function normalize(input) {
    input = input || {};
    return {
      schemaVersion: TEMPLATE_VERSION,
      packVersion: trim(input.packVersion || input.templateVersion || ""),
      filename: trim(input.filename || ""),
      status: trim(input.status || "UPLOADED") || "UPLOADED",
      scenario: trim(input.scenario || "valid") || "valid",
      supportFileCount: Number(input.supportFileCount || 0),
      issues: Array.isArray(input.issues) ? input.issues.slice() : [],
      domains: Array.isArray(input.domains) ? input.domains.map(function (item) { return Object.assign({}, item); }) : [],
      requiredSheets: (input.requiredSheets || REQUIRED_SHEETS).slice(),
      validatedAt: input.validatedAt || null,
      agentTaskId: input.agentTaskId || null
    };
  }

  function domainsForScenario(scenario, valid) {
    return DOMAIN_DEFS.map(function (def) {
      if (!valid) {
        return {
          id: def.id,
          name: def.name,
          expected: def.expected,
          imported: 0,
          status: def.optional ? "optional" : "missing",
          optional: Boolean(def.optional)
        };
      }
      if (scenario === "partial") {
        const imported = def.id === "energy" ? def.expected - 1 : (def.optional ? 0 : def.expected);
        return {
          id: def.id,
          name: def.name,
          expected: def.expected,
          imported: imported,
          status: def.optional ? "optional" : (imported >= def.expected ? "ok" : "gap"),
          optional: Boolean(def.optional)
        };
      }
      return {
        id: def.id,
        name: def.name,
        expected: def.expected,
        imported: def.optional ? 0 : def.expected,
        status: def.optional ? "optional" : "ok",
        optional: Boolean(def.optional)
      };
    });
  }

  function validateUpload(input) {
    input = input || {};
    const filename = trim(input.filename);
    const packVersion = trim(input.templateVersion || input.packVersion || EXPECTED_PACK_VERSION);
    const scenario = trim(input.scenario || "valid") || "valid";
    const issues = [];

    if (!filename) {
      issues.push(issue("STRUCTURE", "未选择回传文件", "选择已填写的 Excel 模板后重新上传"));
    } else if (!/\.xlsx$/i.test(filename)) {
      issues.push(issue("STRUCTURE", "文件类型必须是 .xlsx", "使用项目下发的 Excel 模板回传"));
    }
    if (packVersion !== EXPECTED_PACK_VERSION) {
      issues.push(issue("STRUCTURE", "模板版本不匹配：期望 " + EXPECTED_PACK_VERSION, "重新下载当前项目模板后再填写"));
    }
    if (scenario === "structure_error" || /结构|缺栏|invalid-structure/i.test(filename)) {
      issues.push(issue("STRUCTURE", "缺少工作表或字段被改名（例如“能源”表）", "不要改工作表名称；按模板字段重新导出"));
    }
    if (scenario === "unit_error" || /单位|unit-error/i.test(filename)) {
      issues.push(issue("UNIT", "能源用量单位无法识别（收到“度”）", "将购电单位改为 MWh 或 kWh 后重传"));
    }
    if (scenario === "missing_evidence" || /缺证据|no-evidence/i.test(filename)) {
      issues.push(issue("EVIDENCE", "证据索引中有活动数据未关联证明材料", "在证据索引中补齐文件名或附上证明材料"));
    }

    const ok = issues.length === 0;
    const status = ok ? (scenario === "partial" ? "VALIDATED_PARTIAL" : "VALIDATED") : "INVALID";
    return normalize({
      packVersion: packVersion,
      filename: filename,
      status: status,
      scenario: scenario,
      supportFileCount: input.supportFileCount || 0,
      issues: issues,
      domains: domainsForScenario(scenario, ok),
      requiredSheets: REQUIRED_SHEETS,
      validatedAt: new Date().toISOString(),
      agentTaskId: input.agentTaskId || null
    });
  }

  function toStageGate(template) {
    const normalized = normalize(template);
    let status = normalized.status;
    if (status === "VALIDATED_PARTIAL") status = "VALIDATED";
    return { status: status, issues: normalized.issues, packVersion: normalized.packVersion };
  }

  return {
    TEMPLATE_VERSION: TEMPLATE_VERSION,
    EXPECTED_PACK_VERSION: EXPECTED_PACK_VERSION,
    REQUIRED_SHEETS: REQUIRED_SHEETS,
    DOMAIN_DEFS: DOMAIN_DEFS,
    normalize: normalize,
    validateUpload: validateUpload,
    toStageGate: toStageGate,
    domainsForScenario: domainsForScenario
  };
});
