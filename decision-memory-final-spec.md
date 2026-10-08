# Decision Memory — Final Product & MVP Specification

**Version:** Final v1.0  
**Project:** DevSamurai Buildathon 2026  
**MVP build window:** ~3 weeks  
**Primary audience:** Codex / developers implementing the product  
**Primary capture surface:** Slack  
**Primary retrieval surface:** Web app  
**Future ecosystem:** Jira → Bitbucket/GitHub → Decision Graph  
**AI for local MVP testing:** Gemini API free tier with synthetic/sanitized data only

---

# 1. Product Vision

## 1.1 Product name

**Decision Memory**

### Working tagline

> **Capture decisions where they happen. Find them where they matter.**

Alternative:

> **Remember not only what your team decided, but why.**

---

# 2. Problem

Important decisions are often discussed in Slack threads, Jira issues, meetings, pull requests, or other work tools.

The team may remember the final implementation, but after 6–12 months people often forget:

- what problem the team was solving;
- what options were considered;
- why one option was chosen;
- who owned the decision;
- what feature/service/component the decision applied to;
- which Jira issue or PR implemented it;
- whether the decision is still valid;
- where the original discussion happened;
- what keyword to search for.

The original Slack discussion may also become difficult or impossible to retrieve because:

- users do not remember the exact keyword;
- the discussion happened in an unexpected channel;
- original participants changed teams or left;
- Slack history may no longer be available;
- the thread may be too long to review manually;
- many unrelated discussions may contain similar wording.

This causes:

- repeated discussions;
- slower onboarding;
- lost organizational knowledge;
- duplicated investigation;
- inconsistent implementation;
- unnecessary rework.

---

# 3. Core Product Idea

Decision Memory turns a temporary conversation into durable organizational knowledge.

The product should preserve:

```text
What was decided?
Why?
Where does it apply?
What evidence supports it?
What work is related?
What replaced it later?
```

A Decision is therefore not just a note.

A Decision is a structured knowledge object.

```text
Decision
Context
Applies To
Why
Options Considered
Owner
Team
Status
Source
Evidence
Related Jira
Related PR
Related Decisions
History
```

---

# 4. Product Principles

1. **Capture where decisions happen.**
2. **Preserve the reason, not only the outcome.**
3. **Do not depend on Slack for long-term retrieval.**
4. **Decision = What + Why + Where it applies + Evidence.**
5. **Connect decisions to actual work.**
6. **Track how decisions evolve over time.**
7. **Make capture very low friction.**
8. **Make retrieval easier than remembering exact keywords.**
9. **AI may assist extraction, but humans confirm truth.**
10. **Design data structures for future graph relationships, but do not build the graph in the MVP.**
11. **MVP reliability is more important than breadth.**

---

# 5. MVP Goal

The MVP must prove one complete loop:

> A team discusses something in Slack, makes a decision, saves it quickly, and another team member can find and understand that decision later even if they no longer remember the original Slack message.

## MVP success flow

```text
Slack discussion
    ↓
Save as Decision
    ↓
Short confirmation form
    ↓
Decision Memory stores durable context
    ↓
Decision Library
    ↓
Search / filter
    ↓
Open Decision
    ↓
Understand What + Why + Applies To
    ↓
Open source / Jira if available
```

## MVP product promise

Target UX:

- Save a Decision in **< 15 seconds**.
- Find a known Decision in **< 5 seconds** when the user remembers some relevant wording or metadata.

---

# 6. MVP Scope

## 6.1 Required MVP features

### Slack capture

1. Slack app integration.
2. Message shortcut: **Save as Decision**.
3. Slack modal.
4. Automatic Slack metadata capture.
5. Capture an anchor message.
6. Capture selected thread context.
7. Persist enough source context independently from Slack.
8. Save without opening the web app.
9. Success confirmation with link to the saved Decision.

### Web app

10. Decision Library.
11. Recent Decisions.
12. Keyword search.
13. Filters:
   - owner;
   - team;
   - tag;
   - status;
   - applies-to;
   - date range.
14. Decision detail page.
15. Manual Decision creation.
16. Edit Decision.
17. Open original Slack source when available.

### Decision lifecycle

18. Status:
   - `ACTIVE`;
   - `SUPERSEDED`.
19. One Decision may supersede another.
20. Superseded Decisions remain searchable.

### Related work

21. Decision may contain related external links.
22. MVP supports at least:
   - Jira URL;
   - generic URL.
23. Related work is visible on the Decision detail page.

### Durable source context

24. Preserve the selected source context even if Slack history disappears later.

---

# 7. Stretch Goal — AI-Assisted Slack Extraction

AI is useful when a Slack thread is long.

It is a **stretch goal**, not a hard MVP dependency.

## 7.1 Intended flow

```text
Slack Thread
      ↓
Fetch relevant thread content
      ↓
AI analyzes thread
      ↓
Draft:
- Decision
- Context
- Applies To
- Why
- Options Considered
- Relevant Messages
- Confidence
      ↓
Human Review
      ↓
Confirm & Save
```

## 7.2 AI rule

> AI extracts knowledge. Human confirms truth.

AI must never silently create an authoritative Decision.

## 7.3 Approved Buildathon extension — Search by memory

The competition MVP includes one explicit AI-assisted retrieval action for the
case where a user remembers the idea but not the original words.

- Normal PostgreSQL keyword and metadata search remains the default.
- **Search by memory** runs only when the user explicitly requests it.
- Gemini ranks existing workspace-scoped Decision records and returns grounded
  Decision IDs with short match explanations.
- Every result opens the stored Decision and its evidence; AI output is never a
  new source of truth.
- The MVP may linearly rank at most 200 filtered Decisions. Embeddings and
  vector databases remain post-MVP scaling work.
- Gemini receives synthetic or explicitly sanitized content only.

## 7.4 AI output requirements

Preferred structured output:

```json
{
  "decision": "Use GCS for migration backup files",
  "context": "Large customer migration backups may reach tens of GB",
  "appliesTo": "Migration Service",
  "why": [
    "Avoid storing very large files in PostgreSQL",
    "Reduce pressure on database backup and storage"
  ],
  "optionsConsidered": [
    "PostgreSQL",
    "GCS"
  ],
  "relevantMessageIds": [
    "171223...",
    "171230..."
  ],
  "confidence": "high"
}
```

## 7.5 Important constraints

AI must:

- analyze chronology;
- distinguish proposal from final agreement;
- not assume the last message is the Decision;
- return source message IDs;
- be allowed to return `NO_CLEAR_DECISION`;
- be allowed to detect multiple possible Decisions.

Example:

```text
No clear final Decision found.

Options discussed:
- Kafka
- Pub/Sub

[Write Decision manually]
```

---

# 8. Thread Handling

## 8.1 Anchor message

The message selected by the user is the **anchor**.

The anchor is the strongest signal about what the user considers important.

## 8.2 Thread context

For a long thread:

```text
Anchor Message
    +
Relevant Thread Messages
    +
Optional Full Thread Snapshot
```

The Decision page should not dump the full raw thread by default.

Instead:

```text
Decision
Why
Context
Applies To
Relevant Messages
```

and optionally:

```text
[View captured discussion]
```

## 8.3 Source persistence strategy

At minimum store:

```text
Slack permalink
channel
thread timestamp
anchor message
selected/relevant messages
captured_at
```

For the Buildathon MVP, explicitly selecting **Save as Decision** stores up to
100 messages from that selected thread, capped at 4,000 characters per message.
The anchor is always included. The snapshot records total/captured counts and a
truncation flag. Production retention controls remain post-MVP work.

The product should be designed so that full-thread storage is optional.

---

# 9. Target Users

## Primary users

- Team Lead
- Tech Lead
- Product Manager
- Developer
- QA

## Future users

- Engineering Manager
- Designer
- HR/Ops
- Marketing
- Customer Success
- Cross-functional teams

## Core questions

```text
Why did we choose this?

What did we decide last time?

What feature/service did that Decision apply to?

Was this Decision replaced?

Which Jira issue implemented it?

Where was the original discussion?

What Decision explains this current architecture?
```

---

# 10. Decision Structure

A Decision should contain:

```text
Decision
Why
Context
Applies To
Options Considered
Owner
Team
Tags
Status
Source
Evidence
Related Work
Related Decisions
Created By
Created At
```

## Important concept: Applies To

`Applies To` disambiguates similar Decisions.

Bad:

```text
Use GCS for backup files
```

Better:

```text
Decision:
Use GCS for migration backup files

Applies To:
Migration Service

Context:
Customer migration backups may reach tens of GB
```

Another similar Decision can then exist safely:

```text
Decision:
Use GCS for generated test reports

Applies To:
Reporting Service
```

---

# 11. Core User Stories

# US-01 — Save Decision from Slack

**As a team member,**  
I want to save a Decision from Slack,  
so that the team does not lose the reasoning later.

## Flow

1. User opens Slack message actions.
2. User chooses **Save as Decision**.
3. Slack modal opens.
4. Available data is prefilled.
5. User reviews.
6. User saves.
7. Decision Memory stores Decision + durable source context.
8. Slack confirms success.

## Form fields

| Field | Required | Notes |
|---|---|---|
| Decision | Yes | One clear sentence |
| Why | No | Short reason |
| Context | No | Short background |
| Applies To | No | Service / feature / component |
| Owner | No | Person responsible |
| Team | No | Team |
| Tags | No | Multiple tags |
| Related Jira | No | Jira issue URL |
| Status | Automatic | `ACTIVE` |
| Slack source | Automatic | Permalink |
| Anchor message | Automatic | Selected message |
| Source context | Automatic | Persisted snapshot |
| Created by | Automatic | Slack user |
| Timestamp | Automatic | Current time |

## Acceptance criteria

- Only Decision is mandatory.
- User does not need to open web app.
- Slack source is captured automatically.
- Anchor message is stored.
- Durable context is stored.
- Decision remains understandable if Slack becomes unavailable.
- Slack retries do not create duplicates.

---

# US-02 — Create Decision manually

**As a user,**  
I want to create a Decision from the web,  
so that meetings or offline discussions can also be preserved.

## Acceptance criteria

- `New Decision` exists.
- Decision is required.
- Source is optional.
- Related links can be added.
- Defaults to `ACTIVE`.

Manual creation is secondary to in-context capture.

---

# US-03 — Browse recent Decisions

Show:

```text
Decision
Why preview
Applies To
Team
Owner
Tags
Status
Created date
Related source icons
```

Newest first.

---

# US-04 — Search old Decisions

Search at least:

```text
Decision
Why
Context
Applies To
Team
Owner
Tags
Source snapshot text
```

## Acceptance criteria

- case-insensitive;
- partial keyword match where practical;
- exact title not required;
- works together with filters;
- includes superseded Decisions unless filtered.

---

# US-05 — Filter Decisions

MVP filters:

```text
Owner
Team
Tag
Status
Applies To
Date Range
```

Filters may be combined.

---

# US-06 — Understand Decision without Slack

Example detail:

```text
DEC-0017
Use GCS for migration backup files

ACTIVE

Applies To
Migration Service

Decision
Use Google Cloud Storage for migration backup files.

Why
Large files may reach tens of GB and should not be stored
inside the primary PostgreSQL database.

Context
The team compared PostgreSQL and GCS for migration backup storage.

Relevant Discussion
6 messages captured

Sources
Slack — #migration
[Open original discussion]

Related Work
MIG-182
[Open Jira]

Owner
Migration Team

Tags
architecture
storage
migration
```

## Acceptance criteria

Decision page remains useful without Slack access.

---

# US-07 — Supersede old Decision

Example:

```text
DEC-0017
Use GCS for migration backups

      superseded by

DEC-0041
Use GCS archive tier for long-term backups
```

Rules:

- old Decision becomes `SUPERSEDED`;
- new Decision remains `ACTIVE`;
- both link to each other;
- old Decision remains searchable;
- history is never auto-deleted.

---

# US-08 — Attach related work

MVP:

```text
Related Work

Jira:
MIG-182

Other:
Architecture Doc
```

A Decision may contain zero or more references.

---

# 12. Decision Library UX

Decision Library should not be only a raw list.

It should be optimized for retrieval.

Example:

```text
---------------------------------------------------
Decision Memory

[ Search decisions...                      ]

Team ▼
Owner ▼
Tag ▼
Status ▼
Applies To ▼
Date ▼

---------------------------------------------------

ACTIVE

Use Cloud Run Jobs for migration

Applies To:
Migration Service

Why:
Large migrations may exceed HTTP timeouts.

Migration Team · architecture · cloud
Related: MIG-182
Oct 15, 2026

---------------------------------------------------

SUPERSEDED

Store backup files in PostgreSQL

Applies To:
Migration Service

Superseded by DEC-0017
Oct 03, 2026

---------------------------------------------------
```

---

# 13. Future Graph Vision

Graph is a post-MVP product direction.

## 13.1 Future node types

```text
Decision
Jira Issue
Slack Thread
Pull Request
Document
Team
Person
System
Component
```

## 13.2 Future edge types

```text
DISCUSSED_IN
RELATED_TO
IMPLEMENTED_BY
SUPERSEDES
DEPENDS_ON
OWNED_BY
AFFECTS
APPLIES_TO
```

## 13.3 Local Graph first

Open:

```text
DEC-0032
Use Cloud Run Jobs for migration
```

Show:

```text
                  PR #182
                    ↑
                    │ IMPLEMENTED_BY
                    │
Slack Thread → DEC-0032 → Jira MIG-128
                    │
                    │ SUPERSEDED_BY
                    ↓
                 DEC-0061
```

Local Graph is more useful than a huge global graph.

## 13.4 Global Graph later

A global Obsidian-like graph may be added for exploration.

Support:

- filter by team;
- filter by Applies To;
- filter by time;
- filter by relation;
- focus on node;
- depth limit.

Graph must communicate meaning, not just look visually impressive.

---

# 14. Domain Model

The MVP data model should remain simple but future-ready.

## Workspace

```text
id
name
slack_team_id nullable
created_at
updated_at
```

## User

```text
id
workspace_id
slack_user_id nullable
display_name
email nullable
avatar_url nullable
created_at
updated_at
```

## Decision

```text
id
workspace_id
public_id

title
reason nullable
context nullable
applies_to nullable

team nullable
status

owner_user_id nullable
created_by_user_id

created_at
updated_at
```

## ExternalReference

```text
id
workspace_id
decision_id

type
relationship

external_id nullable
title nullable
url
metadata_json nullable

created_at
```

### MVP types

```text
SLACK
JIRA
URL
```

### MVP relationships

```text
SOURCE
RELATED_WORK
```

Future:

```text
BITBUCKET_PR
GITHUB_PR
DOCUMENT
```

## SourceSnapshot

```text
id
workspace_id
decision_id

provider
channel_id nullable
channel_name nullable
thread_id nullable
anchor_message_id nullable

anchor_message_text nullable
captured_messages_json nullable
captured_at

created_at
```

This separates structured Decision knowledge from raw source evidence.

## DecisionRelation

```text
id
workspace_id

from_decision_id
to_decision_id

type

created_at
```

### MVP relation

```text
SUPERSEDES
```

Future:

```text
RELATED_TO
DEPENDS_ON
CONFLICTS_WITH
DERIVED_FROM
```

## Tag

```text
id
workspace_id
name
created_at
```

## DecisionTag

```text
decision_id
tag_id
```

---

# 15. Search Design

## MVP

Do not use:

```text
Elasticsearch
OpenSearch
Vector DB
```

Use PostgreSQL.

Search:

```text
title
reason
context
applies_to
team
owner
tags
captured source text
```

## Approximate ranking

1. Decision/title.
2. Applies To.
3. Tags.
4. Why.
5. Context.
6. Team/owner.

Exact ranking quality is not critical for Buildathon.

## Explicit memory search

An explicit **Search by memory** action may send compact representations of up
to 200 filtered Decisions to Gemini for semantic ranking. Results must contain
only validated Decision IDs from the candidate set, include no more than five
matches, and explain why each stored Decision may match what the user
remembers. Missing configuration, timeout, or invalid AI output must leave
normal PostgreSQL search available.

---

# 16. Future Semantic Retrieval Scale

Problem:

User may remember:

> “Hồi trước mình xử lý vụ migration file lớn bị timeout sao ấy nhỉ?”

but not remember:

```text
Cloud Run Job
```

The approved MVP memory search can find:

```text
DEC-0032
Use Cloud Run Jobs for large migrations
```

Rule:

> Semantic/AI answers must always link back to actual Decision records.

Future scaling may add embeddings or vector retrieval when a workspace grows
beyond the MVP's bounded candidate set.

---

# 17. Slack Integration

## Primary action

```text
Save as Decision
```

## Flow

1. Verify Slack request.
2. Receive selected message.
3. Identify thread.
4. Resolve permalink.
5. Capture anchor message.
6. Capture thread context.
7. Open modal.
8. Save Decision.
9. Save SourceSnapshot.
10. Save Slack ExternalReference.
11. Return confirmation.

## Privacy principle

Do not ingest entire workspace history.

Capture only selected thread context.

Future workspace setting may support:

```text
Store relevant messages only
Store full selected thread snapshot
```

---

# 18. Jira Strategy

Jira is a major future integration.

## MVP

Allow related Jira URL.

Example:

```text
DEC-0017

Related Work
MIG-182
```

## Optional stretch MVP

Create Jira issue from Decision.

Flow:

```text
Decision
    ↓
Create Jira Issue
    ↓
Choose project
Choose issue type
Prefill summary
    ↓
Create
    ↓
Save Jira key/url
```

This is optional.

## Future Jira Marketplace App

Jira panel:

```text
MIG-182
Large migration backup

Decision Memory
────────────────────────

DEC-0017
Use GCS for migration backup files

Why
Large files may reach tens of GB.

[View Decision]
```

Future actions:

```text
Link Decision
Create Decision
Open Decision Memory
```

---

# 19. Future Bitbucket / GitHub Integration

Example:

```text
Decision
  ↓ IMPLEMENTED_BY
PR #918
```

PR UI may show:

```text
Related Decision

DEC-0017
Use GCS for migration backup files
```

Not MVP.

---

# 20. Decision Lifecycle

## MVP

```text
ACTIVE
SUPERSEDED
```

## Future

```text
ACTIVE
NEEDS_REVIEW
SUPERSEDED
DEPRECATED
```

Possible future fields:

```text
review_at
last_reviewed_at
review_interval
```

---

# 21. AI Strategy

AI-assisted capture remains optional for the MVP. Explicit AI-assisted memory
search is the one approved Buildathon extension.

Primary AI use case:

> Reduce friction when converting a long Slack thread into structured Decision knowledge.

## Recommended local test setup

Use Gemini API free tier only with:

- fake data;
- synthetic Slack threads;
- sanitized non-sensitive content.

Do not send confidential internal Slack content to a free external AI service unless company policy explicitly allows it.

## AI responsibilities

AI may draft:

```text
Decision
Context
Applies To
Why
Options Considered
Relevant Messages
Confidence
```

## AI must not

- auto-save authoritative Decisions;
- fabricate a clear Decision when none exists;
- silently infer sensitive/private facts;
- hide source evidence.

---

# 22. Security

Minimum MVP:

- verify Slack signatures;
- store OAuth tokens securely;
- never commit secrets;
- never log tokens;
- enforce workspace isolation;
- render user content safely;
- prevent cross-workspace references;
- store only necessary Slack context.

---

# 23. API Shape

Suggested:

```text
POST   /decisions
GET    /decisions
GET    /decisions/:id
PATCH  /decisions/:id

POST   /decisions/:id/relations
DELETE /decisions/:id/relations/:relationId

POST   /decisions/:id/references
DELETE /decisions/:id/references/:referenceId

GET    /tags
GET    /users

POST   /integrations/slack/interactions
POST   /integrations/slack/events
GET    /integrations/slack/oauth/callback
```

Search:

```text
GET /decisions?q=&owner=&team=&tag=&status=&appliesTo=&from=&to=
```

One backend is enough.

No microservices.

---

# 24. Business Rules

1. Every Decision belongs to one workspace.
2. Decision text is required.
3. New Decision defaults to `ACTIVE`.
4. Decision may have zero or more references.
5. Slack-created Decision should have a Slack source reference.
6. Slack-created Decision should persist enough source context.
7. `Applies To` is optional but strongly encouraged.
8. Superseded Decisions remain searchable.
9. `SUPERSEDES` is the only MVP Decision relation.
10. A Decision cannot supersede itself.
11. Cross-workspace relations are invalid.
12. No history is automatically deleted.
13. No AI-generated content becomes authoritative without user confirmation.
14. Search includes superseded Decisions by default.

---

# 25. Error Cases

## Slack unavailable later

Decision remains readable.

Show:

```text
Original Slack message is no longer available.
Captured context is shown below.
```

## No clear Decision in AI flow

Return:

```text
No clear final Decision found.
```

Do not invent one.

## Multiple Decisions detected

Allow:

```text
3 possible Decisions found

☑ Use GCS for backup files
☑ Keep metadata in PostgreSQL
☐ Delete backup after 7 days
```

User chooses.

## Duplicate Slack event

Do not create duplicate data.

## Invalid supersede

Reject:

- self-reference;
- missing Decision;
- cross-workspace relation;
- unsupported state transition.

---

# 26. Non-Functional Requirements

## Performance

Target:

- list: < 1s;
- keyword search: < 1s;
- Slack save: feels immediate.

## Maintainability

- keep provider integrations separate from core Decision logic;
- avoid premature abstraction;
- avoid microservices;
- avoid graph DB;
- avoid generic plugin architecture;
- test business rules.

---

# 27. MVP Acceptance Checklist

## Slack

- [ ] Save as Decision shortcut works.
- [ ] Modal opens.
- [ ] Only Decision is required.
- [ ] Slack source captured.
- [ ] Anchor message captured.
- [ ] Source context persists.
- [ ] Success response links to Decision.
- [ ] Slack retry is idempotent.

## Web

- [ ] Authentication works.
- [ ] Recent Decision list.
- [ ] Manual create.
- [ ] Edit.
- [ ] Detail page.
- [ ] Keyword search.
- [ ] Filter owner.
- [ ] Filter team.
- [ ] Filter tag.
- [ ] Filter status.
- [ ] Filter Applies To.
- [ ] Filter date.
- [ ] Open source.
- [ ] Decision understandable without Slack.
- [ ] Explicit Search by memory action.
- [ ] AI results contain only stored workspace Decisions.
- [ ] Normal search remains usable when Gemini is unavailable.

## Durable Slack discussion

- [ ] Store up to 100 messages from the selected thread.
- [ ] Always retain the selected anchor.
- [ ] Record total/captured counts and truncation state.
- [ ] Show a compact discussion by default with an explicit full-snapshot view.

## Related work

- [ ] Add Jira URL.
- [ ] Add generic URL.
- [ ] Show references.

## Lifecycle

- [ ] Supersede Decision.
- [ ] Old status becomes `SUPERSEDED`.
- [ ] Both link to each other.
- [ ] Old Decision remains searchable.

## Quality

- [ ] Workspace isolation.
- [ ] Empty states.
- [ ] Error states.
- [ ] Core tests.
- [ ] Demo dataset.
- [ ] Stable end-to-end demo.

---

# 28. Three-Week Delivery Plan

## Week 1 — Core Decision Memory

Build:

- setup;
- schema;
- auth;
- Decision CRUD;
- SourceSnapshot;
- ExternalReference;
- tags;
- Applies To;
- search;
- filters;
- detail page;
- supersede relation.

Milestone:

> Web app works independently from Slack.

## Week 2 — Slack Capture

Build:

- Slack setup;
- auth/config;
- signature verification;
- message shortcut;
- modal;
- permalink capture;
- anchor message;
- source snapshot;
- success response;
- idempotency.

Milestone:

> Real Slack Decision can be saved and found.

## Week 3 — Polish + Demo

Build:

- search polish;
- source unavailable behavior;
- Jira related link UX;
- lifecycle polish;
- tests;
- UI cleanup;
- deployment;
- demo dataset;
- demo recording;
- bug fixes.

### Stretch only if stable

```text
AI-assisted extraction
or
Create Jira Issue
```

Do not attempt both unless the MVP is already done.

---

# 29. Buildathon Demo Script

## Scene 1 — Problem

Show Slack discussion:

```text
Should migration backup files stay in PostgreSQL or GCS?

...
Let's use GCS. The files can become very large.
```

Explain:

> Important Decisions happen in chat, but six months later people may not remember the keyword, channel, or even have access to the old message.

## Scene 2 — Capture

```text
Save as Decision
```

Form:

```text
Decision
Use GCS for migration backup files

Applies To
Migration Service

Why
Large files should not be stored in PostgreSQL.

Related Jira
MIG-182
```

Save.

## Scene 3 — Durable Memory

Show Decision detail:

```text
Decision
Why
Applies To
Captured Context
Slack Source
Related Jira
```

Explain:

> Slack is where the Decision happened. Decision Memory is where the knowledge survives.

## Scene 4 — Retrieval

Search:

```text
migration storage
```

Open Decision.

## Scene 5 — Evolution

Show:

```text
DEC-0008
Store backup files in PostgreSQL

SUPERSEDED BY

DEC-0017
Use GCS for migration backup files
```

Final line:

> Decision Memory preserves what the team decided, why it was decided, where it applied, and how that Decision evolved.

---

# 30. Post-MVP Roadmap

## Phase 2 — Jira Marketplace integration

- Jira issue panel.
- Link Decision.
- Create Decision from Jira.
- Show related Decisions.
- Create Jira work from Decision.

## Phase 3 — Bitbucket / GitHub

- Link PR.
- Show related Decision.
- Connect implementation to reasoning.

## Phase 4 — Review Lifecycle

```text
NEEDS_REVIEW
DEPRECATED
review_at
```

## Phase 5 — AI-Assisted Capture

- extract Decision;
- summarize context;
- extract Applies To;
- extract Why;
- identify options;
- select relevant messages;
- support no-clear-decision;
- support multiple Decisions.

## Phase 6 — Semantic Retrieval

Natural-language search.

Example:

```text
Hồi trước vụ migration file lớn timeout xử lý sao?
```

## Phase 7 — Related / Conflicting Decisions

```text
Related Decision
Potential Conflict
Derived From
Depends On
```

## Phase 8 — Local Decision Graph

Example:

```text
                  PR #182
                    ↑
                    │
Slack Thread → DEC-0032 → Jira MIG-128
                    │
                    ↓
                 DEC-0061
```

## Phase 9 — Global Knowledge Graph

Future node types:

```text
Decision
Jira
Slack
PR
Document
Team
Person
System
Component
```

Goal:

> **A map of why the organization works the way it does.**

---

# 31. Things Codex Must Not Do

For MVP:

- Do not implement graph UI.
- Do not add Neo4j.
- Do not add vector DB.
- Do not add embeddings, a vector database, or an autonomous knowledge
  assistant beyond the approved bounded Search by memory action.
- Do not add full Jira Forge integration.
- Do not add Bitbucket/GitHub.
- Do not add microservices.
- Do not add Kafka/event bus.
- Do not ingest entire Slack workspace history.
- Do not create heavy ADR forms.
- Do not turn product into a wiki.
- Do not build generic provider/plugin frameworks.
- Do not over-normalize for imaginary future use.
- Do not sacrifice core Slack/search reliability for stretch features.
- Do not implement roadmap features unless explicitly requested.

Future-ready means:

> Keep current concepts extensible.

It does **not** mean:

> Build the future now.

---

# 32. Implementation Priority

When trade-offs happen:

1. Slack capture works reliably.
2. Decision survives without Slack.
3. Capture is low friction.
4. Search works.
5. Applies To makes similar Decisions distinguishable.
6. Decision detail clearly explains What + Why.
7. Jira related work is visible.
8. Supersede history is clear.
9. UI polish.
10. AI/Jira stretch.
11. Everything else.

---

# 33. Product Validation Questions

Ask real users:

1. Think of a Decision from 6–12 months ago. Can you still find why it was made?
2. Do you remember the exact original keyword?
3. What if the Slack history is gone?
4. How do you currently document Decisions?
5. Does the team consistently maintain that system?
6. Would you use `Save as Decision` if it took <15 seconds?
7. What is the minimum information needed later?
8. Does `Applies To` help distinguish similar Decisions?
9. Would linking Jira make the Decision more useful?
10. What would make this product annoying enough to stop using?

---

# 34. Definition of MVP Success

The MVP succeeds when a real user can:

1. participate in a normal Slack discussion;
2. save the final Decision quickly;
3. preserve enough context independently from Slack;
4. attach the correct scope through `Applies To`;
5. forget the exact channel/keyword;
6. later search and find the correct Decision;
7. distinguish it from similar Decisions for other services/features;
8. understand what was decided and why;
9. see related Jira work;
10. follow the newer Decision if the old one was superseded.

If this loop works well, the core product idea is validated.

Everything else comes later.
