# Proposal review: evaluation and user-study kit

Date: 2026-10-15. Owner approved synthetic implementation now and deferred the
two initial coworker interviews. This document is a protocol, not user evidence.

## What is being tested

Can a person identify the applicable current choice, understand its evidence,
and avoid following an obsolete or unrelated decision? Compare ordinary memory
search with Check a proposed decision. A generated warning is not itself proof
that a mistake was prevented.

## Two coworker interviews (deferred)

Ask separately; do not teach the interface first. Obtain permission to retain a
sanitized account, and use anonymous labels A/B.

1. Describe the last time your team repeated a discussion or followed an old
   decision. What work were you trying to complete?
2. What did you search, whom did you ask, and what was hard to establish?
3. Was the original decision still applicable? What scope or circumstance changed?
4. What was the observable consequence? Distinguish observed delay/rework from
   an estimated consequence that did not happen.
5. What evidence would have helped, and at what point in the workflow?

| Participant | Sanitized situation | Current approach | Observed cost | Needed evidence |
| --- | --- | --- | --- | --- |
| A | Pending | Pending | Unmeasured | Pending |
| B | Pending | Pending | Unmeasured | Pending |

## Comparative study: 5–8 unfamiliar coworkers

Ready-to-use materials: [facilitator guide and worksheet](study/facilitator.md),
[participant task cards](study/participant-tasks.md), and
[synthetic fixtures](study/fixtures.json). Only task cards go to participants.

Run on the presentation computer with a synthetic dataset and a rehearsed
installed Slack integration. Do not expose the synthetic-identity API publicly.
Use four task families: recover a paraphrased choice; identify its latest
replacement; distinguish a similar choice from another scope; recognize when
the stored records do not settle the proposal.

Prepare two equivalent fixture sets (A/B) with different wording and IDs but
the same number of choices, evidence length and history depth. Participants
with odd IDs use ordinary search on A, then proposal review on B. Even IDs use
proposal review on A, then ordinary search on B. Never give a person the same
answer twice. Keep all expected answers in the facilitator's notes.

Give only the task and scope, not button-by-button instructions. Record time
from task presentation until the participant explains their answer. Record
every hint as assistance. Ask the participant to name the current choice,
explain why it applies, and point to evidence; a clicked result is insufficient.

| Participant/task | Condition/set | Correct current choice | Scope understood | Seconds | Assistance | False warning | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pending | Pending | Unobserved | Unobserved | Unmeasured | Unobserved | Unobserved | — |

Report counts and median times with the small sample size and failures. Include
one permitted quote and one frustration. Do not claim company-wide savings.
Use the new review as the main demo only when it improves correct selection or
equivalent-task time without increasing misleading warnings; otherwise retain
the established capture/retrieval/replacement demo while addressing the failure.

## Model evaluation

Run explicitly (paid provider calls, only authored synthetic fixtures):

```bash
npm run eval:proposal -- --live --output /private/tmp/proposal-holdout.json
```

The current holdout has 24 cases: eight mismatch, eight consistent and eight
insufficient-evidence expectations, half English and half Vietnamese. Candidate
retrieval is controlled; this measures live assessment, not recall or user impact.
The service enforces exact citation membership/text. A person must still inspect
each explanation, scope and implied consequence for unsupported claims.

V4 is the default set. Once evaluated, it must not be described as an unseen
holdout on subsequent runs. V1/V2/V3 are retained as regression sets: add
`--regression-v1`, `--regression-v2` or `--regression-v3`.
`--regression-failures` runs the 12 previously failed cases across those sets.
Do not use expected
labels in prompts, edit failed cases to pass, or present a tuned regression as
a fresh holdout. After changing prompts based on holdout failures, create a new
independent set and preserve the original result. Provider-unavailable cases are
incomplete, not correct abstentions. The runner paces requests and writes partial
results after each case; it does not automatically retry or conceal failures.
Cases are spaced six seconds apart. An explicit analysis starts two concurrent
model calls within one shared eight-second deadline when current scoped evidence
exists. The verifier does not see the assessment output; unsupported relations
are still downgraded. HTTP 503 may retry once per call within the same deadline;
rate limits and invalid output are not retried. Reports retain synthetic per-call outputs/timings and
hashes of the service source and evaluated fixtures. See
[readiness evidence](readiness-validation.md) for observed runs and the demo gate.

## Installed Slack rehearsal (owner-operated)

The owner deferred live rehearsal on 2026-10-15. Use the
[rehearsal handoff](slack-rehearsal-handoff.md), which includes preparation
checks, exact synthetic examples and a blank outcome record.

1. Apply the updated manifest so **Check proposed decision** appears. Verify
   the signed listener at port 3012 and bot membership in the synthetic channel.
2. The owner posts a synthetic proposal, then invokes the shortcut. Confirm
   an editable private modal opens and nothing is posted to the channel.
3. Check locally without a scope. Inspect the returned scopes and saved evidence.
4. Enter an exact existing Applies To value and explicitly analyze with Gemini.
   Confirm disclosure, citations, historical labels and current replacement links.
5. Change the text while a check is in flight; the previous answer must not
   overwrite the edited form. Close/reopen, retry, and check an unrelated proposal.
6. Open the current record on the presentation computer. A localhost link is
   not a company-wide shared deployment.

Record date, installed app version, synthetic thread/decision IDs and outcomes.
Do not mark installed readiness from signed mocked HTTP fixtures.

## Candidate 90-second story (gated by the user study)

| Time | Visible proof |
| --- | --- |
| 0–10 s | “Why are we about to make the same choice again?” Show a synthetic migration-backup proposal in Slack. |
| 10–25 s | Check the proposal locally; show the earlier choice and current replacement. |
| 25–43 s | Confirm Atlas migration, explicitly analyze, inspect the suggested assessment and exact quote. |
| 43–58 s | Open the stored record and captured discussion; explain the reason for replacement. |
| 58–72 s | Revise the proposal in the web review and open Record this choice; the person confirms Save. |
| 72–82 s | Show a short unrelated/undecided-parameter case returning insufficient evidence. |
| 82–90 s | Report actual pilot results if collected; otherwise state the intended benefit without a numerical claim. |

Use synthetic known state and rehearse timings. Do not present edited video
timing as measured latency. Keep offline local evidence as the provider-outage
fallback and leave Jira out unless its installed flow has been separately verified.
