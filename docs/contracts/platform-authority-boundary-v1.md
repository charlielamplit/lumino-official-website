# Platform Authority Boundary v1

状态：#25 第一切片，接口契约已实现，生产 Provider 未接入

## 目标

为 #73 提供不可由浏览器伪造的服务端身份、活动租户、成员角色、年度项目、对象 ACL 与 revision 解析边界。该契约不选择 IdP、数据库或对象存储，也不把内存测试夹具描述为生产持久化。

## 请求边界

调用方只提交：

- `sessionRef`：交给服务端 Identity Provider 解析；不得写入普通日志；
- `capability`：希望调用的 Agent 能力；
- `clientHint`：年度项目 ID、对象 ID/type/revision 等定位提示。

`clientHint.tenantId`、角色、年份、workstream 和对象属性均不具备授权效力。

## 服务端依赖接口

| 接口 | 责任 |
|---|---|
| `identityProvider.resolveSession(sessionRef)` | 返回真实 `userId / sessionId / activeTenantId`；过期或撤销会话返回空 |
| `membershipRepository.findActive({ userId, tenantId })` | 返回当前有效成员关系和角色 |
| `annualProjectRepository.findByIdForTenant(...)` | 在租户作用域内查询年度项目，避免跨租户枚举 |
| `objectRepository.findCurrentByIdForTenant(...)` | 在租户和年度项目作用域内查询当前对象 revision |
| `capabilityPolicy.canUse(...)` | 使用服务端角色、项目和对象判断能力权限 |
| `auditSink.append(event)` | 记录允许/拒绝决定，不记录会话凭据和敏感正文 |

## 解析顺序

```text
session → active tenant → active membership
        → tenant-scoped annual project
        → tenant/project-scoped current object
        → revision check → capability policy
        → authoritative actor + Agent Context
```

任一步失败即 fail closed。跨租户或不存在对象使用同一公开 404 语义，普通响应不能证明其他租户对象是否存在。
Provider / Repository 返回缺失租户、年份、workstream、类型或 revision 的畸形记录时，以内部依赖错误失败，不能把 `undefined` 等值写入权威 Context。

## 审计

每次决定记录 `AUTHORIZATION_DECIDED`：时间、结果、reasonCode、actor、tenant、capability 及在授权阶段已经确认安全的对象引用。不得记录 `sessionRef`、Cookie、Authorization Header 或附件正文。

## 当前完成边界

已完成：

- Provider / Repository 接口及组合边界；
- 客户端 tenant/role/year/workstream 篡改负向测试；
- 跨租户不可枚举、过期 revision、能力拒绝与允许审计测试；
- Principal 与 Authorization Decision JSON Schema。

尚未完成，因此 #25 不能关闭：

- 真实 IdP、会话撤销和 MFA；
- 数据库迁移、成员关系和对象 ACL 持久化；
- 对象存储、密钥轮换、保留/删除策略；
- 登录、敏感读取、授权查询的生产审计存储与运维验证。
