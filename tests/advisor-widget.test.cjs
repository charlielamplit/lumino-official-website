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
  assert.match(source, /tool-float__btn--ask/);
  assert.match(source, /tool-float__tip/);
  assert.match(source, /tool-float__icon/);
  assert.match(source, /data-float-tools/);
  assert.match(source, /data-float-top/);
  assert.match(source, /scrollTo/);
  assert.match(source, /ask:\s*'<svg class="tool-float__icon"/);
  assert.match(source, /openAdvisorExpanded|source:\s*"auto-open"/);
  assert.match(source, /openAdvisorSafe|advisor_load_timeout/);
  assert.match(source, /Promise\.all\(\[\s*loadScript\(`\/packages\/advisor\/catalog/);
  assert.match(source, /20261104-fab13/);
  assert.doesNotMatch(source, /primary\.disabled\s*=\s*true/);
  assert.doesNotMatch(source, /tool-float__glyph/);
  assert.doesNotMatch(source, /OPENAI|API_KEY|sk-/);
});

test("float dock stays viewport-fixed and clusters ask/tools/top", () => {
  const css = read("apps/site/site/site-v3.css");
  assert.match(css, /\.tool-float\s*\{[\s\S]*?position:\s*fixed\s*!important/);
  assert.match(css, /\.tool-float__stack/);
  assert.match(css, /\.tool-float__btn--ask/);
  assert.match(css, /\.tool-float__tip/);
  assert.match(css, /\.tool-float__btn--top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.doesNotMatch(css, /\.tool-float\s*,\s*main/);
  assert.doesNotMatch(css, /\.tool-float[^{]*\{[^}]*linear-gradient/);
});

test("advisor widget preserves keyboard, privacy and current-tab recovery controls", () => {
  const source = read("apps/site/site/advisor-widget.js");
  assert.match(source, /sessionStorage/);
  assert.match(source, /containsSensitiveInfo/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /advisor-widget__reset/);
  assert.match(source, /advisor-widget__reset-icon/);
  assert.match(source, /初步判断，帮助你快速定向/);
  assert.doesNotMatch(source, /advisor-widget__mark|advisor-widget__identity|advisor-widget__beta/);
  assert.doesNotMatch(source, /assets\/brand\/mark-128/);
  assert.match(source, /已恢复当前标签页中的对话/);
  assert.match(source, /stream=1/);
  assert.match(source, /data-advisor-stop/);
  assert.match(source, /data-advisor-expand/);
  assert.match(source, /data-advisor-retry/);
  assert.match(source, /服务暂时不可用|没有足够依据|基础问答/);
  assert.match(source, /is-busy|setBusy/);
  assert.match(source, /THINK_MIN_FIXED_MS/);
  assert.match(source, /minDeliberationMs|startThinking/);
  assert.match(source, /对照已发布说明|Checking published guidance/);
  assert.match(source, /Buffer stream text only|deliberation/);
});

test("advisor presentation reuses site tokens and has mobile and reduced-motion rules", () => {
  const source = read("apps/site/site/advisor-widget.css");
  assert.match(source, /var\(--green\)/);
  assert.match(source, /var\(--paper\)/);
  assert.match(source, /var\(--radius-card\)/);
  assert.match(source, /\.advisor-widget__reset-icon/);
  assert.match(source, /height:\s*min\(700px/);
  assert.match(source, /\.advisor-widget__close\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(source, /\.advisor-reply,\s*\n\.advisor-link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(source, /\.advisor-widget__stop,[\s\S]*?min-height:\s*44px/);
  assert.match(source, /@media \(max-width: 640px\)/);
  assert.match(source, /width: 100%/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /data-thinking/);
  assert.match(source, /advisor-think-pulse/);
  assert.doesNotMatch(source, /linear-gradient|radial-gradient/);
});

test("deployment config exposes browser-loadable advisor modules", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.ok(config.rewrites.some((item) => item.source === "/packages/advisor/:path*"));
});
