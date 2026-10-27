# Lumino 公开站（apps/site）

官网、服务说明页、知识库与试算器。

## 内容

- `Lumino *.dc.html` — 营销页
- `site/` — 共享壳层、样式、服务注册与渲染
- `services/*` — 六项服务落地页
- `calculator/`、`knowledge/`

## 边界

- **不依赖** `packages/agent` 运行时；仅通过文案声明与门禁意图对齐（`stages[].validationSummary`）
- 公共服务契约读取 `packages/shared/service-contract.js`（共享声明字段）
- 部署时可用根目录 `vercel.json` 将 `/services/*`、`/calculator` 等重写到本目录

## 本地

仓库根目录静态托管后访问 `/` 或 `/apps/site/Lumino%20官网.dc.html`。
