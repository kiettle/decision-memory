import assert from "node:assert/strict"
import crypto from "node:crypto"
import { once } from "node:events"
import { it } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import { createSlackApp } from "../src/app.js"

const config = { slackBotToken: "fixture", slackSigningSecret: "fixture-secret", slackTeamId: "T1", localWorkspaceId: "owned", appBaseUrl: "http://localhost:5173" }
const result = { coverage: { indexed: 0, total: 0, retrieved: 0, omittedSuccessors: 0, excerpted: false }, evidence: [], analysis: { assessment: "INSUFFICIENT_EVIDENCE", message: "Not approval.", findings: [] } }
const action = (actionId = "review_local", scope = "Migration", proposal = "Use Postgres for backups") => ({ type: "block_actions", team: { id: "T1" }, user: { id: "U1" }, actions: [{ action_id: actionId }],
  view: { id: "V1", hash: "h1", callback_id: "decision_memory_review", state: { values: {
    review_proposal: { value: { value: proposal } }, review_scope: { value: { value: scope } },
  } } } })
async function until(fn) { for (let i = 0; i < 100; i++) { if (fn()) return; await delay(10) } assert.fail("Missing Slack result") }
async function fixture(t, check = async () => result) {
  const realFetch = globalThis.fetch, calls = [], checks = []
  t.after(() => {
    for (const { view } of calls) if (view.blocks.some(block => block.type === "input")) {
      assert.equal(view.submit?.type, "plain_text", "Slack requires submit on modals containing input blocks")
      assert.equal(view.submit.text, "Done")
    }
  })
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const args = Object.fromEntries(init.body)
    calls.push({ method: url.split("/").at(-1), args, view: JSON.parse(args.view) })
    return { json: async () => ({ ok: true, view: { id: "V1", hash: `h${calls.length + 1}` } }) }
  })
  const server = createSlackApp({ config, repository: {}, memorySearch: { enabled: false }, proposalReview: { enabled: true,
    check: async (...args) => { checks.push(args); return check(...args) } } }).listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  async function send(payload, signed = true) {
    const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString(), timestamp = String(Math.floor(Date.now() / 1000))
    const signature = "v0=" + crypto.createHmac("sha256", config.slackSigningSecret).update(`v0:${timestamp}:${body}`).digest("hex")
    return realFetch(`http://127.0.0.1:${server.address().port}/slack/interactions`, { method: "POST", body, headers: {
      "content-type": "application/x-www-form-urlencoded", "x-slack-request-timestamp": timestamp, "x-slack-signature": signed ? signature : "bad",
    } })
  }
  return { calls, checks, send }
}

it("proposal shortcut opens an editable private modal with disclosure, no automatic inference", async t => {
  const f = await fixture(t)
  await f.send({ type: "message_action", callback_id: "check_proposed_decision", team: { id: "T1" }, user: { id: "U1" }, trigger_id: "trigger", message: { text: "x".repeat(600) } })
  await until(() => f.calls.length === 1)
  assert.equal(f.calls[0].method, "views.open")
  assert.match(JSON.stringify(f.calls[0].view), /first 500 characters/)
  assert.match(JSON.stringify(f.calls[0].view), /sends this proposal/)
  assert.equal(f.checks.length, 0)
})

it("Slack promptly acknowledges slow checks, requires scope for Gemini, and only invokes explicitly selected method", async t => {
  let release
  const wait = new Promise(resolve => { release = resolve })
  const f = await fixture(t, async () => { await wait; return result })
  assert.equal((await f.send(action("review_gemini", ""))).status, 200)
  await until(() => f.calls.length === 1)
  assert.match(JSON.stringify(f.calls[0].view), /Confirm an exact scope/)
  assert.equal(f.checks.length, 0)
  assert.equal((await f.send(action())).status, 200)
  await until(() => f.checks.length === 1)
  assert.equal(f.checks[0][1].method, "LOCAL")
  assert.equal(f.checks[0][0].workspaceExternalKey, "owned")
  release()
  await until(() => f.calls.length === 3)
  assert.equal(f.calls.at(-1).args.hash, "h3")
  await f.send(action("review_gemini"))
  await until(() => f.checks.length === 2 && f.calls.length === 5)
  assert.equal(f.checks[1][1].method, "GEMINI")
  assert.ok(f.calls.every(call => ["views.open", "views.update"].includes(call.method)))
})

it("Slack edits invalidate in-flight results and preserve inputs", async t => {
  let release
  const wait = new Promise(resolve => { release = resolve })
  const f = await fixture(t, async () => { await wait; return result })
  await f.send(action()); await until(() => f.checks.length === 1)
  await f.send(action("value", "Migration", "Use object storage")); await until(() => f.calls.length === 2)
  release(); await delay(40)
  assert.equal(f.calls.length, 2)
  assert.match(JSON.stringify(f.calls.at(-1).view), /Input changed/)
  assert.equal(f.calls.at(-1).view.blocks.find(b => b.block_id === "review_proposal").element.initial_value, "Use object storage")
})

it("closing a private review prevents an in-flight result from updating it", async t => {
  let release
  const waiting = new Promise(resolve => { release = resolve })
  const f = await fixture(t, async () => { await waiting; return result })
  await f.send(action()); await until(() => f.checks.length === 1)
  await f.send({ ...action(), type: "view_closed", actions: undefined })
  release(); await delay(40)
  assert.equal(f.calls.length, 1, "Only the progress view was delivered; a closed view gets no final result")
})

it("Done dismisses a review without starting analysis and cancels an in-flight result", async t => {
  let release
  const waiting = new Promise(resolve => { release = resolve })
  const f = await fixture(t, async () => { await waiting; return result })
  const done = { ...action(), type: "view_submission", actions: undefined }
  const response = await f.send(done)
  assert.equal(response.status, 200)
  assert.equal(await response.text(), "", "An empty acknowledgement dismisses the modal")
  assert.equal(f.checks.length, 0)
  assert.equal(f.calls.length, 0)
  await f.send(action()); await until(() => f.checks.length === 1)
  await f.send(done)
  release(); await delay(40)
  assert.equal(f.calls.length, 1, "Done cancels publication of the pending result")
  assert.equal(f.checks.length, 1, "Done must never initiate another analysis")
})

it("Slack review rejects unsigned/wrong-workspace requests and preserves text on service error", async t => {
  const f = await fixture(t, async () => { throw new Error("private secret") })
  assert.equal((await f.send(action(), false)).status, 401)
  assert.equal((await f.send({ ...action(), team: { id: "T2" } })).status, 403)
  assert.equal(f.checks.length, 0)
  await f.send(action()); await until(() => f.calls.length === 2)
  assert.match(JSON.stringify(f.calls.at(-1).view), /inputs are preserved/)
  assert.doesNotMatch(JSON.stringify(f.calls), /private secret/)
})
