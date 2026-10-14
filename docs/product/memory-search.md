# Local memory search

## Accepted outcome

On 2026-10-12 the owner approved local multilingual embeddings with PostgreSQL
vector retrieval, zero paid-service dependencies, and easy CLI setup. This
supersedes the earlier Gemini ranking and newest-200 limits for memory search.

## Run locally

Prerequisites: Node.js 22+, npm, and a running Docker Desktop or OrbStack.
From the repository root, `npm run dev` prepares and launches the app at
http://localhost:5173. `npm run setup:local` prepares without launching.

Setup preserves `.env`, keeps the PostgreSQL 17 data volume, applies additive
SQL, and seeds synthetic data only into an empty database. Before replacing a
running plain-Postgres container, it takes a local custom-format pg_dump backup.
Database backups and about 129 MB of pinned model files live under ignored
`.local/`. An occupied app port fails with an actionable message.

Initial setup downloads dependencies, the pgvector Docker image and public
model weights. Inference uses the pinned `Xenova/multilingual-e5-small` ONNX
revision with q8 weights on CPU, one WebAssembly inference thread, and 384 dimensions.
No GPU, model training, AI API key or hosted inference service is needed.
The tokenizer and portable ONNX WebAssembly runtime read local files only; the
WASM binary also comes from the installed npm package. This supports macOS 13
without requiring newer native ONNX binaries. Optional Gemini Slack
drafting is separate and still sends selected synthetic/sanitized content to
Google when configured; Slack and Jira need their own network access.

## Retrieval contract

- Default keyword search stays available. Explicit memory search embeds only
  the query locally and retrieves up to five distinct original decisions.
- Queries enforce the authenticated workspace and channel, owner (including
  recorded owner names), tag, status, applies-to and date filters in SQL.
- HNSW uses cosine distance and iterative scans. Each nearest-passage scan
  excludes decisions already selected, until five distinct decisions are found
  or no candidates remain. A long discussion cannot consume a fixed passage
  window and hide the next decision. There is no 100-passage result window.
  Approximate retrieval may miss results; it does not linearly send every
  decision to a model. No newest-200 decision limit applies.
- Title, reasoning, context, applies-to, options, owner, tags, and captured
  source text enter overlapping token windows. The complete title is indexed
  independently; body windows repeat at most 96 title tokens as context. Each
  window carries at most 256 payload tokens with up to 64 tokens of overlap,
  reserving the E5 prefix and separator within the 512-token model limit.
  Prepared token IDs go directly into inference; passage inputs are never
  silently clipped or decoded/re-tokenized. A decision ranks by its nearest
  retrieved passage. Stored discussion is never included in list responses.
- A cosine cutoff of 0.82 rejects weak matches. Display relevance is
  `clamp((cosine - 0.7) / 0.2, 0, 1) * 100`; this is a retrieval heuristic,
  not a calibrated probability. Slack retains its 60/75 relevance bars.
- Match explanations quote the stored title; they are not generated prose.

## Index lifecycle and recovery

SQL triggers enqueue jobs when indexed decision fields, tags, owners or captured
sources change. Jobs persist in PostgreSQL and coalesce by decision. Source and
tag changes in a save transaction are included in the same durable update.
Deletion cascades to both jobs and embeddings.

The server serially processes jobs in the background every two seconds.
An indexed decision with a pending job is excluded until refreshed. Search
returns indexed and total filtered counts; web/Slack describe pending coverage.
Keyword search remains immediately usable. A revision check under a row lock
rejects embeddings made before a concurrent edit. Publication replaces passages
and removes the matching job in one transaction.

Setup drains the existing backlog before launching the app. `npm run search:index`
can finish a backlog manually. Interrupted inference leaves jobs for the next
run. Model/version changes queue decisions lacking the current embedding key.
The `tokens-v2` embedding format replaces the older character windows;
`npm run dev` or `npm run setup:local` automatically rebuilds derived embeddings
for existing decisions without modifying stored decisions or evidence.
If files are missing, run `npm run setup:local`; runtime never downloads them.

`Ctrl+C` stops the app, leaving PostgreSQL and its data available. `npm run
db:down` stops PostgreSQL without deleting its volume. Recovery from a backup
should restore into a separate database first using pg_restore; never overwrite
the sole database copy or delete the volume as part of setup.

## Validation and limits

`npm run test:local-search` creates a temporary local database, runs the real
cached model with outbound fetch blocked, proves bilingual recall/no-match,
workspace/FK isolation, filters, stale-job rejection, metadata invalidation,
supersession, older-than-200 retrieval, deletion and HTTP search, then removes
only that owned database. It refuses a remote database URL.
Recall regressions prove complete dense-content token coverage, reject
oversized passage inputs, and return five distinct choices even when the nearest
decision contributes 301 higher-scoring passages. Both original failures were
observed before the fixes. Unit coverage also checks every unique title/source
token survives passage construction.

Unit tests cover model/database failure fallback and interrupted indexing.
Existing integration and browser checks remain applicable. No cloud deployment,
production SLA, relevance guarantee or million-record throughput is claimed.
Keyword search still uses the MVP implementation; its indexing and pagination
remain separate scaling work.
