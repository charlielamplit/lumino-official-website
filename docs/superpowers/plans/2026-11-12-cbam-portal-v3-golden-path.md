# CBAM Portal v3 Golden Path Implementation Plan

**Issue:** [#69](https://github.com/charlielamplit/lumino-official-website/issues/69) under Epic [#6](https://github.com/charlielamplit/lumino-official-website/issues/6)

**Date:** 2026-11-12
**Status:** reader-tested execution contract
**Audit:** [`docs/reviews/0006_portal-v3-cbam-agent-implementation-audit.md`](../../reviews/0006_portal-v3-cbam-agent-implementation-audit.md)

## 1. Goal

Turn the current high-fidelity CBAM Agent demo into one trustworthy, repeatable prototype path:

`p06 quarterly data → p07 deterministic calculation and approval → p08 package ready to share`

The page and Agent must read the same workflow objects. A visual timeout or `rtDone` flag must never be treated as business completion.

## 2. Delivery boundary

### In this issue

- explicit prototype mode and resettable Q3 scenario;
- one source of truth for p06–p08 business status;
- role/capability checks and named human gates;
- stage gates, idempotency, recovery and persistence;
- deterministic CBAM demo calculation run;
- package state up to `PACKAGE_READY` / “待共享”;
- controlled Agent question path and honest fallback;
- responsive, keyboard and Runtime regression tests.

### Deferred and ticketed before code

- p01–p05 onboarding and monitoring-plan workspace;
- p09–p10 annual verification and carry-over;
- real email, supplier accounts, importer sharing and receipt;
- server authentication, production database and cross-device audit (#25, #26).

## 3. Product decisions

1. **Prototype is explicit.** The shell identifies the fixed Q3 scenario. Formal verbs are used only after a real domain transition.
2. **Workflow objects are authoritative.** `PKG-2026-Q3-NORDWERK`, calculation runs and `AP-2026-014` determine progress.
3. **Agent state is UI state.** Conversation, selected playbook and current step may persist, but cannot override workflow state.
4. **No role theatre for confirmation.** The client/expert switch may remain as a read-only demo filter, but cannot grant capability. The signed-in role and task assignee decide whether a confirmation control exists.
5. **p08 stops before external delivery.** Completion means `PACKAGE_READY`; `SHARED` and `ACKNOWLEDGED` are out of scope.
6. **Deterministic calculation first.** The prototype creates a reproducible demo Run with fixed inputs and an explicit `demo_seed` marker. Agent explanation reads that Run.
7. **Question paths are honest.** Presets use 1–4 second cancellable delay. Unknown questions use a model endpoint when configured; otherwise they return an actionable fallback without fake tool logs.

## 4. State contract

| Stage | Authoritative objects | Entry gate | Completion |
|---|---|---|---|
| p06 data | `PKG-2026-Q3-NORDWERK`, confirmed Q3 facts/evidence | package is `COLLECTING` | package moves to `READY_FOR_REVIEW`; confirmation event recorded |
| p07 calculation | new Q3 `calculationRun`, `AP-2026-014` | p06 ready | Run reaches `CURRENT`; approval stays `IN_REVIEW` until internal approver acts |
| p08 package | package + current Run + approval | Run `CURRENT` and approval `APPROVED` | package reaches `PACKAGE_READY`; no external receipt is created |

The UI derives `not_started`, `blocked`, `in_progress`, `waiting_human`, `failed` and `done` from these objects plus persisted draft answers.

### 4.1 Acceptance summary

| ID | Acceptance criterion | Automated evidence |
|---|---|---|
| AC1 | Portal visibly identifies the fixed 2026 Q3 demo scenario and offers an explicit full demo reset | Runtime/static test + browser check |
| AC2 | p06–p08 pages and Agent derive status from the same workflow objects | controller contract test |
| AC3 | protected actions require the signed-in role and named assignee; the display perspective cannot grant permission | permission + controller tests |
| AC4 | p06 confirmation, deterministic p07 Run, approval wait and p08 package generation are ordered and recoverable | golden-path test |
| AC5 | repeated commands do not duplicate Runs, transitions or audit events | idempotency test |
| AC6 | preset answers wait 1–4 seconds; unknown questions are clearly labelled as model or local fallback and never mutate workflow without confirmation | Runtime/API tests |
| AC7 | completion stops at `PACKAGE_READY`; this issue never fabricates `SHARED`, `ACKNOWLEDGED`, receipt or lock events | controller regression test |
| AC8 | 390/768/1440 layouts retain playbook and panel access, keyboard focus and ARIA state | static + browser checks |

### 4.2 Fixed identifiers and deterministic calculation

| Item | Contract |
|---|---|
| Scenario | `CBAM-2026-Q3-DEMO` |
| Package | `PKG-2026-Q3-NORDWERK` |
| Run | `RUN-CBAM-2026Q3-001` |
| Approval | `AP-2026-014` |
| Rule pack | `EU-CBAM-2026.3-demo` |
| Input marker | `demo_seed`; `formalUseAllowed: false` |
| Production | 12,840 t |
| Direct emissions | 12,326.4 tCO2e |
| Indirect emissions | 4,108.8 tCO2e |
| Precursor emissions | 8,217.6 tCO2e |
| Total | 24,652.8 tCO2e |
| Embedded-emissions intensity | 1.92 tCO2e/t |

The controller computes the total and intensity from the fixed inputs; the expected values above are the test snapshot, not independently editable output fields.

### 4.3 Role and human-gate contract

| Action | Allowed role | Named actor | Notes |
|---|---|---|---|
| confirm Q3 data | `customer_owner` / `customer_admin` | 周岚 | advances package to `READY_FOR_REVIEW` |
| run deterministic calculation | `system` | CBAM Calculation Engine | tool execution after p06; never presented as human review |
| review calculation | `reviewer` | 李娜 | separate human gate; the Agent may route but not impersonate |
| approve package | `customer_approver` | 赵海峰 | uses the existing approval page and `AP-2026-014` |
| build package | `customer_owner` / `customer_admin` | 周岚 | allowed only after approval; stops at `PACKAGE_READY` |

王晨 remains the calculation owner shown in the source data, but deterministic tool execution is attributed to the system. No implementation may silently record 王晨 or 李娜 as having acted.

### 4.4 Truth table

| Stage | Workflow condition | Derived state | Allowed next action |
|---|---|---|---|
| p06 | package `COLLECTING` | `in_progress` | 周岚 confirms Q3 data |
| p06 | package `READY_FOR_REVIEW` or later | `done` | none |
| p07 | package before `READY_FOR_REVIEW` | `blocked` | return to p06 |
| p07 | package ready, fixed Run absent | `not_started` | run deterministic calculation |
| p07 | Run `QUEUED` / `RUNNING` | `in_progress` | wait or retry after typed failure |
| p07 | Run `CURRENT`, review absent | `waiting_human` | 李娜 performs independent review |
| p07 | Run `CURRENT`, review recorded, approval `IN_REVIEW` | `waiting_human` | 赵海峰 reviews existing approval |
| p07 | Run `CURRENT`, review recorded, approval `APPROVED` | `done` | enter p08 |
| p07 | approval `REJECTED` | `failed` | show rejection and recovery route |
| p08 | approval not `APPROVED` or Run not `CURRENT` | `blocked` | return to p07/approval |
| p08 | prerequisites ready, package `READY_FOR_REVIEW` | `not_started` | 周岚 builds package |
| p08 | package `APPROVED` | `in_progress` | continue package generation |
| p08 | package `PACKAGE_READY` | `done` | label “待共享” only |
| p08 | package `SHARED` or later | `done_external` | display existing external state; #69 never creates it |

### 4.5 Idempotency, persistence and reset

- Command keys are fixed: `CBAM-2026-Q3:p06:confirm`, `CBAM-2026-Q3:p07:calculate` and `CBAM-2026-Q3:p08:package`.
- If the target object/state already exists, the controller returns it without adding an audit event or incrementing its revision.
- Workflow objects remain in `lumino-multiservice-workflow-v2`; Agent drafts use their own versioned key.
- “重置 Q3 演示” is explicitly a **full local Portal demo reset**: after confirmation it clears Portal workflow, Agent task and Portal UI/demo-draft keys, then reloads seeded data. It does not call a backward workflow transition and does not claim an audit-grade reversal.
- Controller tests use injected storage, clock and RNG. Runtime delay tests inject RNG/timer behavior; production selects an inclusive 1–4 second delay.

### 4.6 Module and model boundaries

- `packages/agent/domain/cbam-golden-path.js` uses the repository's UMD/CommonJS pattern, has no DOM dependency and receives a WorkflowEngine instance.
- Browser scripts load WorkflowEngine, then the golden-path module, then `portal-config.js`.
- The model path is server-side-key only and is not a prerequisite for deterministic p06–p08 commands. If no safe existing endpoint can accept the minimum context, Task 7 remains open on #69 and the UI uses a clearly labelled local fallback.
- A model response can propose a next action but cannot call `command()` until a signed-in user confirms a permission-checked card.

## 5. Implementation sequence

### Task 0 — Protect the working baseline

Files: no implementation edits.

- Record current dirty files and preserve unrelated work.
- Run JavaScript syntax, Portal tests, Workflow tests and `git diff --check`.
- Keep the audit and this Plan in the same change set as #69.

Exit: baseline evidence is recorded; no pre-existing change is overwritten.

### Task 1 — Add failing contract tests

Files:

- create `packages/agent/tests/cbam-golden-path.test.cjs`;
- update `tests/portal-permissions.test.cjs`;
- create `tests/portal-agent-runtime.test.cjs`.

Test first:

- p07 is blocked before p06 completion;
- p08 is blocked before a current Run and named approval;
- duplicate commands are idempotent;
- customer owner cannot approve `AP-2026-014`;
- customer approver cannot perform reviewer work;
- completion stops at `PACKAGE_READY`;
- reset returns the fixed Q3 baseline;
- Runtime markup includes mobile stage/panel navigation and complete ARIA state.

Exit: new tests fail for the expected missing behavior.

### Task 2 — Create the testable golden-path controller

Files:

- create `packages/agent/domain/cbam-golden-path.js`;
- expose it from `packages/agent/package.json` if required;
- load it before `portal-config.js` in `apps/portal/index.html`.

Responsibilities:

- derive p06–p08 status from WorkflowEngine;
- expose `gate(playbookId, actor)` and `command(playbookId, action, actor, payload)`;
- create deterministic Run IDs with idempotency keys;
- transition package and approval objects only through WorkflowEngine;
- store draft answers separately from confirmed workflow state;
- return typed failure codes and recovery actions;
- reset only prototype-owned Q3 objects and UI draft storage.

Exit: domain tests pass without DOM access.

### Task 3 — Define permissions and named gates

Files:

- update `apps/portal/runtime/portal-permissions.js`;
- update `apps/portal/runtime/portal-config.js` actor helpers and seeded metadata.

Actions:

- `cbam-confirm-quarter-data`: admin/owner assigned to 周岚;
- `cbam-run-calculation`: system tool after the p06 gate, with 王晨 retained only as source-data owner;
- `cbam-review-calculation`: reviewer assigned to 李娜;
- `workflow-approval`: customer approver assigned to 赵海峰;
- `cbam-build-package`: admin/owner after approval.

The Agent’s display perspective never changes these permissions.

Exit: permission tests prove separation of duties.

### Task 4 — Rewire Agent Runtime to domain state

Files:

- update `apps/portal/runtime/agent-runtime.js`;
- update `apps/portal/runtime/agent-catalog.js` only where labels or final actions are misleading;
- update `apps/portal/runtime/portal-core.js` persistence.

Changes:

- p06–p08 status and button availability come from the controller;
- `approveStep` calls a typed command and shows denial/recovery instead of silently returning;
- `finishPlaybook` does not mark formal actions complete on its own;
- persisted UI state includes selected playbook, step, answers and messages, while workflow remains authoritative;
- unknown questions do not claim file/tool access;
- preset delay is randomized between 1 and 4 seconds and cancelled when reset or replaced;
- mode selector changes behavior: ask = answer only, run = route to playbook, draft = text proposal without workflow mutation.

Exit: Runtime tests pass and p06–p08 never report completion without domain confirmation.

### Task 5 — Synchronize CBAM pages and add reset/recovery

Files:

- update `apps/portal/pages/customer-pages.js`;
- update `apps/portal/runtime/portal-events.js`;
- update `apps/portal/runtime/portal-config.js`;
- update `apps/portal/styles.css` only for required states and controls.

Changes:

- data, results and deliverables pages derive status from the same controller;
- add a compact “Q3 演示场景” control with reset confirmation;
- show blockers and direct recovery actions;
- p07 approval routes to the existing approval page for `customer_approver`;
- p08 produces `PACKAGE_READY` and consistently labels it “待共享”; remove any implied receipt;
- no client/expert perspective switch can execute a protected action.

Exit: page and Agent status remain aligned across navigation and refresh.

### Task 6 — Restore responsive and accessible Runtime behavior

Files:

- update `apps/portal/runtime/agent-runtime.js`;
- update `apps/portal/runtime/portal-events.js`;
- update `apps/portal/styles.css`.

Changes:

- under 1200px provide a playbook selector rather than hiding navigation;
- under 1000px provide explicit conversation/artifact/change/source/log panels;
- focus enters the modal, remains trapped, and returns to the opener;
- tabs expose `aria-selected`/`aria-controls`; radios expose `aria-checked`;
- running/completion/error status uses a stable live region;
- maintain 44px touch targets where controls become mobile-primary.

Exit: 390/768/1440 static and browser assertions pass.

### Task 7 — Controlled model path

Files:

- create a Portal-specific API handler only if an existing endpoint cannot safely accept Portal context;
- update local preview routing and deployment configuration if a new handler is introduced;
- add API contract tests.

Rules:

- send only the minimum page/task context; no production files or secrets;
- use server-side API keys only;
- distinguish model response, deterministic preset and local fallback;
- no model answer performs a domain command without an explicit confirmation card.

Exit: configured and unconfigured paths both return useful, correctly labelled responses.

### Task 8 — Verification and Issue evidence

Commands:

- `node --check` for changed browser scripts;
- `node --test tests/*.test.cjs tests/*.test.mjs packages/agent/tests/*.test.cjs`;
- `git diff --check`;
- browser checks at 390, 768 and 1440 when the browser host is available.

Browser acceptance sequence:

1. reset the Portal demo and sign in as 周岚 (`customer_owner`);
2. open p07 and verify its blocker routes to p06;
3. confirm p06, refresh, and verify page/Agent both show p06 complete;
4. run the deterministic calculation once, repeat it, and verify one Run/event set only;
5. verify p07 waits for approval and p08 stays blocked;
6. switch to 赵海峰 (`customer_approver`) and approve `AP-2026-014` on the existing approval page;
7. return as 周岚, build p08 twice, and verify one `PACKAGE_READY` result labelled “待共享”;
8. verify refresh persistence, then full demo reset;
9. repeat navigation at 390/768/1440 and verify focus trap/return, playbook access, panel access, live status and ARIA tab/radio state.

Evidence:

- attach test summary and object snapshots to #69;
- map each AC to code/tests/screenshots;
- keep Issue open if browser evidence or model-path verification is missing.

## 6. Commit plan

1. `test(portal): define CBAM Agent golden-path contracts`
2. `feat(agent): add CBAM p06-p08 golden-path controller`
3. `feat(portal): bind Agent permissions and workflow gates`
4. `feat(portal): synchronize CBAM pages with Agent state`
5. `fix(portal): restore responsive and accessible Agent Runtime`
6. `feat(portal): add controlled Agent question path`
7. `docs(portal): record #69 verification evidence`

Commits may be consolidated before the requested dev handoff, but the logical boundaries and tests must remain reviewable.

## 7. Stop conditions

Stop implementation and return to the Issue if:

- a change requires production authentication, real external sharing or new persistent infrastructure;
- the current dirty worktree contains overlapping edits that cannot be preserved;
- p06–p08 cannot use the existing WorkflowEngine without changing its shared semantics;
- an unknown question path would require sending customer files or sensitive production data to a model;
- browser validation remains unavailable at release time.

## 8. Definition of done

- #69 remains the source of scope and acceptance criteria.
- This Plan and #69 link to each other.
- p06–p08 are a repeatable, resettable prototype using one workflow truth.
- formal actions respect current role and named human gates.
- no UI copy claims sharing, receipt, locking or audit events that did not occur.
- automated tests cover gates, permissions, recovery, idempotency and Runtime semantics.
- browser evidence exists before the feature is marked complete.

## 9. Execution evidence (2026-11-12)

Implemented:

- UMD/CommonJS golden-path controller with fixed Q3 inputs, named gates, typed failures and idempotent commands;
- p06–p08 Agent and Portal page status derived from WorkflowEngine;
- independent reviewer and customer approver gates, with approval blocked before review;
- `PACKAGE_READY` boundary, honest “待共享” copy and no generated share/receipt events;
- explicit full local Portal demo reset;
- persistent Agent UI drafts separated from workflow truth;
- 1–4 second cancellable preset delay, open-question `/api/advisor` path and labelled actionable fallback;
- mobile topic selector, conversation/details switch, ARIA tab/radio state and modal focus return/trap.

Verification:

- JavaScript syntax checks: pass;
- `node --test tests/*.test.cjs tests/*.test.mjs packages/agent/tests/*.test.cjs`: **158/158 pass**;
- `git diff --check`: pass;
- local Portal route: controller and Runtime assets served successfully;
- local configured Agent API: `general_model`, tier `sol`, `ui_state: ok` after routing open questions away from a truncating hidden-reasoning Luna path;
- visual browser acceptance: **pending** because the browser access host/CDP endpoint was unavailable in this environment. Issue #69 must remain open until the 390/768/1440 sequence in Task 8 is completed.
