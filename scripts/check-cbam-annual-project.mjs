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

async function run(width) {
  await call("Emulation.setDeviceMetricsOverride", { width, height: width <= 520 ? 844 : 900, deviceScaleFactor: 1, mobile: width <= 520, screenWidth: width, screenHeight: width <= 520 ? 844 : 900 });
  await call("Page.navigate", { url: `${origin}/portal/?demoRole=customer_owner&service=cbam&demoYear=2026&demoPage=annual-project&_=${Date.now()}` });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(100);
    if (await evaluate("document.readyState") === "complete") break;
  }
  await sleep(250);
  const close = await evaluate("Boolean(document.querySelector('[data-service-overview=\"close\"]'))");
  if (close) {
    await evaluate("document.querySelector('[data-service-overview=\"close\"]')?.click()");
    await sleep(100);
  }
  const result = await evaluate(`(() => ({
    title: document.querySelector('.page-head h1')?.textContent,
    facts: document.querySelectorAll('.annual-est-overview__facts > div').length,
    statusControl: Boolean(document.querySelector('.annual-status > summary')),
    statusStages: document.querySelectorAll('.annual-status__popover li').length,
    legacyJourney: document.querySelectorAll('.annual-journey li').length,
    crossYear: document.querySelector('.annual-crossyear-note')?.textContent.trim(),
    team: document.querySelectorAll('.annual-team li').length,
    cards: document.querySelectorAll('.annual-established .ds-card').length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight
  }))()`);
  if ([390, 1440].includes(width)) {
    const shot = await call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
    await writeFile(new URL(`cbam-annual-project-${width}.png`, outputDir), Buffer.from(shot.data, "base64"));
  }
  return result;
}

const report = { generatedAt: new Date().toISOString(), origin, widths: {}, issues: [] };
for (const width of [390, 768, 1440]) report.widths[width] = await run(width);
report.issues = [...new Set(issues)];
await writeFile(new URL("cbam-annual-project-audit.json", outputDir), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
