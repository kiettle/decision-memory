import assert from "node:assert/strict"
import { once } from "node:events"
import { it } from "node:test"
import { createApp } from "../src/app.js"

it("memory search defaults to local, requires explicit Gemini selection, and preserves validated filters", async (t) => {
  const calls = []
  const app = createApp({
    config: { nodeEnv: "development", localDemoMode: true, localWorkspaceId: "fixture" },
    repository: { metadata: async () => ({}) },
    memorySearch: { enabled: true, search: async (...args) => { calls.push(["LOCAL", ...args]); return { matches: [], candidateCount: 0 } } },
    geminiMemorySearch: { enabled: true, search: async (...args) => { calls.push(["GEMINI", ...args]); return { matches: [], candidateCount: 0 } } },
  })
  const server = app.listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const base = `http://127.0.0.1:${server.address().port}/api`
  const post = (body) => fetch(`${base}/decisions/memory-search`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  const filters = { channel: "migration", ownerId: "name:Maya", tag: "storage", status: "ACTIVE", appliesTo: "Migration", dateRange: "30" }
  assert.equal((await (await post({ query: "migration", filters })).json()).method, "LOCAL")
  assert.equal((await (await post({ query: "migration", filters, method: "GEMINI" })).json()).method, "GEMINI")
  assert.deepEqual(calls.map(c => c[0]), ["LOCAL", "GEMINI"])
  assert.ok(calls.every(c => c[1].workspaceExternalKey === "fixture"))
  assert.deepEqual(calls[1][2].filters, filters)
  assert.equal((await post({ query: "migration", method: "UNKNOWN" })).status, 400)
  assert.equal((await post({ query: "migration", method: "GEMINI", filters: { status: "UNKNOWN" } })).status, 400)
  assert.equal(calls.length, 2)
  assert.equal((await (await fetch(`${base}/metadata`)).json()).features.geminiMemorySearch, true)
})

it("replacement reasons are optional, trimmed, and bounded before lifecycle mutation", async (t) => {
  const calls = []
  const app = createApp({
    config: { nodeEnv: "development", localDemoMode: true, localWorkspaceId: "fixture" },
    repository: { supersedeDecision: async (...args) => { calls.push(args); return { id: args[1] } } },
    memorySearch: { enabled: false },
  })
  const server = app.listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const id = "11111111-1111-4111-8111-111111111111"
  const targetId = "22222222-2222-4222-8222-222222222222"
  const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/decisions/${id}/supersede`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  })
  assert.equal((await post({ targetId, replacementReason: "  Scale changed.  " })).status, 200)
  assert.equal(calls[0][3], "Scale changed.")
  assert.equal((await post({ targetId })).status, 200)
  assert.equal(calls[1][3], undefined)
  assert.equal((await post({ targetId, replacementReason: "x".repeat(2001) })).status, 400)
  assert.equal(calls.length, 2, "An invalid explanation must not change the lifecycle")
})

it("scope reads use the authenticated identity, reject invalid names, and report missing scopes", async (t) => {
  const calls = []
  const app = createApp({
    config: { nodeEnv: "development", localDemoMode: true, localWorkspaceId: "fixture" },
    repository: {
      listScopes: async (identity) => { calls.push(identity); return [{ scope: "Migration Service" }] },
      scopeOverview: async (identity, scope) => { calls.push(identity); return scope === "Migration Service" ? { scope, activeDecisions: [], changes: [] } : null },
    }, memorySearch: { enabled: false },
  })
  const server = app.listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const base = `http://127.0.0.1:${server.address().port}/api/scopes`
  assert.equal((await fetch(base)).status, 200)
  assert.equal((await fetch(`${base}/overview?scope=Migration%20Service`)).status, 200)
  assert.equal((await fetch(`${base}/overview?scope=unknown`)).status, 404)
  assert.equal((await fetch(`${base}/overview?scope=`)).status, 400)
  assert.equal((await fetch(`${base}/overview?scope=${"x".repeat(201)}`)).status, 400)
  assert.ok(calls.every((identity) => identity.workspaceExternalKey === "fixture"))
  assert.equal(calls.length, 3)
})

it("API failures do not log SQL, payloads, or secrets", async (t) => {
  const logged = []
  t.mock.method(console, "error", (...args) => logged.push(args))
  const error = new Error("private-decision-text token-secret")
  error.sql = "INSERT private-data"
  const app = createApp({
    config: { nodeEnv: "development", localDemoMode: true, localWorkspaceId: "fixture" },
    repository: { metadata: async () => { throw error } },
    memorySearch: { enabled: false },
  })
  const server = app.listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/metadata`)
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: "The request could not be completed." })
  assert.deepEqual(logged, [["API request failed", { code: "INTERNAL_ERROR" }]])
})

it("a malformed Decision id is a 404, not a server error", async (t) => {
  const app = createApp({
    config: { nodeEnv: "development", localDemoMode: true, localWorkspaceId: "fixture" },
    repository: { getDecision: async () => assert.fail("Malformed ids must not reach the database") },
    memorySearch: { enabled: false },
  })
  const server = app.listen(0, "127.0.0.1")
  await once(server, "listening")
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const base = `http://127.0.0.1:${server.address().port}/api/decisions`
  for (const [path, init] of [
    ["/not-a-uuid", undefined],
    ["/not-a-uuid", { method: "PUT", headers: { "content-type": "application/json" }, body: "{}" }],
    ["/not-a-uuid/supersede", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }],
  ]) {
    const response = await fetch(`${base}${path}`, init)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: "Decision not found." })
  }
})
