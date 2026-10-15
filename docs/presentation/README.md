# Decision Memory — Presentation guide

Updated: 2026-10-15. Use this page to build your slides and speaking notes.
For an explanation of every feature, read the [product guide](product-guide.md).

## The message to remember

> Before your team repeats a mistake, recover what it decided, why, and what changed.

**Who:** developers, tech leads, PMs, QA, and new teammates.

**Problem:** decisions happen in Slack, but their reasons and replacements become
hard to find. People repeat discussions or follow outdated choices.

**Solution:** capture the agreed choice with evidence, find it later, follow its
replacement history, and review a new proposal against current decisions.

**Intended value:** easier onboarding and better-informed decisions. User testing
still needs to establish whether people make fewer mistakes or finish faster.

## Suggested slides for a seven-minute presentation

Use one main idea per slide. Put the short bullets on the slide; use the “Say”
line as your speaking notes. The demo gets the largest share of the time.

### Slide 1 — “Why are we discussing this again?” · 45 seconds

**Put on the slide:**

- The decision is buried in Slack.
- The reason is forgotten.
- An old choice looks like current guidance.

**Say:** “A new teammate proposes something reasonable. The team already tried
it and later changed direction—but the teammate cannot find that history.”

**Visual:** a simple Slack question: “Can we keep migration backups on the database host?”

### Slide 2 — A decision the team can reuse · 40 seconds

**Put on the slide:**

- What we decided.
- Why and where it applies.
- Evidence and what replaced it.

**Say:** “Decision Memory keeps the choice, its reason, its scope, and the
supporting discussion together. When the choice changes, the old record remains
and points to the replacement.”

**Visual:** one decision detail page with What, Why, Applies To, and evidence.

### Slide 3 — One connected workflow · 40 seconds

**Put on the slide:**

**Capture → Find → Understand changes → Check a proposal → Record the choice**

**Say:** “Capture starts in Slack or the web app. Later, search retrieves the
recorded choice. Comparisons explain changes. Proposal review helps a person
consider that history before saving a new choice.”

**Visual:** the five steps above. Keep Kanban, nudges, and Jira for a short
mention or Q&A so the main story stays clear.

### Slide 4 — Show the product · 3 minutes

**Put on the slide:** “A plausible proposal meets the team's decision history.”

**Show:** enter the backup proposal, retrieve locally, confirm scope, explicitly
analyze, inspect the current choice and replacement reason, then revise and
record the choice. Also show a consistent or insufficient-evidence example.

**Say:** “The app brings back the evidence. AI offers an assessment. The person
checks it and decides what to save.”

Use the [Slack handoff](slack-rehearsal-handoff.md) to prepare the synthetic
records and rehearse. Feature the new analysis flow in the main submission only
after installed rehearsal and the user-benefit check. Until then, demonstrate
local evidence, replacement history, and comparison using the
[capture rehearsal](demo-runbook.md).

### Slide 5 — What we have verified · 55 seconds

**Put on the slide:**

- 117 automated tests passed; database and desktop/mobile checks passed.
- Latest 24-case synthetic evaluation: 23 expected outcomes, one timeout.
- Installed rehearsal and user study: pending.

**Say:** “The implementation has technical proof. The small model evaluation is
encouraging, but it is not a general accuracy claim. We still need to observe
whether coworkers make better decisions or complete the tasks faster.”

**Visual:** separate “Verified” and “Still to measure” columns. After the study,
replace the pending line with observed results, including failures and assistance.

### Slide 6 — Practical today, focused next step · 1 minute

**Put on the slide:**

- One web app, one backend, one database.
- Local memory search; optional Gemini assistance.
- Next: validate with one team, fix observed problems, rehearse.

**Say:** “The local app already connects capture, reasoning, history, and review.
Our next step is to validate the benefit with real users. Before your team
repeats a mistake, recover what it decided, why, and what changed.”

**Visual:** Slack / web → backend → stored decisions; optional Gemini beside it.
Shared hosting is future work. Only show Slack/Jira as verified integrations
after a successful installed rehearsal.

## The 90-second demo story

Use synthetic data and one exact scope. These are timing targets for an edited
video, not measured task times. The [handoff](slack-rehearsal-handoff.md) gives
exact setup steps and expected evidence.

| Time | Show | Say |
| --- | --- | --- |
| 0–8 s | Proposal: “Keep migration backup files on the database host.” | “This sounds reasonable. But has the team already changed this decision?” |
| 8–20 s | Check locally; open the current object-storage choice | “The history shows that we moved backups off the database host.” |
| 20–38 s | Confirm scope; choose Analyze with Gemini; inspect citations | “The assessment points to a possible mismatch and shows the recorded evidence.” |
| 38–53 s | Compare the old and current choices, including What changed? | “Large backup files exhausted the host. That is why the choice changed.” |
| 53–68 s | Revise to object storage; open Record this choice and explicitly save | “The person reviews the evidence and records the choice.” |
| 68–80 s | Check a 45-day retention proposal where duration is undecided | “When the records do not settle a question, the answer is insufficient evidence.” |
| 80–90 s | Current choice and closing line | “Keep the team's choices, reasons, and changes available for the next decision.” |

If measured user results are available, use the closing seconds for one concrete
result with its participant/task count. Otherwise state that the pilot is
pending. Do not invent a time-saving claim.

If Gemini is unavailable, show local evidence and the comparison. Explain the
fallback; do not label that take a successful AI analysis. A separate capture
take can show how the evidence was saved from Slack. Manually entered fixtures
must not be presented as Slack-captured discussion.

## Copy for the showcase board

**Project name:** Decision Memory

**Problem & Target User:** Developers, PMs, QA, and new teammates need the reasons
behind earlier choices. Those reasons are often buried in Slack, and an old
decision may have been replaced without everyone knowing.

**Solution:** Save a human-confirmed decision with its evidence. Find it by words
or meaning, understand its scope and replacements, and check a new proposal
against the team's recorded choices before explicitly saving it.

**Demo video:** Add the final 60–90 second recording link.

**Prototype / Demo link:** Add a verified accessible link if available. The
current local app is not a shared demo site.

**Team members:** Add the registered name or names.

## Keep these claims accurate

| You can say | Do not claim yet |
| --- | --- |
| Local memory search works offline after setup | The entire product works offline |
| Proposal analysis checks citations against supplied records | AI proves a proposal is correct or catches every conflict |
| 23/24 expected outcomes on the latest synthetic set | 96% accuracy for real users or perfect reliability |
| The workflow is intended to reduce repeated discussion | Proven hours saved, mistakes prevented, or company-wide savings |
| The local implementation has automated and browser proof | All installed integrations or production deployment are verified |

The evaluation used controlled retrieval; 22 cases invoked Gemini and two
stopped at local evidence checks. One case timed out. Full results are in the
[readiness record](readiness-validation.md).

## Preparation links

| Need | Read |
| --- | --- |
| Understand all features | [Product guide](product-guide.md) |
| Answer judge questions | [Short Q&A](judge-qa.md) |
| Rehearse the new Slack shortcut | [Slack handoff](slack-rehearsal-handoff.md) |
| Rehearse capture and replacements | [Demo runbook](demo-runbook.md) |
| Run coworker sessions | [Facilitator guide](study/facilitator.md) and [task cards](study/participant-tasks.md) |
| Check exact test evidence | [Readiness record](readiness-validation.md) |

Per the repository's [event brief](../../BUILDATHON_CONTEXT.md), submission is
November 1 at 23:59; the video is 60–90 seconds. Finalists get seven minutes for
pitch/demo and five for Q&A. Value, product thinking, and execution/demo account
for 70 judging points. Build the presentation around a clear user problem and
one complete working story.
