# Everyday project memory

Owner-authorized 2026-10-29. Builds on the existing retrieval, capture, Scopes,
pending completion and replacement models. The current application has a
workspace visibility boundary, not project/channel ACLs or private decisions.

## Current applicable answers

Web keyword and semantic search keep their current filters and ranking. Search
next steps offer **Record unanswered question** and the existing proposal review.
**Current answer candidates and evidence** loads on expansion: up to five search
records plus up to ten current replacements from stored lifecycle links. It
shows choice, exact scope, recorded rationale, owner, source excerpts and evidence
links together. Historical records remain labelled and link to current records,
including replacements that moved outside the selected scope. Missing scope,
rationale, evidence or current replacement is explicit. Multiple current records
may disagree; ranking never settles the disagreement. Scope selection narrows
search; no scope means applicability remains ambiguous. The existing proposal
review is available for a specific proposed action, with its existing explicit
Gemini disclosure and consent rules.

Private Slack Ask results use the same lifecycle hydration, distinguish current
and historical choices, and include exact scopes, rationale, owner, bounded source
excerpts and record links. Scope is unconfirmed in Slack; **Clarify scope in app**
retains the question in web search. **Record unanswered question** opens the normal
pending form. Existing local thresholds and explicit thread-summary consent remain.
No result means no recorded answer found, never approval. Search suggestions and
AI assessments are not confirmed decisions.

Presentation refinement (2026-10-29): loading and failed web searches show their
actual status before capture actions. A failed request has no result count;
query/scope remain available for Retry or manual question capture. Completed
matches expose current-answer evidence plus a **Record a question or check a
proposal** disclosure. Completed empty results offer question capture directly.
These changes do not change retrieval, automatic local fallback or Gemini consent.

## Paste and review capture

The existing New Decision form offers **Paste meeting notes or discussion**.
An origin label defaults to Meeting notes and remains editable. Up to twelve
distinct nonempty note lines are offered as candidates (500-character previews).
These are local text candidates, not inferred agreements. **Review candidate**
populates the normal editable Already decided choice. Review/correct the choice,
Why and scope, inspect related decisions, then explicitly **Save Decision**.
Manual capture and the existing only-primary-field requirement remain.

Saving attaches the complete supplied excerpt (up to 20,000 characters) as a
`PASTED_NOTES` source snapshot with a human-supplied origin label. The label does
not authenticate provenance, authorship or consensus. Detail, brief and answer
evidence distinguish pasted notes from captured Slack. The source is stored
independently of the originating application, remains after edits/completion,
and is workspace-visible. Source snapshots are not silently replaced by edits;
the editor can add related evidence links. Save one reviewed record at a time;
other note lines are not automatically saved. Existing sources contain the full
excerpt for later capture of another choice.

Notes and origin participate in the existing identity-scoped browser draft,
explicit restore/discard, failed-save and unavailable-search recovery. Related
lookup remains optional/local, with no automatic replacement. Use the existing
Supersede confirmation to deliberately replace an earlier decision after review.
No new external AI processing occurs. Existing explicit Gemini actions retain
their disclosure that stored decision/evidence excerpts may be sent to Google.

## Scope brief and handover

Scopes includes a **Project brief** before the complete current list. Only the
current linked decision owner can mark a decided active record important from its
detail page. Recorded-name-only or unassigned owners cannot curate until linked.
This selects it for all its recorded scopes; there is no separate project-owner
role. Changing its linked owner clears the old selection; superseded and pending
records never appear as important current choices. The existing shared editing
model still permits ownership reassignment; selection is checked against the
linked owner at mutation time, not a new administrative role.

The brief shows selected current choices, Why or explicit missing rationale,
exact scopes, supporting excerpts/links, immediate replacement history and reasons,
decision owners, and optional recorded **Owner contact context**. Contact context
is ordinary recorded text, not an identity match or a message action. Open questions
are separate, labelled not decided, with owner/contact context and record links.
The existing recent scope replacement history remains below. Every item leads to
its underlying record. Options Considered does not establish rejection. The brief
works without AI and does not invent missing rationale.

The polished brief groups owner/contact context and keeps supporting excerpts and
links in **Evidence and history**. Replacement reasons remain visible. In the full
current list, curated rows offer **Read in project brief** instead of repeating
their full explanation. This jump focuses the brief and preserves the route;
reduced-motion preferences are respected. Every title still opens its full record.

## Unanswered questions

From any insufficient web search, **Record unanswered question** retains the query
and exact selected scope in the Pending form. The title uses the existing
500-character limit; original query text is also retained in Context. Assign an
existing workspace owner using the existing picker; saving does not send them a
message. Follow the saved question explicitly to see its resolution. Slack's link
preserves the question; no scope is assumed.

Completion reuses **Record decision** and its existing conflict/retry behavior.
The original question remains title, final choice is outcome, and rationale,
source snapshots and related evidence links remain attached. Add evidence through
the existing editor before or after completion. The resulting answer is reusable
in keyword/semantic search. Pending questions remain excluded from confirmed
semantic/proposal evidence and are explicitly separate in answer context and briefs.
This creates no second task model, reminders or automatic assignments/follows.

## Personal follows and in-app changes

Policy explicitly approved by the owner on 2026-10-29:

- Follow/unfollow is explicit per authenticated user for a decision (including a
  pending question) or an exact existing scope. Assignment, creation, viewing and
  marking important never subscribe anyone. No external delivery is implemented.
- Visibility is the existing authenticated workspace. Foreign decision/scope
  targets return not found. Personal operations require a stable identity; the
  fallback `forge-user` cannot use them. Local demo sessions all share the
  configured local user, so they also share its follows/read state. Signed Forge
  identity supplies the user; request bodies cannot select a recipient.
- Events qualify for a new recorded choice, changed final choice/Why/exact scope
  set, a recorded replacement, or an answered pending question. Pending creation,
  pending edits, deadline/owner/contact/tag/reference/curation-only changes,
  unchanged saves and completion retries do not qualify. Scope order alone does
  not count. A replacement reaches followers of either record or either exact
  old/new scope. A record moving scope reaches both scope audiences.
- Events are inserted in the same transaction as the decision/source/lifecycle
  change. Event failure rolls the write back. Raw SQL maintenance/imports bypass
  this application service and do not produce notifications. There is no history
  backfill and no claim that this is a complete immutable edit audit.
- The feed selects events created after the current follow began, deduplicating
  overlapping follows. Unfollow immediately hides that target's items unless
  another active follow still matches. Refollow starts a new interval and does
  not reveal the missed events. Stored events remain workspace data.
- **Changes** shows the latest 100 matching event snapshots, previous/current
  choices and scopes, original question for resolution, recorded rationale or
  replacement reason (explicitly missing when absent), and underlying links.
  Snapshots may themselves become historical; open the record for today's state.
  Ordinary edits show recorded rationale, not an invented reason for the edit.
- Read state belongs only to that user. **Mark displayed changes read** marks
  only the displayed event IDs; later or concurrently committed events stay unread. The navigation
  count refreshes on focus, explicit follow/read actions and once per minute;
  Refresh changes reloads the feed. Failures retain available state and allow retry.

These rules do not provide channel-private Slack ACLs, tenant sharing, email,
Slack delivery, project roles or cross-provider identity linking. Use synthetic
data for validation; external coworker delivery still needs separate authorization.

## API and operation

Apply additive/idempotent `db/schema.sql` through normal local setup before using
the updated server. Existing records and snapshots are retained. Added decision
fields are `handoverImportant`, `ownerContact`; `memory_follows`, `memory_changes`
and personal `memory_change_reads` are additive. Browser drafts remain compatible.

- `POST /api/decisions/answer-context` takes up to five stored IDs and optional
  exact scope; all hydration uses authenticated workspace reads.
- `PUT /api/decisions/:id/important` takes `{ important }`, owner checked server-side.
- Existing create accepts optional `pastedSource: { excerpt, origin }`; edit rejects
  pasted-source replacement. Owner contact uses existing create/edit.
- `GET/PUT /api/follows` reads personal follows or writes `{ kind, target, following }`.
- `GET /api/notifications` returns items with personal read flags and asOf;
  `PUT /api/notifications/read` accepts up to 100 displayed IDs as `{ ids }` and
  only marks events visible through the user's current workspace/follows.

Proof belongs to native `npm test`, `npm run test:integration` and `npm run test:ui`,
including synthetic positive/negative access and mutation-failure checks. The
[coworker script](../presentation/study/everyday-project-memory.md) measures actual
task success, answer correctness, assistance and capture effort separately.
