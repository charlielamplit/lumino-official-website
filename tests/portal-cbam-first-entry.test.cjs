"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const Workflow = require("../packages/agent/domain/workflow-engine.js");

const root = path.join(__dirname, "..", "apps", "portal");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("CBAM service activation has an explicit online authorization state machine", () => {
  const workflow = new Workflow.WorkflowEngine({ storage: Workflow.createMemoryStorage() });
  const created = workflow.create({ id: "AUTH-001", type: "serviceActivation", status: "DRAFT", year: "2027" });
  assert.equal(created.status, "DRAFT");
  workflow.transition("AUTH-001", "PENDING_LUMINO_APPROVAL", { actor: "林晓", role: "ops", reason: "提交启动单" });
  workflow.transition("AUTH-001", "PENDING_CUSTOMER_CONFIRMATION", { actor: "王晨", role: "expert", reason: "Lumino 授权服务范围" });
  const active = workflow.transition("AUTH-001", "ACTIVE", { actor: "周岚", role: "customer_admin", reason: "客户线上确认" });
  assert.equal(active.status, "ACTIVE");
  assert.equal(workflow.canTransition("AUTH-001", "DRAFT"), false);
});

test("CBAM persistent navigation is consolidated to five entries", () => {
  const config = read("runtime/portal-config.js");
  const cbamBlock = config.slice(config.indexOf("cbam: {"), config.indexOf("pcf: {"));
  const navBlock = cbamBlock.match(/nav:\s*\[([\s\S]*?)\n\s*\],/)?.[1] || "";
  const entries = [...navBlock.matchAll(/\["([^"]+)",\s*"[^"]+",\s*"([^"]+)"/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(entries, [
    ["work", "当前工作"],
    ["annual-project", "年度项目"],
    ["products", "产品与设施"],
    ["data-calculation", "数据与核算"],
    ["deliverables", "报告与交付"],
  ]);
});

test("first-entry, annual project and consolidated views remain wired", () => {
  const pages = read("pages/customer-pages.js");
  const annualView = fs.readFileSync(path.join(__dirname, "..", "packages", "agent", "domain", "annual-project-view-model.js"), "utf8");
  const core = read("runtime/portal-core.js");
  const events = read("runtime/portal-events.js");
  const agent = read("runtime/agent-runtime.js");
  assert.match(pages, /function renderServiceStart\(/);
  assert.match(pages, /合同签署不等于系统激活/);
  assert.match(pages, /function renderAnnualProject\(/);
  assert.match(pages, /创建项目并启动收资/);
  assert.match(pages, /季度收资与监测方法同步推进/);
  assert.match(annualView, /核查、Finding 整改与重算/);
  assert.match(pages, /LuminoAnnualProjectView\.buildAnnualProjectView/);
  assert.doesNotMatch(pages, /class="annual-journey"/);
  assert.match(pages, /产品与 CN 编码/);
  assert.match(pages, /导入不会直接覆盖主档/);
  assert.match(pages, /function renderDataCalculation\(/);
  assert.match(core, /cbamLegacyPages/);
  assert.match(events, /data-activation-action/);
  assert.match(events, /data-cbam-section/);
  assert.match(agent, /state\.page === "service-start"/);
  assert.match(agent, /state\.page === "annual-project"/);
  assert.match(agent, /state\.page === "data-calculation"/);
  assert.match(agent, /state\.cbamDataView === "data" \? "p06" : "p07"/);
});
