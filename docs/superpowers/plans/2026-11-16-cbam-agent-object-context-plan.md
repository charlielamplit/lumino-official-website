# CBAM Agent 年度项目与业务对象上下文实施 Plan

关联 Issue：[#72](https://github.com/charlielamplit/lumino-official-website/issues/72)

## 目标

把 Agent 从“跟着页面显示的话题面板”调整为“跟着年度项目及业务对象工作的服务 Agent”。每次对话、playbook、来源、建议和日志都使用同一结构化上下文；页面 ID 仅作为路由信息和无对象时的兼容回退。

## 参考项目结论

参考：`/Users/qikunmac01/Documents/01Charlie/03_Autocoding/bravo-agent-service`

可复用思想：

- `conversationId`：保持会话连续性；
- `serialNo + businessType`：幂等、重复提交保护和异步结果关联；
- `DifyAppBase.inputs`：模型 / 工作流调用使用结构化输入；
- `ChatHistory` 与 AOP：记录用户、会话、任务、成功 / 失败、耗时和错误；
- AI 结果先校验，再转换为业务 View Object。

不直接复用：

- Spring Boot、Dify、Redis、Kafka 和数据库实现不适合当前无构建静态原型；
- 旧项目主要按 user / conversation / workflow type 关联，缺少年度项目、期间、对象版本和权限边界；
- 客户端传来的上下文只能用于问答和原型路由，不能作为正式命令授权依据。

## Context Contract v1

```js
{
  contextVersion: "1.0.0",
  serviceId: "cbam",
  tenantId: "TNT-0018",
  annualProjectId: "CASE-CBAM-2026",
  serviceYear: "2026",
  workstream: "data_collection",
  objectRef: { type: "quarterlyPackage", id: "PKG-2026-Q3-NORDWERK", revision: 1 },
  period: { quarter: "Q3" },
  pageId: "data-calculation",
  conversationId: "agent:CASE-CBAM-2026:data_collection:PKG-2026-Q3-NORDWERK",
  correlationId: "ctx:CASE-CBAM-2026:data_collection:PKG-2026-Q3-NORDWERK"
}
```

### 工作流映射

| 页面 / 内部视图 | workstream | 首选对象 |
|---|---|---|
| 年度项目 | `annual_project` | `serviceCase` |
| 产品与设施 | `scope_master_data` | `annualInclusion` |
| 材料与数据 | `data_collection` | 当前季度 `quarterlyPackage`，其次材料请求 |
| 计算结果 | `calculation` | 当前季度 `calculationRun` |
| 成本情景 | `cost_scenario` | 当前季度 `calculationRun` |
| 报告与交付 | `report_delivery` | 当前年度 / 季度受控交付物 |
| 监测计划 | `monitoring_plan` | `formalArtifact: MONITORING_PLAN` |
| 当前工作 | `current_work` | 年度项目，附当前季度 |

## 实施步骤

1. 新增 `packages/agent/domain/agent-context.js`：构建、验证、稳定 context key、会话与 correlation ID。
2. 在 Portal script 顺序中先于 Agent Runtime 加载该模块。
3. Portal Runtime 从 WorkflowEngine 和当前 UI 状态解析 context，不在模板中固定项目 ID。
4. `agentAvailable()` 使用 context 是否存在和年度项目状态判断；服务授权页及未创建项目阶段继续隐藏。
5. `preferredPlaybookId()` 优先从 workstream 派生，保留旧 PAGE_PLAYBOOK 作为兼容回退。
6. Agent 消息、输入、当前话题和日志按 context key 分桶；页面 / 年度切换时恢复对应桶。
7. `/api/advisor` 请求附带只读结构化 context；正式动作仍由领域命令和权限模块校验。
8. 在 Agent 顶部显示“年度项目 · 工作流 · 对象”摘要，用户可判断当前 Agent 正在处理什么。
9. 增加领域单元测试、Portal 契约测试和跨年度 / 页面切换测试。

## 安全与真实性边界

- context 是定位信息，不是授权凭证。
- 客户端不得通过修改 `objectRef` 获得其他租户或项目数据。
- 模型回答不得改变 WorkflowEngine；正式动作必须调用既有 command controller。
- objectRef 缺失时允许通用问答，但不得伪装成已读取具体项目对象。
- 上下文变化必须显式切换会话，不能把旧项目消息带入新项目。

## 验证

```bash
node --check packages/agent/domain/agent-context.js
node --check apps/portal/runtime/agent-runtime.js
node --test packages/agent/tests/agent-context.test.cjs tests/portal-agent-runtime.test.cjs
node --test tests/*.test.* packages/agent/tests/*.test.*
git diff --check
```

## 完成定义

- 2025 / 2026 / 2027 分别解析到自己的 `CASE-CBAM-{year}`；
- 产品、数据、计算、报告和监测计划解析到对应业务对象；
- 页面、内部 Tab、季度和年度切换会更新 context，并恢复正确会话；
- `/api/advisor` 请求携带结构化 context；
- Agent 日志可关联 conversationId / correlationId；
- 服务授权和未完成年度项目创建阶段无 Agent；
- 新测试及全量回归通过。

## 后续生产化承接

- [#73](https://github.com/charlielamplit/lumino-official-website/issues/73)：服务端重建权威 Context，持久化会话、执行记录与只追加审计；
- [#74](https://github.com/charlielamplit/lumino-official-website/issues/74)：异步任务、幂等键、失败恢复和 AI 输出 Schema / 领域校验；
- 统一实施顺序与契约见 `docs/superpowers/plans/2026-11-16-agent-production-execution-plan.md`。
