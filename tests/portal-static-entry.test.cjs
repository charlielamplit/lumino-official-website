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
