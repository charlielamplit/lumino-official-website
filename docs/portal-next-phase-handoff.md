# Lumino 下一阶段 Agent Handoff

> 本文供新的执行 Agent 直接读取。开始工作前必须重新读取所列文件，因为数据资产 Agent 可能正在并行更新底层框架。

## 0. 最新检查点（2026-10-27 · 晚间）

以下工作已经完成，不要重复实现：

- CBAM、PCF 与平台公开页深化；
- Portal 数据资产前端消费契约；
- 六项服务页共享契约路径修复；
- URL 试算参数校验与输出转义；
- 客户服务深链守卫；
- PCF 独立复核员专属批准入口；
- PCF 报告 `INTERNAL_REVIEW → APPROVED → LOCKED` 与输入快照锁定；
- 资产只读 ViewModel 与跨租户／敏感资产负向过滤；
- 「我的任务／交付中心」已改为 `shared-center-view-model.js` 授权投影（非页面硬编码数组）；
- 分包：`packages/agent`（domain + runtime）、`packages/shared/service-contract.js`、`apps/portal`、`apps/site`；
- Agent Runtime 最小闭环：`capability-catalog`、`agent-task-engine`（serialNo／poll／proposal_only）、`proposal-bridge`、`prompts/` 分册；
- Portal 上传／PCF 回传可见轮询态（SUBMITTING → PROCESSING → READY）；
- 全局导航徽标改为共享中心／资产 ViewModel 实时计数；READY Agent 提议投影进「我的任务」；
- 单元测试基线为 67 项；57 个页面—视口组合、深链／注入与 PCF 复核链路浏览器检查通过。

已完成 Phase 4 主路径切片 1–7：
1. 核算声明；2. 系统边界；3. 模板校验；4. 清单投影；5. 因子适用性；
6. 计算 Run／阶段结果／热点／限制写入 `metadata.calculation`；
7. 报告锁定输入版本清单写入 `metadata.reportLock`（声明／边界／模板／因子／快照／Run／绑定）。

排放因子见 `docs/emission-factors-status.md`：Lumino 内仍为演示集；本机可参考 DatabaseofEmissionFactor（API／种子）与 `13_排放因子库`（模型／样例／天工 ILCD）。联机接入单独立项。

Phase 5.4–5.5 与术语审计 P0／P1 已收口（registry↔gates、CBAM 六步、试算本地线索、Agent 提议用语、CLM-013 全称）。Portal 因子门槛仍挂在计算页，不另开导航频道。下一步可为产品评审或全量截图复跑；正式因子接入单独立项。不要重写资产语义，不要横向扩建未开放服务频道。

## 1. 你的任务

推进 Lumino 官网与 Portal 下一阶段，但不要重复设计数据资产底层。当前优先级是：

1. 读取已经完成的 CBAM、PCF 服务页和平台介绍页，不再重复改版；
2. 以既有 Portal 数据资产消费契约为输入；
3. 扩展共享任务与交付物的授权聚合；资产只读适配层和更新影响预览已完成；
4. 保留现有 CBAM 工作流和用户未提交修改。

完整计划见 `docs/portal-next-phase-plan.md`。

## 2. 开始前必须按顺序阅读

1. `docs/portal-next-phase-plan.md`
2. `docs/enterprise-data-asset-framework.md`，尤其是服务接入、PCF 基线、门户信息架构、实施顺序和变更记录
3. `apps/portal/ARCHITECTURE.md`
4. `apps/portal/DESIGN_SYSTEM.md`
5. `apps/portal/WORKFLOW_ENGINE.md`
6. `apps/portal/runtime/service-contract.js`
7. `apps/site/site/service-registry.js`
8. `docs/public-claims-register.md`
9. `docs/site-review-checklist.md`

如果文档相互冲突，按以下顺序处理：

1. 用户最新明确要求；
2. 数据资产框架的最新版本和变更记录；
3. 可执行测试与 Schema；
4. Portal 架构和设计系统；
5. 历史审计文件。

`docs/site-audit-2026-10-27.md` 包含执行前历史判断，只能作为背景，不应覆盖更新后的页面和审查清单。

## 3. 当前产品事实

- 这是静态可验证原型，不是生产系统。
- CBAM 状态为“已开通”，PCF 为“试点”，ESG 为“即将上线”，其余三项为“规划中”。
- Portal 已有多服务壳层、CBAM 频道、PCF 最小闭环、共享中心和资产内核原型。
- 同一企业资产可跨服务引用，但每个服务必须独立确认其正式事实。
- 资产版本、服务绑定、血缘、Snapshot、Transformation、CalculationRun 和 STALE 传播已有实现与测试。
- 真实认证、数据库、文件存储、核算、报告和 CRM 后端均不存在。
- Portal 仍是静态原型：共享中心授权投影已完成，但生产认证、服务端授权、运行时 Schema 校验和完整 PCF 核算／报告管道仍待完成。

## 4. 并行工作边界

另一位 Agent 正在处理数据资产底层。未完成同步前，不要修改以下区域：

- `docs/enterprise-data-asset-framework.md` 的核心对象语义；
- `packages/agent/domain/data-asset-engine.js`；
- `packages/agent/schemas/*.schema.json`；
- `packages/agent/packages/agent/tests/data-asset-engine.test.cjs` 中的资产行为基线。

你可以立即修改：

- `apps/site/Lumino 官网.dc.html`、`apps/site/Lumino 平台.dc.html`；
- `apps/site/services/*/index.html` 及公共服务渲染；
- `apps/site/site/marketing.css`、`apps/site/site/site-shell.js`、`apps/site/site/service-page.js`；
- 与公开声明、页面审查和前端 UX 契约相关的文档；
- Portal 的纯展示方案和字段映射文档。

要修改 `apps/portal/pages/multi-service-pages.js`、`apps/portal/runtime/portal-events.js` 或 `apps/portal/styles.css` 时，先确认所需字段和动作已在资产接口中稳定，再进行小步接入。

根目录的同名页面、`portal/`、`services/`、`site/`、`calculator/` 和 `knowledge/` 只用于旧地址兼容跳转。不要在这些兼容文件中开发新功能；canonical 实现位于 `apps/` 与 `packages/`。

## 5. 第一轮执行步骤

### Step 1：保护现场

```bash
git status --short
git diff --check
node --test tests/*.test.* packages/agent/tests/*.test.*
```

工作区可能包含用户或其他 Agent 的修改。不得使用 `git reset --hard`、`git checkout --` 或批量覆盖文件。

### Step 2：建立页面—数据映射

先列出页面真正需要的数据，不先写新模型。至少覆盖：

| 页面 | 必须读取 | 用户动作 | 失败／恢复 |
|---|---|---|---|
| 资产概览 | 待确认、质量问题、服务引用、受影响结果 | 查看、筛选、进入处理 | 无资产、无权限、加载失败 |
| 资产详情 | 当前版本、来源、血缘、绑定、快照、历史 | 确认提议、创建修订、查看影响 | 冲突、撤销、版本过期 |
| PCF 活动数据 | 模板版本、导入批次、字段映射、服务绑定 | 下载、上传、映射、确认 | 模板不兼容、单位错误、重复数据 |
| PCF 计算 | 输入快照、因子集、规则版本、Run | 运行、查看差异、提交复核 | STALE、计算失败、权限不足 |
| 交付中心 | 报告版本、审批、锁定、交付回执 | 预览、审批、交付 | 报告未就绪、锁定冲突 |

字段必须映射到资产框架；无法映射的字段应登记为接口问题，不能直接在 UI 内成为新的正式状态。

### Step 3：先完成低耦合页面

执行顺序固定为：

1. `/services/cbam/`
2. `/services/pcf/`
3. `apps/site/Lumino 平台.dc.html`

保持当前首页视觉方向，不重新改成服务卡片墙。平台页不使用 Portal 截图，应以真实数据流、版本、责任和交付机制为核心。所有公开声明先检查 `public-claims-register.md`。

### Step 4：与数据资产 Agent 对齐

在写 Portal 接入代码前，需要得到以下答案：

1. 当前框架版本和兼容策略是什么？
2. 前端获取资产列表、详情、历史版本和服务绑定的公开方法是什么？
3. “修订影响预览”返回哪些对象、状态、原因和恢复动作？
4. 权限拒绝如何区分租户、对象、字段、服务和操作？
5. Schema 的运行时校验入口与错误格式是什么？
6. 服务是否允许切换到资产新版本，谁确认，是否生成新绑定？
7. PACT 映射属于资产导出还是 PCF 服务层适配？
8. 哪些字段仍是临时 Mock，不能在公开页面宣称已经实现？

把答案写入计划附录或独立接口契约，再开始 Phase 3。

## 6. 设计约束

- 公开站保持浅色、编辑式、可信和克制的视觉方向。
- Portal 是工作系统，信息密度应紧凑；不复制官网的大字号营销排版。
- 每页一个 `h1`、一个主要操作；卡片只表达真实对象边界。
- 不使用 AI 控制台、聊天机器人主页、装饰性指标、渐变文字或平均卡片墙。
- 普通用户先看到问题、影响和下一步，再逐步展开版本、血缘和技术字段。
- 桌面右侧内容不得突破容器；390px 不得产生整页横向溢出。
- 状态必须有文字、ARIA 语义和恢复动作，不能只依靠颜色。
- Agent 建议、企业确认、专家复核和确定性计算必须在界面上明确分开。

## 7. 工程约束

- 保持当前无构建静态原型架构，除非用户另行批准迁移。
- 服务状态和路由以 `packages/shared/service-contract.js` 为基线（portal 再导出／site 直接引用）；公开内容通过 `apps/site/site/service-registry.js` 扩展。
- 页面不得直接修改资产存储；只能调用资产内核公开能力或前端适配层。
- 关键状态来自 `domain/workflow-engine.js`，不要为显示另建一套状态机。
- 新资产版本不得覆盖历史；修订不得自动切换服务绑定。
- 已锁定报告必须继续解析其使用的旧资产版本和计算快照。
- 页面中的 Demo 数据必须明确标记，不得制造真实运行假象。

## 8. 验证命令

```bash
python3 -m http.server 4173 --bind 127.0.0.1
node --test tests/*.test.* packages/agent/tests/*.test.*
node --check apps/site/site/site-shell.js
node --check apps/portal/pages/multi-service-pages.js
node --check apps/portal/runtime/portal-events.js
node scripts/check-routes.mjs http://127.0.0.1:4173
node scripts/check-responsive.mjs
node scripts/check-portal-guards.mjs 9223 http://127.0.0.1:4173
node scripts/check-pcf-review-flow.mjs 9223 http://127.0.0.1:4173
git diff --check
```

浏览器审查至少覆盖 390、768、1440px，并检查：

- 唯一 `h1` 和主操作；
- 当前导航与键盘焦点；
- Drawer 打开、关闭和焦点返回；
- 长文件名、长版本号、表格和状态不撑开页面；
- 无控制台错误、失效链接和破损资源；
- 空数据、离线、失败、无权限、STALE 和报告未就绪的恢复动作。

## 9. 本轮交付格式

交付时必须说明：

1. 修改了哪些页面和文件；
2. 哪些内容只完成了 UX／Mock，哪些接入了资产内核；
3. 是否修改了数据契约；如有，给出版本与兼容说明；
4. 测试和浏览器审查结果；
5. 尚未解决的 P2／P3 问题；
6. 本地审查地址和截图位置；
7. 下一位 Agent 不应重复执行的工作。

## 10. 完成定义

只有同时满足以下条件，才能说本阶段完成：

- CBAM、PCF 和平台页表达真实、专业且视觉统一；
- 数据资产概览和详情使用统一资产来源，不存在第二套正式状态；
- 更新影响与负向权限有可执行测试；
- PCF 模板、清单、计算和报告锁定形成连续路径；
- 跨服务复用不会共享确认状态或泄露对象；
- 所有审查门禁通过，P0／P1 为零；
- 本地服务保持运行，用户可以直接总审。
