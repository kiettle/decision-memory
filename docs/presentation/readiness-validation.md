# Local demo readiness evidence

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
