import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

process.on("uncaughtException", (error) => {
  console.error(`PCF template build failed: ${error.message}`);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(`PCF template build failed: ${error?.message || error}`);
  process.exit(1);
});

const projectRoot = process.env.PCF_PROJECT_ROOT || new URL("../", import.meta.url).pathname;
const outputDir = path.join(projectRoot, "outputs/pcf-template");
const outputPath = path.join(outputDir, "Lumino_PCF_数据采集模板_HRC-01.xlsx");
const previewDir = path.join(outputDir, "previews");

const colors = {
  ink: "#0B100E",
  forest: "#07110E",
  green: "#0E7C5A",
  mint: "#EDF6F2",
  mint2: "#F7F9F8",
  yellow: "#F2B705",
  yellowSoft: "#FFF8DB",
  paper: "#FBFCFA",
  line: "#D9E1DE",
  muted: "#67736F",
  danger: "#B3402A",
};
const fontFamily = "Aptos";
const workbook = Workbook.create();
let inputTableIndex = 1;

function baseSheet(name, tabColor = null) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  if (tabColor) sheet.tabColor = tabColor;
  return sheet;
}

function styleTitle(sheet, title, subtitle, endColumn) {
  sheet.getRange(`A2:${endColumn}2`).format.borders = { bottom: { style: "thin", color: colors.ink } };
  sheet.getRange("A2").values = [[title]];
  sheet.getRange("A2").format.font = { name: fontFamily, size: 15, bold: true, color: colors.ink };
  sheet.getRange("A3").values = [[subtitle]];
  sheet.getRange(`A3:${endColumn}3`).format.font = { name: fontFamily, size: 10, italic: true, color: colors.muted };
  sheet.getRange(`A3:${endColumn}3`).format.rowHeight = 24;
}

function createInputSheet({ name, title, subtitle, headers, widths, instruction, validations = [], numberFormats = [] }) {
  const sheet = baseSheet(name);
  const endColumn = String.fromCharCode(64 + headers.length);
  styleTitle(sheet, title, subtitle, endColumn);
  sheet.getRange(`A4:${endColumn}4`).merge();
  sheet.getRange("A4").values = [[instruction]];
  sheet.getRange(`A4:${endColumn}4`).format = {
    fill: colors.yellowSoft,
    font: { name: fontFamily, size: 9, color: "#765A00" },
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange(`A4:${endColumn}4`).format.rowHeight = 34;
  sheet.getRange(`A5:${endColumn}5`).values = [headers];
  sheet.getRange(`A5:${endColumn}5`).format = {
    fill: colors.green,
    font: { name: fontFamily, size: 9, bold: true, color: colors.paper },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#D4E2DD" },
  };
  sheet.getRange(`A5:${endColumn}5`).format.rowHeight = 34;
  sheet.getRange(`A6:${endColumn}55`).format = {
    fill: colors.paper,
    font: { name: fontFamily, size: 9, color: colors.ink },
    verticalAlignment: "center",
    borders: { insideHorizontal: { style: "thin", color: colors.line } },
  };
  sheet.getRange(`A6:${endColumn}55`).format.rowHeight = 22;
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 55, 1).format.columnWidth = width;
  });
  validations.forEach(({ range, values }) => {
    sheet.getRange(range).dataValidation = { rule: { type: "list", values } };
  });
  numberFormats.forEach(({ range, format }) => sheet.getRange(range).format.numberFormat = format);
  sheet.freezePanes.freezeRows(5);
  sheet.tables.add(`A5:${endColumn}55`, true, `PcfInputTable${inputTableIndex++}`);
  return sheet;
}

const overview = baseSheet("数据清单", colors.forest);
styleTitle(overview, "PCF 数据采集清单", "华星钢铁有限公司 · 热轧非合金钢卷 HRC-01 · 2026-01-01 至 2026-09-30", "G");
overview.getRange("A5:G5").values = [["数据域", "核算用途", "预计记录", "当前记录", "状态", "责任部门", "下一步"]];
overview.getRange("A5:G5").format = { fill: colors.green, font: { name: fontFamily, size: 9, bold: true, color: colors.paper }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
overview.getRange("A6:G12").values = [
  ["产品与边界", "功能单位、期间、系统边界、分配规则", 1, null, null, "项目协调人", "确认预填信息"],
  ["原材料", "上游采购、再生料、供应商及材料规格", 5, null, null, "采购", "填写主要材料"],
  ["能源与过程", "购电、燃料、蒸汽及直接过程排放", 4, null, null, "生产 / EHS", "填写能源和过程数据"],
  ["运输", "上游运输与厂内运输活动", 3, null, null, "物流 / 采购", "补充路线与运输方式"],
  ["产量与分配", "产品产量、联产品和分配依据", 2, null, null, "生产 / 财务", "确认产量与分配"],
  ["废弃物", "废物数量、处理路径与回收", 2, null, null, "EHS", "填写废物处理"],
  ["供应商 PCF", "采用供应商产品碳足迹时的边界和质量", 2, null, null, "采购", "上传供应商声明"],
];
overview.getRange("A6:G12").format = { font: { name: fontFamily, size: 10, color: colors.ink }, verticalAlignment: "center", borders: { insideHorizontal: { style: "thin", color: colors.line } } };
overview.getRange("A6:G12").format.rowHeight = 30;
overview.getRange("A6:A12").format.font = { name: fontFamily, size: 10, bold: true, color: colors.ink };
overview.getRange("B6:B12").format.wrapText = true;
overview.getRange("E6:E12").conditionalFormats.add("containsText", { text: "待", format: { fill: colors.yellowSoft, font: { bold: true, color: "#765A00" } } });
overview.getRange("E6:E12").conditionalFormats.add("containsText", { text: "已填写", format: { fill: colors.mint, font: { bold: true, color: colors.green } } });
overview.getRange("A14:G14").merge();
overview.getRange("A14").values = [["填写完成后，将整个工作簿上传至 Lumino。系统会先校验表结构、单位、期间和证据引用，再生成待确认事实；上传不会直接触发计算。"]];
overview.getRange("A14:G14").format = { fill: colors.mint2, font: { name: fontFamily, size: 9, color: colors.muted }, wrapText: true, verticalAlignment: "center", borders: { preset: "outside", style: "thin", color: colors.line } };
overview.getRange("A14:G14").format.rowHeight = 40;
[18, 38, 12, 12, 14, 18, 24].forEach((width, index) => overview.getRangeByIndexes(0, index, 20, 1).format.columnWidth = width);
overview.freezePanes.freezeRows(5);

const scope = baseSheet("产品与边界", "#4BAE8B");
styleTitle(scope, "产品与核算边界", "黄色单元格为需要企业确认或补充的内容。", "D");
scope.getRange("A5:D5").values = [["字段", "填写值", "单位 / 格式", "说明"]];
scope.getRange("A5:D5").format = { fill: colors.green, font: { name: fontFamily, size: 9, bold: true, color: colors.paper }, horizontalAlignment: "center", verticalAlignment: "center" };
scope.getRange("A6:D19").values = [
  ["企业名称", "华星钢铁有限公司", "文本", "产品所有方或核算委托方"],
  ["产品编码", "HRC-01", "文本", "企业内部唯一编码"],
  ["产品名称", "热轧非合金钢卷", "文本", "与销售或产品主档一致"],
  ["生产设施", "上海一厂", "文本", "可填写多座设施并说明分配"],
  ["核算期开始", new Date("2026-01-01T00:00:00Z"), "yyyy-mm-dd", "活动数据起始日期"],
  ["核算期结束", new Date("2026-09-30T00:00:00Z"), "yyyy-mm-dd", "活动数据结束日期"],
  ["功能单位", "1 吨热轧非合金钢卷", "文本", "结果报告的共同基准"],
  ["系统边界", "从摇篮到大门", "下拉选择", "纳入原料、能源、生产与厂内运输"],
  ["核算用途", "客户披露与供应链响应", "下拉选择", "决定报告披露要求"],
  ["核算方法", "ISO 14067 / GHG Protocol Product Standard", "文本", "最终由专家确认适用规则"],
  ["适用 PCR / 行业规则", "待专家确认", "文本", "如有产品类别规则，请填写名称和版本"],
  ["地理代表性", "中国 · 上海", "文本", "主要生产和数据覆盖区域"],
  ["技术代表性", "高炉—转炉长流程及热轧", "文本", "主要工艺或技术路线"],
  ["分配方法", "质量分配", "下拉选择", "存在联产品或共用过程时必须说明"],
];
scope.getRange("A6:D19").format = { font: { name: fontFamily, size: 10, color: colors.ink }, verticalAlignment: "center", borders: { insideHorizontal: { style: "thin", color: colors.line } } };
scope.getRange("B6:B19").format.fill = colors.yellowSoft;
scope.getRange("B6:B19").format.font = { name: fontFamily, size: 10, color: colors.ink };
scope.getRange("B10:B11").format.numberFormat = "yyyy-mm-dd";
scope.getRange("B13").dataValidation = { rule: { type: "list", values: ["从摇篮到大门", "从大门到大门", "从摇篮到坟墓"] } };
scope.getRange("B14").dataValidation = { rule: { type: "list", values: ["客户披露与供应链响应", "内部减排分析", "第三方核查 / 认证", "其他"] } };
scope.getRange("B19").dataValidation = { rule: { type: "list", values: ["质量分配", "经济分配", "物理关系分配", "系统扩展", "无分配"] } };
[24, 34, 18, 48].forEach((width, index) => scope.getRangeByIndexes(0, index, 24, 1).format.columnWidth = width);
scope.getRange("A6:D19").format.rowHeight = 25;
scope.freezePanes.freezeRows(5);

createInputSheet({
  name: "原材料",
  title: "原材料与前体",
  subtitle: "记录进入产品系统的主要原料、辅料、包装和前体产品。",
  instruction: "每一行对应一种材料在一个供应商和数据期间内的用量。材料名称、数量、单位、来源和证据编号为最低必填项。",
  headers: ["记录ID", "材料 / 前体名称", "牌号 / 规格", "供应商", "供应商所在地", "数量", "单位", "再生料比例", "数据期间", "数据来源", "证据ID", "是否使用供应商PCF", "数据质量说明", "备注"],
  widths: [14, 24, 18, 22, 18, 12, 10, 14, 18, 18, 14, 18, 24, 24],
  validations: [
    { range: "G6:G55", values: ["kg", "t", "Nm³", "L", "件"] },
    { range: "J6:J55", values: ["采购台账", "ERP", "供应商声明", "实测", "估算"] },
    { range: "L6:L55", values: ["是", "否"] },
  ],
  numberFormats: [{ range: "F6:F55", format: "#,##0.000" }, { range: "H6:H55", format: "0.0%" }],
});

createInputSheet({
  name: "能源与过程",
  title: "能源、燃料与过程排放",
  subtitle: "记录购入能源、现场燃料、蒸汽、制冷剂和直接过程排放。",
  instruction: "共用计量数据请填写分配依据。电力应说明电网电力、绿电或自发电；直接排放请记录气体种类和活动数据来源。",
  headers: ["记录ID", "设施 / 产线", "活动类型", "能源 / 气体", "数量", "单位", "期间开始", "期间结束", "计量方式", "分配依据", "电力属性 / 燃料规格", "证据ID", "数据质量说明", "备注"],
  widths: [14, 20, 20, 20, 12, 12, 14, 14, 18, 24, 24, 14, 24, 24],
  validations: [
    { range: "C6:C55", values: ["购入电力", "自发电", "燃料燃烧", "购入蒸汽", "过程排放", "制冷剂逸散", "其他"] },
    { range: "F6:F55", values: ["kWh", "MWh", "GJ", "Nm³", "t", "kg", "L"] },
    { range: "I6:I55", values: ["独立计量", "分表计量", "账单", "按产量分配", "估算"] },
  ],
  numberFormats: [{ range: "E6:E55", format: "#,##0.000" }, { range: "G6:H55", format: "yyyy-mm-dd" }],
});

createInputSheet({
  name: "运输",
  title: "上游与厂内运输",
  subtitle: "按运输区段记录原材料、前体或产品的运输活动。",
  instruction: "每一行对应一个运输区段。优先填写实际路线距离；如只有起讫地，Lumino 将提出距离估算并等待确认。",
  headers: ["运输ID", "运输对象", "起点", "终点", "运输方式", "车辆 / 船型", "距离", "距离单位", "运输质量", "质量单位", "装载率", "空驶比例", "数据来源", "证据ID", "备注"],
  widths: [14, 22, 20, 20, 16, 20, 12, 12, 14, 12, 12, 12, 18, 14, 24],
  validations: [
    { range: "E6:E55", values: ["公路", "铁路", "海运", "内河", "航空", "厂内运输", "其他"] },
    { range: "H6:H55", values: ["km", "海里"] },
    { range: "J6:J55", values: ["kg", "t"] },
    { range: "M6:M55", values: ["物流台账", "承运商数据", "路线估算", "供应商声明"] },
  ],
  numberFormats: [{ range: "G6:G55", format: "#,##0.0" }, { range: "I6:I55", format: "#,##0.000" }, { range: "K6:L55", format: "0.0%" }],
});

createInputSheet({
  name: "产量与分配",
  title: "产量、联产品与分配",
  subtitle: "记录核算期内产品产出，以及共用过程和联产品的分配依据。",
  instruction: "产品产量必须与功能单位一致。存在联产品、废钢回用或跨产品共用能源时，请同时填写分配对象、基准和基准值。",
  headers: ["记录ID", "设施 / 产线", "产出类型", "产品 / 联产品", "数量", "单位", "含水率 / 纯度", "分配方法", "分配基准值", "基准单位", "分配比例", "期间", "证据ID", "备注"],
  widths: [14, 20, 16, 24, 14, 12, 16, 18, 16, 14, 14, 18, 14, 26],
  validations: [
    { range: "C6:C55", values: ["目标产品", "联产品", "副产品", "回用料", "废料"] },
    { range: "F6:F55", values: ["kg", "t", "件"] },
    { range: "H6:H55", values: ["质量分配", "经济分配", "物理关系分配", "系统扩展", "不适用"] },
  ],
  numberFormats: [{ range: "E6:E55", format: "#,##0.000" }, { range: "G6:G55", format: "0.0%" }, { range: "I6:I55", format: "#,##0.000" }, { range: "K6:K55", format: "0.0%" }],
});

createInputSheet({
  name: "废弃物",
  title: "废弃物与处理路径",
  subtitle: "记录生产过程产生的固体、液体和危险废物及其处理方式。",
  instruction: "回收、焚烧、填埋或外部处置应分别记录。若使用处置商数据或转移联单，请在证据ID中关联。",
  headers: ["记录ID", "设施 / 产线", "废弃物名称", "废物类别", "数量", "单位", "处理方式", "回收比例", "处理地点", "运输距离", "距离单位", "数据来源", "证据ID", "备注"],
  widths: [14, 20, 22, 18, 14, 12, 18, 14, 20, 14, 12, 18, 14, 24],
  validations: [
    { range: "D6:D55", values: ["一般固废", "危险废物", "废水", "废气治理副产物", "其他"] },
    { range: "F6:F55", values: ["kg", "t", "m³"] },
    { range: "G6:G55", values: ["回收", "再利用", "焚烧", "填埋", "物化处理", "其他"] },
    { range: "K6:K55", values: ["km", "海里"] },
  ],
  numberFormats: [{ range: "E6:E55", format: "#,##0.000" }, { range: "H6:H55", format: "0.0%" }, { range: "J6:J55", format: "#,##0.0" }],
});

createInputSheet({
  name: "供应商PCF",
  title: "供应商产品碳足迹数据",
  subtitle: "仅在采用供应商 PCF 或 EPD 数据时填写，并保留方法、边界和核查信息。",
  instruction: "供应商给出的单一数值不足以直接使用。必须同时记录声明单位、系统边界、核算期、方法标准、数据质量和核查状态。",
  headers: ["记录ID", "供应商", "供应商产品", "供应商产品编码", "声明单位", "PCF数值", "结果单位", "系统边界", "核算期", "方法 / PCR", "一次数据比例", "核查状态", "文件 / 证据ID", "有效期", "备注"],
  widths: [14, 22, 24, 18, 16, 14, 18, 20, 18, 28, 16, 18, 18, 16, 24],
  validations: [
    { range: "H6:H55", values: ["从摇篮到大门", "从大门到大门", "从摇篮到坟墓", "其他"] },
    { range: "L6:L55", values: ["未经核查", "内部复核", "第三方核查", "认证 / EPD"] },
  ],
  numberFormats: [{ range: "F6:F55", format: "#,##0.000" }, { range: "K6:K55", format: "0.0%" }, { range: "N6:N55", format: "yyyy-mm-dd" }],
});

createInputSheet({
  name: "证据索引",
  title: "证明材料索引",
  subtitle: "为每份原始材料分配唯一证据ID，并关联到一个或多个数据记录。",
  instruction: "文件与模板应一并上传。记录ID用于把原材料、能源、运输等数据行与账单、台账、声明或检测报告连接起来。",
  headers: ["证据ID", "文件名", "材料类型", "提供部门 / 供应商", "覆盖期开始", "覆盖期结束", "关联记录ID", "原始 / 转换文件", "责任人", "敏感级别", "说明"],
  widths: [16, 34, 20, 24, 16, 16, 28, 18, 16, 16, 32],
  validations: [
    { range: "C6:C55", values: ["账单", "ERP导出", "采购台账", "物流台账", "检测报告", "供应商PCF", "EPD", "方法说明", "其他"] },
    { range: "H6:H55", values: ["原始文件", "转换文件", "人工整理"] },
    { range: "J6:J55", values: ["一般", "企业内部", "敏感", "高度敏感"] },
  ],
  numberFormats: [{ range: "E6:F55", format: "yyyy-mm-dd" }],
});

const guide = baseSheet("填报说明", "#9AA6A1");
styleTitle(guide, "模板填写与回传说明", "本模板用于 Lumino PCF 试点项目的数据采集，不在 Excel 内直接计算碳足迹。", "F");
guide.getRange("A5:F5").merge();
guide.getRange("A5").values = [["工作流程"]];
guide.getRange("A5:F5").format = { fill: colors.green, font: { name: fontFamily, size: 10, bold: true, color: colors.paper }, verticalAlignment: "center" };
guide.getRange("A6:F10").values = [
  ["1", "确认产品与边界", "检查预填的产品、核算期间、功能单位、边界和分配方法。", null, null, null],
  ["2", "填写活动数据", "按数据域填写记录。不要把不同单位、不同供应商或不同期间合并在同一行。", null, null, null],
  ["3", "建立证据索引", "每份原文件分配证据ID，并在对应数据行填写相同ID。", null, null, null],
  ["4", "整体回传", "不要删除或重命名工作表。将完整工作簿与证明材料一起上传。", null, null, null],
  ["5", "平台校验与确认", "Lumino 校验表结构、单位、期间、重复记录和证据关联。用户确认后才进入计算。", null, null, null],
];
guide.getRange("B6:F10").merge(true);
guide.getRange("A6:F10").format = { font: { name: fontFamily, size: 10, color: colors.ink }, verticalAlignment: "center", wrapText: true, borders: { insideHorizontal: { style: "thin", color: colors.line } } };
guide.getRange("A6:A10").format = { fill: colors.yellowSoft, font: { name: fontFamily, size: 10, bold: true, color: "#765A00" }, horizontalAlignment: "center", verticalAlignment: "center" };
guide.getRange("A6:F10").format.rowHeight = 34;
guide.getRange("A12:F12").merge();
guide.getRange("A12").values = [["填写规则"]];
guide.getRange("A12:F12").format = { fill: colors.mint, font: { name: fontFamily, size: 10, bold: true, color: colors.green } };
guide.getRange("A13:F17").values = [
  ["必填", "记录ID、对象名称、数量、单位、数据期间 / 路线、数据来源和证据ID。", null, null, null, null],
  ["单位", "保持原始计量单位，不要自行换算。平台将在确认后统一换算并保留原值。", null, null, null, null],
  ["缺失", "不知道的字段留空，不要填 0；真实的零值可以填写 0。", null, null, null, null],
  ["估算", "必须标明估算方法和依据。Agent 的估算只会作为待确认建议。", null, null, null, null],
  ["证据", "原文件应保持原貌。转换表、截图或汇总表不能替代原始账单和台账。", null, null, null, null],
];
guide.getRange("B13:F17").merge(true);
guide.getRange("A13:F17").format = { font: { name: fontFamily, size: 10, color: colors.ink }, verticalAlignment: "center", wrapText: true, borders: { insideHorizontal: { style: "thin", color: colors.line } } };
guide.getRange("A13:A17").format.font = { name: fontFamily, size: 10, bold: true, color: colors.ink };
guide.getRange("A19:F19").merge();
guide.getRange("A19").values = [["方法依据"]];
guide.getRange("A19:F19").format = { fill: colors.mint2, font: { name: fontFamily, size: 10, bold: true, color: colors.ink } };
guide.getRange("A20:F22").values = [
  ["ISO 14067:2018", "产品碳足迹量化与报告原则、要求和指南", "https://www.iso.org/standard/71206.html", null, null, null],
  ["GHG Protocol Product Standard", "产品全生命周期温室气体清单与报告框架", "https://ghgprotocol.org/product-standard", null, null, null],
  ["PACT Pathfinder Framework 2.0", "产品碳足迹核算与可互操作数据交换字段", "https://wbcsd.github.io/tr/methodology/2.0/framework.pdf", null, null, null],
];
guide.getRange("C20:F22").merge(true);
guide.getRange("A20:F22").format = { font: { name: fontFamily, size: 9, color: colors.ink }, verticalAlignment: "center", wrapText: true, borders: { insideHorizontal: { style: "thin", color: colors.line } } };
guide.getRange("C20:C22").format.font = { name: fontFamily, size: 9, color: colors.green, underline: "single" };
[18, 26, 28, 18, 18, 18].forEach((width, index) => guide.getRangeByIndexes(0, index, 26, 1).format.columnWidth = width);

// Cross-sheet formulas are added only after every referenced worksheet exists.
overview.getRange("D6:D12").formulas = [
  ["=COUNTA('产品与边界'!B6:B19)"],
  ["=COUNTA('原材料'!B6:B55)"],
  ["=COUNTA('能源与过程'!B6:B55)"],
  ["=COUNTA('运输'!B6:B55)"],
  ["=COUNTA('产量与分配'!B6:B55)"],
  ["=COUNTA('废弃物'!B6:B55)"],
  ["=COUNTA('供应商PCF'!B6:B55)"],
];
overview.getRange("E6:E12").formulas = [
  ["=IF(D6>=8,\"已填写\",\"待补充\")"],
  ["=IF(D7=0,\"待填写\",\"已填写\")"],
  ["=IF(D8=0,\"待填写\",\"已填写\")"],
  ["=IF(D9=0,\"待填写\",\"已填写\")"],
  ["=IF(D10=0,\"待填写\",\"已填写\")"],
  ["=IF(D11=0,\"待填写\",\"已填写\")"],
  ["=IF(D12=0,\"按需填写\",\"已填写\")"],
];

workbook.recalculate();
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const overviewCheck = await workbook.inspect({
  kind: "table",
  range: "数据清单!A2:G14",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 8,
});
console.log(overviewCheck.ndjson);

const errorCheck = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "PCF template formula error scan",
});
console.log(errorCheck.ndjson);

for (const [sheetName, filename] of [
  ["数据清单", "overview.png"],
  ["产品与边界", "scope.png"],
  ["原材料", "materials.png"],
  ["能源与过程", "energy.png"],
  ["运输", "transport.png"],
  ["产量与分配", "allocation.png"],
  ["废弃物", "waste.png"],
  ["供应商PCF", "supplier-pcf.png"],
  ["证据索引", "evidence.png"],
  ["填报说明", "guide.png"],
]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, filename), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`Saved ${outputPath}`);
