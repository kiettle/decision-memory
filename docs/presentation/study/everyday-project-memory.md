# Coworker validation: everyday project memory

Use 3–5 teammates, including someone unfamiliar with the project. This is a
script and blank worksheet; no participant results have been collected.
Use isolated synthetic records and recipients. Disable Slack/Jira/Gemini
credentials. Do not send anyone real messages. Explain that local demo sessions
share one identity; use repository synthetic identities for access-boundary proof.

Prepare a small scope with an older local-disk choice replaced by object storage
because workers restart; a different scope still using local disk; a current
record without Why; a pending retention question assigned to a known synthetic
owner; and meeting notes containing a choice, its reason and an unrelated question.
Linked owners select the important current records. Keep expected answers sealed
from participants until each task ends. Do not infer rejected alternatives.

For each task, start timing at the prompt. Observe silently for the first attempt.
Record success, exact answer, scope, source used, elapsed time and every hint or
intervention. Ask for a one-sentence explanation of why they trust the answer.
Wrong but confident answers count as wrong. Offer recovery after recording failure.

| Task prompt | Correct observable result | Measurements |
| --- | --- | --- |
| You are implementing exports in this scope. What applies today, and why? | Current object-storage choice, exact scope and restart rationale, supported by a record/source; old local disk identified as historical and other-scope local disk not applied | Correct choice/scope/reason/evidence separately; time; hints; false confidence |
| Preserve the agreed choice from these notes. | Reviews/corrects a candidate, sets scope/reason, explicitly saves only the agreed choice with exact pasted excerpt and truthful origin; unrelated question is not automatically saved | Completion; seconds; clicks/keystrokes or edits; characters typed; corrections; assistance; source retained |
| You are taking over this project. Explain its important choices and what is still open. | Finds selected choices, rationale/evidence/history, pending question and owner/contact context; says missing Why is unknown and Options Considered does not imply rejection | Accuracy per item; time to useful explanation; evidence opened; hints |
| Your search is insufficient. Get the question to the right owner and follow its answer. | Creates Pending with query/scope intact, explicitly assigns owner and follows, then uses existing completion with choice/Why/evidence; original question remains searchable | Completion per stage; time; assistance; identity/scope mistakes |
| A relevant choice changed. What changed, and what will you do next? | Finds in-app change, explains previous/current choice or scope and recorded reason, opens current record; unfollows successfully | Correct explanation; time to notice; next action; hints; no item for an unfollowed/foreign synthetic identity |

Worksheet (one row per participant/task):

| Participant | Task | Correct answer / expected fields | Completed unaided? | Seconds | Hints / interventions | Capture edits / typed characters | Evidence retained? | Misunderstanding / recovery |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | |

Compare task completion, correctness, time and assistance with the team's existing
way of doing the same tasks using equivalent synthetic cases (counterbalance order
where practical). Report medians/ranges and failures, not only averages. Distinguish
navigation problems from missing recorded information. For capture, report both
entry effort and review/correction effort. Ask whether they would use this during
an ordinary meeting and what they would omit. Automated tests establish behavior
and access boundaries; only these observations can support a user-benefit claim.
