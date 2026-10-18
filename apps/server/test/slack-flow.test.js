import assert from "node:assert/strict"
import crypto from "node:crypto"
import { once } from "node:events"
import { setTimeout as delay } from "node:timers/promises"
import { it } from "node:test"
import { createSlackApp } from "../src/app.js"
import { decisionInput } from "../src/validation.js"

const config = { slackBotToken: "test-token", slackSigningSecret: "test-secret", slackTeamId: "T1", localWorkspaceId: "test", appBaseUrl: "http://localhost:5173" }
const values = (title = "Use GCS", url = "https://example.com/DEMO-1") => ({ title: { value: { value: title } }, relatedUrl: { value: { value: url } } })
const submission = (state = values()) => ({ type: "view_submission", team: { id: "T1" }, user: { id: "U1" }, view: { id: "V1", callback_id: "decision_memory_save", private_metadata: JSON.stringify({ eventId: "T1:trigger" }), state: { values: state } } })

async function fixture(t, repository, response = async () => ({ ok: true, view: { id: "V1" } }), captureDrafter = { enabled: false, draft: async () => null }, memorySearch = { enabled: false }) {
  const realFetch = globalThis.fetch
  const calls = []
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.ok(init.signal, "Slack calls must have a deadline")
    calls.push({ method: url.split("/").at(-1), args: Object.fromEntries(init.body) })
    return { json: () => response(url, init) }
  })
  const server = createSlackApp({ config, repository: { setSlackCaptureDraftAi: async () => {}, ...repository }, captureDrafter, memorySearch }).listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const base = `http://127.0.0.1:${server.address().port}`
  async function send(payload, valid = true) {
    const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = "v0=" + crypto.createHmac("sha256", config.slackSigningSecret).update(`v0:${timestamp}:${body}`).digest("hex")
    return realFetch(`${base}/slack/interactions`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-slack-request-timestamp": timestamp, "x-slack-signature": valid ? signature : "bad" }, body })
  }
  return { calls, send, post: (path, init) => realFetch(base + path, { method: "POST", ...init }), get: (path) => realFetch(base + path) }
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(10) }
  assert.fail("Expected asynchronous Slack result was not delivered")
}

it("Slack ingress rejects unsigned/wrong-team traffic and never exposes the local API", async (t) => {
  const f = await fixture(t, {})
  assert.equal((await f.get("/api/decisions")).status, 404)
  assert.equal((await f.send(submission(), false)).status, 401)
  assert.equal((await f.send({ ...submission(), team: { id: "T2" } })).status, 403)
  assert.equal(f.calls.length, 0)
})

it("Slack keeps invalid submissions editable and shares web URL/title validation", async (t) => {
  const f = await fixture(t, { createDecision: () => assert.fail("Invalid submission reached persistence") })
  for (const [title, url, field] of [["   ", "https://example.com", "title"], ["Use GCS", "not a url", "relatedUrl"], ["x".repeat(501), "https://example.com", "title"], ["Use GCS", "javascript:alert(1)", "relatedUrl"]]) {
    const result = await (await f.send(submission(values(title, url)))).json()
    assert.equal(result.response_action, "errors")
    assert.ok(result.errors[field])
  }
  assert.equal(decisionInput.safeParse({ title: "Valid", references: [{ kind: "URL", url: "https://example.com" }] }).success, true)
  assert.equal(decisionInput.safeParse({ title: "Valid", references: [{ kind: "URL", url: "data:text/html,test" }] }).success, false)
})

it("opens a loading modal before fetching context and persists honest Agree fallback", async (t) => {
  let source
  const f = await fixture(t, { createSlackCaptureDraft: async (_identity, input) => { source = input.source; return { id: "draft" } } }, async (url) => url.endsWith("views.open") || url.endsWith("views.update") ? { ok: true, view: { id: "V1" } } : { ok: false, error: "thread_not_found" })
  const result = await f.send({ type: "message_action", callback_id: "save_as_decision", team: { id: "T1" }, user: { id: "U1" }, trigger_id: "trigger", channel: { id: "C1", name: "migration" }, message: { ts: "2", thread_ts: "1", text: "Agree" } })
  assert.equal(result.status, 200)
  await until(() => f.calls.some((call) => call.method === "views.update"))
  assert.equal(f.calls[0].method, "views.open")
  assert.equal(source.captureStatus, "INCOMPLETE")
  assert.equal(source.totalMessageCount, null)
  assert.equal(source.captureTruncated, true)
  assert.equal(source.messages[0].text, "Agree")
  assert.match(f.calls.at(-1).args.view, /Thread capture was incomplete/)
  assert.doesNotMatch(f.calls.at(-1).args.view, /AI drafting unavailable/)
})

it("acknowledges before a slow save and preserves the retry identity", async (t) => {
  let release
  const pending = new Promise((resolve) => { release = resolve })
  const keys = []
  const f = await fixture(t, { createDecision: async (_identity, _input, extras) => { keys.push(extras.idempotencyKey); await pending; return { id: "d1", decisionKey: "DM-1" } } })
  const result = await (await f.send(submission())).json()
  assert.equal(result.response_action, "update")
  assert.equal(result.view.title.text, "Saving Decision…")
  assert.equal(f.calls.length, 0)
  release()
  await until(() => f.calls.some((call) => call.args.view?.includes("Decision saved")))
  await f.send(submission())
  await until(() => keys.length === 2)
  assert.deepEqual(keys, ["T1:trigger", "T1:trigger"])
})

it("failed save restores entered values and the original retry key", async (t) => {
  const f = await fixture(t, { createDecision: async () => { throw new Error("Database unavailable") } })
  assert.equal((await (await f.send(submission())).json()).response_action, "update")
  await until(() => f.calls.length > 0)
  const view = JSON.parse(f.calls[0].args.view)
  assert.match(JSON.stringify(view), /Save could not be confirmed/)
  assert.equal(view.blocks.find((block) => block.block_id === "title").element.initial_value, "Use GCS")
  assert.equal(view.blocks.find((block) => block.block_id === "relatedUrl").element.initial_value, "https://example.com/DEMO-1")
  assert.equal(JSON.parse(view.private_metadata).eventId, "T1:trigger")
})

it("a stalled Slack context request times out and degrades without losing the anchor", async (t) => {
  let source
  const f = await fixture(t, { createSlackCaptureDraft: async (_identity, input) => { source = input.source; return { id: "draft" } } }, async (url, init) => {
    if (url.endsWith("conversations.replies")) {
      return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("Timed out")), { once: true }))
    }
    return { ok: true, view: { id: "V1" } }
  })
  await f.send({ type: "message_action", callback_id: "save_as_decision", team: { id: "T1" }, user: { id: "U1" }, trigger_id: "trigger", channel: { id: "C1" }, message: { ts: "1", text: "Keep the anchor" } })
  assert.equal(f.calls[0].method, "views.open")
  await delay(2_100)
  await until(() => Boolean(source))
  assert.equal(source.captureStatus, "INCOMPLETE")
  assert.equal(source.anchorText, "Keep the anchor")
})

const aiDraft = {
  outcome: "DECISION", decision: "Use GCS for migration backup files", why: "Backups reach tens of GB.",
  context: "Compared PostgreSQL and GCS.", appliesTo: ["Migration Service"], optionsConsidered: ["PostgreSQL", "GCS"],
  owner: "Maya", tags: ["migration", "storage"],
  otherPossibleDecisions: ["Keep metadata in PostgreSQL"], relevantMessageIds: ["2"], confidence: "high",
}
const thread = async (url) => url.endsWith("conversations.replies")
  ? { ok: true, messages: [{ ts: "1", text: "PostgreSQL or GCS?", user: "U1", reply_count: 1 }, { ts: "2", thread_ts: "1", text: "Let's use GCS", user: "U2" }] }
  : { ok: true, view: { id: "V1" }, permalink: "https://example.slack.com/p2" }
const shortcut = { type: "message_action", callback_id: "save_as_decision", team: { id: "T1" }, user: { id: "U1" }, trigger_id: "trigger", channel: { id: "C1", name: "migration" }, message: { ts: "2", thread_ts: "1", text: "Let's use GCS", user: "U2" } }

it("pre-fills the modal from the AI draft without the review notice", async (t) => {
  let saved
  let drafted
  const drafter = { enabled: true, draft: async (messages) => { drafted = messages; return aiDraft } }
  const f = await fixture(t, { createSlackCaptureDraft: async (_identity, input) => { saved = input.source; return { id: "draft" } }, setSlackCaptureDraftAi: async (_identity, _id, draft) => { saved.aiDraft = draft } }, thread, drafter)
  await f.send(shortcut)
  await until(() => f.calls.some((call) => call.method === "views.update" && call.args.view.includes("decision_memory_save")))
  assert.match(f.calls[0].args.view, /drafting the Decision with AI/)
  assert.deepEqual(drafted.map((message) => message.timestamp), ["1", "2"])
  const view = JSON.parse(f.calls.find((call) => call.method === "views.update" && call.args.view.includes("decision_memory_save")).args.view)
  const initial = (id) => view.blocks.find((block) => block.block_id === id)?.element.initial_value
  assert.equal(initial("title"), "Use GCS for migration backup files")
  assert.equal(initial("why"), "Backups reach tens of GB.")
  assert.equal(initial("appliesTo"), "Migration Service")
  assert.equal(initial("options"), "PostgreSQL\nGCS")
  assert.equal(initial("owner"), "Maya")
  assert.equal(view.blocks.some((block) => block.block_id === "team"), false, "Team is deferred; the channel is captured instead")
  assert.equal(initial("tags"), "migration, storage")
  assert.doesNotMatch(JSON.stringify(view), /AI draft from the captured thread|Review and edit every field/)
  assert.match(JSON.stringify(view), /Other possible decisions in this thread: Keep metadata in PostgreSQL/)
  assert.ok(view.blocks.every((block) => block.text?.type !== "mrkdwn" || !block.text.text.includes("tens of GB")))
  assert.deepEqual(saved.aiDraft, { outcome: "DECISION", confidence: "high", relevantMessageIds: ["2"] })
  assert.equal(saved.channelName, "migration")
})

it("says when AI found no clear Decision and keeps the selected message", async (t) => {
  const drafter = { enabled: true, draft: async () => ({ ...aiDraft, outcome: "NO_CLEAR_DECISION", decision: "", why: "", context: "", appliesTo: [], owner: "", tags: [], otherPossibleDecisions: [] }) }
  const f = await fixture(t, { createSlackCaptureDraft: async () => ({ id: "draft" }) }, thread, drafter)
  await f.send(shortcut)
  await until(() => f.calls.some((call) => call.method === "views.update" && call.args.view.includes("decision_memory_save")))
  const view = JSON.parse(f.calls.find((call) => call.method === "views.update" && call.args.view.includes("decision_memory_save")).args.view)
  assert.equal(view.blocks.find((block) => block.block_id === "title").element.initial_value, "Let's use GCS")
  assert.match(JSON.stringify(view), /AI found no clear final Decision in this thread\. Write the Decision yourself\.\\nOptions discussed: PostgreSQL; GCS/)
  assert.doesNotMatch(JSON.stringify(view), /AI drafting unavailable/)
})

it("opens the plain form when the AI draft is unavailable", async (t) => {
  const drafter = { enabled: true, draft: async () => null }
  const f = await fixture(t, { createSlackCaptureDraft: async () => ({ id: "draft" }) }, thread, drafter)
  await f.send(shortcut)
  await until(() => f.calls.some((call) => call.method === "views.update" && call.args.view.includes("decision_memory_save")))
  const view = JSON.parse(f.calls.find((call) => call.method === "views.update" && call.args.view.includes("decision_memory_save")).args.view)
  assert.equal(view.blocks.find((block) => block.block_id === "title").element.initial_value, "Let's use GCS")
  assert.equal(view.blocks.some((block) => block.block_id === "options"), false)
  assert.match(JSON.stringify(view), /AI drafting unavailable—please complete the fields manually\./)
})

it("saves the reviewed options and records that AI drafted the form", async (t) => {
  let saved
  const draft = { externalEventId: "T1:trigger", slackUserId: "U1", slackTeamId: "T1", source: { provider: "SLACK", channelId: "C1", channelName: "migration", messages: [], aiDraft: { outcome: "DECISION", confidence: "high", relevantMessageIds: ["2"] } } }
  const f = await fixture(t, {
    getSlackCaptureDraft: async () => draft,
    createDecision: async (_identity, input, extras) => { saved = { input, extras }; return { id: "d1", decisionKey: "DM-1" } },
  })
  const state = { ...values(), options: { value: { value: "PostgreSQL\n GCS \n" } } }
  const payload = submission(state)
  payload.view.private_metadata = JSON.stringify({ draftId: "draft" })
  await f.send(payload)
  await until(() => Boolean(saved))
  assert.deepEqual(saved.input.optionsConsidered, ["PostgreSQL", "GCS"])
  assert.deepEqual(saved.extras.source.sourceContext.aiDraft, draft.source.aiDraft)
  assert.equal(saved.extras.source.channelName, "migration")
})

it("/decide records the channel it was run in", async (t) => {
  let saved
  const f = await fixture(t, {
    createDecision: async (_identity, input, extras) => { saved = extras; return { id: "d1", decisionKey: "DM-1" } },
  })
  // Slash commands arrive as plain form fields rather than a JSON payload.
  const body = new URLSearchParams({ command: "/decide", text: "Use GCS", team_id: "T1", user_id: "U1", channel_id: "C9", channel_name: "migration", trigger_id: "cmd-trigger" }).toString()
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = "v0=" + crypto.createHmac("sha256", config.slackSigningSecret).update(`v0:${timestamp}:${body}`).digest("hex")
  const opened = await f.post("/slack/interactions", { headers: { "content-type": "application/x-www-form-urlencoded", "x-slack-request-timestamp": timestamp, "x-slack-signature": signature }, body })
  assert.equal(opened.status, 200)
  await until(() => f.calls.some((call) => call.method === "views.open"))
  const view = JSON.parse(f.calls.find((call) => call.method === "views.open").args.view)
  assert.match(JSON.stringify(view), /The channel \(#migration\), user, and submission time will be recorded/)
  const payload = submission()
  payload.view.private_metadata = view.private_metadata
  await f.send(payload)
  await until(() => Boolean(saved))
  assert.equal(saved.source.channelName, "migration")
  assert.equal(saved.source.externalChannelId, "C9")
})

const stored = (id, decisionKey, title, status = "ACTIVE", extra = {}) => ({
  id, decisionKey, title, status, appliesTo: ["Migration Service"], why: "Backups reach <tens> of GB & more.", ...extra,
})
const searchReturning = (matches, seen = []) => ({
  enabled: true,
  search: async (_identity, input) => { seen.push(input.query); return { candidateCount: 9, matches } },
})
const lastView = (f, method = "views.update") => JSON.parse(f.calls.filter((call) => call.method === method).at(-1).args.view)

async function sendCommand(f, fields) {
  const body = new URLSearchParams({ team_id: "T1", user_id: "U1", trigger_id: "cmd-trigger", ...fields }).toString()
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = "v0=" + crypto.createHmac("sha256", config.slackSigningSecret).update(`v0:${timestamp}:${body}`).digest("hex")
  return f.post("/slack/interactions", { headers: { "content-type": "application/x-www-form-urlencoded", "x-slack-request-timestamp": timestamp, "x-slack-signature": signature }, body })
}

it("Ask Decision Memory answers privately with stored Decisions and escapes their text", async (t) => {
  const seen = []
  const memorySearch = searchReturning([
    { decisionId: "d104", score: 95, explanation: "It moved <large> files off the database.", matchedConcepts: [], decision: stored("d104", "DM-104", "Use object storage for migration backups") },
    { decisionId: "d102", score: 70, explanation: "Earlier choice.", matchedConcepts: [], decision: stored("d102", "DM-102", "Store exports on the database host", "SUPERSEDED", {
      supersededBy: [{ id: "d104", decisionKey: "DM-104", title: "Use object storage for migration backups", decisionState: "DECIDED", status: "ACTIVE" }],
    }) },
    { decisionId: "d110", score: 30, explanation: "Weak.", matchedConcepts: [], decision: stored("d110", "DM-110", "Keep customer uploads out of PostgreSQL") },
  ], seen)
  const f = await fixture(t, {}, undefined, undefined, memorySearch)
  await f.send({ type: "message_action", callback_id: "ask_decision_memory", team: { id: "T1" }, user: { id: "U1" }, trigger_id: "ask", channel: { id: "C1" }, message: { ts: "9", text: "why did <@U2> pick object storage for migration?" } })
  await until(() => f.calls.some((call) => call.method === "views.update"))
  assert.equal(f.calls[0].method, "views.open")
  assert.match(f.calls[0].args.view, /Searching stored Decisions/)
  assert.deepEqual(seen, ["why did @U2 pick object storage for migration?"])
  const text = JSON.stringify(lastView(f))
  assert.match(text, /<http:\/\/localhost:5173\/#\/decisions\/d104\|DM-104 · Use object storage for migration backups>/)
  assert.match(text, /Active · Applies to Migration Service/)
  assert.match(text, /Superseded/)
  assert.match(text, /\*Replaced by:\* <http:\/\/localhost:5173\/#\/decisions\/d104\|DM-104 · Use object storage for migration backups>/, "A superseded match names its replacement")
  assert.match(text, /Backups reach &lt;tens&gt; of GB &amp; more\./)
  assert.match(text, /It moved &lt;large&gt; files off the database\./)
  assert.doesNotMatch(text, /DM-110/, "Weak matches are left out of the answer")
  assert.equal(f.calls.some((call) => call.method.startsWith("chat.")), false, "Nothing is posted to the channel")
})

it("/why asks the same way and explains empty questions, no matches, and outages", async (t) => {
  // One fixture; the fake search changes between questions.
  const memorySearch = { enabled: true, search: async () => ({ candidateCount: 9, matches: [] }) }
  const f = await fixture(t, {}, undefined, undefined, memorySearch)
  const ask = async (text) => {
    const before = f.calls.filter((call) => call.method === "views.update").length
    await sendCommand(f, { command: "/why", text })
    await until(() => f.calls.filter((call) => call.method === "views.update").length > before)
    return JSON.stringify(lastView(f))
  }
  assert.match(await ask("do we use postgres?"), /No stored Decision matches this/)
  assert.match(await ask(""), /Ask a question after \/why/)
  memorySearch.search = async () => { throw new Error("503") }
  assert.match(await ask("why postgres?"), /Search is unavailable right now/)
  memorySearch.enabled = false
  assert.match(await ask("why postgres?"), /not configured/)
})

it("Already decided? lists similar Decisions and offers only active ones to replace", async (t) => {
  const seen = []
  const memorySearch = searchReturning([
    { decisionId: "d104", score: 92, explanation: "", matchedConcepts: [], decision: stored("d104", "DM-104", "Use object storage for migration backups") },
    { decisionId: "d102", score: 80, explanation: "", matchedConcepts: [], decision: stored("d102", "DM-102", "Store exports on the database host", "SUPERSEDED") },
    { decisionId: "d105", score: 40, explanation: "", matchedConcepts: [], decision: stored("d105", "DM-105", "Weak match") },
  ], seen)
  const drafter = { enabled: true, draft: async () => aiDraft }
  const f = await fixture(t, { createSlackCaptureDraft: async () => ({ id: "draft" }) }, thread, drafter, memorySearch)
  await f.send(shortcut)
  await until(() => f.calls.some((call) => call.method === "views.update" && call.args.view.includes("decision_memory_save")))
  assert.deepEqual(seen, ["Use GCS for migration backup files"], "The AI-drafted Decision is the search query")
  const view = lastView(f)
  const text = JSON.stringify(view)
  assert.match(text, /Already decided\?/)
  assert.match(text, /Applies to:/)
  assert.match(text, /Why:/)
  assert.ok(view.private_metadata.length < 3000, "Richer suggestions must remain within Slack metadata limits")
  assert.match(text, /DM-104 · Use object storage for migration backups> \(Active\)/)
  assert.match(text, /DM-102 · Store exports on the database host> \(Superseded\)/)
  assert.doesNotMatch(text, /DM-105/, "Weak matches are not shown")
  const picker = view.blocks.find((block) => block.block_id === "replaces")
  assert.deepEqual(picker.element.options.map((option) => option.value), ["d104"])
  assert.deepEqual(JSON.parse(view.private_metadata).similar.map((item) => item.id), ["d104", "d102"])
})

it("saving with Replaces supersedes only an offered active Decision, and retries succeed", async (t) => {
  const superseded = []
  let alreadyApplied = false
  const repository = {
    getSlackCaptureDraft: async () => ({ externalEventId: "T1:trigger", slackUserId: "U1", slackTeamId: "T1", source: { provider: "SLACK", channelId: "C1", channelName: "migration", messages: [] } }),
    createDecision: async () => ({ id: "new", decisionKey: "DM-112" }),
    supersedeDecision: async (_identity, currentId, targetId, replacementReason) => {
      if (alreadyApplied) throw new Error("Only active decisions can participate in a new supersession.")
      superseded.push([currentId, targetId, replacementReason])
      alreadyApplied = true
    },
    getDecision: async () => ({ lifecycle: { supersedes: [{ id: "d104" }] } }),
  }
  const f = await fixture(t, repository)
  const similar = [{ id: "d104", decisionKey: "DM-104", title: "Use object storage", status: "ACTIVE" }, { id: "d102", decisionKey: "DM-102", title: "Old", status: "SUPERSEDED" }]
  const save = (replaces) => {
    const payload = submission({ ...values(), replacementReason: { value: { value: "  Backups outgrew the local disk.  " } }, replaces: { value: { selected_option: { value: replaces } } } })
    payload.view.private_metadata = JSON.stringify({ draftId: "draft", similar })
    return f.send(payload)
  }
  const saved = () => f.calls.filter((call) => call.args.view?.includes("Decision saved"))

  await save("d104")
  await until(() => saved().length === 1)
  assert.deepEqual(superseded, [["new", "d104", "Backups outgrew the local disk."]])
  assert.match(saved()[0].args.view, /It replaces DM-104, which is now superseded/)

  await save("d104")
  await until(() => saved().length === 2)
  assert.match(saved()[1].args.view, /It replaces DM-104/, "A retried save reports the replacement it already made")

  await save("d102")
  await until(() => saved().length === 3)
  await save("not-offered")
  await until(() => saved().length === 4)
  assert.equal(superseded.length, 1, "Superseded or unoffered Decisions are never replaced")
})


it("manual capture can save while AI is blocked, and late AI cannot overwrite the saved view", async (t) => {
  let release
  const pending = new Promise((resolve) => { release = resolve })
  let draft
  let saved
  let currentView
  let revision = 0
  let staleUpdates = 0
  const f = await fixture(t, {
    createSlackCaptureDraft: async (_identity, input) => (draft = { ...input, id: "draft" }),
    getSlackCaptureDraft: async () => draft,
    setSlackCaptureDraftAi: async (_identity, _id, ai) => { draft.source.aiDraft = ai },
    createDecision: async (_identity, input, extras) => { saved = { input, extras }; return { id: "d1", decisionKey: "DM-1" } },
  }, async (url, init) => {
    if (url.endsWith("views.open") || url.endsWith("views.update")) {
      const hash = init.body.get("hash")
      if (hash && hash !== String(revision)) { staleUpdates++; return { ok: false, error: "hash_conflict" } }
      currentView = JSON.parse(init.body.get("view"))
      return { ok: true, view: { id: "V1", hash: String(++revision) } }
    }
    return thread(url)
  }, { enabled: true, draft: async () => { await pending; return aiDraft } })
  await f.send(shortcut)
  await until(() => currentView?.title.text === "Optional AI assistance")
  const waiting = currentView
  await f.send({ type: "block_actions", team: { id: "T1" }, user: { id: "U1" },
    actions: [{ action_id: "capture_continue_manually" }],
    view: { id: "V1", hash: String(revision), private_metadata: waiting.private_metadata } })
  await until(() => currentView?.callback_id === "decision_memory_save")
  assert.equal(currentView.blocks.find((block) => block.block_id === "title").element.initial_value, "Let's use GCS")
  const payload = submission(values("My manually confirmed Decision"))
  payload.view.private_metadata = currentView.private_metadata
  await f.send(payload)
  await until(() => currentView?.title.text === "Decision saved")
  release()
  await until(() => staleUpdates === 1)
  assert.equal(currentView.title.text, "Decision saved", "Late AI must not replace a manually opened/submitted form")
  assert.equal(saved.input.title, "My manually confirmed Decision")
  assert.equal(saved.extras.source.messages.length, 2, "Manual bypass must retain the captured discussion")
  assert.equal(saved.extras.source.sourceContext.aiDraft, undefined, "Manual capture must not claim the person reviewed AI output")
})


it("rejects an oversized replacement reason before saving a Slack Decision", async (t) => {
  const f = await fixture(t, { createDecision: async () => assert.fail("Invalid replacement explanation must not save") })
  const response = await (await f.send(submission({ ...values(), replacementReason: { value: { value: "x".repeat(2001) } } }))).json()
  assert.equal(response.response_action, "errors")
  assert.match(response.errors.replacementReason, /2,000 characters/)
})
