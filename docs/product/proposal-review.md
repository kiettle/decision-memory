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

## Scope selection convenience — 2026-10-16

The web scope selector is searchable and single-select, with existing workspace
scopes and All scopes · local retrieval only. It does not create new scopes.
Changing the selected scope invalidates pending assessments; typing into the
picker only filters its choices. Neither interaction invokes AI automatically.
A scope overview can open a blank proposal with that scope prefilled and editable.
Back to scope restores that overview; nested evidence/comparison/recording return
paths preserve the edited proposal, scope and original scope-page link. Metadata
retry must not clear the selected scope or proposal.

## Review an unfinished capture — 2026-10-17

Owner-approved: a new Already decided form offers **Review this choice** when
its choice has at least three non-whitespace characters. This opens the existing
proposal-review page with that text and, when exactly one scope is selected,
that editable scope. Zero or several scopes leave scope confirmation to the
person. Pending questions and edit forms retain their existing workflows.

Opening review does not analyze, save or replace anything. Local checking and
Gemini retain their separate explicit actions and disclosure. The original raw
form (including Why, context, exact scopes, owner, dates, tags, alternatives and
references) travels in navigation state with its workspace/user storage key.
Browser Back and **Back to draft** restore it; review-page edits never silently
replace original inputs. Evidence/comparison detours preserve the return state.
The returned snapshot is checked against the current identity and consumed from
the current history entry. Browser draft persistence remains available but is
not required for this round trip, including review reload and provider errors.
When launched from capture, the result's recording action is **Return to draft**;
the person edits and saves in the original form.

## Review a pending record's completion — 2026-10-17

Owner-approved: **Review this choice** in the existing Record decision dialog
opens this workflow with the typed outcome. Only a sole scope is prefilled.
Zero/multiple scopes retain explicit confirmation and the separate local/Gemini
actions and Google disclosure. Opening review invokes neither provider nor a save.
For this origin, result actions return to completion rather than create a record.

A workspace/user/record-bound navigation snapshot preserves the raw outcome,
rationale and originating Flat/Kanban/detail URL/state through Back, explicit
return, review reload, errors and evidence/comparison detours. Review edits remain
review-only. Explicit return uses the original router history entry when available;
restoration checks fresh identity/detail and consumes that entry's snapshot.
Failed loading retains it for retry. The ordinary completion endpoint handles
all writes, preserves original metadata/evidence and reports a concurrent
completion conflict without overwriting it. Cancelling/completing a restored
dialog removes forward review history so dismissed return data cannot resurrect
it. New-form review and standalone review retain their existing behavior.

## Local headline and suggested scope — 2026-10-17

Owner-approved: every result starts with a one-line headline computed in the
browser from the returned evidence, with no extra request. When the closest
retrieved match is superseded and its current replacement is known, it names
both keys and choices and says the replacement is current ("A similar choice
was replaced"). When the closest match is a current choice, it names that
choice. The headline describes retrieval order only; it is not an assessment,
and Gemini findings remain separate.

When the check ran on All scopes, the result suggests one existing scope:
scopes of the retrieved matches are weighted by rank (best match counts most),
ties keep the earlier match's scope, and only scopes present in the workspace
list are suggested. With Gemini configured the primary action is
**Analyze with Gemini in &lt;scope&gt;**: one explicit click confirms that exact
scope and runs the existing analysis, under the existing Google disclosure.
**Use &lt;scope&gt; locally** confirms the scope and re-runs only the local check.
Without Gemini only the local action appears. Nothing runs before a click.
