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

One visible Status filter offers All/Pending/Decided/Superseded. Deadline filters
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
