# Decision Memory — Product and feature guide

Updated: 2026-10-15. Read this to understand the app. Use the
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
Why and Applies To makes the record more useful later.

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
Search and filters are retained when you open a record and return.

| View | What it shows |
| --- | --- |
| Flat | A list of the filtered records |
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
| Search by memory | You remember the idea but not the wording | Uses a local multilingual model to find recorded choices, including across English/Vietnamese wording |
| Search with Gemini | You want optional AI-assisted ranking | Sends your query and excerpts from up to the newest 200 filtered decisions to Google |

Example memory query: “Hồi trước mình xử lý file migration lớn hay timeout như thế nào?”

Local memory search works offline after setup and needs no paid AI API. It
shows up to five matches and has no newest-200 limit. It can still miss relevant
records. New or edited records need indexing first; the app shows coverage, and
keyword search remains available immediately.

**Why it helps:** find the original choice even with an imperfect memory.

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

**Why it helps:** inspect the difference without switching between pages.
This view compares stored information; it does not use AI to declare a winner
or reconstruct every past edit.

### Explore a scope

**Scopes** groups records by their exact Applies To values. Open a service or
feature to see its current decisions, reasons, owners, evidence links, and
recent replacement history. You can also browse all its records in the library.

**Why it helps:** give a new teammate an overview of the choices for their area.

## 6. Feature spotlight: check a proposed decision

This connects a new idea to the team's recorded history.

1. Open **Check a proposal** and enter a short proposed choice.
2. Choose **Check locally** to find relevant records and current replacements.
3. Confirm the exact **Applies To** scope.
4. Optionally choose **Analyze with Gemini**. This sends the proposal, scope,
   and selected stored excerpts to Google.
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

Recorded status as of 2026-10-15:

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
