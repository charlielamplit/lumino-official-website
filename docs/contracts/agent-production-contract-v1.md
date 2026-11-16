# Agent Production Contract v1

状态：Phase 0 contract baseline
版本：`1.0.0`
关联：#73、#74；依赖 #25、#26；延续 #72

## 1. 适用范围

本契约定义 Lumino Agent 在生产服务端中的公共业务边界，不规定数据库、任务队列、模型供应商或 Web 框架。当前 Portal 的本地 Agent Runtime 继续用于原型；只有服务端按本契约重建的 Context、Execution、Task、Validation、Candidate 和 Audit 才能成为生产依据。

契约文件：

| 对象 | Schema |
|---|---|
| 权威 Agent Context | `packages/agent/schemas/agent-context.schema.json` |
| 模型 / 工具执行信封 | `packages/agent/schemas/agent-execution-envelope.schema.json` |
| 跨设备会话 | `packages/agent/schemas/agent-conversation.schema.json` |
| 只追加审计事件 | `packages/agent/schemas/agent-audit-event.schema.json` |
| 异步任务 | `packages/agent/schemas/agent-task.schema.json` |
| 输出校验结果 | `packages/agent/schemas/agent-validation-result.schema.json` |
| 待确认候选结果 | `packages/agent/schemas/agent-candidate-result.schema.json` |

状态、错误码、版本兼容和幂等材料定义在 `packages/agent/contracts/production-contracts.js`。

## 2. 权威来源

### 客户端可以提交

- 当前页面、年度、季度和对象 ID 等定位提示；
- 用户问题或操作意图；
- 已上传文件的受控引用；
- 客户端生成的 request hint，用于体验关联但不作为最终 ID。

### 服务端必须重建

- 登录用户、租户和角色；
- 年度项目是否存在以及是否属于该租户；
- `objectRef.type / id / revision`；
- 用户对能力、对象和正式命令的权限；
- request、correlation、conversation、task、execution、candidate 和 audit ID；
- 幂等键。

客户端修改 `tenantId`、`annualProjectId`、`objectRef` 或角色，不能扩大其读取或操作范围。

## 3. 记录关系

```text
Conversation 1 ── n Execution
                    │
                    ├── 0..1 Task ── 1..n Execution attempts
                    │                  │
                    │                  └── Candidate ── Validation Result
                    │                                      │
                    │                                      └── human review
                    │                                             │
                    └───────────────────────────────────────────── Domain Command

Every transition ── Append-only Audit Event
```

- Execution 记录一次真实模型或工具调用；`executionId + attempt` 是一次尝试的稳定身份，不能用 `requestId` 代替。
- Task 记录一个可重试的业务任务；重试保持同一 `taskId`，每次 attempt 生成新 Execution。
- Candidate 是模型或工具输出的受控引用，不是正式业务对象；它必须引用实际生成它的 `executionId`。
- Validation Result 不修改 Candidate，只记录某个 Validator 版本对其的判断，并保留 `executionId` 以完成 attempt 级追溯。
- Domain Command 成功后生成或修订正式业务对象，Candidate 才进入 `APPLIED`。

## 4. 状态语义

### Execution

```text
REQUESTED → RUNNING → SUCCEEDED
                   ↘ FAILED
REQUESTED → FAILED（启动前校验或派发失败）
REQUESTED / RUNNING → CANCELLED
```

Execution 完成状态必须记录 `finishedAt` 和 `durationMs`；失败必须记录稳定错误码与 `retryable`。
`requestId` 用于 API 请求关联，`executionId` 用于执行实体身份，二者不可混用。

### Task

```text
QUEUED → PROCESSING → VALIDATING → SUCCEEDED
   │          │             │
   └──────────┴─────────────┴→ FAILED
QUEUED / PROCESSING → CANCELLED
PROCESSING / VALIDATING / SUCCEEDED → SUPERSEDED
FAILED → QUEUED（仅限可重试且未超过 maxAttempts）
```

取消、完成和版本变化必须使用条件更新；终态不能被迟到的 Worker 回调覆盖。

### Candidate

```text
DRAFT → VALIDATING → READY_FOR_REVIEW → CONFIRMED → APPLIED
                     ↘ VALIDATION_FAILED             ↘ APPLY_FAILED
READY_FOR_REVIEW → REJECTED
DRAFT / VALIDATING / READY_FOR_REVIEW → SUPERSEDED
```

`APPLIED` 是终态。已经写入正式对象的结果如需修正，必须创建新的修订或撤销命令，不能改写原 Candidate。

## 5. 幂等规则

服务端先对业务输入生成稳定的规范化快照，再计算 SHA-256。幂等材料固定为：

```text
v1|tenantId|annualProjectId|operationType|objectType|objectId|objectRevision|normalizedInputHash
```

实现必须对各段进行无歧义编码，再对完整材料 Hash。以下任一变化都必须产生不同的幂等键：租户、年度项目、操作类型、对象类型、对象 ID、对象 revision 或规范化输入。

相同幂等键的语义：

- 存在 `QUEUED / PROCESSING / VALIDATING`：返回现有任务，不重复执行；
- 存在 `SUCCEEDED`：返回现有结果，除非调用方明确申请基于新输入或新对象版本创建任务；
- 存在可重试 `FAILED`：增加 attempt，不创建第二个业务任务；
- 存在 terminal `FAILED / CANCELLED / SUPERSEDED`：根据 operation policy 决定拒绝或要求产生新输入版本。

## 6. 错误码

错误码分为 `authorization`、`context`、`contract`、`execution`、`provider`、`task`、`validation` 和 `domain`。完整机器可读目录位于 `production-contracts.js`。

规则：

- API 响应、Execution、Task 和 Audit 使用同一稳定 code；
- 面向用户的文案可以本地化，但不能替代错误码；
- `retryable` 由服务端目录与当前 attempt 决定，不能由客户端声明；
- 权限、对象版本和业务校验失败默认不可自动重试；
- Provider 超时、限流和临时不可用可以重试，但必须受 `maxAttempts` 与退避策略约束。

状态机 helper 只能表达结构允许性；`FAILED → QUEUED` 还必须同时收到服务端事实：`retryable=true` 且 `attempt < maxAttempts`。

## 7. 审计主体与迁移事件

- 每次 Task、Candidate、Validation、Execution 与 Domain Command 的状态变化都生成只追加事件；
- `actorType` 区分 `USER`、`SYSTEM`、`WORKER` 和 `SERVICE_PRINCIPAL`，不得用虚构用户表示自动执行；
- `actorId` 保存实际用户、Worker 或服务主体标识，`tenantId` 仍是必填隔离边界；
- 事件应携带可用的 `executionId`、`taskId`、`candidateId` 与 `domainCommandId`，但不复制敏感正文。

## 8. 数据最小化与保留类别

### 永不进入普通日志

- API Key、密码、Cookie、Authorization Header；
- 未脱敏的完整附件正文；
- 用户在 Prompt 中粘贴的无关个人信息；
- 可直接下载敏感文件的长期公开 URL。

### 记录引用而不是正文

- `inputRefs`、`fileRefs`、`inputSnapshotRef`、`resultRef`；
- 对象 ID、revision、文件 Hash、Schema / Prompt / Model / Tool 版本；
- Token、耗时、状态、错误码和脱敏摘要。

### 保留类别

| 类别 | 内容 | 数字期限 |
|---|---|---|
| `AUDIT_LONG` | 权限判断、正式命令、具名确认、对象版本与审计链 | 必须由法务 / 信息安全批准后配置 |
| `OPERATIONAL_SHORT` | 调试指标、短期 Provider 响应摘要、队列诊断 | 必须由运维策略配置 |
| `SENSITIVE_REFERENCE_ONLY` | 敏感附件和高风险输入 | 审计仅保存受控引用与 Hash，正文按对象存储策略 |

Phase 0 不虚构法定年限。未配置并经批准前，不得进入生产环境。

## 9. Provider / Tool Adapter 最小接口

```js
{
  name,
  version,
  supports(capability),
  execute({ execution, structuredInput, signal }),
  normalizeUsage(providerResponse),
  normalizeError(providerError),
  redactForAudit(providerRequestOrResponse)
}
```

要求：

- `execute` 不接收浏览器凭证；认证信息由服务端 Adapter 注入。
- 取消通过 `signal` 传播，但服务端仍需处理取消与完成竞态。
- Provider 原始响应先进入受控结果存储，再由 Validator 解析。
- Adapter 不执行领域确认、审批、交付或正式对象写入。

## 10. 版本兼容

- 所有生产契约使用 SemVer。
- 同一主版本内允许增加可选字段或新错误码。
- 新增必填字段、删除字段、改变字段语义或状态迁移必须提升主版本。
- 服务端收到不兼容版本时返回 `CONTEXT_VERSION_UNSUPPORTED` 或相应 contract error，不静默猜测。
- Schema `$id` 包含版本；审计记录永远保存实际使用的 Schema / Validator / Prompt / Tool 版本。

## 11. Phase 0 验收

- 所有 Schema 是合法 JSON Schema Draft 2020-12，根对象禁止未知字段。
- Schema 枚举与运行时合同常量一致。
- 状态机、版本兼容、错误码和幂等材料有自动化契约测试。
- ADR 明确原型 Runtime 与生产契约的迁移关系。
- #73 / #74 的后续实现不得绕过 #25 / #26 的身份、ACL 和队列基础。
- 本阶段不接模型、不创建数据库、不执行正式业务命令。
