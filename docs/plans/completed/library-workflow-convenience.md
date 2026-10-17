# Execution Plan: Library and capture convenience

Date: 2026-10-16

## Status

Completed

## Outcome

Save and reuse library views, recover from empty searches, restore unfinished
capture/edit forms, and show optional rationale beside a recorded choice.

## Context and authority

The owner explicitly requested these four recommendations on 2026-10-16.
Existing behavior is owned by docs/product/decision-deadlines.md and
memory-search.md, apps/web/src/pages/library-page.tsx and decision-form-page.tsx.
Preserve the pre-existing uncommitted scope/filter convenience work.

## Scope and approach

1. Add browser-local, workspace/user-scoped saved views (query, filters, view,
   sort; never AI results) with explicit save/apply/delete actions.
2. Add actionable empty-state recovery in Flat and empty Kanban results without
   silently broadening filters or invoking AI.
3. Offer Restore/Discard for browser-local new/edit drafts after navigation or
   reload; preserve raw list inputs and clear after successful save. Do not
   overwrite newer server edits with a stale recovered edit.
4. Show optional Why beside a decided choice; retain one required field.
5. Validate desktop/mobile interactions, storage failure/recovery, and native checks.

## Risks and recovery

Browser storage can be unavailable or corrupt: keep core workflows usable and
show storage errors. Keys include workspace/user and record identity. Drafts
are recovery copies, never automatic server writes. Existing explicit scoped
navigation must not silently replace a new proposal with an unrelated draft.
Remove only task-owned UI fixtures, servers and isolated databases after proof.
Revert only this task's diff if needed; preserve earlier changes.

## Progress

- [x] Inspect contracts, current implementation and browser proof.
- [x] Implement and document the four approved improvements.
- [x] Validate focused UI and native checks; review diff.

## Validation

Browser plugin not available; use repository Playwright workflow and focused
coverage for saved views/reload/delete, exact filters and no automatic AI,
empty-state recovery, draft restore/discard/save/failure and edit freshness,
optional rationale, desktop/mobile layout and console health.
Run lint, typecheck, unit tests, build and available integration/UI proof.

## Result

All four approved workflows are implemented and documented. Existing uncommitted
scope/filter work was preserved. No server schema or provider behavior changed.

Passed on 2026-10-16:

- npm run lint; npm run typecheck; npm test (117/117); npm run build.
- npm run test:integration against task-owned decision_convenience_20261016_01.
- npm run test:local-search (its own temporary database, real offline model).
- npm run test:ui, including new scripts/verify-library-workflow-ui.mjs coverage.
- Focused browser proof additionally exercised workspace/user view isolation,
  draft user isolation, exact scopes and raw text, removal/write failure, stale
  edit recovery, explicit meaning search, save cleanup and failed-save recovery.
- Desktop 1440x1000 and mobile 390x844 screenshots inspected; no unexpected
  browser errors, framework overlays, blank pages or horizontal overflow.
- git diff --check.

The HTTP unit fixtures required localhost socket access outside the sandbox.
Browser plugin was unavailable, so repository Playwright/Chrome was used.
The final lint pass required moving saved-view request invalidation into its
event handler to satisfy the React immutability check; behavior is unchanged.
Build retains a bundle-size advisory (>500 kB), with no build failure.

Cleaned up task-owned frontend/API/watcher processes and temporary UI database.
The pre-existing PostgreSQL container and normal decision data were retained.
Evidence screenshots are under /private/tmp/decision-convenience-*-preview.png;
test logs use /private/tmp/decision-convenience-*.log.

Limits: saved views and form drafts are browser-local recovery data, not synced
records. Clearing storage removes them. Automated proof does not establish
first-time usability or cross-browser results beyond Chrome. Live external
integrations were not exercised; no new AI calls were introduced.
