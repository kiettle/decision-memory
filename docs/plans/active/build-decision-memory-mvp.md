# Execution Plan: Build Decision Memory MVP

Date: 2026-10-06

## Status

Active

## Outcome

A locally runnable Jira Forge demo proves the complete Decision Memory loop: a
Slack message can be saved as a durable Decision, the Decision can be searched
and filtered in a polished Jira-hosted React application, its details remain
understandable without Slack, and a newer Decision can supersede it.

## Context

- Product authority: [`decision-memory-final-spec.md`](../../../decision-memory-final-spec.md)
- Repository workflow: [`docs/WORKFLOW.md`](../../WORKFLOW.md)
- Accepted architecture: [`docs/decisions/0001-demo-first-forge-remote-architecture.md`](../../decisions/0001-demo-first-forge-remote-architecture.md)
- Reference implementation: `/Users/kietle/Documents/workspace/projects/agile-test`

## Scope

In scope:

- React Custom UI Decision Library, detail, create, and edit flows.
- Search and combined owner, team, tag, status, applies-to, and date filters.
- Active and superseded lifecycle with bidirectional navigation.
- Jira and generic external references.
- Express API with Forge request authentication and development-only local
  identity.
- PostgreSQL schema, Sequelize models, tenant-scoped queries, and demo data.
- Slack message shortcut, `/decide` command, shared modal submission, durable
  source snapshot of up to 100 selected-thread messages, short-lived capture
  drafts, and retry idempotency for one configured demo workspace.
- Explicit Gemini-assisted Search by memory over at most 200 filtered stored
  Decisions, with normal PostgreSQL search preserved as the default and
  fallback.
- Environment templates for Jira/Forge, PostgreSQL, Slack, and optional Gemini.
- Focused business-rule tests and browser-level proof of the core demo flow.

Out of scope:

- Deployment and production infrastructure.
- Notification delivery until event and channel policy are specified.
- Slack multi-workspace OAuth installation.
- Jira issue creation, marketplace panels, or full Jira integration beyond the
  Forge-hosted global page and related Jira links.
- Graph UI, embeddings, vector databases, graph databases, autonomous knowledge
  assistants, and other roadmap features.
- Redis, microservices, event buses, and generic provider frameworks.

## Approach

1. Produce complete desktop concepts for the Decision Library, Decision detail,
   and create/edit surface, plus a mobile library concept; obtain approval.
2. Derive design tokens, component families, layout rules, and interaction
   inventory from the accepted concepts.
3. Scaffold one local-first project containing the Forge manifest, Vite React
   frontend, Express backend, PostgreSQL Docker service, Sequelize models, and
   documented environment variables.
4. Implement workspace-scoped Decision CRUD, tags, references, source snapshots,
   search/filtering, and supersession with focused positive and negative tests.
5. Implement the real frontend flows against the API and seed a polished demo
   dataset.
6. Implement Slack signature verification, message shortcut and `/decide`
   entry points, their shared modal flow, source capture, and idempotent
   submission.
7. Add the approved explicit Gemini Search by memory action only after the
   non-AI loop is stable; keep AI capture extraction deferred.
8. Validate lint, types/build, database behavior, API integration, and the
   browser-rendered core workflow at desktop and mobile sizes.

## Risks And Recovery

- Forge and Slack require public HTTPS callbacks for real integration testing.
  Keep standalone local UI/API flows operable with synthetic data while real
  credentials and a tunnel are unavailable.
- Tenant leakage is the highest data risk. Every model and query must carry the
  workspace key, and cross-workspace relation tests must fail explicitly.
- Slack retries can duplicate Decisions. Persist a unique Slack interaction key
  and prove repeated submission returns the original result.
- AI output can misstate truth. Keep Gemini optional, return structured drafts,
  validate every returned Decision ID against the workspace candidate set, and
  never persist AI ranking output.
- If a phase becomes unstable, retain the last passing non-AI slice and remove
  only the incomplete optional surface rather than weakening core validation.

## Progress

- [x] Read repository workflow and final product specification.
- [x] Inspect the `agile-test` Forge, React, Express, database, ORM, and local
  configuration patterns.
- [x] Confirm and record the demo-first architecture.
- [x] Generate and approve the complete UI concept set.
- [x] Scaffold local application and environment configuration.
- [x] Implement and validate core data/API behavior.
- [x] Implement and validate Decision Library and detail/edit flows.
- [x] Implement and validate Slack capture and idempotency with signed-request
  and database fixtures.
- [x] Complete local browser fidelity and end-to-end demo validation.
- [x] Audit the final MVP checklist and close owner-search, related-reference
  editing, Slack retry identity, durable-anchor, and submission-error gaps.
- [x] Capture and present up to 100 messages from the explicitly selected Slack
  thread through short-lived database drafts.
- [x] Implement and validate explicit Gemini-assisted Search by memory with
  grounded results and normal-search fallback.
- [x] Demo-readiness review (2026-10-07): fix list-field typing, multi-word
  keyword search, form-encoded Slack Web API calls, thread-capture fallback,
  tag-filter tag loss, lifecycle controls, superseded-by library rows, dead UI
  controls, and UI-test fixture cleanup; remove unused code and dependencies.
- [x] Submission review fixes (2026-10-07): superseded banner on the detail
  page, Jira issue keys as related-work labels, thread-only Slack name lookups
  with readable mentions and links, 404 for malformed Decision IDs, and a
  deterministic UI test. `gemini-3.5-flash-lite` is listed as stable in
  Google's public model documentation.
- [x] Validate one real Search by memory request with a Gemini API key
  (2026-10-07: Vietnamese and English paraphrases ranked DM-104 first, ~2 s).
- [x] Add the spec §7 stretch: an optional AI draft of the Slack form, with a
  review notice, a no-clear-decision outcome, and a fallback to the plain form.
  Checked against real Gemini on synthetic threads (~1.6 s each).
- [x] Validate real Slack callbacks end to end: DM-111 was saved from the demo
  workspace through the Tailscale tunnel with an AI draft and its channel.
- [x] Loop feature 1, Ask in Slack: an "Ask Decision Memory" message shortcut
  and `/why <question>` answer privately in a Slack window using Search by
  memory, with a clear message when Gemini is unavailable.
- [x] Loop feature 2, Already decided?: the Slack save form lists up to three
  similar stored Decisions and offers an optional "Replaces an earlier
  Decision" picker that supersedes the chosen active Decision on save.
- [x] Loop feature 3, Create Jira issue (spec §18): from the Decision page,
  choose project and issue type, pre-fill the summary, create the issue with
  the Jira Cloud REST API, and save its key under Related Work.
- [ ] Re-paste the updated Slack manifest (new shortcut and `/why`), add Jira
  credentials, and rehearse all three features live. Local proof so far: 53
  unit tests (Slack ask and replace flows, Jira client and route), the database
  integration check (a real supersede through a signed Slack save, workspace-
  scoped Jira links), and the browser test (Jira dialog with Jira mocked). Real
  Gemini ranks DM-111 at 95 for "why did we pick postgres for the migration
  service?" and flags DM-104 and DM-110 for a GCS-backup draft.
- [x] Slack nudges: a Slack events endpoint on the Slack-only listener; a
  private "Already decided" reply to questions that match an active Decision
  (score ≥ 75, one Decision, Share in thread / Not relevant); a private
  "Save it?" reply to decision phrases in thread replies that opens the
  existing capture form; at most one nudge of each kind per thread, recorded
  in `slack_nudges`; manifest event subscriptions; docs. Proof: 15 new unit
  tests (phrase checks, signed events, recall, capture, buttons; mutation-
  checked against the score bar and the claim), the database integration check
  (thread lookup, one winner of five simultaneous claims, signed events end to
  end), and a rehearsal with real Gemini and the demo database: DM-104 for the
  English and Vietnamese backup questions, DM-111 for the Postgres question, no
  nudge for an unrelated question, and a signed URL check through the tunnel.
- [x] `@Decision Memory decide` (Slack refuses `/decide` in threads): a private
  Save as Decision button for the latest message before the mention, with
  optional typed title; `app_mention` event and `app_mentions:read` scope.
  Proof: 3 unit tests (thread anchor, typed title into the form, hint, no
  double reply from the duplicate message event).
- [ ] Re-paste the manifest with event subscriptions and the mention scope,
  reinstall, and rehearse the nudges and the mention live in Slack.
- [ ] Before submission: move or remove the nested `apps/web/.git` (a single
  scaffold commit) and confirm `apps/web/src` is tracked by the submitted
  repository.

## Decisions

- 2026-10-07: At the product owner's request, the bot speaks up in channels it
  is invited to. This specifies the two triggers and the delivery channel that
  the 2026-10-06 notification deferral waited for. A cheap English/Vietnamese
  phrase check runs first; only matching questions (text only, ≤ 500
  characters) go to Search by memory. Replies are ephemeral to the author, at
  most one per kind per thread, and nothing is posted publicly unless someone
  clicks Share in thread. No message text is stored. The recall bar is 75 (Ask
  keeps 60) and shows one active Decision. Turning it off means removing the
  bot from the channel.
- 2026-10-07: At the product owner's request, add three loop features after
  the AI draft: Ask in Slack, Already decided?, and Create Jira issue. Slack
  answers are private modals (nothing is posted to channels). "Replaces" only
  offers similar Decisions that are still active and reuses the supersede
  rules. Jira issues use a Jira Cloud API token from `.env`; the Forge Jira app
  is deferred until after the demo video.
- 2026-10-06: Defer notifications until their triggering events and delivery
  channel are explicitly specified.
- 2026-10-06: Build the non-AI capture and retrieval loop before optional Gemini
  extraction.
- 2026-10-06: Use the reference project for integration patterns, not as a source
  of legacy Connect or production infrastructure.
- 2026-10-06: Support both the Slack message shortcut and `/decide`; they share
  one confirmation and persistence path, while only the shortcut claims an
  anchor message and captured thread context.
- 2026-10-06: Accept the six coordinated concepts in
  `docs/design/concepts/` and implement the extracted rules in
  `docs/design/decision-memory-ui.md` without unapproved visual additions.
- 2026-10-07: Defer the Team field at the product owner's request. The Slack
  channel replaces it in the library column and filter, and Team is removed
  from the web form, Slack modal, AI draft, detail page, and search. The
  `decisions.team` column and its values are kept for a later decision.
- 2026-10-07: Implement the spec §7 AI capture draft as an optional pre-fill of
  the existing Slack modal. Choosing among several detected decisions stays
  deferred; the draft covers the one closest to the selected message.
- 2026-10-07: Present the competition demo through the local web app with real
  Slack over a tunnel. Jira-hosted Forge rendering, Slack-to-Forge workspace
  mapping, and Forge user identity remain unvalidated and out of the demo path.
- 2026-10-07: Approve two final competition pillars: durable capture of the
  full selected Slack thread up to 100 messages, and explicit Gemini-assisted
  retrieval when the user remembers meaning rather than exact keywords.

## Validation

- Focused proof: business-rule tests for required fields, workspace isolation,
  search defaults, idempotency, and valid/invalid supersession.
- Integration or end-to-end proof: seeded local database, API flow, Slack
  interaction fixtures, and browser interaction from library search through
  Decision detail and supersession.
- Repository-required checks: formatting/lint, type checking where configured,
  production frontend build, focused test suite, and browser console/visual QA.

## Result

The local MVP is implemented. It contains the Jira global-page manifest, React
Custom UI, Express Forge Remote API, PostgreSQL/Sequelize data model, seeded
demo, Decision CRUD/search/filter/supersession, Slack message shortcut,
`/decide`, shared Slack modal, durable selected-thread drafts and source
snapshots, retry idempotency, normal PostgreSQL search, and explicit
Gemini-assisted Search by memory.

Observed proof:

- Demo-readiness review, 2026-10-07: `npm run lint`, `npm run typecheck`,
  `npm test` (17 tests), `npm run build`, `npm run test:integration`, and
  `npm run test:ui` pass against a freshly seeded local database. The UI test
  types list fields key by key, searches `migration storage`, checks the
  superseded-by row label and lifecycle controls, and leaves nine seeded
  Decisions.
- `npm run typecheck`, `npm run lint`, `npm run test` (14 tests), and
  `npm run build` pass.
- Reapplying `db/schema.sql` and `db/seed.sql` to the validation database passes.
- `npm run test:integration` passes Slack capture-draft persistence,
  idempotency, expiry cleanup and workspace isolation; concurrent Decision-save
  retries; durable source content; current filters; superseded candidates;
  related references; and owner workspace scope.
- Live local API calls pass listing, metadata, create, captured-discussion
  search, combined filtering, supersession, and reverse lifecycle navigation.
- `npm run test:ui` passes independent keyword and mocked memory search,
  grounded match explanations, collapsed and expanded captured discussion,
  Decision detail, create/edit, desktop and mobile screenshots, and zero
  browser console errors. No Browser plugin was available, so this proof used
  the skill's Playwright fallback with the existing local Chrome installation.

Remaining external validation:

- Forge CLI manifest lint could not run because the installed CLI could not
  access macOS Keychain and its telemetry host from the managed environment.
- Slack Web API calls now use form encoding, which every Slack method accepts;
  this is covered by mocked tests but has not reached real Slack yet.
- The Gemini model ID `gemini-3.5-flash-lite` has not been exercised live.
- Real Forge FIT callbacks and Slack interactions require the user-supplied app
  IDs, tokens, signing secret, installed workspace, and public HTTPS callback.
- A real Gemini request was not run because `GEMINI_API_KEY` is intentionally
  empty. Structured parsing, cross-language/vague matches, no-match output,
  unknown IDs, rate limits, malformed output, and timeout fallback are covered
  with mocked unit/browser tests.
- A live Slack capture-duration rehearsal and the real Slack → Express →
  PostgreSQL → Jira-hosted UI flow still require credentials and an HTTPS
  tunnel. Embeddings, vector search, and AI capture remain deferred.
- `npm audit --omit=dev` reports five high transitive advisories under the
  current official `@forge/bridge` tree and two moderate Sequelize/UUID
  advisories; no forced major downgrade was applied to hide them.

## P0 review follow-up — 2026-10-07

User authorized P0 fixes and minimal environment configuration. Authority: final
spec sections 11, 17, 24–27; Slack capture contract's signature, acknowledgement,
workspace, and durable-context rules; review P0 findings accepted by the user.

- [x] Open modal before capture; acknowledge submissions before persistence.
- [x] Share input validation and keep invalid submissions editable.
- [x] Persist honest incomplete-capture metadata.
- [x] Clear detail state on navigation and separate candidate loading.
- [x] Isolate public Slack ingress from local synthetic-identity API.
- [x] Reduce environment template and local file to user-supplied integration values.
- [x] Run native checks and isolated API/database/browser proof.
- [ ] Live Slack/Jira rehearsal: pending user-supplied credentials.

Enforcement is local tests; no CI/hook/branch-protection changes authorized.

Validation completed: 23 native unit/HTTP tests, lint, TypeScript via production
build, PostgreSQL integration tests, and Playwright/Chrome desktop/mobile UI QA.
Signed synthetic Slack requests exercised shortcut → draft → save/retry → API
search/detail with real PostgreSQL in an isolated temporary database. Browser
proof covers failed lifecycle navigation, retry, and direct refresh. Slack-only
ingress rejects unsigned/wrong-workspace traffic and returns 404 for API paths.
Slow context requests time out and preserve the anchor with INCOMPLETE status.
Environment files retain only Slack bot token, signing secret, team ID, and the
optional Gemini key; fixed demo configuration lives in code.

No Browser skill/plugin is available; browser validation used the established
Playwright/Chrome fallback. Native tests enforce locally; no CI or optional hook
invocation found, and external branch protection remains unverified.
Real Slack delivery, actual Jira links, and the live capture-duration rehearsal
remain pending credentials. No queue or deployment infrastructure was added.

## P0/P1 completion follow-up — 2026-10-07

User authorized all remaining P0/P1 findings. Preserve the four-key environment
file and the bounded local-demo architecture. Accepted authority is the final
spec, Slack contract, and the user's acceptance of review priorities.

- [ ] Owner-name filters, source pagination/truncation fidelity.
- [ ] Form failure/reset, stale/duplicate AI results, scope prominence.
- [ ] Sanitized API logs, effective typecheck, consistent setup guidance.
- [ ] Isolation/rollback/lifecycle/search integration and browser regression proof.
- [ ] Real provider/Jira rehearsal remains dependent on supplied credentials.
