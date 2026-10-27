# @lumino/shared

Cross-app contracts that must not live under `apps/portal` (so `apps/site` can deploy alone).

## Contents

- `service-contract.js` — public service ids, status labels, routes, primary actions

Portal and site both load this file. Do not put DOM, sessions, or Agent runtime here.
