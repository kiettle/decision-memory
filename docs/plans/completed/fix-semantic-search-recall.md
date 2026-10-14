# Fix local semantic-search recall

Date: 2026-10-12

## Status

Completed

## Outcome and authority

The owner explicitly requested fixes for the two reproduced review findings:
token truncation leaves gaps between passages, and the fixed 100-passage window
allows one decision to hide another strong match. Preserve the accepted local
search contract in `docs/product/memory-search.md`, existing records, credentials,
workspace filters, offline inference, and the one-command local startup.

## Approach

- Add regressions that fail on the current implementation.
- Construct model inputs from token windows within 512 tokens, including prefix,
  title context and special tokens; cover the complete title and source content.
- Select distinct decisions through successive indexed nearest-passage scans,
  excluding already selected decisions before each scan.
- Version the changed embedding format and rebuild derived indexes locally.
- Validate native checks, offline/model/database regressions, CLI restart and UI.

## Risks and recovery

- Preserve a database backup and before/after fingerprints of original records
  and credentials. Reindexing must modify only derived embeddings and jobs.
- Keep the old index until each new decision's passages publish atomically;
  queued records remain excluded with honest coverage until refreshed.
- Maintain HNSW/tenant filters; do not replace retrieval with an unbounded
  application-memory corpus scan. Approximate recall and million-record
  performance remain unvalidated.
- Preserve all unrelated uncommitted changes. Temporary validation databases and
  app processes belong to this run and must be removed/stopped after checks.

## Progress

- [x] Inspect the affected implementation and accepted contract.
- [x] Reproduce both failures with committed regressions.
- [x] Implement both fixes and prove the regressions pass.
- [x] Rebuild local derived indexes, verify unchanged original data, and test CLI/UI.
- [x] Record validation and update the consumer search contract.

## Validation

`npm run test:local-search` owns real offline inference and isolated PostgreSQL
proof. Run native unit tests, lint, typecheck, build, existing integration/UI
checks as appropriate. Browser plugin is unavailable; use existing Chrome and
Playwright. Verify repeated startup reuses the new index and shutdown releases ports.

## Result

Completed on 2026-10-12.

Changes:

- Prepared overlapping windows directly from tokenizer IDs. Payloads are at most
  256 tokens, with up to 64-token overlap and at most 96 repeated title tokens.
  Complete titles also receive their own windows. Prefix/separator fit within
  512 tokens; passage inference rejects oversized inputs instead of clipping.
  E5 framing preserves normal SentencePiece whitespace semantics.
- Replaced the fixed 100-passage candidate window with up to five indexed scans,
  excluding every previously selected decision before the next scan. Retrieved
  candidates are sorted by actual similarity before display. Workspace/model/
  metadata filters and the repeatable-read snapshot are preserved.
- Versioned embeddings as `tokens-v2`, rebuilt all 10 existing decisions through
  `npm run setup:local`, and updated the consumer contract and README.

Observed proof:

- Before implementation, `npm run test:local-search` failed both new regressions
  for the intended reasons: a dense-text marker vanished from all model inputs,
  and one long decision caused only 1 of 5 expected distinct matches to return.
- After implementation, the same tests pass with external fetch blocked. Dense
  context, long titles and captured source text reach model inputs; all inputs
  fit 512 tokens. An oversized input is rejected. The crowding fixture returns
  five correctly ordered distinct choices despite 301 nearer passages belonging
  to the first decision. Tenant isolation and metadata filters remain enforced.
- Existing English/Vietnamese queries still rank DM-104 first with cosine values
  ~0.872/~0.838, and the unrelated recipe query returns no matches. Original
  stale-job, CRUD/background indexing, metadata invalidation, tenant/FK, filters,
  supersession, deletion, older-than-200 and real HTTP checks pass.
- `npm test` passes 82 tests. `npm run lint`, `npm run typecheck`, `npm run build`
  and `git diff --check` pass. Full `npm run test:integration` and `npm run test:ui`
  pass against an owned, separately seeded validation database.
- All five actual retrieval queries remain eligible for the HNSW cosine index,
  verified with EXPLAIN and forced planner settings. This does not establish
  normal planner choice or million-record throughput.
- Unmocked browser search passes at 1536x1024 and 390x844 with DM-104 first and
  no console/page errors. Screenshots inspected outside the repo:
  `/private/tmp/decision-memory-recall-fixed-desktop.png` and
  `/private/tmp/decision-memory-recall-fixed-mobile.png`. Browser plugin was
  unavailable; the existing Playwright/Chrome fallback was used.
- `npm run dev` reuses packages/model files and reports 0 decisions needing
  reindexing after the initial 10-record rebuild. The real app API reports
  10/10 indexed decisions and DM-104 first. Ctrl+C releases all three app ports.
- Original decision/source-row fingerprints and the .env fingerprint exactly
  match their before-fix values. Only derived index data changed; the original
  database backup is ignored at `.local/backups/before-recall-fixes.dump`, mode 600.
- Temporary validation databases and app processes were removed/stopped. The
  persistent local database remains running with 10 indexed decisions, 0 jobs.

Remaining limits: HNSW remains approximate; similarity is not factual confidence.
Million-record performance, public cloud hosting and live external Slack/Jira
provider delivery remain unvalidated. Optional Gemini capture drafting is still
separate. No dependencies, CI, hooks or branch protection were changed by this fix.
