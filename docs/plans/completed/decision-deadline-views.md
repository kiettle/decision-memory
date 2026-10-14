# Execution Plan: Flat and Kanban deadline views

Date: 2026-10-14

## Status

Completed

## Outcome

One Decision Library offers Flat and Kanban views, optional decision deadlines,
lightweight pending capture and explicit final outcomes. Each save needs one
text field; shortcuts preserve all unrelated record data.

## Context

Authority: the owner's explicitly approved implementation plan in this chat.
Current owners: `docs/design/decision-memory-ui.md`,
`docs/product/decision-understanding.md`, `docs/product/memory-search.md`,
`db/schema.sql`, server repository/API, and web library/form/detail.

## Scope

In scope: pending/decided state, outcomes, deadlines, additive migration, safe
shortcut APIs, shared date rules, both views, recorded-choice consumers, proof.
Out of scope: scheduled reminders, dragging, reopening, deployment, CI changes.

## Approach

1. Record product/design authority; implement storage, validation, safe writes.
2. Update search, scope, comparison, and Slack consumers for recorded outcomes.
3. Build capture, completion/date dialogs, Flat/Kanban with retained navigation.
4. Run native checks and isolated integration/local-model/browser verification.

## Risks And Recovery

- Existing staged/unstaged work is present: preserve it; never reset the tree.
- Full edits replace links: shortcuts update only deadline or outcome/why/state.
- Migration copies only legacy data once; reruns preserve pending and edited rows.
- Browser plugin not available: use the repository's Playwright workflow.
- Only isolated test databases/processes owned by this run may be cleaned up.
- Recovery retains additive columns/data; do not drop decisions or reseed users.

## Progress

- [x] Inspect current behavior and approved authority.
- [x] Add product contract, migration, domain/API behavior and proof.
- [x] Update recorded-choice consumers.
- [x] Implement forms, dialogs, Flat/Kanban and navigation.
- [x] Validate native checks and isolated rendered interactions.

## Decisions

- 2026-10-14: Defaults and boundaries follow the approved owner plan, including
  seven-day urgency, viewer-local dates, optional metadata, and Decided show-more.
- 2026-10-14: Runtime guard scope is the accepted rule that pending questions
  cannot become remembered/current choices or supersession participants; enforce
  at the repository/domain boundary with allowed/forbidden behavior tests.

## Validation

Focused: calendar boundaries, field validation, supersession, API mutation scope.
Integration: migration reruns, shortcut preservation/retries, search exclusion.
Required: lint, typecheck, build, unit, integration, local-search and UI commands.
Usability: first-time human observation is unavailable unless provided; automated
interaction proof must not be described as observed human usability.

## Result

Implemented and verified on 2026-10-14. Flat remains default; Kanban reuses loaded
records and retains filters/sort/cached memory without a loading flash. Pending,
direct-decided and completion flows each expose one required text field. Dedicated
deadline/outcome writes preserve links and evidence. Pending scope links browse
questions rather than opening nonexistent recorded-choice overviews.

Passed: npm test (96 tests), npm run lint, npm run typecheck, npm run build,
integration verification (native script invoked against an owned temporary DB),
npm run test:local-search and npm run test:ui, plus git diff --check.

Integration exercised the real migration twice from an old schema, preserved edited
outcomes/pending questions, and proved shortcut isolation/preservation, concurrent
retry timestamps, conflicts, legacy edits and pending exclusions. Offline ONNX
proof additionally verified outcome-only recall and invalidation of question
embeddings on completion. Browser proof covered page identity/render/console,
counts/show-more, save failures/cancellation, keyboard Enter/Escape, view/filter/
sort/cache restoration, midnight/focus refresh and Vietnam/Los Angeles calendars.
Chrome viewport proof: 1280/1536 desktop and 390x844 mobile; screenshots were
visually inspected. Only owned temporary databases and app processes were stopped
and removed; the existing local database was not used for feature verification.

Accepted runtime boundary: DECIDED records may be remembered/current/replacing;
PENDING records cannot. Positive and negative tests passed through native unit,
integration and real vector retrieval owners. Local checks are verified; no
checked-in CI or installed hook invocation was found. Branch protection is
unverified. No external enforcement configuration was changed.

First-time human usability observation was unavailable and remains unverified.
Real external-provider/Forge deployment validation is outside this feature proof.
Reusable agent friction observed: sandbox localhost/Docker/registry access needed
escalation; Base UI buttons rendered as links retain button semantics in tests.
No Harness guidance was changed for that friction.
