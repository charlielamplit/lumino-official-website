# Advisor eval set

F08-05 regression suite for the public homepage advisor.

- `cases.json` — ≥120 cases with expected intent, allowed services, forbidden claims, source category and handoff.
- Run: `node scripts/advisor-eval.mjs`
- CI: `tests/advisor-eval.test.cjs`

The runner exercises deterministic routing plus published-knowledge grounded retrieval. Live model calls are optional and not required for the gate.
