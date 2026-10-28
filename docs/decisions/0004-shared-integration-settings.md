# 0004 Shared integration settings

Date: 2026-10-18

## Status

Accepted by the repository owner through the implementation plan and six
explicit choices in the conversation.

## Context

Users need to enter and change integration credentials in the Settings tab.
The current app has one local process, a synthetic local identity and a
separate public Slack ingress. Per-instance/group configuration is future work.

## Decision

Store the seven Slack, Gemini and Jira values in scoped PostgreSQL tables with
one global scope. Import the environment once, including empty initialization;
database values and explicit clears are authoritative afterward. Keep bootstrap
configuration outside the database. Every local app user may edit Settings.

Use replace-only secrets encrypted with AES-256-GCM and a separate private,
automatically generated `.local/settings.key`. Settings APIs never reveal saved
secrets and are unavailable outside the local demo and on the public ingress.
Apply committed changes to new requests immediately using immutable runtime
snapshots. Preserve in-progress operations, prevent stale edits, and make no
provider requests during saves.

This supersedes decision 0001 only for environment-based integration storage.
Its identity, workspace isolation and separate Slack ingress boundaries remain.

## Alternatives considered

1. Environment-only credentials: rejected because editing requires file access
   and restart rather than the requested UI.
2. Runtime/deployment settings in the DB: deferred because database access and
   decryption must work before reading settings.
3. Secret reveal, admin roles, restart-only reload and per-user overrides:
   declined or deferred by the owner for this version.

## Consequences

One shared configuration is easy to operate locally. The scope/value structure
permits later instance/group selection without implementing override precedence.
Recovery requires the original database and encryption key. Losing the key does
not permit silent regeneration. Multi-process refresh, production settings
administration, key rotation and per-instance isolation remain future work.

See [Integration settings](../product/integration-settings.md) for the API,
security boundary, recovery and verification contract.
