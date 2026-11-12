"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.join(__dirname, "..", "apps", "portal");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("framework shell markers exist in markup and styles", () => {
  const html = read("index.html");
  const css = read("styles.css");
  assert.match(html, /class="shell-rail"/);
  assert.match(html, /class="cmdk-trigger"/);
  assert.match(html, /id="loginEmail"/);
  assert.match(html, /data-login-step="email"/);
  assert.match(css, /\.step-flow-footer\s*\{/);
  assert.match(css, /\.system-state--stale/);
  assert.match(css, /\.system-state--locked/);
});

test("workflow, locked and STALE helpers are wired", () => {
  const core = read("runtime/portal-core.js");
  const pcf = read("pages/multi-service-pages.js");
  const customer = read("pages/customer-pages.js");
  assert.match(core, /function stepFlowFooter\(/);
  assert.match(core, /function lockedYearBanner\(/);
  assert.match(core, /function staleSnapshotPanel\(/);
  assert.match(pcf, /function pcfStepNav\(/);
  assert.match(pcf, /\$\{pcfStepNav\(\)\}/);
  assert.match(pcf, /staleSnapshotPanel\(/);
  assert.match(customer, /lockedYearBanner\(\)/);
  assert.match(customer, /data-template="T2"/);
  assert.match(customer, /nextAction\(model\.next\.kicker/);
  assert.match(customer, /data-drawer="extract-energy"/);
  assert.match(customer, /data-drawer="extract-output"/);
});

test("stage-gate panel is secondary: rail on CBAM work, footer on PCF", () => {
  const core = read("runtime/portal-core.js");
  const css = read("styles.css");
  const customer = read("pages/customer-pages.js");
  const pcf = read("pages/multi-service-pages.js");
  assert.match(core, /variant === "rail"/);
  assert.match(css, /\.stage-gate-panel\.is-rail/);
  assert.match(css, /\.stage-gate-panel\.is-footer/);
  assert.match(customer, /stageGatePanelHtml\("cbam", \{ variant: "rail" \}\)/);
  assert.doesNotMatch(customer, /journey-mini[\s\S]*stageGatePanelHtml\("cbam"\)/);
  assert.match(pcf, /stageGatePanelHtml\("pcf", \{ variant: "footer" \}\)/);
});

test("T5 review suite and T3 drawer shell helpers exist", () => {
  const core = read("runtime/portal-core.js");
  const customer = read("pages/customer-pages.js");
  const roles = read("pages/role-pages.js");
  const css = read("styles.css");
  assert.match(core, /function reviewSuiteShell\(/);
  assert.match(core, /function drawerShell\(/);
  assert.match(core, /data-template="T5"/);
  assert.match(core, /data-template="T3"/);
  assert.match(customer, /reviewSuiteShell\(/);
  assert.match(roles, /reviewSuiteShell\(/);
  assert.match(css, /\.review-suite/);
  assert.match(css, /\.drawer-shell__/);
  assert.match(css, /\.system-state--loading/);
  assert.match(css, /\.system-state--error/);
});

test("T6 settings shell has section nav and admin entry points", () => {
  const core = read("runtime/portal-core.js");
  const customer = read("pages/customer-pages.js");
  const html = read("index.html");
  const events = read("runtime/portal-events.js");
  const css = read("styles.css");
  assert.match(core, /function settingsShell\(/);
  assert.match(core, /data-template="T6"/);
  assert.match(core, /settingsNavItems/);
  assert.match(core, /customerRailExtras\.settings/);
  assert.match(core, /canManageOrganization\(\)/);
  assert.match(core, /overviewPages/);
  assert.match(customer, /settingsShell\(/);
  assert.match(customer, /settingsSection/);
  assert.match(html, /data-account-action="settings"/);
  assert.match(events, /data-settings-section/);
  assert.match(css, /\.settings-shell/);
});
