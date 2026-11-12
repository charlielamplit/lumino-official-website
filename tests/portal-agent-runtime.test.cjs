const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Portal 在配置前加载 CBAM 黄金路径控制器", () => {
  const html = read("apps/portal/index.html");
  assert.ok(html.indexOf("cbam-golden-path.js") > html.indexOf("workflow-engine.js"));
  assert.ok(html.indexOf("cbam-golden-path.js") < html.indexOf("portal-config.js"));
});

test("Agent p06-p08 从领域状态派生完成并使用具名操作者", () => {
  const runtime = read("apps/portal/runtime/agent-runtime.js");
  const events = read("apps/portal/runtime/portal-events.js");
  assert.match(runtime, /cbamGoldenPath\.stage\(pbId\)/);
  assert.match(runtime, /cbamGoldenPath\.command\("p06", "confirm", currentActor\(\)\)/);
  assert.match(runtime, /cbamGoldenPath\.command\("p07", "review", currentActor\(\)\)/);
  assert.match(runtime, /cbamGoldenPath\.command\("p08", "package", currentActor\(\)\)/);
  assert.match(events, /cbamGoldenPath\.command\("p07", "review", \{ name: roleConfig\[state\.role\]\.name, role: state\.role \}\)/);
  assert.doesNotMatch(runtime, /step\?\.by === "expert" && state\.agentAs === "client"/);
});

test("预置回答有 1-4 秒延迟且选项和面板暴露完整 ARIA 状态", () => {
  const runtime = read("apps/portal/runtime/agent-runtime.js");
  assert.match(runtime, /1000 \+ Math\.floor\(Math\.random\(\) \* 3001\)/);
  assert.match(runtime, /aria-selected=/);
  assert.match(runtime, /aria-controls=/);
  assert.match(runtime, /role="tabpanel"/);
  assert.match(runtime, /aria-checked=/);
  assert.match(runtime, /data-agent-playbook-select/);
  assert.match(runtime, /trapFocus/);
  assert.match(runtime, /node\.getClientRects\(\)\.length > 0/);
  assert.match(runtime, /returnFocus\.focus\(\)/);
});

test("未命中预置问题调用服务端 Agent API，失败时仍返回可行动反馈", () => {
  const runtime = read("apps/portal/runtime/agent-runtime.js");
  assert.match(runtime, /fetch\("\/api\/advisor"/);
  assert.match(runtime, /Agent API ·/);
  assert.match(runtime, /本地回退/);
  assert.match(runtime, /没有执行工作流操作/);
  assert.doesNotMatch(runtime, /OPENAI_API_KEY|ADVISOR_OPENAI_API_KEY|sk-/);
});

test("问答、起草和执行模式具有不同的可执行语义", () => {
  const runtime = read("apps/portal/runtime/agent-runtime.js");
  assert.match(runtime, /function runComposerTask\(/);
  assert.match(runtime, /function draftComposerReply\(/);
  assert.match(runtime, /startPlaybook\(pb\.id\)/);
  assert.match(runtime, /mode: "draft"/);
  assert.match(runtime, /执行模式需要先选择一个 CBAM 阶段/);
});

test("p06-p08 依据绑定真实对象并且可打开，不再宣称静态文本已链接", () => {
  const runtime = read("apps/portal/runtime/agent-runtime.js");
  const catalog = read("apps/portal/runtime/agent-catalog.js");
  assert.match(runtime, /resolveSource\(/);
  assert.match(runtime, /data-agent-action="open-source"/);
  assert.match(runtime, /只有标记为「可打开」的依据才已绑定到当前演示对象/);
  assert.doesNotMatch(runtime, /Agent 的每个结论都链接到这些来源/);
  assert.match(catalog, /assetId: "EVD-HX-POWER-2026Q3"/);
  assert.match(catalog, /workflowId: "RUN-CBAM-2026Q3-001"/);
  assert.match(catalog, /workflowId: "AP-2026-014"/);
});

test("窄屏保留话题选择和对话、产物面板切换", () => {
  const styles = read("apps/portal/styles.css");
  assert.match(styles, /@media \(max-width: 1199px\)[\s\S]*?\.rt-mobile-bar/);
  assert.match(styles, /is-mobile-right \.rt-center/);
  assert.match(styles, /is-mobile-right \.rt-right/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.rt-dialog/);
});

test("p08 文案和页面状态停在待共享", () => {
  const catalog = read("apps/portal/runtime/agent-catalog.js");
  const pages = read("apps/portal/pages/customer-pages.js");
  assert.match(catalog, /PACKAGE_READY（待共享）/);
  assert.match(catalog, /不会产生发送或回执记录/);
  assert.match(pages, /packageLabels/);
  assert.match(pages, /本原型不执行对外发送/);
});

test("Q3 演示可明确重置工作流、Agent 任务与 UI 草稿", () => {
  const events = read("apps/portal/runtime/portal-events.js");
  ["lumino-multiservice-workflow-v2", "lumino-agent-tasks-v1", "lumino-multiservice-portal-ui-v2"].forEach((key) => assert.match(events, new RegExp(key)));
  assert.match(events, /window\.confirm/);
  assert.match(events, /window\.location\.reload\(\)/);
});
