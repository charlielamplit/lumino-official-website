# Lumino Portal（apps/portal）

企业工作门户静态原型。通过相对路径加载 `../../packages/agent` 内核。

## 本地

```bash
# 仓库根目录
node scripts/local-site-server.mjs 4174
# 打开 /portal/ 或 /apps/portal/
```

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
