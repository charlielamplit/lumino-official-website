#!/usr/bin/env node
/**
 * Marketing v3 smoke via Chrome CDP (same pattern as portal-design-audit).
 * Usage: node scripts/marketing-design-audit.mjs [cdpPort] [origin]
 */
import { mkdir, writeFile } from "node:fs/promises";

const cdpPort = process.argv[2] || "9223";
const origin = process.argv[3] || "http://127.0.0.1:4173";
const outputDir = new URL("../outputs/review/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const pages = [
  "/apps/site/Lumino%20%E5%AE%98%E7%BD%91.dc.html",
  "/apps/site/Lumino%20%E5%B9%B3%E5%8F%B0.dc.html",
  "/apps/site/industries/",
  "/apps/site/tools/",
  "/apps/site/knowledge/",
  "/apps/site/Lumino%20%E8%81%94%E7%B3%BB.dc.html",
];

const target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  }
});
const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await call("Page.enable");
await call("Runtime.enable");

async function navigate(path) {
  const bust = path.includes("?") ? `&_=${Date.now()}` : `?_=${Date.now()}`;
  await call("Page.navigate", { url: `${origin}${path}${bust}` });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(200);
    const ready = await call("Runtime.evaluate", { returnByValue: true, expression: "document.readyState" });
    if (ready.result.value === "complete") break;
  }
  await sleep(600);
}

const failures = [];
const results = [];

for (const path of pages) {
  await navigate(path);
  const evaled = await call("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const googleFonts = [...document.querySelectorAll('link[href*="fonts.googleapis.com"]')].length;
      const navCount = document.querySelectorAll('.site-nav a').length;
      const cta = document.querySelector('.header-cta')?.textContent?.trim() || '';
      const float = document.querySelectorAll('.tool-float').length;
      const h1 = document.querySelector('h1')?.textContent?.trim() || '';
      const tiles = document.querySelectorAll('.m-service-tile').length;
      const eyebrowVisible = [...document.querySelectorAll('.eyebrow')].some((el) => getComputedStyle(el).display !== 'none');
      return { googleFonts, navCount, cta, float, h1, tiles, eyebrowVisible, title: document.title };
    })()`,
  });
  const v = evaled.result.value;
  results.push({ path, ...v });
  if (v.googleFonts > 0) failures.push(`${path}: Google Fonts`);
  if (v.navCount < 7) failures.push(`${path}: nav ${v.navCount}`);
  if (!v.cta.includes("\u9884\u7ea6\u54a8\u8be2") && !v.cta.includes("Book a consultation")) {
    failures.push(`${path}: CTA ${v.cta}`);
  }
  if (v.float < 1) failures.push(`${path}: no float`);
  if (path.includes("%E5%AE%98%E7%BD%91")) {
    if (v.h1.includes("\u91cd\u65b0\u5b9a\u4e49")) failures.push("home: old hero");
    if (v.tiles < 6) failures.push(`home: tiles ${v.tiles}`);
    if (v.eyebrowVisible) failures.push("home: eyebrow visible");
  }
}

await writeFile(new URL("marketing-design-audit.json", outputDir), JSON.stringify({ origin, results, failures }, null, 2));
socket.close();
if (failures.length) {
  console.error("FAIL");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log("PASS marketing v3 audit", origin);
