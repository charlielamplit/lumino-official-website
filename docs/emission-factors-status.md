# 排放因子现状说明（2026-10-28）

## 结论

| 问题 | 答案 |
|---|---|
| Lumino 仓库内是否内置生产级因子库？ | **否**。Portal 当前仍用 `packages/agent/domain/pcf-factors.js` 演示集（`sourceKind: demo_stub`／可引用本地样例形态）。 |
| 本机是否另有可参考的排放因子项目？ | **是**。见下方「本地参考项目」。 |
| `apps/site/calculator/data/default-values.json` 是什么？ | CBAM 试算默认／基准值，**不是** PCF 排放因子库。 |
| `pcf-calculation` skill 是否内置因子文件？ | **否**。skill 假定外部因子库 API；与本机 DatabaseofEmissionFactor 的目标一致。 |

## 本地参考项目

### A. 规划与原始数据（工作文档）

路径：`/Users/qikunmac01/Documents/01Charlie/01_工作文档/01_碳中和/1_项目工作/13_排放因子库`

| 内容 | 用途 |
|---|---|
| `00_国际标准排放因子数据库建设规划报告.md` | 建设目标与标准对齐 |
| `01_排放因子数据模型设计详解.md` | 字段语义（活动分类、地域、时效、数值、来源、Pedigree） |
| `02_排放因子样例.md` | 完整 JSON 样例（如华北电网燃煤 0.8241 kgCO2eq/kWh） |
| `03_排放因子Pedigree矩阵质量评分系统详解.md` | 质量评分与等级 |
| `排放因子库/tiangong-lca-data-v0.1.4 (2)/` | 天工 ILCD 数据包（processes ≈ 3.9k，flows ≈ 44k） |

### B. 可运行因子库（Autocoding）

路径：`/Users/qikunmac01/Documents/01Charlie/03_Autocoding/DatabaseEmissionFactor/DatabaseofEmissionFactor`

| 内容 | 用途 |
|---|---|
| `mvp_data_model.md` / `database/init.sql` | PostgreSQL 模型与种子（全国电网平均 0.5703、华北燃煤 0.8241） |
| `backend` `GET/POST /api/v1/emission-factors*` | 查询、搜索、导入、校验、质量评估 |
| `API_SPECIFICATION.md` | Pedigree 质量分与校验接口 |
| `frontend` | 因子库管理界面原型 |

与规划文档同源：模型／样例／Pedigree 文稿在两边各有一份。

## skill 与外部库

`pcf-calculation` 仍指向：实测 → CPCD／IPE／天工 → Ecoinvent／GaBi。  
本机 **天工 ILCD 包**与 **DatabaseofEmissionFactor API** 是落实该假设的首选内部实现，而不是把 CPCD／Ecoinvent 文件拷进 Lumino。

## 推荐接入路径（单独立项，本轮不做联机）

1. **引用层**：Portal／Agent 只存因子引用（uuid、数据集、版本、地域、单位、数值快照、适用理由），不把整库搬进静态原型。
2. **适配**：`DatabaseofEmissionFactor` MVP 字段 → Lumino `pcf-factors` item／资产 `ReferenceData`：
   - `uuid` → `datasetId`／`id`
   - `activity_category.display_name_cn` → `name`
   - `geographic_scope` → `geography`
   - `emission_value.value/unit` → `value` + 分子／分母单位
   - `emission_value.reference_year` → `year`
   - `data_source` → `library`／出处说明
   - `quality_info.grade` → 数据质量旁注（可选）
3. **运行时**：Agent `proposal_only` 调用 `GET /api/v1/emission-factors/search`；人工确认适用性后才 `confirm`。
4. **天工包**：作 ILCD／过程库导入源，经 DatabaseofEmissionFactor 规范化后再供 PCF 引用。

## 对原型的含义

- 不得宣称 Lumino 已联机生产因子库或已加载全部天工过程。
- 演示因子可标注「形态对齐本地因子库种子／样例」，数值仍须人工适用性确认。
- 正式接入前保持 `sourceKind` 区分：`demo_stub`｜`local_catalog_sample`｜`remote_api`。


## 匹配推荐（已实现于原型）

- `pcf-factor-catalog.js`：本机因子库种子只读快照。
- `pcf-factor-matcher.js`：按活动类型、地域／电网区、参考年、单位兼容性、质量等级评分。
- `pcf-factors.recommendSet`：为每个活动需求自动选出最高分推荐，并保留备选。
- Portal：展示推荐理由；用户可改选备选后确认适用性。**不要求业务用户自行检索专业库。**
- Agent／系统推荐均为 `proposal_only`；确认后才进入正式计算。
