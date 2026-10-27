# Portal 数据资产前端消费契约

| 属性 | 内容 |
|---|---|
| 文档版本 | 0.1.0 |
| 日期 | 2026-10-27 |
| 状态 | Phase 0 产物 / 与资产框架 0.2.1 对齐 |
| 范围 | Portal 页面字段、动作、失败恢复与公开方法映射 |
| 约束 | 页面不得新建平行正式状态；不得直接改资产存储 |

## 1. 基线检查（本轮开始时）

| 检查 | 结果 |
|---|---|
| `git status` | 存在营销/审查相关未提交改动与本计划文档；未对资产内核做破坏性覆盖 |
| `git diff --check` | 通过 |
| `node --test tests/*.test.* packages/agent/tests/*.test.*` | 49 项通过 |
| 资产框架版本 | `FRAMEWORK_VERSION = 0.2.0`（文档基线记为 0.2.1） |
| 并行禁改区 | `data-asset-engine.js`、`packages/agent/schemas/`、框架核心语义——本轮不修改 |

## 2. 公开读取与命令方法

来源：`packages/agent/domain/data-asset-engine.js` 现有公开能力（只读适配层应包装这些方法）。

| 能力 | 方法 | 页面用途 |
|---|---|---|
| 列表 | `catalog({ tenantId, role, type, status })` | 资产概览、分面筛选 |
| 当前/指定版本 | `get(id, revision?)` | 详情、胶囊、服务页引用 |
| 历史 | `history(id)` | 详情版本时间线 |
| 绑定 | `bindings(filter)` / `bindingsForAsset(id)` | 服务使用、跨服务复用 |
| 血缘 | `lineage(assetId)` | 详情来源链 |
| 快照 / 运行 | `snapshots` / `getSnapshot` / `calculationRuns` / `getCalculationRun` | 影响、PCF/CBAM 计算区 |
| 影响预览 | `previewImpact(assetId, revision?)` | 修订影响侧栏 |
| 写操作 | `confirm` / `revise` / `bind` / `confirmBinding` / `rejectBinding` / `supersedeBinding` / `createSnapshot` / `lockSnapshot` / `markCurrent` | 仅经事件层 + 权限角色调用 |

## 3. 页面—数据映射

### 3.1 资产概览

| 用户看见 | 字段来源 | 动作 | 失败／恢复 |
|---|---|---|---|
| 当前待处理一件事 | `bindings` 中 `PENDING_CONFIRMATION` + 资产名 | 进入服务确认 / 打开详情 | 无待办：展示空状态与「登记新资料」 |
| 分面计数 | `catalog` 按 type / binding 过滤 | 切换分面 | 无权限：列表为空并说明角色范围 |
| 行：名称、覆盖期、服务标签、状态 | `name`、`temporal`、`bindings[].serviceId/status`、`status`、`quality` | 打开详情 | 加载失败：Toast + 保留上一屏 |

### 3.2 资产详情

| 用户问题 | 字段来源 | 动作 |
|---|---|---|
| 这是什么 / 属于谁 | `type`、`name`、`ownerOrganizationId` | — |
| 覆盖对象与期间 | `subjectRefs`、`temporal` | — |
| 来源与确认 | `provenance`、`status`、`sourceAssetIds` | `confirm`（企业事实） |
| 质量 | `quality.*`、`issues[]` | — |
| 服务使用 | `bindings` + 关联 `snapshotId` | 跳转服务确认绑定 |
| 血缘 / 历史 | `lineage`、`history` | — |
| 修订会影响什么 | `previewImpact` → bindings、staleSnapshots、lockedSnapshots、staleRuns | 确认后 `revise`（不自动改绑） |
| 谁可访问 | `access.confidentiality` + 角色投影文案 | 无权限时不渲染敏感 payload |

### 3.3 PCF 活动数据 / 计算 / 交付

| 页面 | 必须读取 | 用户动作 | 失败／恢复 |
|---|---|---|---|
| PCF 活动数据 | 产品资产、电力/证据资产、PCF bindings、模板元数据（workflow） | 上传、确认绑定 | 模板不兼容、单位错误、重复——保留原文件并提示修订 |
| PCF 计算 | `snapshot`、`calculationRun`、`ruleVersion`、绑定锁定的 `assetVersionId` | 运行、提交复核 | STALE：提示重算；失败：保留快照可重试 |
| 交付中心 | 报告 artifact + `assetSnapshotId` / `assetRunId` | 预览、回到服务频道 | 报告未就绪、锁定冲突 |

### 3.4 CBAM 数据与交付

| 页面 | 必须读取 | 用户动作 | 失败／恢复 |
|---|---|---|---|
| 产品 / 设施 | `product` / `facility` catalog | 编辑主档（产生修订） | 锁定年度只读 |
| 季度数据 | 能源/证据资产 + CBAM bindings | 上传、确认、绑定 | 缺月、冲突、无权限 |
| 结果 / 交付 | workflow run + 资产版本引用 | 查看、更正申请 | STALE、Finding 开放 |

## 4. 修订影响预览契约

`previewImpact(assetId)` 返回：

| 字段 | 含义 | UI 表达 |
|---|---|---|
| `bindings[]` | 仍指向该版本且未拒绝/替代的绑定 | 「不会自动切换到新版本」 |
| `staleSnapshots[]` | 未锁定且将过期的输入快照 | 「将标为过期」+ 服务名 |
| `lockedSnapshots[]` | 已锁定报告输入 | 「保持可重现，仅告警」 |
| `staleRuns[]` | 依赖该版本的 CURRENT/SUCCEEDED 运行 | 「计算将过期，需新 Run」 |

恢复动作：取消；返回详情；确认创建修订版（调用 `revise`）。

## 5. 尚待数据资产 Agent 确认的接口问题

1. 运行时 Schema 校验入口与错误 JSON 格式（当前仅有 schema 文件 + 引擎 assert）。
2. 权限拒绝是否区分 tenant / object / field / service / action 的错误码。
3. PACT 映射归属：资产导出 vs PCF 服务适配层。
4. 哪些 Demo 字段仍为 Mock，禁止写入公开声明。

未确认前：公开站只声明机制（CLM-007–010），不宣称生产级权限矩阵或 PACT 导出已上线。

## 6. 本轮官网／Portal Agent 工作边界

- **可做**：CBAM/PCF/平台公开页深化；本契约文档；营销样式与审查脚本。
- **不可做**：改写 `data-asset-engine.js`、schemas、框架核心对象语义；`git reset --hard`；覆盖他人未提交改动。
- **已有 Portal 资产 UX**（详情侧栏、分面、胶囊、影响预览）视为消费层原型，后续 Phase 3 仅做适配层收敛，不平行再建一套状态。

## 7. Phase 0–1 执行记录（2026-10-27）

| 项 | 状态 |
|---|---|
| 基线与加固测试 | 49 pass |
| 前端消费契约 | 本文档 |
| `/services/cbam/` | 六步专业路径（适用判断→进口商交付） |
| `/services/pcf/` | 七步试点路径（声明→报告版本） |
| `Lumino 平台.dc.html` | 增加「资产→绑定→事实→快照／计算→交付」机制轨 |
| 公开声明 | 增补 CLM-012–014 |
| 资产内核文件 | 未修改 |
| Portal 权限加固 | 客户深链守卫、命令级职责分离、PCF 独立复核与报告锁定 |
| 专项浏览器检查 | URL 注入、越权深链、复核／快照／报告锁定均通过 |
| Phase 3 首切片 | `asset-view-model.js` 已接管资产概览、详情、胶囊和修订影响的授权投影 |

下一步：以同样方式建立 Task 与 Artifact 的只读投影，替换“我的任务”和“交付中心”的硬编码数组；仍不修改资产内核。

## 8. 分步校验

规则位于 `packages/agent/domain/stage-gates.js`。Portal 通过 `buildStageGateContext` 投影后调用 `evaluatePipeline`／`assertStageGate`；公开站仅展示 `validationSummary`。

## 9. Agent Runtime 壳（2026-10-27）

借鉴 Bravo：异步任务、幂等 serialNo、businessType、可重试失败码。  
不采用 Bravo：解析完成直接写正式业务事实。

| 组件 | 路径 |
|---|---|
| 任务引擎 | `packages/agent/runtime/agent-task-engine.js` |
| 能力目录 | `packages/agent/runtime/capability-catalog.js` |
| Proposal 桥 | `packages/agent/runtime/proposal-bridge.js` |

Portal 上传证据：`submit` → `simulateSuccess` → `applyTaskResult`；用户确认仍走 `AssetRegistry.confirm` / `confirmBinding`。
