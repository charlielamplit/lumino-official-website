# Portal 共享任务与交付中心契约

| 属性 | 内容 |
|---|---|
| 文档版本 | 0.1.0 |
| 日期 | 2026-10-28 |
| 状态 | 静态原型执行基线 |
| 实现 | `apps/portal/runtime/shared-center-view-model.js` |
| 约束 | 只读投影，不创建平行任务状态机或交付状态 |

## 1. 目标

“我的任务”和“交付中心”是跨服务查询视图，不是新的业务对象来源。页面只能展示现有 Workflow、AgentTask、正式 Artifact 以及它们关联的资产权限结果。

## 2. 权威来源

| 共享中心 | 权威来源 | 页面不得做的事 |
|---|---|---|
| 我的任务 | `WorkflowEngine.list()`；状态为 `READY / READY_PARTIAL` 且仍待确认的 `AgentTaskEngine.list()` | 在页面内维护按角色固定数组、独立完成状态或虚构等待任务 |
| 交付中心 | Workflow 中的 `quarterlyPackage`、`formalArtifact`、`verification` | 根据服务案件状态凭空生成报告；绕过服务频道执行批准、锁定或交付 |

AgentTask 进入任务中心不代表其提议已成为正式事实。只有授权用户完成企业事实或服务绑定确认后，对应提议才退出待处理视图。

## 3. 授权投影顺序

每个对象必须依次通过：

1. `tenantId` 与当前企业一致；
2. 当前角色已获对应 `serviceId` 的服务访问权；
3. 服务筛选条件（如有）一致；
4. 对象引用的资产可由 `asset-view-model.js` 在当前角色和服务上下文中读取；
5. 当前角色拥有该类任务或交付物的职责；
6. 对象仍处于需要处理或可展示的状态。

任一条件失败时不返回占位行，也不泄露对象名称、资产名称、版本或状态。

## 4. Task ViewModel

| 字段 | 含义 |
|---|---|
| `id` | 只读投影 ID，不作为业务对象 ID |
| `serviceId / serviceCode` | 服务路由与显示标识 |
| `sourceType` | `workflow` 或 `agentTask` |
| `sourceId / sourceRevision / sourceStatus` | 可追溯的权威来源 |
| `object` | 已授权对象范围 |
| `title / nextStep` | 当前角色可以执行的动作，不展示无动作的等待事项 |
| `owner` | 当前责任人 |
| `due` | 截止日期、显示文本、语义色与排序等级 |
| `page` | 返回对应服务频道的目标页 |

READY Agent 提议只投影给具备确认职责的 `customer_owner / customer_admin`。独立审批人不会因为可以审批 CBAM 决定而自动获得 Agent 事实确认权限。

## 5. Artifact ViewModel

| 字段 | 含义 |
|---|---|
| `id / serviceId` | 工作流对象和服务 |
| `name / object` | 交付物类型与适用对象 |
| `version / workflowRevision` | 文档版本与工作流记录修订分别展示 |
| `status / rawStatus` | 用户文案与原始状态 |
| `controls.approval` | 审批状态 |
| `controls.lock` | 锁定、封存或核查版本控制状态 |
| `controls.delivery` | 未交付、已发送、已交付或已回执 |
| `snapshotId / calculationRunId` | 可用时显示计算与资产快照依据 |
| `page` | 返回服务频道处理，不在共享中心直接改状态 |

PCF 报告只有在 Workflow 中创建 `formalArtifact` 后才出现。`serviceCase = DELIVERABLE_READY` 本身不能代替报告对象。

## 6. 角色边界

| 角色 | 我的任务 | 交付中心 |
|---|---|---|
| 企业管理员 / 项目协调人 | 获授权协调、确认与数据缺口任务；READY Agent 提议 | 当前企业和服务范围内的受控交付物 |
| 数据贡献者 | 明确分配的数据上传或补充任务 | 仅显式分配或授权的交付物；默认不获得企业全量交付物 |
| 内部审批人 | 明确的具名审批任务 | 获授权受控交付物的只读状态；不能替代独立复核员锁定 PCF 报告 |

## 7. 已验证行为

- 跨租户对象不进入聚合结果；
- 无权读取关联资产时，对应任务和交付物整体隐藏；
- PCF 报告未创建时，交付中心不显示虚假草稿；
- PCF 报告创建并锁定后展示快照、审批和锁定状态；
- 数据贡献者不自动获得企业受控交付物；
- READY Agent 提议进入具备确认职责用户的任务列表，审批人不可见；
- 390 / 768 / 1440px 无整页横向溢出。

## 8. 生产接入前仍需补齐

- 任务分派、截止日期和对象范围由后端返回，不再使用原型投影规则；
- 所有授权必须在服务端重新判定，前端过滤只用于显示；
- 交付回执、下载、撤销、更正和版本冲突需要持久化命令与审计；
- Task / Artifact Schema 和运行时错误码需要纳入共享契约；
- 对空数据、加载失败、离线和服务端拒绝补充真实重试机制。
