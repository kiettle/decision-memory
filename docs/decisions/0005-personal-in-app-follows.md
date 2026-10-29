# Personal in-app follows and owner-curated briefs

Date: 2026-10-29

Status: Accepted by the owner during the everyday project memory implementation.

## Decision

The owner explicitly approved personal follows for decisions and exact scopes,
limited to authenticated workspace visibility, with in-app delivery only. New
recorded choices, changed choice/Why/scope, replacements and answered questions
qualify. Following is explicit; assignment and viewing do not subscribe anyone.
Unfollow hides items immediately, and a later follow starts a new interval.
No external Slack/email notification delivery is authorized by this decision.

Only a decision's current linked owner may mark it important for the shared scope
brief. There is no project-owner role. Existing workspace-wide editing and
ownership reassignment remain; ownership transfer clears the prior selection.

## Identity and visibility

Use the existing signed Forge workspace/user context. Never accept recipients
from client request bodies or equate Slack names with Forge users. Personal
operations require stable user identity; the `forge-user` fallback is rejected.
Local demo sessions share the configured identity and its follows/read state.
Records, including captured evidence, retain existing workspace visibility;
this does not introduce Slack channel ACLs or private decisions.

## Consequences

Store meaningful change snapshots atomically in the existing save/completion/
replacement transactions. Query a personal feed against current follows and
their start times. This avoids an external queue or delivery system and handles
overlapping follows once. The feed is bounded to the latest 100 matching changes;
it is not an immutable audit of every edit or a history backfill. Raw SQL imports
do not generate application events.

The exact API, qualifying/noise rules, display, read state, failure recovery and
validation owner are in [the product contract](../product/everyday-project-memory.md).
This resolves the personal in-app subset previously deferred by
[ADR 0001](0001-demo-first-forge-remote-architecture.md); role-based audiences and
external delivery remain deferred.
