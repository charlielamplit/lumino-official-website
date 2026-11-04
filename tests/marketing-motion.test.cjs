const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("marketing chrome uses short editorial scroll reveal with reduced-motion fallback", () => {
  const css = read("apps/site/site/site-v3.css");
  const shell = read("apps/site/site/site-shell.js");
  assert.match(css, /\.m-reveal\s*\{[\s\S]*?translateY\(10px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.m-reveal\.is-in/);
  assert.match(shell, /IntersectionObserver/);
  assert.match(shell, /\.m-page-hero \.wrap > \*/);
  assert.match(shell, /\.m-closing/);
  assert.match(shell, /classList\.add\("m-reveal"\)/);
  assert.match(shell, /classList\.add\("is-in"\)/);
});
