# Agent 服务端执行、异步任务与结果校验实施 Plan

关联 Issue：[#73](https://github.com/charlielamplit/lumino-official-website/issues/73)、[#74](https://github.com/charlielamplit/lumino-official-website/issues/74)

上位能力：[#25](https://github.com/charlielamplit/lumino-official-website/issues/25)、[#26](https://github.com/charlielamplit/lumino-official-website/issues/26)

前置原型契约：[#72](https://github.com/charlielamplit/lumino-official-website/issues/72)

## 1. 目标与完成边界

把当前浏览器中的 Agent Context 原型升级为可生产运行的服务端能力：服务端重建权威业务上下文，持久化会话和只追加审计；耗时操作进入可观察、幂等、可重试的任务系统；任何模型输出在进入业务对象前完成 Schema、版本和业务规则校验。

完成后应能回答四个问题：

1. 谁在什么权限下，对哪个年度项目和哪个版本的对象发起了什么 Agent 能力？
2. 本次模型、工具或工作流实际使用了什么输入引用、版本和执行配置？
3. 长任务当前是什么状态，是否重复、失败、重试或被新版本取代？
4. 哪个结果通过了什么校验，并由谁确认后进入了哪个业务对象版本？

本 Plan 不选择具体模型供应商、队列或服务端框架，也不把当前本地原型状态表述为生产能力。

## 2. 历史项目参考与 Lumino 取舍

参考项目：`/Users/qikunmac01/Documents/01Charlie/03_Autocoding/bravo-agent-service`

| 历史机制 | Lumino 采用方式 |
|---|---|
| `DifyAppBase.inputs` | 统一服务端 Execution Envelope，模型与工具均使用结构化输入和对象引用 |
| `conversationId` | 持久化会话，但进一步绑定租户、年度项目、工作流和业务对象 |
| `serialNo + businessType` | 改为服务端生成的 `idempotencyKey + operationType`，纳入对象版本与规范化输入 Hash |
| `ChatHistory` / AOP | 形成供应商无关的调用审计、Token/耗时/状态指标和只追加事件 |
| 异步结果回写 | 形成统一 Agent Task 状态机、结果引用和失败恢复 |
| AI 结果先校验再转 VO | 使用 JSON Schema + 领域规则 + 对象版本门禁，结果先成为候选草稿 |

不直接迁移 Spring Boot、Dify、Feign、Redis 或既有数据库表；这些属于实现选型，不是业务契约。

## 3. 总体架构

```text
Portal / API Client
  → Authenticated Agent Gateway
     → Context Resolver + Authorization
        → Conversation Store
        → Execution Orchestrator
           ├─ Synchronous model/tool call
           └─ Agent Task Queue
                → Worker / Provider Adapter
                → Output Validator
                → Candidate Result Store
                → Human confirmation / domain command
     → Append-only Audit + Metrics + Alerts
```

关键边界：

- 客户端 Context 是定位提示，不是权限或对象存在性的证明。
- 模型输出是非可信输入；即使格式正确，也必须通过领域校验。
- Agent 不直接改变受控对象；正式写入经过权限化领域命令。
- 审计事件只追加；业务对象版本不得被异步回调静默覆盖。

### Issue / Phase 所有权

| 能力 | 直接负责 Issue | 本 Plan 中的交付边界 |
|---|---|---|
| 身份、租户、ACL、数据库 / 对象存储基础 | #25 | #73 / #74 的前置平台能力，不在两票内重复建设 |
| 权威 Context、会话、Execution、审计事件 | #73 | Phase 0 的相关 Schema + Phase 1；完成后可独立关闭 #73 |
| 通用队列、Worker、可观测性、备份恢复 | #26 | #74 依赖的平台能力；Phase 4 主要由 #26 承接 |
| Agent Task、幂等、Candidate、Validation | #74 | Phase 0 的相关 Schema + Phase 2；首个低风险能力通过 Phase 3 后关闭 #74 |
| 各业务能力的完整接入 | 后续按文件解析、CN Code、计算、报告分别建票 | 复用 #73 / #74 契约，不反向扩大两票范围 |

#26 负责“队列和 Worker 能可靠运行”，#74 负责“Agent 任务如何生成幂等键、关联对象版本、校验结果并进入人工确认”。二者不得各自实现一套任务基础设施。

## 4. 核心契约

### 4.1 Execution Envelope

```js
{
  requestId,
  correlationId,
  conversationId,
  actor: { userId, tenantId, roles },
  agent: { capability, provider, model, promptVersion, toolVersions },
  context: {
    serviceId,
    annualProjectId,
    serviceYear,
    workstream,
    objectRef: { type, id, revision },
    period
  },
  inputRefs: [],
  fileRefs: [],
  startedAt,
  finishedAt,
  durationMs,
  tokenUsage,
  status,
  error: { code, message }
}
```

服务端必须用登录会话和领域仓库重新生成 `actor` 与 `context`；不得原样信任浏览器传入值。

字段规则：

- `requestId`、`correlationId`、`actor`、`agent.capability`、`context`、`startedAt`、`status` 必填；
- `conversationId` 仅在会话型能力中必填，批处理任务可以为空；
- `context.objectRef` 是本次执行所针对对象及版本的唯一来源，其他记录只引用该 Context，不复制第二份可变对象版本；
- `provider / model / promptVersion / toolVersions` 在真实调用发生后必填；
- `finishedAt / durationMs / tokenUsage / error` 随执行完成追加，其中失败必须具有稳定 `error.code`；
- 时间统一使用 UTC ISO-8601，耗时使用非负整数毫秒；
- Contract 采用显式 `schemaVersion`，只允许向后兼容地增加可选字段；删除、改名或改变语义必须升级主版本。

### 4.2 Agent Task

```js
{
  schemaVersion,
  taskId,
  idempotencyKey,
  operationType,
  context,
  inputSnapshotRef,
  status,
  attempt,
  maxAttempts,
  resultRef,
  validationResultRef,
  correlationId,
  createdBy,
  createdAt,
  startedAt,
  finishedAt,
  error
}
```

任务状态：

```text
QUEUED → PROCESSING → VALIDATING → SUCCEEDED
                    ↘ FAILED → QUEUED（创建新 attempt，保留同一 taskId）
QUEUED / PROCESSING → CANCELLED
PROCESSING / VALIDATING / SUCCEEDED → SUPERSEDED（源对象或输入版本已变化）
```

竞态规则：

- 取消通过 compare-and-set 进行；已经进入 `SUCCEEDED` 的任务不能改为 `CANCELLED`；
- 每次重试增加 `attempt` 并产生独立 Execution，taskId 与幂等键保持不变；
- Worker 必须在开始和结果写入前再次检查任务状态及 `context.objectRef.revision`；
- `FAILED` 分为 retryable 与 terminal，只有 retryable 且未超过 `maxAttempts` 才可自动重试；
- `SUPERSEDED` 只表示候选结果不再适用于当前对象版本，不删除原任务和审计记录。

建议幂等键：

```text
hash(tenantId + annualProjectId + operationType + objectId + objectRevision + normalizedInputHash)
```

### 4.3 Validation Result

```js
{
  schemaVersion,
  valid,
  errors: [{ path, code, message }],
  warnings: [{ path, code, message }],
  sourceObjectRevision,
  validatedAt,
  validatorVersion
}
```

校验分三层：

1. 结构校验：JSON、必填字段、类型、枚举和格式。
2. 数据校验：数值范围、单位、CN Code、期间、引用对象和文件完整性。
3. 业务门禁：对象版本仍有效、前置确认已满足、操作者具备相应能力。

### 4.4 Candidate Result

模型或工具输出不能因 Task `SUCCEEDED` 而自动成为正式业务对象。候选结果使用独立生命周期：

```text
DRAFT → VALIDATING → READY_FOR_REVIEW → CONFIRMED → APPLIED
                     ↘ VALIDATION_FAILED
READY_FOR_REVIEW → REJECTED
DRAFT / VALIDATING / READY_FOR_REVIEW → SUPERSEDED
CONFIRMED → APPLY_FAILED → CONFIRMED（修复后重试领域命令）
```

- `CONFIRMED` 记录具名操作者、角色、理由和确认时引用的源对象版本；
- `APPLIED` 必须关联成功的领域命令与新业务对象版本；
- 已 `APPLIED` 的结果不能再改为 `SUPERSEDED`，只能通过新的修订或撤销命令处理；
- Validation Result、Candidate 和正式对象各自有稳定 ID，并通过引用关联，不相互覆盖。

## 5. 分阶段实施

### 阶段门禁总表

| 阶段 | 必须具备的输入 | 可验证退出产物 | 阻塞条件 |
|---|---|---|---|
| Phase 0 | #72 Context v1、#25/#26 目标边界 | 版本化 Schema、错误码、ADR、安全与保留策略 | 身份来源、对象权威仓库或任务基础设施责任不明确 |
| Phase 1 | #25 至少提供登录身份、tenant 和对象 ACL 查询 | #73 API、存储迁移、隔离 / 恢复测试、回滚方案 | 客户端仍能决定 tenant / ACL |
| Phase 2 | #26 提供唯一队列 / Worker 接口和执行语义 | #74 Task API、幂等并发测试、重试 / 取消 / 版本竞态测试 | 团队计划另建第二套队列或无稳定对象 revision |
| Phase 3 | Phase 1/2 通过；选定低风险业务能力 | 输入 / 输出 Schema、Validator、Candidate 确认与领域命令证据 | 业务确认角色、正式对象命令或样例数据未定义 |
| Phase 4 | #26 可部署的观测和恢复基础 | 告警、容量、备份恢复与供应商切换演练 | 无生产环境负责人或回滚路径 |

### Phase 0：契约冻结与技术决策

- 为 Execution Envelope、Agent Task、Validation Result 建立版本化 Schema。
- 建立供应商无关的 provider / model / tool adapter 接口。
- 记录数据库、队列、对象存储、日志与指标选型 ADR。
- 为敏感数据、附件正文、Prompt 和模型响应确定保留与脱敏规则。
- 明确每个 Schema 的必填 / 可空字段、枚举、错误码、时间语义和版本兼容规则。
- 明确数据库表 / 集合、队列、对象存储、API 和运行看板的负责团队及迁移 / 回滚产物。

退出条件：Schema、ADR、安全边界和错误码完成评审；尚不接正式业务动作。

### Phase 1：服务端 Context、会话与审计（#73）

- 服务端根据身份解析 tenant、annualProject、workstream、objectRef 和 revision。
- 建立 conversation、message、execution 与 audit event 持久化。
- 保存 provider/model、Prompt/工具版本、Token、耗时、状态与错误。
- 支持按 request / correlation / conversation / object 查询完整链路。
- Portal 从本地会话桶平滑迁移到服务端会话，保留离线失败提示，不伪造已保存。

退出条件：越权、跨租户、过期版本和跨年度串线测试全部通过；跨设备恢复成立。

### Phase 2：异步任务与幂等（#74）

- 建立任务提交、状态查询、取消、重试和结果获取接口。
- 实现服务端幂等键、并发去重、attempt 记录、超时和退避重试。
- 结果只写 Candidate Store；异步回调不得直接覆盖受控领域对象。
- 建立队列积压、失败率、耗时和回写失败告警。

退出条件：重复提交只产生一个有效执行；失败可安全重试；旧版本结果不会覆盖新版本。

### Phase 3：输出校验与首批业务能力

按风险从低到高接入；每一项另建业务接入票，#74 只负责共同契约和首个参考实现：

1. 文件解析和字段候选；
2. 数据缺项 / 一致性检查；
3. CN Code 候选与依据；
4. 计算输入准备和异常解释；
5. 材料包 / 报告草稿。

每项能力必须提供：输入 Schema、输出 Schema、领域校验、确认角色、失败恢复、对象版本规则和验收样例。

退出条件：以“文件解析和字段候选”作为 #74 参考实现，任何非法或过期结果都不能进入正式对象；具名确认和版本引用可追溯。后续能力通过各自业务票验收。

### Phase 4：运维与恢复

- 对模型供应商失败、队列故障、对象存储故障和回写失败进行演练。
- 建立容量、成本、Token、P95 耗时、失败率和重试率看板。
- 建立数据保留、导出、删除、备份和恢复流程。
- 为供应商切换和模型版本升级提供回归基准与灰度策略。

退出条件：恢复演练、告警闭环和版本回退均有证据。

## 6. API 草案

```text
POST   /api/agent/conversations
GET    /api/agent/conversations/:id
POST   /api/agent/executions
GET    /api/agent/executions/:requestId
POST   /api/agent/tasks
GET    /api/agent/tasks/:taskId
POST   /api/agent/tasks/:taskId/cancel
POST   /api/agent/tasks/:taskId/retry
GET    /api/agent/tasks/:taskId/result
POST   /api/agent/candidates/:resultId/confirm
POST   /api/agent/candidates/:resultId/reject
```

所有接口从服务端会话读取身份；查询和操作均重新校验 tenant、annualProject、object capability 和 revision。

## 7. 测试矩阵

### 契约与领域测试

- Context 重建、版本兼容和错误码。
- 幂等键稳定性、规范化输入和并发重复提交。
- 状态机合法 / 非法迁移、取消和重试。
- Schema、CN Code、单位、期间和对象版本校验。

### 安全测试

- 跨租户、越权对象、伪造角色、篡改 revision。
- Prompt / 文件名注入、超大输入、恶意附件与敏感日志泄漏。
- API Key、密码和完整敏感正文不进入普通日志。

### 集成与恢复测试

- 模型超时、限流、无效响应、部分响应和供应商不可用。
- Worker 崩溃、重复投递、结果重复回写和数据库暂时不可用。
- 对象版本在任务执行期间变化，结果被正确标记为 `SUPERSEDED`。
- 跨设备会话恢复与不同年度 / 季度 / 对象隔离。

### 用户验收

- 用户能看见当前 Agent 处理的项目、对象、任务状态和错误恢复方式。
- 用户能区分模型建议、待确认草稿、已确认版本和正式交付。
- 用户取消或重试不会生成重复正式结果。

## 8. 迁移与兼容

- 保留当前 `agent-context.js` 作为客户端显示与路由契约；服务端返回权威 Context 后覆盖本地推断。
- 当前 `agentSessions` 只作为原型 / 临时草稿，不导入正式审计；上线服务端会话时明确提示迁移边界。
- `/api/advisor` 可在过渡期适配 Execution Envelope，但正式工具和领域命令必须使用新接口。
- PAGE_PLAYBOOK 继续作为无对象时的兼容回退，不能决定正式业务权限。

## 9. 完成定义

### #73 可关闭条件

- Execution Envelope 与 conversation / message / audit event Schema 已版本化并发布；
- 服务端重建 Context，跨租户、越权对象、篡改 revision 和伪造角色测试全部拒绝；
- 跨设备会话恢复成立，2026 / 2027 及不同对象不会串线；
- 每次执行可查询 actor、对象版本、provider/model、Prompt/工具版本、Token、耗时、状态和错误；
- 迁移与回滚演练通过，本地 `agentSessions` 不再被表述为正式审计；
- 日志脱敏和保留策略有自动化检查及审查证据。

### #74 可关闭条件

- Agent Task、Validation Result、Candidate Result Schema 与状态机已版本化并发布；
- 并发重复提交测试证明相同幂等键只有一个有效执行；每次 attempt 独立可追溯；
- 取消 / 完成竞态、超时、retryable / terminal 失败和对象 revision 变化测试通过；
- 非法 JSON、缺字段、异常数值和过期对象结果均不能形成可确认 Candidate；
- “文件解析和字段候选”完成端到端参考实现：任务、校验、人工确认和领域命令可追溯；
- 队列或模型故障恢复测试通过，并对失败率、积压和 P95 耗时建立可验证告警。

### 上位 #25 / #26 与后续业务票

备份恢复、供应商切换和全平台运维能力由 #25 / #26 验收，不阻塞 #73 / #74 在其明确范围内关闭。CN Code、计算和报告等高风险能力分别通过后续业务票验收，不因共同契约完成而被视为已生产化。

## 10. 推荐执行顺序

1. 先完成 Phase 0：冻结共同 Schema、ADR、错误码、数据安全与责任边界。
2. #25 提供登录身份、租户、ACL 查询和持久化基础，达到 Phase 1 门禁。
3. #73 建立权威 Context、会话、Execution 和审计，并独立验收。
4. #26 提供唯一任务队列 / Worker 接口；#74 在其上实现 Agent 幂等、Validation 与 Candidate 契约。
5. 用文件解析 / 字段候选完成 #74 端到端参考实现并独立验收。
6. 分别建票接入数据检查、CN Code、计算和报告草稿。
7. 最后开放任何可能产生正式业务对象的 Agent 动作。

## 11. Phase 0 实施状态

契约基线已完成，待提交与评审（分支：`feature/agent-production-contracts`）：

- 已建立 Context、Execution、Conversation、Audit、Task、Validation 和 Candidate 的 JSON Schema v1；
- 已建立状态机、稳定错误码、SemVer 兼容与幂等材料模块；
- 已建立生产契约说明与 ADR-0001，明确 #25 / #26 / #73 / #74 所有权；
- 已增加 Schema 引用、枚举一致性、状态迁移、错误目录和幂等材料契约测试；
- 已经独立读者复核并修正终态非空约束、attempt 级来源追溯、自动执行审计主体、条件重试与错误目录缺口；
- 本地完整回归 `190/190` 通过，语法、JSON 解析与 `git diff --check` 通过；
- 尚未接数据库、队列、Provider、模型或正式领域命令，不能作为生产能力声明。

## 12. Phase 1 前置门禁进展

#25 第一切片已在 `feature/platform-authority-boundary` 建立服务端 Authority Boundary：

- Identity Provider、成员关系、租户作用域年度项目、租户/项目作用域对象、能力策略和授权审计采用可替换接口；
- 客户端 tenant、role、year、workstream 与对象属性只作为 hint，不进入权威 actor/context；
- 跨租户项目/对象不可枚举，旧 revision 与无权 capability 失败关闭；
- 当前仅是接口契约和测试夹具，尚无真实 IdP、数据库、对象存储或生产审计，因此 Phase 1 尚未解锁。
