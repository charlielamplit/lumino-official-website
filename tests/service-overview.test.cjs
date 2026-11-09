"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("customer entry renders an independent service overview with close and collapse controls", () => {
  const html = read("apps/portal/index.html");
  const core = read("apps/portal/runtime/portal-core.js");
  const events = read("apps/portal/runtime/portal-events.js");

  assert.match(html, /id="serviceOverviewLayer"/);
  assert.match(html, /id="serviceOverviewDock"/);
  assert.match(core, /state\.serviceOverviewMode = isCustomer\(\) \? "open" : "closed"/);
  assert.match(events, /data-service-overview/);
  assert.match(events, /setServiceOverviewMode/);
});

test("service overview lists the complete catalog without availability groups", () => {
  const page = read("apps/portal/pages/multi-service-pages.js");
  const overview = page.slice(page.indexOf("function serviceOverviewContent"), page.indexOf("function workbenchGreeting"));

  assert.match(overview, /Object\.values\(serviceRegistry\)/);
  assert.match(overview, /services\.map\(serviceOverviewCard\)/);
  assert.doesNotMatch(overview, /已开通/);
  assert.doesNotMatch(overview, /尚未开通/);
  assert.doesNotMatch(overview, /规划中/);
  assert.match(overview, /应对全球绿色要求，我们全程陪伴。/);
  assert.match(page, /function serviceOverviewIcon/);
  assert.match(page, /assets: "leaf"/);
  assert.doesNotMatch(page, /badge-leaf/);
});

test("collapsed service overview uses a dedicated edge dock, not the navigation rail", () => {
  const core = read("apps/portal/runtime/portal-core.js");
  const styles = read("apps/portal/styles.css");

  const customerRail = core.slice(core.indexOf("if (isCustomer())"), core.indexOf("} else {", core.indexOf("if (isCustomer())")));
  assert.doesNotMatch(customerRail, /customerRailExtras\.services/);
  assert.match(styles, /\.service-overview-dock\s*\{/);
  assert.match(styles, /position:\s*fixed/);
  assert.match(styles, /right:\s*0/);
});
