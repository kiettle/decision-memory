# Memory search: local vectors and Gemini

## Accepted outcome

On 2026-10-12 the owner approved local multilingual embeddings with PostgreSQL
vector retrieval, zero paid-service dependencies, and easy CLI setup. This
supersedes the earlier Gemini ranking and newest-200 limits for local memory search.

On 2026-10-13 the owner approved restoring optional Gemini AI ranking alongside
local vectors. The web library provides primary **Find by meaning** (local vectors) and
secondary **Search with Gemini** inside **Search options**. Both use the current channel, tag, linked/recorded owner,
status, Applies To and date filters. Gemini never runs automatically. Local search
runs automatically only in the two cases in
[automatic local discovery](#automatic-local-discovery--2026-10-17).
Slack recall, similar-decision suggestions and nudges continue to use local search.

Owner-approved discovery extension (2026-10-17): ordinary keyword search also
matches the displayed decision key, case insensitively (for example `dm-104`).
Key searches retain the current workspace and all selected filters; they never
trigger semantic search or bypass a filter. **Owner: Unassigned** selects records
with neither a linked owner ID nor a recorded owner name. This predicate applies
to keyword results, local vector candidates/counts and Gemini candidates before
the cap. Pending questions remain excluded from semantic search as before.

## Optional Gemini AI search

Set `GEMINI_API_KEY` and restart the server to enable the Gemini action. Its
Search options disclosure, visible before invocation, discloses that the query and compact stored decision/evidence
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
and removes the matching job in one transaction. Publication locks the decision
before its job, matching save-time invalidation so concurrent edits cannot
deadlock with embedding insertion.

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

## Empty-result recovery and saved views — 2026-10-16

The owner-approved library convenience extension adds explicit local
**Find by meaning** recovery after empty keyword results, when the query and
filters are eligible and local search is configured. Empty memory results offer
**Back to keyword results** and applicable filter recovery actions. Saving or
applying a library view never repeats memory search or persists its results.
See [saved views and capture recovery](decision-deadlines.md).

## Search controls and creation lookup — 2026-10-16

The owner approved one primary local **Find by meaning** action beside automatic
keyword search. **Search options** opens a compact disclosure containing the
optional **Search with Gemini** action and its query/excerpts/newest-200 Google
sharing notice. Opening it invokes nothing; selecting the Gemini action invokes
the existing provider without a second confirmation. Disabled actions explain
query length, availability and pending/deadline restrictions in visible text.
Result method, coverage, counts, errors and **Back to keyword results** remain
visible. There is no automatic retry or provider fallback.

New web forms offer optional **Find related decisions**, using the current
Pending question or Already decided final choice. It calls LOCAL only, with the
same three-character minimum and availability flag. Exactly one selected scope
uses that exact Applies To filter; zero scopes search all scopes. With multiple
scopes, **Search within** defaults to All scopes and permits choosing one exact
selected draft scope. It does not combine scopes or alter the draft.
No pending state filter is sent; existing retrieval excludes pending evidence
and includes current/superseded recorded decisions under its existing rules.

Up to five matches show stored key, choice, exact scopes, lifecycle status and
bounded stored Why, plus **Open decision**. Coverage describes pending indexing.
Similarity is discovery, never equivalence, duplicate/conflict judgment or approval.
Empty/error/unavailable results preserve the form and manual saving. Searches,
retries and saves are separate explicit actions; saving does not await retrieval.
Changing primary text, mode or scopes, starting a save, and leaving the form
invalidate pending publication. Related results are neither saved nor drafted;
returning offers existing raw draft recovery without repeating lookup.

Proof: `scripts/verify-convenience-ui.mjs` and the existing library/deadline/UI
checks, with semantic providers intercepted; integration and offline local-search
proof retain server retrieval, pending exclusions and lifecycle coverage.

## Related decision preview — 2026-10-16

Owner-approved: new-form related results offer **Preview**, opening a Sheet
without navigating or remounting the form. Opening loads the selected record
through the existing authenticated detail endpoint. It shows the current stored
choice, lifecycle status, full Why, exact scopes and source/reference links.
Missing evidence and incomplete/shortened capture remain explicit. The original
**Open decision** link stays available; **Open full decision** inside the sheet
opens the detail page, where saved discussions and replacement history can be read.

Close, Escape and **Back to draft** return focus to the trigger and preserve raw
form input and related results without draft restoration or repeated search.
Preview reads never invoke AI or mutate records. Loading failures offer an explicit
retry; closing/unmounting invalidates late responses. Each opening reloads detail;
there is no new cache or persistence. Full-page navigation continues using the
existing draft-recovery contract. Proof extends verify-convenience-ui.mjs.

## Scoped draft lookup and fuller previews — 2026-10-17

Owner-approved: the multi-scope draft **Search within** selector contains All
scopes and each exact selected scope. Selection changes invalidate results,
errors and pending publication without making a request. **Find related
decisions** remains the explicit LOCAL action. All scopes omits appliesTo; a
specific scope uses the existing exact filter. Draft scope changes reset lookup
to all scopes for zero/multiple values or the sole scope for one value. Primary
text/mode/scope invalidation, pending evidence exclusions and availability rules
remain. Preview open/close preserves selected lookup scope and raw draft inputs.

The shared library/draft Preview loads owner, deadline and replacement content
from the full record only when opened. Owner uses linked display name, recorded
name or Unassigned. Deadlines reuse the viewer-local pending urgency and decided
historical-date display; absent dates are omitted. Superseded previews link every
`lifecycle.current` replacement, preserving the originating navigation context.
Immediate historical intermediates are not labeled current; missing current
information is explained without inventing a successor. Full-detail/evidence,
loading/retry, return wording, Escape/focus restoration and no-AI/no-write behavior
remain the same.

## Automatic local discovery — 2026-10-17

Owner-approved convenience change. It replaces the explicit-only rule above for
local retrieval in two places. Gemini requests remain explicit everywhere.

**Library fallback.** When keyword search for an eligible query (at least three
non-whitespace characters, no Pending status or deadline filter, local search
configured) returns zero decisions, the library runs one LOCAL **Find by meaning**
request with the same filters after a short pause. It runs once per query/filter
combination; **Back to keyword results**, errors and empty meaning results do not
retry it. Matches show the existing result banner, labelled as an automatic
fallback. Zero meaning matches keep the keyword empty state and say that meaning
search also found nothing. The manual **Find by meaning** action is unchanged.

**Related decisions in new forms.** New Pending and Already decided forms run the
existing LOCAL related lookup about 0.7 seconds after the question/final choice or
lookup scope stops changing. Edits, mode/scope changes, saving and leaving still
invalidate pending results. **Find related decisions** remains available to
retry. Saving never waits for the lookup, and results are never saved or drafted.

Both reuse `POST /api/decisions/memory-search` with `method: LOCAL`; nothing is
sent outside the computer. Proof: the library, convenience and discovery UI
checks in `scripts/visual-qa.mjs`.
