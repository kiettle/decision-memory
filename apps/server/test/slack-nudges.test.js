import assert from "node:assert/strict"
import crypto from "node:crypto"
import { once } from "node:events"
import { setTimeout as delay } from "node:timers/promises"
import { describe, it } from "node:test"

import { createSlackApp } from "../src/app.js"
import { looksLikeDecision, looksLikeQuestion } from "../src/nudges.js"

const config = { slackBotToken: "test-token", slackSigningSecret: "test-secret", slackTeamId: "T1", localWorkspaceId: "test", appBaseUrl: "http://localhost:5173" }
const decision = {
  id: "44444444-4444-4444-8444-444444444404",
  decisionKey: "DM-104",
  title: "Use object storage for migration backup files",
  status: "ACTIVE",
  appliesTo: ["Migration Service"],
  why: "Large files <timed out> in the database.",
}
const thread = [
  { ts: "1.0", user: "U2", text: "Cloud Run or GKE for the worker?" },
  { ts: "1.1", user: "U1", text: "Agreed, let's go with Cloud Run." },
]

function slackResponse(url) {
  if (url.endsWith("users.info")) return { ok: true, user: { name: "linh" } }
  if (url.endsWith("views.open")) return { ok: true, view: { id: "V1" } }
  if (url.endsWith("conversations.replies")) return { ok: true, messages: thread }
  return { ok: true }
}

// A fake repository that keeps nudge claims in memory, like the unique index.
function fakeRepository(overrides = {}) {
  const claims = new Set()
  return {
    claims,
    decisionIdsForThread: async () => [],
    claimSlackNudge: async (_identity, { channelId, threadTs, kind }) => {
      const key = `${channelId}:${threadTs}:${kind}`
      if (claims.has(key)) return false
      claims.add(key)
      return true
    },
    getDecision: async (_identity, id) => (id === decision.id ? decision : null),
    createSlackCaptureDraft: async () => ({ id: "draft" }),
    ...overrides,
  }
}

function fakeSearch(score = 92) {
  const searches = []
  return {
    searches,
    service: {
      enabled: true,
      search: async (_identity, input) => {
        searches.push(input)
        return { matches: [{ decision, score, explanation: "Same backup choice." }] }
      },
    },
  }
}

async function fixture(t, { repository = fakeRepository(), memorySearch = { enabled: false } } = {}) {
  const realFetch = globalThis.fetch
  const calls = []
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.ok(init.signal, "Slack calls must have a deadline")
    const args = typeof init.body === "string" ? JSON.parse(init.body) : Object.fromEntries(init.body)
    calls.push({ url, method: url.split("/").at(-1), args })
    return { json: async () => slackResponse(url) }
  })
  const captureDrafter = { enabled: false, draft: async () => null }
  const server = createSlackApp({ config, repository, memorySearch, captureDrafter }).listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const base = `http://127.0.0.1:${server.address().port}`
  const signed = (body) => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    return { "x-slack-request-timestamp": timestamp, "x-slack-signature": "v0=" + crypto.createHmac("sha256", config.slackSigningSecret).update(`v0:${timestamp}:${body}`).digest("hex") }
  }
  async function sendEvent(body, { valid = true, headers = {} } = {}) {
    const raw = JSON.stringify(body)
    const signature = valid ? signed(raw) : { "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)), "x-slack-signature": "bad" }
    return realFetch(`${base}/slack/events`, { method: "POST", headers: { "content-type": "application/json", ...signature, ...headers }, body: raw })
  }
  async function click(payload) {
    const raw = new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
    return realFetch(`${base}/slack/interactions`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...signed(raw) }, body: raw })
  }
  return { calls, sendEvent, click, posted: (method) => calls.filter((call) => call.method === method) }
}

const message = (fields) => ({ type: "event_callback", team_id: "T1", event_id: "Ev1", event: { type: "message", channel: "C1", channel_type: "channel", user: "U1", ts: "2.0", ...fields } })
const button = (actionId, value, responseUrl = "https://hooks.slack.com/actions/T1/1/abc") => ({
  type: "block_actions", team: { id: "T1" }, user: { id: "U1", name: "linh" }, trigger_id: "trigger-1",
  channel: { id: "C1", name: "platform-decisions" }, container: { type: "message", channel_id: "C1", is_ephemeral: true },
  response_url: responseUrl, actions: [{ action_id: actionId, value }],
})

async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(10) }
  assert.fail("Expected asynchronous Slack result was not delivered")
}
// Lets background work finish when the expected outcome is "nothing happens".
const settle = () => delay(80)

describe("nudge phrase checks", () => {
  it("recognises English and Vietnamese questions about past decisions", () => {
    for (const text of [
      "Should we keep migration backups in Postgres?",
      "why did we pick postgres for the migration service",
      "Which database are we using for migrations?",
      "Hồi trước mình xử lý file migration lớn như thế nào",
      "Tại sao mình dùng GCS cho backup vậy",
    ]) assert.equal(looksLikeQuestion(text), true, text)
    for (const text of ["lunch at 12?", "Can someone review my PR?", "I wonder whether this works", "why?", `why ${"x".repeat(500)}`]) {
      assert.equal(looksLikeQuestion(text), false, text)
    }
  })

  it("recognises settled outcomes and ignores questions and negations", () => {
    for (const text of ["Agreed. I'll track it in MIG-182.", "Ok, let’s go with Cloud Run", "We have decided to use GCS", "Chốt nhé, dùng Cloud Run", "Thống nhất là dùng GCS"]) {
      assert.equal(looksLikeDecision(text), true, text)
    }
    for (const text of ["Agreed?", "Not agreed yet, need more data", "I disagreed with that", "Chưa chốt, đợi anh Minh", "không đồng ý", "Sounds interesting"]) {
      assert.equal(looksLikeDecision(text), false, text)
    }
  })
})

describe("Slack events endpoint", () => {
  it("answers the URL check and rejects unsigned or other-workspace events", async (t) => {
    const f = await fixture(t)
    const check = await f.sendEvent({ type: "url_verification", challenge: "abc123" })
    assert.deepEqual(await check.json(), { challenge: "abc123" })
    assert.equal((await f.sendEvent({ type: "url_verification", challenge: "abc" }, { valid: false })).status, 401)
    assert.equal((await f.sendEvent({ ...message({ text: "Should we keep backups in Postgres?" }), team_id: "T2" })).status, 403)
    assert.equal(f.calls.length, 0)
  })

  it("ignores bots, edits, direct messages, and Slack retries", async (t) => {
    const search = fakeSearch()
    const f = await fixture(t, { memorySearch: search.service })
    const question = "Should we keep migration backups in Postgres?"
    for (const body of [
      message({ text: question, bot_id: "B1" }),
      message({ text: question, subtype: "message_changed" }),
      message({ text: question, channel_type: "im" }),
      message({ text: question, user: undefined }),
    ]) assert.equal((await f.sendEvent(body)).status, 200)
    assert.equal((await f.sendEvent(message({ text: question }), { headers: { "x-slack-retry-num": "1" } })).status, 200)
    await settle()
    assert.equal(search.searches.length, 0)
    assert.equal(f.calls.length, 0)
  })
})

describe("Already decided nudge", () => {
  it("privately points the asker to a strong active match, once per thread", async (t) => {
    const search = fakeSearch(92)
    const f = await fixture(t, { memorySearch: search.service })
    await f.sendEvent(message({ text: "<@U9> Should we keep migration backups in Postgres?", thread_ts: "1.0" }))
    await until(() => f.posted("chat.postEphemeral").length === 1)
    assert.deepEqual(search.searches, [{ query: "Should we keep migration backups in Postgres?", filters: { status: "ACTIVE" } }])
    const [nudge] = f.posted("chat.postEphemeral")
    assert.equal(nudge.args.channel, "C1")
    assert.equal(nudge.args.user, "U1")
    assert.equal(nudge.args.thread_ts, "1.0")
    assert.match(nudge.args.blocks, /Already decided/)
    assert.match(nudge.args.blocks, /DM-104 · Use object storage/)
    assert.match(nudge.args.blocks, /&lt;timed out&gt;/, "Stored text is escaped for mrkdwn")
    assert.match(nudge.args.blocks, new RegExp(`\\\\"decisionId\\\\":\\\\"${decision.id}\\\\"`))

    await f.sendEvent(message({ text: "Why do we keep backups outside Postgres?", ts: "2.1", thread_ts: "1.0" }))
    await settle()
    assert.equal(f.posted("chat.postEphemeral").length, 1, "One recall nudge per thread")
    assert.equal(f.posted("chat.postMessage").length, 0, "Nothing is posted publicly")
  })

  it("stays quiet for weak matches", async (t) => {
    const weak = fakeSearch(74)
    const f1 = await fixture(t, { memorySearch: weak.service })
    await f1.sendEvent(message({ text: "Should we keep migration backups in Postgres?" }))
    await until(() => weak.searches.length === 1)
    await settle()
    assert.equal(f1.posted("chat.postEphemeral").length, 0)
  })

  it("does not point a thread to the Decision it produced", async (t) => {
    const search = fakeSearch(95)
    const f = await fixture(t, { memorySearch: search.service, repository: fakeRepository({ decisionIdsForThread: async () => [decision.id] }) })
    await f.sendEvent(message({ text: "Should we keep migration backups in Postgres?", thread_ts: "1.0" }))
    await until(() => search.searches.length === 1)
    await settle()
    assert.equal(f.posted("chat.postEphemeral").length, 0)
  })

  it("does nothing when Search by memory fails", async (t) => {
    let calls = 0
    const f = await fixture(t, { memorySearch: { enabled: true, search: async () => { calls += 1; throw new Error("Gemini unavailable") } } })
    await f.sendEvent(message({ text: "Should we keep migration backups in Postgres?" }))
    await until(() => calls === 1)
    await settle()
    assert.equal(f.posted("chat.postEphemeral").length, 0)
  })

  it("does nothing when Search by memory is off", async (t) => {
    const f = await fixture(t)
    await f.sendEvent(message({ text: "Should we keep migration backups in Postgres?" }))
    await settle()
    assert.equal(f.calls.length, 0)
  })
})

describe("Save it? nudge", () => {
  it("suggests saving a settled thread reply without calling AI, once per thread", async (t) => {
    const search = fakeSearch()
    const f = await fixture(t, { memorySearch: search.service })
    await f.sendEvent(message({ text: "Agreed, let's go with Cloud Run.", ts: "1.1", thread_ts: "1.0" }))
    await until(() => f.posted("chat.postEphemeral").length === 1)
    const [nudge] = f.posted("chat.postEphemeral")
    assert.equal(nudge.args.thread_ts, "1.0")
    assert.match(nudge.args.blocks, /Save as Decision/)
    assert.match(nudge.args.blocks, /\\"ts\\":\\"1.1\\",\\"threadTs\\":\\"1.0\\"/)
    assert.equal(search.searches.length, 0)

    await f.sendEvent(message({ text: "Chốt nhé, dùng Cloud Run", ts: "1.2", thread_ts: "1.0" }))
    await f.sendEvent(message({ text: "Agreed, let's go with Cloud Run." }))
    await settle()
    assert.equal(f.posted("chat.postEphemeral").length, 1, "Once per thread, and never for top-level messages")
  })

  it("does not suggest saving a thread that already has a Decision", async (t) => {
    let checked = false
    const f = await fixture(t, { repository: fakeRepository({ decisionIdsForThread: async () => { checked = true; return [decision.id] } }) })
    await f.sendEvent(message({ text: "Agreed, let's go with Cloud Run.", ts: "1.1", thread_ts: "1.0" }))
    await until(() => checked)
    await settle()
    assert.equal(f.posted("chat.postEphemeral").length, 0)
  })
})

describe("nudge buttons", () => {
  it("Save as Decision opens the window first, then the capture form from the thread", async (t) => {
    const f = await fixture(t)
    assert.equal((await f.click(button("nudge_save", JSON.stringify({ ts: "1.1", threadTs: "1.0" })))).status, 200)
    await until(() => f.posted("views.update").length === 1 && f.calls.some((call) => call.url.startsWith("https://hooks.slack.com/")))
    assert.equal(f.calls[0].method, "views.open", "The 3-second trigger is used before anything else")
    assert.equal(f.calls[0].args.trigger_id, "trigger-1")
    const replies = f.posted("conversations.replies")[0]
    assert.equal(replies.args.channel, "C1")
    assert.equal(replies.args.ts, "1.0")
    const form = JSON.parse(f.posted("views.update")[0].args.view)
    assert.equal(form.callback_id, "decision_memory_save")
    assert.equal(form.blocks.find((block) => block.block_id === "title").element.initial_value, "Agreed, let's go with Cloud Run.")
    assert.match(JSON.stringify(form), /Captured from #platform-decisions/)
    assert.deepEqual(f.calls.at(-1).args, { delete_original: true })
  })

  it("Share in thread posts the Decision publicly once, then removes the private nudge", async (t) => {
    const f = await fixture(t)
    const share = button("nudge_share", JSON.stringify({ decisionId: decision.id, threadTs: "1.0" }))
    await f.click(share)
    await until(() => f.calls.some((call) => call.url.startsWith("https://hooks.slack.com/")))
    const [post] = f.posted("chat.postMessage")
    assert.equal(post.args.channel, "C1")
    assert.equal(post.args.thread_ts, "1.0")
    assert.match(post.args.blocks, /<@U1> shared a Decision on record/)
    assert.match(post.args.blocks, /DM-104 · Use object storage/)
    await f.click(share)
    await settle()
    assert.equal(f.posted("chat.postMessage").length, 1, "A double click does not post twice")
  })

  it("dismisses privately and ignores bad values or foreign response URLs", async (t) => {
    const f = await fixture(t)
    await f.click(button("nudge_dismiss", "dismiss"))
    await until(() => f.calls.length === 1)
    assert.equal(f.calls[0].url, "https://hooks.slack.com/actions/T1/1/abc")
    assert.deepEqual(f.calls[0].args, { delete_original: true })
    await f.click(button("nudge_dismiss", "dismiss", "https://evil.example/hook"))
    await f.click(button("nudge_share", JSON.stringify({ decisionId: "not-a-uuid", threadTs: "1.0" })))
    await f.click(button("nudge_save", "{broken"))
    await f.click(button("nudge_open", undefined))
    await settle()
    assert.equal(f.calls.length, 1)
  })

  it("explains when a shared Decision no longer exists", async (t) => {
    const f = await fixture(t)
    await f.click(button("nudge_share", JSON.stringify({ decisionId: "55555555-5555-4555-8555-555555555555", threadTs: "1.0" })))
    await until(() => f.calls.length === 1)
    assert.deepEqual(f.calls[0].args, { replace_original: true, text: "That Decision is no longer available." })
    assert.equal(f.posted("chat.postMessage").length, 0)
  })
})

describe("@Decision Memory decide", () => {
  const mention = (fields) => ({ type: "event_callback", team_id: "T1", authorizations: [{ user_id: "UBOT" }], event: { type: "app_mention", channel: "C1", user: "U1", ts: "1.2", thread_ts: "1.0", text: "<@UBOT> decide", ...fields } })

  it("offers a private Save button for the latest message before the mention", async (t) => {
    const f = await fixture(t)
    await f.sendEvent(mention({}))
    // The same mention also arrives as a message event; it must not nudge twice.
    await f.sendEvent({ ...message({ text: "<@UBOT> decide, agreed let's go with Cloud Run", ts: "1.2", thread_ts: "1.0" }), authorizations: [{ user_id: "UBOT" }] })
    await until(() => f.posted("chat.postEphemeral").length === 1)
    await settle()
    assert.equal(f.posted("chat.postEphemeral").length, 1)
    assert.equal(f.posted("conversations.replies")[0].args.ts, "1.0")
    const [reply] = f.posted("chat.postEphemeral")
    assert.equal(reply.args.thread_ts, "1.0")
    assert.match(reply.args.blocks, /Save this thread as a Decision/)
    assert.match(reply.args.blocks, /Selected message: “Agreed, let's go with Cloud Run.”/)
    assert.match(reply.args.blocks, /\\"ts\\":\\"1.1\\",\\"threadTs\\":\\"1.0\\"/)
  })

  it("uses typed text as the title, and works outside threads", async (t) => {
    const f = await fixture(t)
    await f.sendEvent(mention({ ts: "3.0", thread_ts: undefined, text: "<@UBOT> Decide: Use Cloud Run for the worker" }))
    await until(() => f.posted("chat.postEphemeral").length === 1)
    const [reply] = f.posted("chat.postEphemeral")
    assert.equal(reply.args.thread_ts, undefined)
    assert.equal(f.posted("conversations.replies").length, 0)
    const save = JSON.parse(reply.args.blocks).at(-1).elements[0]
    assert.deepEqual(JSON.parse(save.value), { ts: "3.0", threadTs: "3.0", title: "Use Cloud Run for the worker" })

    await f.click(button("nudge_save", save.value))
    await until(() => f.posted("views.update").length === 1)
    const form = JSON.parse(f.posted("views.update")[0].args.view)
    assert.equal(form.blocks.find((block) => block.block_id === "title").element.initial_value, "Use Cloud Run for the worker")
  })

  it("explains how to use it when the mention is not a command", async (t) => {
    const f = await fixture(t)
    await f.sendEvent(mention({ text: "<@UBOT> hello there" }))
    await until(() => f.posted("chat.postEphemeral").length === 1)
    assert.match(f.posted("chat.postEphemeral")[0].args.text, /Mention me with “decide”/)
    assert.equal(f.posted("conversations.replies").length, 0)
  })
})
