# Portal Framework Alignment Plan

**Issue:** [#68](https://github.com/charlielamplit/lumino-official-website/issues/68) under Epic [#3](https://github.com/charlielamplit/lumino-official-website/issues/3)

**Goal:** Align `apps/portal` to design framework **login 1a** + **nav 1d** + **Cmd-K object jump**, without breaking existing portal features (tasks, assets, deliverables, permissions, workflows).

**Out of scope this pass:** MFA; mobile bottom tabs; real IdP (#25); agent kernel semantics.

## Decisions (2026-11-09)

- Email-first login; optional simulated SSO by domain; **no MFA**
- Cmd-K searches only: pages / tasks / assets / deliverables (workspace + role filtered)
- Mobile bottom tabs deferred (#13 later)
- Framework shell first; keep all existing page routes and gates working

## Glossary

- **SSO:** After work email, configured company domain (demo `huaxing-steel.cn`) goes to simulated company IdP instead of Lumino password.
- Flow: **email -> (SSO or password) -> workspace select -> role landing**

## Cmd-K scope

Placeholder: search objects or jump.

| Group | Match | On hit |
|---|---|---|
| Pages | Page titles | Navigate |
| Tasks | Title, service, id | Open task |
| Assets | Name, code | Open asset drawer |
| Deliverables | Name, code, recipient | Open deliverable drawer |

Do not search: marketing site, knowledge MD, other tenants, file OCR.

## Phases

### A Login 1a
Email-first UI; SSO/password branches; workspace; land on workbench/queue/shared space; preserve demo role entry as one dropdown.

### B Shell 1d + Cmd-K
Icon rail + secondary nav; account menu; Cmd-K per scope above; do not remove existing page ids.

### C Templates / system states (after A+B stable)
Done this pass:
- T4 `stepFlowFooter` / `pcfStepNav` / `cbamConfirmFooter`
- Stage-gate demoted to rail/footer (not primary focus)
- `lockedYearBanner` + `staleSnapshotPanel` on key CBAM/PCF surfaces
- T5 `reviewSuiteShell` on 待我审批 / 独立复核
- T3 `drawerShell` + asset detail reorder (类型版本 → 服务使用 → 来源)
- F2/F3 loading + error via `systemStatePanel` (PCF 校验中 / 计算失败 / 模板失败)
- `portal-design-audit.mjs` checks rail / ⌘K / email-first / T4 footer
- Cache bump `20261109-fw5`

- T6 `settingsShell`：企业信息 / 设施 / 成员 / 服务订单 / 安全登录 / 审计；侧栏分区；账户菜单入口；修正管理员设置按钮可见性
- Cache bump `20261109-fw6`

Still later: 移动端底栏（Phase D / #13）

### D Mobile (deferred)

## Constraint
Every change must keep `tests/portal-*.cjs` and existing CBAM/PCF main paths green.
