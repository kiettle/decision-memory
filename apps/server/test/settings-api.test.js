import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { once } from "node:events"
import { it } from "node:test"
import { createApp, createRuntime, createSlackApp } from "../src/app.js"
import { DomainError } from "../src/domain.js"

async function listen(t, app) {
  const server = app.listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  return `http://127.0.0.1:${server.address().port}`
}
const bootstrap = { nodeEnv: "development", localDemoMode: true, webOrigin: "http://localhost:5173", localWorkspaceId: "fixture", geminiModel: "fixture-model" }

it("settings APIs are local-only, enforce origin/JSON, disable caching, and sanitize unexpected failures", async t => {
  const calls = []
  const settings = { read: () => ({ revision: 1 }), save: async (...args) => { calls.push(args); throw new Error("raw-sensitive-secret") } }
  const base = await listen(t, createApp({ config: bootstrap, repository: {}, settings: { ...settings, getRuntime: () => ({}) } }))
  const read = await fetch(`${base}/api/settings/integrations`)
  assert.equal(read.headers.get("cache-control"), "no-store")
  assert.deepEqual(await read.json(), { revision: 1 })
  const put = headers => fetch(`${base}/api/settings/integrations/gemini`, { method: "PUT", headers, body: JSON.stringify({}) })
  for (const headers of [
    { "content-type": "application/json" },
    { "content-type": "application/json", origin: "https://untrusted.example" },
    { "content-type": "text/plain", origin: bootstrap.webOrigin },
  ]) assert.equal((await put(headers)).status, 403)
  assert.equal(calls.length, 0)
  t.mock.method(console, "error", (...args) => assert.ok(!JSON.stringify(args).includes("raw-sensitive-secret")))
  const failed = await put({ "content-type": "application/json", origin: bootstrap.webOrigin })
  assert.equal(failed.status, 500)
  assert.ok(!(await failed.text()).includes("raw-sensitive-secret"))
  const malformed = await fetch(`${base}/api/settings/integrations/gemini`, { method: "PUT", headers: { origin: bootstrap.webOrigin, "content-type": "application/json" }, body: '{"changes":raw-sensitive-secret}' })
  assert.equal(malformed.status, 400)
  assert.ok(!(await malformed.text()).includes("raw-sensitive-secret"))
  assert.equal(malformed.headers.get("cache-control"), "no-store")
  const denied = await listen(t, createApp({ config: { ...bootstrap, nodeEnv: "production" }, repository: {}, settings: { ...settings, getRuntime: () => ({}) } }))
  assert.equal((await fetch(`${denied}/api/settings/integrations`)).status, 404)
  const slack = await listen(t, createSlackApp({ config: bootstrap, repository: {}, settings: { ...settings, getRuntime: () => ({}) } }))
  assert.equal((await fetch(`${slack}/api/settings/integrations`)).status, 404)
  assert.equal((await fetch(`${slack}/api/settings/integrations/gemini`, { method: "PUT" })).status, 404)
})

it("new API and Slack requests use the new snapshot while an in-flight operation finishes with the old clients", async t => {
  let release, started
  const begun = new Promise(resolve => { started = resolve })
  const pending = new Promise(resolve => { release = resolve })
  const repository = { metadata: async () => ({}) }
  const build = value => createRuntime({ config: { ...bootstrap, ...value }, repository,
    memorySearch: { enabled: true },
    jira: { enabled: Boolean(value.jiraApiToken), projects: async () => {
      if (value.jiraApiToken === "old") { started(); await pending }
      return [{ key: value.jiraApiToken }]
    } },
  })
  const oldSecret = "a".repeat(32), newSecret = "b".repeat(32)
  let runtime = build({ jiraApiToken: "old", slackSigningSecret: oldSecret, slackBotToken: "xoxb-old", slackTeamId: "TDEMO" })
  const settings = {
    getRuntime: () => runtime,
    read: () => ({ revision: 1 }),
    save: async (_provider, input) => {
      if (input.revision !== 1) throw new DomainError("Reload settings.", 409, "SETTINGS_CONFLICT")
      runtime = build({ jiraApiToken: "new", geminiApiKey: "synthetic-key", slackSigningSecret: newSecret, slackBotToken: "xoxb-new", slackTeamId: "TDEMO" })
      return { revision: 2 }
    },
  }
  const api = await listen(t, createApp({ config: bootstrap, repository, settings }))
  const slack = await listen(t, createSlackApp({ config: bootstrap, repository, settings }))
  const oldRequest = fetch(`${api}/api/jira/projects`)
  await begun
  const save = await fetch(`${api}/api/settings/integrations/jira`, { method: "PUT", headers: { origin: bootstrap.webOrigin, "content-type": "application/json" }, body: JSON.stringify({ revision: 1 }) })
  assert.equal(save.status, 200)
  assert.deepEqual(await (await fetch(`${api}/api/jira/projects`)).json(), [{ key: "new" }])
  const features = (await (await fetch(`${api}/api/metadata`)).json()).features
  assert.equal(features.geminiMemorySearch, true)
  assert.equal(features.proposalAnalysis, true)
  assert.equal(settings.getRuntime().services.captureDrafter.enabled, true)
  assert.equal(settings.getRuntime().services.threadQuestionSummarizer.enabled, true)
  release()
  assert.deepEqual(await (await oldRequest).json(), [{ key: "old" }])
  const body = JSON.stringify({ type: "url_verification", challenge: "synthetic-challenge" })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const send = (base, secret) => fetch(`${base}/slack/events`, { method: "POST", body, headers: {
    "content-type": "application/json", "x-slack-request-timestamp": timestamp,
    "x-slack-signature": `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`,
  } })
  for (const base of [api, slack]) {
    assert.equal((await send(base, oldSecret)).status, 401)
    assert.equal((await send(base, newSecret)).status, 200)
  }
})
