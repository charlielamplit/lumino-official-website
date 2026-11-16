# 线索收件箱 API

**用途**：接收官网和试算器线索，并为 Portal 中的运营 / 销售人员提供查询与状态更新。

**当前阶段**：静态原型配套的轻量 API，不是完整 CRM。

**数据边界**：优先写入 `data/leads.json` 或 Serverless 可写目录；写入失败时可能仅保存在当前进程内存。生产环境应迁移至数据库。

**安全边界**：员工登录目前换取共享 `LEADS_STAFF_KEY`，只适合受控演示，不是生产身份系统。

## 1. 接口总览

| 接口 | 用途 | 授权 |
|---|---|---|
| `POST /api/leads` | 提交线索 | 公开；需字段校验和联系授权 |
| `GET /api/leads` | 查询线索列表或单条线索 | `X-Lumino-Staff-Key` |
| `PATCH /api/leads` | 认领、更新状态和追加备注 | `X-Lumino-Staff-Key` |
| `GET /api/staff-login` | 检查员工登录是否配置 | 公开，不返回账号或密钥 |
| `POST /api/staff-login` | 验证演示员工账号并返回共享 staff key | 邮箱 + 密码 |

## 2. 员工登录

### `GET /api/staff-login`

```json
{
  "ok": true,
  "configured": true,
  "roles": ["sales", "ops"]
}
```

### `POST /api/staff-login`

请求：

```json
{
  "email": "ops@lumino.tech",
  "password": "<password>"
}
```

成功响应：

```json
{
  "ok": true,
  "email": "ops@lumino.tech",
  "name": "林晓",
  "role": "ops",
  "staffKey": "<LEADS_STAFF_KEY>",
  "expiresInHours": 12
}
```

状态码：

| 状态 | 含义 |
|---|---|
| `400` | 缺少邮箱或密码 |
| `401` | 邮箱或密码错误 |
| `503` | `STAFF_USERS` 或 `LEADS_STAFF_KEY` 未配置 |

> `expiresInHours` 当前仅用于前端会话提示，服务端尚未签发真正带到期时间的个人令牌。Portal 把共享 key 保存到 `sessionStorage`。生产环境必须替换为服务端会话、个人身份、角色权限和实际过期控制。

## 3. 提交线索

### `POST /api/leads`

主要字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `company` | 是 | 公司名称 |
| `name` | 是 | 联系人姓名 |
| `consent` | 是 | 联系授权，必须为真值 |
| `phone` / `email` | 至少一个 | 电话、微信或工作邮箱 |
| `note` | 通常必填 | 需求说明；试算器可以由 `context` 生成 |
| `services` / `serviceIds` / `serviceId` | 否 | 关注服务 |
| `industry` | 否 | 行业 |
| `timeline` | 否 | 期望时间 |
| `source` | 否 | 默认 `lumino-website` |
| `requestType` | 否 | 默认 `service-consultation` |
| `context` | 否 | 试算器等入口的结构化上下文 |

成功响应：

```json
{
  "ok": true,
  "leadId": "LM-20261116-0002",
  "status": "new",
  "persisted": true,
  "notified": true,
  "notify": {
    "wecom": "ok",
    "webhook": null,
    "email": null
  }
}
```

- `persisted` 表示是否写入持久化文件；`false` 可能代表仅保存在进程内存。
- `notified` 表示至少一个通知渠道发送成功，不代表线索已被人工处理。
- 持久化成功、通知失败时接口仍返回 `200`；线索收件箱是当前事实来源。

状态码：

| 状态 | 含义 |
|---|---|
| `400` | 必填字段、联系方式或授权校验失败 |
| `503` | 线索无法暂存 |

## 4. 查询线索

### `GET /api/leads`

请求头：

```text
X-Lumino-Staff-Key: <staffKey>
```

响应：

```json
{
  "ok": true,
  "leads": []
}
```

查询单条线索：

```text
GET /api/leads?id=LM-20261116-0002
```

当前代码仍兼容 `?key=`，但 URL 查询参数可能进入访问日志，不建议使用；生产化时应移除。

## 5. 更新线索

### `PATCH /api/leads`

请求：

```json
{
  "id": "LM-20261116-0002",
  "status": "claimed",
  "claimedBy": "林晓",
  "note": "已联系客户",
  "actor": "林晓"
}
```

允许状态：

```text
new | claimed | qualified | disqualified | converted
```

响应：

```json
{
  "ok": true,
  "lead": {},
  "persisted": true
}
```

## 6. 通知渠道

| 环境变量 | 用途 |
|---|---|
| `WECOM_WEBHOOK_URL` | 企业微信群机器人；发送 Markdown 消息 |
| `PUBLIC_SITE_URL` | 企业微信消息中的 Portal 链接根地址 |
| `LEAD_WEBHOOK_URL` | 通用 Webhook；若识别为企微地址则使用企微格式 |
| `LEAD_NOTIFY_EMAIL` | 邮件接收地址 |
| `LEAD_NOTIFY_FROM` | Resend 发件人 |
| `RESEND_API_KEY` | Resend API Key |
| `STAFF_USERS` | `email:password:role:name`，多个账号以逗号分隔 |
| `LEADS_STAFF_KEY` | 当前演示版员工共享访问 key |

任何真实密钥只写入部署环境变量，不得提交到 Git。

## 7. 当前限制与生产门禁

- `STAFF_USERS` 使用明文环境变量，没有密码哈希、账号锁定、MFA 或限流。
- 所有员工获得同一个 `LEADS_STAFF_KEY`，服务端无法据此完成个人审计。
- `expiresInHours` 尚未由服务端强制执行。
- 数据仍是文件 / 内存存储，不具备数据库事务、备份、恢复和跨实例一致性。
- 尚未提供删除、导出、保留期和个人信息请求流程。
- 正式上线前应完成 #25 的认证、租户授权与持久化能力。
