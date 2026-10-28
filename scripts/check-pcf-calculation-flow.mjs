import { mkdir, writeFile } from "node:fs/promises";

const cdpPort = process.argv[2] || "9223";
const origin = process.argv[3] || "http://127.0.0.1:4173";
const outputDir = new URL("../outputs/review/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
const issues = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") issues.push(`exception: ${message.params.exceptionDetails.text}`);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    issues.push(`console: ${message.params.args.map((item) => item.value || item.description || "").join(" ")}`);
  }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = ++id;
  pending.set(messageId, { resolve, reject });
  socket.send(JSON.stringify({ id: messageId, method, params }));
});
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { returnByValue: true, awaitPromise: true, expression });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

await call("Page.enable");
await call("Runtime.enable");
await call("Page.navigate", { url: `${origin}/apps/portal/?demoRole=customer_owner` });
for (let attempt = 0; attempt < 30; attempt += 1) {
  await sleep(150);
  if ((await evaluate("document.readyState")) === "complete") break;
}
await sleep(400);

await evaluate(`(() => {
  const actor = { actor: '周岚', role: 'customer_owner' };
  const declaration = LuminoPcfDeclaration.confirm(LuminoPcfDeclaration.defaultsForProduct({ id: 'PRD-HRC-01', name: '热轧非合金钢卷' }), actor);
  declaration.geography = '上海';
  declaration.periodEnd = '2026-09-30';
  const boundary = LuminoPcfBoundary.confirm(LuminoPcfBoundary.suggest(declaration).proposal, actor);
  const factors = LuminoPcfFactors.confirm(LuminoPcfFactors.defaultSet({ declaration, facilityGeography: '上海' }), actor);
  const inventory = LuminoPcfCalculation.buildDemoInventory({ factors, power: { versionId: 'REC-HX-POWER-2026Q3@1' } });
  const calculation = LuminoPcfCalculation.buildResult({ declaration, boundary, factors, inventory, inputMode: 'demo_seed', formalUseAllowed: false, runId: 'ARUN-PCF-BROWSER', snapshotId: 'SNAP-PCF-BROWSER' });
  const powerBinding = assetRegistry.bindings({ id: 'BIND-REC-POWER-PCF' })[0];
  if (powerBinding && ['PROPOSED', 'PENDING_CONFIRMATION'].includes(powerBinding.status)) {
    assetRegistry.confirmBinding(powerBinding.id, { actor: '周岚', role: 'customer_owner', reason: '浏览器计算回归准备' });
  }
  workflowEngine.reset();
  workflowEngine.seed([{ id: 'PCF-2026-001', type: 'serviceCase', status: 'EXPERT_REVIEW', owner: '周岚', year: '2026', scope: declaration.productName, metadata: { serviceId: 'pcf', declaration, boundary, factors, calculation } }]);
  state.currentService = 'pcf';
  state.page = 'pcf-results';
  render();
  return calculation.total;
})()`);
await sleep(300);

async function inspect(width, height) {
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 520, screenWidth: width, screenHeight: height });
  await evaluate("render()");
  await sleep(150);
  return evaluate(`(() => {
    const ledger = document.querySelector('#pcfLedgerTitle')?.closest('section');
    return {
      title: document.title,
      heading: document.querySelector('#main h1')?.textContent || '',
      total: document.querySelector('.pcf-result-total strong')?.textContent || '',
      lineRows: ledger?.querySelectorAll('tbody tr').length || 0,
      stageRows: document.querySelector('.pcf-result-detail tbody')?.querySelectorAll('tr').length || 0,
      usesRecommendedFactor: Boolean(ledger && /EF-PURCHASED-ELECTRICITY/.test(ledger.textContent)),
      demoBoundaryVisible: /\u4e0d\u53ef\u6b63\u5f0f\u62ab\u9732/.test(document.querySelector('#main')?.textContent || ''),
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  })()`);
}

const desktop = await inspect(1440, 1000);
const mobile = await inspect(390, 844);
const report = {
  desktop,
  mobile,
  issues: [...new Set(issues)],
  pass: desktop.lineRows === 6
    && desktop.stageRows === 6
    && desktop.usesRecommendedFactor
    && desktop.demoBoundaryVisible
    && !desktop.horizontalOverflow
    && !mobile.horizontalOverflow
    && issues.length === 0,
};
await writeFile(new URL("pcf-calculation-flow-audit.json", outputDir), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
if (!report.pass) process.exitCode = 1;
