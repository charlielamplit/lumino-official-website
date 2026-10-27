import { createCalculator } from "./engine.mjs";

const DATA_ROOT = "./data";
const sectorLabels = {
  "Iron and Steel": "钢铁",
  Aluminium: "铝",
  Cement: "水泥",
  Fertiliser: "化肥",
  Hydrogen: "氢",
};

const $ = (selector, root = document) => root.querySelector(selector);
const money = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
let calculator;
let data;
let latest;

async function loadData() {
  const names = ["parameters", "cn-codes", "benchmarks", "default-values", "actual-values", "actual-full", "cn-description-zh"];
  const values = await Promise.all(
    names.map(async (name) => {
      const response = await fetch(`${DATA_ROOT}/${name}.json`);
      if (!response.ok) throw new Error(`无法加载 ${name}`);
      return response.json();
    })
  );
  data = Object.fromEntries(names.map((name, index) => [name.replaceAll("-", ""), values[index]]));
  calculator = createCalculator({
    parameters: data.parameters,
    cnCodes: data.cncodes,
    benchmarks: data.benchmarks,
    defaultValues: data.defaultvalues,
    actualValues: data.actualvalues,
    actualFull: data.actualfull,
  });

  const zhByEnglish = new Map(data.cndescriptionzh.map((item) => [item.en.replace(/\s+/g, " ").trim(), item.zh]));
  data.cnCodesLocalized = data.cncodes.map((item) => ({
    ...item,
    zh: zhByEnglish.get(item.description.replace(/\s+/g, " ").trim()) || item.description.replace(/\s+/g, " "),
  }));
  initializeForm();
}

function initializeForm() {
  const sector = $("#sector");
  [...new Set(data.cnCodesLocalized.map((item) => item.sector))]
    .filter(Boolean)
    .sort((a, b) => sectorLabels[a].localeCompare(sectorLabels[b], "zh-CN"))
    .forEach((value) => sector.add(new Option(sectorLabels[value], value)));

  sector.value = "Iron and Steel";
  populateProducts();
  $("#cnCode").selectedIndex = 1;
  $("#calculatorForm").addEventListener("submit", onCalculate);
  sector.addEventListener("change", populateProducts);
  $("#openLead").addEventListener("click", openLeadModal);
  $("#closeLead").addEventListener("click", closeLeadModal);
  $("#leadDialog").addEventListener("click", (event) => {
    if (event.target === $("#leadDialog")) closeLeadModal();
  });
  $("#leadForm").addEventListener("submit", submitLead);
  $("#retry").addEventListener("click", () => $("#calculatorForm").requestSubmit());
  ["#quantity", "#carbonPrice", "#freeAllocation"].forEach((selector) => {
    $(selector).addEventListener("input", () => {
      if (latest) calculateAndRender();
    });
  });
  $("#loadingState").hidden = true;
  $("#calculatorForm button[type=submit]").disabled = false;
}

function populateProducts() {
  const select = $("#cnCode");
  const sector = $("#sector").value;
  select.replaceChildren(new Option("请选择或输入 CN Code", ""));
  data.cnCodesLocalized
    .filter((item) => item.sector === sector)
    .sort((a, b) => a.cnCode.localeCompare(b.cnCode))
    .forEach((item) => select.add(new Option(`${item.cnCode}  ${item.zh}`, item.cnCode)));
}

function readInput() {
  return {
    year: Number($("#year").value),
    country: "China",
    cnCode: $("#cnCode").value,
    quantity: Number($("#quantity").value),
    carbonPricePaid: Number($("#carbonPrice").value),
    freeAllocationEnabled: $("#freeAllocation").checked,
    source: "default",
  };
}

function onCalculate(event) {
  event.preventDefault();
  calculateAndRender();
}

function calculateAndRender() {
  clearError();
  try {
    const input = readInput();
    if (!input.cnCode) throw new Error("请先选择 CN Code。");
    if (!(input.quantity > 0)) throw new Error("请输入大于 0 的年出口量。");
    latest = calculator.compare(input);
    renderResult(latest);
  } catch (error) {
    showError(error.message || "计算失败，请检查输入。");
  }
}

function renderResult(comparison) {
  const result = comparison.defaultResult;
  $("#emptyState").hidden = true;
  $("#resultState").hidden = false;
  $("#resultState").classList.remove("result-enter");
  requestAnimationFrame(() => $("#resultState").classList.add("result-enter"));
  $("#totalCost").textContent = `¥${money.format(result.totalCostLocal)}`;
  $("#unitCost").textContent = `¥${decimal.format(result.unitCostLocal)} / 吨`;
  $("#certificates").textContent = money.format(result.totalCertificates);
  $("#freeQuota").textContent = money.format(result.sefa * result.quantity);
  $("#see").textContent = decimal.format(result.see);
  $("#netEmission").textContent = decimal.format(result.netEmissionPerTon);
  $("#assumption").textContent = `按 €${result.certificatePrice}/张、汇率 ${result.exchangeRate}、${result.year} 年免费配额退坡因子试算。`;
  $("#savingPreview").textContent = comparison.potentialSaving > 0
    ? `实测路径可能带来约 ${comparison.savingRate}% 的成本差异`
    : "实测路径需结合供应链数据进一步判定";
  $("#scopeNotice").hidden = !result.indirectForReport;
  if (result.indirectForReport) {
    $("#scopeNotice").textContent = `该品类约 ${decimal.format(result.indirectForReport)} tCO₂e/t 间接排放未计入本次成本，但申报口径仍需关注。`;
  }

  const projectParams = new URLSearchParams({
    source: "calculator",
    year: String(result.year),
    cnCode: result.info.cnCode,
    sector: result.info.sector,
    quantity: String(result.quantity),
    estimatedCostCny: String(Math.round(result.totalCostLocal)),
  });
  $("#projectCta").href = `/portal/?${projectParams.toString()}`;

  renderCharts(comparison);
  $("#exemptNotice").hidden = !result.exempt;
  $("#openLead").focus({ preventScroll: true });
}

function renderCharts(comparison) {
  const result = comparison.defaultResult;
  const input = readInput();
  const grossCost = result.see * result.quantity * result.certificatePrice * result.exchangeRate;
  const deducted = Math.max(0, grossCost - result.totalCostLocal);
  const costs = [grossCost, deducted, result.totalCostLocal];
  const maxCost = Math.max(...costs, 1);
  [
    ["#costGrossBar", "#costGrossLabel", grossCost],
    ["#costDeductBar", "#costDeductLabel", deducted],
    ["#costNetBar", "#costNetLabel", result.totalCostLocal],
  ].forEach(([bar, label, value]) => {
    $(bar).style.height = `${Math.max(3, value / maxCost * 88)}%`;
    $(label).textContent = shortMoney(value);
  });

  const totalEmissions = Math.max(result.see * result.quantity, 0.01);
  const freeEmissions = Math.max(0, result.sefa * result.quantity);
  const freeShare = Math.min(100, freeEmissions / totalEmissions * 100);
  $("#emissionDonut").style.setProperty("--free", `${freeShare}%`);
  $("#donutTotal").textContent = money.format(totalEmissions);
  $("#emissionStack").style.height = `${Math.max(5, result.netEmissionPerTon / Math.max(result.see, .01) * 92)}%`;

  const years = Array.from({ length: 9 }, (_, index) => 2026 + index);
  const yearly = years.map((year) => calculator.calculate({ ...input, year, source: "default" }));
  const savings = years.map((year, index) => {
    const without = calculator.calculate({ ...input, year, source: "default", freeAllocationEnabled: false });
    return Math.max(0, without.totalCostLocal - yearly[index].totalCostLocal);
  });
  const maxSaving = Math.max(...savings, 1);
  $("#allocationBars").innerHTML = years.map((year, index) =>
    `<div class="timeline-item" title="${year}: ¥${money.format(savings[index])}"><i style="height:${Math.max(1, savings[index] / maxSaving * 92)}%"></i><span>${year}</span></div>`
  ).join("");

  const paidPrices = [0, 40, 80, 120, 160, 200];
  const sensitivity = paidPrices.map((carbonPricePaid) =>
    calculator.calculate({ ...input, carbonPricePaid, source: "default" }).unitCostLocal
  );
  renderLineChart("#sensitivityChart", paidPrices, sensitivity, "¥");
  renderLineChart("#yearTrendChart", years, yearly.map((item) => item.unitCostLocal), "¥");
}

function renderLineChart(selector, labels, values, prefix = "") {
  const width = 440;
  const height = 210;
  const pad = { left: 42, right: 12, top: 18, bottom: 26 };
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = pad.left + index / Math.max(1, values.length - 1) * (width - pad.left - pad.right);
    const y = pad.top + (max - value) / range * (height - pad.top - pad.bottom);
    return { x, y, value };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${pad.left},${height - pad.bottom} ${line} ${width - pad.right},${height - pad.bottom}`;
  const grid = [0, .33, .66, 1].map((ratio) => {
    const y = pad.top + ratio * (height - pad.top - pad.bottom);
    const value = max - ratio * range;
    return `<line class="grid" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/><text class="axis-label" x="2" y="${y + 3}">${prefix}${compact(value)}</text>`;
  }).join("");
  const xLabels = labels.map((label, index) => {
    if (labels.length > 6 && index % 2 && index !== labels.length - 1) return "";
    return `<text class="axis-label" text-anchor="middle" x="${points[index].x}" y="${height - 7}">${label}</text>`;
  }).join("");
  const dots = points.map((point) => `<circle class="point" cx="${point.x}" cy="${point.y}" r="3"><title>${prefix}${decimal.format(point.value)}</title></circle>`).join("");
  $(selector).innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e7c5a" stop-opacity=".22"/><stop offset="1" stop-color="#0e7c5a" stop-opacity="0"/></linearGradient></defs>${grid}<polygon class="area" points="${area}"/><polyline class="trend" points="${line}"/>${dots}${xLabels}</svg>`;
}

function compact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value);
}

function shortMoney(value) {
  return `¥${compact(value)}`;
}

function openLeadModal() {
  if (!latest) return;
  $("#leadDialog").hidden = false;
  document.body.classList.add("modal-open");
  $("#leadCompany").focus();
}

function closeLeadModal() {
  $("#leadDialog").hidden = true;
  document.body.classList.remove("modal-open");
  $("#openLead").focus();
}

async function submitLead(event) {
  event.preventDefault();
  const button = $("#leadSubmit");
  const status = $("#leadStatus");
  const form = new FormData(event.currentTarget);
  button.disabled = true;
  button.textContent = "正在提交…";
  status.textContent = "";
  status.className = "form-status";
  const context = latest ? {
    year: latest.defaultResult.year,
    cnCode: latest.defaultResult.info.cnCode,
    sector: latest.defaultResult.info.sector,
    quantity: latest.defaultResult.quantity,
    estimatedCostCny: latest.defaultResult.totalCostLocal,
    estimatedUnitCostCny: latest.defaultResult.unitCostLocal,
    potentialSavingCny: latest.potentialSaving,
  } : null;

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: form.get("company"),
        name: form.get("name"),
        phone: form.get("phone"),
        email: form.get("email"),
        consent: form.get("consent") === "on",
        source: "lumino-cbam-calculator",
        context,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "提交失败");

    status.textContent = "已收到。顾问将在一个工作日内联系你。";
    status.classList.add("success");
    $("#unlockedComparison").hidden = false;
    $("#actualCost").textContent = `¥${money.format(latest.actualResult.totalCostLocal)}`;
    $("#potentialSaving").textContent = `¥${money.format(latest.potentialSaving)}`;
    button.textContent = "已提交";
    event.currentTarget.reset();
    closeLeadModal();
    $("#unlockedComparison").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    status.innerHTML = `${escapeHtml(error.message || "提交失败")} <a href="../Lumino%20联系.dc.html">改用预约诊断 →</a>`;
    status.classList.add("error");
    button.disabled = false;
    button.textContent = "提交并查看实测对比";
  }
}

function showError(message) {
  $("#formError").textContent = message;
  $("#formError").hidden = false;
}

function clearError() {
  $("#formError").hidden = true;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

loadData().catch((error) => {
  $("#loadingState").hidden = true;
  showError(`试算数据加载失败：${error.message}`);
});
