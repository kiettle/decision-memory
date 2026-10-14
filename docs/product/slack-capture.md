# Slack Capture

Date: 2026-10-06

## Outcome

Decision Memory offers two Slack entry points that share one confirmation modal
and persistence path:

1. **Save as Decision** captures an existing Slack message and its selected
   thread context.
2. **`/decide`** records a Decision directly from the current conversation.

Both entry points require human confirmation before a Decision becomes
authoritative.

## Message Shortcut

The message shortcut is the primary capture flow when source evidence already
exists in Slack.

When invoked, the app:

1. acknowledges the Slack interaction immediately;
2. treats the selected message as the anchor;
3. opens a loading modal immediately, before source or database requests;
4. retrieves bounded source context with request deadlines, stores a 24-hour
   PostgreSQL draft, and updates the modal with only its ID in private metadata;
5. pre-fills Decision from the anchor message where practical;
6. shows a compact captured-source summary in the modal;
7. saves the Decision, source snapshot, and Slack source reference together;
8. returns a confirmation containing a link to the saved Decision.

If Slack refuses the permalink or thread request, capture degrades to the
selected message alone so the confirmation modal still opens. Each message is
capped at 4,000 characters. The selected anchor is always
included, even when it falls outside Slack's first reply page. The persisted
snapshot records reported and captured message counts plus whether the capture
was truncated, so it remains useful and honest if Slack becomes unavailable
later.

## Slash Command

`/decide` is the secondary flow for recording a Decision that has just been
stated or was reached outside an identifiable Slack thread.

- `/decide Use GCS for migration backup files` opens the confirmation modal
  with the command text pre-filled as Decision.
- `/decide` opens the same modal with an empty Decision field.
- The command captures the invoking workspace, channel (ID and name), user, and timestamp.
- The command does not invent an anchor message, thread, permalink, or captured
  discussion when Slack did not provide one.
- Slack does not allow app slash commands inside threads ("/decide is not
  supported in threads"). In a thread, mention the app instead.

## Mention

`@Decision Memory decide` works anywhere, including threads. Slack opens forms
only after a click or a slash command, so the app privately replies with a
**Save as Decision** button; one click opens the same capture form as the
message shortcut, with the AI draft and the "Already decided?" check.

- In a thread, the selected message is the latest person's message before the
  mention, and the whole thread is captured.
- Outside a thread, the mention message itself is selected.
- Text after the command becomes the Decision title, for example
  `@Decision Memory decide Use Cloud Run for the worker`. `decision`, `save`,
  `chốt`, and `lưu` also work as the command.
- Any other mention gets a short private hint. Mentions are never nudged again
  as ordinary messages.

Team is deferred: the Slack channel takes its place in the library column and
filter. The `decisions.team` column and its existing values are kept but are no
longer shown, edited, or searched.

Both entry points store the Slack channel name with the source snapshot
(`source_snapshots.channel_name`) automatically. The Decision page and library
rows show it as `#channel`, and keyword search matches it.

## Shared Confirmation Modal

Only Decision is required. The modal also supports:

- Why;
- Context;
- Applies To;
- Owner;
- Tags;
- Related Jira URL.

The message-shortcut variant displays captured source context. The slash-command
variant instead states that no message thread is attached.

## AI Draft (Optional)

When `GEMINI_API_KEY` is set, the message shortcut asks Gemini to draft the form
from the captured thread (spec §7). After the discussion is persisted, an
**Optional AI assistance** view offers **Continue manually** immediately; the
person may also wait for the AI form. It sends at most 60 messages around the selected one, 1,500 characters
each.

- The draft pre-fills Decision, Why, Context, Applies To, Options Considered,
  Owner, and Tags, without a confidence/review notice. Decision is a short
  sentence that starts with a verb; Why and Context
  only paraphrase what the messages say; Vietnamese threads get a Vietnamese
  draft.
- Owner is the author of the message that committed to follow-up, otherwise
  the author who proposed the agreed option.
- It uses `gemini-3.5-flash-lite`. On 2026-10-07 the larger free models
  (`gemini-3.5-flash`, `3.7-flash`, `3.8-flash`) returned "high demand" errors
  or took 9–40 seconds, which is too unreliable for a live capture.
- Gemini may report no clear final Decision. The modal then says so, lists the
  options discussed, and keeps the selected message as the starting text.
- Other possible decisions in the thread are listed; the draft covers the one
  closest to the selected message.
- **Continue manually** opens the plain form from the persisted discussion and
  preserves the same retry identity. It does not wait for drafting or similar
  Decision search. A late AI completion uses Slack's view hash and cannot
  replace a manual form or saved result. A manual save does not claim AI review.
- Nothing is saved until the person clicks Save. The snapshot records only the
  draft's outcome, confidence, and supporting message IDs, which the Decision
  page uses to choose the short discussion it shows.
- AI drafting makes at most two attempts: up to 8 seconds each, with a
  1-second retry delay and a 17-second total drafting budget. Provider retry
  delays are respected when they fit the remaining budget. Temporary network
  failures, timeouts, overload, temporary rate limits, and invalid output can
  retry once. Invalid credentials, known exhausted daily/zero quota, blocked
  output, and valid no-clear-decision results do not retry.
- If drafting fails, the plain form keeps the selected message and says
  "AI drafting unavailable—please complete the fields manually." Disabled AI
  does not show this failure notice. Only attempt number, failure category,
  HTTP status, duration, and retry disposition are logged; no provider text,
  thread content, output, or credentials are logged. The 17-second budget is
  for drafting, separate from Slack capture and similar-decision lookup.

Submission defaults the Decision to `ACTIVE`. Slack retries and repeated modal
submissions must not create duplicate Decisions.

## Already Decided? (Optional)

With Search by memory available, the message shortcut also searches stored
Decisions for the drafted Decision (or the selected message) while the
optional-assistance view is shown; **Continue manually** bypasses this wait.

- Up to three matches scoring 60 or more are listed with links and their
  status, under "Already decided?". Their bounded Why and Applies To excerpts
  help the person understand whether they apply to the same situation.
- An optional "Replaces an earlier Decision?" picker offers only the active
  matches. Choosing one supersedes it when the new Decision is saved, with the
  same rules as the web app; superseded or unlisted Decisions are never
  replaced. An optional **What changed?** explanation is kept on the replacement
  relationship and visible from both Decisions.
- A retried save that already applied the replacement still reports it, and a
  failed replacement does not block the save; the confirmation explains it.
- `/decide` opens its form immediately, so it skips this check.

## Ask Decision Memory

The **Ask Decision Memory** message shortcut uses the selected message as the
question; `/why <question>` uses the typed text. Both open a private Slack
window that shows "Searching stored Decisions…" and then up to five stored
Decisions scoring 60 or more, each with its status, Applies To, Why, a local
match explanation, and a link. Nothing is posted to the channel. Empty
questions, no matches, missing configuration, and search failures each show a
plain explanation. Search uses the local vector index without the former
200-decision cap. When indexing is pending, the response states indexed/total
coverage and offers retry or normal keyword search.

## Nudges

The bot speaks up, privately, in channels it is invited to. It receives new
messages through the Slack Events API (`/slack/events` on the Slack-only
listener; `message.channels` and `message.groups`).

- **Already decided.** A message that reads like a question about a past choice
  (English or Vietnamese, for example "Should we…?", "Why did we…", "Hồi trước
  mình… như thế nào") is sent to Search by memory against active Decisions. If
  the best match scores at least 75, only the asker sees "Already decided" with
  that one Decision and three buttons: **Open Decision**, **Share in thread**
  (a public reply in the thread, posted once), and **Not relevant**.
- **Save it?** A thread reply that sounds settled ("Agreed", "let's go with",
  "chốt", "thống nhất"; not questions or negations such as "chưa chốt") gets a
  private "Save it?" for its author. **Save as Decision** opens the same capture
  form as the message shortcut, with the reply as the selected message.

Rules:

- A cheap phrase check runs first and never calls AI. Only questions that pass
  it go to local semantic search, as question text of at most 500 characters.
  No search question or decision content is sent to an external AI service.
  Gemini is used only for the separately configured optional capture draft.
- At most one nudge of each kind per thread, recorded in `slack_nudges` with
  only the channel, thread, kind, and Decision. No message text is stored.
- A thread is never pointed to, or asked to save, a Decision it already
  produced.
- Bots, edits, joins, direct messages, other workspaces, and Slack retries are
  ignored. Any failure stays silent; nudges are best effort.
- To turn nudges off in a channel, remove the bot from it.

Because the bot reads every message in invited channels, use it only in the
synthetic demo workspace.

## Security And Reliability

- Verify every Slack request signature against the unmodified request body.
- Reject stale requests outside Slack's accepted timestamp window.
- Acknowledge commands, shortcuts, and view submissions within Slack's response
  deadline before performing slower work.
- Never log Slack tokens, signing secrets, or raw authorization headers.
- Store only the explicitly selected thread context required by this product
  contract.
- Scope saved data to the configured Slack workspace and mapped Jira workspace.
- Retain capture drafts for 24 hours for safe submission retries and remove
  expired drafts opportunistically during later captures.

## Deferred

- Multi-workspace Slack OAuth installation.
- Slack App Home.
- Global shortcuts beyond `/decide`.
- Notification delivery beyond the two private nudges.
- Choosing among several AI-detected decisions and saving more than one.

## P0 reliability boundary

The local API listens on loopback port 3011; expose only the separate Slack-only
listener on port 3012 through a tunnel. That listener has no API routes.
Blank or invalid submissions return field errors. Valid submissions immediately
receive a saving view before database work; completion updates that view with a
link, and failure restores the original inputs and retry identity. A process
restart during saving still requires retry; this MVP does not add a job queue.
Failed thread capture records INCOMPLETE and an unknown total, rather than
claiming that the selected message represents the full discussion.

Thread pagination stops at 100 messages and has a bounded overall retrieval
deadline. Message text and the separate anchor text share the 4,000-character
cap. The snapshot preserves channel name and separate text-truncation metadata.
Partial retrieval retains available messages and is visibly INCOMPLETE.
Owner text remains a recorded name, not an inferred account identity; the web
library offers those recorded names as separate owner filter options.
