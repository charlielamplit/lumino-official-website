# Portal Workflow Engine

The portal prototype uses `domain/workflow-engine.js` as the executable source of truth for object status, revisions, allowed transitions, dependency invalidation and audit events.

## Runtime files

- `domain/workflow-engine.js`: framework-free UMD module, usable in the browser and Node tests.
- `runtime/portal-config.js`: seeds prototype workflow objects and keeps role/year display configuration.
- `runtime/portal-core.js`: maps workflow objects to shared status cards and detail drawers.
- `runtime/portal-events.js`: translates user actions into guarded workflow transitions.
- `app.js`: bootstraps the selected demo role, year and page.
- `../tests/workflow-engine.test.cjs`: transition, guard, audit, invalidation and persistence tests.
- Browser storage key: `lumino-cbam-workflow-v1`.
- UI draft storage key: `lumino-cbam-portal-ui-v1`.

## Core interaction chain

1. Evidence upload creates `EVD-{year}-{quarter}-GAS` and moves it through upload, security scan and parsing.
2. Customer confirmation accepts the evidence and confirms `FACT-{year}-{quarter}-GAS`.
3. Confirming the fact marks dependent current calculation runs as stale.
4. A new calculation run is created and becomes current.
5. A data-path decision advances the Finding to expert validation and makes the quarterly package ready for review. It does not close the Finding.

## Invariants

- Every transition requires actor and reason.
- Optional `expectedRevision` protects against stale writes.
- `ACKNOWLEDGED` requires a receipt ID.
- `LOCKED` requires a snapshot ID.
- A verifier-originated Finding can only be closed by a verifier and requires resolution evidence.
- Annual state is derived and never writes back to child objects.

## Verification

```bash
node --check packages/agent/domain/workflow-engine.js
node --check portal/runtime/portal-config.js
node --check portal/runtime/portal-core.js
node --check portal/runtime/portal-events.js
node --check portal/pages/customer-pages.js
node --check portal/pages/role-pages.js
node --check portal/app.js
node --test tests/*.test.*
```

For a clean demo, remove the two storage keys in browser developer tools. Production must move authorization, transactions, clock, audit immutability and storage authority to the server.
