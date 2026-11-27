# Lumino Portal（apps/portal）

Portal 只有一套顶部栏、全局导航轨、CBAM 二级导航和主内容区。演示身份读取固定样例状态；普通客户身份通过服务端会话读取当前租户的 PostgreSQL 数据，首次登录先到工作台，首次进入 CBAM 且没有年度项目时才显示项目引导。

## 演示与客户入口

- 登录页恢复上一版的 11 个演示角色入口（客户 4、Lumino 团队 4、外部协作 3），`?demoRole=` 测试链接也继续可用；顶部持续标记“演示工作区 · 样例数据”。进入后仍可通过角色菜单切换视角，包括平台支持与平台管理员。可单独配发 `is_demo` 租户的演示账号；样例业务数据仍是浏览器原型数据。
- 普通客户邮箱使用管理员发放的账号密码，服务端会话确认租户后进入同一个 Portal 的工作台。全局导航轨可进入服务目录、任务、数据资产与交付中心；年度项目一经建立，CBAM 服务便显示同一配置中的五项二级目录：当前工作、年度项目、产品与设施、数据与核算、报告与交付。未保存的范围在相应页面提示补充。首次进入 CBAM 服务且没有年度项目时，才打开企业与年度、产品与 CN 码、生产设施、核对范围的分步引导；引导只有在至少保存一个产品和一座设施后才能标为完成。已有项目时直接进入 CBAM 项目页，并可继续建立产品与实际生产设施的关系、补充工艺或前体说明。产品范围可搜索与本站计算器共用的 CN 目录，多选或批量粘贴后一次保存；行业由 CN 目录反显，不要求用户选择。目录支持现有 8 位与 10 位编码，服务端会校验编码确实存在。记录写入 PostgreSQL，刷新后按租户和项目恢复，不读取演示工作流、样例资产或浏览器演示缓存。
- 客户账号需要 PostgreSQL 与 `PORTAL_AUTH_ENABLED=1`。管理员通过 `npm run db:provision-portal-account` 创建租户和首位企业管理员；登录接口默认关闭，且不会由公开请求自动创建账号。演示租户可用 `PORTAL_DEMO_ACCOUNT=1` 单独配置，其账号登录后进入固定样例工作区；本机仍保留无需账号的演示入口供验收。部署环境不显示公开演示按钮，`?demoRole=` 仅本机有效。
- 客户项目目前仍为 `SETUP_DRAFT`；引导只保存企业、年度、产品和设施，不要求用户猜测材料名称或只填写责任邮箱。项目页保存生产关系，服务端核验关联的产品与设施都属于同一租户的同一项目。企业可为已关联产品的设施与具体季度建立天然气用量资料草稿；服务端生成标题与期间、拒绝跨租户或未关联设施，并对重复提交返回同一草稿。草稿会在任务页标为未发送。当前不会自动发送通知、创建上传任务、提取客户账单、计算排放或生成申报文件；后续收资和计算工作流仍待接入客户租户的服务端数据。
- 主界面框架、导航配置和页面组件共用。工作台、服务目录与 CBAM 当前工作使用同一模板；年度、产品、数据、交付以及跨服务列表使用现有页头、标签、卡片、表格和空态组件。演示身份的数据来源仍是浏览器样例工作流与资产模型，普通客户身份从服务端会话读取当前租户记录；没有数据或尚未接通的能力显示明确空态，不把演示结果投影到客户账号。项目引导和生产关系编辑是普通客户当前可写的真实流程。
- 员工邮箱继续使用 `/api/staff-login`；员工会话与客户会话分表保存。客户初始化端点按服务端会话确定租户。演示页面的角色切换仍只是原型视角，不赋予正式客户权限。

## 本地

```bash
# 仓库根目录
node scripts/local-site-server.mjs 4174
# 打开 /portal/ 或 /apps/portal/
```

客户身份本地联调需要先设置 `DATABASE_URL`、运行 `npm run db:migrate`，再由管理员设置 `PORTAL_CUSTOMER_EMAIL`、`PORTAL_CUSTOMER_PASSWORD`（至少 12 位）、`PORTAL_CUSTOMER_NAME`、`PORTAL_TENANT_SLUG`、`PORTAL_TENANT_NAME` 并运行 `npm run db:provision-portal-account`。启动预览时设置 `PORTAL_AUTH_ENABLED=1`；演示账号另设 `PORTAL_DEMO_ACCOUNT=1` 并使用独立租户标识。命令不会输出密码。

本地浏览器验收可用 `node qa/portal-customer-keyboard-check.cjs`。先启动 PostgreSQL、Portal 预览服务和带 `--remote-debugging-port=9229` 的 Chrome；脚本从 `DATABASE_URL` 连接测试库，默认检查 `http://127.0.0.1:4196/portal/`，可通过 `PORTAL_URL`、`CHROME_CDP_URL` 覆盖。脚本会在测试库创建两个随机企业账号，验证键盘引导、失败重试、跨租户页面隔离、演示角色切换和四种屏宽；仅在隔离测试库运行。

### E-02 天然气账单模型提取

本地预览服务的 `/api/portal-intake-extract` 会从 TXT、CSV 或可复制文字的 PDF 读取文字，并调用已配置的 aiberm.com Chat Completions 网关。启动时需在服务端环境提供 `ADVISOR_OPENAI_API_KEY`、`ADVISOR_OPENAI_BASE_URL` 和 `ADVISOR_MODEL_SOL`；密钥不会传给浏览器。上传弹层默认选择“模型提取”，也可显式选择原有的“本地规则演示”。

模型结果必须给出天然气用量、`Nm³` 单位、设施、覆盖完整季度的账期及对应原文片段。服务端校验失败时不生成待确认候选。当前只处理单份季度汇总账单；月度账单、扫描件、图片、XLSX 和其他体积单位不会写成季度事实。可用 `qa/fixtures/cbam-gas-realistic.txt` 或同目录 PDF 测试。

此接口只注册在 `scripts/local-site-server.mjs` 的本机预览路由中。Portal 的浏览器演示身份、任务状态与事实仍是本地原型；生产接入需要服务端认证、持久化文件/候选、异步任务和审计边界。

本机预览另有 `/api/portal-intake-record`，将 E-02 原始文件、待确认候选和确认摘要写入 `.local-data/portal-intake/`（Git 忽略；只绑定 `127.0.0.1`）；重新上传时保留旧文件版本。刷新页面后，Portal 会按当前材料请求恢复文件和候选；已确认的业务事实仍由浏览器 `localStorage` 保存。本机磁盘记录没有生产身份或租户授权，不能部署为正式客户文件库。正式环境需要服务端身份校验、数据库事务、私有对象存储及审计。

正式收资的下一段实施基线见 `docs/architecture/2026-11-26-cbam-production-intake-next-slice.md`。

## 脚本顺序

见 `ARCHITECTURE.md`。必须先加载 agent 的 workflow / data-asset / stage-gates、年度项目 ViewModel、Agent Context 与 CBAM golden path，再加载服务契约、权限规则、Portal 配置、资产与共享中心 ViewModel、runtime、pages 和 Agent Runtime。

## 边界

- 页面不得复制一套正式状态机；门禁调用 `LuminoStageGates`
- 页面读取资产必须经过 `runtime/asset-view-model.js`，不得绕过目录授权直接投影全量 Registry
- “我的任务”和“交付中心”必须经过 `runtime/shared-center-view-model.js`，页面不得维护角色专属硬编码记录
- 命令级职责分离由 `runtime/portal-permissions.js` 约束，隐藏按钮不等于授权
- 不修改 `packages/agent` 核心语义（由数据资产工作流负责）
- 年度项目页的动态文案由 `packages/agent/domain/annual-project-view-model.js` 生成；页面模板不得把企业、年度、范围数量、版本和责任人写成固定事实
- Agent 不参与服务启动授权；仅在年度项目创建并启动收资后出现，并以年度项目和业务对象作为上下文
- Agent Context 通过 `packages/agent/domain/agent-context.js` 派生；`pageId` 只用于路由，不能代替 `annualProjectId + serviceYear + workstream + objectRef`
