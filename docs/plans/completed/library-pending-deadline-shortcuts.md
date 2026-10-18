# Execution Plan: Library, pending-work and deadline shortcuts

Date: 2026-10-18

## Status

Completed

## Outcome and authority

The user's current request authorizes Reset to saved view, pending-only scope
filtering/direct links, identifier-only automatic fallback suppression and local
calendar deadline shortcuts. Read AGENTS.md, WORKFLOW.md, decision-deadlines.md,
memory-search.md and decision-understanding.md. Preserve existing uncommitted
features and unrelated work; baseline diff/index are in
/private/tmp/decision-shortcuts-{baseline,index}.patch. No commit.

## Approach

Reuse saved-view onApply and filter-reset paths; keep semantic/manual contracts.
Filter the already-loaded scope directory without new API/query work, with
independent links and recoveries. Recognize only trimmed /^DM-\d+$/i in frontend
automatic eligibility. Share a small date-shortcut component and shared calendar
utility, computing the viewer's date on each click, never persisting implicitly.

## Risks and recovery

Preserve staged/unstaged changes, exact scopes and normal dev data/processes.
Verify owned app/database routing before fixtures. Use one owned repository plan,
existing unit/browser owners and isolated API/database. Browser plugin unavailable;
reuse Playwright/Chrome and existing frontend/React component conventions.

## Progress

- [x] Inspect workflow, baseline, affected contracts/code/proof.
- [x] Implement four changes with focused unit/browser evidence.
- [x] Update relevant product/design/guide documentation.
- [x] Run required checks and full UI after integration.
- [x] Inspect desktop/mobile and clean only owned resources.

## Validation

Native lint, typecheck, production build, unit/HTTP tests, integration, offline
search and full UI. Extend existing owners for saved reset/storage failure/cache
invalidation; pending scope toggle/name search/links/empty recovery; key/natural/
mixed/manual searches and stale replies; input-only shortcuts, timezone/calendar
boundaries, midnight, disabled/cancel/failure/save behavior and mobile keyboard.
No live integrations or human usability claim.

## Result

Completed all four improvements. Reset reuses onApply and restores all saved
inputs without writes; scope pending/name controls and independent links reuse
loaded counts; identifier-only queries skip only automatic meaning search; shared
pending date shortcuts fill only the date using click-time local calendar days.
Existing APIs, search/provider contracts, save behavior and unrelated features
remain. No dependency, schema, backend query, provider, background job or automatic
save was added. No commit was made. The index and eight unrelated pre-existing
backend/retrieval/sharing/type file patches were compared against baseline and
remain unchanged.

## Validation progress

Final application code passed lint/typecheck/build, 119/119 unit/HTTP tests across
19 suites with zero skips, isolated integration and real cached offline local
search. The existing bundle >500 kB advisory remains. Shared calendar tests cover
leap/month/year boundaries, spring/fall DST and differing viewer-local dates.
Focused `verifyShortcutUi` passed all four behaviors, including blocked storage,
complete URL configuration reset, cached/pending semantic invalidation, exact-key
variants/mixed/natural/manual local/Gemini requests, independent scope controls,
no new scope requests, empty/failure/retry, midnight, raw fields, cancel/clear,
failed/disabled/successful narrow saves and historical-edit shortcut exclusion.

Initial focused attempts exposed test setup issues: URL observation preceded
React's rendered reset, a semantic response fixture omitted required
matchedConcepts, and Search options was addressed as a button instead of its
existing native summary disclosure. Tests now wait for actual rendered state and
use the existing response/locator contracts; no assertion was removed or relaxed.

Owned runtime: database `decision_shortcuts_20261018_01`, API 127.0.0.1:3013 and
IPv4 Vite 127.0.0.1:5173. Normal API 3011/3012 and IPv6 Vite ::1:5173 were detected
before startup and left running. Task-local guarded API/preload scripts reuse
existing services and redirect fixed-port fixture/browser/mock-fetch operations
to 3013. An owned-database marker and read-only probe verified all three paths
before fixtures. Providers are mocked; live credentials blank. No repository
harness guidance, product configuration or dependency change was made.

Logs: `/private/tmp/decision-shortcuts-{lint,typecheck,build,unit,integration,search,focused,ui}.log`.
Screenshots: `/private/tmp/decision-shortcuts-{reset-mobile,scopes-desktop,scopes-mobile,capture-mobile,deadline-mobile}.png`.
The complete UI regression suite passed after integration on final code, exit 0,
including all earlier convenience workflows and all three Shortcut ... passed
messages. Final resource cleanup is recorded below.

## Final commands and observable evidence

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, web/server |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; existing >500 kB chunk advisory |
| `npm test` | Passed, 119 tests / 19 suites / zero skips |
| `npm run test:integration` | Passed, real PostgreSQL in owned test DB/workspaces |
| `npm run test:local-search` | Passed, real cached offline multilingual inference/indexing and own temporary DB |
| Focused `verifyShortcutUi` | Passed on final code |
| `npm run test:ui` | Entire suite passed after integration, including new shortcut proof |
| Changed native script syntax, `git diff --check`, baseline index comparison | Passed |

Integration used the owned DATABASE_URL and blank credentials. Full UI command:

```bash
DATABASE_URL=postgresql://decision_memory:decision_memory@localhost:5434/decision_shortcuts_20261018_01 GEMINI_API_KEY= SLACK_BOT_TOKEN= SLACK_SIGNING_SECRET= JIRA_BASE_URL= JIRA_EMAIL= JIRA_API_TOKEN= NODE_OPTIONS=--import=/private/tmp/decision-shortcuts-route.mjs npm run test:ui
```

The temporary preload/API scripts are outside the repo and not product or harness
dependencies. They verify the owned API/database marker and route existing
fixed-port test/browser/mock-fetch traffic to the owned API. Existing app
services/indexer and Vite were used. No normal DB fixture writes occurred.

Behavior evidence extends `scripts/verify-convenience-ui.mjs` in the native
`visual-qa.mjs` owner and `apps/server/test/deadlines.test.js`:

- Reset restores every supported saved input, clears Unsaved changes, keeps the
  selected identity and both saved records byte-for-byte, attempts no storage
  write when writes are denied, and rejects held/stale or cached meaning results.
  Ordinary selection/update/rename/save-new/delete regressions also passed.
- Key variants and whitespace wait beyond automatic debounce without a request;
  matching and filtered-out keys retain keyword/filter meaning. Clear recovery
  keeps query/layout/sort. Mixed/natural queries still auto-search locally; manual
  local/Gemini remains explicit, and old natural responses cannot replace keys.
- Pending scope filtering and case-insensitive names combine without additional
  API requests; pending-only scopes remain, separate exact links are keyboard
  operable, no nested interactive markup, three empty-state categories and each
  independent recovery work, and failure/retry is preserved. Existing server
  isolation/count/ordering integration proof passed unchanged.
- Shortcuts change ISO input values only, preserving question, raw tags and
  context. Cancel/clear write nothing; failure retains date; saving disables
  all shortcuts; explicit retry uses the existing narrow API. Historical decided
  editing has no shortcuts. Click-time rollover is proved across midnight in a
  New York browser; unit tests cover leap dates/year boundaries, both DST changes
  and Los Angeles versus Ho Chi Minh local dates.

Playwright/Chrome at desktop 1440x1000 and mobile 390x844, plus existing suite
laptop widths, passed page identity/content, overlay/console health, keyboard/
focus, viewport and interaction assertions. Visually inspected mobile saved-view
wrapping, separate scope links/counts and capture/dialog date choices. No horizontal
overflow; dialogs fit. Provider calls were mocked and no live integrations used.

## Cleanup and limitations

Stopped only owned API PID 62835 (3013) and IPv4 Vite PID 62857 (5173). Dropped only
`decision_shortcuts_20261018_01`. Verified normal API PID 58051 on 3011/3012,
normal IPv6 Vite PID 43825 and database `decision_memory` remain. No reset or
restart of normal resources. Evidence remains in /private/tmp outside the repo.

No required check remains failed, blocked or unattempted. Browser plugin was
unavailable, so repository Playwright/Chrome was used. Other browsers, live
external integrations and first-time human usability observation were not run.
Automated behavior checks do not establish improved usability. Existing build
size advisory remains outside this focused scope.
