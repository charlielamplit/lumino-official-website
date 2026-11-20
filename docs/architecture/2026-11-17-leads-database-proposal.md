# Lumino 线索与平台持久化方案（送审稿）

**日期**：2026-11-17
**状态**：已完成架构初审 / 修订后可批准
**范围**：腾讯云轻量（国内站 `www.luminoyou.cn`）优先；Vercel 国际站（`intl.luminoyou.com`）本轮不做双写，但上线前必须拍板其留资是关闭还是转发到受控 API
**关联**：`docs/api/leads-inbox.md`、`api/_lib/leads-store.js`、`docs/ops/2026-11-16-next-phase-git-cicd-wecom.md`

### 评审结论（2026-11-17）

**方向通过，暂不建议按原稿直接实施。** PostgreSQL 作为线索唯一事实源、先落库再通知、备份恢复作为上线门禁的主线正确。原稿必须先收口以下阻断项：

1. **回滚不得切回旧 JSON 快照继续写入**，否则会丢失切换后新线索或形成双事实源。
2. **审计操作人必须由服务端会话解析**；当前 `PATCH /api/leads` 接受客户端 `actor` / `claimedBy`，不能作为可信审计。
3. **最小用户表与个人会话必须同期上线**，否则 `staff_sessions.user_id` 无法建立可靠外键与身份链。
4. **迁移必须有停写/短维护窗口、幂等导入、条数与校验和对账**，不能只写“一次性迁移”。
5. **软删除不等于履行个人信息删除请求**；需定义匿名化/硬删除、备份自然过期和审计保留边界。
6. **国际站的写入路径不能留白**：上线前必须选择关闭留资、转发到国内 API，或使用独立地域存储，并同步隐私告知。

P0 修订纳入本文后，建议结论为**条件批准**；未通过第 11.1 节门禁前，不得接收真实客户线索或升级对外承诺。

---

## 1. 为什么必须上数据库

当前生产线索落在：

- `/var/www/lumino/data/leads.json`
- 进程内存缓存
- 可选 `/tmp/lumino-leads.json` 兜底

这能支撑演示和企微通知，但**不构成真实平台**：

| 缺口 | 风险 |
|---|---|
| 无事务 / 并发安全 | 多进程或重启时丢数、覆盖 |
| 无备份与恢复 | 误删、磁盘故障不可回滚 |
| 无审计身份 | 共享 `LEADS_STAFF_KEY`，无法追责到人 |
| 无保留期 / 删除流程 | 个保合规与客户删除权难以执行 |
| 无法承载 Portal 业务对象 | 项目、资产、核算结果无法严肃落库 |

**结论**：在接收真实客户线索与宣称「平台」之前，必须以数据库为事实来源（Source of Truth）。企微通知、Portal 收件箱只是消费方。

---

## 2. 目标与非目标

### 2.1 本轮目标（P0）

1. 线索（Leads）以 **PostgreSQL** 为唯一权威存储。
2. **保持现有 HTTP API 形状**（`POST/GET/PATCH /api/leads`、`/api/staff-login`），前端与企微链路尽量不改。
3. 从 `leads.json` **一次性迁移**历史演示数据（可标记 `source` 或 `is_demo`）。
4. 明确备份、权限、运维责任与回滚。
5. 为后续 Portal / CBAM / 租户表预留 schema 命名空间，但不在本轮实现完整 CRM。

### 2.2 非目标（本轮不做）

- 完整 IAM（SSO、MFA、RBAC 细粒度）——本轮只把「共享 key」升级到「可审计的个人会话」最小集。
- 多区域多活、分库分表。
- 顾问聊天全文长期存储。
- 国际站（Vercel）与国内库实时双写（可二期）；一期仍需明确关闭留资或单一受控 API 转发路径。
- 把 Portal 全部演示数据迁库（二期）。

---

## 3. 推荐技术选型

| 项 | 建议 | 理由 |
|---|---|---|
| 引擎 | **PostgreSQL 受支持大版本**（同机轻量或 TencentDB） | 成熟、JSON 友好、备份工具全、与后续 Portal 契合 |
| 部署位置（一期） | **同机可作低流量过渡方案**；正式生产优先 TencentDB | 同机库与应用共享主机、磁盘和故障域，必须有异机/对象存储备份、容量与恢复验证 |
| 访问方式 | Node `pg` 连接池（统一选型） | 显式设置连接数、超时和优雅关闭 |
| 迁移工具 | 纯 SQL + 版本表 `schema_migrations` | 一期减少新工具链；每个 migration 需有前向脚本、兼容窗口与恢复方案，不假设 DDL 均可无损回滚 |
| 密钥 | `.env`：`DATABASE_URL`，**不进 Git** | 与现有 WECOM / STAFF 一致 |

**部署决策标准**：只有在明确运维责任人、异故障域备份且业务接受单机停机时，才选同机 PostgreSQL；否则一期直接 TencentDB。PostgreSQL 大版本实施时根据主机 OS 支持周期确认，不仅因文档写了 `16` 就固定。

**不推荐一期**：MySQL（也能做，但 JSON/审计扩展与后续契约略弱）、Mongo 单开（运维与事务习惯不一致）、继续扩 JSON 文件。

---

## 4. 架构原则

```text
浏览器 / 官网 / 试算器
        │
        ▼
   Nginx (443)
        │
        ▼
   Node lumino-site (:4174)
        │
        ├─ POST /api/leads  ──写──►  PostgreSQL (leads)
        │         │
        │         └─ 同事务写 outbox ─► 通知 worker ─► 企业微信 Webhook
        │
        ├─ GET/PATCH /api/leads ◄──读/改── PostgreSQL（需员工身份）
        │
        └─ （未来）Portal 业务表
```

原则：

1. **先落库，再通知**：在同一事务中写入 `leads` 与 `notification_outbox`；worker 失败可重试，不影响线索已接收的事实。
2. **文件存储退出运行时读写链路**，仅用于迁移导入和加密归档。
3. **API 契约稳定**：`persisted:true` 含义改为「已写入数据库」。
4. **单租户起步**：一期由服务端固定 `tenant_id=lumino`，不接受客户端传入；多租户二期启用前增加租户授权与数据隔离测试。

---

## 5. 数据模型（一期）

### 5.1 表：`leads`

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | 内部稳定主键，不对外暴露 |
| `public_id` | `text` UNIQUE NOT NULL | 对外编号，如 `LM-20261117-0004` |
| `tenant_id` | `text` NOT NULL DEFAULT `'lumino'` | 预留 |
| `status` | `text` NOT NULL | `new\|claimed\|qualified\|disqualified\|converted` |
| `company` | `text` NOT NULL | |
| `name` | `text` NOT NULL | |
| `phone` | `text` | |
| `email` | `text` | |
| `industry` | `text` | |
| `timeline` | `text` | |
| `services` | `jsonb` NOT NULL DEFAULT `'[]'` | 服务意向数组 |
| `note` | `text` NOT NULL | 需求说明 |
| `notes` | `jsonb` NOT NULL DEFAULT `'[]'` | 跟进备注时间线 |
| `source` | `text` NOT NULL | 来源 |
| `request_type` | `text` NOT NULL | 默认 `service-consultation` |
| `consent` | `boolean` NOT NULL | 联系授权 |
| `consent_at` | `timestamptz` NOT NULL | 授权时间 |
| `notice_version` | `text` NOT NULL | 提交时展示的隐私/联系告知版本 |
| `context` | `jsonb` | 试算等结构化上下文 |
| `user_agent` | `text` | |
| `claimed_by_user_id` | `uuid` FK | 由服务端会话解析，不信任客户端姓名 |
| `claimed_at` | `timestamptz` | |
| `created_at` | `timestamptz` NOT NULL | |
| `updated_at` | `timestamptz` NOT NULL | |
| `is_demo` | `boolean` NOT NULL DEFAULT false | 迁移/测试标记 |
| `deleted_at` | `timestamptz` | 业务软删除/隐藏，不等同个人信息请求的最终删除 |

索引建议：

- `(tenant_id, created_at DESC)`
- `(tenant_id, status, created_at DESC)`
- 去重若为必要业务需求，使用标准化后的 `email_normalized` / `phone_normalized` 建立索引
- GIN `(services)` 可选

约束建议：`status`、`source`、`request_type` 使用 `CHECK` 或受控字典；`services` 必须是 JSON 数组；关键文本列设长度上限。`updated_at` 由 repository 在事务中更新，不依赖客户端。

### 5.2 表：`staff_users`（一期最小身份）

既然一期要求个人 session 和可信审计，`staff_users` 必须与 `staff_sessions` 同期上线。可以通过一次性管理命令从现有账号创建用户，但不继续以明文 `STAFF_USERS` 作为正式登录源。

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | |
| `email` | `citext` UNIQUE | |
| `password_hash` | `text` | argon2/bcrypt |
| `name` | `text` | |
| `role` | `text` | `ops\|sales\|admin` |
| `is_active` | `boolean` | |
| `created_at` / `updated_at` | `timestamptz` | |

### 5.3 表：`staff_sessions`（替代共享 `LEADS_STAFF_KEY`）

| 列 | 类型 | 说明 |
|---|---|---|
| `token_hash` | `text` PK | 只存哈希 |
| `user_id` | `uuid` FK | |
| `expires_at` | `timestamptz` | 强制过期 |
| `created_at` | `timestamptz` | |
| `revoked_at` | `timestamptz` | |
| `last_seen_at` | `timestamptz` | 可选，用于会话管理 |

token 使用 CSPRNG 生成，只在登录成功时返回一次；服务端只存哈希。强制 TTL、撤销、登录限流和失败日志。Portal 一期可继续使用 Header，但不再兼容 URL `?key=`。

### 5.4 表：`audit_events`（建议一期就有）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | `bigserial` | |
| `actor_user_id` | `uuid` | 服务端 session 解析值；系统事件可为空 |
| `actor_email_snapshot` | `text` | 便于账号后续改名时理解历史 |
| `action` | `text` | `lead.create\|lead.claim\|lead.patch\|staff.login` |
| `entity_type` | `text` | `lead` |
| `entity_id` | `text` | |
| `payload` | `jsonb` | 脱敏后变更摘要 |
| `created_at` | `timestamptz` | |

`audit_events` 仅允许追加，不保存密码、token、完整联系方式或整段需求说明。审计中的 actor 不得来自 request body。

### 5.5 表：`notification_outbox`

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | `bigserial` PK | |
| `event_key` | `text` UNIQUE NOT NULL | 幂等投递键 |
| `lead_id` | `uuid` FK | |
| `channel` | `text` | `wecom\|webhook\|email` |
| `status` | `text` | `pending\|processing\|sent\|failed` |
| `attempts` | `int` | 已尝试次数 |
| `next_attempt_at` | `timestamptz` | 指数退避 |
| `last_error_code` | `text` | 脱敏错误摘要 |
| `created_at` / `sent_at` | `timestamptz` | |

线索与 outbox 在同一事务提交。worker 按唯一事件键幂等投递；达到最大重试次数后告警，不删除线索。

### 5.6 编号生成

保留对外 `LM-YYYYMMDD-XXXX`：

- 用表 `lead_daily_counters(day date PK, seq int)` 或 `SERIAL` + 格式化视图。
- **禁止**再用「数组 length+1」（并发会撞号）。

---

## 6. API 契约（对外尽量不变）

| 接口 | 行为变化 |
|---|---|
| `POST /api/leads` | 写入 Postgres；`persisted` = DB commit 成功 |
| `GET /api/leads` | 从 DB 查询；默认过滤 `deleted_at IS NULL` |
| `PATCH /api/leads` | 事务更新 + `audit_events`；忽略客户端 `actor`，由 session 注入操作人 |
| `POST /api/staff-login` | 读取 `staff_users` 的密码哈希；签发**个人** session token（写入 `staff_sessions`） |

保留现有字段并扩展通知状态：

```json
{
  "ok": true,
  "leadId": "LM-...",
  "status": "new",
  "persisted": true,
  "notified": false,
  "notifyStatus": "queued",
  "notify": { "wecom": "queued", "webhook": null, "email": null }
}
```

接入 outbox 后，提交响应时通常只能确认“已入库且通知已入队”，不能假称企微已成功送达。兼容期保留 `notified` 字段，但以新增 `notifyStatus=queued|sent|failed` 表达可靠状态；如客户端需最终状态，由受权查询接口获取。

**破坏性变更（需评审点头）**：

1. 废弃 URL `?key=`，仅允许 Header。
2. 废弃全局共享 `LEADS_STAFF_KEY` 作为正式线索库凭证；如保留短过渡期，该环境仍只能标识为受控演示。
3. 不建议向用户暴露「已进入线索库」这类内部实现语言。达到上线门禁后，可改为「已提交，Lumino 将按隐私说明处理并与您联系」；受控处理链路未完成前仍保留「演示记录」。

另增公开 `POST /api/leads` 生产门禁：服务端字段长度/类型白名单、请求体大小上限、速率限制、反自动化蜜罐或等价机制，以及可选 `Idempotency-Key` 防止网络重试造成重复。

---

## 7. 代码改造切面

| 模块 | 改造 |
|---|---|
| `api/_lib/leads-store.js` | 改为 async DB repository；保留业务方法语义，不承诺同步签名不变 |
| `api/leads.js` | 校验可复用，但 repository 调用需 `await`；授权中间件注入 actor/role；通知改为 outbox worker |
| `api/staff-login.js` | 签发个人 token |
| `apps/portal` | Header 继续带 token；适配新登录响应、过期/401 清理与重登录；不再上送可信 actor |
| 新目录 | `db/migrations/*.sql`、`scripts/migrate-leads-json-to-pg.mjs` |
| 配置 | `DATABASE_URL=postgres://lumino:...@127.0.0.1:5432/lumino` |

特性开关（建议）：

```bash
LEADS_STORE=postgres   # 生产切换后固定为 postgres；file 仅本地演示/迁移工具使用
```

---

## 8. 迁移与上线步骤

1. **按已批准选型创建 PostgreSQL**：同机时仅本机监听；TencentDB 时使用私网/最小白名单与 TLS。
2. 跑 migration，建表。
3. 迁移脚本支持 `--dry-run`、重复执行和异常报告；以 `public_id` UPSERT，不使用“数组长度 + 1”。
4. 记录 JSON 快照 SHA-256、原始条数、成功/失败条数和按状态汇总；演示数据统一 `is_demo=true`。
5. 预发验证：提交 / 列表 / 认领 / 权限 / 企微重试 / 并发编号 / 进程重启 / DB 断连。
6. 生产切换进入短维护窗口：暂停公开提交，停止 JSON 写入，创建最终快照，导入并对账。
7. 切换 `LEADS_STORE=postgres`，执行合成提交和 Portal 查询验证；成功后再恢复公开提交。
8. 将 JSON 按明确保留期加密归档，限制访问，不再由应用读写。
9. 更新 API 文档、隐私事实登记、运维 runbook 与监控：磁盘、连接数、备份、API 5xx、outbox 积压和企微失败率。

回滚：

- **切换前**：可回滚应用版本并恢复 JSON 提交，因为尚未开放 DB 写入。
- **切换后**：不得回到 JSON 继续写。应回滚到“仍兼容当前 DB schema”的上一应用版本，或暂停提交后从 DB 受控导出全量+增量数据再执行经批准的灾难恢复。
- DB schema 采用 expand/contract 兼容迁移，至少保证前一应用版本可运行；回滚演练包含“切换后新增线索不丢失”断言。

---

## 9. 备份、安全与合规

| 项 | 一期最低标准 |
|---|---|
| 备份 | 加密备份到与主机不同故障域的对象存储；保留周期与数据保留政策一致 |
| RPO / RTO | 上线前签字确认；建议起点 RPO ≤ 24h、RTO ≤ 4h，无法接受则改用托管库/更高频备份 |
| 恢复演练 | 上线前 restore 到隔离临时库，记录耗时、条数校验和抽样业务查询 |
| 访问 | DB 账号最小权限；应用账号无 DDL（迁移用独立角色） |
| 传输 | 本机 socket/localhost；若托管库则 SSL |
| 个保 | 上线前定义查询/导出/更正/删除的人工 runbook；软删除仅是业务状态；保留期由目的必要性和法务确认，不默认写死 24 个月 |
| 密钥 | 仅 systemd EnvironmentFile / 服务器 `.env` |
| 日志 | 禁止打印手机号/邮箱全文到 journal（已有需脱敏） |

隐私事实登记需同步更新：正式托管位置（上海轻量 / 腾讯云地域）、处理目的、保存期限。

企业微信通知同样是个人信息处理链路：需确认群成员范围、机器人管理者、消息保留与离职成员移除流程；群消息只放最小必要摘要，完整需求转到受控收件箱查看。

审核依据：《中华人民共和国个人信息保护法》第四十五至五十条规定了查阅、复制、更正、删除及申请受理机制，因此单一 `deleted_at` 字段不足以证明权利闭环。参考：<https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm>。TencentDB 的具体备份能力与限制以实施时官方文档为准：<https://cloud.tencent.com/document/product/409/33945>。

---

## 10. 责任分工（建议评审确认）

| 角色 | 职责 |
|---|---|
| 产品 / 业务负责人 | 确认线索字段、状态机、保留期、谁可看线索 |
| 技术负责人（平台） | Schema、迁移、API、特性开关、回滚 |
| 运维 / 服务器负责人 | Postgres 安装或 TencentDB、备份、监控、磁盘 |
| 安全 / 合规 | 个保条款、删除权、跨境（若有）、文案是否可改「正式入库」 |
| 运营 / 销售 | UAT：Portal 收件箱与企微联调 |

**临时责任决议（2026-11-18）**：当前阶段由项目发起人兼任产品/业务决策、技术实施、数据库运维、备份恢复、隐私请求处理与告警响应。这一单一责任人模式可支持方案评审和开发阶段，但不代表已完成职责分离或法务复核。正式接收真实客户线索前，还应登记负责人正式姓名、可达告警通道和至少一名紧急替补联系人；恢复和删除演练仍需保留可验证记录。

---

## 11. 工作量粗估（供排期）

| 项 | 估时 |
|---|---|
| Postgres 安装 + 备份脚本 | 0.5–1 天 |
| Migration + repository 改造 + 数据库集成测试 | 2–3 天 |
| 最小用户、个人 session、授权与限流 | 1.5–2.5 天 |
| Outbox worker、重试与监控 | 1–1.5 天 |
| JSON 幂等迁移、对账、回滚与 UAT | 1–1.5 天 |
| 文案 / 隐私登记 / 数据权利与运维 runbook | 0.5–1 天 |
| **合计** | **约 7–10 人日**（不含 TencentDB 采购流程与等待评审时间） |

---

### 11.1 上线验收门禁

- [ ] DB 不可用时，公开提交返回明确失败，不假成功、不降级到内存/JSON。
- [ ] 20 个并发提交无重复 `public_id`，且每个成功响应都能在 DB 查到。
- [ ] 迁移脚本重复执行不产生重复记录；条数、状态分布与抽样哈希对账通过。
- [ ] 未登录、过期、撤销、角色不足和 URL `?key=` 访问均被拒绝。
- [ ] 修改请求中伪造 `actor` / `claimedBy` 无法改变审计操作人。
- [ ] 通知失败不丢线索；outbox 可重试、幂等，达到阈值会告警。
- [ ] 从异故障域备份恢复到隔离库并通过条数/抽样校验，RPO/RTO 实测符合批准值。
- [ ] 切换后回滚演练不丢失切换后新线索。
- [ ] 国际站留资路径已明确，隐私事实登记、对外告知和企微处理边界与实际一致。

---

## 12. 二期展望（本轮只定方向）

1. Portal 项目 / 年度 CBAM 对象表（与 Agent 契约对齐）。
2. 对象存储（合同、排放证据文件）。
3. 国内库为主、国际站 API 转发或只读副本。
4. 完整 RBAC、MFA、操作审计看板。
5. 线索与 CRM/飞书多维表可选同步（仍以 Postgres 为准）。

---

## 13. 评审请重点拍板的问题

请审核人明确回复：

1. **引擎**：同机 PostgreSQL 是否可接受？是否必须一期上 TencentDB？
2. **身份**：是否接受 `staff_users + staff_sessions + audit_events` 作为正式线索库上线的不可拆门禁？若不接受，环境只能继续标识为受控演示。
3. **保留期**：线索默认保留多久？测试数据如何清理？
4. **文案**：通过数据库、身份、备份恢复、数据权利与受控处理门禁后，是否使用中性回执「已提交，我们将按隐私说明处理并与您联系」？
5. **责任人**：备份失败告警发给谁？谁有生产 DB 超级权限？
6. **范围**：本轮是否严格仅 leads，Portal 业务表一律二期？
7. **国际站**：Vercel 留资在一期是关闭、转发国内 API，还是独立存储？对应的地域与告知如何批准？

---

## 14. 建议决议（草案，可改）

1. 采用 **PostgreSQL**；在有明确运维责任人、异故障域备份且业务接受单机停机时，可同机过渡，否则一期直接 TencentDB。
2. **Leads 为 P0**；文件存储退出写路径。
3. API 保持兼容；`persisted` = DB 成功。
4. 同期上线 **staff_users + 个人 session + audit_events**；actor 由服务端导出，不信任客户端字段。
5. 备份与恢复演练列为上线门禁；未完成不得改公开「正式入库」表述。
6. Portal 大域模型单独立项，不阻塞线索库上线。
7. 使用 transactional outbox 承载企微/邮件通知，禁止以 JSON 作为切换后写降级。

---

## 15. 附录：与现状对照

| 能力 | 现在 | 本方案一期后 |
|---|---|---|
| 官网可访问 | 是 | 是 |
| 留资可查 | JSON 文件 | PostgreSQL |
| 企微推送 | 是 | 是（改为 outbox 可重试投递） |
| 数据库 | 无 | 有 |
| 个人审计 | 无 | 有（session + audit） |
| 备份恢复 | 无 | 有 |
| 完整 Portal 业务库 | 无 | 二期 |

文档结束。
