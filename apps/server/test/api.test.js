import assert from "node:assert/strict"
import { once } from "node:events"
import { it } from "node:test"
import { createApp } from "../src/app.js"

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
