# Lumino 企业数据资产标准框架

| 属性 | 内容 |
|---|---|
| 文档编号 | LUMINO-EDAF |
| 当前版本 | 0.2.1 |
| 状态 | Draft for implementation |
| 生效范围 | Lumino 门户、CBAM、PCF、ESG 及后续企业服务 |
| 首次发布日期 | 2026-10-22 |
| 维护责任 | Lumino 产品与数据治理 |

## 1. 目的

本框架定义 Lumino 跨服务企业数据资产池的统一对象、字段、版本、质量、血缘、权限、Agent 处理和服务接入规则。它解决以下问题：

1. 企业、工厂、产品、供应商和业务活动数据不因服务不同而重复建设；
2. 原始材料可以跨服务复用，但不同服务的确认、解释、计算和审批彼此独立；
3. 任一正式结果均可追溯到具体资产版本、证据、处理活动、责任主体和服务快照；
4. 新服务通过稳定的接入契约消费数据，不直接修改企业资产；
5. Agent 可以辅助识别和治理数据，但不能绕过人工确认或专业职责分离。

## 2. 规范等级

本文使用以下关键词：

- **必须**：所有实现均需满足；
- **应该**：通常需要满足，偏离时必须记录理由；
- **可以**：可选能力。

当前 `0.x` 版本用于在 CBAM 与 PCF 两个服务中验证模型。进入 `1.0.0` 后，破坏兼容性的修改必须升级主版本并提供迁移方案。

### 2.1 版本规则

本框架采用语义化版本：

- 主版本：删除、改变既有字段语义或破坏服务契约；
- 次版本：增加向后兼容的对象、字段或能力；
- 修订版本：澄清、缺陷修复和不改变契约的校验规则调整。

每次变更必须更新本文的“变更记录”，并评估以下影响：

- 已保存资产；
- 服务绑定；
- 计算快照；
- 报告与交付物；
- API、导入模板和导出格式；
- 权限和保留策略。

## 3. 核心原则

### 3.1 一份资产，一个企业语义

企业电力用量必须建模为服务无关的 `EnergyConsumption`，而不是分别存为“CBAM 电力”和“PCF 电力”。服务通过绑定引用资产。

### 3.2 资产复用不等于结论复用

同一资产可被多个服务引用，但每个服务必须独立记录：

- 使用目的和范围；
- 是否纳入；
- 分配、换算和转换；
- 服务确认状态；
- 所属输入快照；
- 对计算和交付物的影响。

### 3.3 原始值与标准值并存

任何标准化记录必须同时保留原始值、原始单位、标准值、标准单位和转换规则。禁止只保存转换后的数值。

### 3.4 不可变历史

已保存版本不得原位覆盖。更正必须创建新修订版，并通过 `parentVersionId` 连接历史。服务绑定必须锁定具体 `assetVersionId`，不能只引用会变化的当前值。

### 3.5 提议与正式事实分离

Agent 或自动规则生成的内容只能处于 `PROPOSED` 或 `NEEDS_CONFIRMATION`。只有具备权限的人员或明确批准的确定性规则可以生成 `CONFIRMED` 版本。

### 3.6 权限随对象与用途变化

访问控制至少同时考虑：

```text
tenantId + ownerOrganizationId + role/capability
+ assetType + objectScope + confidentiality + serviceBinding
```

角色名称不能替代对象和数据范围授权。

## 4. 逻辑分层

```text
来源层
  文件 / Excel / ERP / MES / API / 人工输入 / 外部声明
      ↓
原始资产层
  Evidence / Dataset / Certificate
      ↓
标准业务记录层
  Measurement / EnergyConsumption / MaterialFlow / ProductionOutput / ...
      ↓
企业确认事实层
  已确认版本 + 数据质量 + 证据 + 血缘
      ↓
服务使用层
  ServiceBinding + Transformation + Snapshot
      ↓
服务结果层
  CalculationRun / Finding / Artifact / Delivery
```

资产池负责前四层；服务负责最后两层。服务不得把自己的方法判断反写为企业通用事实。

## 5. 标识与时间模型

### 5.1 标识

每个资产必须具有：

| 字段 | 含义 |
|---|---|
| `id` | 稳定资产身份，例如 `REC-HX-POWER-2026Q3` |
| `versionId` | 不可变版本身份，例如 `REC-HX-POWER-2026Q3@2` |
| `revision` | 单调递增整数 |
| `parentVersionId` | 直接上一个版本；首版为空 |
| `schemaVersion` | 该类资产使用的字段 Schema 版本 |
| `frameworkVersion` | 创建该版本时采用的框架版本 |

外部标识不得直接作为内部主键，应保存在 `externalIdentifiers` 中并注明标识类型和签发方。

### 5.2 时间

业务对象必须区分：

| 字段 | 含义 |
|---|---|
| `periodStart` / `periodEnd` | 活动数据覆盖期间 |
| `observedAt` | 测量或事件实际发生时间 |
| `recordedAt` | 进入 Lumino 的时间 |
| `validFrom` / `validTo` | 主档、声明或证书的业务有效期 |
| `createdAt` | 当前不可变版本的创建时间 |

禁止使用一个模糊的 `date` 字段同时承担上述语义。

## 6. 核心对象分类

### 6.1 组织与主数据

| 对象类型 | 必要业务字段 |
|---|---|
| `Organization` | 法定名称、注册号、国家/地区、地址、组织类型、外部标识 |
| `OrganizationUnit` | 名称、上级组织、负责人、职能 |
| `Facility` | 名称、内部编码、地址、地理位置、生产活动、运营状态 |
| `Product` | 名称、内部编码、类别、分类编码、规格、所有方 |
| `ProductVariant` | 所属产品、型号/牌号、包装、技术规格 |
| `Process` | 工艺名称、设施、输入输出、有效期 |
| `ProductionLine` | 设施、产线编码、主要工艺、运行状态 |
| `Counterparty` | 交易方组织、关系类型、供应产品/服务、有效期 |

### 6.2 活动与业务事件

| 对象类型 | 必要业务字段 |
|---|---|
| `Measurement` | 指标、原始值、单位、测量点、期间或时点 |
| `EnergyConsumption` | 能源类型、数量、单位、设施/产线、属性、期间 |
| `MaterialFlow` | 材料、数量、单位、来源/去向、供应商、期间 |
| `ProductionOutput` | 产品/联产品、数量、单位、设施/产线、期间 |
| `TransportActivity` | 对象、质量、运输方式、起讫地、距离、期间 |
| `WasteActivity` | 废物类型、数量、单位、处理方式、去向、期间 |
| `ShipmentEvent` | 对象、事件类型、时间、地点、交易方、数量 |
| `BusinessTransaction` | 交易类型、交易方、对象、数量、金额、日期 |

### 6.3 文件、声明和参考资产

| 对象类型 | 必要业务字段 |
|---|---|
| `Evidence` | 文件名、媒体类型、大小、内容哈希、存储引用、文档类型、覆盖期 |
| `Dataset` | 名称、格式、来源系统、字段定义、更新频率、覆盖范围 |
| `SupplierDeclaration` | 签发方、声明对象、声明类型、值、单位、方法、有效期 |
| `Certificate` | 证书类型、编号、签发方、持有人、有效期、核查状态 |
| `ReferenceData` | 代码集或因子集名称、版本、发布方、适用范围 |

## 7. 通用字段外壳

所有资产版本必须实现以下逻辑字段组。

### 7.1 身份与所有权

```json
{
  "id": "REC-HX-POWER-2026Q3",
  "versionId": "REC-HX-POWER-2026Q3@1",
  "revision": 1,
  "parentVersionId": null,
  "type": "energyConsumption",
  "schemaVersion": "1.0.0",
  "frameworkVersion": "0.1.0",
  "tenantId": "TNT-0018",
  "ownerOrganizationId": "ORG-HX-001",
  "name": "上海一厂购入电力"
}
```

### 7.2 业务主体和时间

```json
{
  "subjectRefs": {
    "facilityId": "FAC-SH-01",
    "productId": null,
    "processId": null,
    "counterpartyId": "ORG-GRID-SH"
  },
  "temporal": {
    "periodStart": "2026-07-01",
    "periodEnd": "2026-09-30",
    "observedAt": null,
    "recordedAt": "2026-10-08T09:15:00Z",
    "validFrom": null,
    "validTo": null
  }
}
```

### 7.3 数值和业务载荷

数值字段必须采用十进制字符串：

```json
{
  "payload": {
    "metricCode": "energy.electricity.purchased",
    "originalValue": "12480",
    "originalUnit": "MWh",
    "normalizedValue": "12480000",
    "normalizedUnit": "kWh",
    "conversionRuleId": "UNIT-MWH-KWH@1.0.0",
    "dataOrigin": "invoice",
    "estimationMethod": null
  }
}
```

`dataOrigin` 建议枚举：

```text
measured | invoice | ledger | erp | supplier
certificate | industry_average | deterministic_estimate
agent_estimate | manual
```

### 7.4 来源、质量与权限

```json
{
  "provenance": {
    "sourceType": "agent-extraction",
    "sourceAssetIds": ["EVD-HX-POWER-2026Q3"],
    "extractionRuleVersion": "extract-energy@1.0.0",
    "confirmedBy": "USR-ZHOU-LAN",
    "confirmedAt": "2026-10-09T02:00:00Z"
  },
  "quality": {
    "status": "usable",
    "completeness": 1,
    "accuracy": 0.9,
    "consistency": 1,
    "timeliness": 0.95,
    "uniqueness": 1,
    "traceability": 1,
    "methodologicalFit": null,
    "issues": []
  },
  "access": {
    "confidentiality": "sensitive",
    "visibility": "enterprise",
    "allowedRoles": [],
    "metadataVisible": true,
    "retentionPolicyId": "RET-COMPLIANCE-10Y"
  }
}
```

质量分值范围为 `0–1`，未知必须使用 `null`，不得用 `0` 表示未知。

## 8. 文件和证据规则

`Evidence.payload` 至少包括：

```text
fileName
mediaType
fileSize
contentHash
storageRef
documentType
language
issuedBy
issuedAt
coverageStart
coverageEnd
sourceSystem
sourceReference
securityScanStatus
parseStatus
```

规则：

1. `contentHash` 用于重复识别，不代表业务内容完全相同；
2. 原文件不得因 OCR、格式转换或清洗被覆盖；
3. 转换文件必须作为新资产，并通过血缘关联原文件；
4. 文件和记录通过 `EvidenceReference` 或血缘边连接；
5. 一份文件可以关联多条记录和多个服务绑定；
6. 敏感原文件与可共享摘要必须是不同资产。

## 9. 血缘模型

血缘采用 `Entity → Activity → Entity` 的逻辑结构：

```text
电力账单@1
  └─ AGENT_EXTRACTION / extract-energy@1.0.0 / Asset Agent
       └─ 电力记录@1（PROPOSED）
            └─ HUMAN_CONFIRMATION / 周岚
                 └─ 电力记录@2（CONFIRMED）
                      ├─ CBAM Binding
                      └─ PCF Binding
```

每条血缘边必须记录：

```text
fromAssetId / fromVersionId
toAssetId / toVersionId
activityType
agentType / agentId
ruleVersion
createdAt
```

设计参考为 W3C PROV 的 Entity、Activity 和 Agent 模型，但内部实现不要求采用 RDF。

## 10. 服务绑定契约

`ServiceBinding` 是企业资产与具体服务之间唯一允许的连接方式。

```json
{
  "id": "BIND-PCF-POWER-001",
  "tenantId": "TNT-0018",
  "serviceId": "pcf",
  "caseId": "PCF-2026-001",
  "assetId": "REC-HX-POWER-2026Q3",
  "assetRevision": 2,
  "assetVersionId": "REC-HX-POWER-2026Q3@2",
  "usagePurpose": "产品能源分配",
  "scopeId": "PCF-SCOPE-HRC-01",
  "included": true,
  "inclusionReason": "上海一厂生产期间购入电力",
  "transformationId": "ALLOC-HRC-ELECTRICITY@1",
  "allocationRuleId": "MASS-ALLOCATION@1",
  "status": "PENDING_CONFIRMATION",
  "snapshotId": null
}
```

绑定状态：

```text
PROPOSED → PENDING_CONFIRMATION → CONFIRMED
          └────────────────────→ REJECTED
CONFIRMED → SUPERSEDED
```

绑定确认不得修改企业资产，也不得改变其他服务的绑定状态。

### 10.1 已确认资产的修订影响

已确认资产需要更正时，必须按以下流程处理：

1. 新建资产修订版，状态回到 `NEEDS_CONFIRMATION`；
2. 保留原 `CONFIRMED` 版本，不覆盖、不删除；
3. 通知所有引用旧版本的服务，但不自动切换绑定；
4. 各服务独立选择“继续使用旧版本”或“创建指向新版本的待确认绑定”；
5. 新绑定确认后，旧绑定变为 `SUPERSEDED`；
6. 使用旧版本的未锁定计算快照标记为 `STALE`，已锁定报告保持可重现且记录影响告警。

本轮原型已实现资产修订影响流程与未锁定快照 / 计算运行的 `STALE` 传播；已锁定快照保持可重现并记录影响告警。

## 11. Agent 数据处理规范

### 11.1 Agent 可以执行

- 文档分类、OCR 和表格解析；
- 字段与实体匹配建议；
- 单位标准化建议；
- 重复、冲突和异常识别；
- 证据引用建议；
- 数据质量问题生成；
- 跨服务复用建议；
- 过期和修订提醒。

### 11.2 Agent 不得执行

- 把提议直接写为 `CONFIRMED`；
- 在存在歧义时自动合并企业、工厂、产品或供应商；
- 自动决定系统边界、分配方法和专业适用性；
- 自动批准跨服务使用；
- 修改已锁定版本；
- 替代专家复核、企业审批或外部核查。

### 11.3 AgentProposal

每条提议至少记录：

```text
proposalId
targetAssetType
targetAssetId
sourceAssetIds
proposedPatch
confidence
agentId
modelVersion
ruleOrPromptVersion
createdAt
reviewStatus
reviewedBy
reviewedAt
reviewReason
```

系统不保存未公开的模型思维链，但必须保存来源、规则/模型版本、提议字段和最终人工决定。

### 11.4 提议的应用边界

- `AgentProposal` 是独立的审查对象，不是正式资产。
- Agent 可以由提议生成一个 `PROPOSED` 资产版本，但该操作必须保留 `proposalId` 和 `sourceAssetIds`，且不得自动生成 `CONFIRMED` 版本。
- 人员点击“接受提议”只表示将补丁写入待确认版本；“确认企业事实”是独立操作，需要 `asset.confirm` 权限和确认依据。
- 确定性规则只有在作为已登记的 `system` 执行者、锁定规则版本、通过预批准控制和完整审计时，才可生成 `CONFIRMED`；普通 Agent 不得借用该通道。
- `0.x` 原型不开放确定性规则自动确认，所有企业事实均使用人工确认。

## 12. 数据质量

数据质量必须按维度记录，而非只提供一个总分：

| 维度 | 判断问题 |
|---|---|
| 完整性 | 必填信息和预期记录是否齐全 |
| 准确性 | 是否与来源、测量或权威记录一致 |
| 一致性 | 单位、期间、对象和其他记录是否冲突 |
| 及时性 | 是否适用于目标期间和当前用途 |
| 唯一性 | 是否存在重复资产或重复业务记录 |
| 可追溯性 | 是否能够回到原始证据和处理活动 |
| 方法适用性 | 是否满足具体服务的方法要求 |

`methodologicalFit` 默认为 `null`，由服务绑定层评估；企业资产层不得假设某条数据天然适用于所有服务。

## 13. 权限和敏感等级

敏感等级：

```text
general
internal
sensitive
highly_sensitive
```

基础权限能力：

```text
asset.read
asset.create
asset.revise
asset.confirm
asset.bind
binding.confirm
asset.manage_access
asset.view_lineage
asset.view_sensitive_content
```

默认规则：

- 数据贡献者只访问分配给自己的范围；
- 企业审批人只访问待审批对象和必要证据；
- 专家只访问已绑定给其服务和工作包的数据；
- 复核员只访问需要独立复核的快照；
- 运营只看元数据、进度和阻塞，不默认读取敏感内容；
- 平台支持不得因支持角色自动获得业务数据读取权。

## 14. 外部标准映射

| 标准 | 本框架中的用途 |
|---|---|
| PACT Technical Specifications 3.x | PCF 对外交换适配、足迹版本和数据质量字段 |
| W3C PROV | 血缘概念和责任主体关系 |
| W3C DCAT 3 | 数据目录、数据集系列、版本和分发描述 |
| GS1 EPCIS 2.0 | 生产、物流和供应链事件映射 |
| ISO 8000 系列 | 数据质量规划、测量和报告方法 |
| GHG Protocol / ISO 14067 | 服务层核算方法与报告语义 |

内部核心模型不直接等同于任何单一外部标准。外部标准通过适配器转换，避免法规或标准版本变化破坏企业资产。

参考：

- https://docs.carbon-transparency.org/data-exchange-protocol/
- https://www.w3.org/TR/prov-overview/
- https://www.w3.org/TR/vocab-dcat-3/
- https://www.gs1.org/standards/epcis
- https://www.iso.org/standard/60805.html
- https://ghgprotocol.org/product-standard

### 14.1 新服务准入契约

新服务接入资产池前必须提交：

1. `serviceId`、所有角色与权限能力；
2. 允许读取的资产类型和对象范围；
3. `ServiceBinding` 使用目的、条件必填字段和确认人；
4. 转换、分配、快照和计算的版本契约；
5. 资产新版本、撤销授权、锁定交付物的响应规则；
6. 负向权限、独立确认、历史重现和契约兼容性测试。

服务只能调用资产内核公开能力，不得直接修改资产存储。

### 14.2 PCF 服务适配基线

PCF 的专业结构以项目目录中的 `pcf-calculation` 和 `pcf-report` 能力为实施参考。两者约束服务层，不改变企业通用资产的业务语义。

PCF 案例必须单独定义：

| 组别 | 必要内容 |
|---|---|
| 核算声明 | 核算目标、产品、功能单位、参考流、核算期间、地理与技术适用性 |
| 系统边界 | 从摇篮到大门 / 从摇篮到坟墓等边界类型、纳入和排除项、截断规则 |
| 生命周期结构 | 阶段、单元过程、中间流、输入输出和共产品关系 |
| 排放清单 | 活动数据、原始/标准单位、数据类型、来源等级、分配与转换 |
| 运输活动 | 起讫地、方式、质量、距离、载货率和回程设定 |
| 排放因子 | 来源库、数据集 ID、版本、地域、年份、分子/分母单位和适用理由 |
| 质量与不确定性 | 实测/供应商/估算分层、数据质量、不确定性、敏感性及替代方案 |
| 计算和报告 | 确定性计算快照、阶段结果、热点、完整/简版报告类型和模板版本 |

PCF 计算管道按以下七个可审计活动记录，每一步均必须写入输入快照、规则/模型版本、输出与待确认事项：

```text
LCA 结构推理
→ 排放清单拆解
→ 活动数据推算/确认
→ 运输距离与活动建模
→ 排放因子及单位匹配
→ 确定性计算
→ 热点解读与减排建议
```

服务边界、功能单位、分配规则、因子适用性和报告结论都不得被 Agent 自动确认。PCF 报告必须锁定系统边界、功能单位、清单版本、因子版本、计算快照和报告模板版本，不得只保留最终数字或 PDF。

## 15. 门户信息架构

全局“资料中心”升级为“数据资产”，包含：

1. 资产概览；
2. 企业与工厂；
3. 产品与工艺；
4. 活动数据；
5. 文件与证明；
6. 数据质量与问题；
7. 服务使用情况；
8. 权限与历史版本。

普通用户首先看到当前需要处理的一个问题，而不是技术字段目录。资产详情必须回答：

- 这是什么；
- 属于谁；
- 覆盖什么对象和期间；
- 来源是什么；
- 是否确认；
- 质量如何；
- 哪些服务正在使用；
- 影响了哪些结果和交付；
- 谁可以访问；
- 是否存在新版本。

## 16. 实施顺序

1. 实现资产注册、版本、血缘、权限和服务绑定内核；
2. 建立可执行 JSON Schema 与自动测试；
3. 在门户建立数据资产概览和详情；
4. 把现有企业、设施、产品、电力账单和活动记录迁入资产池；
5. 让 PCF 从资产池选择并绑定数据；
6. 让 CBAM 改为使用同一资产；
7. 验证跨服务复用与独立确认；
8. 再扩展 ESG 和其他服务。

### 16.1 当前实施基线（框架 0.2.0）

| 能力 | 实现 | 状态 |
|---|---|---|
| 标准文档 | `docs/enterprise-data-asset-framework.md` | 已完成 |
| 资产版本、确认、服务绑定、血缘、过滤 | `portal/domain/data-asset-engine.js` | 原型已实现（`FRAMEWORK_VERSION` 0.2.0） |
| 资产、服务绑定、Agent 提议、快照、转换、计算运行 Schema | `portal/schemas/*.schema.json` | 已完成 |
| 全局“数据资产”页 | `portal/pages/multi-service-pages.js` | 原型已实现 |
| 资产内核自动测试 | `tests/data-asset-engine.test.cjs` | 已完成（含 STALE / supersede） |
| `Snapshot` / `Transformation` / `CalculationRun` 与失效传播 | `portal/domain/data-asset-engine.js` | 原型已实现 |
| PCF 引用资产池与独立绑定确认 | `multi-service-pages.js` / `portal-events.js` | 原型已实现 |
| CBAM 企业 / 设施 / 产品 / 电力迁入资产池 | `portal-config.js` / `customer-pages.js` | 原型已实现 |
| PCF 七步计算与报告契约 | 本文 14.2 | 规范已建立，完整管道实现待建 |

### 16.2 下一优先级

1. 增加跨服务更新影响预览 UI 与负向权限测试扩展；
2. 完成 PACT 导出适配的第一个契约测试；
3. 实现 PCF 七步可审计计算管道与报告模板锁定（§14.2）；
4. 为 Schema 增加运行时校验与导入模板契约测试。

## 17. 进入 1.0.0 的验收门槛

- CBAM 和 PCF 均不再硬编码企业主数据和共享材料；
- 同一资产可被两个服务绑定且确认状态独立；
- 任一计算输入均锁定具体资产版本；
- Agent 无法直接创建正式事实；
- 跨租户、跨对象、跨服务负向权限测试通过；
- 资产变更能够使受影响的计算快照过期；
- 数据导出可映射至 PACT PCF 数据交换格式；
- 历史报告仍能解析其使用的旧资产版本。

## 18. 变更记录

| 版本 | 日期 | 类型 | 说明 |
|---|---|---|---|
| 0.2.1 | 2026-10-27 | Patch | 更新实施基线：Snapshot/Transformation/CalculationRun、STALE 传播、PCF/CBAM 资产池接入已在门户原型落地 |
| 0.2.0 | 2026-10-27 | Minor | 结合 `pcf-calculation` 与 `pcf-report` 增加 PCF 核算声明、生命周期结构、数据/因子分层、七步计算和报告锁定契约 |
| 0.1.0 | 2026-10-22 | Initial draft | 建立对象分类、字段外壳、版本、血缘、质量、权限、Agent 和服务绑定规范；明确修订影响、提议应用、新服务准入与实施基线 |
