# ADR-0001：Agent 生产执行契约与原型 Runtime 分层

状态：Accepted for Phase 0
日期：2026-11-16
关联：#73、#74、#25、#26、#72

## 背景

当前 `packages/agent/runtime/agent-task-engine.js` 已提供适合静态原型的任务状态、`serialNo` 幂等和 proposal-only 结果。Portal 也能按年度项目与业务对象隔离本地会话。这些能力验证了用户流程，但数据来自浏览器存储，不能承担生产环境的身份、对象授权、异步并发、跨设备恢复或正式审计。

历史 `bravo-agent-service` 证明了结构化输入、conversation、异步结果关联和调用审计的价值；Lumino 还必须补足租户、年度项目、对象 revision 和具名确认边界。

## 决策

1. 保留现有 Prototype Runtime，不在 Phase 0 直接改写其状态机。
2. 新增版本化 Production Contracts，定义 Context、Conversation、Execution、Task、Validation、Candidate 和 Audit。
3. 客户端 Context 永远是 hint；服务端根据登录身份、ACL 和领域对象重建权威 Context。
4. 通用队列 / Worker 属于 #26；Agent Task 的幂等、对象版本与 Candidate / Validation 语义属于 #74。
5. 身份、租户、ACL、数据库和对象存储基础属于 #25；#73 不重复建设认证系统。
6. 模型或工具输出只能形成 Candidate；Validator 和具名确认后，仍须通过领域命令才能形成正式对象。
7. 审计事件只追加，并采用数据分类；凭据和完整敏感正文不进入普通日志。
8. Provider、模型、Prompt、工具与存储选型保持可替换，业务契约不依赖 Dify、Spring Boot 或某一云厂商。
9. 每次 Execution 都有独立 `executionId` 与 attempt；Candidate 和 Validation Result 必须引用产生它们的 Execution。
10. 自动迁移使用具名 SYSTEM、WORKER 或 SERVICE_PRINCIPAL 审计主体，不伪装成人类用户。

## 选择理由

- 直接升级原型 TaskEngine 会把本地演示状态与生产数据迁移混在一起，增加回归和误报风险。
- 把 Task、Candidate 和正式对象分开，可以阻止“模型返回成功”等同于“业务结果正式生效”。
- 由服务端生成幂等键和 Context，才能抵抗客户端篡改和跨租户对象枚举。
- 先冻结供应商无关契约，可以在 #25/#26 的实现选型确定前并行推进测试和接口评审。

## 未选择方案

### 直接复制 bravo-agent-service

不采用。其 Spring / Dify / Feign / 回写表属于特定实现，且没有 Lumino 的年度项目和对象 revision 边界。

### 继续使用 `serialNo` 作为唯一幂等键

不采用。相同序列号在不同租户、年度、对象版本或操作类型下可能产生冲突，也无法证明输入是否变化。

### 模型结果直接写入业务对象

不采用。模型输出不可信，且正式范围、计算和交付需要权限、版本、复核与审计。

### Phase 0 同时选择数据库和队列

不采用。具体选型需要 #25/#26 的容量、安全、部署和运维约束；本 ADR 只冻结不应随选型变化的业务契约。

## 影响

正面影响：

- 后端、Portal、Worker 和模型 Adapter 可以围绕相同对象和错误码并行开发。
- 可以独立测试权限边界、幂等、竞态和候选结果生命周期。
- 当前原型继续可用，不会被未完成的生产基础设施阻塞。

代价：

- 过渡期存在 Prototype Runtime 与 Production Contract 两套状态名称。
- Phase 1 / 2 需要显式适配和迁移，不能把浏览器 localStorage 当作正式数据导入。
- JSON Schema 只能验证结构，仍需服务端领域校验和 ACL。

## 后续门禁

- #73 开始实现前，#25 必须提供登录身份、tenant 和对象 ACL 查询接口。
- #74 开始 Worker 集成前，#26 必须确定唯一队列 / Worker 接口。
- 数字保留期限、数据库、队列和对象存储未获批准前，不得进入生产发布。
- 任何正式业务能力均需独立业务票、输入 / 输出 Schema、Validator、确认角色和领域命令。
