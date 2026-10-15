# Coworker study — facilitator only

Prepared 2026-10-15. All fixtures are synthetic. No coworkers have participated,
and no benefit has been measured. Do not show this guide or `fixtures.json` to
participants. Share only the assigned cards in [participant-tasks.md](participant-tasks.md).

## Prepare the records

[fixtures.json](fixtures.json) contains two structurally paired sets: seven
records each, four task families, one replacement and one pending question.
Each decided record has a one-sentence choice and a one-sentence reason.
The sets have not been empirically calibrated for equal difficulty; run a
facilitator rehearsal first and record any imbalance.

1. Use the existing local application and synthetic data only. Complete the
   [installed Slack rehearsal](../slack-rehearsal-handoff.md) separately first.
2. Check that these exact `Pilot A · …` / `Pilot B · …` scopes are unused. If
   already used, consistently append a new run suffix to every record and task
   card. Never erase previous study data to repeat the study.
3. For each fixture, open **New Decision**. Select its `decisionState`, copy
   `text` into the primary field, and copy `why` and the exact `appliesTo` scope
   into More details. Leave unrelated metadata blank. Save explicitly.
4. Record each fixture alias's generated DM key below. Aliases are facilitator
   labels, not product record IDs.
5. For each replacement, open the `current` record, choose **Supersede**, select
   the `previous` key, copy the recorded `reason`, and confirm. Do not supersede
   a pending question. Check that the earlier record is historical.
6. Wait for semantic indexing and check all task records are retrievable. The
   fixture proof only establishes local retrieval, not Gemini quality or human
   usability. Rehearse provider availability separately; retain failures.

| Alias | Generated DM key | Alias | Generated DM key |
| --- | --- | --- | --- |
| A1 | | B1 | |
| A2-old | | B2-old | |
| A2-current | | B2-current | |
| A3-current | | B3-current | |
| A3-other | | B3-other | |
| A4-current | | B4-current | |
| A4-pending | | B4-pending | |

## Run 5–8 sessions

Recruit unfamiliar coworkers yourself; no invitation has been sent. Explain
that you are testing the product, not their performance. Obtain permission for
any recording or quotation. Use anonymous P1–P8 labels in the result notes.
Offer the same brief orientation to search, scope selection and proposal review
without exposing study answers. Keep the presentation computer and dataset
fixed; have participants control the interface.

| Participants | First block | Second block |
| --- | --- | --- |
| P1, P3, P5, P7 | Ordinary memory search, Set A | Proposal review, Set B |
| P2, P4, P6, P8 | Proposal review, Set A | Ordinary memory search, Set B |

Ordinary memory search uses the existing **Search by memory** workflow and its
record details. Proposal review uses **Check a proposed decision**, local
retrieval and optional explicit Gemini analysis. Record whether Gemini was
used and whether it completed; do not hide provider failures. Both conditions
allow evidence, scope and replacement inspection. Do not teach participants a
shortcut mid-task unless requested; record every hint.

Give one task card at a time. Start timing when the card is shown; stop when
the participant gives their answer and points to evidence. Let them choose
queries and scope controls. A clicked result or an AI label is not an answer.
Record incomplete tasks and time spent; do not quietly omit them from analysis.
Never give the same participant Set A answers before its tasks, or reuse the
same answer in both conditions. Ask for one useful aspect and one frustration
after both blocks.

## Answer key

| Family | Set A | Set B | What earns a correct answer |
| --- | --- | --- | --- |
| 1: paraphrase | A1: background CSV workers | B1: background photo workers | Current choice plus HTTP time-budget reason; proposed synchronous processing differs |
| 2: replacement | A2-current: object storage replaces database-host storage | B2-current: signed object-storage links replace API-response files | Current choice, historical predecessor and the recorded size/capacity reason |
| 3: scope | A3-current: ten minutes for internal dashboard; fifteen seconds belongs to public status | B3-current: one hour for operations reports; one minute belongs to customer tracking | Correct scope and exclusion of the other scope; do not merge the policies |
| 4: unsettled aspect | A4-current requires a token but does not settle expiry | B4-current requires a signed link but does not settle expiry | Insufficient evidence about 24 hours; pending question is not an accepted choice |

A false warning means an unsupported conflict claim, including treating an
undecided detail or another scope as a prohibition. Record the displayed claim
and whether the participant followed it. Record unsupported approval separately
as a misleading answer, even if it was not phrased as a warning.

## Copy this blank worksheet per participant

Participant: ___  Date: ___  Condition order: ___  Computer/browser: ___
Consent to recording/quotation: ___  Prior product familiarity: ___

| Task / condition | Correct choice or uncertainty? | Scope understood? | Evidence identified? | Seconds / completed? | Hints | Gemini used / completed? | False warning or misleading answer | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |
| 6 | | | | | | | | |
| 7 | | | | | | | | |
| 8 | | | | | | | | |

Useful aspect (quote only if permitted): ___
Frustration or failure: ___

## Report and decide

Report participant count, correct answers out of attempted tasks, scope/evidence
scores, incomplete tasks, hints, provider failures, and misleading warnings for
each condition. Compare paired task families within participants; give median
completion times alongside completion rates and individual failures. Do not
pool away differences in task difficulty or present this small convenience
sample as a company-wide estimate.

The feature earns the main demo only if proposal review improves correct
current-choice identification or equivalent-task completion time without more
misleading warnings. If results are mixed, say so and use the existing evidence
and replacement story. Retain the two deferred interviews in the
[validation kit](../proposal-review-validation.md); synthetic tasks cannot
replace real examples of repeated discussions.
