# Execution Plan: Demo polish

Date: 2026-10-17

## Status

Completed

## Outcome

The screens shown in the Buildathon video carry less chrome and repeated text,
without new features. Authority: the owner asked to "do all the remaining" items
from the 2026-10-17 review (library declutter, Search options bug, detail header,
disclaimer copy, Kanban fit). The optional paste-a-discussion AI draft was not
built: it adds a feature during the final weeks, and the live Slack rehearsal is
the honest path to showing capture.

## Changes

- Library: four control rows instead of eight. Explore scopes button removed
  (Scopes remains in navigation); one filter toolbar with Flat/Kanban at the
  right; sort and saved views share the count row; duplicate sort label removed.
- Search options: overlay anchored under its button; closes on outside click and
  Escape; same Gemini disclosure.
- Detail: deadline/record actions only for pending records; no Decision section
  repeating the title (Original question still shown when different).
- Copy: shorter helper text on library, proposal review, related lookup, scope
  picker and deadline field. Required disclosures (local vs Google, coverage,
  excerpt limits) kept.
- Kanban: columns share the width (minimum 12rem), so five columns fit at 1366px
  and wider; phones keep scrolling inside the board.
- Docs: [design](../../design/decision-memory-ui.md#demo-polish--2026-10-17),
  [deadlines](../../product/decision-deadlines.md), decision understanding,
  README, runbook and the 90-second story in the presentation guide.

## Validation

Owned temporary database `decision_memory_ccqa` (schema + seed), API on 3011 with
that `DATABASE_URL` and blank provider credentials; the normal database was not
touched and the temporary database was dropped afterwards.

| Command | Result |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm run build` | Passed |
| `npm test` | 117/117 passed |
| `npm run test:ui` | Passed twice in a row after two fixes found by earlier runs |

Fixes found by the suite: the nested filter group lacked `min-w-0`, so a very
long scope overflowed a 390px page; the proposal test's metadata mock threw when
navigation cancelled a slow request (now tolerated). New assertions: Search
options does not move the page and closes on Escape; decided detail has no
Decision section or deadline/record actions while pending detail keeps Set
deadline; Kanban fits at 1366/1536 and scrolls inside the board on phones.

Browser checks at 1360×900 and 390×844 on the normal database: about three
decisions above the fold, overlay does not push content, five Kanban columns fit,
no horizontal page scroll on phones.
