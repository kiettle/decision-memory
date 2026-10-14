# Decision understanding

Accepted by the owner on 2026-10-12 after the feature-priority review: preserve
why decisions change, help people compare recorded choices, and provide an
overview of current decisions for each existing Applies To value.

## Replacement reasons

Web supersession and Slack's Replaces picker accept an optional **What changed?**
explanation (up to 2,000 characters). It belongs to the replacement relationship,
not the new decision's ordinary Why. The relationship retains the trimmed
explanation and its existing creation timestamp. Old relationships remain valid
with no explanation. A missing reason is explicitly labeled as missing.

The detail page shows the reason from both records, alongside immediate and
current replacement links. A retried Slack save preserves the original reason
without adding or changing a replacement. Lifecycle mutations remain human
confirmed and subject to existing active/workspace rules.

## Comparison

**Compare decisions** is available in the library and on each detail page.
**Compare before and after** opens a related pair directly from its history or
scope overview. `/compare?left=<id>&right=<id>` compares two distinct decisions
from the authenticated workspace.

The page shows current stored titles, rationale, context, scope, alternatives,
owner, status, and links to saved evidence. Different wording is computed from
those stored fields; it is not an AI judgment of conflict or correctness. Scope
and alternative lists are compared irrespective of their order. A direct
replacement's reason is displayed verbatim. No unstated change trigger is
invented, and this is not an immutable audit of every edit to the records.

Slack's similar-decision suggestions show bounded rationale and scope excerpts.
Only the original compact identity/title/status data is placed in retry metadata
to avoid increasing Slack's metadata-size risk. The person can open a record
and use comparison before deciding whether to replace it.

## Scope overviews

The **Scopes** navigation item and **Explore scopes** library action open a
directory of exact existing Applies To values. A scope name in a decision or
comparison also links to its overview. No aliases or inferred scope groupings
are introduced.

An overview shows active decisions with reasons, context, owners, and links to
evidence. Its history displays the latest 10 replacements where either the
earlier or replacing decision belongs to that scope, including a move into a
different scope. Superseded replacements are labeled with their actual status.
The full filtered library remains accessible through **Browse all decisions**.

`GET /api/scopes` returns scoped counts. `GET /api/scopes/overview?scope=...`
returns scoped active records and replacement history. Unknown/foreign scopes
return 404; invalid scope queries return 400. Both inherit API authentication.

## Operation and proof

Run the additive, idempotent `db/schema.sql` before starting the updated API;
normal `npm run dev`/`npm run setup:local` applies it automatically.

Native proof: `npm test`, `npm run test:integration`, and `npm run test:ui`.
These cover bounded reasons, Slack retry preservation, scope isolation and
scope transitions, comparisons, reason persistence, desktop/mobile layouts,
and recoverable loading failures. No new external integration is required.
