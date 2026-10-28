# Execution Plan: Shared integration settings

Date: 2026-10-18

## Status

Completed

## Outcome

The existing Settings tab edits the seven Slack, Gemini and Jira integration
variables in one global database scope. New operations use saved settings
immediately; in-flight operations keep their original configuration.

## Context and authority

The user approved the plan and explicitly chose: integration settings only,
local app users may edit, immediate application, one-time environment import,
replace-only secrets, and an automatically generated local encryption key.
See `docs/WORKFLOW.md`, architecture decision 0001 and the existing Settings page.
This decision supersedes environment-only integration configuration, but does
not change deployment/bootstrap configuration or the public Slack-only boundary.

## Scope

Seven existing integration keys; scoped database tables; encrypted secrets;
local settings API and forms; runtime refresh; configuration consumers; docs.
No roles, provider calls on save, secret reveal/export, per-user overrides,
deployment settings or automatic provider actions.

## Approach

1. Add idempotent schema and a settings store with encryption, import, validation
   and revision checks. Record accepted behavior in product/architecture docs.
2. Share immutable runtime snapshots between API and Slack listeners, rebuilding
   integration clients after transactional saves while preserving local search.
3. Add forms in Settings and update environment-dependent tooling.
4. Prove storage, security boundaries, reload behavior and browser interactions
   using synthetic isolated state, then run repository checks.

## Risks and recovery

- Back up the database and `.local/settings.key` together. Missing/wrong keys
  must cause an actionable startup failure, never silent regeneration/fallback.
- Keep `.env` intact; import only once, including empty initialization. Clearing
  a setting cannot restore it from the environment.
- Scope edits affect everyone. Optimistic revisions reject stale writes.
- Preserve pre-existing staged/unstaged work; schema is additive. Validation
  must not replace the real global credentials with fixtures.

## Progress

- [x] Storage and migration
- [x] Runtime and local API
- [x] Settings forms and tooling
- [x] Focused and database/browser proof
- [x] Repository checks and documentation

## Decisions

- 2026-10-18: All choices above are directly authorized by user answers and plan
  approval. Single-process local deployment; instance/group resolution deferred.

## Validation

Use server tests for encryption, validation, import, redaction and request
snapshots; isolated PostgreSQL for persistence/conflicts/recovery; real browser
for Settings interaction. Run tests, lint, typecheck, build and diff checks.

- `npm test`: 140 passed, zero failures or skips.
- `npm run test:settings`: real PostgreSQL in a unique owned schema; idempotent
  schema, encrypted one-time/empty import, persistence, conflicting saves,
  clearing, constructor-failure rollback, missing/wrong-key refusal and recovery.
- `npm run test:integration`: passed all existing PostgreSQL/Slack/lifecycle,
  search, deadline and Jira recovery checks. Updated its schema reader to expand
  the new SQL include, preserving the actual twice-applied migration proof.
- `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`: passed.
  Build reports a non-blocking >500 kB chunk warning; bundle splitting is outside
  this settings change.
- Browser plugin not available; used installed Playwright/Chrome with an owned
  Vite server at localhost:5183 and a database-backed API in the isolated schema.
  Desktop 1440x1000 and mobile 390x844 passed: route/title/nonblank/overlay/console,
  per-integration save, sibling draft retention, replace/clear/undo, validation,
  persistence, secret omission/storage absence, stale-revision rejection/reload,
  save/read failure recovery, and no horizontal overflow. Deliberate 400, 409
  and injected 500 responses were expected; no unexpected console/page errors.
  Screenshots: `/private/tmp/settings-desktop.png` and `settings-mobile.png`.
- Real local API is ready at 3011 with revision 1 after import; settings responses
  are no-store and contain no saved secret values; actual key mode is 0600;
  Slack-only listener returns 404 for Settings. No real settings were edited by
  fixtures. Temporary API/schema/key and Vite server were removed after proof.

## Result

The existing Settings tab edits one global set of the seven integration values.
Committed saves refresh all new API/Slack operations without recreating local
search. Existing credentials were imported once and the real local API/Slack
listeners are running. Existing staged/unstaged changes were preserved.

No live provider credential acceptance was tested or implied by Configured.
Production administration, distributed refresh, scopes/overrides, secret reveal,
key rotation and key-loss reset remain outside this version. Database and key
must be backed up together. Product contract and architecture decision 0004
record the accepted behavior and recovery requirements.
