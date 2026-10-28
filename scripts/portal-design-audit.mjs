import { mkdir, writeFile } from 'node:fs/promises';

const cdpPort = process.argv[2] || '9223';
const origin = process.argv[3] || 'http://127.0.0.1:4173';
const outputDir = new URL('../outputs/review/', import.meta.url);
await mkdir(outputDir, { recursive: true });

const target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let id = 0;
const pending = new Map();
let pageIssues = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') pageIssues.push(`exception: ${message.params.exceptionDetails.text}`);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    pageIssues.push(`console: ${message.params.args.map((item) => item.value || item.description || '').join(' ')}`);
  }
});

const call = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = ++id;
  pending.set(messageId, { resolve, reject });
  socket.send(JSON.stringify({ id: messageId, method, params }));
});
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

await call('Page.enable');
await call('Runtime.enable');
await call('Network.enable');
await call('Network.setCacheDisabled', { cacheDisabled: true });
await call('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900,
});

async function navigate(path) {
  pageIssues = [];
  const bust = path.includes('?') ? `&_=${Date.now()}` : `?_=${Date.now()}`;
  await call('Page.navigate', { url: `${origin}${path}${bust}` });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(200);
    const ready = await call('Runtime.evaluate', { returnByValue: true, expression: 'document.readyState' });
    if (ready.result.value === 'complete') break;
  }
  await sleep(800);
  await call('Runtime.evaluate', { expression: 'scrollTo(0,0)' });
  await sleep(100);
}

const pages = [
  ['workbench', '/apps/portal/?demoRole=customer_owner&page=workbench'],
  ['tasks', '/apps/portal/?demoRole=customer_owner&page=shared-tasks'],
  ['services', '/apps/portal/?demoRole=customer_owner&page=services-hub'],
  ['assets', '/apps/portal/?demoRole=customer_owner&page=shared-files'],
  ['deliverables', '/apps/portal/?demoRole=customer_owner&page=shared-deliverables'],
  ['access', '/apps/portal/?demoRole=customer_owner&page=shared-organization'],
];

// Keep browser expression ASCII-only; Chinese probes via unicode escapes.
const auditExpression = `(() => {
  const visible = (el) => {
    if (!el || el.closest('[hidden]')) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };
  const topbar = document.querySelector('.topbar');
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('#main') || document.querySelector('.workspace');
  const topbarH = topbar ? Math.round(topbar.getBoundingClientRect().height) : 0;
  const sidebarW = sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0;
  let contentMax = 0;
  if (main) {
    const kids = [...main.children].filter(visible);
    contentMax = kids.reduce((max, el) => Math.max(max, Math.round(el.getBoundingClientRect().width)), 0);
    for (const shell of main.querySelectorAll('.workbench, .service-hub-shell, .task-ledger-shell, .portal-shell')) {
      contentMax = Math.max(contentMax, Math.round(shell.getBoundingClientRect().width));
    }
  }
  const bodyText = (main && main.innerText ? main.innerText : '').replace(/\s+/g, ' ');
  const bannedEyebrows = ['WORKBENCH', 'TASK LEDGER', 'DELIVERABLES', 'SERVICE CATALOG'];
  const englishEyebrows = [...(main ? main.querySelectorAll('.page-head p, .page-head__meta, .workbench-kicker, .eyebrow') : [])]
    .filter(visible)
    .map((el) => (el.textContent || '').trim())
    .filter((text) => bannedEyebrows.some((token) => text.includes(token)) || /\\bSERVICES\\b/.test(text));
  const leadA = '\u8fd9\u91cc\u56de\u7b54';
  const leadB = '\u4e0d\u8981\u628a\u8fd9\u91cc\u5f53';
  const leadC = '\u5b8c\u6574\u5f85\u529e\u6e05\u5355';
  const systemLead = bodyText.includes(leadA) || bodyText.includes(leadB) || bodyText.includes(leadC);
  const cards = [...(main ? main.querySelectorAll('.ds-card, .focus-card, .workbench-focus, .metric-strip, .ds-table, .service-tile, .asset-attention, .permission-self') : [])].filter(visible);
  const radii = cards.map((el) => parseFloat(getComputedStyle(el).borderRadius) || 0);
  const minRadius = radii.length ? Math.min(...radii) : 8;
  const thickTop = cards.filter((el) => parseFloat(getComputedStyle(el).borderTopWidth) > 1).map((el) => String(el.className));
  const focusPrimaries = [...(main ? main.querySelectorAll('.workbench-focus .button--primary, .asset-attention .button--primary') : [])].filter(visible).length;
  const openA = '\u6253\u5f00';
  const openB = '\u8be6\u60c5';
  const openC = '\u7ee7\u7eed';
  const rowOpenButtons = [...(main ? main.querySelectorAll('tr .text-button, .workbench-queue .text-button, .workbench-asset-preview .text-button, .delivery-ledger .text-button, .service-row .text-button, .workbench-channel .text-button') : [])]
    .filter(visible)
    .map((el) => (el.textContent || '').trim())
    .filter((text) => text.includes(openA) || text.includes(openB) || text.includes(openC));
  const yellowServiceCards = [...(main ? main.querySelectorAll('.service-row--pilot, .workbench-channel--pilot, .service-card--pilot, .service-open-card') : [])]
    .filter(visible)
    .filter((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      if (!m) return false;
      const r = Number(m[1]); const g = Number(m[2]); const b = Number(m[3]);
      return r > 230 && g > 220 && b < 200;
    })
    .map((el) => String(el.className));
  const font = getComputedStyle(document.body).fontFamily || '';
  const hasIbm = /IBM Plex Sans/i.test(font);
  return {
    topbarH, sidebarW, contentMax, englishEyebrows, systemLead, minRadius, thickTop,
    focusPrimaries, rowOpenButtons, yellowServiceCards, font, hasIbm,
    h1: [...document.querySelectorAll('h1')].filter(visible).map((el) => el.textContent.trim()),
  };
})()`;

const report = { origin, generatedAt: new Date().toISOString(), pages: {}, pass: true, failures: [] };

for (const [name, path] of pages) {
  await navigate(path);
  const result = await call('Runtime.evaluate', { returnByValue: true, expression: auditExpression });
  const data = result.result && result.result.value;
  if (!data) {
    report.pass = false;
    report.failures.push({ page: name, id: 'evaluate', detail: result });
    report.pages[name] = { path, error: result };
    continue;
  }
  const checks = [];
  const fail = (checkId, detail) => {
    checks.push({ id: checkId, ok: false, detail });
    report.failures.push({ page: name, id: checkId, detail });
    report.pass = false;
  };
  const ok = (checkId, detail) => checks.push({ id: checkId, ok: true, detail });

  if (data.topbarH >= 52 && data.topbarH <= 60) ok('topbar-height', data.topbarH); else fail('topbar-height', data.topbarH);
  if (data.sidebarW >= 210 && data.sidebarW <= 230) ok('sidebar-width', data.sidebarW); else fail('sidebar-width', data.sidebarW);
  if (data.contentMax <= 1200) ok('content-max', data.contentMax); else fail('content-max', data.contentMax);
  if (!data.englishEyebrows.length) ok('no-english-eyebrow', []); else fail('no-english-eyebrow', data.englishEyebrows);
  if (data.minRadius >= 7) ok('card-radius', data.minRadius); else fail('card-radius', { minRadius: data.minRadius });
  if (!data.thickTop.length) ok('no-thick-top-stripe', []); else fail('no-thick-top-stripe', data.thickTop);
  if (data.focusPrimaries <= 1) ok('focus-primary-le-1', data.focusPrimaries); else fail('focus-primary-le-1', data.focusPrimaries);
  if (!data.rowOpenButtons.length) ok('no-row-open-buttons', []); else fail('no-row-open-buttons', data.rowOpenButtons);
  if (!data.systemLead) ok('no-system-lead', false); else fail('no-system-lead', true);
  if (!data.yellowServiceCards.length) ok('no-yellow-service-cards', []); else fail('no-yellow-service-cards', data.yellowServiceCards);
  if (data.hasIbm) ok('ibm-plex-sans', data.font); else fail('ibm-plex-sans', data.font);

  report.pages[name] = { path, ...data, checks, runtimeIssues: [...new Set(pageIssues)] };
}

const outPath = new URL('portal-design-audit.json', outputDir);
await writeFile(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, failures: report.failures, output: outPath.pathname }, null, 2));
socket.close();
process.exit(report.pass ? 0 : 1);
