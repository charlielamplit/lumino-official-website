import { mkdir, writeFile } from "node:fs/promises";

const cdpPort = process.argv[2] || "9237";
const origin = process.argv[3] || "http://127.0.0.1:4317";
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

async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  return result.result.value;
}

async function viewport(width) {
  await call("Emulation.setDeviceMetricsOverride", { width, height: width <= 520 ? 844 : 900, deviceScaleFactor: 1, mobile: width <= 520, screenWidth: width, screenHeight: width <= 520 ? 844 : 900 });
}

async function navigate(path) {
  await call("Page.navigate", { url: `${origin}${path}` });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(100);
    if (await evaluate("document.readyState") === "complete") break;
  }
  await sleep(250);
}

async function click(selector) {
  const clicked = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  if (!clicked) throw new Error(`Unable to click ${selector}`);
  await sleep(150);
}

async function closeOverview() {
  const exists = await evaluate("Boolean(document.querySelector('[data-service-overview=\"close\"]'))");
  if (exists) await click('[data-service-overview="close"]');
}

async function screenshot(name) {
  const result = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(new URL(`${name}.png`, outputDir), Buffer.from(result.data, "base64"));
}

const base = "/portal/?demoRole=customer_owner&service=cbam&demoYear=2027";

async function run(width) {
  await viewport(width);
  await navigate(`${base}&demoPage=service-start&demoState=activation`);
  await evaluate("localStorage.clear(); sessionStorage.clear()");
  await navigate(`${base}&demoPage=service-start&demoState=activation`);
  await closeOverview();
  const start = await evaluate(`(() => ({
    title: document.querySelector('.page-head h1')?.textContent,
    nav: [...document.querySelectorAll('#roleNav .nav-item')].map((item) => item.textContent.trim()),
    status: workflowEngine.get('AUTH-CBAM-2027-001')?.status,
    agentAvailable: Boolean(document.querySelector('#agentTopbarBtn')),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  }))()`);
  if (width === 1440) await screenshot("cbam-first-entry-service-start");
  await click('[data-activation-action="confirm"]');
  const annual = await evaluate(`(() => ({
    title: document.querySelector('.page-head h1')?.textContent,
    nav: [...document.querySelectorAll('#roleNav .nav-item')].map((item) => item.textContent.trim()),
    status: workflowEngine.get('AUTH-CBAM-2027-001')?.status,
    agentAvailable: Boolean(document.querySelector('#agentTopbarBtn')),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  }))()`);

  await navigate(`${base}&demoPage=products&demoState=annual-project`);
  await closeOverview();
  await click('[data-cbam-section="changes"]');
  const products = await evaluate(`(() => ({
    title: document.querySelector('.page-head h1')?.textContent,
    tabs: [...document.querySelectorAll('.cbam-section-tabs button')].map((item) => ({ label: item.textContent.trim(), active: item.classList.contains('is-active') })),
    diffRows: document.querySelectorAll('.product-diff__row').length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  }))()`);
  if (width === 1440) await screenshot("cbam-products-cn-import-diff");

  await navigate(`${base}&demoPage=data-calculation&demoState=annual-project`);
  await closeOverview();
  const data = await evaluate(`(() => ({
    title: document.querySelector('.page-head h1')?.textContent,
    tabs: [...document.querySelectorAll('.cbam-section-tabs button')].map((item) => item.textContent.trim()),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  }))()`);
  return { start, annual, products, data };
}

const report = { generatedAt: new Date().toISOString(), origin, widths: {}, issues: [] };
for (const width of [390, 768, 1440]) report.widths[width] = await run(width);
report.issues = [...new Set(issues)];
await writeFile(new URL("cbam-first-entry-audit.json", outputDir), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
