# Decision Memory — Judge Q&A

Updated: 2026-10-14. Answers describe the current local MVP. Use them as speaking
notes; do not turn proposed pilot outcomes into completed results.

## Product and value

**Who benefits first?**

Developers, tech leads, PMs and QA who need to understand an earlier choice or
join a service. A pilot should start with one team whose decisions regularly
happen in Slack and affect Jira work.

**What is the product's main difference?**

It preserves a human-confirmed decision with rationale, scope and durable
evidence. It also preserves replacements and their reasons, so retrieval leads
to a choice the team can understand and assess in its current context.

**Why would a team use it if it already has Slack search or a wiki?**

The team can capture from its conversation and retrieve a structured choice
with its supporting discussion and replacement history. Existing tools can be
useful; the pilot should test whether this workflow makes reasoning easier to
capture and find. Do not claim that other tools cannot search or cite messages.

**Does capture create extra work?**

Each save requires one text field. Web creation defaults to a Pending question;
Already decided requires the final choice instead. Recording a pending choice
preserves its question automatically. Owner, dates and additional metadata are
optional. Slack keeps its recorded-decision flow and supplies source metadata
and selected-thread context, with optional AI prefill. Why and Applies To improve
future usefulness. First-time observation and a pilot must establish whether
people understand the flow and whether the benefit justifies capture effort.

**What does Kanban add?**

It groups the same filtered library by deadline: Overdue, Due soon (today through
seven days ahead), Upcoming, No deadline, and Decided. Exact dates accompany
relative labels using each viewer's local calendar. Flat remains the default;
Recent remains the newest five in Flat. Completed choices retain historical
deadlines without overdue warnings. Dragging and scheduled reminders are deferred.

**Can an unanswered question appear as an already-made decision?**

Pending questions are available in ordinary search, but the server excludes
them from memory answers, current scope choices and supersession participants.
The final choice is stored separately from the original question.

**Does the product know which decision is correct?**

No automatic correctness judgment is made. People confirm the decision and
choose replacements. Comparison exposes stored facts and differing wording;
similarity is a retrieval signal. Evidence remains available for inspection.

**What do scope overviews add to filters?**

They bring active decisions and their reasons together with recent replacement
history for a service or feature. A filter still provides the full library.
The overview's value is helping someone understand the service's choices with
fewer separate record visits.

## AI, data and feasibility

**Where is AI used?**

Search by memory uses a cached local multilingual embedding model and
PostgreSQL/pgvector. It retrieves existing records and does not generate a new
answer as an authoritative decision. The optional Search with Gemini action
ranks the newest 200 decisions after metadata filters; the UI discloses when
older matching decisions were excluded. Optional Gemini drafting helps extract
fields from a selected Slack thread; a person must review and save the form.

**Is the whole product free and offline?**

Local memory search has no paid AI API dependency and its inference can work
offline after setup. The first setup downloads dependencies/model files. CPU,
storage and operation still have costs. Slack, Jira and optional Gemini search/drafting
need network access and their own accounts/configuration.

**Does internal conversation data leave the computer?**

Local memory search sends neither the query nor decision text to a hosted AI
service. Explicit Gemini search sends the query and bounded excerpts from up to
200 filtered decisions to Google. Optional Gemini capture drafting sends bounded selected-thread text
to Google when enabled, so the current demo uses synthetic or sanitized data.
Slack and Jira necessarily use their external APIs. Private-channel access,
retention and real deployment policy need definition before a company rollout.

**What happens when Slack history is unavailable?**

The decision's saved discussion is read from PostgreSQL. Capture retains up to
100 messages from the selected thread, with a 4,000-character cap per message
and an always-retained anchor. Incomplete or shortened capture is disclosed;
this is not a backup of the whole workspace or an unlimited thread archive.

**How reliable is memory search?**

It searches the local indexed workspace with metadata filters and can retrieve
across wording/languages. Retrieval is approximate and can miss a relevant
decision. Relevance scores are heuristic, not factual-confidence probabilities.
Pending indexing coverage is visible, and normal keyword search remains usable.
Local search has no newest-200 cutoff; optional Gemini search has that filtered
candidate limit and may misrank or omit relevant decisions. Million-record performance has
not been demonstrated.

**Can the comparison reconstruct every historic edit?**

It compares the current stored versions of the two decisions and displays the
reason recorded on their replacement relationship. It is not a complete
immutable audit log of every edit.

**Is it production-ready or a shared Jira app?**

The validated demo is local. Forge artifacts exist, but hosted rendering,
installation mapping and identity still need real deployment validation.
Localhost links open on the presentation computer. A shared pilot requires an
accessible authenticated deployment and accepted data/access policies.

**Why this architecture?**

One React web app, one Express API and PostgreSQL keep the capture/retrieval
loop understandable and testable. Local embeddings support retrieval without
a paid search provider. The team can explain each boundary without introducing
another service just for the demo.

## Evidence and next steps

**What has actually been verified?**

Use the dated [readiness record](readiness-validation.md) for the latest command
results, environment and gaps. The
[deadline validation record](../plans/completed/decision-deadline-views.md)
and [decision-understanding validation record](../plans/completed/decision-understanding.md)
preserve earlier feature proof. Local checks exercise:

- Unit/HTTP logic, lint, TypeScript and production build.
- Real PostgreSQL migration reruns, safe shortcut preservation, completion
  retries, workspace isolation, supersession, replacement reasons and scope history.
- Desktop/mobile capture, both views, deadlines, navigation, comparison,
  scope overviews, keyboard interaction and save/load-failure recovery.

The [local-search proof](../product/memory-search.md#validation-and-limits)
also describes real cached-model testing with outbound inference fetch blocked,
bilingual retrieval, stale-index handling and longer-content recall cases.

Current logic validation uses signed Slack fixtures and mocked outbound
Slack/Jira/Gemini services. The owner deferred the fresh live rehearsal and
recording. No first-time human usability observation has been completed.
Do not present a successful mocked test as proof that the installed external
integration is currently configured correctly.

**How much time does it save?**

That is not measured yet. Capture under 15 seconds and known-decision retrieval
under five seconds are original UX targets. Report actual pilot results when
collected, including failures and slow cases, rather than a projected percentage.

**What is the next practical step?**

Run a small pilot with one team. Measure capture effort, successful retrieval,
understanding of scope/replacements and whether people keep using it. Use the
results to decide whether review dates, notifications or another capture
surface deserve priority.

**Why not add more integrations immediately?**

The current flow already covers capturing a choice, understanding it later and
following its evolution. The next integration should be chosen from observed
user needs and usage, with evidence that it improves this workflow.

## Claims slide — copy for the deck

| Established locally | Still to establish |
| --- | --- |
| Human-confirmed capture and stored evidence | Fresh live rehearsal of all configured integrations |
| Local multilingual retrieval without paid inference calls | Pilot retrieval accuracy and time saved |
| Replacement reasons, comparison and scope overviews | Real capture/retrieval timing against UX targets |
| Flat/Kanban deadline grouping and single-field save behavior | First-time completion of the four tasks without coaching |
| Automated, integration and desktop/mobile browser checks | Authenticated shared deployment and production access/retention policies |

Refresh this slide from repository proof and actual rehearsal notes before
submission. Test counts and integration status can change as development continues.
