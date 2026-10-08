# Decision Memory

> Capture decisions where they happen. Find them when the exact words are gone.

Decision Memory is a competition-focused local web application that turns a
Slack discussion into a durable, structured Decision. Later, a teammate can
retrieve that Decision through fast keyword/metadata search or an explicit
Gemini-assisted **Search by memory** action.

The MVP intentionally uses a small architecture:

```text
Slack shortcut or /decide
          │
          ▼
Express API ───── PostgreSQL
          │
          ▼
React application in the local browser (Forge deployment is deferred)
```

## What the MVP demonstrates

- Save a Slack message and up to 100 messages from only its selected thread.
- Preserve the anchor, author display names, permalink, capture counts, and
  truncation status even if Slack history later disappears.
- Store Slack capture data in a 24-hour PostgreSQL draft before opening the
  confirmation modal, avoiding Slack `private_metadata` size limits.
- Browse, create, edit, filter, and supersede Decisions. Owner filters include
  separately labeled recorded Slack names as well as linked users.
- Search immediately with PostgreSQL keywords and metadata.
- Explicitly search by an imprecise or cross-language memory with Gemini.
- Ground every AI match in an authoritative stored Decision and its evidence.
- Ask from Slack: the **Ask Decision Memory** shortcut and `/why` answer
  privately with stored Decisions.
- Catch repeats: saving from Slack shows similar Decisions already on record and
  can mark one as replaced.
- Create a Jira issue from a Decision; its key is saved under Related Work.
- Nudges: in channels it is invited to, the bot privately answers a question
  that was already decided and suggests saving a thread that reached a decision.

Other notifications, graphs, analytics, embeddings, and extra integrations are
intentionally outside this MVP.

## Technology

- React 18, TypeScript, Vite, Tailwind CSS, and shadcn/Base UI
- Express 5
- PostgreSQL 17 and Sequelize
- Jira Forge Custom UI with a Forge Remote backend
- Slack Web API
- Official `@google/genai` SDK

## Quick start

### Prerequisites

- Node.js 22 or newer
- npm
- Docker Desktop with Docker Compose

Gemini, Slack, and Forge credentials are optional for the basic local demo.

### 1. Install dependencies

From the repository root:

```bash
npm install
```

The repository already contains a local `.env`. For a fresh clone where it is
missing, create it from the template:

```bash
cp .env.example .env
```

Do not overwrite an existing `.env`, because it may contain your local
credentials.

### 2. Start PostgreSQL

```bash
npm run db:up
```

Wait until the database reports `healthy`:

```bash
docker compose ps
```

Then apply the schema and load the nine synthetic demo Decisions:

```bash
npm run db:schema
npm run db:seed
```

Both SQL files are idempotent and can safely be applied again.

### 3. Start the API

In a second terminal:

```bash
npm run dev:server
```

Expected output:

```text
Decision Memory API listening on http://localhost:3011
```

Optional health check:

```bash
curl http://localhost:3011/health
```

### 4. Start the web application

In a third terminal:

```bash
npm run dev:web
```

Open [http://localhost:5173](http://localhost:5173). You should see the
**Decision Library** with nine seeded Decisions.

### 5. Stop the local application

Stop the API and frontend with `Ctrl+C` in their terminals. Stop PostgreSQL with:

```bash
npm run db:down
```

This preserves the Docker database volume and its data.

## Try the demo locally

The basic demo requires no external credentials:

1. Search for `migration storage` to exercise normal PostgreSQL search. Every
   word must appear somewhere in a Decision, its tags, or its captured
   discussion, in any order.
2. Open **Use object storage for migration backup files**.
3. Review the anchor and nearby Slack messages.
4. Select **View captured discussion (7)** to see the durable snapshot.
5. Create or edit a Decision and attach multiple Jira or generic links.
6. Find `DM-102 · Superseded by DM-104` in the library, or open it through
   the lifecycle section.

Without `GEMINI_API_KEY`, the **Search by memory** button is visibly disabled
and normal search continues to work.

## Enable Search by memory

Add your Gemini key to `.env`:

```text
GEMINI_API_KEY=your_key_here
```

Restart the API after changing `.env`. Then try this demo query:

```text
Hồi trước mình xử lý file migration lớn hay timeout như thế nào?
```

This wording shares no exact title with the expected Decision, but should rank
`DM-104` highly by meaning.

Memory search behavior:

- It runs only after the user selects **Search by memory**—never per keystroke.
- Current channel, owner, tag, status, scope, and date filters are applied first.
- At most 200 Decisions from the current workspace are sent as bounded cards.
- Gemini may return at most five structured matches.
- Returned IDs are checked against the candidate set; unknown IDs are ignored.
- AI explanations are display-only and are never persisted.
- Timeout, rate-limit, network, or malformed-output failures leave normal search
  usable and show a retry message.

The same key also turns on the **AI draft** in Slack: Save as Decision sends the
selected thread (at most 60 messages) to Gemini, which pre-fills Decision, Why,
Context, Applies To, and Options Considered for review. It can say that no clear
Decision was found, nothing is saved until you click Save, and any Gemini
failure opens the plain form with a manual-entry notice. Transient failures and
invalid output retry once, within a 17-second total AI drafting budget. See
[Slack capture](docs/product/slack-capture.md).

Use only synthetic or explicitly sanitized demo data with the configured Gemini
account. With a key set, every Slack capture sends its thread to Gemini, so do
not connect a workspace with confidential conversations.

## Connect Slack locally

The Slack manifest is [slack/manifest.yml](slack/manifest.yml). It defines:

- the **Save as Decision** and **Ask Decision Memory** message shortcuts;
- the `/decide` and `/why` slash commands;
- `@Decision Memory decide`, which works in threads where Slack does not allow
  slash commands;
- message events from channels the bot is in, for nudges;
- the history, channel, chat, and `users:read` scopes required by the demo.

To test Slack against the local API:

1. Start PostgreSQL and the API.
2. Expose **only port `3012`** through an HTTPS tunnel. This listener accepts
   signed Slack interactions and has no Decision API. Never tunnel port `3011`,
   which uses the local synthetic identity.
3. In `slack/manifest.yml`, point the interaction URLs at the tunnel URL
   ending in `/slack/interactions`, and the event subscription at the one
   ending in `/slack/events`.
4. Create or update the Slack app from the manifest.
5. Add these values to `.env`:

   ```text
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_SIGNING_SECRET=...
   SLACK_TEAM_ID=T...
   ```

6. Restart the API.
7. Install the app in the configured demo workspace and invite the bot to the
   channel used for testing.
8. Open a thread and select **More actions → Save as Decision**, or type
   `@Decision Memory decide` in the thread and click **Save as Decision**. In a
   channel (not a thread), `/decide Use object storage for migration backup
   files` opens the form directly.
9. To ask, select **More actions → Ask Decision Memory** on a question, or run
   `/why do we use object storage for migration backups?`.

10. For nudges, ask "Should we keep migration backups in Postgres?" in a
    channel with the bot, or reply "Agreed, let's go with Cloud Run." in a
    thread. Only you see the reply. See [Slack capture](docs/product/slack-capture.md#nudges).

When you change the manifest (for example to add the Ask shortcut, `/why`, or
event subscriptions), paste it into the Slack app's **App Manifest** page again
and save. Slack verifies the events URL, so the API must be running, and asks
you to reinstall the app for new events.

The message shortcut captures only the explicitly selected thread. It keeps up
to 100 messages, follows reply pages up to the 100-message cap, caps each message at 4,000
characters, always retains the
selected anchor, and looks up display names only for the thread's authors and
mentioned people (never the whole workspace directory), falling back to Slack
user IDs when a name cannot be resolved. Mentions, channel references, and
links are saved as readable text. A related Jira URL is labelled by its issue
key, for example `MIG-182`. If Slack refuses the thread request (for example, the bot was not
invited to the channel), the modal still opens and saves the selected message
alone. The modal opens before context retrieval. Incomplete capture is visibly disclosed.
Saving immediately shows a progress view, then a saved-Decision link or a form
with the original entries for retry. Drafts remain available for 24 hours so
modal retries are idempotent.

## Configuration

`.env` and `.env.example` contain only user-supplied integration values:

| Variable | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Token for the installed demo Slack app |
| `SLACK_SIGNING_SECRET` | Verifies incoming Slack requests |
| `SLACK_TEAM_ID` | Restricts capture to the intended workspace (starts with `T`) |
| `GEMINI_API_KEY` | Optional AI features, synthetic/sanitized data only |
| `JIRA_BASE_URL` | Optional Jira Cloud site, for example `https://acme.atlassian.net` |
| `JIRA_EMAIL` | Atlassian account email that owns the API token |
| `JIRA_API_TOKEN` | Atlassian API token used only by the server to create issues |

Leave these empty until credentials are available. Basic local web operation
requires none of them. Never commit `.env`.

Local defaults live in `apps/server/src/config.js`: API port 3011, Slack-only
port 3012, frontend/confirmation URL `http://localhost:5173`, local Docker
PostgreSQL URL, synthetic identity, and Gemini model. The local browser API URL
and deferred Forge transport switch live in `apps/web/src/lib/api.ts`.
No local port, identity, model, or frontend toggle needs an environment entry.

The confirmation link opens on the presentation computer; it is not a public
shared demo URL. Update the code constant if the demo location changes.

## Deferred Forge deployment

The Forge manifest and transport are retained, but the competition rehearsal
uses the local browser. A future deployment needs a verified Slack-to-Forge
workspace mapping, Forge identity testing, and a public authenticated backend.
Supply `NODE_ENV=production`, `DATABASE_URL`, `FORGE_APP_ID`, and manifest
`FORGE_REMOTE_BASE_URL` through that deployment environment, not the local demo
`.env`. Synthetic identity is disabled outside development. Enable the frontend
Forge transport constant only after that integration is verified.

## Validation

Run the fast checks at any time:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

With PostgreSQL running and seeded:

```bash
npm run test:integration
```

This verifies Slack draft persistence, expiry cleanup, workspace isolation,
concurrent retry idempotency, durable source storage, multi-word search, tag
filtering, current filters, superseded candidates, multiple references, and
owner scope, cross-workspace API rejection, transaction rollback, and concurrent
supersession. Signed HTTP fixtures exercise capture through database-backed
search/detail while mocking only the outbound Slack service.

With PostgreSQL, the API, and the frontend running:

```bash
npm run test:ui
```

The browser test independently checks keyword and mocked memory search,
collapsed/expanded evidence, create/edit behavior with key-by-key typing,
lifecycle controls, desktop and mobile layouts, browser console errors, failed detail/edit loads, form reset, and stale AI
responses. It
removes its workspace-scoped form fixture before and after the run, so the demo dataset stays
at nine Decisions. It currently expects Google Chrome at the standard macOS
application path.

## Project structure

```text
apps/web/                   React Custom UI
apps/server/                Express API, Slack handlers, Gemini integration
db/schema.sql               Idempotent PostgreSQL schema
db/seed.sql                 Synthetic competition demo data
slack/manifest.yml          Slack app definition
manifest.yml                Jira Forge app definition
scripts/                    Integration and browser verification
docs/                       Product, design, architecture, and active plan
decision-memory-final-spec.md
```

## Troubleshooting

### PostgreSQL is not ready

```bash
docker compose ps
docker compose logs postgres
```

Confirm Docker Desktop is running and port `5434` is available. If schema setup
runs before the health check passes, wait and run `npm run db:schema` again.

### The API cannot connect to PostgreSQL

The development connection constant in `apps/server/src/config.js` is:

```text
DATABASE_URL=postgresql://decision_memory:decision_memory@localhost:5434/decision_memory
```

Then verify the container is healthy with `docker compose ps`.

### Search by memory is disabled

Set a non-empty `GEMINI_API_KEY` in `.env` and restart the API. The frontend
learns availability from `/api/metadata`; no frontend key is required.

### Slack reports an invalid signature

Confirm the signing secret belongs to the installed Slack app and that Slack is
calling the exact HTTPS tunnel URL configured in the manifest. The server
intentionally rejects stale or modified request bodies.

### Port already in use

The expected ports are:

- `5173` for Vite;
- `3011` for the private local API;
- `3012` for the Slack-only tunnel target;
- `5434` for PostgreSQL.

Stop the conflicting local process or update the code constants and Docker Compose configuration consistently.

## Product and implementation references

- [Final product specification](decision-memory-final-spec.md)
- [Active execution plan](docs/plans/active/build-decision-memory-mvp.md)
- [Slack capture contract](docs/product/slack-capture.md)
- [Repository documentation map](docs/README.md)

## Current boundary

Local implementation is validated separately from external integrations.
Search by memory and the AI draft have been run against the real Gemini API with
synthetic data, and Slack capture works in the demo workspace through a
Tailscale tunnel. No deployment workflow is included.
