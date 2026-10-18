import assert from "node:assert/strict"
import { QueryTypes } from "sequelize"
import { createGeminiMemorySearchService } from "../apps/server/src/gemini-memory-search.js"

export async function verifyLibraryDiscovery({ repository, models, identity, otherIdentity }) {
  const { workspace, user } = await repository.resolveContext(identity)
  const common = { appliesTo: ["Discovery proof"], tags: ["discovery-proof"] }
  const unassigned = await repository.createDecision(identity, { ...common, title: "Unowned archive choice" })
  const pending = await repository.createDecision(identity, { ...common, title: "Unowned archive question", decisionState: "PENDING" })
  await repository.createDecision(identity, { ...common, title: "Named archive choice", ownerName: "Historical owner" })
  await repository.createDecision(identity, { ...common, title: "Assigned archive choice", ownerId: user.id })
  const foreign = await repository.createDecision(otherIdentity, { ...common, title: "Other workspace archive" })
  const filters = { ownerId: "UNASSIGNED", tag: "discovery-proof" }
  const ids = rows => rows.map(row => row.id).sort()
  assert.deepEqual(ids(await repository.listDecisions(identity, filters)), [unassigned.id, pending.id].sort())
  assert.deepEqual(ids(await repository.listDecisions(identity, { ...filters, decisionState: "PENDING" })), [pending.id])
  assert.deepEqual(ids(await repository.listDecisions(identity, { q: unassigned.decisionKey.toLowerCase() })), [unassigned.id])
  assert.deepEqual(ids(await repository.listDecisions(identity, { q: `${unassigned.decisionKey} archive`, ...filters })), [unassigned.id])
  assert.deepEqual(await repository.listDecisions(identity, { q: unassigned.decisionKey, appliesTo: "Other scope" }), [])
  assert.equal((await repository.listDecisions(identity, { q: foreign.decisionKey })).some(row => row.id === foreign.id), false)
  assert.deepEqual(ids(await repository.memorySearchCandidates(identity, filters)), [unassigned.id])
  assert.equal(await repository.memorySearchCandidateCount(identity, filters), 1)

  let sent = []
  const gemini = createGeminiMemorySearchService({ config: { geminiModel: "fixture-model" }, repository,
    generateContent: async request => {
      sent = JSON.parse(request.contents.split("Candidate Decisions:\n")[1])
      return { text: JSON.stringify({ matches: [{ decisionId: sent[0].decisionId, score: 90, explanation: "Stored archive choice", matchedConcepts: [] }] }) }
    } })
  await gemini.search(identity, { query: "archive choice", filters })
  assert.deepEqual(sent.map(card => card.decisionId), [unassigned.id], "Gemini excludes both kinds of assigned owners and pending questions")

  // Real pgvector query, using controlled vectors to isolate filtering from model ranking.
  const vector = [1, ...Array(383).fill(0)]
  const jobs = await models.sequelize.query('SELECT decision_id AS "decisionId", workspace_id AS "workspaceId", revision FROM decision_search_jobs WHERE workspace_id IN (:workspaceIds)', {
    replacements: { workspaceIds: [workspace.id, (await repository.resolveContext(otherIdentity)).workspace.id] }, type: QueryTypes.SELECT,
  })
  const all = [...await repository.listDecisions(identity, { tag: "discovery-proof" }), foreign]
  for (const decision of all) {
    const job = jobs.find(job => job.decisionId === decision.id)
    assert.ok(job)
    assert.equal(await repository.completeSearchJob(job, [vector], "discovery-proof-model"), true)
  }
  const result = await repository.vectorSearch(identity, { vector, model: "discovery-proof-model", filters })
  assert.equal(result.totalCandidateCount, 1)
  assert.equal(result.candidateCount, 1)
  assert.deepEqual(result.matches.map(match => match.decision.id), [unassigned.id])
  const excluded = await repository.vectorSearch(identity, { vector, model: "discovery-proof-model", filters: { ...filters, decisionState: "PENDING" } })
  assert.equal(excluded.totalCandidateCount, 0, "Pending questions remain excluded from semantic search")
  // Pending-only and mixed scopes keep recorded counts/dates distinct.
  const scope = "Discovery pending, exact & scope"
  const question = await repository.createDecision(identity, { title: "Discovery outstanding question", decisionState: "PENDING", appliesTo: [scope] })
  // Legacy stored duplicate values must not double-count a record.
  await models.Decision.update({ appliesTo: [scope, scope] }, { where: { id: question.id } })
  const foreignQuestion = await repository.createDecision(otherIdentity, { title: "Other workspace question", decisionState: "PENDING", appliesTo: [scope] })
  const summary = async who => (await repository.listScopes(who)).find(row => row.scope === scope)
  assert.deepEqual(await summary(identity), { scope, decisionCount: 0, activeCount: 0, openCount: 1, latestDecisionAt: null })
  const only = await repository.scopeOverview(identity, scope)
  assert.equal(only.openCount, 1); assert.equal(only.decisionCount, 0)
  assert.deepEqual(only.activeDecisions, []); assert.deepEqual(only.changes, [])
  assert.deepEqual(only.openQuestions.map(row => row.id), [question.id], "Existing additive response remains compatible")
  assert.deepEqual((await repository.scopeOverview(otherIdentity, scope)).openQuestions.map(row => row.id), [foreignQuestion.id])
  const old = await repository.createDecision(identity, { title: "Discovery historical scope choice", appliesTo: [scope] })
  const current = await repository.createDecision(identity, { title: "Discovery current scope choice", appliesTo: [scope] })
  await repository.supersedeDecision(identity, current.id, old.id, "Recorded scope replacement")
  const mixed = await summary(identity)
  assert.equal(mixed.decisionCount, 2); assert.equal(mixed.activeCount, 1); assert.equal(mixed.openCount, 1)
  assert.ok(mixed.latestDecisionAt)
  const overview = await repository.scopeOverview(identity, scope)
  assert.equal(overview.openCount, 1); assert.equal(overview.decisionCount, 2)
  assert.deepEqual(overview.activeDecisions.map(row => row.id), [current.id])
  assert.equal(overview.changes.length, 1)
  assert.equal((await summary(otherIdentity)).decisionCount, 0, "Shared names retain workspace-specific counts")
  await repository.recordOutcome(identity, question.id, { outcome: "Discovery completed scope choice" })
  const completed = await summary(identity)
  assert.equal(completed.decisionCount, 3); assert.equal(completed.activeCount, 2); assert.equal(completed.openCount, 0)
  assert.equal((await repository.scopeOverview(identity, scope)).openCount, 0)
  const directory = await repository.listScopes(identity)
  const names = directory.map(row => row.scope).filter(name => name.startsWith("Discovery"))
  assert.deepEqual(names, [...names].sort(), "Directory keeps database alphabetical ordering for these ASCII scopes")
  console.log("Scope discovery integration passed: pending-only/mixed/completed counts, recorded-only dates/history, duplicate values and shared-name workspace isolation")
  console.log("Library discovery integration passed: case-insensitive keys, filter/workspace boundaries, unassigned ID/name semantics, Gemini candidates and real vector filtering")
}
