# 官网顾问公开 Beta（F08-06）

## 开关与回滚

| 变量 | 作用 |
|---|---|
| `ADVISOR_PUBLIC_BETA=0` | 隐藏「问 Lumino」入口；`/api/advisor` 返回降级说明；计算器等工具仍可用 |
| `ADVISOR_MODEL_ENABLED=0` | 立即停用模型，仅保留固定答案、工具路由与已发布检索 grounded fallback |
| 去掉 `ADVISOR_OPENAI_API_KEY` / `OPENAI_API_KEY` | 同等模型停用效果 |

紧急越界 / 错误法规来源 / 隐私事件：先设 `ADVISOR_MODEL_ENABLED=0`；必要时再设 `ADVISOR_PUBLIC_BETA=0`。

配置接口 `Cache-Control: max-age=30`，前端入口变更最多约 30 秒生效；API 侧 `ADVISOR_PUBLIC_BETA` 为实时读取。

## 公开边界（不可破）

- 回答为**初步判断**，不替代正式合规结论、认证或海关归类。
- 不在聊天中收集联系方式、不接收客户文件、不长期保存对话到线索库（`lumino_conversation_store: false`）。
- 不制造正式送达假象。
- Provider 数据边界用 `storage_policy` 表达，禁止在第三方网关下笼统标记 `store:false`。公开 Beta 前确认：输入/摘录是否落盘、是否训练、日志保留、处理地区、子处理商、不存储合同保证。

## 发布门禁（dev → main）

合并 `main` 前，`dev` Preview 需具备：

1. 功能：预选、自由输入、来源、CTA、关闭/重开；
2. 内容：无内部成熟度泄露；无虚假承诺；
3. 390px / 1440px 无横向溢出；
4. 键盘可达：打开、选择、输入、Escape 关闭、焦点返回；
5. 200% 缩放仍可完成主路径；
6. `node scripts/advisor-eval.mjs` 全绿且 critical_failures=0。

## 运行指标

- 服务端每次 `/api/advisor` 写入结构化日志（无原文）与实例内计数。
- 客户端 CTA / 时延通过 `/api/advisor-metrics` POST（禁止上传问题原文）。
- 员工查看：`GET /api/advisor-metrics` + `X-Lumino-Staff-Key`。

可观察：无模型解决率、工具路由率、无结果率、错误率、超时、模型失败、平均延迟、CTA 点击、降级原因分布。

成本：响应含 `runtime.cost_estimate_usd` 占位；实例计数含 `estimated_cost_usd_sum`。在接入账单/用量管道前，不得宣称已具备准确单次分诊成本。

> Serverless 内存计数按实例、约 24h/500 条上限；生产耐久分析必须接日志管道（Vercel Log Drain 等）。F08-06 监控验收在管道落地前仅算部分完成。

## 每周复核

指标与日志默认**不含问题原文**（隐私约束）。可执行路径：

1. 查看员工 metrics：无结果率、工具路由率、超时、模型失败、CTA。
2. 无结果/错误推荐的具体问题，用内部试用反馈表（`feedback-template.md`）或评测集新增用例补齐，不回灌聊天原文到生产库。
3. 需要补知识或固定答案时，走知识发布 + `advisor-eval` 回归。
4. 变更合入 `dev`，Preview 复核后再决定是否进 `main`。

## 相关文件

- `api/_lib/advisor-flags.js`
- `api/advisor-config.js`
- `api/advisor-metrics.js`
- `docs/advisor/internal-trial.md`
