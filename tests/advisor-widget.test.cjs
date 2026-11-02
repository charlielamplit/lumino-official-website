const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("public tool menu loads the deterministic advisor without embedding model secrets", () => {
  const source = read("apps/site/site/float-tools.js");
  assert.match(source, /data-open-advisor/);
  assert.match(source, /\/packages\/advisor\/catalog\.js/);
  assert.match(source, /\/packages\/advisor\/router\.js/);
  assert.match(source, /\/api\/advisor-config/);
  assert.doesNotMatch(source, /OPENAI|API_KEY|sk-/);
});

test("advisor widget preserves keyboard, privacy and current-tab recovery controls", () => {
  const source = read("apps/site/site/advisor-widget.js");
  assert.match(source, /sessionStorage/);
  assert.match(source, /containsSensitiveInfo/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /advisor-widget__reset/);
  assert.match(source, /已恢复当前标签页中的对话/);
});

test("advisor presentation reuses site tokens and has mobile and reduced-motion rules", () => {
  const source = read("apps/site/site/advisor-widget.css");
  assert.match(source, /var\(--green\)/);
  assert.match(source, /var\(--paper\)/);
  assert.match(source, /var\(--radius-card\)/);
  assert.match(source, /@media \(max-width: 640px\)/);
  assert.match(source, /width: 100%/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(source, /linear-gradient|radial-gradient/);
});

test("deployment config exposes browser-loadable advisor modules", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.ok(config.rewrites.some((item) => item.source === "/packages/advisor/:path*"));
});
