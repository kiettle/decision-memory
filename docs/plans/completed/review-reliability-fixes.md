# Execution Plan: Review reliability fixes

Date: 2026-10-12

## Status

Completed

## Outcome and authority

The owner approved fixing the five findings in the preceding app review.
The final spec §5 requires low-friction capture, §7.3 bounds memory search to
200 candidates, and US-07 preserves replacement history. This task implements:

- Immediate replacements must not be mislabeled current; expose active successors.
- Retrying the same Jira operation must not create another issue. Preserve a
  known issue before linking; ambiguous external outcomes require reconciliation.
- Library query and filters survive opening and returning from a Decision.
- Optional AI cannot force the person to wait before manual confirmation; late
  results must not replace a manually opened or submitted form.
- Disclose partial memory searches without expanding the approved 200-card cap.

## Scope and approach

Use existing React, API, PostgreSQL, Slack and validation owners. Add an additive
Jira operation table for recovery across retries/restarts. Keep one operation ID
through a failed browser attempt. Retain automatic Slack AI with a manual bypass
and Slack view-hash concurrency protection. Preserve current candidate selection.
No deployment, private-channel policy, additional integrations, or user pilot.

## Risks and recovery

- Jira cannot atomically commit with PostgreSQL. Never automatically repeat an
  ambiguous create. Explain reconciliation and expose a known issue link.
- Slack updates race with manual capture; validate stale hashes and submission.
- Apply the idempotent schema to an isolated synthetic database. Stop only owned
  services; leave existing demo data and credentials untouched.

## Progress

- [x] Implement lifecycle, retrieval continuity, and search-bound disclosure.
- [x] Implement durable Jira retry and partial-success handling.
- [x] Implement Slack manual bypass without losing evidence or edits.
- [x] Add positive and regression cases to native unit/integration/browser checks.
- [x] Run checks, inspect rendered UI, update affected product documentation.

## Validation

Native owners: npm test, npm run test:integration, npm run test:ui, lint,
typecheck, build. Reproduce A → B → C, Jira partial success/concurrent retries,
navigation continuity, blocked AI/manual save, and >200 filtered candidates.
CI invocation and branch protection are not established by these local checks.

## Result

Implemented all five accepted review fixes. Native local proof on 2026-10-12:

- `npm test`: 82 passing tests. Blocked AI allows manual save; late updates are
  rejected through simulated Slack view hashes. Known Jira partial success
  recovers and uncertain outcomes return explicit errors rather than recreating.
- `npm run test:integration`: passed against isolated PostgreSQL 17. Verified
  A → B → C active resolution, receipt recovery with a recreated repository,
  concurrent duplicate rejection and single-reference linking, workspace scope,
  >200 filtered candidates and keyword access to an excluded older record.
- `npm run test:ui`: passed with Playwright/Chrome (Browser skill unavailable).
  Desktop 1536x1024/1440x1000 and mobile 390x844. Verified query/filter reload and
  return, memory return without another AI request, partial-search disclosure,
  lifecycle wording, and same Jira attempt/known issue after reload. Main flow
  has no console/page errors; the recovery fixture deliberately returns HTTP 503.
- Lint, typecheck, build, and `git diff --check`: passed.
- Reapplying the additive schema to the test database: passed.
- Screenshots under `/private/tmp/decision-memory-review-*.png` were inspected.
  Tightened the current-successor banner and removed loading flicker over AI
  results after visual inspection; reran UI and frontend checks successfully.

Enforcement: native local tests only. No checked-in hook or CI invocation was
found in inspected paths; no hooks/CI settings were installed or changed.
Branch protection remains unverified.

Live Slack/Gemini/Jira and real capture latency were not exercised. Jira can
still have an ambiguous external outcome; automatic recreation is blocked and
manual reconciliation is explicitly documented. The 200-candidate selection
remains the accepted MVP cap. Apply `npm run db:schema` to an existing local
installation before using the new Jira flow.

Validation friction: the disposable PostgreSQL health check briefly passed
against its initialization server, then schema setup hit the initialization
restart. Retrying after readiness succeeded. No Harness guidance was changed.

Only isolated synthetic state was used. Owned app processes and disposable
PostgreSQL resources are cleaned up at handback; credentials and existing demo
volumes are untouched.
