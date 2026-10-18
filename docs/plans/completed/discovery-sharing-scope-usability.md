# Execution Plan: Discovery, sharing and scope usability

Date: 2026-10-17

## Status

Completed

## Outcome and authority

The user's current implementation request authorizes preserving a valid related
lookup scope, compact expandable matches, real application links in sharing, and
pending-question counts/links in scope discovery. Existing automatic LOCAL lookup,
manual retry, provider exclusions and narrow saves remain. Read AGENTS.md,
WORKFLOW.md, memory-search.md and decision-understanding.md before editing.

## Context and scope

Existing uncommitted work already adds automatic lookup, pending scope records,
scope normalization and replacement suggestions. Preserve those changes except
the requested replacement of the pending scope list with the library count/link.
Baseline diff/index captured in /private/tmp/decision-discovery-*.patch.
No schema/dependency/provider changes, automatic cloud requests or saves.

## Approach

- Keep lookup selection and expansion alive for a form visit; key only transient
  retrieval by current text/scopes/selection for immediate stale invalidation.
- Keep two matches initially, toggle the existing five without another request.
- Build decision HashRouter URLs from current document location; reuse clipboard
  success/manual fallback for summary and link in detail and both previews.
- Reuse existing pending-aware directory query; add overview count while retaining
  existing response fields, and link to exact scope/PENDING in the library.
- Extend native integration/browser owners, update contracts/guide and run checks.

## Risks and recovery

Preserve all baseline work; no reset or commit. Verify privileged listener and
API/database identity before fixtures; use an owned API/database and only clean
those resources. Browser plugin is unavailable: use repository Playwright/Chrome.
Do not weaken old assertions; update changed product expectations precisely.

## Progress

- [x] Inspect workflow, baseline, product authority and implementation.
- [x] Implement four focused changes and behavior proof.
- [x] Update relevant product/design documentation.
- [x] Run lint/typecheck/build/unit/integration/local-search/full UI checks.
- [x] Inspect desktop/mobile evidence and clean owned resources.

## Validation

Flow: new multi-scope draft -> choose lookup scope -> type/expand/preview -> share
full decision -> scope directory/overview -> Pending library -> complete/refresh.
Cover debounce/dedup/stale replies, fresh collapsed preference and save independence;
base-path URLs/current successor distinction/clipboard fallback; pending-only,
mixed, duplicate scopes and workspace isolation. Run repository native commands,
mock cloud calls and use real offline search verification. Record results below.

## Result

Completed all four improvements together:

1. A valid exact/all related lookup selection survives typing and scope additions;
   removal/mode changes use existing defaults. Immediate transient invalidation,
   700 ms local debounce, manual dedup, preview and save independence are intact.
2. Two compact matches expand to the existing maximum five in retrieval order.
   Expansion remains for this form visit, including failed saves; fresh visits
   start collapsed. Full rationale/evidence stay in lazy previews.
3. Summaries include direct decision/current-successor URLs; detail and both
   shared preview contexts offer Copy link with real success/manual fallback.
   Actual origin/document path and HashRouter are preserved without transient
   query state or new access/sharing mechanisms.
4. Pending-only scopes appear, with separate pending counts and exact-scope
   Pending library links. Current/superseded counts/history/dates retain decided
   meaning; zero pending links are omitted and pending-only empty copy is clear.

All required checks passed on final integrated code. No dependency, database
schema, provider, automatic cloud request or automatic team-record save was added.
No commit was made. Existing index is unchanged; six unrelated pre-existing file
patches were also compared byte-for-byte to the baseline and remain unchanged.

## Validation progress

Passed lint/typecheck/build, 118/118 unit/HTTP tests, isolated integration (including
pending-only/mixed/duplicate/workspace and HTTP count proof), real offline local
search, focused refined discovery and sharing UI. Full UI reached the existing
new-form save/retry scenario and timed out waiting for its retry response. This
is under investigation without removing its assertion. Its unhandled wait promise
left four owned fixtures; identified and removed those exact IDs before replay.
A replay first exposed duplicate-title selectors from those leftovers, not a
product defect. Save-time rendering now pauses only transient lookup and retains
selection/expansion for failed-save recovery within the same form visit.

The isolated existing discovery replay passed with identical 503 then 201 request
payloads, preserving all raw form assertions. The wait is now registered with
the click in Promise.all, retaining the exact response condition while ensuring
rejections reach existing failure evidence/fixture cleanup. A final full run is
still required after save-time preference recovery and screenshot refinements.

The next full run correctly failed the seeded keyword count (5 versus 3): two
understanding fixtures plus an earlier-review fixture survived the interrupted
run's unhandled wait. No assertion was changed. A fresh owned database
`decision_discovery_20261017_02` was created/seeded, the owned API moved to it,
and guarded API/database identity plus fixture/browser/mock-fetch transport were
reverified before fixtures. Native integration/HTTP checks passed again there;
the final full UI run is using that fresh database. Normal data was never used.
The expanded-state fresh-visit test now actually leaves and reopens the form;
same-hash navigation had correctly retained current-visit state. Final focused
proof including failed-save preference retention and direct-link navigation passed.

## Final validation checks

- `npm run lint`, `npm run typecheck`, `npm run build`: passed on final application
  code; existing >500 kB bundle advisory remains.
- `npm test`: 118/118 tests, 19 suites, zero skips.
- `npm run test:integration`: passed, including duplicate stored scope values,
  pending-only/mixed/completed counts/dates, workspace isolation and additive
  overview HTTP fields. Final run used owned `_02`.
- `npm run test:local-search`: passed with real cached offline multilingual
  inference, indexing/concurrency and existing pending/lifecycle exclusions.
- Focused discovery/sharing UI: passed; complete `npm run test:ui` passed on final
  code against fresh owned `_02`, after integration, with all old/new assertions.
- Node syntax checks for all changed browser/integration scripts passed.
- `git diff --check` and index baseline comparison passed.

Temporary logs: `/private/tmp/decision-discovery-{lint,typecheck,build,unit,integration,local-search,focused,sharing,ui}.log`.
Temporary screenshots: `/private/tmp/decision-refined-{related-desktop,related-mobile,scope-mobile,copy-link-mobile}.png`.

## Final runtime and proof scope

Normal services were detected before fixture creation: API PID 58051 on
127.0.0.1:3011/3012 and Vite PID 43825 on ::1:5173. The owned frontend is IPv4
127.0.0.1:5173 (PID 59533); API uses 127.0.0.1:3013. Task-local
`/private/tmp/decision-discovery-api.mjs` guards its database name, reuses existing
createApp/services/indexer and opens no Slack listener. The task-only Node preload
`/private/tmp/decision-discovery-route.mjs` verifies a unique owned-database marker
through that API, then redirects fixture API requests, browser requests and test
route.fetch/continue to 3013. A read-only probe verified all three transports
before fixtures in both owned databases. It also directs Chrome localhost to the
owned IPv4 Vite. No production config, dependency or harness guidance changed.

Final UI command:

```bash
DATABASE_URL=postgresql://decision_memory:decision_memory@localhost:5434/decision_discovery_20261017_02 GEMINI_API_KEY= SLACK_BOT_TOKEN= SLACK_SIGNING_SECRET= JIRA_BASE_URL= JIRA_EMAIL= JIRA_API_TOKEN= NODE_OPTIONS=--import=/private/tmp/decision-discovery-route.mjs npm run test:ui
```

Integration used the same DATABASE_URL/blank credentials without the preload.
Local-search owns/removes its own temporary database and blocks outbound inference.
No live Gemini/Slack/Jira requests were exercised. Browser plugin unavailable;
repository Playwright/Chrome headless with desktop 1440x1000 and mobile 390x844,
plus the existing laptop/mobile suite. No human first-time usability observation
or other browser coverage is claimed. Existing bundle warning remains.

## Acceptance evidence and final cleanup

Native owners: `scripts/verify-discovery-ui.mjs` (`verifyRefinedDiscoveryUi`),
`verify-sharing-views-ui.mjs`, `verify-convenience-ui.mjs`, `visual-qa.mjs`,
`verify-library-discovery.mjs` and `verify-decision-deadlines.mjs`.

- Scope B survives question edits/additions and is sent exactly; explicit All
  survives edits. Removing selected scopes resets zero/one/multiple defaults;
  mode reset remains. Newer text/scope responses win, typing debounces once,
  manual invocation consumes the timer, preview preserves scope and ordinary
  saves never wait. Failed saves keep raw input, scope and expansion.
- Zero/one/two/five result sets have correct controls/count/order; keyboard
  expansion exposes aria-expanded and makes no requests/writes. Preference
  survives refresh/scope/text changes, while a genuinely new form is collapsed.
  Old results clear immediately; empty, error/retry, partial-index coverage,
  unavailable and save-during-search regressions passed in the complete suite.
- Real clipboard success and denied/missing API fallback use exact stored facts.
  Decision and multiple current replacement links, historical-only and absent
  lifecycle data, current origin/base document paths and omitted filter/draft
  query state are covered. Both preview contexts use loaded detail; a copied
  real decision URL was opened successfully. Copying triggers no navigation,
  record writes or provider calls.
- Real PostgreSQL and HTTP prove pending-only/mixed/completed scope counts,
  decided-only recorded dates/history, legacy duplicate values, alphabetical
  ordering and shared-name workspace isolation. Browser proves pending-only
  directory/empty copy, exact scope/PENDING keyboard link and completion refresh;
  existing superseded-only and loading/error/retry coverage also passed.

Full UI final output ended with Refined discovery passed and UI QA passed; exit 0.
Desktop/mobile page identity, meaningful content, no framework overlay, keyboard
focus, interaction assertions, horizontal containment and unexpected console/page
error checks passed. Inspecting resize screenshots exposed a transient compositor
artifact; a fresh mobile context was then loaded and settled at 390x844, confirming
one header, no overflow/errors, and readable suggestions/pending link. That extra
read-only mocked-lookup proof is `/private/tmp/decision-discovery-settled.log`;
its screenshots are `decision-refined-related-mobile.png` and
`decision-refined-pending-mobile.png`. Manual copy fallback also fits/selects the
URL at mobile width. Desktop compact cards were visually inspected.

Stopped only owned Vite PID 59533 and API PID 61181 (prior owned API PID 59508 was
stopped for the fresh database switch). Dropped only owned databases
`decision_discovery_20261017_01` and `_02`. Verified normal API PID 58051 on
3011/3012, normal Vite PID 43825 on ::1:5173 and database `decision_memory` remain.
No normal database writes/reset or normal process restart occurred. Temporary
logs/screenshots and task-only launch/routing scripts remain outside the repo.

No required check remains blocked, failed or unattempted. Earlier fixture/helper,
fresh-visit test setup, diagnostic syntax and interrupted-run failures were
resolved without relaxing assertions; final native script syntax checks passed.
The initial save/retry timeout was not reproduced in focused replay or the final
full run; its failure/cleanup path now handles both awaited operations together.
Other browsers, live integrations and first-time human observation remain
unattempted. Automated proof establishes behavior, not measured usability gains.
