import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { once } from "node:events"
import { setTimeout as delay } from "node:timers/promises"
import { it } from "node:test"
import { createSlackApp } from "../src/app.js"

const config = { slackBotToken: "fixture", slackSigningSecret: "fixture", slackTeamId: "T1", appBaseUrl: "http://localhost:5173", localWorkspaceId: "test" }
const question = "Why did we use PostgreSQL?"
const record = (id, score) => ({ score, explanation: "Stored evidence.", decision: { id, decisionKey: id, title: id === "DM-111" ? "Use PostgreSQL for migration" : "Use object storage", status: "ACTIVE" } })
const shortcut = { type: "message_action", callback_id: "ask_decision_memory", team: { id: "T1" }, user: { id: "U1" }, trigger_id: "trigger", channel: { id: "C1" }, message: { ts: "3.0", thread_ts: "1.0", text: question } }

async function fixture(t, summarize = async () => "Why PostgreSQL for migration?", search) {
  const realFetch = globalThis.fetch
  const calls = [], searches = [], summaries = []
  let stale = false
  const summarizer = { enabled: true, summarize: async (messages) => { summaries.push(messages); return summarize(messages) } }
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const method = url.split("/").at(-1), args = Object.fromEntries(init.body)
    calls.push({ method, args })
    if (method === "conversations.replies") return { json: async () => ({ ok: true, messages: [{ ts: "1.0", text: "How is migration going?", reply_count: 2 }, { ts: "2.0", text: "It is going well." }, { ts: "3.0", text: question }] }) }
    assert.ok(["views.open", "views.update"].includes(method), "Never post to Slack or fetch unrelated history")
    return { json: async () => stale && args.hash === "initial"
      ? { ok: false, error: "hash_conflict" }
      : { ok: true, view: { id: "V1", hash: "busy" } } }
  })
  const memorySearch = { enabled: true, search: async (_identity, input) => { searches.push(input.query); return search ? search(input) : { matches: [record("DM-111", 90), record("DM-104", 89)] } } }
  const server = createSlackApp({ config, repository: {}, memorySearch, threadQuestionSummarizer: summarizer, captureDrafter: { enabled: false } }).listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  async function send(payload) {
    const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = "v0=" + createHmac("sha256", config.slackSigningSecret).update(`v0:${timestamp}:${body}`).digest("hex")
    return realFetch(`http://127.0.0.1:${server.address().port}/slack/interactions`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-slack-request-timestamp": timestamp, "x-slack-signature": signature }, body })
  }
  const views = () => calls.filter((call) => call.method === "views.update").map((call) => JSON.parse(call.args.view))
  await send(shortcut)
  await until(() => views().length === 1)
  const original = views()[0]
  const click = { type: "block_actions", team: { id: "T1" }, user: { id: "U1" }, actions: [{ action_id: "ask_summarize_thread" }], view: { ...original, id: "V1", hash: "initial" } }
  return { send, calls, searches, summaries, views, original, click, summarizer, makeStale: () => { stale = true } }
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(10) }
  assert.fail("Slack summary view was not delivered")
}

it("Ask shows the transfer disclosure and button but never summarizes automatically", async (t) => {
  const f = await fixture(t)
  assert.deepEqual(f.searches, [question])
  assert.equal(f.summaries.length, 0)
  assert.equal(f.calls.some((call) => call.method === "conversations.replies"), false)
  assert.match(JSON.stringify(f.original), /60 messages.*1,500 characters.*Google/)
  assert.equal(f.original.callback_id, "decision_memory_ask")
  assert.ok(f.original.blocks.findIndex((block) => block.type === "actions") < f.original.blocks.findIndex((block) => block.type === "divider"), "Offer summary search before the result list")
})

it("explicit summary acknowledges promptly, searches locally, discloses the query and filters below 90", async (t) => {
  let release
  const pending = new Promise((resolve) => { release = resolve })
  t.after(() => release())
  const f = await fixture(t, async () => { await pending; return "Why PostgreSQL for migration?" })
  assert.equal((await f.send(f.click)).status, 200)
  await until(() => f.summaries.length === 1)
  assert.match(JSON.stringify(f.views().at(-1)), /Summarizing thread/)
  assert.equal(f.searches.length, 1)
  release()
  await until(() => f.views().length === 3)
  assert.deepEqual(f.searches, [question, "Why PostgreSQL for migration?"])
  const text = JSON.stringify(f.views().at(-1))
  assert.match(text, /Gemini search question \(English\): “Why PostgreSQL for migration\?”/)
  assert.match(text, /DM-111/)
  assert.doesNotMatch(text, /DM-104/)
  assert.equal(f.calls.at(-1).args.hash, "busy")
  assert.equal(f.calls.find((call) => call.method === "conversations.replies").args.ts, "1.0")
})

it("summary failure restores the previous results and retry action", async (t) => {
  const f = await fixture(t, async () => null)
  await f.send(f.click)
  await until(() => f.views().length === 3)
  assert.match(JSON.stringify(f.views().at(-1)), /previous results are preserved/)
  assert.deepEqual(f.views().at(-1).blocks.slice(1), f.original.blocks)
  assert.equal(f.searches.length, 1)
})

it("local search failure after rewriting restores the previous local results", async (t) => {
  const f = await fixture(t, undefined, async ({ query }) => {
    if (query !== question) throw new Error("Local search unavailable")
    return { matches: [record("DM-111", 70)] }
  })
  await f.send(f.click)
  await until(() => f.views().length === 3)
  assert.deepEqual(f.views().at(-1).blocks.slice(1), f.original.blocks)
  assert.equal(f.summaries.length, 1)
})

it("a disabled summarizer has no action on a newly opened Ask view", async (t) => {
  const f = await fixture(t)
  f.summarizer.enabled = false
  await f.send(shortcut)
  await until(() => f.views().length === 2)
  assert.doesNotMatch(JSON.stringify(f.views().at(-1)), /ask_summarize_thread|sends up to 60/)
  assert.equal(f.summaries.length, 0)
})

it("another user or stale view cannot trigger Gemini", async (t) => {
  const f = await fixture(t)
  await f.send({ ...f.click, user: { id: "U2" } })
  assert.equal(f.summaries.length, 0)
  assert.equal(f.views().length, 1)
  f.makeStale()
  await f.send(f.click)
  await until(() => f.calls.some((call) => call.args.hash === "initial"))
  assert.equal(f.summaries.length, 0)
})
