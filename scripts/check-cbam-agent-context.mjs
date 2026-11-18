import { mkdir, writeFile } from "node:fs/promises";

const cdpPort = process.argv[2] || "9237";
const origin = process.argv[3] || "http://127.0.0.1:4174";
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
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") issues.push(`console: ${message.params.args.map((item) => item.value || item.description || "").join(" ")}`);
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) issues.push(`http ${message.params.response.status}: ${message.params.response.url}`);
});

const call = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = ++id;
  pending.set(messageId, { resolve, reject });
  socket.send(JSON.stringify({ id: messageId, method, params }));
});
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

await call("Page.enable");
await call("Runtime.enable");
await call("Network.enable");
await call("Network.setCacheDisabled", { cacheDisabled: true });
await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900 });

async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  return result.result.value;
}

async function click(selector) {
  const clicked = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  if (!clicked) throw new Error(`Unable to click ${selector}`);
  await sleep(180);
}

await call("Page.navigate", { url: `${origin}/portal/?demoRole=customer_owner&service=cbam&demoYear=2026&demoPage=annual-project&_=${Date.now()}` });
for (let attempt = 0; attempt < 60; attempt += 1) {
  await sleep(100);
  if (await evaluate("document.readyState") === "complete") break;
}
await sleep(300);
if (await evaluate("Boolean(document.querySelector('[data-service-overview=\"close\"]'))")) await click('[data-service-overview="close"]');

const annual = await evaluate("LuminoAgentRuntime.buildAgentContext()");
await click('[data-page="products"]');
const products = await evaluate("LuminoAgentRuntime.buildAgentContext()");
await click('[data-page="data-calculation"]');
await click('[data-cbam-section="data"]');
const data = await evaluate("LuminoAgentRuntime.buildAgentContext()");
await click('[data-cbam-section="results"]');
const calculation = await evaluate("LuminoAgentRuntime.buildAgentContext()");
const originalKey = calculation.conversationId;

await evaluate(`(() => {
  const select = document.querySelector('#yearSelect');
  select.value = '2027';
  select.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await sleep(200);
const nextYear = await evaluate("LuminoAgentRuntime.buildAgentContext()");
const nextYearAvailable = await evaluate("LuminoAgentRuntime.agentAvailable()");

const checks = {
  annualProject: annual?.annualProjectId === "CASE-CBAM-2026" && annual?.workstream === "annual_project",
  products: products?.objectRef?.id === "SCOPE-CBAM-2026" && products?.workstream === "scope_master_data",
  data: data?.objectRef?.id === "PKG-2026-Q3-NORDWERK" && data?.workstream === "data_collection",
  calculation: calculation?.objectRef?.type === "calculationRun" && calculation?.workstream === "calculation" && calculation?.serviceYear === "2026" && calculation?.period?.quarter === "Q3",
  isolatedYear: nextYear?.annualProjectId === "CASE-CBAM-2027" && nextYear?.conversationId !== originalKey,
  unstartedHidden: nextYearAvailable === false,
};
for (const [name, passed] of Object.entries(checks)) if (!passed) issues.push(`check failed: ${name}`);

const report = { generatedAt: new Date().toISOString(), origin, annual, products, data, calculation, nextYear, nextYearAvailable, checks, issues };
await writeFile(new URL("cbam-agent-context-audit.json", outputDir), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
socket.close();
if (issues.length) process.exitCode = 1;
