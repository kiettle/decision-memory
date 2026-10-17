# Decision Memory — Demo rehearsal

Updated: 2026-10-14. Companion to the [presenter guide](README.md).

Current evidence and pending live checks are in the
[readiness record](readiness-validation.md). The owner is preparing the real
demo later; automated fixtures do not establish installed integration readiness.

Use one synthetic story throughout: the team extends migration-backup retention,
changes its storage choice, and preserves the reason for that change.

## 1. Prepare the local application

Prerequisites and supported operation are in the root [README](../../README.md).
With Node.js 22+ and Docker Desktop/OrbStack running, start from the repo root:

```bash
npm run dev
```

Open [the library](http://localhost:5173). Initial setup needs internet for
dependencies, the database image and cached model files. Prepare before the
presentation; runtime local search uses the cached model.

- Confirm the library loads and the local Find by meaning feature is available.
- If presenting Search with Gemini, verify the key/network beforehand, choose
  the synthetic take's scope/channel/tag/owner filters, and rehearse the query.
  Show searched/total coverage; older decisions beyond the newest 200 filtered
  candidates are omitted and AI ranking may be wrong. Local search remains usable.
- Confirm Scopes, Compare decisions and a detail page open.
- Use the existing Slack setup instructions in the [README](../../README.md#connect-slack-locally).
  Expose only the Slack listener on port 3012. Rehearse the message shortcut in
  the actual installed synthetic demo workspace.
- Optional Gemini drafting requires a separate key and network connection.
  Capture works through manual confirmation when that assistance is unavailable.
- Jira creation requires its own configured account and a live rehearsal. Leave
  it out of the main demo unless this has been verified.
- Verify browser zoom, readable window size and recording resolution. Keep the
  required screens open before presenting.

Do not use schema/seed commands to reset an existing database. Startup preserves
existing decisions and seeds only an empty database.

## 2. Create known state for this take

Open **New Decision**, select **Already decided**, and create the earlier
recorded choice before recording. Enter **Why? (optional)** below the choice
and select **Applies To** beside it. Open **More details** for Context, Tags
and Options Considered. Only the final choice is required;
the other fields below make this synthetic story understandable.

| Field | Value |
| --- | --- |
| What did you decide? | Use standard object storage for all migration backups |
| Why | Recent backups need quick access during migration rollback. |
| Context | Our initial retention window is 14 days. |
| Applies To | Migration Demo — Take 1 |
| Owner | Choose the actual demo user, or leave unassigned |
| Tags | migration, storage |

In **Options Considered**, enter one alternative per line:

```text
Standard storage
Archive storage
```

Write down its generated DM key. Do not assume a fixed key or UUID. Reload the
library after preparation so the new scope appears in its filter options.
Confirm its visible status is **Decided**. A Pending question cannot be used as
a supersession baseline or a remembered choice.

For another recording or live rehearsal, create a fresh earlier decision and
use **Migration Demo — Take 2**, then Take 3, etc. Copy that exact scope string
into the new decision. An already-superseded baseline cannot be superseded
again. Do not delete older records or clear the database to repeat a take.

Prepare this discussion in the synthetic Slack workspace, with each line as a
message in the selected thread. Sending this discussion is a presenter action;
the documentation does not send messages automatically.

```text
Why do we keep all migration backups in standard object storage?

Our migration backups now need to be kept for 90 days instead of 14.

Keeping rarely restored older backups in standard storage is becoming expensive.
Recent rollback files still need quick access.

Could we keep recent backups in standard storage and archive files after 30 days?

Agreed. Use archive storage for migration backups older than 30 days.

I will update the backup lifecycle rule and keep recent rollback files readily available.
```

The anchor is **“Agreed. Use archive storage for migration backups older than
30 days.”** These are fictional demo circumstances, not measured customer data.

## 3. Capture and confirm

1. Open the anchor's message actions and choose **Save as Decision**.
2. If **Optional AI assistance** is waiting, use **Continue manually** to keep
   moving. If the AI form arrives promptly, review it before saving.
3. Confirm these fields, correcting any AI draft that differs:

| Field | Value |
| --- | --- |
| Decision | Use archive storage for migration backups older than 30 days |
| Why | Longer retention makes rarely restored older backups expensive to keep in standard storage. |
| Context | Retention increased from 14 days to 90 days; recent rollback files still need quick access. |
| Applies To | Migration Demo — Take 1 |
| Tags | migration, storage, retention |
| Related Jira URL | Leave blank unless a verified synthetic demo issue exists |

Use the exact scope from step 2; replace Take 1 with the current take when
repeating.

4. Save and wait for the saved-decision confirmation. Note its generated key.
5. Open the saved record in the web app. The localhost confirmation link works
   on the presentation computer; prepare that computer accordingly.

If a similar suggestion offers the earlier decision, review its Why/Applies To
before using **Replaces an earlier Decision?** and **What changed?**. The
deterministic main rehearsal uses the web supersession in step 5 below, so leave
that Slack picker unset for this path.

If Slack reports incomplete capture, explain the anchor/available context
fallback and repeat the rehearsal with the bot correctly invited. A missing
discussion must not be presented as a full captured thread.

## 4. Retrieve and inspect evidence

1. Return to the library. Apply the current take's **Applies To** filter.
2. Search `migration backups`, or use a paraphrase verified during rehearsal
   and select **Find by meaning**. Semantic matches are approximate; keep the
   rehearsed query as part of the recording notes.
3. Open the newly saved decision. Show Decision, Why, Context and Applies To.
4. Show Relevant Discussion and **View captured discussion** when available.
5. Close or leave Slack and continue reading the stored discussion in the app.
   This demonstrates retrieval from the saved copy; do not claim the source was
   deleted or its history expired unless that was actually demonstrated.

The seeded sample is also useful for a separate memory-search demonstration:
`migration storage` works as keyword search, while the documented bilingual
memory-query example is `Hồi trước mình xử lý file migration lớn hay timeout
như thế nào?`. That sample concerns the seeded object-storage decision, not the
new archive-retention decision. Rehearse against the actual current dataset.

New records may briefly be pending semantic indexing. Wait for coverage to
catch up or use normal keyword search, which sees saved records immediately.

## 5. Record the replacement reason and compare

From the **new archive-storage decision**, click **Supersede**. Choose the
earlier standard-storage decision by the key noted during preparation.

Review the Earlier choice / Replacing choice preview. Enter **What changed?**:

```text
Retention increased from 14 days to 90 days. Older backups are rarely restored,
so keeping all backups in standard storage no longer fits our cost target.
```

Click **Confirm supersession**. Show **Why did this change?**, then **Compare
before and after**. Point out the recorded rationale, the shared scope, and the
human-written reason for replacement. Open the old record if time permits: it
remains searchable and points to the replacement.

The comparison marks different stored wording. It does not automatically judge
the decisions as contradictory or determine which approach is correct.

## 6. Finish with the scope overview

Open **Scopes**, find the current take's scope, and open it. On mobile, open
the menu and choose **Scopes**, or select a scope link on a decision.

Point to:

- The archive-storage decision under **Current decisions**.
- Its rationale, context, owner and evidence link.
- The earlier standard-storage decision under **How this scope evolved**.
- The recorded explanation and **Compare before and after** action.

Say: “A teammate joining this service can see what applies today, why it was
chosen, and what changed—without reconstructing the whole conversation.”

## Optional walkthrough: pending question to recorded choice

Use this as a separate short walkthrough or during Q&A; retain the core
60–90 second capture/evidence/replacement story above.

1. Open **New Decision**. Keep **Pending decision** and enter
   `Which storage should we use for migration backups?` in **What needs to be
   decided?**. Set the optional **Decide by** to three days after the viewer's
   current local date. Leave Owner unassigned; other metadata is optional.
2. Save and return to the library. Use **Assigned to me** if you assigned yourself,
   and **Due soon** to find the question. In **Flat**, show its exact date and
   **Record decision / Edit deadline** actions. **Kanban** shows the same filtered
   record grouped by deadline.
3. Click **Record decision**. Enter
   `Use object storage for migration backups.` in **What did you decide?**.
   Why is optional. Save and confirm the card moves to **Decided** only after
   the save succeeds.
4. Open the record. Show its final choice, preserved original question, and
   historical deadline. Completed choices have no overdue warning.
5. Open **New Decision**, select **Already decided**, enter
   `Use exponential backoff for failed backup uploads.`, and save with the
   original question and all other metadata blank. Before saving, pause so the
   related decisions appear under the choice (searched locally). Show the
   scope explanation and indexing coverage; results are discovery, not approval.

Only one text field is required for each save. Normal search includes pending
questions and recorded choices. Memory search finds recorded choices; it is
disabled for Pending or pending-deadline filters. The board groups records
automatically; moving a question means editing its deadline or recording its
choice.

This guided rehearsal is not a first-time usability observation. Use the
uncoached prompts in the [readiness record](readiness-validation.md) for that.

## If something fails during the presentation

| Failure | Presenter recovery |
| --- | --- |
| Slack or tunnel unavailable | Use a prerecorded capture segment and explain that it was recorded. Continue with a previously captured synthetic decision. |
| Optional Gemini draft slow/unavailable | Use Continue manually and review the fields. |
| Semantic search has no match or pending coverage | Use the rehearsed keyword query and scope filter; explain approximate retrieval or pending indexing accurately. |
| Detail, comparison or scope load fails | Use the visible Try again control; if the service stays unavailable, switch to the recorded walkthrough. |
| Jira creation response uncertain | Check Jira before another creation attempt. Known partial success exposes the created link and Retry linking. |
| Earlier decision already superseded | Use a prepared fresh take or show its existing history. Do not try to replace it again. |

Save a short recording before the live showcase. Use application output from
your rehearsal; screenshots under temporary QA directories are not a durable
presentation asset or a live product demonstration.

## Rehearsal record

Fill this in for each take:

| Item | Actual value |
| --- | --- |
| Date, computer and browser | |
| Scope / take | |
| Earlier decision key | |
| Captured decision key | |
| Verified retrieval query | |
| Full / partial source capture | |
| Capture and retrieval times | |
| Replacement, comparison and scope verified | |
| Recording saved at | |

`Ctrl+C` stops app processes started by `npm run dev`. PostgreSQL remains
available with its data; `npm run db:down` stops it while preserving the volume.
