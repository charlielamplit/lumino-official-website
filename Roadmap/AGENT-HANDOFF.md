# Agent Handoff：Roadmap 与工作领取

开始工作前，Agent 必须先阅读：

1. `Roadmap/README.md`
2. `Roadmap/github-roadmap.json`
3. 目标 Feature 的 `references`
4. 与目标目录相关的现有测试和契约文档

## 工作协议

- 一次只领取一个主要 Feature；在交接记录中写明 Feature ID。
- 不把 Feature 范围外的重构、生产后端或公开承诺顺带纳入。
- 开始时把清单状态更新为 `status/in-progress`；准备审查时更新为 `status/review`。
- 只有实现、自动化测试和必要截图/文档全部完成后，才能改为 `status/done` 并关闭 Issue。
- 发现新需求时先作为候选 Feature 记录，不直接扩大现有 Feature 的验收标准。
- 数据资产、Agent、PCF 和 Portal 发生契约变化时，必须同步更新引用该契约的测试与文档。

## 交接内容

交接给下一个 Agent 时至少写明：

- Feature ID 和 GitHub Issue 编号；
- 已完成内容与实际修改文件；
- 已执行的测试及结果；
- 未完成项、已知风险和明确阻塞；
- 下一步建议与不可突破的范围边界；
- 是否修改了公开声明、权限边界、数据模型或计算口径。

当前建议领取顺序：`F03-01 / F03-02 → F02-02 / F02-03 → F04-01 → F04-02 → F04-03 → F04-04 → F04-05 → F04-06`。
