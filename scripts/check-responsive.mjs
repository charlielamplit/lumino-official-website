const cdpPort = process.argv[2] || '9223';
const origin = process.argv[3] || 'http://127.0.0.1:4173';
const target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let messageId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

await call('Page.enable');
await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
  screenWidth: 390,
  screenHeight: 844
});

const pages = [
  ['home', `${origin}/Lumino%20%E5%AE%98%E7%BD%91.dc.html`],
  ['platform', `${origin}/Lumino%20%E5%B9%B3%E5%8F%B0.dc.html`]
];
const report = {};

for (const [name, url] of pages) {
  await call('Page.navigate', { url });
  await new Promise(resolve => setTimeout(resolve, 6500));
  const result = await call('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const root = document.documentElement;
      const width = root.clientWidth;
      const offenders = [...document.querySelectorAll('body *')]
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.right > width + 1 || r.left < -1;
        })
        .slice(0, 8)
        .map(el => ({ tag: el.tagName, className: String(el.className || ''), text: (el.textContent || '').trim().slice(0, 40) }));
      return {
        title: document.title,
        viewportWidth: width,
        scrollWidth: root.scrollWidth,
        h1Count: document.querySelectorAll('h1').length,
        horizontalOverflow: root.scrollWidth > width + 1,
        offenders
      };
    })()`
  });
  report[name] = result.result.value;
}

console.log(JSON.stringify(report, null, 2));
socket.close();
