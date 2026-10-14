# Decision Memory — Presenter guide

Updated: 2026-10-12. Start here when preparing the Buildathon submission.

**Prepare:** [Demo rehearsal](demo-runbook.md) · [Judge Q&A](judge-qa.md)

**Event format:** 60–90 second showcase video; finalists have a seven-minute
pitch/demo and five-minute Q&A. Submission closes at 23:59 on 2026-11-01.
The source for format, scoring and dates is
[BUILDATHON_CONTEXT.md](../../BUILDATHON_CONTEXT.md).

## The message to remember

> Find the decision your team confirmed, understand why it was made, and see
> what replaced it—even when you cannot find the original conversation.

**Target users:** developers, tech leads, PMs and QA working on teams where
important choices happen in Slack and get implemented through Jira.

**Pain:** people remember the implementation but lose its reasoning, scope and
history. They repeat discussions, struggle to onboard, or follow old guidance.

**Value:** a confirmed decision keeps its reason and evidence; a teammate can
find it by meaning, understand where it applies, and follow its evolution.

### Opening you can say aloud

“Imagine joining a service six months after a major change. You can see the
code, but you cannot find why the team chose that approach. The explanation is
somewhere in Slack, and you may not know its words or channel. Decision Memory
turns the team's confirmed choice into a durable record: what we decided, why,
where it applies, and what changed later.”

## What to show and why it matters

| Product behavior | User benefit | Visible proof |
| --- | --- | --- |
| Save as Decision in Slack | Capture during normal work | Review the form and save without opening the web app |
| Stored discussion and evidence | Understand reasoning without reopening Slack | Read the anchor and captured messages on the detail page |
| Keyword search + local Search by memory | Find a choice with partial wording or an imperfect memory | Search, open the original stored decision and its evidence |
| What changed? + supersession | Understand which guidance applies now and why it evolved | Old record remains visible; both records show the replacement reason |
| Compare before and after | Examine the reasons and scope of two choices together | Two recorded decisions and their evidence links appear side by side |
| Scope overviews | Understand a service's current choices | Active decisions and recent replacements appear for one Applies To value |

Keep Ask in Slack, private nudges, richer similar-decision suggestions and Jira
issue creation available for Q&A. Include them in the main recording only if
the core story remains clear within the time limit.

## The 90-second video

Use the synthetic migration-backup scenario in [the rehearsal](demo-runbook.md).
These are editing targets; rehearse actual interaction times before recording.

| Time | Show | Say |
| --- | --- | --- |
| 0–8 s | A Slack question about an earlier choice | “We remember what we built, but lose the reasons. Then we ask the same questions again.” |
| 8–28 s | Save as Decision, review and save | “Capture the agreed decision here, with its scope and evidence. A person confirms what is saved.” |
| 28–47 s | Find the record and read its captured discussion | “A teammate can find the decision later and read the discussion preserved with it.” |
| 47–69 s | Supersede the earlier choice, record What changed?, open comparison | “When circumstances change, keep the earlier choice and explain the replacement. See both reasons together.” |
| 69–82 s | Open the scope overview | “Someone joining the service sees what applies today and how the decisions evolved.” |
| 82–90 s | End on the current decision or scope | “Decision Memory keeps the team's choices, reasons and evolution available for the next person who needs them.” |

If this exceeds 90 seconds, prepare the replacement before recording and show
its reason and comparison directly. That is a recorded walkthrough; explain
capture/replacement timing separately if asked. Do not present edited timing as
a measured product speed.

The team must be able to demonstrate creation and replacement live during Q&A.

## The seven-minute pitch and demo

Six slides/screens are enough. The demo is the main proof.

| Time | Slide or screen | Talking points |
| --- | --- | --- |
| 0:00–0:45 | Problem and user | Use the opening above. Describe a developer/PM/QA needing an old decision's rationale. Include a real user example only after permission and sanitization. |
| 0:45–1:15 | Product promise | Explain What + Why + Applies To + Evidence. Capture happens in Slack; retrieval and understanding happen in the library. |
| 1:15–4:15 | Live demo | Capture a synthetic thread, find the record, read evidence, show an explicit replacement reason and comparison, then open the scope overview. Use the rehearsal's known state. |
| 4:15–5:15 | Value and difference | Explain repeated discussions, onboarding and outdated guidance. Point to human confirmation, durable evidence and decision evolution. Share measured pilot results if available. |
| 5:15–6:10 | Feasibility | One API, relational storage and a local multilingual model. Search inference needs no paid AI API; optional Gemini drafting is separate. Show the validation/limitations slide from the Q&A notes. |
| 6:10–7:00 | Next step and close | Describe a small team pilot and its success measures. Close with the product promise. Avoid promising a large unbuilt roadmap. |

### Transition lines

- Into capture: “Here is the point where an ordinary conversation becomes a
  decision the team can reuse.”
- Into evidence: “The stored record includes the discussion, so another person
  can inspect why this choice was made.”
- Into evolution: “A decision can be reasonable today and need replacement
  later. The reason for that change also needs to survive.”
- Into scopes: “Now imagine you are the next person joining this service. This
  page puts its current choices and their history together.”

## How this supports the judging criteria

| Final criterion | Points | What our presentation should establish |
| --- | --- | --- |
| Problem & User Value | 30 | Specific users and an example of lost reasoning; pilot evidence when collected |
| Product Thinking | 20 | One coherent flow from capture to later understanding and replacement |
| Execution & Demo | 20 | A rehearsed working flow with clear evidence and a recovery path |
| Feasibility & Technical Quality | 10 | Simple architecture, tested boundaries, and a credible next pilot |
| Creativity | 10 | Decisions retain human confirmation, scope, evidence and reasons for change |
| Presentation & Q&A | 10 | A concise story and accurate answers about the current implementation |

Preliminary judging uses the first three criteria for 70 points, with company
voting contributing 30. Final scores restart from zero. Show a familiar problem
that colleagues outside engineering can also recognize.

## Copy for the showcase board

**Project name:** Decision Memory

**Problem & Target User:** Developers, PMs and QA make important choices in Slack,
then lose the reason, scope or current version. Finding the implementation does
not necessarily explain the decision, which slows onboarding and repeats work.

**Solution:** Capture a human-confirmed decision from Slack with durable
evidence. Retrieve it through keyword or local multilingual memory search.
Preserve replacements and their reasons, compare choices, and explore a
service's current decisions and history.

**Demo video:** Add the final 60–90 second video link after recording.

**Prototype / Demo link:** Add a verified accessible link, if available. The
current localhost URL is for the presentation computer and is not a shared
company demo link.

**Team members:** Fill in the actual registered team.

## Evidence to collect before presenting impact

Ask 5–8 target users to capture a decision, find it using different wording,
explain its rationale and identify its latest replacement. Compare retrieval
with their usual approach on equivalent tasks.

| Measure | Fill with observed results |
| --- | --- |
| Participants and roles | Number of users, roles and test date |
| Capture time | Median and slow cases, including source retrieval and confirmation |
| Retrieval success | Correct decisions found / total attempts |
| Retrieval time | Median time in Decision Memory and in the usual workflow |
| Understanding | Users who correctly explained Why, Applies To and current replacement |
| Feedback | One permitted quote and one important failure or frustration |

No pilot results are currently recorded here. The original <15-second capture
and <5-second known-decision retrieval figures are UX targets, not measured
claims. Automated tests establish behavior; they do not establish time saved.

Use [Judge Q&A](judge-qa.md) for accurate technical and product answers, and
[Demo rehearsal](demo-runbook.md) for exact fields, setup and repeat-take steps.
