# Everyday project memory

Date: 2026-10-29

## Status

Completed

## Outcome

Find current scoped answers, review pasted notes into evidence-backed records,
take over a scope, route unanswered searches to an owner, and follow relevant
changes in-app. Preserve existing capture, drafts, lifecycle and integrations.

## Authority and context

- User request authorizes all five capabilities and realistic synthetic proof.
- AGENTS.md, docs/WORKFLOW.md; product contracts for memory-search,
  decision-understanding, decision-deadlines, slack-capture and proposal-review.
- 2026-10-29 owner approval: explicit per-user follows; authenticated workspace
  visibility; events for new scoped decisions, changed choice/reason/scope,
  replacements and answered questions; in-app only; no automatic follows.
- 2026-10-29 owner approval: only a decision's linked owner can select it as
  important for the shared scope brief. There is no project-owner role.
- Existing auth uses installation workspace and stable user identity; local demo
  shares a configured user. Existing workspace records are workspace-visible.
- Existing uncommitted UI edits are user work and must be retained.

## Approach / progress

- [x] Inspect retrieval, capture, scopes, pending completion, auth and validation.
- [x] Resolve notification and brief-curation authority with owner.
- [x] Current answer presentation in web and private Slack retrieval, uncertainty,
  exact scope, evidence and replacement links; unanswered-search entry.
- [x] Paste notes: local candidates, explicit review/save, source excerpt and
  accurate provenance; existing drafts/related lookup/manual entry preserved.
- [x] Shared scope brief: owner-selected current choices, evidence/history,
  pending questions, owners and recorded contact context.
- [x] Personal decision/scope follows and meaningful in-app change feed; access
  and identity boundaries; question resolution follows reuse the same service.
- [x] Focused scenarios, failure/access proof, required checks and browser QA.
- [x] Product docs, short measured coworker study script and final risk report.

## Decisions

- Paste candidates are deterministic local text excerpts, not AI judgments.
  Review one candidate at a time in the normal form; only Save creates a record.
  No additional external AI processing or mandatory fields.
- Questions retain their original title and search query in the existing pending
  record. Completion stores final outcome separately; pending remains excluded
  from confirmed semantic/proposal evidence.
- Use existing visual system/components; targeted flow extensions, no redesign.
- Browser plugin/skill is absent; use repository Playwright workflow.
- Meaningful events and subscriptions use PostgreSQL via the existing repository;
  no external dispatcher. Recipient selection uses signed identity, current
  workspace, explicit follow interval, and exact recorded scope membership.
- All important selections apply to the decision's recorded scopes. Ownership
  transfer clears selection. Existing shared ownership editing is unchanged.

## Increment evidence

- First unit run hit sandbox localhost bind restrictions; rerun with authorized
  local-server access passed 142 tests. New identity/API checks added afterward.
- Lint, typecheck and build passed. Existing large main-bundle advisory remains.
- Integration caught mutable Sequelize pre-edit values suppressing answer events;
  copied snapshots fixed it. Native integration then passed all prior scenarios
  plus personal/tenant access, owner-only curation, exact source preservation,
  pending completion/search, event/noise filtering, unfollow/refollow and rollback.
- Focused real-browser workflow passed on guarded API 3013 and owned database
  decision_project_memory_20261029_01. Browser profile/fixtures are synthetic;
  external credentials blank. A delayed candidate-focus bug was fixed.
- Full UI suite exposed an ambiguous Context selector after adding owner contact
  context. Exact-label selectors retain the original assertions. The final full
  rerun passed.
- Shadcn CLI docs discovery first failed sandbox DNS, then succeeded read-only
  with network access. Official component docs and existing primitives inspected.
- UI/browser artifact routing uses task-local guarded preload outside repository;
  production files are served from the build, fixed API requests route only to
  the owned database marker. Existing app listeners 3011/5173 remain untouched.
- Read acknowledgement uses displayed event IDs rather than a timestamp cursor,
  so an event committed late cannot become read before it was visible. Native
  integration adds the concurrent transaction scenario. Personal receipts remain
  checked against current workspace and explicit follows.
- Final unit/HTTP/signed-Slack suite: 145/145 passed, zero skipped. Includes current
  Slack replacement hydration, source bounds, identity/authentication and strict
  recipient inputs; private cache headers verified.
- Final isolated integration passed, including an identically named foreign
  scope, uppercase UUID follow normalization and late-commit unread receipt proof.
- Real offline local-search proof passed (separate auto-created/removed database),
  covering bilingual/no-result inference, pgvector/filtering, indexing and edits.
- Design source lint: zero failures, one warning for the existing eyebrow pattern.
  Real-browser inspector on a separate synthetic visual workspace at 5175: zero
  failures at 1440 and 390 for scope brief and Changes. Warnings retain the existing
  small section labels and a 15px historical-text edge. Screenshots inspected;
  no clipping, horizontal overflow or error overlay. Existing palette/type/shell
  retained; a generated greeting-oriented composition was not applied because
  this task extends working record flows rather than redesigning a personal home.
- Temporary browser transport disposal initially interrupted the native suite.
  It now forwards through independent local HTTP and suppresses fulfillment only
  after the page/context closes. No repository assertions were removed. The
  task-owned synthetic demo workspace was reset/reseeded after interruptions;
  normal app data and existing listeners were never used by fixture requests.
- The native sharing check imports a TypeScript source module. A temporary Vite
  server on 5176 was attempted but its development websocket was blocked by the
  browser's local-network checks. It was stopped. Final transport renders the
  production build and compiles the one actual source-module assertion with the
  project's TypeScript compiler, preserving all expectations and function code.
  This is reusable agent friction in the fixed-port, mixed source/browser
  validation surface; no Harness guidance changed.
- The complete remaining native owners passed on the final production build:
  sharing/saved views, discovery, practical/refined workflows, shortcut/calendar
  cases, responsive 390/768/1024/1440 and all five new capability scenarios. The
  final single-command complete UI run subsequently passed before completion.

## Validation artifacts and enforcement

Logs under `/private/tmp/project-memory-{unit,integration,search,build,ui,focused}.log`.
Design reports/screenshots under `/private/tmp/project-memory-inspection/` and
`/private/tmp/project-memory-changes-inspection/`; new flow screenshots under
`/private/tmp/project-memory-{answer,brief,changes}-{desktop,mobile}.png`.
Temporary API/transport files are outside the repo and have an owned database
marker guard. They are validation fixtures, not application dependencies.

Accepted boundary owner: ADR 0005 and docs/product/everyday-project-memory.md.
Native local commands exercise allowed own-workspace follows/owner curation and
reject foreign targets, nonowner curation, fallback personal identity and supplied
recipients. No hook installed or changed. No CI workflow found in this repository;
branch-protection enforcement is unverified. These are local proof claims only.

## Risks and recovery

Additive schema only; retain records and sources. Events and follows must be
workspace/user scoped and recorded atomically with mutations. Unfollow must hide
items immediately and refollow must not subscribe retroactively. No real Slack,
email, Jira or Gemini delivery in validation. Use isolated synthetic database and
mock external services. Stop only processes/database owned by this run.

## Validation

Required: npm test, npm run test:integration, npm run lint, npm run typecheck,
npm run build, npm run test:ui against isolated synthetic state. Add scenario
proof for all five capabilities and positive/negative access checks. Inspect
desktop/mobile screenshots, console health and failure recovery. Automated proof
does not establish coworker benefit; real-user measurements remain separate.

## Result

All five capabilities implemented in the existing flows. No required
implementation or automated validation remains incomplete. One durable plan was
used. Product contracts, the accepted policy ADR and coworker measurement script
are updated. Existing unrelated uncommitted UI work was retained; no commit,
hook, CI or integration configuration was changed. The normal application
database was not targeted by validation or schema migration.

| Final proof | Observed result |
| --- | --- |
| `npm test` | 145/145 passed; 19 suites; zero skips |
| `npm run test:integration` | Passed; own/foreign workspace and owner boundaries, source fidelity, question completion/search, event filtering, uppercase IDs, per-user reads, late commits and atomic rollback |
| `npm run test:local-search` | Passed with real offline bilingual embeddings and pgvector; its separate temporary database removed |
| `npm run lint`, `npm run typecheck` | Passed; final server lint also passed after the scope-set comparison refinement |
| `npm run build` | Passed; existing large-chunk advisory remains (main JS about 605 kB, 192 kB gzip) |
| `npm run test:ui` | Complete uninterrupted native command passed, including all prior owners and new capability scenarios |
| Design source/browser inspection | Zero failures; inherited label/15px historical-edge warnings; desktop and phone screenshots inspected |
| Syntax and `git diff --check` | Passed |

The last backend-only refinement compares scope sets, ignoring ordering and
legacy duplicate cleanup. Its native database integration and server lint passed
after the full browser run; ordinary browser scenarios use canonical scope sets.
No browser assertion or failure threshold was removed or weakened.

Cleanup observed: owned API 3013, visual surface 5175 and attempted Vite 5176
stopped; `decision_project_memory_20261029_01` dropped successfully. Existing
normal 3011/5173 listeners remain. Runtime providers were blank or mocked; no
real coworker Slack/email/Jira notification delivery was initiated. Temporary
logs/screenshots remain outside the repository for review.

To use the changes in the normal app, apply additive schema with
`npm run setup:local` and restart the app. This run deliberately migrated and
validated only isolated synthetic state, not the normal database.

Remaining limits: actual human usability/benefit, other browsers and installed
Forge/Slack rehearsal remain unmeasured. Run the coworker script to measure
correctness, task completion, assistance and capture effort. Local demo identity
is shared; workspace-wide visibility and editable ownership remain. There are no
private-decision/channel ACLs, external notification delivery, raw-SQL event
generation or million-record scale claims. Feed history is the latest 100 matching
events; changes and evidence snapshots are not a complete immutable edit audit.
