# Execution Plan: Approved UI review improvements

Date: 2026-10-28

## Status

Completed

## Outcome

Make Library content easier to reach on phone/tablet, lead decision detail with
the choice and rationale, and pair corresponding comparison fields.

## Context

The owner approved the three findings from this chat's full-app UI review.
`docs/product/decision-deadlines.md` owns library shortcuts, filters, saved views,
five Kanban groups and draft/return behavior. `docs/product/decision-understanding.md`
owns rationale, lifecycle notices, comparison semantics and evidence. Existing
React, Tailwind v4, shadcn/Base UI components, tokens and branding remain authority.
Baseline screenshots and measurements are outside the repository in this chat's
`ui-review/` visualization artifact.

## Scope

Shared responsive shell/offsets, Library control composition, Kanban lane jumps,
detail reading order and grouped utilities, field-paired comparison, and focused
UI regression proof. No API, routing, business logic, dependencies, unrelated
page redesign, real integration writes or new product policy.

## Approach

1. Reuse the accepted baseline and existing components. Extend the existing
   navigation sheet to narrow tablets, compact utility controls, retain the
   main quick filters/Applies To, and add explicit board lane jumps.
2. Put record identity and Why before secondary detail tools; keep lifecycle
   warnings, the distinct replacement reason and all existing actions.
3. Pair stored comparison values by field, with readable mobile identity labels.
4. Run existing checks and focused interaction proof; inspect desktop/tablet/phone
   production renders and compare screenshots before completing this plan.

## Risks And Recovery

- Overlay nesting/focus and changed DOM composition can regress actions. Retain
  the underlying dialogs and validate opening, cancellation and return behavior.
- Shared sidebar breakpoint must also update fixed form-footer offsets.
- Preserve accepted filter and comparison semantics; change layout only.
- Revert only this task's diff to recover. Leave existing app services/data intact;
  use owned temporary resources and synthetic fixtures for proof.

## Progress

- [x] Read authority, review baseline, inspect affected components and native proof.
- [x] Responsive Library/shell and lane navigation.
- [x] Detail hierarchy and paired comparison.
- [x] Existing checks and production browser validation.
- [x] Final screenshot comparison and outcome.

## Decisions

- 2026-10-28: This is refinement of existing components, not a new art direction;
  keep palette, type, mark and controls. No design draw or asset generation needed.
- 2026-10-28: Browser plugin is not available. Use the existing Playwright/Chrome
  workflow plus the design skill's real-Chrome inspector.
- 2026-10-28: UI mutation proof uses an owned temporary PostgreSQL database/API.
  Browser traffic and test API calls are forwarded there by an external temporary
  Playwright adapter, preserving the native suite's URLs. Final read-only captures
  use the same existing records as the baseline with compiled production assets.

## Validation

Required: npm test, npm run lint, npm run typecheck, npm run build,
npm run test:integration, npm run test:settings, npm run test:ui, git diff --check.
Focused UI: responsive content position, lane jumps without filter writes,
secondary detail action dialogs/focus, field pairing, overflow and console health.
Inspect production at 1440, 1024, 768 and 390px; retain before/after evidence outside
the repository. Existing deliberate demo-data inspector flags are reported as such.

Passed so far: 140 server tests; lint; typecheck; build (existing >500 kB chunk
warning); database settings proof; integration proof; focused responsive checks
at 390/768/1024/1440px; and 21 production route/viewport smoke checks for Scopes,
scope overview, Settings, New/Edit, proposal entry and Recent. The latter verified
identity, meaningful content, no error overlay/console errors/overflow, loaded
Geist, and the form footer following the sidebar breakpoint.

Native UI proof was resumed after a local PostgreSQL interruption. A stale
Settings test now injects failures at the actual integrations endpoint and still
requires failed retry followed by recovery. Mobile test steps open the approved
disclosures; the saved-view helper waits for identity metadata. The temporary
isolated browser adapter preserves native request/response URLs for exact URL
assertions. The full native UI suite and final production interaction checks passed after
these test-environment and disclosure-step corrections.

## Final Validation

- `npm test`: 140 passed, none failed/skipped.
- `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`: passed.
- `npm run test:settings`, `npm run test:integration`: passed.
- `npm run test:ui`: full suite passed with owned PostgreSQL/API fixtures. All
  saved-view, draft, clipboard/manual-copy, identity, lifecycle, deadline,
  proposal, filter/cache/stale-response, navigation and responsive checks passed.
- Production build: the responsive interaction suite also passed at
  390/768/1024/1440px. The 21 additional route/viewport smoke checks passed.
- The skill inspector examined Library, detail, Compare and Kanban at all four
  widths using compiled assets and the same existing records as the baseline.
  Captured console errors are empty. No dev-server warning remains. Library,
  detail and Compare have no warnings; each still reports one FAIL for the
  existing Acme Engineering demo name. Kanban additionally reports its existing
  empty-area/unequal-lane warnings. These reflect four truly empty groups beside
  ten decided records; all five groups and their honest counts are preserved.
  No inspector rules were suppressed and no demo data was rewritten.
- All final fold and scroll screenshots, plus smoke screenshots, were visually
  inspected. Compiled assets were served through an external browser adapter
  under the app's existing origin, preserving API/CORS behavior; this is browser
  proof of the production bundle, not deployment validation.
- The build retains its non-blocking >500 kB bundle warning. External provider
  operations were mocked or not invoked. No claim of live provider readiness.
- Temporary proof APIs, databases and keys were removed; existing services and
  app data were preserved. One earlier interrupted database was explicitly
  removed after PostgreSQL was restored through the documented startup command.

## Before / After

| Observation | Before | After |
|---|---|---|
| First Library record at 390px | y=644 | y=433, 211px earlier |
| Sidebar at 768px | 228px fixed sidebar | Existing navigation sheet; sidebar folded |
| Detail title at 390px | y=296, 30px type | y=184, 24px type |
| Detail rationale at 390px | Below first viewport | Full seeded rationale and evidence link visible |
| Phone comparison | Complete first record before second | Corresponding values adjacent under each field |
| Tablet comparison | Narrow columns beside sidebar | Full canvas with aligned field pairs |
| Board discovery | Populated fifth lane off-screen | Named lane/count jumps with scrolling and keyboard focus |

Baseline evidence: this chat's `ui-review/` visualization artifact. Final evidence:
`ui-improvements/after/`, `before-after-measurements.json`, `production-smoke.json`,
`before-phones.jpg`, `after-phones.jpg` and `comparison-paired-fields.png` in the same
visualization directory. 1024px is extra validation; no before baseline exists
at that width. Logs are retained with those artifacts outside the repository.

## Critique — Round 2

Seen in one second: the same Decision Memory workspace, with records and reasons
read before its utilities on smaller screens.

Idea (one sentence): connect the team's stored choices to their reasons, scope,
evidence and replacement history with less visual searching.

Live thing: filtering/preview, explicit local retrieval, accessible board lane
jumps and paired stored-field comparison.

Layout words by section: shell=sidebar/sheet / Library=compact-toolbar+list /
board=lane-index+columns / detail=choice+Why+evidence / comparison=paired-fields.

Scores: design 7.5 · usability 8.0 · creativity 6.5 · content 8.0 → raw overall 7.5.

Caps applied: strict skill overall remains 6.0 because its existing demo-name
heuristic is a FAIL. Picture/motion/live-marketing caps do not apply to app screens.
Scores are qualitative judgment, not measured user success.

Top three problems remaining, with evidence and disposition:
1. `after/board/desktop-fold.jpg`: workload is concentrated in Decided, leaving
   truthful empty lanes. Keep all five groups; the approved lane jumps resolve
   reaching the off-screen group without changing grouping or counts.
2. `after/compare/mobile-page-01.jpg`: complete context and original questions
   still create a long comparison. Keep the requested content, now paired per
   field; do not silently hide stored evidence or change difference semantics.
3. `after/detail/tablet-1024-fold.jpg`: secondary actions can wrap at small laptop
   widths. They remain below the rationale, readable and keyboard accessible;
   phone/tablet utilities use the explicit disclosure.

## Changed Files

UI:
- `apps/web/src/index.css`
- `apps/web/src/pages/library-page.tsx`
- `apps/web/src/pages/decision-detail-page.tsx`
- `apps/web/src/pages/compare-page.tsx`
- `apps/web/src/components/decision-board.tsx`
- `apps/web/src/components/decision-comparison.tsx`
- `apps/web/src/components/compare-decisions-dialog.tsx`

Proof:
- `scripts/verify-responsive-ui.mjs` (new)
- `scripts/visual-qa.mjs`
- `scripts/verify-convenience-ui.mjs`
- `scripts/verify-library-workflow-ui.mjs`
- `scripts/verify-sharing-views-ui.mjs`

Product truth: `docs/product/decision-deadlines.md`,
`docs/product/decision-understanding.md`, and this completed plan.

## Result

Implemented all three approved UI improvements within the existing React,
Tailwind and shadcn/Base UI architecture. Palette, Geist typography, product mark,
API contracts, routes and business rules are preserved. No new dependency or
unrelated page rewrite. Source and behavior-level proof passed; final screenshots
show the intended changes. Changes are left uncommitted for review.

