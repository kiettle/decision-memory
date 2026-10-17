# Execution Plan: Everyday decision convenience

Date: 2026-10-16

## Status

Completed

## Outcome

Simplify explicit library meaning search and filters, add Assigned to me and
pending Flat actions, and offer optional local related lookup in new forms.

## Context and authority

The owner's implementation request on 2026-10-16 authorizes these behaviors.
Preserve existing contracts in memory-search.md, decision-deadlines.md,
decision-understanding.md and proposal-review.md, and the existing uncommitted
scope, saved-view and draft-recovery work recorded in
../completed/library-workflow-convenience.md. No new retrieval or identity policy.

## Approach

1. Reuse local/Gemini search contracts; disclose cloud sharing inside Search options.
2. Keep scope and shortcuts visible; use the existing sheet for six detailed
   filters and derive Assigned to me directly from URL ownerId.
3. Reuse DecisionActions in pending Flat rows with independent title links.
4. Add new-form local related lookup with exact single-scope filtering, all-scope
   labeling otherwise, input/unmount invalidation, and existing draft recovery.
5. Extend native browser proof, update product/presentation docs, run required checks.

## Risks and recovery

Preserve user-owned staged changes; baseline diff saved outside the repo at
/private/tmp/decision-convenience-baseline.patch. Avoid writes to normal demo DB.
Use isolated synthetic database and blank external credentials; mock providers.
Only remove processes/fixtures/database owned by this run. Related results are
transient and never included in draft/server writes. No automatic searches.

## Progress

- [x] Read workflow, contracts, existing diff, implementation and validation owners.
- [x] Implement four changes and documentation.
- [x] Run focused browser, integration, offline search and required native checks.
- [x] Inspect desktop/mobile screenshots, review diff, record evidence and cleanup.

## Validation

Browser plugin not available; use existing Playwright/Chrome workflow.
Flow: library query -> explicit meaning search/options/filter shortcuts -> pending
Flat dialogs -> new form related lookup -> open result/restore draft -> ordinary save.
Run npm run lint, npm run typecheck, npm test, npm run build,
npm run test:integration, npm run test:local-search, npm run test:ui.
First-time human usability and live external integrations are not part of this run.

## Validation progress

Passed: lint, typecheck, 117 unit/HTTP tests, build, integration on owned database
`decision_everyday_20261016_01`, and real offline local-search proof (its own
self-cleaning database). The initial sandboxed unit run could not bind localhost;
rerunning with socket access passed. Build retains the existing >500 kB advisory.

Focused browser proof passed on final code: explicit LOCAL search, options without
requests, assignment/owner/URL/saved-view synchronization, URL Back invalidation,
Flat cancellation/failure/edit/clear/complete and deadline reorder, related lookup
in both modes with zero/one/multiple scopes, indexing/empty/error/unavailable,
three input invalidations plus newer-before-older publication, raw draft recovery,
no lookup writes/cloud requests, and ordinary save during lookup with draft cleanup.

Existing deadline, proposal, scope/filter convenience and library workflow modules
passed together. The complete `npm run test:ui` passed alone on final code using
fresh owned database `decision_everyday_20261016_02`, including all those modules
and the new everyday scenarios. Interrupted runs left synthetic fixtures in the
first owned database, so final exact count checks used a clean seeded instance.

Desktop/mobile screenshots inspected, including stable viewport captures of the
filter sheet and related results. Full-page stitching captured intermediate
animation artifacts; viewport captures with finite animations completed show
readable controls/results and a fitting sheet. Browser checks cover focus,
independent actions/links, overflow, console health and framework overlays.

The related panel stays outside the input fieldset: placing the keyed transient
component inside it caused disappearing fields during mode/scope changes in
Chrome; the final structure preserves controlled fields without remounting them.
No product contract or validation threshold was weakened. Existing staged changes
remain byte-for-byte unchanged (compared index diff with initial baseline).

Reusable friction: shadcn CLI documentation lookup failed DNS; read official
Base UI component docs through the web tool and existing component source instead.
Browser plugin absent; repository Playwright/Chrome was used. No dependencies added.

## Result

All four improvements work together on existing endpoints/components, preserving
saved views, drafts and existing convenience work. No schema, dependencies,
search/ranking/provider limits, identity mapping or lifecycle policy changed.

| Acceptance group | Observable evidence |
| --- | --- |
| S1–S12 | Native keyword/local/Gemini mocks, options disclosure/no request, errors, unavailable controls, input/filter/URL Back races, cached detail/Recent returns, renamed empty action |
| F1–F12 | Six-control sheet, exact count excluding scope, external chips, owner toggle/menu/chip/clear/view/Back synchronization, combined shortcuts/scopes/query, metadata retry and Recent newest five |
| Q1–Q13 | Flat independent link/keyboard focus and dialogs, no nested controls, cancellation/no request, failed input retention, edit/clear, duplicate submit guard, Pending/Overdue membership and deadline reorder; existing Kanban/detail proof |
| R1–R15 | Explicit LOCAL requests in both new modes, exact/zero/multiple scopes, stored current/superseded rationale and coverage, empty/error/unavailable, stale and out-of-order replies, raw comma-scope/list draft recovery, no lookup mutation/cloud, ordinary save during lookup and cleanup; no edit-form action |

Commands passed: `npm run lint`, `npm run typecheck`, `npm test` (117/117,
19 suites, no skips), `npm run build`, `npm run test:integration`,
`npm run test:local-search`, `npm run test:ui`, and `git diff --check`.
Native build still reports its existing bundle-size advisory. Required checks
have no remaining failures or blockers. Initial browser failures exposed the
fieldset rendering issue, selectors moved into More filters, ambiguous help
locators and fixture timing; these were corrected and the final full run passed.
A route teardown failure during an interrupted run required fresh owned fixtures.

Logs: `/private/tmp/decision-everyday-{lint,typecheck,unit,build,integration,local-search,ui,focused-ui,regressions}.log`.
Screenshots: `/private/tmp/decision-everyday-{library-desktop,flat-mobile,filters-desktop,filters-mobile,related-desktop,related-mobile}.png`.
Final screenshots were inspected after the successful full run.

Cleanup verified: owned API/Vite processes stopped; no listeners on
3011/3012/5173. Both `decision_everyday_20261016_01` and `_02` databases removed;
normal `decision_memory` DB/container retained. The original staged diff remains
byte-identical to the initial baseline. No commit, deployment or live external
integration was performed.

Limits: Chrome only, desktop widths 1280–1536 plus mobile 390×844. No unfamiliar
user observation or usability/time-saving claim. Existing local approximate
retrieval/indexing and browser-local storage limitations remain. No other-browser
or installed external integration rehearsal was attempted.
