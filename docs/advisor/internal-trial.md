# 官网顾问内部试用与回归（F08-05）

## 目标

在公开 Beta 前，用受控 Preview 验证固定答案、工具路由、检索停止与模型边界，并建立可回归的反馈闭环。

## 准入

1. 仅内部同事或受邀试用者；不向公开流量开放聊天留资。
2. 使用 `dev` 的 Vercel Preview URL（或受保护 Staging），不指向 `main` 生产。
3. 试用前确认：
   - 评测集 `packages/advisor/evals/cases.json` ≥ 120 且本地/CI 全绿；
   - 未配置生产线索库；顾问 API 仍为无状态、不写 Portal。

## 试用清单

- 预选话题：九个初始话题各走通一轮（中/英各至少一次）。
- 工具路由：CN / HS / TARIC 询问必须落到试算器 + 指南 + 联系页，不得给出正式归类。
- 检索：对已发布知识相关开放问题应带来源；无关问题应停止。
- 安全：提示注入、虚假承诺、手机号/邮箱输入不得复述敏感信息。
- 移动端：390px 打开/输入/关闭/Escape；`prefers-reduced-motion` 下无打印动画。

## 反馈记录

使用 [feedback-template.md](./feedback-template.md) 或 Issue 评论，至少记录：

| 字段 | 说明 |
|---|---|
| Preview URL / commit | 复现环境 |
| 输入原文（可脱敏） | 用户问题 |
| 实际意图 / answer_mode | 观察到的路由 |
| 问题类型 | 错误意图 / 无结果 / 错误推荐 / 越界 / 隐私 / 其他 |
| 期望行为 | 应用哪条规则或哪篇知识 |
| 严重级别 | blocker / major / minor |

## 修复与回归

1. 内容问题：先改 `packages/advisor/catalog.js` 或 `apps/site/knowledge/**`，更新 `reviewedAt` / 版本。
2. 路由问题：补关键词或工具登记，并在评测集新增对应用例。
3. 检索噪声：调整 `api/_lib/advisor-retrieval.js` 停用词或 `MIN_RETRIEVAL_SCORE`，跑 `node scripts/advisor-eval.mjs`。
4. 合并前必须：`node --test tests/advisor-eval.test.cjs packages/advisor/tests/*.test.cjs` 通过。

## 知识版本回退

1. 以 Git 为准：回退相关知识 Markdown / `catalog.json` / advisor catalog 到上一发布 commit。
2. 清检索缓存：进程重启或调用 `clearRetrievalCache()`（Serverless 冷启动即新版本）。
3. 紧急时可关闭模型 Key（去掉 `ADVISOR_OPENAI_API_KEY` / `OPENAI_API_KEY`），顾问仍保留确定性固定答案、工具路由与 grounded fallback。
4. 公开 Beta 开关（F08-06）启用后，严重越界应立即停用模型并回退到固定答案 + 工具路由。

## 报告指标

评测脚本输出：

- 无模型解决率 `no_model_resolution_rate`
- 工具路由率 `tool_route_rate`
- 无依据停止率 `stop_without_sources_rate`
- 服务推荐安全率 `service_recommendation_safe_rate`

命令：

```bash
node scripts/advisor-eval.mjs --out packages/advisor/evals/.last-report.json
```
