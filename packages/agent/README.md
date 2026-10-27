# @lumino/agent

Lumino **领域内核** + **Agent Runtime 壳**（借鉴 Bravo Agent Service 的任务语义，不照搬其落库方式）。

## 边界

| 层 | 目录 | 可做 | 不可做 |
|---|---|---|---|
| Domain | `domain/` | 资产版本、绑定、门禁、工作流 | 调用模型、直写正式确认 |
| Runtime | `runtime/` | 任务状态机、能力目录、Proposal 桥接 | `confirm` / 锁定报告 / 正式计算 |

完成模式固定为 **`proposal_only`**：任务结果只能变成 `PROPOSED` / `PENDING_CONFIRMATION`。

## Runtime API

- `AgentTaskEngine.submit({ serialNo, businessType, input })` — `serialNo` 幂等
- `markProcessing` / `complete` / `fail` / `retry` / `simulateSuccess`
- 状态：`SUBMITTING → PROCESSING → READY|READY_PARTIAL|FAILED|SUBMIT_UNKNOWN|SYNC_FAILED`
- `LuminoProposalBridge.applyTaskResult(registry, task)` — 只登记提议与建议绑定

## 能力目录

见 `runtime/capability-catalog.js`（`CBAM_ENERGY_INVOICE_EXTRACT`、`PCF_DATA_PACK_VALIDATE`…），每项绑定 `stageIds` 与 `ruleOrPromptVersion`。

## 测试

```bash
npm test
# 或
node --test tests/*.test.*
```
