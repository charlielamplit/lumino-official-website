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

test("customer entry authenticates separately and never grants a sample workspace", () => {
  const html = read("index.html");
  const events = read("runtime/portal-events.js");
  const core = read("runtime/portal-core.js");
  const config = read("runtime/portal-config.js");
  const boot = read("app.js");
  assert.match(html, /data-step-panel="setup"/);
  assert.match(html, /id="customerTenantEditForm"/);
  assert.match(html, /data-customer-record="product"/);
  assert.match(html, /id="customerCnSearch"/);
  assert.match(html, /id="customerCnPaste"/);
  assert.match(html, /id="customerCnSave"/);
  assert.match(html, /data-customer-record="facility"/);
  assert.match(html, /id="customerPages"/);
  assert.doesNotMatch(html, /id="customerWorkspace"/);
  assert.match(events, /serviceRegistry\.cbam\.nav\.map/);
  assert.match(html, /data-customer-view-panel="home"/);
  assert.match(html, /data-customer-view-panel="cbam"/);
  assert.match(html, /data-customer-view-panel="tasks"/);
  assert.match(html, /data-customer-view-panel="deliverables"/);
  assert.match(html, /id="customerProductionLinkForm"/);
  assert.doesNotMatch(html, /id="customerCnSector"/);
  assert.match(html, /演示工作区 · 选择角色查看样例数据/);
  assert.match(html, /id="demoRoleSelect"/);
  const demoSelect = html.match(/<select id="demoRoleSelect"[\s\S]*?<\/select>/)?.[0] || "";
  const demoOptions = [...demoSelect.matchAll(/<option value="(customer_owner|customer_admin|customer_contrib|customer_approver|expert|reviewer|ops|sales|importer|verifier|supplier)"/g)].map((match) => match[1]);
  assert.deepEqual(demoOptions, ["customer_owner", "customer_admin", "customer_contrib", "customer_approver", "expert", "reviewer", "ops", "sales", "importer", "verifier", "supplier"]);
  assert.doesNotMatch(html, /data-workspace-role=/);
  assert.match(events, /setLoginStep\("password", true\)/);
  assert.match(events, /portalCustomerPasswordLogin\(email, password\)/);
  assert.match(events, /showCustomerWorkspace\(data\)/);
  assert.match(events, /login\(profile\.role, \{ demo: false \}\)/);
  assert.match(events, /login\(role, \{ demo: true \}\)/);
  assert.match(core, /lumino-portal-session-mode/);
  assert.match(config, /portalDemoBootstrap \? window\.localStorage/);
  assert.match(boot, /lumino-portal-customer-token/);
  assert.match(boot, /sessionMode === "staff" && window\.LuminoLeadsClient\?\.hasStaffSession\(\)/);
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
