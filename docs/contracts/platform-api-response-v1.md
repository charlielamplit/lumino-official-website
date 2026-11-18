# Platform API Response Contract v1

状态：F03-03 契约切片；`/api/staff-login` 与 `/api/leads` 已接入响应信封（Portal 接线另轨）

## 1. 目标与边界

Portal、Agent Gateway 和后台 Worker 不应通过中文错误文案、数据库异常或单独的 HTTP 状态猜测失败原因。本契约统一：

- 成功与失败响应信封；
- 可记录和查询的 `requestId`；
- 对象 revision 的响应位置；
- 稳定错误码、HTTP 状态、是否可重试及前端恢复动作；
- Authority Boundary 到公开 API 错误的不可枚举映射。

本切片不修改 `/api/leads`、数据库 Repository、migration 或 Portal，也不表示现有接口已经迁移完成。

## 2. 成功响应

```json
{
  "ok": true,
  "contractVersion": "1.0.0",
  "requestId": "REQ-01",
  "data": { "lead": { "id": "LM-20261118-0001" } },
  "meta": { "revision": 3 }
}
```

`requestId` 由服务端生成并贯穿授权、Repository、审计和异步任务。受版本控制的单对象响应必须在 `meta.revision` 返回当前正整数 revision；客户端修改请求必须回传其读取到的 revision，不能静默覆盖更新。

## 3. 错误响应

```json
{
  "ok": false,
  "contractVersion": "1.0.0",
  "requestId": "REQ-01",
  "error": {
    "code": "REVISION_CONFLICT",
    "messageKey": "api.revision_conflict",
    "message": "The resource has changed. Refresh and retry.",
    "retryable": false,
    "recovery": "REFRESH_RESOURCE"
  }
}
```

用户界面优先用 `messageKey` 本地化；`message` 是安全的兜底文案。响应不得包含 SQL、堆栈、其他租户标识、Cookie、Authorization Header、会话引用或提交字段原值。

字段校验失败可以附带 `fieldErrors[]`，每项只含 `field`、稳定 `code` 和 `messageKey`，不得回显敏感原值。

## 4. 稳定错误码与前端映射

| code | HTTP | retryable | recovery | Portal 行为 |
|---|---:|---|---|---|
| `VALIDATION_FAILED` | 400 | false | `CORRECT_INPUT` | 保留表单并定位字段 |
| `AUTH_REQUIRED` | 401 | false | `SIGN_IN` | 清理失效本地会话并进入登录 |
| `TENANT_FORBIDDEN` | 403 | false | `CONTACT_ADMIN` | 停止操作，不展示猜测的租户信息 |
| `CAPABILITY_FORBIDDEN` | 403 | false | `CONTACT_ADMIN` | 禁用动作并说明角色范围 |
| `RESOURCE_NOT_FOUND` | 404 | false | `RETURN_TO_LIST` | 返回列表；不区分不存在与跨租户对象 |
| `METHOD_NOT_ALLOWED` | 405 | false | `NONE` | 记录前端集成错误，不自动重试 |
| `REVISION_CONFLICT` | 409 | false | `REFRESH_RESOURCE` | 拉取最新版本后由用户重新确认 |
| `RATE_LIMITED` | 429 | true | `RETRY_LATER` | 按服务端退避信息稍后重试 |
| `DEPENDENCY_UNAVAILABLE` | 503 | true | `RETRY_LATER` | 明示未保存，不创建浏览器正式副本 |
| `INTERNAL_ERROR` | 500 | true | `RETRY_LATER` | 显示 requestId，安全重试或联系支持 |

`retryable=true` 表示同一业务意图可以在满足幂等约束后重试，不表示前端应立即无限重放。
可重试错误可以返回 `retryAfterSeconds`（1–86400）；前端应以该值或更长的退避时间调度重试，不能使用紧密循环。

## 5. Authority Boundary 映射

| Authority code | API code |
|---|---|
| `AUTH_REQUIRED` | `AUTH_REQUIRED` |
| `TENANT_FORBIDDEN` | `TENANT_FORBIDDEN` |
| `PROJECT_NOT_FOUND` | `RESOURCE_NOT_FOUND` |
| `OBJECT_FORBIDDEN` | `RESOURCE_NOT_FOUND` |
| `OBJECT_REVISION_CONFLICT` | `REVISION_CONFLICT` |
| `CAPABILITY_FORBIDDEN` | `CAPABILITY_FORBIDDEN` |
| `AUTHORITY_DEPENDENCY_INVALID` | `INTERNAL_ERROR` |

项目和对象跨租户拒绝统一映射为 `RESOURCE_NOT_FOUND`，避免公开响应成为对象枚举侧信道。内部原因只进入受控审计。

## 6. 采用顺序

1. 后端入口生成或接收受信任的 `requestId`，将领域异常映射为本契约。
2. `/api/staff-login`、`/api/leads` 先完成契约测试，再替换旧 `{ error: string }` 响应。
3. Portal client 只按 `code/recovery` 决定流程，`messageKey` 决定文案。
4. 移除生产路径的 localStorage 成功回退；503 必须明确未正式保存。
5. 真实 PostgreSQL、并发 revision 与跨租户测试通过后，才可把 C2 标为完成。

机器可读实现：

- `packages/platform/contracts/api-response.js`
- `packages/platform/schemas/api-success-response.schema.json`
- `packages/platform/schemas/api-error-response.schema.json`
- `packages/platform/tests/api-response.test.cjs`
