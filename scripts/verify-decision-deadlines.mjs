import assert from "node:assert/strict"
import { once } from "node:events"
import { readFile } from "node:fs/promises"
import { createApp } from "../apps/server/src/app.js"

export async function verifyDecisionDeadlines({ repository, models, config, identity, otherIdentity, source }) {
  const { workspace, user } = await repository.resolveContext(identity)
  const pending = await repository.createDecision(identity, {
    title: "Which deadline fixture storage should we choose?", decisionState: "PENDING",
    dueDate: "2026-10-14", context: "Original deadline context", why: "Original reason",
    ownerId: user.id, appliesTo: ["Deadline pending-only scope"], tags: ["deadline-proof"],
    references: [{ kind: "URL", label: "Original reference", url: "https://example.com/deadline-proof" }],
  }, { source })
  assert.equal(pending.outcome, null)
  assert.equal(pending.decidedAt, null)
  assert.ok((await repository.listDecisions(identity, { q: "deadline fixture" })).some((d) => d.id === pending.id))
  assert.equal((await repository.memorySearchCandidates(identity, { tag: "deadline-proof" })).length, 0)
  assert.equal(await repository.memorySearchCandidateCount(identity, { tag: "deadline-proof" }), 0)
  const vectorResult = await repository.vectorSearch(identity, { vector: Array(384).fill(0.01), model: "deadline-proof", filters: { appliesTo: "Deadline pending-only scope" } })
  assert.equal(vectorResult.totalCandidateCount, 0)
  // A scope with only open questions is listed for them, never as a current choice.
  const pendingOnly = await repository.scopeOverview(identity, "Deadline pending-only scope")
  assert.equal(pendingOnly.decisionCount, 0)
  assert.equal(pendingOnly.openCount, 1)
  assert.deepEqual(pendingOnly.activeDecisions, [])
  assert.deepEqual(pendingOnly.openQuestions.map((d) => d.id), [pending.id])
  const pendingScope = (await repository.listScopes(identity)).find((scope) => scope.scope === "Deadline pending-only scope")
  assert.equal(pendingScope.decisionCount, 0)
  assert.equal(pendingScope.openCount, 1)
  const decided = await repository.createDecision(identity, { title: "Legacy deadline proof decision" })
  assert.equal(decided.decisionState, "DECIDED")
  assert.equal(decided.outcome, decided.title)
  await assert.rejects(repository.supersedeDecision(identity, pending.id, decided.id), (error) => error.code === "PENDING_SUPERSESSION")
  await assert.rejects(repository.supersedeDecision(identity, decided.id, pending.id), (error) => error.code === "PENDING_SUPERSESSION")
  assert.equal(await repository.updateDeadline(otherIdentity, pending.id, { dueDate: null }), null)
  assert.equal(await repository.recordOutcome(otherIdentity, pending.id, { outcome: "Foreign attempt" }), null)

  const server = createApp({ config: { ...config, localWorkspaceId: identity.workspaceExternalKey, localUserId: identity.userExternalId }, repository, memorySearch: { enabled: false }, geminiMemorySearch: { enabled: false } }).listen(0, "127.0.0.1")
  await once(server, "listening")
  const base = `http://127.0.0.1:${server.address().port}/api`
  const send = (path, method, body) => fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  try {
    const directory = await (await fetch(`${base}/scopes`)).json()
    const scopeCounts = directory.find(row => row.scope === "Deadline pending-only scope")
    assert.equal(scopeCounts.openCount, 1)
    assert.equal(scopeCounts.latestDecisionAt, null)
    const scopeResponse = await fetch(`${base}/scopes/overview?${new URLSearchParams({ scope: "Deadline pending-only scope" })}`)
    assert.equal(scopeResponse.status, 200)
    assert.equal((await scopeResponse.json()).openCount, 1, "HTTP scope overview exposes the additive count")
    for (const body of [{ dueDate: "2026-02-29" }, { dueDate: null, references: [] }]) {
      assert.equal((await send(`/decisions/${pending.id}/deadline`, "PUT", body)).status, 400)
    }
    assert.equal((await send(`/decisions/${pending.id}/decide`, "POST", { outcome: " ", tags: [] })).status, 400)
    assert.equal((await fetch(`${base}/decisions?deadline=DUE_SOON`)).status, 400)
    for (const [asOf, expected] of [["2026-10-13", "DUE_SOON"], ["2026-10-15", "OVERDUE"]]) {
      const response = await fetch(`${base}/decisions?tag=deadline-proof&deadline=${expected}&asOf=${asOf}`)
      assert.equal(response.status, 200)
      assert.deepEqual((await response.json()).map((d) => d.id), [pending.id])
    }
    const response = await send(`/decisions/${pending.id}/deadline`, "PUT", { dueDate: "2026-10-21" })
    assert.equal(response.status, 200)
    const dated = await response.json()
    for (const field of ["title", "context", "why", "tags", "references", "sources", "lifecycle", "ownerId", "decisionState"]) assert.deepEqual(dated[field], JSON.parse(JSON.stringify(pending[field])), `Deadline edit preserves ${field}`)
    const expected = [
      ["2026-10-13", "OVERDUE"], ["2026-10-14", "DUE_SOON"], ["2026-10-21", "DUE_SOON"], ["2026-10-22", "UPCOMING"], [null, "UNSCHEDULED"],
    ]
    for (const [dueDate, deadline] of expected) {
      await repository.updateDeadline(identity, pending.id, { dueDate })
      assert.deepEqual((await repository.listDecisions(identity, { tag: "deadline-proof", deadline, asOf: "2026-10-14" })).map((d) => d.id), [pending.id])
    }
    const completed = await repository.recordOutcome(identity, pending.id, { outcome: "Use the unique finalonlyphrase storage choice" })
    assert.equal(completed.title, pending.title)
    assert.equal(completed.why, pending.why)
    for (const field of ["context", "tags", "references", "sources", "ownerId", "lifecycle"]) assert.deepEqual(completed[field], pending[field], `Completion preserves ${field}`)
    assert.equal(completed.decisionState, "DECIDED")
    assert.ok(completed.decidedAt)
    const retries = await Promise.all([1, 2].map(() => repository.recordOutcome(identity, pending.id, { outcome: completed.outcome })))
    assert.ok(retries.every((d) => d.decidedAt === completed.decidedAt))
    const conflict = await send(`/decisions/${pending.id}/decide`, "POST", { outcome: "Different late choice" })
    assert.equal(conflict.status, 409)
    assert.equal((await conflict.json()).code, "DECISION_ALREADY_RECORDED")
    assert.equal((await repository.getDecision(identity, pending.id)).outcome, completed.outcome)
    assert.deepEqual((await repository.listDecisions(identity, { q: "finalonlyphrase" })).map((d) => d.id), [pending.id])
    assert.equal((await repository.memorySearchCandidates(identity, { tag: "deadline-proof" }))[0].outcome, completed.outcome)
    const completedScope = await repository.scopeOverview(identity, "Deadline pending-only scope")
    assert.equal(completedScope.activeDecisions[0].id, pending.id)
    assert.equal(completedScope.openCount, 0)
    assert.equal((await (await fetch(`${base}/scopes/overview?${new URLSearchParams({ scope: "Deadline pending-only scope" })}`)).json()).openCount, 0)
    assert.deepEqual(completedScope.openQuestions, [], "A recorded outcome leaves the open questions")
    await assert.rejects(repository.updateDecision(identity, pending.id, { title: pending.title, decisionState: "PENDING" }), (error) => error.code === "REOPEN_UNAVAILABLE")
    const legacyEdit = await repository.updateDecision(identity, decided.id, { title: "Updated legacy final choice" })
    assert.equal(legacyEdit.outcome, legacyEdit.title)
    assert.equal(await repository.memorySearchCandidateCount(identity, { decisionState: "PENDING" }), 0)
  } finally { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }) }

  // Exercise the actual migration twice in an owned temporary schema, including
  // an old table layout. No existing workspace or table is dropped or rewritten.
  const localSearch = await readFile(new URL("../db/local-search.sql", import.meta.url), "utf8")
  const schema = (await readFile(new URL("../db/schema.sql", import.meta.url), "utf8")).replace("\\ir local-search.sql", () => localSearch)
  const temporarySchema = `deadline_migration_proof_${process.pid}`
  await models.sequelize.transaction(async (transaction) => {
    const query = (sql) => models.sequelize.query(sql, { transaction })
    await query(`CREATE SCHEMA ${temporarySchema}; SET LOCAL search_path TO ${temporarySchema}, public`)
    await query(schema.slice(0, schema.indexOf("ALTER TABLE decisions ADD COLUMN IF NOT EXISTS owner_name")))
    await query("INSERT INTO workspaces (external_key) VALUES ('migration-proof'); INSERT INTO decisions (workspace_id, decision_key, title) SELECT id, 'DM-1', 'Original legacy choice' FROM workspaces")
    await query(schema)
    let [rows] = await query("SELECT title, outcome, decision_state, decided_at FROM decisions")
    assert.deepEqual(rows[0], { title: "Original legacy choice", outcome: "Original legacy choice", decision_state: "DECIDED", decided_at: null })
    await query("UPDATE decisions SET outcome = 'Edited final choice'; INSERT INTO decisions (workspace_id, decision_key, title, decision_state) SELECT id, 'DM-2', 'Still pending question', 'PENDING' FROM workspaces")
    await query(schema)
    ;[rows] = await query("SELECT outcome, decision_state, decided_at FROM decisions ORDER BY decision_key")
    assert.deepEqual(rows, [{ outcome: "Edited final choice", decision_state: "DECIDED", decided_at: null }, { outcome: null, decision_state: "PENDING", decided_at: null }])
    await query(`SET LOCAL search_path TO public; DROP SCHEMA ${temporarySchema} CASCADE`)
  })
  assert.ok(workspace.id)
  console.log("Deadline proof passed: migration twice, scoped shortcut preservation/retries/conflicts, local-date filters, pending exclusion, outcome search and legacy writes")
}
