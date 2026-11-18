# CBAM Portal v3 开通期闭环执行 Plan

> 历史方案说明（2026-11-16）：本文保留首次进入与服务授权的设计背景，但“先完成监测计划再开始收资”的线性顺序已经过期。当前规则是：系统完成年度与服务范围授权后，创建年度项目并立即启动收资；年度范围确认、监测计划和数据采集并行，正式计算与交付再执行受控门禁。当前实施以 `2026-11-16-cbam-cross-year-agent-plan.md` 和最新审计增量复核为准。

日期：2026-11-13
跟踪：GitHub Issue #70
依据：`docs/reviews/0006_portal-v3-cbam-agent-implementation-audit.md` P2-1，以及 `Lumino Portal 原型 v3.dc.html` 中的年度项目向导和监测计划工作区。

## 1. 目标与实施顺序

本轮先打通客户首次进入 CBAM 后的开通期主路径：

1. p01 作为已确认的演示适用性前置；
2. p02 完成 5 步年度项目向导；
3. p03 确认带版本的年度范围；
4. p04 经王晨制备、李娜独立复核、周岚签收监测计划；
5. p05 只生成邀请草稿与共享空间提议，不伪造外发和回执。

首个实施切片以 p02 和 p04 的页面缺口为主，但 controller 同时定义 p01–p05 的门禁和完成边界，避免再造平行状态。

## 2. 真相源与对象

扩展 `packages/agent/domain/cbam-golden-path.js`，不另建前端 `setupDone` 业务真相。新增对象：

- `SO-CBAM-2027-ONBOARDING`：开通期 service order，只表示演示范围已确认；
- `CASE-CBAM-2027`：年度 service case，承载 5 步向导草稿与创建状态；
- `SCOPE-CBAM-2027`：annual inclusion，保存产品、设施、CN Code 与排除理由；
- `MP-CBAM-2027-R1`：formal artifact，承载制备、复核、客户签收元数据；
- `MR-CBAM-2027-Q1-01`–`08`：Q1 材料请求演示对象，仅在签收后幂等生成；
- `INV-CBAM-2027-DRAFT`：p05 邀请草稿，不得进入 SENT/ACKNOWLEDGED。

开通期使用 Portal 已存在的 2027 计划年度；2026 已进入 Q3，继续保留 #69 的季度对象和验收证据，不为演示开通流程将其倒退。

如现有 WorkflowEngine 对象类型不足，优先复用 `serviceCase` / `annualInclusion` / `formalArtifact` / `workPackage` / `handoff`，不为单个页面添加临时状态类型。

## 3. 权限与门禁

- 周岚（`customer_owner`）：创建年度项目、确认年度范围、签收监测计划、确认邀请草稿；
- 王晨（`expert`）：监测计划制备确认；
- 李娜（`reviewer`）：独立复核并发布客户可审阅版；
- 显示视角、Agent 模式和页面跳转都不授权；
- p03 依赖 p02，p04 依赖 p03，p05 依赖 p04 签收，p06 只在 p04 签收后解锁；
- 所有 command 带 correlation id，重复执行不重复创建对象或事件。

## 4. 任务分解

### Task 1 — 先写 controller 契约测试

文件：

- 更新 `packages/agent/tests/cbam-golden-path.test.cjs`；
- 如需 DOM 契约，更新 `tests/portal-agent-runtime.test.cjs`。

覆盖：初始门禁、5 步草稿恢复、具名权限、制备/复核/签收顺序、Q1 请求幂等、p05 无外发事件。

Exit：新测试先失败，失败原因是契约未实现。

### Task 2 — 扩展开通期 controller

文件：

- 更新 `packages/agent/domain/cbam-golden-path.js`；
- 更新 `apps/portal/runtime/portal-config.js` seed/reset；
- 更新 `apps/portal/runtime/portal-permissions.js`。

Exit：domain 测试通过，不依赖 DOM。

### Task 3 — 落地 p02 年度项目 5 步向导

文件：

- 更新 `apps/portal/pages/customer-pages.js`；
- 更新 `apps/portal/runtime/portal-events.js`；
- 更新 `apps/portal/runtime/portal-core.js` 仅用于 UI 草稿持久化；
- 更新 `apps/portal/styles.css`。

交互：步骤导航、上一步/下一步、必填校验、保存草稿、返回继续、最后确认创建。页面不自行宣告成功，从 controller 回读年度项目。

Exit：p02 完成后 p03 解锁，刷新恢复当前步骤和已创建对象。

### Task 4 — 落地 p04 监测计划工作区

文件：

- 更新 `apps/portal/pages/customer-pages.js`；
- 更新 `apps/portal/runtime/portal-events.js`；
- 更新 Agent catalog/runtime 的页面路由与状态回读；
- 更新 `apps/portal/styles.css`。

页面覆盖：版本摘要、8 个数据项与方法、客户批注、制备/复核状态、签收确认卡。全年流程按钮直达该页，删除占位 toast。

Exit：三个具名主体按顺序完成，签收后 Q1 材料请求仅生成一次。

### Task 5 — 收口 p05 的诚实边界

文件：

- 更新 Agent catalog/runtime 和成员页展示；
- 只创建 `PROPOSED` 邀请草稿，将“已发送/已开通”改为“待发送/待人工执行”。

Exit：无 SENT、DELIVERED、ACKNOWLEDGED 事件。

### Task 6 — 响应式、键盘与浏览器验收

扩展 `scripts/check-cbam-agent-runtime.mjs` 或新建开通期浏览器脚本，覆盖 390/768/1440：

1. 重置开通期演示；
2. 完成 p02 向导并刷新；
3. 确认 p03 范围；
4. 王晨制备、李娜复核、周岚签收 p04；
5. 验证 8 个 Q1 材料请求只有一组；
6. 验证 p05 只生成草稿；
7. 验证无水平溢出、焦点顺序、状态播报和 44px 移动端主控件。

## 5. 验证命令

- `node --check` 所有变更的浏览器脚本；
- `node --test packages/agent/tests/cbam-golden-path.test.cjs tests/portal-agent-runtime.test.cjs`；
- `node --test tests/*.test.cjs tests/*.test.mjs packages/agent/tests/*.test.cjs`；
- `git diff --check`；
- 390/768/1440 实际浏览器链路与截图。

## 6. 停止条件

如下任一情况不在本票中继续扩张：

- 需要真实外发邮件、供应商账号或第三方回执；
- 需要生产身份认证、跨设备持久化或新异步服务；
- 需要把适用性演示文案当作正式法律结论；
- 影响 #69 已通过的 p06–p08 对象和浏览器链路。

## 7. Definition of Done

- Issue #70 是唯一范围来源，Plan 与 Issue 互相链接；
- p02/p04 缺失页面落地，p01–p05 使用同一可恢复 controller；
- 页面与 Agent 状态一致，权限和具名人机闸门可验证；
- 不虚构外发、开通、签收、审计或法规结论；
- 自动化、全量测试与 390/768/1440 浏览器证据通过后才切换 `status/review`。
