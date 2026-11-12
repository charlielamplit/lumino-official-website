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
  assert.match(runtime, /cbamGoldenPath\.stage\(pbId\)/);
  assert.match(runtime, /cbamGoldenPath\.command\("p06", "confirm", currentActor\(\)\)/);
  assert.match(runtime, /cbamGoldenPath\.command\("p07", "review", currentActor\(\)\)/);
  assert.match(runtime, /cbamGoldenPath\.command\("p08", "package", currentActor\(\)\)/);
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
