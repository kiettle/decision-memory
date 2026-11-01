# Team memory dashboard

Status: implemented 2026-11-01. Policies accepted by the owner with the
contest-readiness plan on 2026-11-01.

## Question it answers

"What should the team decide or write down next?" The screen lists open
questions by owner (live snapshot, any age) with the three due next, and the
searches that found nothing. Beside them: questions opened and choices recorded
over the period (weekly bars for 90 days, daily otherwise), who recorded them,
and the most consulted decisions. Scope (`appliesTo`) and period (`days` = 7, 30
or 90; default 90) live in the URL.

Counts are documentation and consultation facts. They never rank people or
measure decision quality, and the screen says so.

## Drill-downs and actions

- An owner's past-due or open count lists those questions; each opens the record
  where the answer is recorded.
- A week or day bar lists the questions opened and choices recorded on those UTC
  days. A bar's total equals the sum of its days.
- A contributor's count lists the records created from that account in the period.
- A search gap offers **Record as question** (the new-question form pre-filled
  with the search text and its scope) and **Remove** (deletes those search entries).

## Usage collection policy

1. **Audience.** Authenticated teammates of the workspace see counts and search
   text. There is no admin role.
2. **Switch.** Collection is per workspace and **off by default**. Anyone can turn
   it on or off on the dashboard. While off, the server discards view and search
   events. The synthetic demo seed turns it on for the demo workspace only.
3. **Views.** A successful, visible, full decision-page open counts once per
   decision and viewer in each fixed 30-minute UTC bucket. Previews, prefetches
   and failed loads do not count. The viewer is a one-way hash of workspace, user
   and a per-tab session token, used only for deduplication. It is never shown
   and never counts people.
4. **Searches.** The events recorded are:
   - Library keyword searches submitted with Enter.
   - Explicit Find by meaning and Gemini searches.
   - Explicit **Not what I needed** feedback.

   Automatic fallbacks, keystrokes, related lookups, proposal checks and Slack
   are never recorded. Each event stores the query (at most 500 characters), the
   selected scope, the method, the outcome and the result count, with no person
   attached.
5. **Retention.** View and search events older than 90 days are purged when the
   dashboard is read. Teammates can delete search entries at any time.
6. **Failure.** Collection is best effort and never blocks or errors a page.

## Data honesty

- Choices without a recorded date are left out of the trend, and the screen
  says how many.
- Older choices may not record whether they began as a question.
- Linked owners and free-text owner names stay separate rows.
- No foreign-workspace identity is ever joined.

## Proof

- `scripts/verify-dashboard-records.mjs`, run by `npm run test:integration`,
  covers:
  - the record counts and drill-down agreement;
  - the switch being off by default;
  - 30-minute buckets;
  - workspace isolation;
  - scoped gaps;
  - deletion;
  - 90-day purge.
- `scripts/verify-dashboard-ui.mjs`, run by `npm run test:ui`, covers:
  - the leading blocks and the finding line;
  - drill-down to a record;
  - gap to a pre-filled question;
  - removal and feedback;
  - the switch;
  - phone fit.
