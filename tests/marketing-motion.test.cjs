const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("marketing chrome uses short editorial scroll reveal with reduced-motion fallback", () => {
  const css = read("apps/site/site/site-v3.css");
  const shell = read("apps/site/site/site-shell.js");
  assert.match(css, /\.m-reveal\s*\{[\s\S]*?opacity:\s*1/);
  assert.match(css, /html\.js-reveal \.m-reveal:not\(\.is-in\)[\s\S]*?translateY\(10px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(shell, /IntersectionObserver/);
  assert.match(shell, /js-reveal/);
  assert.match(shell, /1800/);
  assert.match(shell, /\.m-page-hero \.wrap > \*/);
  assert.match(shell, /\.m-closing/);
  assert.match(shell, /classList\.add\("m-reveal"\)/);
  assert.match(shell, /classList\.add\("is-in"\)/);
});

test("audit fixes remove side stripes and low-signal REUSE label", () => {
  const css = read("apps/site/site/site-v3.css");
  const home = read("apps/site/Lumino 官网.dc.html");
  assert.match(css, /\.svc-more-note\s*\{[\s\S]*?border:\s*1px solid/);
  assert.doesNotMatch(css, /\.svc-more-note\s*\{[^}]*border-left:\s*[2-9]px/);
  assert.doesNotMatch(css, /svc-nav__item\[aria-current="page"\]\s*\{[^}]*inset 3px/);
  assert.match(home, /m-reuse__tag/);
  assert.match(home, /资料复用/);
  assert.doesNotMatch(home, />REUSE</);
});

test("industry cards and compact subpages keep content readable and dense", () => {
  const css = read("apps/site/site/site-v3.css");
  assert.match(css, /\.m-ind-cell::before\s*\{[\s\S]*?rgba\(7,31,22,\.86\)/);
  assert.match(css, /\.m-ind-cell\s*\{[\s\S]*?color:\s*#fff/);
  assert.match(css, /\.m-ind-cell p\s*\{[\s\S]*?rgba\(247, 250, 248, \.86\)/);
  assert.match(css, /\.m-page-hero--compact\s*\{[^}]*padding:\s*clamp\(22px, 3vw, 32px\)/);
  assert.match(css, /\.m-page-hero--compact \+ \.m-section\s*\{[^}]*padding-top:\s*clamp\(28px, 3\.5vw, 44px\)/);
});
