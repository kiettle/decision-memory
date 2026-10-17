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

Under the [deadline workflow](decision-deadlines.md), current choices and scope
counts include only decided records. Pending scope links open the filtered
pending library, so a scope with only questions does not lead to a missing
recorded-choice overview. Comparisons preserve the question and show the final
choice separately; replacement candidates must be decided and active.

The **Scopes** navigation item opens a
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

## Scope convenience — 2026-10-16

Owner-approved web UX update: creation/editing uses a searchable multi-select
scope picker beside the main fields, outside More details. Scope remains optional.
Suggestions come from workspace metadata; explicit Add selects a new draft name
and Save persists it. New names are trimmed, exact duplicates are prevented, and
existing limits remain 200 characters per scope and 30 scopes per decision.
Scopes remain arrays throughout editing; commas are part of a name. No aliases,
case folding, scope merging, or schema migration is introduced.

Loaded scope overviews offer Check a proposal in this scope and New decision in
this scope. Both prefill an editable exact scope and focus the primary text input.
New decision keeps the Pending default; the proposal starts empty. Neither action
saves or invokes AI. Router state carries the scope and return origin. Cancel/Back
and post-save return navigation lead to the originating scope; proposal evidence,
comparison and recording paths preserve the draft and its scope-page origin.

## Related choices during web capture — 2026-10-16

New Pending and Already decided forms show related decisions automatically after
typing pauses (local only, since 2026-10-17; see
[automatic local discovery](memory-search.md#automatic-local-discovery--2026-10-17)),
and keep **Find related decisions** for retries. This is optional discovery through the existing memory-search
endpoint, not proposal review or an automatic conflict assessment. Matches show
stored choices, Why excerpts, scopes and current/superseded status. One exact
scope narrows retrieval; none or several use all scopes with visible explanation.
See [search controls and creation lookup](memory-search.md#search-controls-and-creation-lookup--2026-10-16)
for eligibility, coverage, stale-result, failure and draft-recovery behavior.
Edit forms and proposal-review behavior are unchanged.

## Copy a decision summary — 2026-10-17

Owner-approved: the detail page offers **Copy summary** for the currently loaded
record. Plain text includes its key, lifecycle status, stored choice (or pending
question), full recorded Why, exact scopes, and available source/reference URLs.
Missing rationale/scope is explicit; no interpretation or AI request is involved.
Pending questions say **not yet decided**; superseded records say **historical
choice** and include current/replacement keys when supplied by the record.
The copy action does not invent an application URL, including localhost links.

Success appears only after the browser clipboard write succeeds. Denied or
missing clipboard access opens a read-only, selectable summary for manual
copying. Copying is explicit, sends nothing to external applications and does
not modify the record. The text is a snapshot of the loaded record, not a live
reference that updates after sharing.

## Library discovery — 2026-10-17

Owner-approved: Flat rows and Kanban cards offer **Preview**, reusing the capture
preview sheet. Title links still open the full record. Preview fetches the full
record on opening and shows stored Why, exact scopes, lifecycle labels and
source/reference links; **Copy summary** uses that loaded record rather than a
list excerpt. **Back to results**, Escape or close retain the current library
results, filters and scroll; failure/retry leaves those results usable. Opening
or closing a preview never requests AI. The capture preview keeps its existing
Back to draft behavior.

Compare and Supersede selectors are searchable by displayed key and choice text,
using the existing searchable picker. Comparison still excludes the other
selected record, and supersession still offers only eligible active decided
records other than the current record. Selection alone does not mutate anything.

## Preview owner, deadline and current replacements — 2026-10-17

The shared library/draft preview shows the full record's owner and optional
deadline, using existing pending urgency/historical deadline semantics. Superseded
previews show all current replacement links from lifecycle.current, not just an
immediate historical successor. Missing current information is stated explicitly.
Links retain the same origin state as Open full decision. Closing preserves the
underlying library/draft and returns focus without AI calls or writes.
