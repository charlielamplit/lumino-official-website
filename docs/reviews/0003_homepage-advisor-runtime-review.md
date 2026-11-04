# Homepage Advisor Runtime Review

- Date: 2026-11-02
- Feature: F08-02
- Branch: `feat/f08-02-advisor-widget`
- Page: `/apps/site/Lumino%20官网.dc.html`

## Result

The no-model advisor runtime is ready for code review. It reuses the Marketing v3 type, colour, border, radius and spacing tokens, and presents the advisor as a service-guidance work panel rather than a generic chatbot.

## Evidence

| Check | Evidence | Result |
| --- | --- | --- |
| 1440px desktop | Chrome rendered page; opened Tools → Ask Lumino; inspected welcome, fixed answer, follow-up choices and CN Code tool route | Pass |
| 768px tablet | Chrome responsive viewport at 768 × 844; widget remained within viewport with scrollable body and fixed composer | Pass |
| 390px mobile | Chrome responsive viewport at 390 × 844; bottom panel used full width without horizontal overflow | Pass |
| 200% zoom | Chrome page zoom at 200%; title, Start over, Close and composer remained visible and operable | Pass |
| Keyboard path | Opened from Tools, submitted through controls, closed with focus returning to the Tools trigger | Pass |
| Session recovery | Selected a topic and reply, refreshed the tab, reopened the advisor and saw the deterministic history restored | Pass |
| Privacy guard | Entered a synthetic email address; the input was neither displayed nor stored and a controlled warning was shown | Pass |
| No-model operation | Catalog, schema and router loaded from `/packages/advisor`; no model or advisor API request is present | Pass |
| Reduced motion | `prefers-reduced-motion: reduce` removes the panel entrance animation | Pass |

## Automated checks

```text
node --test packages/advisor/tests/*.test.* tests/*.test.* packages/agent/tests/*.test.*
node scripts/github-roadmap-sync.mjs --check
git diff --check
```

The browser console contained no application error from the advisor. A message emitted by an installed translation extension was unrelated to the site runtime.
