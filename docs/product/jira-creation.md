# Jira creation and retry recovery

Authority: final spec §18 and the owner's 2026-10-12 approval to fix duplicate
Jira issues after partial success in the app review.

The browser assigns a UUID `requestId` before sending a creation request and
keeps it, the original fields, and any known issue in session storage until
success. The same tab can reload or close/reopen the dialog and retry the same
operation. Pending fields are locked so a retry cannot change its meaning.

The API scopes the operation to the authenticated workspace and Decision and
rejects reuse with different fields. It claims the operation in PostgreSQL
before calling Jira. Concurrent requests with the same ID cannot both create.

- A known rejection that did not create an issue can be retried or corrected.
- A successful Jira response is stored before linking. The reference and
  completion state are committed together, so retries only finish local linking.
- If linking fails, return `JIRA_LINK_PENDING`, explain partial success, and
  include the known issue key/URL. The dialog exposes that link and Retry linking.
- If a timeout, server failure, or crash leaves creation unconfirmed, return
  `JIRA_OUTCOME_UNKNOWN` on retry and never automatically create again. Check
  Jira and attach an existing URL through Edit Decision. An unavailable receipt
  cannot be reconstructed automatically in this MVP.

This boundary applies to retries of the same operation. An independently started
creation is a new operation; do not clear browser state or start a separate
operation to work around an unresolved result. There is no claim of an atomic
transaction spanning Jira and PostgreSQL.

Apply the additive, idempotent `db/schema.sql` before running the updated API.
Proof lives in `apps/server/test/jira.test.js`, `scripts/verify-integration.mjs`,
and `scripts/visual-qa.mjs`.
