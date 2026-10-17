# Decision Memory — Product and feature guide

Updated: 2026-10-16. Read this to understand the app. Use the
[presenter guide](README.md) to turn the story into slides.

## 1. The idea in one sentence

**Before your team repeats a mistake, recover what it decided, why, and what changed.**

Decision Memory saves team decisions with their reasons and supporting discussion.
People can find them later, see which choice applies today, and check a new
proposal against that history.

## 2. The problem and the people

Important choices often happen in Slack. Months later, someone remembers the
result but cannot find the reason, the right channel, or the latest agreement.
The team may repeat a discussion or follow a choice that has already changed.

| Person | Typical question |
| --- | --- |
| Developer | “Why did we build it this way?” |
| Tech lead | “Does this new proposal conflict with something we already chose?” |
| PM | “What is still undecided, and when do we need an answer?” |
| QA | “Which behavior did the team agree on?” |
| New teammate | “What applies to this service today?” |

The intended benefits are easier onboarding, less repeated discussion, and
fewer mistakes caused by outdated guidance. **These benefits still need user
measurement; they are not proven savings yet.**

## 3. What a decision contains

Think of a decision as a short, reusable explanation.

| Field | Meaning | Example |
| --- | --- | --- |
| What | The choice the team made | Store migration backups in object storage |
| Why | The reason for the choice | Large files exhausted the database host |
| Applies To | The service, feature, or situation it belongs to | Atlas migration |
| Evidence | Saved discussion and source links | The Slack messages behind the agreement |
| Optional details | Context, options considered, owner, tags, and related work | Jira issue MIG-182 |

**Scope** means the value in **Applies To**. A choice for one service does not
automatically apply to another. **Superseded** means an earlier choice was
replaced; its record remains available.

Only the question or final choice is required when creating a record. Adding
Why and Applies To makes the record more useful later. The optional scope picker
is visible beside the main fields: search existing names, select several scopes,
or explicitly add a new one. Selected scopes can be removed individually. A name
containing a comma stays one scope.

When recording an already-decided choice, **Why? (optional)** is visible below
the choice. The remaining supporting details stay under **More details**.
Unfinished web forms are kept in this browser: return or reload to **Restore
draft**, or choose **Discard draft**. Saving successfully clears the draft;
failed saves keep it. Drafts belong to the current workspace/user and do not
sync across devices. A draft from an older edit stays copyable if the saved
record has changed, so it cannot silently replace newer work.

## 4. Features: save and organize

### Capture a choice from Slack

Select a message and choose **Save as Decision**. Review the form and save it.
The app keeps the selected message, supporting thread messages, author names,
channel, and source link.

The saved discussion remains readable in Decision Memory if the original Slack
history becomes unavailable. Capture is limited to the selected thread, up to
100 messages; incomplete or shortened capture is labeled.

You can also use `/decide <choice>` in a channel. In a thread, use
`@Decision Memory decide` and click the offered button.

**Why it helps:** record the agreement while its context is still available.
A person confirms every save.

### Get an optional AI draft

When Gemini is configured, Slack capture can fill in a draft of the choice,
reason, context, scope, and alternatives from the selected discussion. You can
edit it, or choose **Continue manually** without waiting for the draft.

This drafting step sends selected-thread text to Google when enabled. It is
different from proposal analysis, which requires a separate click. The current
demo uses synthetic or sanitized content. A failed draft leaves manual capture
available.

**Why it helps:** reduce typing while keeping the person responsible for the record.

### Track a question before the answer exists

In the web app, create a **Pending** question, such as “Where should we store
migration backups?” Add a **Decide by** date if useful. When the team agrees,
record the final choice and optional reason. The original question and evidence stay.

If the choice is already made, select **Already decided** when creating it.
Pending questions can appear in ordinary search, but are excluded from memory
answers and proposal-review evidence.

**Why it helps:** keep unanswered questions separate from confirmed guidance.

### Browse the library and deadlines

The **Decisions** page supports creating, editing, searching, filtering, and
opening records. Filters include status, scope, channel, owner, tags, and dates.
Search and filters are retained when you open a record and return. Flat records
use compact rows with wrapping metadata on mobile and desktop, so choices are
easier to scan. Missing channel/source fields do not take up separate list lines.

Search a decision key such as **DM-104** directly; capitalization does not matter.
The current filters still apply. **Preview** on a Flat row or Kanban card shows
the full Why, scopes and evidence links without leaving the results. You can
**Copy summary** inside that preview, or open the full record to read discussion.

Use **Save view** to name a reusable combination of search, filters, sort and
Flat/Kanban layout. Choose it from **Saved views** later. Views are kept for this
workspace/user in this browser; applying one does not rerun AI. When you adjust
a selected view, **Unsaved changes** appears. Choose **Update view** to keep those
changes, or **Save as new** to preserve the original and create another view.
The pencil button renames only the view; it does not save filter changes. The
trash button deletes the saved view without clearing the current filters.
If no records match, the empty state offers relevant actions such as removing
a date filter, searching all scopes or explicitly trying local meaning search.

Choose **Unassigned** in the Owner filter to find records with no linked user or
recorded owner name. Combine it with Pending and save that view for triage.
When the library is filtered to an Applies To scope, **New Decision** prefills
that scope; you can change it before saving.

On a decision's detail page, **Copy summary** copies its choice/question, Why,
scopes, status and available source links as plain text for pasting elsewhere.
Pending and superseded records are clearly labeled. This uses stored facts and
does not call AI or create a localhost link. If the browser blocks clipboard
access, a dialog offers the same text for manual copying.

Keep **Applies To** handy in the main controls. Open **More filters** for
Channel, Owner, Tag, Status, Deadline, and **Created date**. Its count includes
active filters inside that sheet, excluding search text and Applies To. Search
inside Channel, Owner, Tag, and Applies To menus instead of scrolling long lists. Use **Current choices**, **Pending**, **Overdue**, or **Due soon** shortcuts;
they keep your search and other filters. Active filter chips stay visible on mobile
and desktop. Remove one chip to clear that filter, or use **Clear filters** to keep
just the search, view, and sort.

Use **Assigned to me** beside the shortcuts to set Owner to your signed-in user.
Turn it off to clear Owner; it does not restore another owner you selected earlier.
Owner-menu changes, saved views and active chips keep this toggle in sync. If
identity is unavailable, the shortcut explains why and other filters remain usable.

| View | What it shows |
| --- | --- |
| Flat | A list of the filtered records; pending rows offer Record decision and Set/Edit deadline |
| Kanban | The same records grouped into Overdue, Due soon, Upcoming, No deadline, and Decided |
| Recent | The five newest records in a simple list |

**Due soon** means today through the next seven days, using the viewer's local
date. The board groups records automatically; it has no drag-and-drop workflow
or scheduled reminders.

**Why it helps:** see what needs a decision and what has already been settled.

## 5. Features: find and understand

### Find a decision in three ways

| Search | When to use it | How it works |
| --- | --- | --- |
| Keyword search | You remember a word, tag, or name | Searches stored text and metadata; includes pending questions |
| Find by meaning | You remember the idea but not the wording | Uses a local multilingual model to find recorded choices, including across English/Vietnamese wording |
| Search with Gemini | You want optional AI-assisted ranking | Sends your query and excerpts from up to the newest 200 filtered decisions to Google |

**Find by meaning** is the primary action beside the query. Keyword results update
as you type. When keywords find nothing, the library runs **Find by meaning**
locally by itself and labels the results as a fallback; if that also finds
nothing, the empty state says so. Open **Search options** for **Search with
Gemini**; read its Google sharing disclosure before selecting it. Gemini never
runs by itself. Semantic results identify the method and offer **Back to keyword results**.

Example memory query: “Hồi trước mình xử lý file migration lớn hay timeout như thế nào?”

Local memory search works offline after setup and needs no paid AI API. It
shows up to five matches and has no newest-200 limit. It can still miss relevant
records. New or edited records need indexing first; the app shows coverage, and
keyword search remains available immediately.

**Why it helps:** find the original choice even with an imperfect memory.

### Check related decisions before saving

On a new Pending or Already decided form, related decisions appear under the
question once you pause typing (at least three characters in the question or
final choice). This searches locally only; **Find related decisions** retries
it. One Applies To scope searches
that exact scope; zero searches all scopes. With several selected scopes,
**Search within** defaults to All scopes and can narrow lookup to one selected
scope without changing the draft.
Matches show recorded choices and stored Why excerpts; superseded choices are
labeled. Review indexing coverage and select **Preview** to read the full saved
reason, scopes and evidence links without leaving the form. Close it or choose
**Back to draft** to continue with all input and results intact. Preview failures
can be retried without changing the draft. Use **Open decision** or the preview's
**Open full decision** for the complete record and saved discussion; returning
from that page uses browser Back and **Restore draft**. Related results are not
saved and the search does not repeat automatically.

A match is a discovery aid, not a duplicate/conflict verdict. Empty results do
not approve a choice or prove none exists. Errors and unavailable local search
leave normal saving usable; saving never waits for related lookup.

For a new Already decided choice, **Review this choice** opens the existing
proposal review with the choice and single selected scope prefilled. Several
scopes require choosing one in review. Nothing analyzes automatically. **Back to
draft** restores all your original inputs, including optional details and raw
tags/alternatives, even when browser storage is unavailable. Changes typed on
the review page stay in review; return to your draft to edit or save the record.

### Ask from Slack and receive private nudges

Use **Ask Decision Memory** on a message, or `/why <question>`, to retrieve
stored choices privately in Slack.

In channels where the bot is invited, it also offers two simple nudges:

- **Already decided:** a question resembles a recorded choice. Only the asker
  sees the suggestion; **Share in thread** posts it only after a person clicks.
- **Save it?:** a thread sounds settled. Its author gets a private offer to
  capture the choice.

Slack capture can also show **Already decided?** matches before saving. A person
can inspect them and explicitly mark an earlier choice as replaced.

**Why it helps:** bring existing decisions back into the conversation. Nudges
are suggestions based on phrases and local search, not reliable understanding
of every message. Proposal analysis never runs automatically across a channel.

### Keep replacements and explain what changed

When a new choice replaces an old one, explicitly link them and optionally
record **What changed?** Both records retain that explanation. The older choice
is labeled superseded, and links lead to its replacement and current successor.

Example: “Use the database host temporarily” becomes “Use object storage”
because backup files grew too large.

**Why it helps:** explain both the old reasoning and the reason to change it.

### Compare two decisions

**Compare decisions** shows choices, reasons, context, scope, alternatives,
owners, status, and evidence links side by side. **Compare before and after**
opens a replacement pair directly, with its recorded change reason.

Search the Compare and Supersede pickers by decision key or choice text instead
of scrolling through all the records.

**Why it helps:** inspect the difference without switching between pages.
This view compares stored information; it does not use AI to declare a winner
or reconstruct every past edit.

### Explore a scope

**Scopes** groups records by their exact Applies To values. Open a service or
feature to see its current decisions, reasons, owners, evidence links, and
recent replacement history. You can also browse all its records in the library.

Start **Check a proposal in this scope** or **New decision in this scope** directly
from the overview. The scope is already selected and remains editable. A new
record still starts as a pending question. Back/Cancel returns to the scope, and
you still choose when to analyze or save.

**Why it helps:** give a new teammate an overview of the choices for their area.

## 6. Feature spotlight: check a proposed decision

This connects a new idea to the team's recorded history.

1. Open **Check a proposal** and enter a short proposed choice.
2. Choose **Check locally** to find relevant records and current replacements.
   A one-line headline summarizes the closest match, for example “A similar
   choice was replaced: DM-102 … was replaced by DM-104 …, which is current.”
3. Confirm the exact **Applies To** scope. After an all-scope check, the page
   suggests the scope most of the closest matches share.
4. Optionally choose **Analyze with Gemini** (or **Analyze with Gemini in
   &lt;suggested scope&gt;**, which confirms that scope in the same click). This
   sends the proposal, scope, and selected stored excerpts to Google.
5. Read the assessment and inspect its quoted evidence.
6. Revise your proposal if needed. **Record this choice** opens an editable
   creation form; saving is still a separate action.

The same review is implemented in Slack's private **Check proposed decision**
message shortcut. **Done** closes the modal without saving a decision.

| Assessment | Plain meaning | Example with an existing object-storage choice |
| --- | --- | --- |
| Possible mismatch | The proposal may disagree with a current choice in this scope | “Keep backup files on the database host” |
| Appears consistent | The proposal appears to align with the recorded choice | “Store backup files in object storage” |
| Insufficient evidence | The records do not establish an answer | “Keep backups for 45 days,” when retention was never decided |

These are illustrative outcomes, not guaranteed model responses.

Stored evidence is shown separately from AI findings. Historical choices are
labeled, pending questions are excluded, and another scope's replacement cannot
become guidance for the selected scope. An option listed under **Options
Considered** does not prove it was rejected.

If Gemini fails or times out, local evidence remains usable. No matching records
means insufficient evidence, not approval. Quotes are checked against the
selected records, but the AI can still interpret them incorrectly. The person
makes the decision; the app never saves or replaces one automatically.

**Why it helps:** consider relevant history before committing to a new choice.

## 7. Features: connect the choice to work

### Link related work or create a Jira issue

Attach Jira or other links to a decision. With Jira configured, create an issue
from the decision and keep its key under **Related Work**.

If the issue was created but its link was not saved, **Retry linking** completes
that step. If the outcome is unknown, check Jira before starting another attempt.

**Why it helps:** keep the implementation task connected to the reason behind it.

### Check configuration

**Settings** shows the workspace and whether Slack, local memory search, and
Gemini search are configured. It does not expose credentials. “Configured” does
not mean the installed integration has passed a live rehearsal.

## 8. What is ready today?

Recorded status as of 2026-10-16:

| Area | Status |
| --- | --- |
| Feature implementation | Available in the local app; Slack/Jira features need their integrations configured |
| Automated checks | 117/117 tests passed, plus lint, typecheck, build, database and desktop/mobile checks |
| Local memory search | Real offline multilingual retrieval verified |
| Latest synthetic proposal evaluation | 23/24 expected outcomes; one timeout, no incorrect completed verdict |
| Installed Slack and Jira workflows | Owner-operated rehearsal still pending |
| Real user benefit | Interviews and 5–8-person comparison study still pending |
| Shared production deployment | Outside this increment; current demo runs locally |

The 24-case evaluation used controlled retrieval. Twenty-two cases called
Gemini; two correctly stopped at local evidence checks. This is a small
synthetic evaluation, not a general accuracy score or proof of time saved.
See the [readiness evidence](readiness-validation.md) for the complete record.

## 9. Where to go next

- **Prepare slides:** [Presenter guide](README.md).
- **Practice the new Slack flow:** [Slack rehearsal handoff](slack-rehearsal-handoff.md).
- **Practice capture and replacement:** [Demo rehearsal](demo-runbook.md).
- **Prepare answers:** [Judge Q&A](judge-qa.md).
- **Measure user benefit:** [Study facilitator guide](study/facilitator.md).
- **Run the app:** [Quick start](../../README.md#quick-start).

Graphs, analytics, extra integrations, automatic decision changes, and shared
hosting are not part of this increment.

### Practical shortcuts in library and capture

Click a displayed tag, owner, scope or channel in a Flat record to set that exact
filter. Each scope/channel works separately. The Owner shown on Kanban cards is
also a shortcut. Linked owners, recorded names and Unassigned stay distinct.
Other inputs remain; use the filter chips to clear a selection. Clicking an
already-selected value does nothing and never starts AI.

Preview now includes the stored owner and optional deadline. Pending urgency
uses your local date; completed deadlines remain historical. A superseded
preview links every known current replacement, without presenting intermediate
history as current. Close or Escape returns to your results/draft and trigger.

With several draft scopes selected, use **Search within** to choose All scopes
or one exact selected scope for **Find related decisions**. This does not alter
the draft's Applies To values. Scope changes clear old results and reset the
lookup default; the new lookup scope is searched locally after a short pause.

When completing a pending record from Flat, Kanban or detail, enter a final
choice and optionally select **Review this choice**. Return with browser Back or
**Back to completion** to the same raw choice and rationale. Review edits do not
replace these inputs. Local checking and Gemini remain explicit; only **Record
decision** in the restored dialog completes the original record. A concurrent
completion reports the existing conflict rather than overwriting another choice.
