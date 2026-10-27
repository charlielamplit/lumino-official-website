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
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const task = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) task.reject(new Error(message.error.message));
  else task.resolve(message.result);
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

async function navigate(path) {
  await call("Page.navigate", { url: `${origin}${path}` });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(150);
    const ready = await call("Runtime.evaluate", { returnByValue: true, expression: "document.readyState" });
    if (ready.result.value === "complete") break;
  }
  await sleep(500);
}

async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { returnByValue: true, expression });
  return result.result.value;
}

const maliciousCode = encodeURIComponent('<img src=x onerror="globalThis.__luminoXss=true">');
await navigate(`/apps/portal/?source=calculator&cnCode=${maliciousCode}&year=%3Csvg%3E`);
const importedTrial = await evaluate(`({
  injectedElements: document.querySelectorAll('#importNotice img,#importNotice svg').length,
  executed: Boolean(globalThis.__luminoXss),
  text: document.querySelector('#importNotice')?.textContent || ''
})`);

await navigate("/apps/portal/?demoRole=customer_contrib&service=pcf&page=pcf-report");
const contributorDeepLink = await evaluate(`({
  title: document.title,
  page: typeof state === 'undefined' ? null : state.page,
  service: typeof state === 'undefined' ? null : state.currentService,
  hasReviewLockAction: Boolean(document.querySelector('[data-action="pcf-complete-review"]'))
})`);

await navigate("/apps/portal/?demoRole=customer_owner&demoPage=pcf-report");
const ownerDemoPage = await evaluate(`({
  title: document.title,
  page: typeof state === 'undefined' ? null : state.page,
  service: typeof state === 'undefined' ? null : state.currentService
})`);

await navigate("/apps/portal/?demoRole=customer_owner&page=shared-files");
const ownerGlobalDeepLink = await evaluate(`({
  title: document.title,
  page: typeof state === 'undefined' ? null : state.page,
  service: typeof state === 'undefined' ? null : state.currentService
})`);

const report = {
  importedTrial,
  contributorDeepLink,
  ownerDemoPage,
  ownerGlobalDeepLink,
  pass: importedTrial.injectedElements === 0
    && importedTrial.executed === false
    && contributorDeepLink.page === "pcf-data"
    && contributorDeepLink.hasReviewLockAction === false
    && ownerDemoPage.page === "services-hub"
    && ownerGlobalDeepLink.page === "shared-files"
    && ownerGlobalDeepLink.service === null,
};

await writeFile(new URL("portal-guard-audit.json", outputDir), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
if (!report.pass) process.exitCode = 1;
