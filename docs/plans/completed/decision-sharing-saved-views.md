# Execution Plan: Decision sharing and saved view editing

Date: 2026-10-17

## Status

Completed

## Outcome

Copy a faithful decision summary and maintain saved views without recreating them.
The user's approval to implement recommendations 1 and 2 authorizes this scope.

## Context

- `docs/product/decision-understanding.md`
- `docs/product/decision-deadlines.md`
- Existing detail page, browser-local saved views, and UI verification scripts.

## Scope

Copy stored choice/question, Why, scopes, lifecycle status, and available source
and reference URLs. Preserve pending/superseded meaning and offer manual copy
when clipboard access fails. Do not generate an app URL or invoke AI.

Keep a selected view associated with filter edits; explicitly update it, rename
it, or save a new view. Retain existing storage schema, identity isolation and
duplicate validation. No backend, sync, new dependencies, or automatic writes.

## Approach

Implement the two controls with existing components, extend behavior-level UI
proof, update product documentation, and validate using isolated test data.

## Risks And Recovery

- Preserve pre-existing staged and unstaged changes; no commits or resets.
- Clipboard denial must show manual copy rather than false success.
- Storage failure must retain the previous view and unsaved filters.
- Start/stop only task-owned servers and temporary databases. Leave demo data alone.

## Progress

- [x] Inspect authority, existing behavior and relevant skills.
- [x] Implement summary and saved view editing.
- [x] Validate success, failure, lifecycle and mobile paths.
- [x] Update product, design and presenter documentation.
- [x] Record final validation results.
- [x] Clean up owned resources.

## Decisions

- 2026-10-17: Existing selection is kept during filter edits for this visit;
  reload infers selection from an exact saved configuration, without another
  storage schema. Rename never stores unsaved filters.
- 2026-10-17: Use repository Playwright/Chrome fallback because no Browser plugin
  is available in this session.

## Validation

Passed: lint, typecheck, production build (existing chunk-size advisory), all
117 unit/HTTP tests, and the focused `verifySharingViewsUi` browser check.
The focused check covers actual Chrome clipboard writes/readback, exact stored
text, Pending/Superseded semantics, denied/missing clipboard API, manual copy,
rename without saving filters, update, save as new, duplicate protection,
storage denial/retry, reload, mobile fit and no server writes/AI calls.

The first full UI run timed out at the existing deadline-board "Recorded board
memory" assertion. The isolated deadline suite then passed without changes to
its assertions or product search code. Integration verification also passed.
Final full regression passed against fresh fixtures on unchanged code. Its
deadline, proposal, everyday convenience, library workflow and new sharing/view
checks all passed. No assertions were weakened. Final log:
`/private/tmp/decision-sharing-views-ui-final.log`; integration log:
`/private/tmp/decision-sharing-integration.log`.

Artifacts: `/private/tmp/decision-sharing-views-unit.log`,
`/private/tmp/decision-sharing-views-ui.log`,
`/private/tmp/decision-sharing-deadline.log`,
`/private/tmp/decision-saved-views-mobile.png`, and
`/private/tmp/decision-summary-mobile.png`,
`/private/tmp/decision-summary-desktop.png`, and
`/private/tmp/decision-saved-views-desktop.png`. New desktop/mobile screenshots
were visually inspected; controls fit and wrap within the viewport.

Both owned databases (`decision_share_views_20261017` and
`decision_share_views_20261017_ui`) and API/frontend sessions were stopped and
removed after validation. Normal demo database and container were preserved.

## Result

Implemented both approved improvements using existing UI and storage primitives.
Copy summary preserves stored facts and lifecycle meaning, with graceful manual
copy fallback. Saved views support explicit update, save-as-new and rename while
retaining the original storage schema and identity boundaries. Product/design
documentation and the user guide describe the resulting behavior.

No backend, AI, schema or dependency changes. Browser proof is Chrome only;
other browsers and first-time human usability were not measured. The existing
production bundle-size advisory remains. The initial full-suite deadline lookup
timeout overlapped source formatting and Vite invalidation of the library page;
the isolated and final unchanged-code full runs passed. No unrelated tests or
harness guidance were modified to address this validation friction.
