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
  console.log("Library discovery integration passed: case-insensitive keys, filter/workspace boundaries, unassigned ID/name semantics, Gemini candidates and real vector filtering")
}
