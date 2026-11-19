# Vercel 与腾讯云统一生产发布

生产代码只有一个来源：受保护的 `main` 提交。Vercel Production 先发布该提交；腾讯云工作流确认 Vercel 已返回相同 SHA 后，才将同一提交发布到 Lighthouse。

## 发布不变量

- 不从 `dev`、功能分支或独立 `server` 分支直接发布生产。
- Vercel 公网与腾讯服务器本机的 `/api/release` 必须返回同一个 40 位 `releaseSha`。
- 腾讯云从当前不可变版本克隆新的 staging release，只同步精确 SHA 的差异文件，安装依赖后才切换；冒烟失败自动恢复前一 release。
- `.env` 与 `data/` 位于共享运行目录，不由代码拉取覆盖或删除。
- 数据库迁移不属于代码同步动作，必须按独立生产门禁执行。

## GitHub Environment

Environment：`tencent-lighthouse`

Secrets：

- `SSH_PRIVATE_KEY`
- `SSH_KNOWN_HOSTS`：预先核实并固定的服务器 host key
- `DEPLOY_HOST`
- `DEPLOY_USER`

可选 Variables：

- `DEPLOY_DIR`，默认 `/var/www/lumino`
- `DEPLOY_SERVICE`，默认 `lumino-site`
- `VERCEL_PRODUCTION_URL`，默认 `https://lumino-official-website.vercel.app`
- `PUBLIC_EDGE_URL`，默认 `http://DEPLOY_HOST`，仅检查 Nginx 首跳可达
- `TENCENT_HEALTH_URL`，默认 `http://127.0.0.1:4174`，通过 SSH 在服务器本机检查应用

## 正常发布

1. Feature PR 合入 `dev` 并完成验收。
2. `dev → main` PR 完成发布审查并合并。
3. Vercel 自动发布 `main`。
4. `Deploy Production` 确认 Vercel SHA 后发布腾讯云。
5. 工作流从公网检查 Vercel，从腾讯服务器本机检查首页、官网、Calculator、Portal、关键 API 与 `/api/release`。GitHub Runner 到中国域名的跨境连接不作为应用健康判据。

## 本地受控发布

GitHub Runner 到腾讯云链路不可用时，可在已授权的本地发布机执行 `scripts/deploy-tencent-local.sh`。脚本拒绝脏工作区，并要求 `HEAD` 与 `origin/main` 完全相同、Vercel 已返回相同 SHA；本地只承担差异传输和发布控制，不允许直接发布 `dev` 或未提交内容。

本地需要设置 `DEPLOY_HOST`、`DEPLOY_USER`，并使用专用密钥 `~/.ssh/lumino_tencent_deploy`。公钥登记通过受保护的 `Authorize Local Tencent Deployer` 手动工作流完成。

## 回滚

腾讯发布脚本在切换前记录前一 release；切换后的冒烟失败会自动回滚。需要人工重发旧版本时，从 GitHub Actions 手动运行 `Deploy Production`，输入仍属于 `main` 历史的完整 SHA。Vercel 与腾讯云都应回退到同一提交，不能只回退一边。
