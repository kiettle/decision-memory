# Local semantic search and one-command startup

Date: 2026-10-12

## Status

Completed

## Outcome

`npm run dev` prepares and starts the local app with PostgreSQL/pgvector and a
cached multilingual embedding model. Memory search needs no Gemini key and
sends no search content to an external AI service.

## Context and authority

The user accepted local embeddings with PostgreSQL vector retrieval, zero paid
service dependencies, and requested setup so running a CLI command is enough.
This supersedes the MVP embedding deferral in the final specification for this
feature. Preserve workspace isolation, filters, authoritative stored results,
normal keyword search, existing credentials, and current uncommitted work.

## Approach

- Add cached, CPU-based multilingual embeddings and durable indexing jobs.
- Add additive vector schema and retrieval without the newest-200 cap.
- Replace memory search and its UI/Slack wording; keep optional AI capture separate.
- Add repeatable local setup/start commands, preserving existing database data.
- Validate real offline inference, database lifecycle/isolation/filter behavior,
  API/browser search, restart, and existing native checks.

## Risks and recovery

- The existing PostgreSQL 17 volume must remain intact when switching to the
  PostgreSQL 17 pgvector image. Back it up before replacement; never remove volumes.
- The first setup downloads packages, Docker image and model weights. Subsequent
  inference must use only cached files. Missing files give a setup instruction.
- Decision edits must invalidate stale vectors immediately. Durable jobs retry
  after restart; concurrent edits must not be overwritten by earlier embeddings.
- Embedding similarity is not a probability. Test English and Vietnamese recall
  and unrelated queries before choosing the matching threshold; document limits.
- Preserve all pre-existing changes; baseline diff saved outside the repository.

## Progress

- [x] Inspect workflow, search, schema, local startup, and existing tests.
- [x] Implement local embedding/indexing and vector retrieval.
- [x] Implement and execute repeatable setup/start.
- [x] Validate native, database, offline-model, API and browser behavior.
- [x] Update product/setup documentation and record evidence.

## Validation

Run lint, typecheck, unit tests, build, PostgreSQL integration verification and
the existing Playwright workflow (Browser plugin not available). Add real-model
proof for bilingual search and offline restart. Use an isolated validation
database; do not run fixtures against the user's decisions.

## Result

Completed on 2026-10-12.

- Added pinned multilingual E5-small q8 embeddings using Hugging Face Tokenizers
  0.2.0 and ONNX Runtime Web 1.30.0 on CPU. Native current ONNX binaries require
  macOS 14; portable WASM was chosen and verified on this machine's macOS 13.7.8.
  Model weights and WASM binaries are read locally during inference.
- Added pgvector 0.8.2/PostgreSQL 17, overlapping passages, HNSW/iterative scans,
  durable dirty jobs, revision-checked publication and cascading deletion.
  Web and Slack disclose indexing coverage; memory search no longer calls Gemini.
- Installed dependencies, downloaded the model (~129 MB), backed up the original
  database to ignored `.local/backups/before-local-vector-search.dump` (mode 600),
  and indexed all 10 existing decisions. Final database counts: 10 decisions,
  10 indexed decisions, 0 pending jobs. `.env` and original decision data preserved.
- `npm run dev` was exercised twice: first prepared/indexed the database; restart
  skipped dependency installation and indexed zero unchanged decisions. Health
  and metadata passed, duplicate startup gave an occupied-port diagnostic, and
  Ctrl+C released ports 3011/3012/5173. App processes were stopped; PostgreSQL stays
  running with cached/indexed data, ready for the user's CLI command.

Observed validation:

- `npm run lint`, `npm run typecheck`, `npm test` (80 tests), `npm run build`,
  and `git diff --check` passed.
- `npm run test:integration` passed against an owned, separately seeded local
  validation database. It was removed after the browser run.
- `npm run test:local-search` passed with external fetch blocked: real English
  and Vietnamese questions ranked DM-104 first (cosine ~0.872/~0.838), an unrelated
  recipe question returned no matches, and no network requests occurred.
  This test also proved background indexing after create and edit, durable
  restart, stale-job rejection, source/owner/tag invalidation, named/combined
  filters, supersession, tenant/FK isolation, deletion, >200 old-record retrieval,
  and the real HTTP route. The test removes its own temporary database.
- A missing tokenizer-config cache file was temporarily moved and restored:
  inference failed with the setup instruction and zero network requests.
- `npm run test:ui` passed the existing desktop/mobile browser regression suite
  on the isolated database. Separate real unmocked search through the single-CLI
  app returned DM-104 first, showed 10 indexed decisions, and had no browser
  console/page errors. Chrome/Playwright fallback was used because the Browser
  plugin was unavailable. Screenshots were inspected outside the repository:
  `/private/tmp/decision-memory-local-search-real-desktop.png` and
  `/private/tmp/decision-memory-local-search-real-mobile.png`.
- Final runtime audit reports the existing Forge/ProseMirror and Sequelize/UUID
  advisories (5 high, 2 moderate). The new tokenizer/ONNX Web packages were not
  reported as vulnerable; no unrelated forced major dependency changes were made.

Limits: approximate retrieval is a relevance heuristic, not a factual-confidence
score. Million-decision performance, free public hosting, and live Slack/Jira
provider delivery were not validated. Optional Gemini capture drafting remains
separate and still uses an external provider when configured. Local automated
checks enforce behavior; no CI/hook/branch-protection changes were made.
