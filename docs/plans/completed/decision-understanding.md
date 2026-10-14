# Execution Plan: Make decisions easier to understand and apply

Date: 2026-10-12

## Status

Completed

## Outcome and authority

The owner's request to make the app more interesting follows the reviewed
recommendation to build replacement reasons, comparison assistance and scope
overviews. Final spec US-06/07 and Applies To establish the existing evidence,
scope and lifecycle boundaries; this request authorizes these additions.

- Optional, human-written replacement reasons are retained on the relationship
  and visible from both participants. No inferred trigger is presented as fact.
- A comparison shows existing decisions, rationale, context, scope, alternatives
  and evidence. Similar Slack suggestions expose rationale and scope without
  claiming that similarity establishes conflict.
- An overview of an existing exact Applies To value shows active decisions and
  recent replacements. It reuses existing scope strings; no new taxonomy.
- Every read and mutation retains the authenticated workspace boundary.

## Scope and approach

Add an additive relation column and validate the optional reason on web/Slack
supersession. Build a reusable comparison surface and route, linked from the
library/detail/history. Add scoped overview API and responsive scope screens.
Update current product docs and native integration/browser proof.

## Risks and recovery

Preserve staged and unrelated semantic-search work. Existing relationships
remain valid with a null reason. Isolated synthetic database validation avoids
changing existing demo data. No external Slack/Jira messages are sent. New UI
uses existing shadcn components and design tokens.

## Progress

- [x] Replacement reason persistence, validation and Slack enrichment.
- [x] Comparison and lifecycle UI.
- [x] Scope overview API and UI.
- [x] Native checks and desktop/mobile verification.
- [x] Documentation, verified result and resource cleanup.

## Validation

Unit API/Slack checks, PostgreSQL integration proof (reason retention, scope and
workspace isolation), browser comparison/supersession/scope navigation and error
states. Run lint, types, build, tests and existing integration/UI workflows.
Use Playwright/Chrome: Browser plugin/skill is absent from this session.

## Result

Implemented the accepted three additions and updated the final spec, product
contract, UI guidance and README. New routes reuse current identity, exact scope
strings, stored records and evidence; the existing staged semantic-search work
was preserved.

Observed local proof on 2026-10-12:

- `npm test`: 85 passing tests, including optional/trimmed/bounded replacement
  reasons, scoped API identity and errors, richer Slack excerpts, retry reason
  retention, and invalid reason rejection before persistence.
- `npm run test:integration` against isolated PostgreSQL/pgvector on port 5436:
  passed. Reasons are retained on both relationship sides. Scope counts/history
  are workspace-isolated, active-only, and preserve moves into another scope.
  Existing Slack retry, lifecycle concurrency, Jira and retrieval proof passes.
- `npm run test:ui`: passed with Playwright/Chrome because the Browser plugin
  skill is unavailable. Tested 1440x1000/1536x1024 desktop and 390x844 mobile.
  Exercised the library comparison picker, real reason-writing supersession,
  reload persistence, comparison evidence, scope navigation and history,
  before/after links, no mobile overflow, and failed comparison/scope loads with
  retry. No framework overlays or unplanned console/page errors were observed.
- Lint, typecheck, build and `git diff --check`: passed on the final code.
- Screenshots in `/private/tmp/decision-memory-{comparison,evolution,scope}-*.png`
  were inspected. New forms and layouts use the existing component/style system.

The native local checks encode positive cases and rejected invalid/cross-workspace
cases. No hook or CI invocation was found in inspected paths; no external
validation settings were changed. Branch-protection enforcement is unverified.

No live external Slack delivery was attempted; signed HTTP fixtures validate the
new capture behavior. Comparison shows current stored record contents, not a
complete immutable edit audit. Scope history displays the latest 10 relationships;
the full library remains linked. Existing local startup applies the additive
schema automatically.

Validation used synthetic state in a separate Compose project/database. Browser
fixtures and owned app/DB resources were cleaned up; the existing PostgreSQL
volume and credentials remain untouched.

Reusable friction: the shadcn CLI's registry read initially needed sandbox
network access; the retry succeeded without installing or modifying components.
The formatter is scoped to apps/web, so its local binary was used. No Harness
changes were made.
