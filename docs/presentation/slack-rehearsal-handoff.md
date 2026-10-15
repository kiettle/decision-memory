# Slack rehearsal handoff

Prepared 2026-10-15. Owner chose to rehearse later. No Slack messages, installed
manifest changes, app startup, or demo-data writes were performed for this handoff.

## Verified preparation

| Check | Observed state |
| --- | --- |
| Configured bot authentication | Slack `auth.test` returned success; workspace matched configuration; bot identity present |
| Credentials | Bot token, signing secret, team and Gemini key are configured; signing-secret validity still needs a real signed interaction |
| Tunnel routing | Existing `/decision-memory` route targets `http://127.0.0.1:3012` |
| Local app | No listeners on 3011, 3012 or 5173 at the preparation check |
| Installed shortcut/manifest | Not inspected or updated; owner must verify |
| Live proposal review | Not rehearsed; native signed HTTP tests are not installed proof |

These checks describe preparation time, not a guarantee about the later session.
The existing tunnel has other routing; do not replace unrelated routes.

## Start the rehearsal

1. From the repository root, run `npm run dev`. This preserves existing data.
   Do not run seed/reset commands to repeat a take.
2. Open [Decision Memory](http://localhost:5173) and verify the library, proposal
   review and evidence pages load. Wait for local indexing to catch up.
3. Read `tailscale funnel status`. Confirm `/decision-memory` still targets
   port 3012. Follow [Slack setup](../../README.md#connect-slack-locally) if the
   endpoint has changed. Expose only the Slack listener for this application.
4. In your installed Slack app's App Manifest page, apply
   [slack/manifest.yml](../../slack/manifest.yml). Verify the interaction and
   event URLs match the live tunnel; complete installation if Slack requests it.
5. In a synthetic channel, invite the bot if needed. Confirm message actions
   include **Check proposed decision**. The owner performs these Slack actions.

## Prepare an unambiguous synthetic story

Use a new exact scope such as **Proposal rehearsal · Take 1**. For another take,
choose a new suffix; do not overwrite an older rehearsal. Create these two
**Already decided** records in the web app and write down their generated keys:

| Field | Earlier record | Current record |
| --- | --- | --- |
| What did you decide? | Store migration backup files on the database host. | Store migration backup files in object storage. |
| Why | The first rehearsal needed a temporary file location. | Large backup files exhausted the database host. Retention duration has not been decided. |
| Applies To | Proposal rehearsal · Take 1 | Proposal rehearsal · Take 1 |

On the current record, use **Supersede**, choose the earlier key, and enter:
“Large backup files exhausted the database host; move file storage off that host.”
Confirm explicitly. Inspect both records and the comparison before proceeding.
These are manually entered synthetic records. Do not claim their discussion
was captured from Slack; the separate [capture rehearsal](demo-runbook.md)
proves that integration.

## Owner-operated checks

Post each proposal below yourself in the synthetic channel. Select its message
shortcut, confirm the text is editable, and choose **Check locally** first.
Then enter the exact take's scope and choose **Analyze with Gemini** explicitly.
Record actual elapsed times and outcomes, including failures.

| Proposal | Expected evidence/assessment if analysis completes |
| --- | --- |
| Keep migration backup files on the database host. | Historical choice and current object-storage choice; possible mismatch citing the current choice |
| Store migration backup files in object storage. | Current choice; appears consistent |
| Retain migration backup files for 45 days. | Retention is not settled; insufficient evidence, not a prohibition |

Also check:

- Opening the modal and checking locally produce no automatic Gemini assessment.
- Results stay in the private modal; the shortcut does not post an analysis to
  the channel. The independently configured nudge feature may show a private nudge.
- The selected scope, historical labels, quotes and replacement reason agree
  with the stored records. Valid quotes alone do not establish a correct warning.
- An unrelated scope yields insufficient evidence and no claim of approval.
- Edit the text while analysis is pending: the old answer must not overwrite it.
- Click **Done** during a check: the modal closes without saving or later updating.
  Reopen it and try again; **Close** should also dismiss safely.
- Open evidence on the presentation computer. In the web proposal flow, inspect
  evidence and comparison, then use the app's Back controls: proposal and scope
  should be preserved.
- **Record this choice** opens an editable form. Cancel once to check that nothing
  is saved; save only when intentionally recording the revised synthetic choice.

Gemini has an eight-second analysis budget. If it times out or is unavailable,
local evidence must remain usable. Record that take as unavailable, not as a
correct abstention. Do not disable credentials or alter shared setup to force
an outage; failure behavior already has automated coverage.

## Return this record

| Observation | Actual result |
| --- | --- |
| Date/computer/browser | Pending |
| Installed app and synthetic channel | Pending |
| Exact scope; earlier/current keys | Pending |
| Shortcut visible; modal opened; opening time | Unobserved |
| Local results and retrieval time | Unobserved |
| Mismatch / consistent / insufficient outputs and times | Unobserved |
| Quotes, scope, replacement chain correct | Unobserved |
| Private results; edit/Done/Close checks | Unobserved |
| Web Back / cancel / explicit save checks | Unobserved |
| Failures, assistance or retries | Unobserved |
| Recording location, if made | Pending |

Do not paste tokens, signing secrets or confidential thread contents into the
record. Report what failed before retrying; a later successful take does not
erase an earlier failure. `Ctrl+C` stops the app processes started for the take;
the local database retains its data.

After installed rehearsal, use the [coworker study facilitator guide](study/facilitator.md).
Model evaluation is currently 23/24 expected outcomes with one timeout. A
main-demo benefit claim still requires observed coworker results.
