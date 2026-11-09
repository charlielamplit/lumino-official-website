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
  assert.match(source, /openAdvisorSafe|advisor_load_timeout/);
  assert.match(source, /ADVISOR_SCRIPT_TIMEOUT_MS|script_load_timeout/);
  assert.match(source, /resetAdvisorLoader/);
  assert.match(source, /showAdvisorBootstrap|showAdvisorLoadError/);
  assert.match(source, /data-advisor-load-retry/);
  assert.match(source, /root\.hidden\s*=\s*true/);
  assert.match(source, /shell\.root\.hidden\s*=\s*false/);
  assert.match(source, /preloadScript|rel:\s*"preload"|rel = "preload"/);
  assert.match(source, /ADVISOR_ASSET_V|20261109-type3/);
  assert.match(source, /link\[rel="stylesheet"\]\[href=/);
  assert.match(source, /style_load_timeout/);
  assert.match(source, /openAdvisorSafe\(shell\.primary, flags, "auto-open"\)/);
  assert.match(source, /if \(isHomepage\(\)\) openAdvisorSafe/);
  assert.match(source, /path === "\/site"/);
  assert.doesNotMatch(source, /primary\.disabled\s*=\s*true/);
  assert.doesNotMatch(source, /warmAdvisor|scheduleAutoOpen/);
  assert.doesNotMatch(source, /window\.location\.href\s*=\s*"\/apps\/site\/Lumino%20联系/);
  assert.doesNotMatch(source, /tool-float__glyph/);
  assert.doesNotMatch(source, /OPENAI|API_KEY|sk-/);
});

test("homepage preloads advisor assets for instant Ask open", () => {
  const html = read("apps/site/Lumino 官网.dc.html");
  assert.match(html, /rel="preload"[^>]+advisor-widget\.css\?v=20261109-type3/);
  assert.match(html, /rel="preload"[^>]+packages\/advisor\/catalog\.js\?v=20261109-type3/);
  assert.match(html, /rel="preload"[^>]+advisor-widget\.js\?v=20261109-type3/);
});

test("public navigation and advisor use the Compliance tools name consistently", () => {
  const floatTools = read("apps/site/site/float-tools.js");
  const shell = read("apps/site/site/site-shell.js");
  const widget = read("apps/site/site/advisor-widget.js");
  const toolsPage = read("apps/site/tools/index.html");
  assert.match(floatTools, /tools:\s*"Compliance tools"/);
  assert.match(floatTools, /tools:\s*"合规工具"/);
  assert.match(floatTools, /toolsTitle:\s*"选择合规工具"/);
  assert.match(shell, /zh:\s*"合规工具",\s*en:\s*"Compliance tools"/);
  assert.match(widget, /推荐合规工具/);
  assert.match(toolsPage, /<title>合规工具 · Lumino<\/title>/);
  assert.match(toolsPage, /data-i18n-zh="合规工具" data-i18n-en="Compliance tools"/);
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
  assert.match(source, /服务暂时不可用|行动建议|基础问答/);
  assert.match(source, /is-busy|setBusy/);
  assert.match(source, /startThinking/);
  assert.match(source, /client_deterministic/);
  assert.match(source, /advisor-topic__marker/);
  assert.match(source, /topicTones/);
  assert.match(source, /topics\.map\(topicButton\)/);
  assert.doesNotMatch(source, /data-advisor-show-more|data-advisor-more-topics/);
  assert.match(source, /role="group"|Answer choices/);
  assert.doesNotMatch(source, /THINK_MIN_FIXED_MS|remainingThink|CHUNK_MS/);
  assert.match(source, /分析你的问题|Analysing your question/);
  assert.match(source, /DETERMINISTIC_DELAY_MIN_MS\s*=\s*1000/);
  assert.match(source, /DETERMINISTIC_DELAY_MAX_MS\s*=\s*4000/);
  assert.match(source, /waitForDelay\(deterministicDelayMs\(\), delayController\.signal\)/);
  assert.match(source, /general_model/);
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
  assert.match(source, /container-type:\s*inline-size/);
  assert.match(source, /\.advisor-widget\s*\{[\s\S]*?font-family:\s*var\(--font-sans\)[\s\S]*?font-size:\s*var\(--type-ui\)/);
  assert.match(source, /\.advisor-replies\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(source, /\.advisor-reply\s*\{[\s\S]*?width:\s*auto/);
  assert.match(source, /\.advisor-topic__marker/);
  assert.match(source, /data-topic-tone="teal"/);
  assert.match(source, /data-topic-tone="blue"/);
  assert.match(source, /data-topic-tone="gold"/);
  const replyRule = source.match(/\.advisor-reply\s*\{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(replyRule, /(?:^|\n)\s*width:\s*100%/);
  assert.match(replyRule, /min-height:\s*36px/);
  assert.match(replyRule, /font-size:\s*var\(--type-ui\)/);
  assert.doesNotMatch(source, /--type-small/);
  assert.match(source, /@media \(pointer:\s*coarse\)\s*\{[\s\S]*?\.advisor-reply\s*\{[\s\S]*?min-height:\s*44px/);
  assert.doesNotMatch(source, /linear-gradient|radial-gradient/);
});

test("deployment config exposes browser-loadable advisor modules", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.ok(config.rewrites.some((item) => item.source === "/packages/advisor/:path*"));
});
