const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("portal assets stay valid when Vercel removes the trailing slash", () => {
  const html = read("apps/portal/index.html");
  assert.match(html, /href="\/apps\/portal\/styles\.css\?/);
  assert.match(html, /src="\/apps\/portal\/runtime\/portal-core\.js\?/);
  assert.match(html, /src="\/apps\/portal\/pages\/customer-pages\.js\?/);
  assert.match(html, /src="\/apps\/portal\/app\.js\?/);
  assert.doesNotMatch(html, /(?:href|src)="\.\/(?:styles\.css|runtime\/|pages\/|app\.js)/);
});

test("public portal links use the canonical no-slash deployment URL", () => {
  const sources = [
    read("portal/index.html"),
    read("apps/site/site/site-shell.js"),
    read("apps/site/Lumino 官网.dc.html"),
    read("apps/site/calculator/index.html"),
    read("apps/site/calculator/app.js"),
  ].join("\n");
  assert.match(sources, /\/apps\/portal/);
  assert.doesNotMatch(sources, /\/apps\/portal\//);
});

test("the final portal cascade keeps the login single-column on mobile", () => {
  const css = read("apps/portal/styles.css");
  assert.match(css, /Keep the editorial login composition single-column/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.login-screen\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.login-header nav > a:not\(\.login-header-cta\)/);
});

test("public site and portal share the approved Lumino brand colors and type", () => {
  const tokens = read("apps/site/site/tokens.css");
  const siteCss = read("apps/site/site/site-v3.css");
  const portalCss = read("apps/portal/styles.css");
  const portalHtml = read("apps/portal/index.html");

  for (const source of [tokens, portalCss]) {
    assert.match(source, /--brand-forest:\s*#013D29/i);
    assert.match(source, /--brand-yellow:\s*#FCC71E/i);
    assert.match(source, /--brand-teal:\s*#539D9D/i);
  }
  assert.match(siteCss, /\.brand-lockup \.brand-lumino\s*\{[\s\S]*?font-family:\s*"Poppins"[\s\S]*?font-weight:\s*800[\s\S]*?color:\s*var\(--brand-yellow\)/);
  assert.match(siteCss, /\.brand-lockup \.brand-shuoyuan\s*\{[\s\S]*?color:\s*var\(--brand-forest\)/);
  assert.doesNotMatch(siteCss, /\.brand-lockup \.brand-lumino\s*\{[\s\S]*?(?:Archivo|#E8B400)/);
  assert.match(portalCss, /\.brand\s*\{[^}]*color:\s*var\(--brand-yellow\)[^}]*"Poppins"/);
  assert.match(portalHtml, /<span>LUMiNO<\/span>/);
});
