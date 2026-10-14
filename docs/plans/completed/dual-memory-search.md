# Execution Plan: Local and Gemini memory search

Date: 2026-10-13

## Status

Completed

## Outcome and authority

The owner requested both the existing local vector search and the former Gemini
AI search, chosen explicitly by the user. Apply channel, tag, owner, status,
scope and date filters before selecting Gemini's newest 200 decisions. The owner
accepts imperfect AI ranking and omissions when more matching decisions exist.
Keep stored decisions/evidence authoritative (final spec and decision 0002).

## Scope and approach

Add a separate Gemini ranking service using the existing SDK/model and compact
candidate format. Route the web request by explicit method, defaulting to local
for compatibility. Keep Slack recall and nudges on local search. Preserve all
filters, cached navigation, race protection and the prior demo fixes. Add two
search actions, provider/coverage disclosure, error handling, native proof, and
update product documentation.

## Risks and recovery

- Gemini sends the query and bounded decision excerpts to Google only after an
  explicit action. Disclose this beside the action; use synthetic QA fixtures.
- Never accept AI-invented IDs or return captured discussion in list payloads.
- Preserve existing changes/data. Use an isolated QA database, disable external
  Slack/Jira operations, and remove only owned test resources.
- No database migration or dependency change is needed. Revert only this task's
  diff to remove the optional Gemini path; local search remains available.

## Progress

- [x] Backend service, bounded/filter-first candidates, API selection and proof added.
- [x] Web choices, method-specific coverage/error states and browser proof added.
- [x] Documentation, required validation and resource cleanup.

## Validation

Unit/API tests for explicit dispatch, disabled configuration, invalid AI output,
candidate grounding, timeout/rate limit, empty candidates, and cap disclosure.
Real PostgreSQL proof for filters before the cap, workspace isolation and newest
200 ordering. Browser proof for local/Gemini actions, filters, coverage, navigation,
stale responses, errors, and desktop/mobile layouts. Native lint, typecheck,
test, build, integration, local-search and UI commands.

## Result

Implemented explicit local/Gemini actions with shared filters and provider-specific
coverage. Gemini receives only the newest 200 filtered compact cards; unknown,
duplicate and excluded IDs cannot become results. Local/Slack behavior and the
earlier four demo fixes remain intact. No dependency or database migration changed.

Observed local proof on 2026-10-13:

- Lint, typecheck, production build and git diff check passed.
- `npm test`: 91 tests passed, including Gemini errors/grounding and API dispatch.
- `npm run test:integration`: passed in isolated PostgreSQL. Real filters before
  the cap retrieve an older record; channel/tag/linked and recorded owner/status/
  scope/date and workspace isolation are verified. Provider calls were mocked.
- `npm run test:local-search`: passed real offline bilingual/no-match inference,
  durable indexing, filters/isolation, older-than-200 retrieval and HTTP search.
- `npm run test:ui`: final pass with Playwright/Chrome (Browser plugin unavailable),
  1280/1366/1440/1536px desktop and 390px mobile. Explicit choices, all filters,
  cap disclosure, cached return, failed-search cache reset, stale response,
  local fallback, console health and prior demo regressions passed. The Gemini
  error fixture intentionally emits HTTP 503. Screenshots in /private/tmp were
  inspected; no artifacts were committed.
- A live Gemini request with only two synthetic cards ranked the intended
  migration storage choice first for a Vietnamese query in 2.7 seconds. This
  does not establish large-input relevance or latency guarantees.
- Owned services stopped; fixture cleanup left the nine synthetic seed records
  before removing the QA database. The existing ten demo decisions were preserved.

Gemini requires configured credentials/network, may fail or misrank, and excludes
older matching records beyond its candidate cap. These limits are disclosed.
Validation is local; no CI, hooks or branch-protection configuration changed.
