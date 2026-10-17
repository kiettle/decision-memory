# Execution Plan: Automatic local discovery and demo seed

Date: 2026-10-17

## Status

Completed

## Outcome

Fewer clicks to reach a recorded decision, and a fresh demo database that shows
replacement reasons, pending questions and deadlines without manual setup.

## Context

The owner approved four items on 2026-10-17 after a hands-on review:

1. Library keyword search with zero results automatically runs local
   **Find by meaning** (never Gemini).
2. New Decision forms show related decisions automatically after typing pauses
   (local only).
3. Proposal review shows a one-line local headline and suggests a scope so
   Gemini analysis is one explicit click.
4. The demo seed records the DM-102 → DM-104 replacement reason and three
   pending questions with deadlines relative to the seed date.

This changes the "never runs automatically" rule in
[memory search](../../product/memory-search.md) for local retrieval only. Gemini
requests, saves and lifecycle changes stay explicit.

## Scope

In scope: library page, related-decision search, proposal review page,
`db/seed.sql`, product/presentation docs, existing UI verification scripts.

Out of scope: new endpoints, schema changes, ranking changes, Gemini
behavior, Slack flows.

## Risks And Recovery

- Extra local embedding requests while typing: debounce, one attempt per
  query/filter combination, stale responses ignored by existing request counters.
- Pre-existing uncommitted work from other sessions in the same files: edit on
  top, never revert unrelated changes.
- Tests run on an owned temporary database (`decision_memory_ccqa*`); the
  normal demo database is not reset.

## Progress

- [x] Automatic meaning fallback in the library.
- [x] Automatic related decisions in new forms; the panel moved under the
  question/Why so matches are visible without scrolling.
- [x] Proposal headline and suggested scope.
- [x] Seed replacement reason and pending questions (DM-111 to DM-113).
- [x] Docs and verification scripts updated.
- [x] Lint, typecheck, build, unit, integration, local-search and UI suites pass.

## Decisions

- 2026-10-17: An automatic library attempt with zero matches keeps the keyword
  empty state (with a "found nothing similar" line) instead of switching to the
  memory view, so users never need **Back to keyword results** for something
  they did not start.
- 2026-10-17: Any meaning search for a filter set, manual or automatic, marks it
  tried; a manual related lookup suppresses the pending automatic one.

## Validation

Environment: owned database `decision_memory_ccqa` (schema + `db/seed.sql`),
API on 3011 started with that `DATABASE_URL` and blank provider credentials,
existing Vite on 5173. The normal `decision_memory` database was not reset; it
only received the existing additive `npm run db:schema` before testing.

| Command | Result |
| --- | --- |
| Baseline `npm run test:ui` (HEAD seed, before code changes) | Passed |
| `npm run lint`, `npm run typecheck`, `npm run build` | Passed (existing chunk-size advisory) |
| `npm test` | 117/117 passed |
| `npm run test:integration` | Passed |
| `npm run test:local-search` | Passed after updating the indexed seed count 9 → 12 |
| `npm run test:ui` | Passed twice. The first run exposed a test mock that answered the new automatic request with the stale fixture (mock fixed). One other full run timed out once at the final Save click in `verifyDiscoveryUi` (unhandled `waitForResponse`, no page dump); the discovery suite then passed 4/4 in isolation on a fresh database and the next full run passed. Treat as an unconfirmed load-related flake. |

Browser checks (in-app browser, 1360×900): natural-language library query falls
back to meaning and ranks DM-104 first; Back to keyword results does not rerun;
nonsense query shows "also found nothing similar"; New Decision shows DM-104
under the question after a pause; proposal review shows the DM-102 → DM-104
headline, suggests Atlas migration, and one click re-checks in that scope with
the seeded replacement reason visible.
