# Execution Plan: Check a proposed decision

Date: 2026-10-15

## Status

Active. Owner approved the competitive improvement plan and explicitly deferred
the two pre-implementation coworker interviews; use synthetic examples now.
Gemini reliability follow-up is implemented and evaluated. The owner selected
“Prepare the rehearsal handoff for later” on 2026-10-15. The installed-Slack handoff and coworker study package are prepared. The subsequent
owner-approved web convenience increment is implemented and validated. External
Slack rehearsal and human observations remain pending.

## Web convenience increment — 2026-10-16

Owner approved searchable scope selection, filter improvements, and scope-prefilled
navigation. Web only; quick filters preserve other restrictions; scope is visible
outside More details. Existing exact scope strings and API contracts remain.

- [x] Add reusable searchable pickers and array-based scope editing.
- [x] Add URL-backed quick filters, removable chips, and clear-filter behavior.
- [x] Add scope-prefilled actions and preserve return/draft navigation.
- [x] Extend native browser proof and run unit, lint, types, build, database/UI checks.
- [x] Update behavior contracts, product guide, and readiness evidence.

Authority: the owner's approved implementation plan in this chat. No new AI calls,
Slack changes, migration, or shared deployment. Use the existing isolated QA
runner and clean up only owned test resources. Browser plugin not available;
use native Playwright/Chrome verification.

## Outcome

A person checks a proposal locally, optionally requests disclosed Gemini
analysis for an exact scope, inspects cited stored evidence and current
replacements, and can revise and explicitly save a choice. Web and private
Slack use the same service. No automated decisions or public Slack replies.

## Context and authority

- Owner's approved plan in this chat, 2026-10-15.
- [Proposal review contract](../../product/proposal-review.md).
- Existing memory search, decision understanding and Slack capture contracts.
- `docs/WORKFLOW.md` and existing repository-native verification commands.

## Scope and approach

1. Record the accepted contract and synthetic examples.
2. Implement bounded retrieval, successor hydration, citation validation and
   explicit Gemini analysis with local-result fallback; add API and unit proof.
3. Add web review, safe form prefill and private Slack shortcut with race-safe
   updates and no persistence of analysis history.
4. Exercise real database/local inference and desktop/mobile browser flows.
5. Prepare 24-case model evaluation, user-study protocol and demo materials.

No new database schema, shared hosting, automatic channel scanning, graph,
analytics or new external integrations. Existing operations remain available.

## Risks and recovery

- Quoted evidence does not prove an AI interpretation: label analysis as a
  suggestion, validate citation membership/text and test model judgments separately.
- Scope/history confusion: only current, decided, exact-scope evidence can
  support a non-abstaining assessment; show other-scope successors as history.
- Edits during requests: discard stale UI/Slack results and revalidate stored
  evidence after inference. Preserve original input on failure.
- Test only owned isolated databases/processes. Never reset the demo database.
- Keep local results usable when Gemini fails. Remove optional entrypoints if
  rollback is needed; no data migration or analysis-history cleanup is required.

## Progress

- [x] Inspect existing services, lifecycle traversal, forms and Slack dispatch.
- [x] Owner deferred interviews and authorized synthetic examples.
- [x] Shared service, API and focused tests.
- [x] Web workflow and safe prefill.
- [x] Slack shortcut and signed HTTP tests.
- [x] Integration, real local search, browser and regression proof.
- [x] Evaluation and presentation kit.
- [x] Live model evaluation: three successive fresh 24-case sets; failures retained.
- [x] Improve analysis recall and availability; evaluate a fresh balanced set.
- [ ] Resolve remaining provider tail-latency risk through rehearsal/fallback before the main demo.
- [ ] Installed Slack rehearsal (owner-operated).
- [x] Prepare later-rehearsal handoff and paired coworker task cards/answer key.
- [ ] Coworker interviews and 5–8-person comparative study (owner follow-up).

## Validation

Native owners: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run test:integration`, `npm run test:local-search`, `npm run test:ui`.
Add focused proposal service/HTTP/Slack tests, real-database proof and browser
interaction proof. Provider fakes prove boundaries, not semantic accuracy.
Record the 24-case live evaluation separately from automated assertions.

## Decisions

- 2026-10-15: Existing local operation and explicit Gemini account are retained.
  The owner drives external Slack/Jira writes during installed rehearsal.
- 2026-10-15: Interviews may happen after implementation, by explicit owner reply.
  No user benefit, first-place result or installed-integration success is assumed.

## Result

Web convenience increment completed 2026-10-16: reusable searchable Base UI
pickers, exact array-based scopes outside More details, quick filters and removable
chips, and scope-prefilled creation/review with preserved origins. No backend,
Slack, schema or automatic AI changes. Browser testing caught React 18 ref
compatibility in the new chip container and shared input wrappers; both are fixed.
Extended browser proof covers real saves, commas, 200-character/30-scope limits,
keyboard input, URL/filter preservation, mobile nested menus, metadata retry and
stale responses. Existing tests were updated for explicit scope selection and
route cleanup waits for in-flight handlers before closing the browser context.

Validation: 117/117 unit/HTTP tests; lint, typecheck, build, native database
integration and complete desktop/mobile browser suite passed. Build has an
advisory for a 545.06 kB main chunk (175.46 kB gzip). Screenshots were inspected;
no clipping, page errors or framework overlay remained. The owned temporary
database and app processes were cleaned up. See the dated readiness evidence.


Presentation documentation follow-up, 2026-10-15: the owner requested simple,
complete feature explanations to use when building slides. Added a plain-language
[product guide](../../presentation/product-guide.md), rewrote the presenter guide
with six slide outlines and a 90-second proposal story, and shortened judge Q&A.
Descriptions follow the existing product contracts; no application behavior or
readiness gates changed. Installed rehearsal and human measurement remain pending.
Validation: relative file links and section anchors resolve; `git diff --check`
passed. This documentation-only update did not rerun application tests.

Later-rehearsal package: Slack bot authentication succeeded and matched the
configured workspace; existing Funnel routing targets the Slack-only port.
The app was stopped and the installed manifest/shortcut remain unverified.
The owner received a concrete rehearsal checklist and two seven-record study
sets, task cards, answer key and blank worksheet. All eight task prompts found
their expected current evidence through real offline retrieval in an owned
temporary database, which was removed. No user sessions, live Slack writes or
measured benefit are claimed. See the
[handoff](../../presentation/slack-rehearsal-handoff.md) and
[facilitator guide](../../presentation/study/facilitator.md).

Gemini reliability follow-up: concurrent independent classification replaces
sequential boolean verification, with a bounded 503 retry and unchanged
citation/scope/deadline safeguards. Known-failure regression matched 11/12
(one provider 503); the fresh frozen V4 set matched 23/24 (one timeout, no
incorrect completed verdict). V4 includes 22 provider-backed cases and two
local exclusions. All 117 native tests passed; lint, typecheck, build, database
and browser checks also passed. Full reports and limitations are preserved in
[readiness evidence](../../presentation/readiness-validation.md). Provider
latency, installed rehearsal and human benefit remain unproven demo gates.

### Previous implementation and verification

Follow-up review found two defects: Slack input modals lacked the required
submit button, and evidence links omitted the application's return state.
Owner authorized fixes. Added a dismiss-only Done action with cancellation,
return state for evidence/comparison/saved choices, and regression coverage.
Validation passed: 113 unit tests, lint, typecheck, production build, native
database integration and the full desktop/mobile browser suite. Browser proof
now covers evidence, comparison and post-save return controls; Slack HTTP
tests check required submit fields and dismiss-only cancellation. Installed
Slack rehearsal remains pending.

Implementation is available. Native unit tests passed 112/112; database,
offline local search and full desktop/mobile browser verification passed.
See [readiness evidence](../../presentation/readiness-validation.md) for checks
and preserved live evaluation results. The earlier V3 fresh set matched 16/24
expected labels: six genuine tensions were downgraded to insufficient evidence
and two requests timed out. No false mismatch was observed in that set; this
does not establish model reliability. The additional verification pass is
conservative and currently costs useful recall. Keep analysis out of the main
demo until this quality gap and the user-benefit gate are resolved.

Keep this plan active: installed Slack, two deferred interviews and the
comparative user study remain outstanding. No first-place or time-savings
claim is supported by the current evidence.
