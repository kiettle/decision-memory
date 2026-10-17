# Execution Plan: Compact library and related previews

Date: 2026-10-16

## Status

Completed

## Outcome and authority

The owner approved review recommendations 1 and 2: show library records sooner
with compact rows, and preview related records without leaving a new form.
Preserve contracts in docs/product/decision-deadlines.md and memory-search.md,
including explicit search, draft recovery, lifecycle labels and filter semantics.

## Scope and approach

Reduce library-only spacing and combine record metadata at all viewport sizes.
Add an existing Sheet-based preview with fresh detail loading, full stored Why,
scope, evidence links and Open full decision. No new provider or mutation.
Extend existing browser proof for density, preview recovery, keyboard focus,
raw form preservation and mobile layout. Update relevant product documentation.

## Risks and recovery

Preserve staged and unstaged owner changes. Revert only this increment if needed.
Ignore late preview requests on close/unmount; never show a different record's
response. Retain full-detail navigation and its existing recovery contract.
Validate against an owned synthetic database; clean up only owned resources.

## Progress

- [x] Inspect workflow, product authority, implementation and prior screenshots.
- [x] Implement compact layout and preview.
- [x] Validate and document results; clean up owned runtime.

## Validation

Flow: library -> scan/filter/open actions -> new form -> related search -> preview
-> close -> continue editing unchanged input. Browser plugin not available; use
repository Playwright/Chrome workflow. shadcn CLI info lookup failed DNS; reuse
installed Sheet and its Base UI composition without installing dependencies.
Run lint/typecheck/tests/build and repository integration/local-search/UI proof.
Inspect desktop and mobile screenshots. Human usability remains unmeasured.

## Validation progress

Passed lint, typecheck, build, 117/117 unit/HTTP tests, database integration on
owned decision_compact_preview_20261016, and offline local-search proof in its
own temporary database. Focused everyday UI including new preview checks passed.
Long unbroken title/scope/rationale strings fit 390px without page/metadata overflow.
Desktop and mobile preview screenshots inspected: full rationale and evidence,
scrollable body and fixed visible return/full-detail controls.

First full run reached preview navigation but used a link locator for the Base UI
navigation button; corrected that test locator. A subsequent full run after
integration ended in the existing metadata route callback during page teardown
(Request context disposed). No application failure was established by that error.
Combined browser proof was restarted against a fresh owned
decision_compact_preview_20261016_02 database; the final passing run is recorded below. No harness guidance or unrelated
validation cleanup was changed. Build retains its existing >500 kB advisory.

The fresh full run exposed a second issue in the new preview test: its heading
wait matched the still-open preview before route navigation committed. It could
press Back early and then wait for draft recovery on the still-mounted form.
Wait now requires the exact detail URL and level-1 heading. The focused suite
passes with that synchronization; no product behavior or assertion was weakened.
Additional 320px overflow inspection passed.

The subsequent combined run measured the sheet during its entrance animation;
mobile geometry now runs after a screenshot with finite animations completed.
The geometry assertion is unchanged. Focused proof passed again after both
navigation and animation synchronization fixes. These changes are confined to
the new task-owned checks, not unrelated test harness behavior.

## Result

Both approved improvements are implemented and documented. Flat records use
compact layouts across widths, with visible primary actions and wrapping metadata.
Related previews fetch fresh full detail on demand and preserve the mounted form,
raw inputs, results and focus. Existing full-detail navigation remains available.
No dependencies, database schema, server APIs, provider or retrieval rules changed.

Passed on final code:
- npm run lint; npm run typecheck; npm run build (existing chunk-size advisory).
- npm test: 117/117 tests, 19 suites, no skips.
- npm run test:integration on the first owned database.
- npm run test:local-search with its own isolated database and real offline model.
- npm run test:ui: complete suite passed, including layout, search, deadlines,
  proposals, scope convenience, preview/draft and saved-view workflows.
- Focused preview and long-text overflow proof; git diff --check.

Chrome/Playwright tested localhost:5173 and the isolated API on localhost:3011.
Inspected desktop 1440×1000 and mobile 390×844 screenshots; layout proof also
covers 1280/1366/1536px, with an additional 320px overflow check. The first title
fits the initial unfiltered 390×844 viewport. Preview checks cover fresh lazy
reads, full reason/evidence links, explicit retry, late-response exclusion,
Escape/focus return, raw draft preservation, mobile fit and full-detail navigation.
No unexpected console errors, blank pages or framework overlays remained.

Evidence: /private/tmp/decision-compact-ui-complete.log,
decision-compact-focused-settled.log, decision-compact-unit.log,
decision-compact-integration.log, decision-compact-local-search.log,
decision-compact-build-final.log. Screenshots: /private/tmp/decision-compact-desktop.png,
decision-compact-mobile.png, decision-preview-desktop.png, decision-preview-mobile.png.

Stopped task-owned API/Vite processes and dropped both owned test databases.
The pre-existing PostgreSQL container and normal decision database were retained.
Owner changes remain uncommitted and preserved. No external integrations were
invoked. Limits: Chrome only; first-time user benefit and other browsers remain
unmeasured. Browser plugin absent and shadcn CLI DNS lookup failure were recorded
above; no harness changes were made for that friction.
