# Execution Plan: Replacement links, scope consistency and suggestions

Date: 2026-10-17

## Status

Completed

## Outcome and authority

The owner approved four items on 2026-10-17: replacement info in meaning results
and Slack answers; one spelling per scope (save-time case/space matching, and
the AI capture draft sees existing scope names); suggested earlier decisions in
the web Supersede dialog; open questions on scope pages.

## Changes

- `vectorSearch` and Gemini candidates return the same `supersededBy` entries as
  keyword results, now with title/outcome/state/status. Slack `/why`, Ask and
  the "Already decided" nudge add a **Replaced by** link for superseded matches.
- `existingScopeNames` maps saved Applies To values to an existing spelling in
  the workspace (the edited record excluded); the capture drafter receives up to
  100 existing names.
- Supersede runs one LOCAL memory search and lists up to three similar active
  decided records first ("Similar ·"), selecting nothing.
- `listScopes` adds `openCount` and lists pending-only scopes; `scopeOverview`
  adds `openQuestions`. The later
  [discovery, sharing and scope usability](discovery-sharing-scope-usability.md)
  work, at the owner's request, replaced the first open-question list on the
  overview with a **Pending questions (N)** library link.

Contracts: [decision understanding](../../product/decision-understanding.md),
[memory search](../../product/memory-search.md),
[Slack capture](../../product/slack-capture.md).

## Validation

Owned database `decision_memory_ccqa` (dropped afterwards), API with blank
provider credentials. Before the follow-up session: lint, typecheck, build,
unit (118), integration (new scope-spelling/replacement/open-question checks),
offline local search and two consecutive full `npm run test:ui` passes. Fixed
along the way: an integration assertion for the richer `supersededBy` shape and
the discovery suite counting the automatic related lookup POST as a write.

After the follow-up session's changes (2026-10-18): lint, typecheck and 119/119
unit tests pass; the scope overview shows the seeded **Pending questions (1)**
link and recorded replacement reason in the browser. The follow-up plan records
its own full validation.
