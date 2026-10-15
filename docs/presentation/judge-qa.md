# Decision Memory — Short Q&A

Updated: 2026-10-15. Use these as speaking notes. See the
[product guide](product-guide.md) for all features and the
[readiness record](readiness-validation.md) for detailed proof.

## Product and value

**Who is this for?**

Developers, tech leads, PMs, QA, and new teammates who need to understand a past
choice or check what applies today. Start with one team that makes decisions in Slack.

**Why use it alongside Slack search or a wiki?**

It connects the confirmed choice, reason, scope, evidence, and replacement
history in one workflow. A new proposal can be checked against those records.
The pilot still needs to show whether this is more useful than the team's usual approach.

**Does recording decisions create extra work?**

A save requires only a question or final choice. Other fields are optional.
Slack capture preserves the discussion and can offer an editable AI draft.
User testing will show whether the benefit justifies the effort.

**What is the difference between a pending question and a decision?**

A pending question has no final choice yet. It can have a deadline and appear
on the board. Recording the answer preserves the original question. Pending
questions are excluded from memory answers and proposal-review evidence.

**Why do scope and replacement history matter?**

A decision for one service may not apply elsewhere. A choice that used to be
valid may have changed. The app shows where it applies, its current replacement,
and the recorded reason for that change.

**How much time does it save?**

We have not measured that yet. The planned 5–8-person study compares ordinary
memory search with proposal review on similar tasks. We will record correct
choices, scope understanding, time, assistance, and misleading warnings.

## AI and evidence

**Where is AI used?**

Local memory search finds stored choices by meaning. Optional Gemini features
rank search results, draft Slack capture fields, and assess proposals. People
review and save decisions themselves.

**Does AI decide whether a proposal is correct?**

No. It suggests possible mismatch, consistency, or insufficient evidence for
the selected scope. Quotes must match selected records, and a second Gemini
check can reject an unsupported verdict. Both checks can still be wrong.
The person inspects the evidence and decides.

**What if nothing matches, or Gemini fails?**

No match is not approval. Local evidence remains available if Gemini fails.
The person can try other wording, use keyword search, or continue reviewing
stored decisions manually.

**What data goes to Google?**

Local memory search sends no query or decision text to Google. Explicit Gemini
search and proposal analysis send the query/proposal and selected excerpts.
When AI capture drafting is configured, Slack capture sends selected-thread
text automatically. The current demo uses synthetic or sanitized content.

**Is everything offline?**

No. Local memory search works offline after its initial setup. Slack, Jira,
and Gemini need internet and configured accounts. Local search needs no paid
AI API, though operating the computer and storage still has a cost.

**What if Slack history disappears?**

The saved discussion remains in the app's database. Capture stores up to 100
messages from the selected thread and labels missing or shortened content.
It is not a backup of the entire Slack workspace.

## Readiness and limits

**What has been tested?**

The latest recorded run passed 117 automated tests, lint, typecheck, build,
database checks, and desktop/mobile browser checks. Real offline memory search
also passed. The latest synthetic proposal evaluation matched 23 of 24 expected
outcomes, with one timeout and no incorrect completed verdict.

**Does 23/24 mean 96% real-world accuracy?**

No. It was a small, balanced synthetic set with controlled retrieval. Twenty-two
cases invoked Gemini; two stopped at local evidence checks. It does not measure
real-user accuracy, search recall, or time saved. Earlier evaluation failures
are retained in the readiness record.

**What still needs testing?**

The installed Slack workflows, live Jira rehearsal, Gemini timing/fallback in
the actual demo, and coworker usability. Slack bot authentication succeeded,
but that alone does not prove the shortcut works in the installed app.

**Is it production-ready?**

The current demo runs locally. Shared hosting, deployment identity, and company
access/retention policies still need work before a broader rollout.

**What is the architecture?**

One React web app, an Express backend, and PostgreSQL. A local multilingual
model supports memory search; optional Gemini adds assistance. Web and Slack
proposal checks use the same backend service.

**What happens if Jira creation is interrupted?**

If the issue was created and only linking failed, retry linking. If the outcome
is unknown, inspect Jira and attach the existing issue if needed. The app does
not automatically recreate an issue with an unknown outcome.

**What is next?**

Complete installed rehearsal and coworker testing, fix observed problems,
then freeze the demo. Add features later only when those sessions show a need.
