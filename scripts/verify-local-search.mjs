import assert from "node:assert/strict"
import { once } from "node:events"
import { setTimeout as delay } from "node:timers/promises"

import { createApp } from "../apps/server/src/app.js"
import { config } from "../apps/server/src/config.js"
import { createLocalEmbedder, decisionPassages } from "../apps/server/src/local-embeddings.js"
import { createMemorySearchService } from "../apps/server/src/memory-search.js"
import { createDatabase } from "../apps/server/src/models.js"
import { createRepository } from "../apps/server/src/repository.js"
import { createSearchIndexer } from "../apps/server/src/search-indexer.js"
import { run } from "./setup-local.mjs"

const databaseUrl = new URL(config.databaseUrl)
assert.ok(config.localDemoMode && ["localhost", "127.0.0.1"].includes(databaseUrl.hostname) && databaseUrl.port === "5434",
  "Local search proof requires the local Docker database, never a remote deployment.")
const databaseName = `decision_memory_search_proof_${process.pid}`
databaseUrl.pathname = `/${databaseName}`
let created = false
let models
let server
let embedder
let indexer
try {
  await run("docker", ["compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "decision_memory", "-d", "postgres", "-c", `CREATE DATABASE ${databaseName}`], { capture: true })
  created = true
  for (const file of ["schema.sql", "seed.sql"]) {
    await run("docker", ["compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "decision_memory", "-d", databaseName, "-f", `/app/db/${file}`], { capture: true })
  }
  models = createDatabase(databaseUrl.toString(), false)
  const repository = createRepository(models)
  // Every following operation, including first-load model initialization, must
  // succeed without fetching anything. Fixtures contain only synthetic data.
  let networkRequests = 0
  globalThis.fetch = async () => { networkRequests++; throw new Error("Unexpected external network request") }
  embedder = createLocalEmbedder()
  const { tokenizer } = await embedder.prepare()
  const regressionFailures = []
  async function regression(name, check) {
    try {
      await check()
      console.log(`Recall regression passed: ${name}`)
    } catch (error) {
      regressionFailures.push(error)
      console.error(`Recall regression failed: ${name}: ${error.message}`)
    }
  }
  await regression("complete token coverage", async () => {
    const title = "Use object storage for migration backup files"
    const first = decisionPassages({ title }, tokenizer)[0]
    const firstIds = Array.isArray(first) ? first : tokenizer.encode(`passage: ${first}`, { add_special_tokens: true }).ids
    assert.deepEqual(firstIds, tokenizer.encode(`passage: ${title}`, { add_special_tokens: true }).ids, "Token window framing must match the model's normal passage encoding")
    if (Array.isArray(first)) {
      await assert.rejects(embedder.embed(Array(513).fill(firstIds[1]), "passage"), /512-token input budget/, "Oversized passage inputs must fail instead of silently discarding evidence")
    }
    const marker = "The team selected chocolate cake recipe."
    for (const fixture of [
      { title: "Use object storage", context: "a,".repeat(300) + marker + "b,".repeat(600) },
      { title: "中,".repeat(250), context: "This is ordinary introductory context. ".repeat(2) + marker },
      { title: "Captured discussion", sources: [{ messages: [{ author: "Test", text: "a,".repeat(300) + marker + "b,".repeat(600) }] }] },
    ]) {
      const inputs = decisionPassages(fixture, tokenizer).map((passage) =>
        Array.isArray(passage) ? passage : tokenizer.encode(`passage: ${passage}`, { add_special_tokens: true }).ids)
      const visible = inputs.map((ids) => tokenizer.decode(ids.length > 512 ? [...ids.slice(0, 511), ids.at(-1)] : ids))
      assert.ok(visible.some((text) => text.includes(marker)), "Evidence fell into a token-truncation gap between passages")
      assert.ok(inputs.every((ids) => ids.length <= 512), "Every passage must fit 512 tokens including prefix, title and special tokens")
      for (const input of inputs) await embedder.embed(input, "passage")
    }
  })
  await regression("distinct decisions beyond 100 passages", async () => {
    const scopedIdentity = { workspaceExternalKey: "recall-crowding-proof", userExternalId: "recall-user", userDisplayName: "Recall User" }
    const decisions = []
    for (let index = 0; index < 6; index++) {
      decisions.push(await repository.createDecision(scopedIdentity, { title: `Relevant choice ${index}`, tags: ["crowding-proof"] }))
    }
    const jobs = await repository.pendingSearchJobs(50)
    for (let index = 0; index < decisions.length; index++) {
      const similarity = index === 0 ? 1 : 1 - index / 100
      const vector = [similarity, Math.sqrt(1 - similarity ** 2), ...Array(382).fill(0)]
      const job = jobs.find((item) => item.decisionId === decisions[index].id)
      await repository.completeSearchJob(job, Array.from({ length: index === 0 ? 301 : 1 }, () => vector), "crowding-model")
    }
    const result = await repository.vectorSearch(scopedIdentity, {
      vector: [1, ...Array(383).fill(0)], model: "crowding-model", filters: { tag: "crowding-proof", status: "ACTIVE" },
    })
    assert.equal(result.candidateCount, 6)
    assert.equal(result.matches.length, 5, "A long decision must not consume the entire candidate window")
    assert.deepEqual(result.matches.map((match) => match.decision.id), decisions.slice(0, 5).map((decision) => decision.id))
    const otherTenant = await repository.vectorSearch({ ...scopedIdentity, workspaceExternalKey: "empty-crowding-tenant" }, {
      vector: [1, ...Array(383).fill(0)], model: "crowding-model", filters: { tag: "crowding-proof" },
    })
    assert.deepEqual(otherTenant.matches, [])
    await models.Workspace.destroy({ where: { externalKey: scopedIdentity.workspaceExternalKey } })
  })
  if (regressionFailures.length) throw new AggregateError(regressionFailures, "Local recall regressions failed")
  indexer = createSearchIndexer({ repository, embedder })
  await repository.queueUnindexedDecisions(embedder.model)
  assert.equal(await indexer.drain(), 9)
  assert.equal(await indexer.drain(), 0, "Restart must reuse persisted embeddings")
  const identity = { workspaceExternalKey: config.localWorkspaceId, cloudId: config.localCloudId,
    userExternalId: config.localUserId, userDisplayName: config.localUserName }
  const memorySearch = createMemorySearchService({ repository, embedder })
  for (const query of [
    "How did we avoid timeouts for large migration backup files?",
    "Hồi trước mình xử lý file migration lớn hay timeout như thế nào?",
  ]) {
    const result = await memorySearch.search(identity, { query })
    console.log(JSON.stringify({ query, matches: result.matches.map((match) => ({ key: match.decision.decisionKey, similarity: match.similarity, score: match.score })) }))
    assert.equal(result.candidateCount, 9)
    assert.equal(result.truncated, false)
    assert.equal(result.matches[0]?.decision.decisionKey, "DM-104", "Bilingual recall must find the stored migration choice")
    assert.ok(result.matches.every((match) => match.decision.sources.every((source) => !source.messages)))
  }
  const unrelated = await memorySearch.search(identity, { query: "What is the recipe for chocolate cake?" })
  console.log("Unrelated query:", unrelated.matches.map((match) => ({ key: match.decision.decisionKey, similarity: match.similarity })))
  assert.deepEqual(unrelated.matches, [], "Unrelated queries must not force a match")

  const other = { ...identity, workspaceExternalKey: "local-search-other" }
  const queryVector = await embedder.embed("Use object storage for migration backup files")
  const foreign = await repository.createDecision(other, { title: "Foreign secret decision" })
  const { workspace, user } = await repository.resolveContext(identity)
  const indexJobs = async () => {
    let jobs
    while ((jobs = await repository.pendingSearchJobs()).length) {
      for (const job of jobs) await repository.completeSearchJob(job, [queryVector], embedder.model)
    }
  }
  await indexJobs()
  const scoped = await repository.vectorSearch(identity, { vector: queryVector, model: embedder.model })
  assert.ok(!scoped.matches.some((match) => match.decision.id === foreign.id))
  await assert.rejects(models.sequelize.query(
    `INSERT INTO decision_embeddings (decision_id, workspace_id, chunk_index, model, revision, embedding)
     VALUES (:decisionId, :workspaceId, 9, 'bad', gen_random_uuid(), CAST(:vector AS vector))`,
    { replacements: { decisionId: foreign.id, workspaceId: workspace.id, vector: JSON.stringify(queryVector) } },
  ), /foreign key/)

  const fixture = await repository.createDecision(identity, {
    title: "Oldest local recall sentinel", ownerId: user.id, tags: ["local-proof"], appliesTo: ["Local proof"],
  }, { source: { provider: "SLACK", capturedAt: new Date(), channelName: "local-proof-channel", messages: [{ author: "Test", text: "Deep captured evidence" }] } })
  const staleJob = (await repository.pendingSearchJobs()).find((job) => job.decisionId === fixture.id)
  await repository.updateDecision(identity, fixture.id, { title: "Changed local recall sentinel", ownerId: user.id,
    tags: ["local-proof"], appliesTo: ["Local proof"] })
  assert.equal(await repository.completeSearchJob(staleJob, [queryVector], embedder.model), false, "Concurrent edits invalidate earlier jobs")
  let pending = await repository.vectorSearch(identity, { vector: queryVector, model: embedder.model, filters: { tag: "local-proof" } })
  assert.equal(pending.totalCandidateCount, 1)
  assert.equal(pending.candidateCount, 0)
  assert.equal(pending.truncated, true)
  assert.deepEqual(pending.matches, [])
  await indexJobs()
  for (const filters of [
    { channel: "local-proof-channel" }, { tag: "local-proof" }, { ownerId: user.id },
    { appliesTo: "Local proof" }, { status: "ACTIVE", tag: "local-proof" },
    { dateRange: "1", tag: "local-proof" },
    { channel: "local-proof-channel", tag: "local-proof", ownerId: user.id, status: "ACTIVE", appliesTo: "Local proof", dateRange: "1" },
  ]) {
    const result = await repository.vectorSearch(identity, { vector: queryVector, model: embedder.model, filters })
    assert.ok(result.matches.some((match) => match.decision.id === fixture.id), `Missing filtered match: ${JSON.stringify(filters)}`)
  }
  const noMatch = await repository.vectorSearch(identity, { vector: queryVector, model: embedder.model, filters: { tag: "nonexistent" } })
  assert.equal(noMatch.totalCandidateCount, 0)
  assert.deepEqual(noMatch.matches, [])
  const named = await repository.createDecision(identity, { title: "Recorded owner choice", ownerName: "Recorded Maya" })
  await indexJobs()
  const ownerNameResult = await repository.vectorSearch(identity, { vector: queryVector, model: embedder.model, filters: { ownerId: "name:Recorded Maya" } })
  assert.deepEqual(ownerNameResult.matches.map((match) => match.decision.id), [named.id])
  await models.Decision.destroy({ where: { id: named.id } })
  // Supersession is read from the original record rather than frozen in a vector.
  const successor = await repository.createDecision(identity, { title: "New local choice" })
  await repository.supersedeDecision(identity, successor.id, fixture.id)
  await indexJobs()
  const superseded = await repository.vectorSearch(identity, { vector: queryVector, model: embedder.model, filters: { tag: "local-proof", status: "SUPERSEDED" } })
  assert.equal(superseded.matches[0].decision.id, fixture.id)
  const active = await repository.vectorSearch(identity, { vector: queryVector, model: embedder.model, filters: { tag: "local-proof", status: "ACTIVE" } })
  assert.deepEqual(active.matches, [])

  // Metadata/source changes also invalidate an indexed decision immediately.
  await models.SourceSnapshot.update({ anchorText: "Changed captured evidence" }, { where: { decisionId: fixture.id } })
  pending = await repository.vectorSearch(identity, { vector: queryVector, model: embedder.model, filters: { tag: "local-proof" } })
  assert.equal(pending.candidateCount, 0)
  await indexJobs()
  await models.User.update({ displayName: "Updated local owner" }, { where: { id: user.id } })
  assert.ok((await repository.pendingSearchJobs()).some((job) => job.decisionId === fixture.id))
  await indexJobs()
  await models.Tag.update({ name: "renamed-local-proof" }, { where: { workspaceId: workspace.id, name: "local-proof" } })
  assert.ok((await repository.pendingSearchJobs()).some((job) => job.decisionId === fixture.id))
  await indexJobs()

  await models.Decision.update({ createdAt: new Date("2020-01-01") }, { where: { id: fixture.id } })
  await models.Decision.bulkCreate(Array.from({ length: 201 }, (_, index) => ({
    workspaceId: workspace.id, decisionKey: `DM-${10000 + index}`, title: `Newer irrelevant decision ${index}`, appliesTo: ["Local proof"],
  })))
  let jobs
  while ((jobs = await repository.pendingSearchJobs()).length) {
    for (const job of jobs) await repository.completeSearchJob(job, [queryVector.map((value) => -value)], embedder.model)
  }
  const large = await repository.vectorSearch(identity, { vector: queryVector, model: embedder.model, filters: { appliesTo: "Local proof" } })
  assert.equal(large.candidateCount, 202)
  assert.equal(large.totalCandidateCount, 202)
  assert.equal(large.truncated, false)
  assert.equal(large.matches[0].decision.id, fixture.id, "Old decision must be retrieved beyond the former 200 cap")

  // Verify the same service through the authenticated local HTTP route.
  server = createApp({ config, repository, memorySearch, captureDrafter: { enabled: false }, jira: { enabled: false } }).listen(0, "127.0.0.1")
  await once(server, "listening")
  const { request } = await import("node:http")
  const response = await new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: server.address().port, path: "/api/decisions/memory-search", method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let body = ""
      res.on("data", (chunk) => { body += chunk })
      res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(body) }))
    })
    req.on("error", reject)
    req.end(JSON.stringify({ query: "migration backup", filters: { appliesTo: "Local proof" } }))
  })
  assert.equal(response.status, 200)
  assert.equal(response.data.totalCandidateCount, 202)
  await models.Decision.destroy({ where: { id: fixture.id } })
  const [left] = await models.sequelize.query("SELECT count(*)::int AS count FROM decision_embeddings WHERE decision_id = :id", { replacements: { id: fixture.id }, type: "SELECT" })
  assert.equal(left.count, 0, "Deletion must remove embeddings")
  const background = await repository.createDecision(identity, { title: "Background indexing proof", appliesTo: ["Background proof"] })
  indexer.start()
  async function waitForBackground(previousRevision) {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const [row] = await models.sequelize.query(
        `SELECT e.revision FROM decision_embeddings e WHERE e.decision_id = :id
         AND NOT EXISTS (SELECT 1 FROM decision_search_jobs j WHERE j.decision_id = e.decision_id) LIMIT 1`,
        { replacements: { id: background.id }, type: "SELECT" },
      )
      if (row && row.revision !== previousRevision) return row.revision
      await delay(100)
    }
    assert.fail("The background worker did not index the committed change within 10 seconds.")
  }
  const priorRevision = await waitForBackground()
  await repository.updateDecision(identity, background.id, { title: "Changed background indexing proof", appliesTo: ["Background proof"] })
  await waitForBackground(priorRevision)
  const backgroundResult = await memorySearch.search(identity, { query: "Changed background indexing proof", filters: { appliesTo: "Background proof" } })
  assert.equal(backgroundResult.matches[0]?.decision.title, "Changed background indexing proof")
  await indexer.stop()
  const outcomeFixture = await repository.createDecision(identity, {
    title: "Which approach should this team take?", decisionState: "PENDING", tags: ["outcome-only-proof"],
  })
  await indexer.drain()
  const outcomeQuery = "Use object storage for migration backup files to avoid database timeouts."
  assert.equal((await memorySearch.search(identity, { query: outcomeQuery, filters: { tag: "outcome-only-proof" } })).totalCandidateCount, 0, "Indexed pending questions remain outside memory answers")
  await repository.recordOutcome(identity, outcomeFixture.id, { outcome: outcomeQuery })
  const staleOutcome = await memorySearch.search(identity, { query: outcomeQuery, filters: { tag: "outcome-only-proof" } })
  assert.equal(staleOutcome.totalCandidateCount, 1)
  assert.equal(staleOutcome.candidateCount, 0, "Completion invalidates the previous question embedding")
  await indexer.drain()
  const finalOutcome = await memorySearch.search(identity, { query: outcomeQuery, filters: { tag: "outcome-only-proof" } })
  assert.equal(finalOutcome.matches[0]?.decision.id, outcomeFixture.id, "Recall retrieves the final choice independently of its unrelated original question")
  assert.match(finalOutcome.matches[0].explanation, /object storage/)
  assert.equal(networkRequests, 0)
  console.log("Local search proof passed: real offline bilingual/no-match inference, durable/background indexing, edits/concurrency, source/owner/tag invalidation, tenant/FK isolation, combined filters, supersession, >200 retrieval, deletion and HTTP API.")
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  await indexer?.stop()
  await embedder?.dispose()
  await models?.sequelize.close()
  if (created) await run("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "decision_memory", "-d", "postgres", "-c", `DROP DATABASE ${databaseName}`], { capture: true })
}
