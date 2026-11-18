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
  await call("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: width <= 520, screenWidth: width, screenHeight: height,
  });
}

async function navigate(path) {
  await call("Page.navigate", { url: `${origin}${path}` });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await sleep(100);
    if (await evaluate("document.readyState") === "complete") break;
  }
  await sleep(250);
}

async function waitFor(selector, timeout = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ready = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || el.closest('[hidden]')) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; })()`);
    if (ready) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${selector}`);
}

async function click(selector) {
  await waitFor(selector);
  const clicked = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); el.click(); return true; })()`);
  if (!clicked) throw new Error(`Unable to click ${selector}`);
  await sleep(50);
}

async function screenshot(name) {
  const result = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(new URL(`${name}.png`, outputDir), Buffer.from(result.data, "base64"));
}

async function selectPlaybook(playbookId, width) {
  if (width < 1200) {
    await waitFor("[data-agent-playbook-select]");
    await evaluate(`(() => { const el = document.querySelector('[data-agent-playbook-select]'); el.value = ${JSON.stringify(playbookId)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  } else {
    await click(`[data-agent-action="select-pb"][data-agent-pb="${playbookId}"]`);
  }
  await sleep(100);
}

async function closeServiceOverview() {
  const hasOverview = await evaluate("Boolean(document.querySelector('[data-service-overview=\"close\"]'))");
  if (hasOverview) await evaluate("document.querySelector('[data-service-overview=\"close\"]').click()");
}

async function openAgentAndCheckFocus(width) {
  await waitFor("#agentTopbarBtn");
  await evaluate("document.querySelector('#agentTopbarBtn').focus(); document.querySelector('#agentTopbarBtn').click()");
  await waitFor(".rt-dialog");
  const focusEntered = await evaluate("document.activeElement?.classList.contains('rt-close') === true");
  await evaluate(`(() => { const nodes = [...document.querySelectorAll('#agentRuntimeLayer .rt-dialog button:not([disabled]), #agentRuntimeLayer .rt-dialog select:not([disabled]), #agentRuntimeLayer .rt-dialog textarea:not([disabled])')].filter((el) => !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'); nodes[nodes.length - 1]?.focus(); })()`);
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  const focusTrapped = await evaluate("document.activeElement === [...document.querySelectorAll('#agentRuntimeLayer .rt-dialog button:not([disabled]), #agentRuntimeLayer .rt-dialog select:not([disabled]), #agentRuntimeLayer .rt-dialog textarea:not([disabled])')].filter((el) => !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')[0]");
  await click(".rt-close");
  const focusReturned = await evaluate("document.activeElement?.id === 'agentTopbarBtn'");
  await click("#agentTopbarBtn");
  return { focusEntered, focusTrapped, focusReturned, width };
}

async function inspectSources(width) {
  if (width < 1000) await click('[data-agent-action="mobile-view"][data-agent-mobile-view="details"]');
  await click('[data-agent-action="tab"][data-agent-tab="src"]');
  const result = await evaluate(`(() => ({
    available: document.querySelectorAll('[data-agent-action="open-source"]').length,
    unbound: [...document.querySelectorAll('.rt-src-row em')].filter((el) => el.textContent.includes('未绑定')).length,
    overclaim: document.querySelector('.rt-right__hint')?.textContent.includes('每个结论都链接') || false,
  }))()`);
  if (result.available) {
    await click('[data-agent-action="open-source"]');
    result.drawerOpened = await evaluate("!document.querySelector('#drawerLayer')?.hidden");
    const closer = await evaluate("Boolean(document.querySelector('[data-close-drawer]'))");
    if (closer) await click("[data-close-drawer]");
  }
  if (width < 1000) await click('[data-agent-action="mobile-view"][data-agent-mobile-view="conversation"]');
  else await click('[data-agent-action="tab"][data-agent-tab="art"]');
  return result;
}

async function completeGoldenPath(width) {
  await selectPlaybook("p06", width);
  const p06Sources = await inspectSources(width);
  await screenshot(`cbam-agent-p06-${width}`);
  await click('[data-agent-action="start-pb"][data-agent-pb="p06"]');
  await waitFor('[data-agent-action="answer"][data-agent-pb="p06"]');
  await click('[data-agent-action="answer"][data-agent-pb="p06"]');
  await waitFor('[data-agent-action="approve"][data-agent-pb="p06"]');
  await click('[data-agent-action="approve"][data-agent-pb="p06"]');

  await selectPlaybook("p07", width);
  await click('[data-agent-action="start-pb"][data-agent-pb="p07"]');
  await waitFor('[data-agent-action="answer"][data-agent-pb="p07"]');
  await click('[data-agent-action="answer"][data-agent-pb="p07"]');
  await waitFor(".rt-ap");

  await navigate("/apps/portal/?demoRole=reviewer&demoPage=review");
  await click('[data-action="cbam-review-calculation"]');
  await navigate("/apps/portal/?demoRole=customer_approver&service=cbam&demoPage=approvals");
  await click('[data-workflow-transition="APPROVED"][data-object-id="AP-2026-014"]');

  await navigate("/apps/portal/?demoRole=customer_owner&service=cbam&demoPage=deliverables");
  await closeServiceOverview();
  await click("#agentTopbarBtn");
  await selectPlaybook("p08", width);
  const p08GateBeforeStart = await evaluate("cbamGoldenPath.stage('p08')");
  if (p08GateBeforeStart.state === "blocked" || p08GateBeforeStart.state === "failed") {
    const snapshot = await evaluate("cbamGoldenPath.snapshot()");
    throw new Error(`p08 gate blocked before start: ${JSON.stringify(p08GateBeforeStart)}; snapshot=${JSON.stringify(snapshot)}`);
  }
  await click('[data-agent-action="start-pb"][data-agent-pb="p08"]');
  try {
    await waitFor('[data-agent-action="approve"][data-agent-pb="p08"]', 10000);
  } catch (error) {
    const debug = await evaluate("({ stage: cbamGoldenPath.stage('p08'), cur: state.rtCur.p08, busy: state.rtBusy, started: state.rtStarted.p08, done: state.rtDone.p08, text: document.querySelector('#rtBody')?.innerText })");
    throw new Error(`${error.message}; p08 debug=${JSON.stringify(debug)}`);
  }
  await click('[data-agent-action="approve"][data-agent-pb="p08"]');
  await sleep(100);
  const p08Sources = await inspectSources(width);
  await screenshot(`cbam-agent-p08-${width}`);

  return evaluate(`(() => {
    const root = document.documentElement;
    const snapshot = cbamGoldenPath.snapshot();
    const visible = (el) => Boolean(el && !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
    const touchTargets = [...document.querySelectorAll('.rt-mobile-bar select, .rt-mobile-views button, .rt-modes button, .rt-attach, .rt-input__bar .button--sm')].filter(visible).map((el) => Math.round(el.getBoundingClientRect().height));
    return {
      p06: cbamGoldenPath.stage('p06').state,
      p07: cbamGoldenPath.stage('p07').state,
      p08: cbamGoldenPath.stage('p08').state,
      packageStatus: snapshot.package?.status,
      runStatus: snapshot.run?.status,
      approvalStatus: snapshot.approval?.status,
      reviewStatus: snapshot.run?.metadata?.review?.status,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      viewportWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      overflowOffenders: [...document.querySelectorAll('body *')].filter(visible).filter((el) => { const rect = el.getBoundingClientRect(); return rect.right > root.clientWidth + 1 || rect.left < -1; }).slice(0, 12).map((el) => ({ tag: el.tagName, className: String(el.className || ''), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width) })),
      minTouchTarget: touchTargets.length ? Math.min(...touchTargets) : null,
    };
  })()`).then((state) => ({ ...state, p06Sources, p08Sources }));
}

const report = { generatedAt: new Date().toISOString(), origin, widths: {}, issues: browserIssues };
for (const width of [390, 768, 1440]) {
  await viewport(width);
  await navigate("/apps/portal/?demoRole=customer_owner&service=cbam&demoPage=data");
  await evaluate("localStorage.clear(); sessionStorage.clear();");
  await navigate("/apps/portal/?demoRole=customer_owner&service=cbam&demoPage=data");
  await closeServiceOverview();
  const focus = await openAgentAndCheckFocus(width);
  const workflow = await completeGoldenPath(width);
  report.widths[width] = { focus, workflow };
}
report.issues = [...new Set(browserIssues)];
await writeFile(new URL("cbam-agent-runtime-audit.json", outputDir), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
