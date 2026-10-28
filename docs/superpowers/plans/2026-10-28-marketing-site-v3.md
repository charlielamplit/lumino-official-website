# Marketing Site v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public marketing site as a multi-service platform index (not a CBAM specialty site), aligned with Portal Design System tokens, bilingual zh/en, with industry/case/knowledge templates using placeholders.

**Architecture:** Keep static HTML + shared shell JS under `apps/site/`. Extract a shared design-token layer reused by Portal and marketing. Replace homepage narrative with seven-nav index sections. Add industry/case routes with one template each. Introduce `/zh/` and `/en/` URL prefixes with parallel copy (English rewritten, not machine-translated). Calculators stay under Tools + a site-wide floating launcher.

**Tech Stack:** Static HTML, CSS custom properties, existing `site-shell.js` / `service-registry.js`, optional lightweight i18n dictionary JS; self-hosted IBM Plex + Noto Sans SC (no Google Fonts runtime for CN).

**Spec:** `Demo/design_reference/UI mockups for emission factor database 2/??????.dc.html` (v3) + Portal tokens in `Demo/lumino-cbam-site/.impeccable.md` and `apps/portal/styles.css`.

## Decisions locked

1. **Hero direction A (recommended):** ???????????????????/ EN?One platform for every green requirement?
2. **Scope:** full — foundation, templates, home, platform, industries, cases, knowledge, bilingual, tools float
3. **Content:** templates + placeholders only (bracketed facts, no invented KPIs)

## Global Constraints

- Visual base shared with Portal: IBM Plex Sans + Noto Sans SC + Plex Mono; type weights 400/600; colors `#17211C` / `#0E7A52` / `#E2E7E4` / `#F5F7F6`
- Marketing type scale (7): 48/56 · 32/40 · 20/28 · 18/30 · 16/26 · 14/22 · 12/18 (min 12px)
- Section rhythm: desktop 96 / mobile 64; content max 1200; pad 32/16; section backgrounds only white ? `#F5F7F6` (+ one dark closing CTA)
- Primary CTA label: ???? / Book a consultation; Client portal fixed top-right; calculator float bottom-right
- No English eyebrows; no CBAM-as-subject narrative on home; six services equal weight with status chips
- Case/industry placeholder copy must keep `[brackets]` for unconfirmed facts
- Do not rewrite Portal asset kernel or calculator engine internals this round

## Review Focus

- Home no longer reads as CBAM specialty site
- Nav matches seven columns; CTA vocabulary unified
- zh/en switch preserves page; layout survives English length
- Fonts load without Google Fonts in CN

## File map

| Path | Role |
|---|---|
| `apps/site/site/tokens.css` | **New** shared marketing tokens (mirror Portal; later link from portal) |
| `apps/site/site/marketing.css` | Rebuild on tokens; kill Archivo / 25 sizes / multi-bg |
| `apps/site/site/site-shell.js` | Nav ? 7 items; CTA; lang switch; portal link |
| `apps/site/site/i18n.js` | **New** locale detect + dictionary helpers |
| `apps/site/site/float-tools.js` | **New** bottom-right tool launcher |
| `apps/site/site/industries.js` | **New** industry registry (placeholders) |
| `apps/site/site/cases.js` | **New** case registry (placeholders) |
| `apps/site/Lumino ??.dc.html` (+ en twin) | Home restructure |
| `apps/site/Lumino ??.dc.html` (+ en) | Platform panorama + clickable channels |
| `apps/site/services/*` | Align to unified service template |
| `apps/site/industries/` | **New** index + 3–4 industry placeholder pages |
| `apps/site/cases/` | **New** index + 3 placeholder cards/pages |
| `apps/site/knowledge/` | Re-index by industry × type |
| `apps/site/tools/` | **New** tools index (CBAM calc + planned) |
| `apps/site/Lumino ??.dc.html` / `??` | Team blurb + consult form fields |
| `Demo/lumino-cbam-site/.impeccable.md` | Add marketing token/CTA notes |
| `scripts/marketing-design-audit.mjs` | **New** optional CDP checks for home/platform |

---

## Task 1: Shared tokens + marketing CSS base

**Files:** create `apps/site/site/tokens.css`; rewrite head of `apps/site/site/marketing.css`; update `.impeccable.md`

- [ ] Add tokens: colors, 7 type sizes, space scale, radius 6/8, content-max 1200, button-h 44 (marketing)
- [ ] Self-host or system-fallback font stack: `"IBM Plex Sans","Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif` — remove Google Fonts links from marketing HTML templates
- [ ] Rebuild primitives: `.wrap`, `.section`, `.section--wash`, `.section--dark` (closing only), `.button--*`, `.status-chip`, `.ds-tabs` unused on marketing; kill `.eyebrow`
- [ ] Smoke: open home — no Google Fonts request; body uses Plex/Noto/system

## Task 2: Site shell — nav, CTA, language switch

**Files:** `apps/site/site/site-shell.js`, optional `i18n.js`

- [ ] Nav (zh): ????? · ????? · ?? · ???? · ????? · ?? · ??
- [ ] Nav (en): Services · Platform · Tools · Industries · Insights · About · Contact
- [ ] Header actions: `? / EN` · ???? / Client portal · ???? / Book a consultation
- [ ] Footer mirrors nav; remove “????” wording
- [ ] Locale: prefer `/en/...` vs `/zh/...` or `?lang=` interim; document chosen scheme in README
- [ ] Smoke: every existing page shows new nav; portal + consult links work

## Task 3: Service page template + six services equal weight

**Files:** `site/service-page.js`, `services/*/index.html`, registry status labels

- [ ] One template: audience · requirements · process · deliverables · status · CTA
- [ ] Status chips: ??? / ?? / ???? / ??? (EN: Available / Pilot / Coming soon / Planned)
- [ ] Home will link here; CBAM no longer gets a unique “hero card” skin on home
- [ ] Smoke: open CBAM + ESG pages — same chrome, different content

## Task 4: Homepage restructure (Hero A + 7-section index)

**Files:** `Lumino ??.dc.html` (+ en twin or i18n blocks)

Section order:

1. Hero A + platform panorama sketch (data base ? six channels) + ???? / ????
2. Services — six equal tiles with status chips
3. Platform — one paragraph summary + link
4. Industries — entry cards (placeholder industries)
5. Cases — 3 anonymous placeholder cards
6. Tools — list + float note
7. Insights — 3–6 placeholder articles by industry
8. About one-liner + dark closing CTA

- [ ] Remove WHY LUMINO dark advantage slab, duplicate asset continuum, control sequence as home mainline
- [ ] Copy from spec §3 (zh/en pairs)
- [ ] Smoke: no CBAM-dominant first fold; no English eyebrows; CTA vocabulary unified

## Task 5: Platform page — panorama + channel entry

**Files:** `Lumino ??.dc.html` (+ en)

- [ ] Keep mechanism deep-dive here (Agent / engine / expert / enterprise) — once only
- [ ] Six clickable channels; open ? service page; closed ? contact/survey with fields ???????????
- [ ] Smoke: each channel click lands correctly

## Task 6: Industries template + 3–4 placeholders

**Files:** `industries/index.html`, `industries/{steel,aluminium,textile,packaging}/index.html` (or similar), `industries.js`

Template blocks: ???? ? ???? ? ????? ? ??? ? ????

- [ ] Placeholder industries with `[???]` copy
- [ ] Smoke: index lists all; one detail page renders template

## Task 7: Cases template + 3 placeholders

**Files:** `cases/index.html`, `cases.js`, home cards consume registry

Card fields: services chips · title zh/en · ?? / ?? / ?? / ?? · KPI slots as `[X]`

- [ ] Use the three skeletons from the spec (steel CBAM / textile PCF / packaging GHG+ESG) with brackets intact
- [ ] Smoke: home shows 3 cards; list page shows same data

## Task 8: Knowledge re-index by industry × type

**Files:** `knowledge/index.html`, optional article stubs

- [ ] Filters: industry + type (?? / ???? / ?? / ??)
- [ ] Seed 3–6 placeholder entries; keep existing CBAM guide linked under steel/regulations
- [ ] Smoke: filter UI works with placeholders

## Task 9: Tools index + floating launcher

**Files:** `tools/index.html`, `float-tools.js`, wire into shell

- [ ] List: CBAM cost (available) · PCF estimate (planned) · GHG estimate (planned)
- [ ] Float opens type picker then routes to calculator or “coming soon”
- [ ] Smoke: float visible on home/platform; CBAM path opens existing calculator

## Task 10: About + Contact polish

**Files:** `Lumino ??.dc.html`, `Lumino ??.dc.html` (+ en)

- [ ] About: team + BW industry experience one paragraph; remove repeated mechanism essay
- [ ] Contact form fields: ?????????? (+ EN labels)
- [ ] Smoke: form still submits to existing demo handler

## Task 11: Bilingual pass + length check

**Files:** all marketing pages / dictionaries

- [ ] Every primary string has EN counterpart (native phrasing per glossary in spec §5)
- [ ] Button labels ? 3 EN words; hero ? 8 words
- [ ] Spot-check EN layout at 1280 and 390 widths
- [ ] Smoke: toggle ?/EN on home, platform, one service, contact

## Task 12: Audit script + README

**Files:** `scripts/marketing-design-audit.mjs`, `apps/site/README.md`

- [ ] Assert: no Google Fonts; body font includes IBM Plex or Noto/PingFang; no visible `SERVICES YOU CAN START`-style eyebrows; primary CTA text; home has industries + cases sections
- [ ] Document IA, locale scheme, placeholder rules
- [ ] Run audit green against 4173 + CDP

---

## Out of scope

- Real client case data / legal review of public KPIs
- Full CMS or SSG migration
- Portal product flows
- Rewriting calculator computation engine

## Suggested execution

Ship Tasks 1?4 as first vertical slice (site looks new in Chinese), then 5?9, then bilingual (11) and audit (12). Commits per task when user requests commits.
