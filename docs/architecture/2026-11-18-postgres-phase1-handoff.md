# PostgreSQL 第一阶段交接说明（先票后码）

**日期**：2026-11-18
**关联 Issue**：[#76](https://github.com/charlielamplit/lumino-official-website/issues/76)
**方案正文**：`docs/architecture/2026-11-17-leads-database-proposal.md`
**契约基线（尚未全部合入 `dev`）**：

- `feature/platform-authority-boundary` @ `0b9d422`
- `feature/agent-production-contracts` @ `fd39ab0`

---

## 1. 开始前硬性要求

1. 本交接文档与数据库方案必须先进入版本库，独立 worktree 才能读到。
2. **禁止**在 `server` 部署分支直接开发数据库。
3. 执行 Agent 从 `feature/platform-authority-boundary`（`0b9d422`）建独立 worktree，新建分支 `feature/postgres-platform-foundation`。
4. 完成后先合入 `dev`，再走服务器部署流程。
5. 不做生产库连接/切换；不自行填写保留期、国际站路径、RPO/RTO（留在 #76 决议）。

---

## 2. 第一阶段交付物（最小平台基础）

不要一开始把整个 CBAM/Agent 数据模型全部建完。第一阶段只交付最小平台基础。

### 2.1 最小表

- `users`
- `tenants`
- `tenant_memberships`
- `staff_sessions`
- `leads`
- `lead_events`
- `outbox_events`
- `audit_events`
- `schema_migrations`

> 命名以本表为准；与送审稿中的 `staff_users` / `notification_outbox` 等价时，在 migration 注释中写明映射，避免双模型。

### 2.2 所有业务表至少具备

- 稳定主键
- `tenant_id`
- `created_at` / `updated_at`
- 必要的 revision / 并发字段
- 服务端解析的 actor（不信任客户端）
- 明确的删除 / 归档语义

### 2.3 第一阶段验收

- migration 可重复执行
- rollback 行为明确
- 所有租户查询默认带 `tenant_id`
- 客户端不能伪造 actor、tenant 或角色
- Leads 与 outbox 在同一事务提交
- 通知失败不丢线索
- JSON 导入幂等并可对账
- 集成测试使用**真实 PostgreSQL**，不只 mock Repository
- DB 不可用时 API 明确失败，不回退到 JSON / 内存
- 敏感字段不进入普通日志

### 2.4 交付清单

- migration
- Repository
- 真实 PostgreSQL 集成测试
- JSON 幂等迁移脚本
- 备份恢复及删除 runbook
- 明确列出尚未完成项（含 #76 未决议项）

---

## 3. 分工

### 3.1 PostgreSQL 执行 Agent

- 按 §4 执行指令落地第一阶段平台基础
- 不改 Portal 前端
- 不连接/切换生产数据库
- 不填保留期 / 国际站 / RPO·RTO

### 3.2 契约 / 审核侧（本侧）

- 审核数据库模型是否符合 F03-03 与 Agent 契约
- 合并/整理 `agent-production-contracts`
- 合并/整理 `platform-authority-boundary`
- 定义 API DTO、错误码和前后端映射
- 审核 tenant、actor、revision、audit 是否真正服务端权威
- 检查实现能否支撑 Portal / CBAM / Agent
- 做 C1–C4 验收和 Issue 状态更新
- 后续负责前端从 localStorage Runtime 切换到正式 API

### 3.3 共同接口（不得各自定义数据模型）

```text
前端 / Agent 意图
    ↓
生产 API 契约
    ↓
ServerAuthorityBoundary
    ↓
Repository + PostgreSQL
    ↓
Audit / Outbox / Domain Command
```

### 3.4 并发冲突回避

执行 Agent 开始后，契约侧默认**不同时修改**以下文件，除非事先约定：

- migration 和数据库 Repository
- 数据库依赖及根 `package.json`
- CI 中的 PostgreSQL service 配置
- Leads API
- `audit_events`、session、tenant 表结构

数据库公共接口变化时，必须先同步契约侧。

---

## 4. 可直接交给执行 Agent 的指令

从 `feature/platform-authority-boundary` 的 `0b9d422` 创建独立 worktree 和 `feature/postgres-platform-foundation` 分支。阅读 Leads 数据库方案、Agent Production Contract 和 Platform Authority Boundary。实现 PostgreSQL 第一阶段平台基础：migration、`users`、`tenants`、`memberships`、`sessions`、`leads`、`lead_events`、`outbox_events`、`audit_events`，以及真实 PostgreSQL 集成测试。所有身份、租户、角色和 actor 必须由服务端解析；不得信任客户端字段。Leads 与 outbox 必须同一事务提交；数据库失败不得回退到 JSON 或内存。不要修改 Portal 前端，不要连接或切换生产数据库，不要自行填写保留期、国际站路径或 RPO/RTO。交付 migration、Repository、测试、JSON 幂等迁移、备份恢复及删除 runbook，并列明尚未完成项。

---

## 5. 结论

可以交给另一个 Agent 做，但必须作为**同一平台架构**的一部分执行；契约侧负责契约、集成审核和前端/Agent 接线，两边不能各自定义数据模型。
