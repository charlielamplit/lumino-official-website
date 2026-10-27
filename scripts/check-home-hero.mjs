const cdpPort = process.argv[2] || '9223';
const origin = process.argv[3] || 'http://127.0.0.1:4173';
const path = '/apps/site/Lumino%20%E5%AE%98%E7%BD%91.dc.html';

const target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' }).then(response => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let id = 0;
const pending = new Map();
socket.addEventListener('message', event => {
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
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

await call('Page.enable');
await call('Runtime.enable');
await call('Network.enable');
await call('Network.setCacheDisabled', { cacheDisabled: true });

const viewports = [
  { width: 1440, height: 900, enforceSingleScreen: true },
  { width: 2048, height: 1044, enforceSingleScreen: true },
  { width: 390, height: 844, enforceSingleScreen: false }
];
const report = [];

for (const viewport of viewports) {
  await call('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 520,
    screenWidth: viewport.width,
    screenHeight: viewport.height
  });
  await call('Page.navigate', { url: `${origin}${path}` });
  await sleep(1200);
  await call('Runtime.evaluate', { expression: 'scrollTo(0, 0)' });
  await sleep(100);
  const result = await call('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const hero = document.querySelector('.home-hero');
      const title = document.querySelector('.home-hero h1');
      const titleLines = [...title.children].map(line => line.getBoundingClientRect());
      const sheet = document.querySelector('.proof-sheet');
      const sheetRect = sheet.getBoundingClientRect();
      const escapedSheetChildren = [...sheet.querySelectorAll('*')].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.left < sheetRect.left - 1 || rect.right > sheetRect.right + 1;
      }).map(element => ({ tag: element.tagName, className: element.className }));
      return {
        viewport: { width: innerWidth, height: innerHeight },
        headline: title.textContent.trim(),
        titleLineCount: titleLines.length,
        titleLinesDoNotOverlapSheet: titleLines.every(line => line.right <= sheetRect.left - 24 || innerWidth <= 1120),
        heroBottom: Math.round(hero.getBoundingClientRect().bottom),
        heroFitsSingleScreen: hero.getBoundingClientRect().bottom <= innerHeight + 1,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        escapedSheetChildren
      };
    })()`
  });
  const metrics = result.result.value;
  const failed = metrics.headline !== '用 AI 与平台化服务重新定义合规核查'
    || metrics.titleLineCount !== 2
    || !metrics.titleLinesDoNotOverlapSheet
    || metrics.horizontalOverflow
    || metrics.escapedSheetChildren.length > 0
    || (viewport.enforceSingleScreen && !metrics.heroFitsSingleScreen);
  report.push({ ...metrics, passed: !failed });
}

console.log(JSON.stringify(report, null, 2));
socket.close();
if (report.some(result => !result.passed)) process.exitCode = 1;
