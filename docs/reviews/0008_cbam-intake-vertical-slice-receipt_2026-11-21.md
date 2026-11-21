# CBAM 材料收集垂直切片执行回执

日期：2026-11-21

目标分支：`feature/cbam-intake-vertical-slice`（基于 `origin/dev@e2c7ba2`）

评审入口：GitHub PR [#118](https://github.com/charlielamplit/lumino-official-website/pull/118)，base=`dev`

结论：已形成可评审的浏览器内原型；尚未接入生产对象存储、异步 Worker 或生产数据库。

## 1. 本次解决的问题

| 审计问题 | 本次结果 | 证据 |
|---|---|---|
| 上传仅改变页面状态，没有受控证据对象 | 增加租户隔离的内存证据存储；证据 ID 绑定材料请求与内容摘要 | `packages/agent/domain/evidence-store.js`、`intake-model.js` |
| 提取结果是固定演示数字 | 从 TXT/CSV 的真实字节提取天然气用量；不可解析时明确失败，不生成默认值 | `energy-invoice-extractor.js`、两份 fixture |
| 确认动作缺少候选版本和血缘 | 确认必须携带候选、证据、材料请求、租户和 revision；仅具名 admin/owner 可执行 | `intake-model.js`、`portal-events.js` |
| UI 状态与年度项目对象脱节 | 材料请求状态由证据、候选与事实状态投影，年度项目视图可显示当前材料项 | `annual-project-view-model.js`、Portal runtime |

## 2. 已验证边界

- Portal 依赖按 `intake-model` → `evidence-store` → `energy-invoice-extractor` → runtime 的顺序加载。
- `CBAM_ENERGY_INVOICE_EXTRACT`、提示契约和提取器统一使用 `extract-gas@1.1.0`。
- 同一材料请求上传两份不同内容会生成不同证据与候选；不会沿用旧候选。
- 其他租户无法读取证据元数据或字节。
- contributor、跨租户、过期 revision、退回候选均不能确认。
- 确认使用当前会话角色，不在客户端提升权限；旧计算 Run 依赖被标记失效。
- 当前仅接受非空 TXT/CSV，最大 30 MB；PDF、XLSX、图片明确拒绝，避免伪装成已实现解析。

## 3. 验证记录

- 全量 Node 测试：通过（退出码 0）。
- 新增垂直切片测试：19 项，覆盖内容差异、租户隔离、revision、角色、浏览器 UMD/Web Crypto 与 Portal 接线。
- JavaScript 语法检查：通过。
- `git diff --check`：通过。
- 本地 `/portal/` 静态访问：HTTP 成功，三个新增依赖均可见。
- 交互浏览器检查：未完成；当前 Computer Use 对已打开浏览器 URL 拒绝控制。合入前仍需人工执行上传、重新上传、确认、刷新与 390 px 检查。

## 4. 明确未实现

- 文件和候选只存在于当前浏览器会话内；刷新后需要重新上传。
- 未接生产对象存储、恶意文件扫描、OCR/PDF/XLSX 解析、队列 Worker、跨设备恢复或生产监控。
- Agent 仍以 `proposal_only` 完成；企业事实只能由具名有权限用户确认。
- 生产化继续受 Identity/ACL、持久化和 Worker 相关前置门禁约束。

## 5. 合入门禁

1. 人工完成 Portal 交互与响应式检查，并保存结果。
2. PR CI 全绿且无新的高风险审查意见。
3. 只合入 `dev`；不得把本切片描述为生产入库或生产 Agent 已完成。
4. 生产化另行实现对象存储、数据库、Worker 与恢复策略，不在本 PR 内扩张范围。
