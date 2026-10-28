# Lumino Roadmap 管理规范

本目录是 Lumino 官网、Portal、数据资产、PCF、CBAM 和生产平台工作的版本化路线图。`github-roadmap.json` 是 GitHub Label、Epic、Feature 标题、正文、标签和状态的唯一来源；Issue 评论、讨论和附件仍保留在 GitHub。

## 当前路线图

| ID | Epic | 当前状态 | 优先级 | 完成定义 |
|---|---|---|---|---|
| E01 | 官网与平台真实表达 | done | P0 | 公开表达、服务状态和响应式审查有证据 |
| E02 | 多服务 Portal 与共享中心 | in-progress | P0 | 跨服务聚合、权限过滤和恢复路径通过审查 |
| E03 | 企业数据资产与 Agent Runtime 基座 | in-progress | P0 | 资产、事实、确认、快照和运行时契约稳定 |
| E04 | PCF 完整业务切片 | ready | P0 | 模板、清单、计算、复核和报告形成闭环 |
| E05 | CBAM 工作流产品化加固 | backlog | P1 | 计算与报告血缘、角色交付和法规版本收口 |
| E06 | 生产平台基础设施与安全 | backlog | P1 | 服务端授权、持久化、任务和恢复能力建立 |
| E07 | 质量、审查与发布治理 | in-progress | P0 | Issue、PR、测试和发布证据形成持续门禁 |

下一执行顺序为：先完成 E03 的数据资产/Agent 契约和 E02 的 Portal 共享中心收口，再按 E04 建设 PCF 完整闭环。生产后端能力由 E06 单独管理，不与静态原型完成状态混淆。

## Issue 层级

- `Roadmap`：全局目标与所有 Epic 的完成度总览。
- `Epic`：围绕同一业务结果的一组 Feature。
- `Feature`：可以独立实现、测试和验收的最小路线图单元。
- Feature 正文第一行必须是 `Epic: #N`。同步脚本会在创建 Issue 后自动回填真实编号。
- 实施 PR 使用 `Refs #N`；真正完成并达到验收标准时才使用 `Closes #N`。

## 状态规则

正常流转为 `status/backlog → status/ready → status/in-progress → status/review → status/done`。

- `blocked` 只用于存在明确外部依赖、权限或决策阻塞时，并在评论中写明解除条件。
- `done` 必须同时具备实现、测试或审查证据；原型完成不等于生产能力完成。
- 一个 Issue 只能有一个 `status/*` Label。
- 状态、标题、结构化正文和标签应先修改 `github-roadmap.json`，再执行同步。

## 本地使用

1. 复制或填写根目录 `.env`：

   ```text
   GITHUB_OWNER=charlielamplit
   GITHUB_REPO=lumino-official-website
   GITHUB_TOKEN=local-token
   ```

2. 校验本地清单：

   ```bash
   node scripts/github-roadmap-sync.mjs --check
   ```

3. 只比较远程，不写入：

   ```bash
   node scripts/github-roadmap-sync.mjs --dry-run
   ```

4. 经审查后创建或更新远程 Label / Issue：

   ```bash
   node scripts/github-roadmap-sync.mjs --apply
   ```

同步是幂等的：脚本优先使用正文中的 `lumino-roadmap-id` 标记识别 Issue，首次同步时才使用精确标题匹配，不会因重复运行创建副本。Token 不会输出到日志，`.env` 已被 Git 忽略。

## GitHub Actions 配置

`roadmap-sync.yml` 使用 GitHub 自动提供的 `GITHUB_TOKEN`，并显式声明 `contents: read` 与 `issues: write`；通常无需另建 Secret。仓库的 Actions 设置必须允许工作流取得读写权限。若组织策略强制只读，则改用 fine-grained PAT，权限至少为 `Metadata: Read` 与 `Issues: Read and write`。

`quality-gates.yml` 在 push/PR 时校验 Roadmap、JavaScript 语法、现有确定性测试、PR 正文章节和空白错误。`roadmap-sync.yml` 仅允许手动触发，避免普通 push 未经审查就批量修改 Issue。

## 修改 Roadmap

1. 为新工作选择已有 Epic；只有出现独立业务结果时才新增 Epic。
2. 新 Feature 至少写清目标、范围、两个验收标准、标签和父 Epic。
3. 先运行 `--check`，再运行测试和 `git diff --check`。
4. 在 PR 中说明变更原因和状态依据。
5. 合并后由维护者手动运行 Roadmap Sync，或在受控环境执行 `--apply`。

不要在 GitHub 正文中长期维护与清单冲突的结构化内容；同步会覆盖标题、正文、标签和开关状态，但不会删除评论。
