# Execution Plan: Library discovery and draft review

Date: 2026-10-17

## Status

Completed

## Outcome and authority

The user approved all four recommendations: key search and searchable decision
pickers; library preview with copying; Unassigned and scope-prefilled capture;
and an explicit shortcut from a recorded-choice draft to existing proposal review.
Existing product contracts in decision-deadlines, memory-search,
decision-understanding and proposal-review remain authoritative.

## Scope and acceptance

- Case-insensitive keyword matching includes decision keys, respecting other
  filters and workspace. Compare/Supersede search key and choice text.
- Library rows and board cards offer the existing preview. Opening fetches full
  details only then; copying uses the full record; closing preserves results,
  filters and scroll. Existing full-page title links remain.
- Owner Unassigned means both owner ID and recorded owner name are absent.
  Keyword, semantic, Gemini candidate filters and saved views agree.
- Library New Decision and empty-state creation inherit the exact selected
  scope only, retaining normal Pending default and explicit save.
- Already-decided new drafts can Review this choice, with text and a single
  scope prefilled (multiple scopes require explicit choice). Full raw draft and
  origin survive Back, explicit return, refresh, evidence/comparison detours,
  errors and unavailable local storage. Review edits do not silently overwrite
  the captured draft; provider requests and save remain explicit.

## Approach

Reuse existing components and browser/navigation contracts. No new dependencies,
AI pipeline, backend schema, automatic analysis or automatic saving. Update
product documentation and add focused integration/browser proof to native scripts.

## Risks and recovery

Preserve pre-existing staged/unstaged changes. Keep return snapshots scoped to
workspace/user; consume them on restoration to avoid resurrecting discarded or
saved drafts. Test only with owned temporary databases and app processes; keep
normal demo data unchanged. Browser plugin unavailable: use native Playwright/
Chrome fallback and inspect desktop/mobile evidence. No subagents.

## Progress

- [x] Read workflow and inspect affected behavior and proof.
- [x] Implement all four recommendations.
- [x] Validate integration, browser flows and repository checks.
- [x] Update product, design and user-guide documentation.
- [x] Clean owned resources and record final result.

## Validation / Result

Passed: lint, TypeScript, production build (existing chunk-size advisory),
117/117 unit/HTTP tests, full integration verification and real offline local
search proof. Focused and complete Chrome browser verification passed, including
desktop/mobile rendering, clipboard, keyboard focus, recovery and explicit saves.
Lint and all 117 tests were rerun successfully after the indexing race fix.

Integration proof covers case-insensitive key queries with other filters and
workspace boundaries; Unassigned excludes linked and named owners, preserves
Pending keyword eligibility, and agrees across Gemini candidates/counts and
real pgvector filtering using controlled vectors. The native offline search
suite additionally covers real multilingual embeddings and combined filters.

Focused browser proof covers lazy Flat/Kanban preview, full-record copying,
failure/retry, keyboard focus, mobile width, searchable Compare/Supersede,
Unassigned + Pending saved views, both scope-prefilled creation entries,
review without automatic provider calls, raw draft preservation through browser
Back/reload/errors/denied storage, evidence/comparison returns, multiple-scope
confirmation and explicit failed/successful save with owner/date/link retained.

The complete UI regression suite passed on final code. Earlier full runs
identified an outdated assertion that completed rows have zero buttons (they
now have Preview) and a test navigation race before swapping the synthetic user.
The checks now require exactly the Preview button on completed rows and wait
for Cancel to reach the library before checking identity isolation. No product
assertions were removed. Additional review found and fixed early consumption
of the draft return snapshot: it now remains in history until the form loads,
including metadata failure followed by reload and retry with storage denied.
The library workflow and expanded discovery suites both passed afterward.

A subsequent full run exposed a real edit/indexing deadlock: publication held
the search-job lock before acquiring the decision FK lock, while an edit held
the decision lock before its invalidation trigger acquired the job lock.
Publication now locks the decision first, preserving the existing concurrent-edit
revision contract in `docs/product/memory-search.md`. The native local-search
proof holds an edit open, observes publication waiting through pg_stat_activity,
then updates and commits: the edit must succeed and stale publication must be
rejected. This failed with a deadlock and exit 1 before the fix, then the full
offline search suite passed with the fix. No schema or retry policy was added.
The final full browser run passed using the restarted API with this fix.

Logs:

- `/private/tmp/decision-discovery-unit.log`
- `/private/tmp/decision-discovery-build.log`
- `/private/tmp/decision-discovery-integration.log`
- `/private/tmp/decision-discovery-local-search.log`
- `/private/tmp/decision-discovery-focused.log`
- `/private/tmp/decision-discovery-ui-final.log`
- `/private/tmp/decision-discovery-recovery.log`
- `/private/tmp/decision-discovery-ui-verified.log`
- `/private/tmp/decision-discovery-race-before.log`
- `/private/tmp/decision-discovery-race-after.log`
- `/private/tmp/decision-discovery-ui-passed.log`
- `/private/tmp/decision-discovery-lint-final.log`
- `/private/tmp/decision-discovery-unit-final.log`

Visually inspected screenshots: `/private/tmp/decision-discovery-preview-desktop.png`
and `/private/tmp/decision-discovery-preview-mobile.png`; desktop/mobile sheet
content and actions fit. Draft-return evidence:
`/private/tmp/decision-discovery-draft-return.png`.

Cleanup complete: both task databases `decision_discovery_20261017` and
`decision_discovery_20261017_ui` were removed. All task-owned API/Vite processes
stopped; no listeners remain on 3011, 3012 or 5173. Offline search removed its own
test databases. Normal demo database/container remain untouched.

Limits: Chrome desktop/mobile validation used the native Playwright fallback
because the Browser plugin is unavailable. Other browser engines and live
Gemini/Slack/Jira integrations were not exercised. Production build retains
the existing bundle-size advisory. No dependencies or schema changes were added.

Friction: automatic approval review temporarily failed on usage limits; after
the user's Continue, the same normal approval path succeeded. The shadcn docs
CLI could not resolve ui.shadcn.com; existing installed component code and
browser proof were used. Development StrictMode replays preview fetching, so
the test checks no eager fetching and a full fetch on open rather than requiring
one request in development. No harness changes were made.
