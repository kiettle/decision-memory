# Shared integration settings

## Settings tab

The existing local **Settings** tab manages Slack's bot token, signing secret
and workspace ID; the Gemini API key; and Jira's site URL, account email and API
token. One global configuration applies to every user. Instance/group overrides
and admin roles are deferred. This is for the single-process local app.

Each section saves independently. Omitted fields stay unchanged; Clear queues
a deletion until Save. Undo restores the saved value before saving. Tokens and
signing secrets are replace-only: existing values never reach the browser.
Inputs stay only in React memory and are discarded after a successful save or
leaving/reloading Settings; they are not put in browser storage.

Configured means all required values are present, not that a provider accepted
them. Incomplete configurations may be saved and show which fields are missing.
Saving validates formatting without contacting Slack, Gemini or Jira. It does
not grant additional consent for any existing provider action.

## Authority and migration

The owner approved these choices on 2026-10-18. This supersedes the
environment-only integration configuration in architecture decision 0001.
`configuration_scopes` and `configuration_values` hold configuration separately
from decisions and user identities. Only the `global` scope is resolved today;
the API cannot choose or create a different scope.

`npm run dev` applies the additive schema. On first server startup, the seven
integration values in `.env`/the environment are imported once. Initialization
is recorded even if every value is empty. The original `.env` is preserved and
may still contain plaintext credentials; it is no longer the source of truth.
Later startup cannot overwrite UI edits or restore cleared values from it.

Database access, NODE_ENV, Forge authentication bootstrap, ports, app URLs,
identity and model choice remain outside these forms. Local search and normal
decision management need no integration credentials.

## Runtime and API

Saves use a locked scope revision and one database transaction. A stale revision
returns 409 `SETTINGS_CONFLICT`; discard edits and reload before trying again.
Failed saves keep the old values and runtime. New API/Slack requests use the
new immutable configuration and integration clients. Work already running keeps
its original clients, including asynchronous Slack work after acknowledgement.
Changing a signing secret or Slack workspace affects the next incoming request.
The local embedding model/indexer is retained across edits.

- GET `/api/settings/integrations`: revision, public field values, secret
  presence indicators, and configuration readiness for Slack/Gemini/Jira.
- PUT `/api/settings/integrations/:provider`: `{revision, changes}`; supported
  setting keys map to replacement strings or `null` for clearing. No other keys
  or cross-provider changes are accepted.

Settings are available only in development local-demo mode. Writes require
JSON and the configured UI Origin. All responses are `no-store`. The Slack-only
public listener has no settings/API routes. Anyone using the local app may edit;
do not expose its API listener publicly. No secret reveal or export endpoint exists.

## Encryption and recovery

Tokens, signing secrets and API keys use AES-256-GCM with fresh nonces and
authenticated field identity. Non-secret identifiers, email and site URL remain
readable in the database. The automatically generated 32-byte key is stored as
hex in ignored `.local/settings.key`, created exclusively with file mode 0600.
The key is never stored in the database.

Back up the database and key together. Restore both before starting the app.
If encrypted rows exist and the key is absent, invalid or incorrect, startup
fails with recovery instructions. A missing key is never regenerated over
encrypted settings, and there is no environment fallback. Existing keys with
broad permissions must be corrected with `chmod 600 .local/settings.key`.
There is no automatic key rotation or key-loss reset in this version.

Schema changes are additive. Rolling code back preserves the tables and key;
older code uses the preserved environment values, which may differ from UI edits.
Do not delete settings tables or the key as a rollback procedure.

## Validation

`npm test` covers validation, encryption, key handling, local-only routing,
redaction and immutable request snapshots. `npm run test:settings` uses a unique
temporary database schema and key to prove migration, persistence, conflicting
edits, clearing, rollback and key recovery; it leaves real credentials untouched.
Live synthetic evaluation tooling reads its Gemini credential from the local
database, but still requires its existing explicit `--live` opt-in.
