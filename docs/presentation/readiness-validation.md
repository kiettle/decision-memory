# Local demo readiness evidence

## Web convenience update — 2026-10-16

Implemented the approved web-only scope/filter/navigation improvement. Users can
search and select multiple exact scopes, explicitly add a new name, and see scope
outside More details. Library quick filters preserve the query and other filters;
removable chips remain visible on mobile. Scope overview actions prefill an
editable scope in creation or proposal review and preserve return navigation.

| Check | Observed result |
| --- | --- |
| Native unit/HTTP suite | 117/117 passed, no failures/skips |
| Lint and typecheck | Passed |
| Production build | Passed; advisory for the 545.06 kB main chunk (175.46 kB gzip) |
| Native database integration | Passed on owned temporary database |
| Complete browser regression | Passed: existing capture/search/deadline/comparison/proposal flows and the new convenience scenarios |
| UI identity, meaningful content, framework overlay | Correct Decision Memory title/routes; rendered controls; no overlay |
| Console/page errors | No unexpected errors; intentional 503 fixtures exercise retry |
| Desktop/mobile interaction and screenshots | Passed and visually inspected at 1440×1000 and 390×844; existing suite also checks laptop widths |
| Cleanup | Owned database `decision_memory_current_qa_27289` removed; owned app processes stopped |

New proof in `scripts/verify-convenience-ui.mjs` is invoked by the native UI suite.
It checks explicit scope creation/removal, comma preservation on edit/save, exact
duplicates, 200-character/30-scope limits, keyboard selection, focus, mobile long
names and nested menus. It also verifies all quick-filter mappings, legacy ACTIVE
URLs, query/view/sort preservation, chip removal, Clear filters, Recent, metadata
failure/retry, stale responses, scoped Back/Cancel/save, and no automatic AI calls.

The browser run exposed missing React 18 ref forwarding in the new chip container
and the input wrappers used by the popup. These were fixed before the passing run.
Test assertions wait for closing menu/sheet transitions before measuring layout;
the proposal test waits for in-flight mocked handlers before disposing its context.

Environment: local API/frontend with external credentials blank, isolated synthetic
data, Playwright/Google Chrome. Browser plugin not available. This run adds no
live Slack/Jira/Gemini rehearsal or human-benefit evidence. The main-bundle size
advisory is retained; no warning threshold was raised.

Temporary logs: `/private/tmp/scope-ux-unit.log`, `scope-ux-types.log`,
`scope-ux-lint.log`, `scope-ux-build.log`, and `scope-ux-runtime.log`.
Screenshots: `/private/tmp/decision-memory-scopes-form-desktop.png`,
`decision-memory-filters-desktop.png`, `decision-memory-filters-mobile.png`, and
`decision-memory-filters-mobile-long-scope.png`. Native scripts retain the proof
if these temporary artifacts expire.

## Proposal review increment — 2026-10-15

### Later rehearsal handoff

The owner requested a handoff instead of a live session. Read-only Slack
`auth.test` succeeded with the configured workspace and a bot identity.
Tailscale Funnel's existing `/decision-memory` route targets port 3012. No app
listeners were running on 3011/3012/5173. Installed manifest, shortcut visibility,
signing-secret validity and live interaction behavior remain unverified; no
Slack messages, app settings or tunnel settings were changed.

Prepared the [Slack handoff](slack-rehearsal-handoff.md) and
[coworker study guide](study/facilitator.md), with separate participant cards,
14 synthetic records, eight task prompts and a blank measurement worksheet.
[Offline fixture proof](evidence/proposal-study-fixture-proof.json) passed all
eight tasks for expected current evidence, including replacement history and
pending exclusion. It used an owned temporary database and blocked external
inference; the database was removed. This proves fixture retrieval, not task
equivalence, Gemini judgments, usability or measured benefit. No participants
have been recruited or observed by this work.

### Gemini reliability follow-up

The owner authorized improving model reliability. Assessment and verification
now run concurrently under the same eight-second deadline. Verification judges
explicit conflict/alignment/unsettled aspects per current decision without
seeing the assessment's answer. A proposed opposite action is distinguished
from a changed applicability condition. Citation validation, exact scope,
pending exclusion, evidence revalidation and conservative fallback remain.
HTTP 503 retries once per call within the same deadline; invalid output and
rate limits do not retry. No model/account change was made.

| Evidence | Observed outcome |
| --- | --- |
| [Before diagnostic](evidence/proposal-reliability-diagnostic-before.json) | Four existing cases timed out; first calls took roughly 4–5 seconds, leaving too little time for sequential verification |
| [Concurrent diagnostic](evidence/proposal-reliability-diagnostic-after.json) | Three matched; one timed out. Both inspected conflicts were recognized |
| [12 known failures](evidence/proposal-reliability-regression.json) | 11/12 matched, no incorrect completed verdict; m34 received HTTP 503 from both calls. This preceded the bounded 503-retry addition |
| [Fresh V4](evidence/proposal-evaluation-v4.json) | 23/24 matched: 7/8 conflict, 8/8 consistent, 8/8 insufficient. m41 timed out waiting for verification; no incorrect completed verdict |
| Native verification | 117/117 unit/HTTP tests; lint, typecheck, build, database integration and desktop/mobile browser regression checks passed |

V4 is balanced by expected verdict and language, including missing rationale,
negation, replacement history, pending exclusion, wrong scope, changed limits
and malicious text in evidence. It was authored and frozen before its first
live run. Twenty-two cases invoked Gemini (21 completed); wrong-scope and
pending-only cases abstained locally. Candidate retrieval is controlled, so
these results do not measure real retrieval recall or user benefit. Explanations
were inspected against the authored fixtures; no independent human adjudication
has occurred. The verifier suppressed an unsupported initial finding on u43
(changed payload size). Both passes still use the same provider.

Across the 22 provider-backed checks, median elapsed time was 5.052 seconds
and nearest-rank p95 was 6.314 seconds; the failed check reached 8.011 seconds.
These timings include the evaluation's controlled retrieval, not production
database/local-embedding latency, and should not be presented as full-app speed.

Reports retain intermediate outputs, timing, source/fixture hashes and all
failures. The evaluation exits nonzero for the single timeout; it is not a
perfect pass and was not rerun to remove the failure. Native proof logs:
`/private/tmp/proposal-reliability-unit.log` and
`/private/tmp/proposal-reliability-runtime.log`. The latter confirms cleanup
of owned test resources. The final 503 retry path has deterministic success,
retry-limit, cancellation and deadline tests; the live run need not encounter
that transient failure to validate other cases.

The earlier excessive-abstention issue improved on both regression and new
examples. Provider tail latency remains. Proceed to owner-operated Slack
rehearsal and coworker evaluation; the main-demo user-benefit gate remains open.
The older V1–V3 results below are retained historical evidence.


Follow-up fixes: the Slack modal now includes the required **Done** submit
control; dismissal cancels pending result publication without analysis or
saving. Evidence/comparison/saved-choice return controls now restore proposal
text and scope. These were defects missed by the original suite. Expanded
verification passed 113/113 unit tests, lint, typecheck, build, native database
integration and the full desktop/mobile browser suite. Logs:
`/private/tmp/decision-memory-fixes-unit.log` and
`/private/tmp/decision-memory-fixes-runtime.log`. The runtime log confirms
cleanup of the owned database. Restored-input screenshot:
`/private/tmp/decision-memory-proposal-return-fixed.png`.
This does not resolve the model-quality or installed-rehearsal gates below.

Implemented local proposal retrieval, explicit scoped Gemini assessment, separate
stored evidence and citations, current replacement hydration, safe web prefill,
and the private Slack message shortcut. No schema migration or analysis history.
The owner deferred interviews and authorized synthetic examples.

| Check | Observed result |
| --- | --- |
| Unit/HTTP/signed Slack tests | 112/112 passed, no skips |
| Lint, TypeScript, production build | Passed |
| Native database integration | Passed on an isolated temporary database, including replacement chains and workspace isolation |
| Native local-search verification | Passed with real offline bilingual inference, including proposal retrieval |
| Full native Playwright/Chrome suite | Passed desktop/mobile, keyboard focus, explicit save, retry, edit/navigation races and input preservation; no page errors |
| Installed Slack | Pending owner rehearsal; signed mocked HTTP tests do not prove installed behavior |
| Coworker interviews and comparative study | Pending; no measured user benefit yet |

Runtime proof: `/private/tmp/decision-memory-proposal-runtime.log` ends with
`CURRENT QA PASSED` and removal of the owned temporary database. Unit and local
search logs are `/private/tmp/decision-memory-proposal-unit.log` and
`/private/tmp/decision-memory-proposal-search.log`. Screenshots are
`/private/tmp/decision-memory-proposal-desktop.png` and
`/private/tmp/decision-memory-proposal-mobile.png`; their Gemini answer is mocked.
No Slack/Jira messages or installed manifest changes were made.

### Live Gemini assessment evidence

Configured model: `gemini-3.5-flash-lite`. Each fresh set contains 24 synthetic
cases, balanced across three expected verdicts, half English/half Vietnamese.
Retrieval is controlled, labels are authored, and this is not user acceptance
or an end-to-end recall benchmark. All results, including failures, are retained.

| Run | Completed | Expected labels matched | Failures |
| --- | --- | --- | --- |
| [V1](evidence/proposal-evaluation-v1.json) | 18/24 | 17/24 | One unsupported mismatch on unspecified retention; six unavailable results |
| [V2](evidence/proposal-evaluation-v2.json) | 24/24 | 21/24 | Two unsupported mismatches on undecided vendor/chart; one unsupported agreement under changed size constraints |
| [V3](evidence/proposal-evaluation-v3.json) | 22/24 | 16/24 | Six genuine conflicts downgraded to insufficient evidence (m32–m37); two eight-second timeouts (c38/u33) |

After V1, tightened outcome-citation and missing-parameter rules. After V2,
added a second skeptical verification within the same deadline. V3 is the first
set evaluated against that final implementation: no false mismatch observed,
but excessive abstention makes it unsuitable as the main demonstration today.
Two of eight genuine conflicts were detected; seven of eight consistent and
seven of eight insufficient-evidence cases matched, with two unavailable cases.
A same-provider second pass is not an independent semantic guarantee.

**V3 demo gate:** the V4 follow-up above addresses excessive abstention on a
new set; provider tail latency remains. Complete owner-operated installed Slack
rehearsal and the 5–8-person comparative study before claiming benefit. Use the
established local evidence/replacement workflow in the meantime. The
[study and rehearsal kit](proposal-review-validation.md) and
[active plan](../plans/active/proposal-review.md) contain the remaining work.

## Previous baseline — 2026-10-14

Date: 2026-10-14. Current source baseline:
`1aa48806d423267f56ae6b40b28d79ae059ce865`.

## Current status

Local logic verification passed. The owner requested: "just check the logic,
I'll make a real demo later". Live integration rehearsal, first-time human
observation and recording remain pending. No live provider requests, Slack
messages, Jira issues or installed manifest/tunnel changes were made in this run.

The source working tree was clean at the start. All implementation files,
including the new deadline/shared utilities and verification scripts, were
already tracked in the baseline commit. This readiness change updates
documentation only; it adds no public API, schema or product behavior.

## Local logic verification

Environment: macOS, Node.js 24.21.0, npm 11.19.0, PostgreSQL 17 with pgvector,
Google Chrome 155.0.8059.41. Browser plugin not available; used the repository's
Playwright/Chrome workflow. App URLs were `http://localhost:5173` and
`http://localhost:3011`, backed by a separate owned temporary database.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | Passed: 96 tests, 19 suites, no failures/skips | Server unit/HTTP tests; temporary log `/private/tmp/demo-readiness-unit.log` |
| `npm run lint` | Passed | Web/server ESLint; temporary log `/private/tmp/demo-readiness-lint.log` |
| `npm run typecheck` | Passed | Web app and tooling TypeScript; temporary log `/private/tmp/demo-readiness-typecheck.log` |
| `npm run build` | Passed | Production Vite build; temporary log `/private/tmp/demo-readiness-build.log` |
| Integration entrypoint `scripts/verify-integration.mjs` | Passed | Same native script as `npm run test:integration`, with isolated `DATABASE_URL`; temporary log `/private/tmp/demo-readiness-runtime.log` |
| `npm run test:local-search` | Passed | Real cached multilingual ONNX inference with outbound inference fetch blocked; temporary log `/private/tmp/demo-readiness-search.log` |
| `npm run test:ui` | Passed | Native desktop/mobile UI verification; temporary log `/private/tmp/demo-readiness-ui.log` |
| Documentation links and `git diff --check` | Passed | Relative links resolve; whitespace check passed before the local commit |

Temporary logs/screenshots are reproducible QA artifacts, not presentation
recordings. Native verification owners are committed under server tests and
`scripts/`; the result remains documented here if the temporary artifacts expire.

Covered logic:

- Real migration reruns preserve edited outcomes and pending rows; deadline and
  completion shortcuts preserve links, evidence, tags, metadata and relationships.
  Completion retries preserve timestamps; conflicting repeats offer editing.
- Date boundaries include yesterday/today/+7/+8/no date, leap days and DST;
  browser proof covers local midnight, focus refresh and Vietnam/Los Angeles dates.
- Flat/Kanban use the same filtered records and counts, preserve search/filter/
  sort/navigation/cache, contain mobile overflow and reveal Decided cards ten at
  a time. Each capture/completion save exposes one required text field.
- Pending questions remain in ordinary search, but are excluded server-side from
  memory candidates/answers, current scope choices and supersession.
- Existing capture/retry/source pagination, owner/tag/channel filters, keyword
  and bilingual memory retrieval, comparison, replacement history, scopes,
  Recent, Jira receipt recovery and Settings failure/retry continue to pass.
- Gemini response validation, candidate caps, filtering, unavailable/rate-limited
  fallback and Slack draft/manual races are exercised with provider fakes.
  Jira ambiguous/partial outcomes and duplicate attempts remain isolated tests.

UI proof: desktop widths 1280/1440/1536 and mobile 390×844. Page identity,
meaningful render, absent framework overlay, keyboard interactions, save/load
failure recovery and absence of unexpected console/page errors passed. Relevant
screenshots are `/private/tmp/decision-memory-kanban-desktop.png`,
`decision-memory-kanban-mobile-board.png` and `decision-memory-pending-form.png`.
Desktop/mobile/form screenshots were visually inspected. Owned app processes and
both temporary database families were removed; the existing Postgres container
and demo database were preserved. No listeners remain on 3011/3012/5173 from this run.

Fixture identifiers: owned database `decision_memory_deadlines_proof_22029`;
integration workspaces `decision-memory-integration-test` and
`decision-memory-integration-other`; UI tag `deadline-ui-proof` and scope
`Deadline-only questions`. Offline-search verification creates and removes its
own `decision_memory_search_proof_<process-id>` database. The existing demo
database is not the target of these checks.

## First-time human observation — pending

Participant role, browser, local date/time zone and test date: not supplied.
No task outcome or human elapsed time has been measured. Observation means
watching an unfamiliar developer, PM, tech lead or QA try these tasks without
explaining navigation or buttons.

Prepare synthetic fixtures on the presentation computer. Include one pending
backup-storage question due three days after the participant's local date.
Give only the prompts below; keep the guided demo instructions separate.

| Task prompt | Outcome | Time | Hesitation/errors/assistance |
| --- | --- | --- | --- |
| Save a question about which backup storage to choose. | Pending | Unmeasured | Unobserved |
| Find the backup-storage question that needs a choice within the next week. | Pending | Unmeasured | Unobserved |
| The team agreed to use object storage. Record that choice for the question. | Pending | Unmeasured | Unobserved |
| The team already chose exponential backoff for failed uploads. Capture that choice. | Pending | Unmeasured | Unobserved |

Record completion, pauses, errors and any help using an anonymous participant
label. If help is needed, record assisted completion rather than claiming the
task passed unaided. Verify only one text field is required per save and optional
metadata never blocks completion. A guided or automated walkthrough cannot fill
this table. Capture/retrieval timing targets are not release thresholds or
measured time-saving claims.

## Installed integration rehearsal — pending

The owner will designate a synthetic Slack channel and Jira test project before
the live rehearsal. Credentials/configuration, installed manifest and Slack-only
tunnel readiness were not contacted or changed in this logic-only run.

| Live check | Status | Evidence to record later |
| --- | --- | --- |
| Slack setup and tunnel | Deferred to owner | Installed shortcuts/commands/events/scopes; only Slack listener 3012 exposed |
| Capture, `/decide`, mention, Ask and private nudges | Deferred to owner | Test channel, fixture/message/decision IDs, saved evidence and private replies |
| Replacement and pending exclusions | Deferred to owner | Baseline/replacement IDs, final choice/question, preserved evidence/history, no pending answer/replacement |
| Gemini search and optional capture draft | Deferred to owner | Synthetic query/thread, stored candidate IDs, grounded returned choices and observed timing |
| Jira test issue | Deferred to owner | Designated project, one created issue key, summary/backlink and saved Related Work reference |

Keep deliberate timeouts, repeated requests and partial-success fault injection
in isolated fixtures. If a live Jira result is uncertain, follow the existing
receipt/reconciliation flow instead of starting a new create operation.

## Packaging and demo handoff

Use the [demo rehearsal](demo-runbook.md) and
[presenter guide](README.md) for the owner's later recording. Baseline creation
now explicitly selects Already decided and opens More details; the separate
pending/deadline walkthrough matches the current interface. Q&A distinguishes
automated logic, installed integration checks and observed usability.

The readiness documentation commit identifier will be reported at handback.
Retrieve it from Git with
`git log -1 --format=%H -- docs/presentation/readiness-validation.md`.
Secrets, databases, model caches and build/test output remain excluded from Git.

Recording location, 60–90 second rehearsal timing and fallback take: pending
owner recording. No agent-generated recording is being presented as a real
demo or an unfamiliar user's experience.

Overall readiness remains pending until the human tasks, installed integration
flows and actual recording are observed. Shared deployment/Forge identity,
access policies and additional features remain outside this local preparation.

## Everyday convenience validation — 2026-10-16

The owner requested simplified search/filter controls, Assigned to me, pending
Flat actions, and optional new-form related lookup. This extends the existing
convenience work; it changes no server retrieval policy or proposal assessment.
The [completed execution record](../plans/completed/everyday-decision-convenience.md)
owns implementation and acceptance evidence.

### Isolated local workflow

Use an owned temporary database, never reset the normal `decision_memory` DB.
Check ports 3011, 3012 and 5173 before starting; stop only this run's processes.
Use an unused database name for each run. The commands below used
`decision_everyday_20261016_01` in the existing local pgvector container:

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U decision_memory -d postgres -c 'CREATE DATABASE decision_everyday_20261016_01'
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U decision_memory -d decision_everyday_20261016_01 -f /app/db/schema.sql -f /app/db/seed.sql
```

In the validation terminals, set `DATABASE_URL` to
`postgresql://decision_memory:decision_memory@localhost:5434/decision_everyday_20261016_01`
and explicitly blank `GEMINI_API_KEY`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`,
`JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` so `.env` cannot enable live
outbound integrations. Start `node apps/server/src/index.js` and, in another
terminal, `npm run dev --workspace web -- --host 127.0.0.1 --port 5173 --strictPort`.
Verify API/frontend readiness from their logs and through the browser.
Run `npm run test:integration` and `npm run test:ui` with the same isolated
`DATABASE_URL` and blank credentials. `npm run test:local-search` independently
creates/removes its own temporary database and blocks outbound inference fetch.
Run lint, typecheck, unit/HTTP tests and build as usual.

`test:ui` extends existing Playwright scripts, including
`verifyEverydayConvenienceUi` in `scripts/verify-convenience-ui.mjs`. Semantic
requests are intercepted; Gemini receives no workspace content. Scenarios cover:

- Keyword → explicit LOCAL meaning search → keyword; keyboard Search options
  and prior disclosure; explicit GEMINI path, errors, cached returns and stale
  local/Gemini responses through the existing provider/navigation tests.
- Detailed sheet access and count, visible chips, Assigned to me with query,
  scopes/Pending/Overdue/Due soon, Owner synchronization, saved views, URL Back,
  clearing, missing identity and metadata failure/retry.
- Independent Flat title/action keyboard focus, no nested controls, cancel,
  failed deadline/outcome input retention, successful edit/clear/completion,
  disabled repeated submission and refresh membership under Pending/Overdue.
  Existing Kanban/detail scenarios remain in the same suite.
- Optional related lookup in both creation modes, exact single-scope and
  all-scope zero/multiple selection, stored rationale/lifecycle/coverage,
  empty/error/unavailable recovery, input/mode/scope stale-response rejection,
  open-result/Back/raw-draft restoration and ordinary save during lookup.
- Desktop/mobile screenshots, overflow, viewport-fitting sheets, page identity,
  meaningful content, framework overlay and unexpected console/page errors.

On completion, stop the API/frontend started above with Ctrl+C; then remove only
the owned database, after verifying its exact name:

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U decision_memory -d postgres -c 'DROP DATABASE decision_everyday_20261016_01'
```

Automated browser results do not establish first-time usability. Human observation,
other browsers and live external integrations remain separate checks.


### Result of this run

Passed: lint, typecheck, 117/117 unit/HTTP tests, build, isolated integration,
real offline local-search proof, and the complete `npm run test:ui` on final code.
The final UI run used fresh `decision_everyday_20261016_02`; both owned `_01` and
`_02` databases and app processes were removed afterward. Normal demo data and
container were preserved. Logs/screenshots are listed in the completed execution
record. Chrome desktop/mobile identity, content, console, focus, overlay, viewport
fit and interaction checks passed. Build retains the existing size advisory.
Earlier fieldset rendering, moved selectors and interrupted fixture failures were
resolved before the passing full run. No required check remains blocked.
Human usability, other browsers and live external integrations were unattempted.

## Practical decision usability — 2026-10-17

Implemented direct metadata filters, shared preview owner/deadline/all-current-
replacement information, independent multi-scope draft lookup selection and
pending-completion proposal-review return. Product authority, detailed scenarios,
commands, temporary transport setup, evidence and cleanup are recorded in the
[completed execution record](../plans/completed/practical-decision-usability.md).

Passed lint, typecheck, 117/117 unit/HTTP tests, build, isolated integration,
real offline local-search and the complete existing UI suite on final code.
`verifyPracticalUi` extends the existing discovery browser owner and runs from
`npm run test:ui`. It checks exact filter mappings/no-ops/context, lazy full-record
previews and branching replacements, independent lookup scope/stale replies,
all completion surfaces, Back/reload/error/detour recovery, identity isolation,
concurrent conflicts and no implicit writes. Existing convenience regressions
also passed. Desktop/mobile visual, overflow, keyboard, focus, page identity,
overlay and unexpected console-error checks passed using Playwright/Chrome;
Browser plugin was unavailable.

An initial port collision caused three synthetic records to reach the normal
database. Those exact records and two new unused tags were removed; no reset
occurred. Subsequent runs used verified owned API 3013 and database
`decision_practical_20261017`, with fixed-port test requests routed by a temporary
guarded preload. Owned app processes/database were removed afterward; normal
app processes/database remain. See the execution record for the incident and
identity/cleanup proof. Gemini was mocked; no workspace content was sent to it.

No required validation remains blocked. Existing build size advisory remains.
Human usability, other browsers and live external integrations were unattempted.
