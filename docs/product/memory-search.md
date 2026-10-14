# Memory search: local vectors and Gemini

## Accepted outcome

On 2026-10-12 the owner approved local multilingual embeddings with PostgreSQL
vector retrieval, zero paid-service dependencies, and easy CLI setup. This
supersedes the earlier Gemini ranking and newest-200 limits for local memory search.

On 2026-10-13 the owner approved restoring optional Gemini AI ranking alongside
local vectors. The web library provides **Search by memory** (local vectors) and
**Search with Gemini**. Both use the current channel, tag, linked/recorded owner,
status, Applies To and date filters. Neither runs automatically as the user types.
Slack recall, similar-decision suggestions and nudges continue to use local search.

## Optional Gemini AI search

Set `GEMINI_API_KEY` and restart the server to enable the Gemini action. Its
adjacent copy discloses that the query and compact stored decision/evidence
excerpts are sent to Google. Local search requires no key and remains offline.
An explicit Gemini request uses the existing configured Gemini model, without
automatically falling back to another provider.

Apply the authenticated workspace and metadata filters in PostgreSQL before
selecting at most the newest 200 matching decisions (created date descending,
ID descending for ties). The query describes the remembered meaning; it is not
an additional keyword restriction on the candidates. Compact cards bound title,
rationale, context, alternatives, owners, tags, channels and an anchor-first
discussion excerpt. Long records are excerpted; this is not full-document analysis.

Gemini returns at most five matches. IDs must belong to the supplied candidates;
unknown/duplicate IDs are discarded. Returned titles and records come from the
database, and list payloads preserve source/channel metadata without full captured
discussion. Generated explanations and relevance scores can be wrong and must
be checked against the stored evidence; scores are not factual confidence.

Results identify the method and disclose searched/total filtered counts. If more
than 200 decisions match, the UI explicitly says older matching decisions were
excluded and recommends narrower filters or local search. The owner accepts
approximate/inaccurate ranking and omissions; filtered input improves focus but
does not guarantee correctness. Missing credentials, timeouts, rate limits and
invalid output have visible errors while local and keyword search remain usable.

`POST /api/decisions/memory-search` accepts `method: LOCAL | GEMINI`, defaulting to
LOCAL for existing clients, plus query and filters. Metadata exposes separate
`memorySearch` and `geminiMemorySearch` availability flags. Results/cached return
navigation retain their method; changed queries/filters invalidate pending results.

Proof: Gemini unit/API tests, real filter-before-cap PostgreSQL integration,
dual-method browser interactions and the existing offline local-search proof.

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

The approved [deadline workflow](decision-deadlines.md) keeps pending questions
in normal keyword search and restricts memory candidates/counts to DECIDED
records. Include final outcome separately from the preserved question; identical
legacy title/outcome text is not duplicated in local passages. Outcome/state
changes invalidate the local index before the new choice can be retrieved.

- Default keyword search stays available. Explicit local memory search embeds only
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
