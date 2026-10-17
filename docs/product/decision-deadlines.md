# Decision deadlines and library views

Accepted by the owner on 2026-10-14 in the Flat and Kanban implementation plan.

Web creation defaults to Pending and requires only the question. Already decided
requires only the final choice; an original question is optional. Context, owner,
date, scope, alternatives, tags and references remain optional. Additional fields
are under More details. Slack and legacy clients continue capturing decided text.

`decisionState` is PENDING or DECIDED, independent of ACTIVE/SUPERSEDED replacement
status. Pending rows show their question; decided rows show outcome. Keep the
question in detail. Recording a decision requires a final choice and allows Why;
cancellation does nothing and failed saves retain input. Reopening is not v1.

`dueDate` is an optional YYYY-MM-DD calendar date. It can be past, edited or cleared.
Urgency uses each viewer's local date: before today is Overdue, today through +7
days is Due soon, after +7 is Upcoming, and absent is No deadline. Decided records
retain historical deadlines without urgency. Refresh at local midnight and focus.

Flat is the default. Kanban groups the same filtered records automatically into
Overdue, Due soon, Upcoming, No deadline and Decided. Date columns sort earliest
first; undated pending sorts newest first; Decided sorts by completion then creation
for legacy timestamps. Memory results keep relevance order. Decided initially
shows 10, with full count and Show more in increments of 10. Mobile board overflow
is contained. No dragging or scheduled messages in v1.

The Status filter in More filters offers All/Pending/Decided/Superseded. Deadline filters
use the browser's reference date. Preserve filters, view, sort and cached search
on navigation. Recent remains the newest five in Flat.

`PUT /api/decisions/:id/deadline` accepts only dueDate (null clears it).
`POST /api/decisions/:id/decide` accepts only outcome and optional why. Both preserve
unrelated fields, tags, links, sources and relations. Completion is atomic; identical
retries preserve decidedAt, differing repeats return conflict and offer editing.

Legacy records migrate to Decided with outcome copied from title and unknown
decidedAt left null. Reruns never rewrite edited data. Legacy writes retain the
meaning of title as the final choice. Pending records remain in ordinary search,
but cannot enter memory answers, current scope choices, or supersession. Guard
these rules on the server. Outcomes enter all recorded-choice consumers and indexing.

Native validation: npm test, npm run test:integration, npm run test:local-search,
npm run test:ui, lint, typecheck and build. Human usability remains unverified
without first-time observation of the four approved capture/find/complete tasks.

## Library convenience — 2026-10-16

Owner-approved web extension: Channel, Owner, Tag and Applies To filters are
searchable. Status, Deadline, Created date and Sort remain short menus. Selected
non-query filters appear as labeled removable chips, including outside the mobile
filter sheet. Removing a chip clears only that filter; Clear filters preserves
the query, view and sort while clearing all other filters.

The main library has four quick filters: Current choices sets Decided/All deadlines;
Pending sets Pending/All deadlines; Overdue and Due soon set Pending with the
matching deadline. Each action changes status and deadline together, retaining
other filters and query/view/sort. Selection is derived from current values,
including legacy ACTIVE URLs; reselecting the same shortcut does nothing.
Recent keeps its newest-five behavior without quick filters.

URL filters remain the source of truth. Filter changes invalidate memory results
and pending responses without starting AI. Metadata failure retains selected
values and offers Retry filter options. Existing pending/deadline memory-search
restrictions remain. Scope is now visible and optional outside More details;
other optional creation details remain collapsed.

## Saved views and capture recovery — 2026-10-16

Owner-approved follow-up: saved library views, actionable empty states, form
draft recovery, and visible optional rationale. These extend the existing
library convenience behavior without changing search providers or server writes.

The main library can save named views containing query, filters, sort and
Flat/Kanban layout. Views are stored only in this browser, separately for each
workspace and user. Applying one replaces those library inputs in the URL and
invalidates generated/cached memory results; it never invokes AI. AI output is
not saved with a view. Names are trimmed, nonempty and at most 80 characters;
duplicate names (case insensitive) and identical configurations are explained
without overwriting. Users can apply a view and delete it while keeping the
current filters. Recent retains its separate newest-five behavior.

Owner-approved extension (2026-10-17): a selected view remains selected while
query, filters, sort or layout change during the visit. Show **Unsaved changes**
and **Update view**; only an explicit update replaces that view's stored
configuration. **Save as new** creates a separate view and preserves the original.
**Rename view** changes only the name, preserving both its saved configuration
and any unsaved current inputs. Existing duplicate-name/configuration rules
apply to these operations, excluding the view itself. Storage failures keep the
old saved data and current inputs, with an error and retry available. Reload
recognizes an exact saved configuration; an unsaved selection association is
not persisted separately. The existing per-workspace/user browser schema is
unchanged, with no backend writes or synchronization.

Owner-approved discovery extension (2026-10-17): Owner includes **Unassigned**
(neither a linked user nor a recorded owner name). It composes with Pending,
other filters, Flat/Kanban, filter chips and saved views. Both library creation
buttons, including the empty state, prefill the exact selected Applies To scope.
The scope stays editable, Pending remains the default, and query/owner/status
filters do not become form values. Cancel/Back return to the originating library.

Empty Flat and Kanban results offer explicit recovery actions when applicable:
local meaning search, return to keyword results, remove the creation-date
filter, search all scopes, clear non-query filters, clear search text, or create
a decision. An empty library with no query/filters introduces capture instead.
Only the selected action changes search inputs; query/view/sort remain unless
that action explicitly changes them. Meaning search keeps existing eligibility
and configuration restrictions and runs only when selected.

Web new/edit forms preserve unfinished input in browser storage, scoped by
workspace, user and record (one new-record draft per user/workspace). This
includes exact scopes, raw tags/alternatives, references, dates and rationale.
Reloading or returning offers Restore draft or Discard draft before editing;
neither saves a server record. Explicit scoped/proposal entry is preserved until
the user chooses whether to replace it with the older draft. Leaving via Back
or Cancel keeps unfinished changes; the page discloses that they are kept here.
Discard resets to the form's original loaded/prefilled state. Successful save
removes that form's draft; failed save keeps it. New and existing record drafts
remain separate. Reverting all changes removes the recovery copy.

An edit draft records the original server updatedAt. If the record changed
before returning, restoration is blocked and all draft text remains available
to review/copy before discarding and editing the current record. This is a
recovery check, not a new concurrency contract for normal server writes.

Unreadable/damaged storage and failed writes/removals have visible feedback;
capture and ordinary search remain usable. Browser clearing removes these local
views/drafts; they do not sync between devices. Storage errors never imply a
successful view save or draft recovery guarantee.

Already-decided forms show Why? (optional) beside the final choice, outside
More details. Pending forms retain their optional Why inside More details.
The primary question/choice remains the only required field.

Proof: scripts/verify-library-workflow-ui.mjs is invoked by npm run test:ui,
covering view persistence and identity isolation, explicit empty-state actions,
full form recovery and failed saves, stale edits, storage failures and mobile
layout. First-time usability remains a separate observation task.

## Everyday library controls and Flat actions — 2026-10-16

Owner-approved: retain Current choices, Pending, Overdue and Due soon shortcuts,
and keep Applies To in the main controls. Channel, Owner, Tag, Status, Deadline
and **Created date** are grouped in the existing accessible **More filters** sheet
on desktop and mobile. Created date retains the creation-date semantics and
`dateRange` URL parameter. The More filters count is the number of active fields
inside that sheet (one per field, excluding query and Applies To). All active
non-query chips remain visible and removable outside it.

**Assigned to me** appears near the main-library quick filters. Its selected
state is derived only from `ownerId === metadata.currentUser.id`. Turning it on
sets that ID; turning it off clears ownerId to ALL without restoring another
owner. Query, other filters, view and sort stay intact. Owner selection, URL/view
restoration, chip removal and clearing filters keep it synchronized. Missing
identity disables only this shortcut with an explanation; recorded Slack names
are not inferred to be the current user. Recent has no main-library shortcuts
and remains the newest five records. No filter action invokes AI.

Pending Flat rows reuse **Record decision** and **Set deadline / Edit deadline**
from the board/detail dialogs. The title is an independently focusable detail
link; buttons are separate, compact secondary actions. Decided Flat rows do not
show pending controls. Cancellation writes nothing; failed writes preserve dialog
input and conflicts keep existing recovery. Success refreshes the current query,
filters and sorting, so completed Pending-only rows disappear and deadline
membership/order reflects the new value. Existing fields and evidence are
preserved by the existing narrow mutation APIs. Saving disables repeat submission.

Proof: native UI workflow covers Flat keyboard/link separation, cancellation,
failure retention, deadline edit/clear, completion refresh and preserved metadata,
alongside existing Kanban and detail action proof.

## Compact library — 2026-10-16

Owner-approved follow-up: reduce library toolbar spacing and use compact Flat
records across mobile, laptop and desktop widths. Each record keeps its status,
choice, key, tags, deadlines and pending actions. A bounded rationale excerpt
precedes wrapping scope/owner/created-date/channel/source metadata. Empty channel,
source and rationale placeholders are omitted from the list; full details retain
explicit missing-data explanations. Query, filters, layouts, sorting and action
semantics are unchanged. Clear filters is shown in the main toolbar when a
non-query filter is active; it remains available inside More filters.

Browser proof checks that the first title fits the initial 390×844 unfiltered
mobile viewport, short seeded desktop records remain compact, and all tested
widths fit without horizontal overflow. Arbitrarily long titles, expanded search
options, many filter chips or accessibility zoom may require more scrolling.

## Direct library metadata filters — 2026-10-17

Owner-approved: displayed Flat tags, linked owners, recorded owner names,
Unassigned, exact scopes and individual channels set their corresponding existing
URL filter. Linked owners use their ID, names use `name:<recorded name>`, and
Unassigned uses `UNASSIGNED`. Channel values match the Channel menu's canonical
stored value. Each displayed scope/channel has its own keyboard-operable control.
Kanban exposes this behavior only for metadata it already displays (Owner).

Selection changes only that filter, retaining query, other filters, layout and
sort. Selecting an active value is a no-op, including preservation of semantic
results; chips remain the explicit way to clear. An actual change uses normal
semantic/in-flight invalidation, never automatic local/Gemini search. Title links,
Preview and pending actions remain independent. Long metadata wraps on mobile.

## Review a pending completion — 2026-10-17

The shared completion dialog on Flat, Kanban and detail offers **Review this
choice** for an outcome containing at least three non-whitespace characters,
disabled during saving. Review opens the existing proposal page without checking
or writing. It passes the raw choice/rationale and pending identity in a navigation
snapshot; exactly one scope is prefilled, otherwise confirmation remains explicit.

Browser Back and **Back to completion / Return to completion** return to the
original dialog. Review edits never replace the original raw inputs. Return
snapshots are checked against current workspace/user and the exact record before
being displayed, and consumed after loading so failures can retry. Recovery is
independent of browser-local draft storage. A page-level host can restore the
dialog even if another actor completed the record or its Pending row disappeared.
The existing completion API remains the only submission path, including its
conflict error and editing link. Failed submission keeps inputs; cancellation
writes nothing. Dismissing or completing a restored dialog discards its forward
review history, preventing later navigation from reopening that completion.

## Decided detail actions — 2026-10-17

Owner-approved: detail pages offer **Record decision** and **Set deadline / Edit
deadline** only for pending records. Decided records keep and display any
historical deadline without an edit action, matching Flat rows and board cards.
