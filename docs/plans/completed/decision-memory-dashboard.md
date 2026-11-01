# Decision Memory Dashboard

Date: 2026-10-29

## Status

Completed

## Outcome

An actionable Dashboard tab with pending/overdue owner attention, most consulted
decisions, no-result/unhelpful searches, recorded documentation contributions,
and question/choice trends. Counts are consultation/documentation facts, never
employee performance, decision quality or business-impact measures.

## Authority and context

User request authorizes five charts, shared scope/period controls, drill-downs,
minimal local instrumentation, additive schema and synthetic validation.
AGENTS.md, docs/WORKFLOW.md; current deadline, search, pending/completion,
workspace identity/visibility and everyday-project-memory contracts apply.
Relevant owners: server repository/API/auth, web Library/detail/AppShell, native
integration and visual-qa scripts. The working tree started clean at 5ec47c4.

## Approach / progress

- [x] Inspect existing authority, creator/owner fields, deadline/search/capture
  rules, timestamps, navigation, frontend primitives and validation.
- [x] Resolve analytics audience, identity/view deduplication, search coverage,
  query retention and tracking activation. The owner accepted the three proposals
  below with the contest-readiness plan on 2026-11-01.
- [x] Record-based aggregation: current owner snapshot; creator counts; trends
  with explicit unknown historical provenance and record drill-downs (single day
  or inclusive day range for week bars).
- [x] Minimal view/search outcome collection with accepted policy, non-blocking
  failures, deduplication, retention and workspace boundaries.
- [x] Dashboard route/sidebar ("Team memory"), charts, scope/period URL controls,
  accessible record inspection, gap-to-question capture, loading/retry/empty and
  mobile layouts.
- [x] Native positive/negative tests and isolated desktop/mobile browser proof;
  required lint/typecheck/build/unit/integration/UI checks.
- [x] Product documentation: `docs/product/dashboard.md`.

## Decisions

- Current pending chart always includes older unresolved questions; only the
  scope and existing viewer-local deadline rules apply, never period creation dates.
- Creator attribution uses createdById joined inside the workspace, not owner or
  source author. Missing attribution stays unavailable. Local configured account
  attribution is not a claim of distinct human authorship.
- Historical records do not store initial pending/direct classification. Add
  explicit initial state for new writes only; do not infer it from title/outcome
  differences or timestamp proximity. Known recording dates with unknown paths
  remain separately labelled; missing dates are excluded and disclosed.
- Period charts use inclusive UTC calendar date bounds and labelled daily buckets;
  current pending deadlines use the viewer's existing local calendar date.
- Use existing design system and simple native charts with table/text equivalents;
  no chart dependency is installed today. Pending questions and search gaps lead.
- Browser plugin/skill absent; use the existing Playwright/Chrome proof owner.

## Increment 1 — record foundations

Implemented additive nullable `initial_decision_state`; new repository captures
set it to the actual initial state and edits/completions preserve it. Existing
data remains unknown. No analytics endpoint or collection is enabled yet.

Added internal SQL aggregation and paginated record inspection for owner
snapshots, creation-account contributions and UTC question/choice trends. Counts
and drill-downs share scope/owner/contributor/series predicates. The current
pending snapshot includes old unresolved questions outside the period. Linked
owners and recorded names remain separate even when labels match; cross-workspace
owner/creator joins disclose no foreign identity.

An unresolved record is known to have begun pending under the existing no-reopen
rule. Its creation date can be counted even when the new provenance field is
null. Already-decided records with null provenance have a separate unknown-path
series only if their recording timestamp is known. Missing dates are disclosed.

Proof: `verifyDashboardRecords` passed against disposable database
`decision_dashboard_20261029_01`, with synthetic workspaces cleaned in `finally`.
It is now called by the native integration command. Deadline boundaries,
creator/owner separation, scope/tenant isolation, every count/drill-down pairing,
direct/pending/unknown history and UTC date boundaries are covered. No normal
application database or coworker activity was used.

Increment validation: 146 tests in 19 suites passed; the full native integration
suite including Dashboard record proof passed; lint, typecheck, production build
and diff whitespace checks passed. The initial sandboxed unit invocation could
not bind HTTP ports (EPERM); the permissioned loopback rerun passed. Build retains
the existing 605 kB main-chunk warning. No frontend Dashboard flow exists yet,
so Dashboard browser validation has not been attempted. The disposable database
was dropped after proof; normal application resources were left running.

## Increment 2 — collection and screen (2026-11-01)

Additive schema:
- `workspaces.usage_tracking_enabled`, default false.
- `decision_view_events`, unique per decision, viewer hash and 30-minute bucket.
- `search_events`, with no person column.

API:
- `GET /dashboard` and `GET /dashboard/records`.
- `PUT /dashboard/tracking`.
- `DELETE /dashboard/searches`.
- `POST /usage/views` and `POST /usage/searches`, which answer 202 and record
  only while the switch is on.
- Metadata exposes `features.usageTracking`.

Web:
- The Team memory page.
- Best-effort view and search recording.
- **Not what I needed** feedback in the Library.

The synthetic seed:
- records direct-capture provenance and decided dates for the seeded choices;
- turns collection on for the demo workspace only;
- adds relative-date page opens and searches.

Proof:
- 147 unit tests.
- The integration suite, with the new usage proof: off by default, buckets,
  isolation, scoped gaps, deletion and 90-day purge.
- Lint, typecheck and the production build.
- The taste inspector at 0 FAIL.
- `scripts/verify-dashboard-ui.mjs` is added to `npm run test:ui`.

## Risks and recovery

Owner questions, accepted 2026-11-01 as proposed:

1. Workspace-wide contributor counts/query text for authenticated teammates,
   with an explicit workspace tracking switch on Dashboard, initially off;
   alternative is private contributor/query analytics. No lead/admin role exists.
2. Count successful foreground full-record-page opens once per decision/viewer
   in each fixed 30-minute UTC bucket; exclude preview/background/API/prefetch/
   failed loads. Signed Forge subjects may support unique viewers. Local demo
   uses an opaque browser-session token only for deduplication, never people counts.
3. Track completed explicitly submitted web Library keyword/local/Gemini searches
   and explicit Unhelpful feedback. Exclude keystrokes, automatic fallbacks,
   related lookup, proposal and Slack. Store exact query (max 500), exact selected
   scope, method/outcome for 90 days, without identity-linked search history or
   source discussion. Workspace teammates can delete search entries. Alternative
   is no stored query text and a different agreed search-gap workflow.

View-event retention still needs explicit confirmation alongside search retention.

Do not collect coworker activity during development. Use isolated synthetic
workspaces/database, blank provider credentials and mocks; leave normal resources
alone. Tracking must fail without blocking core read/search flows. Apply only
additive schema. Keep counts and drill-down predicates identical. Preserve drafts,
old records and lifecycle. No external analytics, real notifications or messages.

## Validation

Prove deadline boundaries, owner identity/name separation, creator != owner,
tenant isolation, accepted view deduplication, distinct no-result/unhelpful facts,
pending completion/direct capture and unknown historical dates, filter/drill-down
agreement, retention, and recoverable analytics failures. Run npm test,
npm run test:integration, npm run lint, npm run typecheck, npm run build and
npm run test:ui against owned synthetic resources. Inspect desktop/mobile and
keyboard/table equivalents, meaningful content, console, overlay and layout.

## Result

Complete (2026-11-01). Policies accepted with the contest-readiness plan; the
feature is implemented and validated.

Isolated browser proof ran against a disposable seeded database
`decision_ui_20261101_01` with blank integration credentials, then the database
was dropped and the owner's local app was restarted.

`npm run test:ui` needs two passes:
- On the Vite dev server: every check except `verifyUnreadRefreshUi`. It
  passed. `verifySharingViewsUi` imports `/src` modules, so it needs the dev
  server.
- On production assets (`vite preview` on 5173): `verifyUnreadRefreshUi` and
  `verifyDashboardUi`. Both passed. React StrictMode doubles the unread request
  in development, so the race test only holds on production assets, which
  matches the earlier recorded proof.

Updated browser tests:
- The Recent link left the nav, so tests use the `/recent` route.
- The row's keyboard order now runs title, then pending actions, then the tags.
- Opt-in `/api/usage/` facts are not counted as decision writes.

Earlier status (2026-10-29): incomplete. The three focused analytics policy questions remain unanswered:
workspace audience/activation, real viewer identity/view deduplication, and
search surfaces/query retention. Confirm retention for view events as well when
resolving the proposed 90-day search-event window. This is a product-authority
dependency under AGENTS.md and docs/WORKFLOW.md, not an automatic approval denial.
No analytics data collection, public analytics endpoints, Dashboard tab or
contributor/query exposure has been enabled. Continue with accepted policies,
tracking, the complete UI, remaining tests/browser proof and final product docs;
keep this plan active until all required scope and proof are complete.
