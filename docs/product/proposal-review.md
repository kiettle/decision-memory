# Check a proposed decision

Accepted by the owner on 2026-10-15. Implementation and proof are tracked in
[the execution plan](../plans/active/proposal-review.md).

The user checks a short proposal against confirmed stored decisions before
committing to a choice. Retrieval is local by default. A separate **Analyze
with Gemini** action sends the proposal, selected scope and bounded relevant
stored excerpts to the configured Gemini account. Confirming an exact scope is
required for Gemini analysis. No automatic cloud analysis or channel scanning
is introduced. Synthetic/sanitized data is required for the current demo.

`POST /api/decisions/check-proposal` accepts `proposal` (trimmed, 3–500
characters), optional `appliesTo` (an exact scope, up to 200 characters), and
`method` (`LOCAL` by default or explicit `GEMINI`). It inherits API identity.
Web and the private Slack **Check proposed decision** message shortcut share
the same service and validation. No review history is persisted.

Retrieve up to five decided records using existing local retrieval, then
hydrate up to five distinct current successors using workspace-scoped reads.
Show historical status, exact scopes, recorded reasons, evidence and replacement
links. Disclose indexed/total coverage, omitted successors and excerpt limits.
Pending records never enter the evidence. Other-scope successors remain visible
as history but cannot provide guidance for the selected scope.

Stored evidence is separate from generated findings. Gemini may suggest
**Possible mismatch**, **Appears consistent**, or **Insufficient evidence**.
Every generated finding cites server-selected evidence and exact quoted text.
Non-abstaining findings must cite the current, decided, exact-scope recorded
choice itself, plus any rationale needed to establish the relationship. An
options list or missing parameter alone cannot support a verdict. An option's
presence does not mean rejection. Similarity alone
does not mean contradiction; changed circumstances may justify a new choice.
An empty or inconclusive search never establishes approval. Valid quotes do
not establish the correctness of the interpretation.

For current scoped evidence, the explicit action starts assessment and a
separate verification concurrently under one eight-second deadline. The verifier
does not see the assessment's conclusions. It classifies each current choice
as conflicting, aligned or unsettled, distinguishing an opposite action from
a changed applicability condition. Missing rationale alone does not erase an
explicit choice; no missing rationale is invented. An undecided aspect is not
a prohibition. Non-abstaining findings must have an outcome citation to a
current decision with the matching verification result, or they are downgraded
to insufficient evidence. Unknown, missing or duplicate verification IDs are
invalid output. Unused verification is cancelled when assessment abstains.
Both judgments use the same provider; this is not independent proof of truth.
A transient HTTP 503 may retry once per call after a short delay within that
same deadline (at most four provider attempts). Rate limits and invalid output
are not retried. Deadline expiry aborts both calls and preserves local results.

Missing configuration, timeout or invalid provider output preserves local
results and explains that analysis is unavailable. Stored records are rechecked
after inference; changed evidence invalidates analysis. Edits/navigation invalidate
pending UI results. Slack uses private modals with prompt acknowledgement and
version-checked updates; nothing is posted publicly by this feature.
Slack's required **Done** submit button dismisses the modal and cancels pending
result publication; it does not analyze or save a choice.

Users can open evidence, compare replacements, edit the proposal, and open the
existing web capture form with only their proposal and selected scope prefilled.
The form selects Already decided, adds no AI-written rationale, and saves only
on the person's explicit action. Ordinary new forms continue defaulting to Pending.
Evidence, comparison and saved-choice return controls restore the editable
proposal and confirmed scope, without automatically repeating analysis.

Proof: native unit/HTTP/Slack, integration, local-model and desktop/mobile UI
checks; a separate 24-case live model evaluation; deferred coworker interviews
and a 5–8-person comparative user study. Automated tests do not prove impact.
