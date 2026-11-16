# Portal Workflow Engine

更新日期：2026-11-16

Portal 原型以 `packages/agent/domain/workflow-engine.js` 作为对象状态、合法迁移、依赖失效和审计事件的可执行来源。页面和 Agent 不得另建平行业务状态机。

## Runtime 文件

- `packages/agent/domain/workflow-engine.js`：工作流对象、迁移、审计与本地持久化。
- `packages/agent/domain/annual-project-view-model.js`：年度项目、范围、计划、角色和季度状态的只读页面投影。
- `packages/agent/domain/cbam-golden-path.js`：p06–p08 数据确认、复核、审批和材料包门禁。
- `apps/portal/runtime/portal-config.js`：原型角色、年度对象、工作流与资产种子。
- `apps/portal/runtime/portal-core.js`：状态持久化、Shell、共享组件和 Drawer。
- `apps/portal/runtime/portal-events.js`：把用户动作翻译成受保护的工作流命令。
- `apps/portal/runtime/agent-runtime.js`：Agent 对话与 playbook UI；正式业务结果必须从领域对象回读。

当前浏览器存储键：

- 工作流：`lumino-multiservice-workflow-v2`
- UI 草稿：`lumino-multiservice-portal-ui-v2`

## 年度项目对象

年度项目至少区分：

- `serviceYear`：申报数据归属年度；
- 当前项目状态与当前工作流；
- `targetClosePeriod`：目标封存期；
- 年度范围版本、监测计划版本和责任角色；
- Q1–Q4 数据包及年度报告、核查、Finding、整改、重算和修订交付状态。

`serviceYear` 不等于关闭日期。上一年度核查 / 整改可以与下一年度收资并行存在。

## 主流程与并行规则

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

- 监测计划不是开始上传材料的前置门禁；数据发现可以触发方法修订。
- 预估计算可以使用明确标注的未齐数据和方法草稿。
- 正式计算、受控报告与对外交付必须引用已确认范围、明确方法版本和冻结数据快照。
- Finding 整改不得覆盖原有计算、报告或交付版本。

## 不变量

- 每次正式迁移必须包含 actor、role、reason 和对象版本。
- `expectedRevision` 用于防止陈旧写入；重复命令必须幂等。
- `ACKNOWLEDGED` 必须有 receipt ID；`LOCKED` 必须有 snapshot ID。
- 核查方提出的 Finding 只能由有权主体关闭，并要求整改证据。
- 年度页面状态由领域对象派生，不得反向写入子对象。
- Agent 只能建议、整理、计算草稿和提出变更；具名范围确认、方法批准、独立复核和正式交付仍由授权人员完成。
- Agent 在服务启动授权和未完成年度项目创建阶段不可用；启动收资后应携带 `annualProjectId + serviceYear + workstream + objectRef`。

## 验证

```bash
node --check packages/agent/domain/workflow-engine.js
node --check packages/agent/domain/annual-project-view-model.js
node --check packages/agent/domain/cbam-golden-path.js
node --check apps/portal/runtime/portal-config.js
node --check apps/portal/runtime/portal-core.js
node --check apps/portal/runtime/portal-events.js
node --check apps/portal/pages/customer-pages.js
node --test tests/*.test.* packages/agent/tests/*.test.*
```

当前仍是静态可验证原型。生产系统必须把认证、授权、事务、时钟、审计不可变性和存储权威迁移到服务端。
