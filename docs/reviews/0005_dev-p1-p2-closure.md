# Dev P1 / P2 Closure Review

- Date: 2026-11-09
- Base revision: `49c8eec`
- Target branch: `dev`
- Visual review: skipped at the user's request

## Closed items

| Priority | Finding | Closure evidence |
| --- | --- | --- |
| P1 | Bright industry images could leave white headings below WCAG AA contrast | The top forest overlay increased from `0.48` to `0.62`; its white-background worst-case calculation rises from about `3.17:1` to `4.91:1`. The middle and lower stops are darker. |
| P2 | The local homepage alias `/site` did not auto-open the advisor | `/site` is now part of the explicit homepage allowlist; other public routes remain closed by default. |
| P2 | CI used deprecated Node 20 action runtimes and the moving `ubuntu-latest` label | Both workflows use `ubuntu-24.04`, `actions/checkout@v7`, `actions/setup-node@v7`, and Node 24. A regression test covers both workflow files. |
| P2 | The local `origin` remote still used the repository's former URL | The local Git remote now points to `https://github.com/charlielamplit/lumino-official-website.git`. This setting is local Git metadata and is not part of the commit. |
| P2 | The live model path lacked current runtime evidence | A production canary returned `answer_mode=retrieval_model`, `runtime.source=retrieval_model`, `model_configured=true`, model tier `luna`, one published source, and no degradation. |

## Verification

```text
node --test tests/*.test.* packages/advisor/tests/*.test.*
node scripts/github-roadmap-sync.mjs --check
node scripts/generate-advisor-preset-audit.cjs --check
node --check (all JavaScript under api, apps, packages, scripts and tests)
git diff --check
```

The deterministic suite reports 90 passing tests and one skipped direct-provider canary because the repository intentionally contains no model API secret. The deployed-endpoint canary above verifies the configured provider path without placing a secret in source control.

