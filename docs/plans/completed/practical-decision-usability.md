# Execution Plan: Practical decision usability

Date: 2026-10-17

## Status

Completed

## Outcome and authority

The user's 2026-10-17 implementation request authorizes metadata-to-filter
controls, fuller shared previews, a single-scope selector for multi-scope related
lookup, and review/return for pending completion on every existing surface.
Existing contracts: decision-deadlines.md, memory-search.md, proposal-review.md,
decision-understanding.md and completed library-discovery-review.md. Preserve
all current staged and unstaged work; no new retrieval/lifecycle/identity policy.

## Approach

- Pass existing filter updates into Flat and Kanban; reuse exact values and make
  already-selected metadata a no-op without invalidating results.
- Extend the shared lazy full-detail preview with owner, existing deadline
  rendering and all lifecycle.current replacement links.
- Reuse SearchableSelect and existing request invalidation for one lookup scope,
  keeping it separate from draft values; previews do not remount lookup.
- Extend navigation snapshots to pending completion, scope restoration to the
  current identity and record, and restore through a page-level recovery host
  even if a concurrent completion removes the originating Pending row.
- Add focused browser proof and run the full native workflow with isolated data.

## Risks and recovery

Existing diff and index captured in /private/tmp/decision-practical-*.patch;
affected starting files copied outside the repository. Never restore/reset the
working tree. Keep raw completion input in navigation state, not solely storage.
Consume return state, preserve original review inputs and existing conflict API.
Use only owned test processes/databases and mock outbound providers. Browser
plugin is unavailable; use repository Playwright/Chrome workflow.

## Progress

- [x] Read workflow, inspect contracts, existing implementation and validation.
- [x] Implement four changes and focused proof.
- [x] Update product/design/guide documentation.
- [x] Run required native/full browser checks and inspect desktop/mobile evidence.
- [x] Clean owned resources and record final result.

## Validation

Run lint, typecheck, unit/HTTP tests, build, integration, real offline local-search
and complete UI regression suite. Focused coverage: exact filter mappings and
no-op/context preservation; lazy preview lifecycle/owner/deadline and focus;
lookup scope selection/stale replies; completion review Back/return/reload/error,
identity isolation, evidence/comparison detours, no writes and concurrent conflict.
No first-time usability or live external integration claim.

## Result

All four behaviors are implemented and validated together. Existing components,
API contracts, provider controls and draft recovery remain in use. No dependency,
schema, provider or backend policy was added by this increment. All previously
staged changes remain byte-for-byte unchanged in the index; unstaged owner work
was preserved and extended. No commit or live external integration was performed.

### Runtime isolation correction

An initial unprivileged listener inspection missed an existing normal API on
3011/3012 and IPv6 Vite on 5173. The owned API failed to bind, and three synthetic
fixture requests reached the normal database before the mismatch was detected.
The exact three newly created IDs and their two unused tags were identified and
removed; no database was reset. Key allocation uses MAX+1, with no persisted
sequence changed. Normal API/Vite processes remain running.

Subsequent validation uses owned database `decision_practical_20261017`, API on
127.0.0.1:3013 and the owned IPv4 Vite. A temporary, database-guarded Node preload
redirects the fixed-port scripts' browser/fixture/mock-fetch requests to 3013,
with an API/database identity readiness check. Browser traffic, fixture API
traffic and mock route.fetch routing were each independently verified before
the full suite. This is task-local transport setup, not a repository harness or
production configuration change. All provider credentials are blank and Gemini
requests are mocked.

### Executable and observable proof

| Command | Result |
| --- | --- |
| `npm run lint` | Passed on final code, web/server |
| `npm run typecheck` | Passed on final code |
| `npm test` | Passed, 117 tests / 19 suites, zero skips; initial sandbox bind EPERM required a permitted rerun |
| `npm run build` | Passed on final code; existing >500 kB chunk advisory remains |
| `npm run test:integration` | Passed with owned DATABASE_URL, synthetic PostgreSQL and mocked providers |
| `npm run test:local-search` | Passed, real cached offline bilingual inference/indexing and own temporary database |
| Focused `verifyPracticalUi` | Passed using existing Playwright owner |
| `npm run test:ui` | Full suite passed twice after expectation fixes; final pass includes strict three-non-whitespace-character eligibility |
| `git diff --check` and index baseline comparison | Passed |

UI/integration used `DATABASE_URL=postgresql://decision_memory:decision_memory@localhost:5434/decision_practical_20261017`
with GEMINI_API_KEY, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, JIRA_BASE_URL,
JIRA_EMAIL and JIRA_API_TOKEN blank. The full UI command also used
`NODE_OPTIONS=--import=/private/tmp/decision-practical-route.mjs` for the verified
3013 transport described above. API startup used
`node /private/tmp/decision-practical-api.mjs`; frontend used the existing Vite
command with `--host 127.0.0.1 --port 5173 --strictPort`. Neither temporary script
is a product dependency or repository harness change.

Browser evidence in `scripts/verify-discovery-ui.mjs`, invoked by
`scripts/visual-qa.mjs`, covers:

- Every metadata mapping, including each scope/channel, distinct linked/name/
  Unassigned owner semantics, keyboard access, preserved URL query/filter/layout/
  sort, same-value semantic-cache no-op and stale-response invalidation.
- Full-detail-only preview owner/deadline, pending urgency versus historical
  deadlines, branching current replacements versus intermediate successors,
  missing information, origin links, lazy loading/retry and focus return.
- Independent exact/all lookup selection, no form changes or automatic calls,
  error clearing, selection retained through preview, scope default reset and
  out-of-order response rejection. Existing zero/one-scope/mode/save checks also
  passed as part of the full regression suite.
- Flat/Kanban/detail completion review, sole versus zero/multiple scopes, raw
  whitespace/rationale, Back/explicit return/reload, denied localStorage,
  provider/restore/save failures and retry, evidence/comparison detours, no
  implicit calls/writes, narrow completion preservation, concurrent completion
  conflicts, user/workspace/record mismatch rejection and dismissal cleanup.
- Existing search/provider, quick-filter/assignment/saved-view, Flat deadline/
  outcome, draft recovery, proposal, sharing and navigation regressions.

Chrome at desktop (1440x1000, plus existing suite laptop widths) and mobile
(390x844) passed page identity/content, no framework overlay, console health,
independent keyboard controls, no nested actions in links, focus and overflow
assertions. Visually inspected preview, long metadata, lookup and completion
screenshots. A real long-owner flex overflow was found and fixed with a shrinking,
wrapping metadata button. Earlier test failures came from the old combined-scope
text expectation and newly introduced navigation/heading locators; tests now
assert each exact control and committed route, without weakening behavior proof.

Logs: `/private/tmp/decision-practical-{lint,typecheck,unit,build,integration,local-search,focused,ui}.log`.
Screenshots: `/private/tmp/decision-practical-{metadata-mobile,preview-desktop,preview-mobile,lookup-mobile,completion-desktop,completion-mobile}.png`.

### Cleanup and limits

Stopped only owned Vite PID 44346 and isolated API PID 45390; dropped only
`decision_practical_20261017`. Verified normal API PID 43768 (3011/3012), Vite
PID 43825 (::1:5173) and `decision_memory` remain. Verified the three accidental
fixture IDs are absent from the normal database. No normal database reset or
normal process restart occurred. Temporary evidence remains outside the repo.

No required check remains failed, blocked or unattempted. Browser plugin was not
available, so repository Playwright/Chrome was used. Other browsers, live Google/
Slack/Jira integrations and first-time human usability observation were not run.
Automated interaction checks do not prove improved usability. Existing bundle
size advisory remains; this increment did not expand scope to optimize it.
