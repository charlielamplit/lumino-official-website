# Lumino Portal 下一阶段 Handoff

更新日期：2026-11-16

本文只保留当前有效的实施事实。旧的 67 项测试基线、Python 静态服务器、公开服务成熟度列表和“监测计划完成后才开始收资”的线性顺序均已过期，不再作为执行依据。

## 1. 当前定位

- 当前仓库是静态可验证原型，不是生产系统。
- Portal 已有多服务壳层、企业数据资产、共享任务 / 交付、CBAM 主流程和 PCF 最小闭环。
- 真实认证、服务端授权、数据库、文件存储、跨设备会话、正式计算、报告签发和外部核查协作仍未实现。
- 页面状态、Agent 建议与正式业务事实必须继续分开表达。

## 2. 本轮已经完成

- CBAM 首次进入分为服务启动授权、年度项目创建和项目执行三种状态。
- 系统授权明确年度与服务范围；合同签署不等同于系统激活。
- 创建年度项目后立即启动收资，年度范围、监测计划和数据采集并行推进。
- 年度项目页移除“年度基础 4 / 4”线性进度，项目生命周期收进右上角状态控件。
- `serviceYear` 与目标封存期分离；2026 项目可以在 2027 Q1 继续报告、核查、Finding 整改、重算和修订交付。
- 新增 `annual-project-view-model.js`，年度页项目、范围、计划、角色、周期和里程碑文案从对象动态派生。
- 服务启动授权和未完成年度项目创建阶段不展示 Agent；项目启动收资后才启用。
- Agent Context Contract v1 已实现：从 WorkflowEngine 派生年度项目、期间、工作流和对象引用，并按 context key 隔离本地会话。
- 产品与设施保留为高优先级二级入口，支持产品名称、CN Code、设施和生产路线的受控维护。
- p06–p08 已使用共享 golden-path controller，不再仅以 Agent UI 完成态代替业务状态。

## 3. 当前有效流程

```text
合同签署
  → 系统服务授权（年度 + 服务范围）
  → 创建年度项目并启动收资
     ├─ 产品 / CN Code / 设施年度确认
     ├─ 监测计划制备、复核与修订
     └─ 数据与证据采集
  → 数据关账与受控计算
  → 年度材料包与报告
  → 核查、Finding 整改与重算
  → 修订交付与年度封存
```

正式计算和交付仍需要已确认范围、明确监测方法版本和冻结数据快照；并行收资不等于取消门禁。

## 4. 动态数据边界

年度项目页以下内容必须来自年度项目及关联对象，不得为了 Mock 固定在模板中：

- 企业、服务年度、项目编号、项目状态和目标封存期；
- 当前季度 / 当前工作流、下一里程碑和下一交付；
- 产品、CN Code、设施、生产路线及年度受控版本；
- 监测计划版本、状态、数据源、责任人与修订状态；
- 项目团队、季度包、计算、报告、核查 Finding、整改与重算状态；
- Agent 的年度项目、工作流和对象上下文。

固定内容只允许是字段标签、产品规则、流程解释和不随项目变化的合规说明。

## 5. 下一阶段优先级

1. **P1：服务端上下文与正式动作权威（#73）**——服务端重新解析租户、项目、对象和版本，不能把客户端 Context 当作授权凭证；正式动作进入权限化领域命令与不可变审计。
2. **P1：异步任务、跨设备会话与审计（#73 / #74）**——持久化 conversation / correlation、成功失败、Token、耗时、错误和对象版本；长任务提供幂等、重试、结果校验与状态查询。
3. **P2：多年度并行项目切换**——支持上一年度核查 / 整改与下一年度收资同时存在。
4. **P2：真实数据接入**——把 ViewModel 与 Agent Context 输入从原型种子迁移到服务端年度项目、范围版本、监测计划和工作流对象。
5. **P2：上传与外部协作**——真实文件、解析确认、核查员协作、Finding 往返和修订交付。

## 6. 不要重复或回退

- 不要恢复“监测计划签署完成后才能收资”的线性流程。
- 不要在服务启动授权或未完成年度项目创建阶段展示 Agent。
- 不要把年度项目状态、项目编号、范围数量、版本或责任人写死在页面模板中。
- 不要把 Agent UI 的完成状态当作正式业务完成。
- 不要移除“产品与设施”；它承载产品名称、CN Code、设施和生产路线的年度受控维护。
- 不要覆盖历史计算、报告、核查或 Finding 版本。

## 7. 开始前阅读

1. `docs/reviews/0006_portal-v3-cbam-agent-implementation-audit.md` 第 9–10 节
2. `docs/superpowers/plans/2026-11-16-cbam-cross-year-agent-plan.md`
3. `apps/portal/ARCHITECTURE.md`
4. `apps/portal/DESIGN_SYSTEM.md`
5. `apps/portal/WORKFLOW_ENGINE.md`
6. `packages/agent/domain/annual-project-view-model.js`
7. `packages/agent/domain/cbam-golden-path.js`
8. `packages/agent/domain/agent-context.js`

## 8. 验证基线

```bash
node scripts/local-site-server.mjs 4174
node --test tests/*.test.* packages/agent/tests/*.test.*
node scripts/check-cbam-first-entry.mjs
node scripts/check-cbam-annual-project.mjs
node scripts/check-cbam-onboarding-flow.mjs
git diff --check
```

最近一次完整回归为 179/179；浏览器证据位于：

- `outputs/review/cbam-first-entry-audit.json`
- `outputs/review/cbam-annual-project-audit.json`
- `outputs/review/cbam-onboarding-flow-audit.json`
- `outputs/review/cbam-agent-context-audit.json`

提交或发布前必须重新运行当前分支的测试与浏览器检查，不能把这份历史结果当作新改动的发布证明。
