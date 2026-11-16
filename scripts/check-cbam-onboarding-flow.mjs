import { mkdir, writeFile } from "node:fs/promises";

const cdpPort = process.argv[2] || "9223";
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
const browserIssues = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") browserIssues.push(`exception: ${message.params.exceptionDetails.text}`);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    browserIssues.push(`console: ${message.params.args.map((item) => item.value || item.description || "").join(" ")}`);
  }
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
    browserIssues.push(`http ${message.params.response.status}: ${message.params.response.url}`);
  }
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

async function viewport(width, height = width <= 520 ? 844 : 900) {
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 520, screenWidth: width, screenHeight: height });
}

async function navigate(path) {
  await call("Page.navigate", { url: `${origin}${path}` });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(100);
    if (await evaluate("document.readyState") === "complete") break;
  }
  await sleep(200);
}

async function waitFor(selector, timeout = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ready = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return Boolean(el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'); })()`);
    if (ready) return;
    await sleep(100);
  }
  const context = await evaluate(`(() => ({ url: location.href, title: document.querySelector('.page-head h1')?.textContent, main: document.querySelector('#main')?.innerText.slice(0, 500) }))()`);
  throw new Error(`Timed out waiting for ${selector}: ${JSON.stringify(context)}`);
}

async function click(selector) {
  await waitFor(selector);
  const clicked = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); el.click(); return true; })()`);
  if (!clicked) throw new Error(`Unable to click ${selector}`);
  await sleep(100);
}

async function closeServiceOverview() {
  const hasOverview = await evaluate("Boolean(document.querySelector('[data-service-overview=\"close\"]'))");
  if (hasOverview) await click('[data-service-overview="close"]');
}

async function screenshot(name) {
  const result = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(new URL(`${name}.png`, outputDir), Buffer.from(result.data, "base64"));
}

const portalUrl = (role, page) => `/portal/?demoRole=${role}&service=cbam&demoYear=2027&demoPage=${page}`;

async function runFlow(width) {
  await navigate(portalUrl("customer_owner", "onboarding"));
  await evaluate("localStorage.clear(); sessionStorage.clear()");
  await navigate(portalUrl("customer_owner", "onboarding"));
  await evaluate(`(() => { const auth = workflowEngine.get('AUTH-CBAM-2027-001'); if (auth?.status === 'PENDING_CUSTOMER_CONFIRMATION') workflowEngine.transition(auth.id, 'ACTIVE', { actor: '周岚', role: 'customer_owner', reason: '浏览器回归：完成客户线上确认' }); })()`);
  await navigate(portalUrl("customer_owner", "onboarding"));
  await closeServiceOverview();

  await click('[data-onboarding-action="next"]');
  await evaluate(`(() => { const el = document.querySelector('[name="importer"]'); el.value = 'NordWerk GmbH'; })()`);
  await click('[data-onboarding-action="next"]');
  await click('[data-onboarding-action="next"]');
  await click('[data-onboarding-action="next"]');

  await navigate(portalUrl("customer_owner", "onboarding"));
  await closeServiceOverview();
  const recoveredDraft = await evaluate(`(() => { const item = cbamGoldenPath.snapshot().annualCase; return { step: item?.metadata?.wizardStep, importer: item?.metadata?.wizardDraft?.importer, products: item?.metadata?.wizardDraft?.products }; })()`);
  await click('[data-onboarding-action="create"]');
  const afterProjectStart = await evaluate(`(() => ({
    agentAvailable: Boolean(document.querySelector('#agentTopbarBtn')),
    parallelWorkstreams: document.querySelectorAll('.annual-parallel__rows article').length,
    materialRequests: cbamGoldenPath.snapshot().materialRequests.length,
    annualCaseStatus: cbamGoldenPath.snapshot().annualCase?.status
  }))()`);

  await navigate(portalUrl("customer_owner", "products"));
  await closeServiceOverview();
  await click('[data-onboarding-action="confirm-scope"]');

  await navigate(portalUrl("expert", "monitoring-plan"));
  await closeServiceOverview();
  await click('[data-monitoring-action="prepare"]');

  await navigate(portalUrl("reviewer", "monitoring-plan"));
  await closeServiceOverview();
  await click('[data-monitoring-action="review"]');

  await navigate(portalUrl("customer_owner", "monitoring-plan"));
  await closeServiceOverview();
  const primaryControlHeight = await evaluate(`Math.round(document.querySelector('[data-monitoring-action="sign"]')?.getBoundingClientRect().height || 0)`);
  await click('[data-monitoring-action="sign"]');
  await click('[data-monitoring-action="draft-invitations"]');
  const repeated = await evaluate(`(() => {
    const actor = { name: '周岚', role: 'customer_owner' };
    const signed = cbamGoldenPath.command('p04', 'sign', actor);
    const drafted = cbamGoldenPath.command('p05', 'draft-invitations', actor);
    return { signedIdempotent: signed.idempotent, draftedIdempotent: drafted.idempotent };
  })()`);
  await screenshot(`cbam-onboarding-${width}`);

  await navigate(portalUrl("customer_owner", "org-settings"));
  await closeServiceOverview();
  const draftRows = await evaluate(`[...document.querySelectorAll('.data-table tbody tr')].filter((row) => row.textContent.includes('草稿 · 未发送')).length`);

  return evaluate(`(() => {
    const root = document.documentElement;
    const snapshot = cbamGoldenPath.snapshot();
    const visible = (el) => Boolean(el && !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
    const controls = [...document.querySelectorAll('.button, [data-monitoring-action], [data-onboarding-action]')].filter(visible);
    return {
      stages: Object.fromEntries(['p01', 'p02', 'p03', 'p04', 'p05'].map((id) => [id, cbamGoldenPath.stage(id).state])),
      monitoringStatus: snapshot.monitoringPlan?.status,
      materialRequestCount: snapshot.materialRequests.length,
      invitationStatus: snapshot.invitationDraft?.status,
      externalSent: snapshot.invitationDraft?.metadata?.externalSent,
      deliveryState: snapshot.invitationDraft?.metadata?.deliveryState,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      viewportWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      minPrimaryControlHeight: controls.length ? Math.min(...controls.map((el) => Math.round(el.getBoundingClientRect().height))) : null,
      overflowOffenders: [...document.querySelectorAll('body *')].filter(visible).filter((el) => !el.closest('.sidebar:not(.open)')).filter((el) => { const rect = el.getBoundingClientRect(); return rect.right > root.clientWidth + 1 || rect.left < -1; }).slice(0, 8).map((el) => ({ tag: el.tagName, className: String(el.className || ''), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) })),
    };
  })()`).then((result) => ({ ...result, primaryControlHeight, recoveredDraft, repeated, draftRows, afterProjectStart }));
}

const report = { generatedAt: new Date().toISOString(), origin, widths: {}, issues: browserIssues };
for (const width of [390, 768, 1440]) {
  await viewport(width);
  report.widths[width] = await runFlow(width);
}
report.issues = [...new Set(browserIssues)];
await writeFile(new URL("cbam-onboarding-flow-audit.json", outputDir), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
