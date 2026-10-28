# 排放因子现状说明（2026-10-28）

## 结论

| 问题 | 答案 |
|---|---|
| 项目本地是否有真实排放因子库？ | **没有**。仅有 `packages/agent/domain/pcf-factors.js` 中的演示桩（`sourceKind: demo_stub`）。 |
| `apps/site/calculator/data/default-values.json` 是什么？ | CBAM 试算默认／基准值，**不是** PCF 排放因子库。 |
| `pcf-calculation` skill 是否内置因子库文件？ | **否**。skill 只有提示词、schema 与样例产品 JSON；因子库被假定为外部 API／数据库。 |

## skill 指向

`pcf-calculation/reference.md` §8 与 `SKILL.md` 指向外部来源优先级：

1. 实测／供应商一次数据
2. 国内：CPCD、IPE、天工
3. 国际：Ecoinvent、GaBi

`prompts/emission-factor-unit-matching.md` 明确假设「排放因子库有完整的 API 访问权限」，并示例来源为 Ecoinvent／国家电网——**不是本仓库文件路径**。

## 对原型的含义

- Portal 可演示因子适用性确认与锁定血缘，但不得宣称已接生产因子库。
- 后续接入时，应把外部数据集映射为资产 `ReferenceData`／因子引用，并保留版本、地域、单位与适用理由；不要把演示数值写成正式公开声明。
