# 下一阶段运维方案：线索通知、API 文档、Git 分支与 CI/CD

> **发布流程更新（2026-11-19）**：独立 `server` 业务分支方案已由
> [`unified-production-release.md`](./unified-production-release.md) 取代。Vercel 与腾讯云均发布同一个受保护的
> `main` 提交；本文涉及 `server` 分支的内容仅保留为历史背景，不再作为执行指令。

日期：2026-11-16

范围：官网线索 API、员工线索收件箱、企业微信通知，以及 Vercel / 腾讯服务器双环境发布。

## 1. 当前状态

| 事项 | 当前状态 |
|---|---|
| 线索提交与收件箱 | 已有原型 API：`/api/leads`、`/api/staff-login` |
| 企业微信通知 | 代码已支持机器人 Webhook，部署环境变量尚需配置与实测 |
| API 文档 | `docs/api/leads-inbox.md` 已记录接口与限制 |
| Git 分支 | 日常集成使用 `dev`；生产分支仍需按环境明确保护规则 |
| 海外环境 | `main` 对应 Vercel Production |
| 中国大陆环境 | 腾讯服务器方案待建立独立发布分支 / 环境与自动部署 |
| CI/CD | 已有质量门禁；腾讯服务器部署和烟雾测试待实现 |

## 2. 企业微信线索通知

代码优先读取 `WECOM_WEBHOOK_URL`，按企业微信群机器人 Markdown 格式发送。若只配置 `LEAD_WEBHOOK_URL` 且域名属于企业微信，也会自动使用企微格式。

部署步骤：

1. 在企业微信群添加机器人，取得 Webhook URL。
2. 将 URL 写入部署平台的 `WECOM_WEBHOOK_URL`，不要写入仓库。
3. 设置 `PUBLIC_SITE_URL`，用于消息中的“打开线索收件箱”链接。
4. 用非生产测试线索验证消息格式、链接和失败日志。
5. 为 Webhook 失败设置告警；收件箱持久化成功时，不因通知失败丢弃线索。

建议消息只保留处理所需的最小联系信息，避免在群消息中展开敏感需求或完整附件。

## 3. API 文档治理

目录约定：

```text
docs/api/
  leads-inbox.md
  <domain>-<capability>.md
```

规则：

1. API 代码变更与对应文档在同一个 PR 更新。
2. 文档明确身份、权限、数据存储、失败语义和生产限制。
3. 不兼容调整标记 `BREAKING`，并给出迁移与回滚方式。
4. CI 后续增加检查：修改 `api/*.js` 时提示核对 `docs/api/`。

## 4. Git 与环境模型

建议模型：

```text
feature/* → PR → dev → PR → main       → Vercel Production
                        └→ server 分支 → 腾讯服务器
```

| 分支 | 用途 | 门禁 |
|---|---|---|
| `dev` | 集成与验收 | 自动测试、浏览器证据、人工审查 |
| `main` | 全球 / Vercel 生产 | 受保护 PR、质量门禁、部署烟雾测试 |
| `server`（建议新增） | 腾讯服务器生产 | 受保护 PR、服务器部署审批和回滚点 |

约束：

- 不从功能分支直接推送 `main` 或 `server`。
- `dev` 通过质量门禁并完成验收后，才能分别提升到生产分支。
- `main` 与 `server` 可以使用不同部署适配，但应用源代码应保持可追溯的共同提交。
- 所有环境变量以 `.env.example` 记录名称，不记录真实值。

正式创建 `server` 前应确定最终命名，例如 `server`、`prod-cn` 或 `tencent`，并在 GitHub 设置保护规则。

## 5. CI/CD 建议

| 工作流 | 触发 | 工作内容 |
|---|---|---|
| Quality Gates | PR / push 到 `dev` | 语法、单元、契约、构建和关键浏览器检查 |
| Promote Main | `dev → main` PR | 全量回归、发布审查、Vercel Production |
| Deploy Tencent | `server` push 或手动审批 | SSH / rsync、安装依赖、重启服务、健康检查 |
| Smoke Tests | 每次生产部署后 | 官网、Calculator、Portal 和关键 API 路由 |

腾讯部署建议使用 GitHub Environment，例如 `tencent-lighthouse`：

- Secrets：SSH 私钥、服务器地址、部署用户和必要环境变量。
- 部署时排除 `.env`、本地数据、测试输出和开发缓存。
- 先发布到版本目录，再切换当前版本软链接，保留上一版本用于回滚。
- 重启后检查静态入口和 `GET /api/staff-login` 等健康路由。
- 失败时停止提升并恢复上一版本。

## 6. 推荐执行顺序

1. 在开发 / 预览环境配置企业微信机器人并完成端到端测试。
2. 审核 `docs/api/leads-inbox.md` 与实际 API 一致性。
3. 将本批改动提交到 `dev`，完成质量和页面验收。
4. 确定中国大陆生产分支名称与腾讯服务器部署目录、进程管理方式。
5. 建立 GitHub Environment 和 Deploy Tencent 工作流。
6. 对 `dev → main`、`dev → server` 均使用受保护 PR 和部署后烟雾测试。
7. 在接收真实客户线索前，把文件存储迁移到数据库并完成身份、备份、删除和恢复策略。

## 7. 发布前检查

- [ ] 官网提交线索后产生收件箱记录。
- [ ] 企业微信群收到格式正确的 Markdown 通知。
- [ ] 通知失败时线索仍可在收件箱找到，并有错误日志。
- [ ] 员工登录未配置时明确失败，不开放匿名读写。
- [ ] `GET` / `PATCH /api/leads` 无 key 时返回 `401`。
- [ ] API 文档与环境变量说明可读且无真实密钥。
- [ ] `dev` 的自动化、浏览器证据和差异检查通过。
- [ ] 生产部署支持健康检查和明确回滚点。
