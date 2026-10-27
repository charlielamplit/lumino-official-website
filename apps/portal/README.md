# Lumino Portal（apps/portal）

企业工作门户静态原型。通过相对路径加载 `../../packages/agent` 内核。

## 本地

```bash
# 仓库根目录
npx --yes serve -l 4173 .
# 打开 /portal/ 或 /apps/portal/
```

## 脚本顺序

见 `ARCHITECTURE.md`。必须先加载 agent 的 workflow / data-asset / stage-gates，再加载服务契约、权限规则、Portal 配置、资产与共享中心 ViewModel、runtime 与 pages。

## 边界

- 页面不得复制一套正式状态机；门禁调用 `LuminoStageGates`
- 页面读取资产必须经过 `runtime/asset-view-model.js`，不得绕过目录授权直接投影全量 Registry
- “我的任务”和“交付中心”必须经过 `runtime/shared-center-view-model.js`，页面不得维护角色专属硬编码记录
- 命令级职责分离由 `runtime/portal-permissions.js` 约束，隐藏按钮不等于授权
- 不修改 `packages/agent` 核心语义（由数据资产工作流负责）
