import { createCalculator } from "./engine.mjs";
import { precursorContribution } from "./precursor.mjs";
import { publishedQuarterMean, resolveCertificatePrice, CERTIFICATE_PRICE_SOURCE } from "./certificate-prices.mjs";
import {
  computeRealtimeCost,
  computeCarbonSensitivity,
  computeUnitCostTrend,
  computeAllowanceCostTrend,
} from "./realtime-cost.mjs";

const DATA_ROOT = "/calculator/data";
const sectorLabels = {
  "Iron and Steel": "钢铁",
  Aluminium: "铝",
  Cement: "水泥",
  Fertiliser: "化肥",
  Hydrogen: "氢",
};

const SCENARIOS = [
  {
    id: "pure_actual",
    label: "行业参考",
    desc: "成品工序与前体均为行业参考估算",
  },
  {
    id: "mixed",
    label: "混合",
    desc: "成品工序行业估算 + 前体官方默认",
  },
  {
    id: "pure_default",
    label: "纯默认",
    desc: "成品官方默认（不含前体附加）",
  },
];

const $ = (selector, root = document) => root.querySelector(selector);
const money = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

let calculator;
let data;
let latest;
let resultTab = "default"; // default | scenarios
let scenarioId = "pure_actual";
let defaultBasis = null;
let actualBasis = null;
let precursors = [];
let precursorError = "";
let noPrecursorReason = "";
let aiRunning = false;
let aiReady = false;
let leadPurpose = "review";
const aiAccessByCn = new Map();
let precursorReqId = 0;
const precursorCache = new Map();
let lastPrecursorProductKey = "";

async function loadData() {
  const names = ["parameters", "cn-codes", "benchmarks", "default-values", "actual-values", "actual-full", "cn-description-zh", "data-version"];
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

  const zhByCode = new Map(
    data.cndescriptionzh
      .filter((item) => item.cnCode)
      .map((item) => [String(item.cnCode), item.zh])
  );
  const zhByEnglish = new Map(
    data.cndescriptionzh.map((item) => [item.en.replace(/\s+/g, " ").trim(), item.zh])
  );
  data.cnCodesLocalized = data.cncodes.map((item) => ({
    ...item,
    zh:
      item.zh ||
      zhByCode.get(item.cnCode) ||
      zhByEnglish.get(item.description.replace(/\s+/g, " ").trim()) ||
      item.description.replace(/\s+/g, " "),
  }));
  renderDataVersion();
  renderCertificatePrices();
  initializeForm();
}

function renderCertificatePrices() {
  const prices = data.parameters.certificatePrices2026;
  const mean = publishedQuarterMean(data.parameters);
  const select = $("#priceQuarter");
  select.replaceChildren(new Option(`已公布季度算术均价 €${mean.toFixed(2)}`, "average"));
  for (const entry of prices) {
    if (entry.price != null) select.add(new Option(`2026 ${entry.quarter} €${entry.price.toFixed(2)}`, entry.quarter));
  }
  $("#certificatePrices").innerHTML = `<strong>2026 欧盟证书价格</strong><div>${prices.map((entry) =>
    `<span>${entry.quarter} <b>${entry.price == null ? "待公布" : `€${entry.price.toFixed(2)}`}</b></span>`
  ).join("")}</div><small>已公布季度算术均价 €${mean.toFixed(2)}；仅为本站年度估算口径，不是欧盟公布的独立价格。<a href="${CERTIFICATE_PRICE_SOURCE}" target="_blank" rel="noopener noreferrer">欧委会来源 ↗</a></small>`;
}

function renderDataVersion() {
  const meta = data.dataversion;
  if (!meta) return;
  const sidebar = $("#dataVersion");
  if (sidebar) {
    sidebar.textContent = `${meta.label} · ${meta.regulation} · Excel ${meta.excelPublished}`;
  }
  const cite = $("#dataCite");
  if (cite) {
    cite.textContent = `${meta.label} · 欧委会实施条例${meta.regulation}；信息用 Excel 发布日 ${meta.excelPublished}（文件版本 ${meta.excelVersion}）。${meta.note}`;
  }
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
  sector.addEventListener("change", () => {
    populateProducts();
    invalidateProduct();
  });
  $("#cnCode").addEventListener("change", invalidateProduct);
  $("#productionRoute").addEventListener("input", () => {
    ++precursorReqId;
    resetAiState();
  });
  $("#year").addEventListener("change", () => { invalidateProduct(); updatePriceChoice(); });
  $("#priceQuarter").addEventListener("change", () => {
    updateParameterSummary();
    if (!latest) return;
    const input = readInput();
    latest = calculator.compare(input);
    defaultBasis = calculator.buildCostBasis({ ...input, source: "default" });
    if (aiReady) actualBasis = calculator.buildCostBasis({ ...input, source: "actualEstimate" });
    refreshDisplay();
  });
  $("#openLead").addEventListener("click", onAiCtaClick);
  $("#contactAdvisor").addEventListener("click", () => openLeadModal("review"));
  $("#closeLead").addEventListener("click", closeLeadModal);
  $("#leadDialog").addEventListener("click", (event) => {
    if (event.target === $("#leadDialog")) closeLeadModal();
  });
  $("#leadForm").addEventListener("submit", submitLead);
  $("#retry").addEventListener("click", () => $("#calculatorForm").requestSubmit());
  $("#resultTabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tab]");
    if (!button || !aiReady) return;
    setResultTab(button.dataset.tab);
  });
  $("#scenarioGrid")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-scenario]");
    if (!card || card.disabled) return;
    scenarioId = card.dataset.scenario;
    refreshDisplay();
  });
  $("#precursorReview")?.addEventListener("change", (event) => {
    const index = Number(event.target.dataset.precursorIndex);
    if (!Number.isInteger(index) || !precursors[index]) return;
    const consumption = Number(event.target.value);
    if (!(consumption > 0 && consumption <= 10)) {
      event.target.value = String(precursors[index].consumption);
      showError("前体消耗量须大于 0 且不超过 10 吨/吨。");
      return;
    }
    clearError();
    precursors[index].consumption = consumption;
    refreshDisplay();
  });
  ["#quantity", "#carbonPrice", "#freeAllocation"].forEach((selector) => {
    $(selector).addEventListener("input", () => {
      updateParameterSummary();
      if (latest) refreshDisplay();
    });
  });
  updateParameterSummary();
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
    exchangeRate: data.parameters.exchangeRate,
    priceQuarter: $("#year").value === "2026" ? $("#priceQuarter").value : "average",
    productionRoute: $("#productionRoute").value.trim(),
    source: "default",
  };
}

function readControls() {
  const input = readInput();
  return {
    quantity: input.quantity,
    exchangeRate: input.exchangeRate,
    carbonPricePaid: input.carbonPricePaid,
    freeAllocationEnabled: input.freeAllocationEnabled,
  };
}

function updateParameterSummary() {
  const qty = $("#quantity").value || "1";
  const priceText = $("#priceQuarter").selectedOptions[0]?.textContent || "已公布季度均价";
  const euro = priceText.match(/€[\d.]+/)?.[0];
  const priceLabel = euro
    ? (priceText.includes("均价") ? `${euro} 均价` : euro)
    : priceText.replace(/^已公布季度算术?均价\s*/, "均价 ");
  $("#summaryQty").textContent = `${qty} 吨`;
  $("#summaryPrice").textContent = priceLabel;
  $("#summaryCarbon").textContent = `¥${$("#carbonPrice").value || "0"}`;
}

function productKey(input = readInput()) {
  return `${input.cnCode}|${input.country}|${input.year}|${input.productionRoute}`;
}

function resetAiState() {
  resultTab = "default";
  scenarioId = "pure_actual";
  actualBasis = null;
  precursors = [];
  precursorError = "";
  noPrecursorReason = "";
  aiReady = false;
  $("#openLead").hidden = false;
  hideAiOverlay();
  const tabs = $("#resultTabs");
  const board = $("#scenarioBoard");
  if (tabs) tabs.hidden = true;
  if (board) board.hidden = true;
  $(".summary-total")?.classList.remove("is-actual");
}

function invalidateProduct() {
  ++precursorReqId;
  latest = null;
  defaultBasis = null;
  resetAiState();
  $("#resultState").hidden = true;
  $("#emptyState").hidden = false;
}

function updatePriceChoice() {
  const select = $("#priceQuarter");
  const future = $("#year").value !== "2026";
  if (future) select.value = "average";
  select.disabled = future;
  updateParameterSummary();
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
    defaultBasis = calculator.buildCostBasis({ ...input, source: "default" });
    resetAiState();
    const cached = precursorCache.get(productKey(input));
    if (cached) {
      precursors = cached.precursors;
      noPrecursorReason = cached.noPrecursorReason;
      actualBasis = calculator.buildCostBasis({ ...input, source: "actualEstimate" });
      aiReady = true;
      resultTab = "scenarios";
      $("#openLead").hidden = true;
    }
    refreshDisplay();
  } catch (error) {
    showError(error.message || "计算失败，请检查输入。");
  }
}

function precursorAdds(source) {
  // SEE 附加：随情景口径切换（实测 estimate / 混合 default）。
  const addition = precursors.reduce(
    (sum, item) => sum + precursorContribution(item, source),
    0,
  );
  // Industry reference scenarios use the published precursor Column B proxy.
  // Final-product Column B must never be used as a floor for a complex good.
  const bmAddition = precursors.reduce(
    (sum, item) => sum + (item.benchmarkB ?? 0) * (item.consumption || 0),
    0,
  );
  return { addition, bmAddition };
}

function costForScenario(id) {
  const controls = readControls();
  if (!defaultBasis) return null;
  if (id === "pure_default") {
    return {
      cost: computeRealtimeCost(defaultBasis, controls, 0, 0),
      basis: defaultBasis,
      addition: 0,
      bmAddition: 0,
      source: "default",
    };
  }
  if (!actualBasis) return null;
  if (id === "mixed" && !precursors.length) return null;
  const source = id === "mixed" ? "default" : "estimate";
  const { addition, bmAddition } = precursorAdds(source);
  return {
    cost: computeRealtimeCost(actualBasis, controls, addition, bmAddition),
    basis: actualBasis,
    addition,
    bmAddition,
    source,
  };
}

function activeBundle() {
  if (resultTab === "scenarios" && aiReady) {
    return costForScenario(scenarioId);
  }
  if (!defaultBasis) return null;
  return {
    cost: computeRealtimeCost(defaultBasis, readControls(), 0, 0),
    basis: defaultBasis,
    addition: 0,
    bmAddition: 0,
    source: "default",
  };
}

function setResultTab(tab) {
  if (tab === "scenarios" && !aiReady) return;
  resultTab = tab;
  refreshDisplay();
}

function scenarioLabel(id) {
  return SCENARIOS.find((item) => item.id === id)?.label || id;
}

function refreshDisplay() {
  if (!latest || !defaultBasis) return;
  const bundle = activeBundle();
  if (!bundle?.cost) return;
  const { cost, basis, addition, bmAddition } = bundle;
  const compare = computeRealtimeCost(defaultBasis, readControls(), 0, 0);

  $("#emptyState").hidden = true;
  $("#resultState").hidden = false;
  $("#resultState").classList.remove("result-enter");
  requestAnimationFrame(() => $("#resultState").classList.add("result-enter"));

  const tabs = $("#resultTabs");
  const board = $("#scenarioBoard");
  if (tabs) {
    tabs.hidden = !aiReady;
    tabs.querySelectorAll("button[data-tab]").forEach((node) => {
      const on = node.dataset.tab === resultTab;
      node.classList.toggle("is-on", on);
      node.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  if (board) board.hidden = !(aiReady && resultTab === "scenarios");
  $("#openLead").hidden = aiReady;
  if (aiReady && resultTab === "scenarios") renderScenarioBoard();

  const summary = $(".summary-total");
  const isScenario = resultTab === "scenarios" && aiReady;
  summary.classList.toggle("is-actual", isScenario && scenarioId !== "pure_default");
  const label = summary.querySelector("p");
  if (isScenario) {
    label.innerHTML = `预计 CBAM 成本 <span>· ${scenarioLabel(scenarioId)}</span>`;
  } else {
    label.innerHTML = `预计 CBAM 成本 <span>· 默认值（含加价）</span>`;
  }

  $("#totalCost").textContent = `¥${money.format(cost.totalCostLocal)}`;
  let compareHtml = "";
  if (isScenario && scenarioId !== "pure_default" && compare) {
    const saving = Math.max(0, compare.totalCostLocal - cost.totalCostLocal);
    const rate = compare.totalCostLocal > 0
      ? Math.round(Math.max(0, 1 - cost.totalCostLocal / compare.totalCostLocal) * 100)
      : 0;
    compareHtml = `<span class="compare-note">相对纯默认 ¥${money.format(compare.totalCostLocal)}${saving > 0 ? ` · 约低 ${rate}%` : ""}</span>`;
  }
  let assumption = $("#assumption");
  if (!assumption) {
    assumption = document.createElement("small");
    assumption.id = "assumption";
    summary.appendChild(assumption);
  }
  const ver = data.dataversion;
  const cite = ver ? `默认值依据 ${ver.regulation}。` : "";
  const resultMeta = isScenario && scenarioId !== "pure_default" && actualBasis
    ? actualBasis
    : latest.defaultResult;
  const price = resolveCertificatePrice(data.parameters, readInput().year, readInput().priceQuarter);
  assumption.innerHTML = `按 €${price.toFixed(2)}/张（${readInput().year === 2026 && readInput().priceQuarter !== "average" ? `2026 ${readInput().priceQuarter}` : "2026 已公布季度均价参考"}）、汇率 ${data.parameters.exchangeRate}、${readInput().year} 年免费配额退坡因子试算。${cite}${compareHtml}`;

  $("#unitCost").textContent = `¥${decimal.format(cost.unitCostLocal)} / 吨`;
  $("#certificates").textContent = decimal.format(cost.payableCertificates);
  $("#freeQuota").textContent = decimal.format(cost.sefaApplied * readControls().quantity);
  $("#see").textContent = decimal.format(cost.effectiveSee);
  $("#netEmission").textContent = decimal.format(cost.netEmissionPerTon);

  $("#savingPreview").textContent = "查看三种行业参考情景";

  const indirect = resultMeta.indirectForReport || 0;
  $("#scopeNotice").hidden = !indirect;
  if (indirect) {
    $("#scopeNotice").textContent = `该品类约 ${decimal.format(indirect)} tCO₂e/t 间接排放未计入本次成本，但申报口径仍需关注。`;
  }

  const input = readInput();
  const projectParams = new URLSearchParams({
    source: "calculator",
    year: String(input.year),
    cnCode: input.cnCode,
    sector: latest.defaultResult.info.sector,
    quantity: String(input.quantity),
    estimatedCostCny: String(Math.round(cost.totalCostLocal)),
  });
  $("#projectCta").href = `/apps/portal?${projectParams.toString()}`;

  renderCharts(cost, basis, addition, bmAddition);
  $("#exemptNotice").hidden = !(input.quantity <= data.parameters.deMinimisThreshold);
}

function renderScenarioBoard() {
  const grid = $("#scenarioGrid");
  const note = $("#scenarioNote");
  if (!grid) return;

  if (scenarioId === "mixed" && !precursors.length) scenarioId = "pure_actual";
  grid.innerHTML = SCENARIOS.map((item) => {
    const unavailable = item.id === "mixed" && !precursors.length;
    const bundle = costForScenario(item.id);
    const cost = bundle?.cost;
    const on = scenarioId === item.id;
    return `<button type="button" class="scenario-card ${on ? "is-on" : ""}" data-scenario="${item.id}" role="option" aria-selected="${on}" ${unavailable ? "disabled" : ""}>
      <span class="sc-label">${item.label}</span>
      <span class="sc-desc">${unavailable ? (noPrecursorReason === "upstream" ? "已是当前 CBAM 链的最上游产品，无法使用混合方式测算" : "未识别到可用的 CBAM 前体，无法使用混合方式测算") : item.desc}</span>
      <span class="sc-cost">${cost ? `¥${money.format(cost.totalCostLocal)}` : "—"}</span>
      <span class="sc-see">${cost ? `净排放 ${decimal.format(cost.netEmissionPerTon)} tCO₂e/t · SEE ${decimal.format(cost.effectiveSee)}` : ""}</span>
    </button>`;
  }).join("");

  if (note) {
    if (precursorError) {
      note.textContent = precursorError;
    } else if (precursors.length) {
      const names = precursors
        .map((item) => `${item.name || item.cnCode}（${item.cnCode}，${decimal.format(item.consumption)} 吨/吨；默认 ${decimal.format(item.defaultValue)}、行业估算 ${decimal.format(item.estimateValue)} tCO₂e/吨）`)
        .join("、");
      const mappings = precursors.filter((item) => item.mappedFrom)
        .map((item) => `${item.mappedFrom} → ${item.cnCode}`).join("、");
      note.textContent = `已自动计入前体：${names}。${mappings ? `模型细码未收录，使用同类等值参数映射：${mappings}；具体商品归类仍需核实。` : ""}行业参考估算，非企业法定实测值。`;
    } else {
      note.textContent = noPrecursorReason === "upstream"
        ? "欧委会钢铁行业指南将烧结矿列为无相关 CBAM 前体；行业参考仅估算本品生产排放。"
        : "模型未识别到受 CBAM 管控的直接前体；请核实实际生产路线。";
    }
  }
  const review = $("#precursorReview");
  if (review) review.innerHTML = precursors.length
    ? `<strong>前体消耗量假设（吨前体 / 吨成品，可按实际工艺调整）</strong>${precursors.map((item, index) =>
      `<label><span>${escapeHtml(item.name || item.cnCode)} · ${item.cnCode}</span><input type="number" min="0.001" max="10" step="0.001" value="${item.consumption}" data-precursor-index="${index}" aria-label="${escapeHtml(item.name || item.cnCode)}的前体消耗量"></label>`
    ).join("")}` : "";
}

function renderCharts(cost, basis, addition, bmAddition) {
  const controls = readControls();
  const grossCost = cost.effectiveSee * controls.quantity * basis.certificatePrice * controls.exchangeRate;
  const deducted = Math.max(0, grossCost - cost.totalCostLocal);
  const costs = [grossCost, deducted, cost.totalCostLocal];
  const maxCost = Math.max(...costs, 1);
  [
    ["#costGrossBar", "#costGrossLabel", grossCost],
    ["#costDeductBar", "#costDeductLabel", deducted],
    ["#costNetBar", "#costNetLabel", cost.totalCostLocal],
  ].forEach(([bar, label, value]) => {
    $(bar).style.height = `${Math.max(3, value / maxCost * 88)}%`;
    $(label).textContent = shortMoney(value);
  });

  const totalEmissions = Math.max(cost.effectiveSee * controls.quantity, 0.01);
  const freeEmissions = Math.max(0, cost.sefaApplied * controls.quantity);
  const freeShare = Math.min(100, freeEmissions / totalEmissions * 100);
  $("#emissionDonut").style.setProperty("--free", `${freeShare}%`);
  $("#donutTotal").textContent = decimal.format(totalEmissions);
  $("#emissionStack").style.height = `${Math.max(5, cost.netEmissionPerTon / Math.max(cost.effectiveSee, 0.01) * 92)}%`;

  const allowance = computeAllowanceCostTrend(basis, controls, bmAddition);
  const maxSaving = Math.max(...allowance.map((item) => item.allowanceValue), 1);
  $("#allocationBars").innerHTML = allowance.map((item) =>
    `<div class="timeline-item" title="${item.year}: ¥${money.format(item.allowanceValue)}"><i style="height:${Math.max(1, item.allowanceValue / maxSaving * 92)}%"></i><span>${item.year}</span></div>`
  ).join("");

  const sensitivity = computeCarbonSensitivity(basis, controls, {}, addition, bmAddition);
  renderLineChart(
    "#sensitivityChart",
    sensitivity.map((item) => item.carbonPrice),
    sensitivity.map((item) => item.unitCostLocal),
    "¥",
  );
  const trend = computeUnitCostTrend(basis, controls, addition, bmAddition);
  renderLineChart(
    "#yearTrendChart",
    trend.map((item) => item.year),
    trend.map((item) => item.unitCostLocal),
    "¥",
  );
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
  const grid = [0, 0.33, 0.66, 1].map((ratio) => {
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

function showAiOverlay() {
  const overlay = $("#aiOverlay");
  if (!overlay) return;
  overlay.hidden = false;
  document.body.classList.add("modal-open");
}

function hideAiOverlay() {
  const overlay = $("#aiOverlay");
  if (overlay) overlay.hidden = true;
  if ($("#leadDialog")?.hidden !== false) {
    document.body.classList.remove("modal-open");
  }
}

async function onAiCtaClick() {
  if (!latest || aiRunning) return;
  if (!aiAccessByCn.has(readInput().cnCode)) {
    openLeadModal("ai");
    return;
  }
  await runAiEstimate();
}

function openLeadModal(purpose = "review") {
  if (!latest) return;
  leadPurpose = purpose;
  $("#leadEyebrow").textContent = purpose === "ai" ? "AI PRECURSOR ESTIMATE" : "REQUEST HUMAN REVIEW";
  $("#leadTitle").textContent = purpose === "ai" ? "留下线索，获取 AI 推算" : "申请人工复核";
  $("#leadIntro").textContent = purpose === "ai"
    ? "提交并确认保存联系方式后，将为当前 CN Code 推算前体和行业参考情景。"
    : "留下联系方式，供我们就当前 CBAM 试算与前体假设联系您。";
  $("#leadSubmit").textContent = purpose === "ai" ? "提交并开始推算" : "提交咨询";
  $("#leadStatus").textContent = "";
  $("#leadStatus").className = "form-status";
  $("#leadDialog").hidden = false;
  document.body.classList.add("modal-open");
  $("#leadCompany").focus();
}

function closeLeadModal() {
  $("#leadDialog").hidden = true;
  if ($("#aiOverlay")?.hidden !== false) {
    document.body.classList.remove("modal-open");
  }
  $("#openLead").focus();
}

async function submitLead(event) {
  event.preventDefault();
  const formEl = event.currentTarget;
  const button = $("#leadSubmit");
  const status = $("#leadStatus");
  const form = new FormData(formEl);
  const purpose = leadPurpose;
  const submittedCn = readInput().cnCode;
  const submittedKey = productKey();
  button.disabled = true;
  button.textContent = "正在提交…";
  status.textContent = "";
  status.className = "form-status";
  const cost = activeBundle()?.cost;
  const input = readInput();
  const defaultCost = defaultBasis ? computeRealtimeCost(defaultBasis, readControls()) : null;
  const context = latest ? {
    year: input.year,
    cnCode: input.cnCode,
    sector: latest.defaultResult.info.sector,
    quantity: input.quantity,
    estimatedCostCny: defaultCost?.totalCostLocal,
    estimatedUnitCostCny: defaultCost?.unitCostLocal,
    actualEstimateCny: cost?.totalCostLocal,
  } : null;
  const noteText = context
    ? `CBAM 试算${purpose === "ai" ? "AI 推算申请" : "人工复核咨询"}：${context.sector || ""} CN ${context.cnCode || ""} · ${context.quantity || ""} t · 估算 ¥${context.estimatedCostCny ?? "—"}`
    : `CBAM 试算人工复核咨询 · CN ${input.cnCode || "—"}`;

  const finishLead = async ({ detail = "" } = {}) => {
    button.disabled = false;
    button.textContent = purpose === "ai" ? "提交并开始推算" : "提交咨询";
    try {
      formEl?.reset?.();
    } catch { /* ignore */ }
    closeLeadModal();
    $("#consultationStatus").textContent = detail || "咨询已记录。";
  };

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
        requestType: purpose === "ai" ? "calculator-ai" : "service-consultation",
        note: noteText,
        context,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.data?.persisted === true && payload.data?.leadId) {
      if (purpose === "ai" && !payload.data.aiAccessToken) throw new Error("线索已保存，但 AI 授权未返回，请联系人工处理。");
      if (payload.data.aiAccessToken) aiAccessByCn.set(submittedCn, payload.data.aiAccessToken);
      const leadHint = payload.data?.leadId
        ? `编号 ${payload.data.leadId}。`
        : "";
      const notifyHint = payload.data?.notified ? "已通知对接人。" : "";
      await finishLead({
        detail: `咨询已记录。${leadHint}${notifyHint}`.trim(),
      });
      if (purpose === "ai") {
        if (latest && productKey() === submittedKey) await runAiEstimate();
      }
      return;
    }
    throw new Error(payload.error?.message || payload.error || payload.message || "线索未确认写入，请稍后重试");
  } catch (error) {
    status.innerHTML = `${escapeHtml(error.message || "提交失败")} <a href="../contact.html">改用预约诊断 →</a>`;
    status.classList.add("error");
    button.disabled = false;
    button.textContent = purpose === "ai" ? "重新提交并推算" : "重新提交咨询";
  }
}

async function runAiEstimate() {
  if (!latest || aiRunning) return;
  aiRunning = true;
  clearError();
  showAiOverlay();
  $("#openLead").disabled = true;
  precursorError = "";

  const input = readInput();
  try {
    actualBasis = calculator.buildCostBasis({ ...input, source: "actualEstimate" });
  } catch (error) {
    showError(error.message || "无法构建成品工序参考估算");
    hideAiOverlay();
    $("#openLead").disabled = false;
    aiRunning = false;
    return;
  }

  const fetched = await fetchPrecursors(input);
  if (!fetched || productKey() !== productKey(input)) {
    if (precursorError) showError(precursorError);
    hideAiOverlay();
    $("#openLead").disabled = false;
    aiRunning = false;
    return;
  }
  aiReady = true;
  resultTab = "scenarios";
  scenarioId = "pure_actual";
  hideAiOverlay();
  $("#openLead").disabled = false;
  aiRunning = false;
  refreshDisplay();
  $("#scenarioBoard")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function fetchPrecursors(input) {
  const key = productKey(input);
  if (key !== lastPrecursorProductKey) {
    precursors = [];
  }
  lastPrecursorProductKey = key;

  if (precursorCache.has(key)) {
    const cached = precursorCache.get(key);
    precursors = cached.precursors;
    noPrecursorReason = cached.noPrecursorReason;
    return true;
  }

  const reqId = ++precursorReqId;
  try {
    const response = await fetch("/api/precursors", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-calculator-ai-token": aiAccessByCn.get(input.cnCode) || "" },
      body: JSON.stringify({
        cnCode: input.cnCode,
        country: input.country,
        year: input.year,
        productionRoute: input.productionRoute,
        productDesc: latest?.defaultResult?.info?.zh || latest?.defaultResult?.info?.description,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (reqId !== precursorReqId) return false;
    if (!response.ok) {
      precursors = [];
      if (response.status === 403) aiAccessByCn.delete(input.cnCode);
      precursorError = payload.error || "前体推测失败，请重试。";
      return false;
    }
    if (!Array.isArray(payload.precursors)) throw new Error("前体服务返回格式无效");
    precursors = payload.precursors;
    noPrecursorReason = payload.meta?.noPrecursorReason || "";
    precursorCache.set(key, { precursors, noPrecursorReason });
    if (!precursors.length && !precursorError) {
      precursorError = "";
    }
    return true;
  } catch {
    if (reqId !== precursorReqId) return false;
    precursors = [];
    precursorError = "无法连接前体推测服务，请重试。";
    return false;
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
  $("#loadingState").innerHTML = `<h2>规则数据加载失败</h2><p>${escapeHtml(error.message || "请刷新重试")}</p>`;
  $("#retry").hidden = false;
});
