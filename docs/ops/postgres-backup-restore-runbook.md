# PostgreSQL 备份 / 恢复 / 回滚 Runbook（Phase-1）

**范围**：仅覆盖本仓库阶段一 Postgres 线索库的操作面，不定义保留期或国际站。
**关联**：`docs/architecture/2026-11-18-postgres-phase1-handoff.md`、Issue #76

## 1. 备份

```bash
export DATABASE_URL=postgres://lumino@127.0.0.1:5432/lumino_platform
pg_dump "$DATABASE_URL" --format=custom --file="lumino_platform_$(date +%Y%m%d_%H%M%S).dump"
```

备份频率、异地存放与加密策略由运维按环境落地；目标 RPO/RTO 仍以 Issue #76 决策为准，本 runbook 不发明数值。

## 2. 恢复演练

```bash
createdb lumino_platform_restore
pg_restore --clean --if-exists --dbname=postgres://lumino@127.0.0.1:5432/lumino_platform_restore lumino_platform_YYYYMMDD.dump
psql postgres://lumino@127.0.0.1:5432/lumino_platform_restore -c "SELECT count(*) FROM leads;"
```

恢复后抽查若干 `public_id`、outbox 状态与 staff 会话是否可用。

## 3. 切换后回滚（禁止切回 JSON 写路径）

一旦应用以 PostgreSQL 为线索唯一写路径上线：

1. **禁止**把 `LEADS_STORE` 切回 `file` 作为生产写路径。
2. **禁止**把 `data/leads.json`（或任何 JSON 文件）恢复为生产写入目标。
3. JSON 仅可作为**一次性迁移输入**（`scripts/db/migrate-leads-json-to-pg.mjs`），导入幂等，不充当运行时存储。
4. 切换后若需回滚，只允许：
   - **回滚应用版本**（代码/配置回到上一发布，但仍指向 PostgreSQL）；或
   - **从备份恢复 PostgreSQL**（隔离演练通过后再切流量）。

```bash
# 迁移输入（非运行时写路径）
DATABASE_URL=... node scripts/db/migrate-leads-json-to-pg.mjs --dry-run data/leads.json
DATABASE_URL=... node scripts/db/migrate-leads-json-to-pg.mjs data/leads.json
```

## 4. 软删除 / 误删处理

线索使用 `leads.deleted_at` 软删除；**没有**自动物理清除。

误操作恢复建议：

1. 用已知 `public_id` 定位记录。
2. 在变更窗口内用受控 SQL 清空 `deleted_at`（需双人确认）。
3. 写入 `audit_events` 说明。
4. 核对 outbox / 通知是否需要补发。
5. 通知相关值班人员。

> 保留期、跨境与 RPO/RTO：**不得在此文件擅自定义**；待 Issue #76 决策后再补。

## 5. 上线检查清单

- [ ] #76 数据保留 / 备份目标 / 跨境 / 切换窗口已决策
- [ ] 目标环境（如 TencentDB）连接串与密钥已配置
- [ ] Portal / 收件箱使用个人 session，拒绝 query key
- [ ] 独立 outbox worker 已部署，API 仅 best-effort 单条 drain
- [ ] CI PostgreSQL service 与迁移步骤通过

## 6. Outbox worker

公开 `POST /api/leads` 只对**当前线索**做 best-effort 单条 drain。历史积压、重试与死信回收由独立 worker 处理：

```bash
export DATABASE_URL=postgres://lumino@127.0.0.1:5432/lumino_platform
export WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...
# 单次
npm run db:outbox-once
# 常驻（可用 systemd 托管；生产选型仍待 #76）
npm run db:outbox-worker
```

Worker 使用与 Repository 相同的 lease / 超时回收 / dead-letter 语义；不写 leads，失败不丢线索。日志不含联系人完整信息。
