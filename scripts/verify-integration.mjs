import assert from "node:assert/strict"
import crypto from "node:crypto"
import { once } from "node:events"
import { setTimeout as delay } from "node:timers/promises"
import { createApp } from "../apps/server/src/app.js"
import { createGeminiMemorySearchService } from "../apps/server/src/gemini-memory-search.js"

import { config } from "../apps/server/src/config.js"
import { createLinkedJiraIssue } from "../apps/server/src/jira.js"
import { DomainError } from "../apps/server/src/domain.js"
import { createDatabase } from "../apps/server/src/models.js"
import { createRepository } from "../apps/server/src/repository.js"
import { verifyDecisionDeadlines } from "./verify-decision-deadlines.mjs"

if (config.nodeEnv !== "development" || !config.localDemoMode) {
  throw new Error("Integration verification only runs in development demo mode.")
}

const models = createDatabase(config.databaseUrl, false)
const repository = createRepository(models)
const workspaceKey = "decision-memory-integration-test"
const otherWorkspaceKey = "decision-memory-integration-other"
const identity = {
  workspaceExternalKey: workspaceKey,
  cloudId: "integration-cloud",
  userExternalId: "integration-user",
  userDisplayName: "Integration User",
  source: "integration-test",
}

try {
  await models.sequelize.authenticate()
  await models.Workspace.destroy({ where: { externalKey: workspaceKey } })
  await models.Workspace.destroy({ where: { externalKey: otherWorkspaceKey } })

  const capturedSource = {
      provider: "SLACK",
      externalChannelId: "C-INTEGRATION",
      channelName: "integration-channel",
      externalThreadId: "1710000000.000000",
      anchorExternalId: "1710000000.000001",
      anchorText: "Choose the boring architecture for the demo.",
      capturedAt: new Date("2026-10-07T00:00:00Z"),
      messages: [
        {
          author: "Integration User",
          timestamp: "1710000000.000001",
          text: "Choose the boring architecture for the demo.",
          anchor: true,
        },
      ],
      sourceContext: {
        entryPoint: "shortcut",
        invokingUserId: "U-INTEGRATION",
        teamId: "T-INTEGRATION",
        totalMessageCount: 1,
        capturedMessageCount: 1,
        captureTruncated: false,
      },
  }
  const draft = await repository.createSlackCaptureDraft(identity, {
    externalEventId: "T-INTEGRATION:trigger-1",
    slackTeamId: "T-INTEGRATION",
    slackUserId: "U-INTEGRATION",
    source: capturedSource,
  })
  const draftRetry = await repository.createSlackCaptureDraft(identity, {
    externalEventId: "T-INTEGRATION:trigger-1",
    slackTeamId: "T-INTEGRATION",
    slackUserId: "U-INTEGRATION",
    source: capturedSource,
  })
  assert.equal(draft.id, draftRetry.id)
  const loadedDraft = await repository.getSlackCaptureDraft(identity, draft.id)
  assert.equal(loadedDraft.source.anchorText, capturedSource.anchorText)

  const otherIdentity = {
    ...identity,
    workspaceExternalKey: otherWorkspaceKey,
    userExternalId: "other-user",
  }
  assert.equal(await repository.getSlackCaptureDraft(otherIdentity, draft.id), null)

  const { workspace, user } = await repository.resolveContext(identity)
  const expiredDraft = await models.SlackCaptureDraft.create({
    workspaceId: workspace.id,
    externalEventId: "T-INTEGRATION:expired",
    slackTeamId: "T-INTEGRATION",
    slackUserId: "U-INTEGRATION",
    source: capturedSource,
    expiresAt: new Date(Date.now() - 1_000),
  })
  assert.equal(await repository.getSlackCaptureDraft(identity, expiredDraft.id), null)
  await repository.createSlackCaptureDraft(identity, {
    externalEventId: "T-INTEGRATION:cleanup-trigger",
    slackTeamId: "T-INTEGRATION",
    slackUserId: "U-INTEGRATION",
    source: capturedSource,
  })
  assert.equal(await models.SlackCaptureDraft.findByPk(expiredDraft.id), null)

  const extras = {
    idempotencyKey: loadedDraft.externalEventId,
    source: loadedDraft.source,
  }
  const first = await repository.createDecision(
    identity,
    {
      title: "Integration idempotency fixture",
      appliesTo: ["Integration API"],
      ownerId: user.id,
      ownerName: "Slack Owner",
      tags: ["integration-memory"],
      references: [
        { kind: "JIRA", label: "DEMO-42", url: "https://example.atlassian.net/browse/DEMO-42" },
        { kind: "URL", label: "Demo notes", url: "https://example.com/demo-notes" },
      ],
    },
    extras,
  )
  const retry = await repository.createDecision(
    identity,
    { title: "Integration idempotency fixture", ownerName: "Slack Owner" },
    extras,
  )

  assert.equal(first.id, retry.id)
  assert.equal(retry.ownerName, "Slack Owner")
  assert.equal(retry.sources.length, 1)
  assert.equal(retry.sources[0].anchorText, "Choose the boring architecture for the demo.")
  assert.equal(retry.references.length, 2)
  assert.deepEqual(retry.sources[0].sourceContext, {
    entryPoint: "shortcut",
    invokingUserId: "U-INTEGRATION",
    teamId: "T-INTEGRATION",
    totalMessageCount: 1,
    capturedMessageCount: 1,
    captureTruncated: false,
  })

  const ownerSearch = await repository.listDecisions(identity, { q: "slack owner" })
  assert.deepEqual(ownerSearch.map((decision) => decision.id), [first.id])

  // Team is deferred: editing a Decision must leave any stored team untouched.
  await models.Decision.update({ team: "Legacy team" }, { where: { id: first.id } })
  const updated = await repository.updateDecision(identity, first.id, {
    title: first.title,
    why: "Keep the demo understandable.",
    appliesTo: ["Integration API"],
    ownerId: user.id,
    ownerName: "Slack Owner",
    tags: ["integration-memory"],
    references: [
      { kind: "URL", label: "Updated demo notes", url: "https://example.com/updated-demo-notes" },
    ],
  })
  assert.equal(updated.references.length, 1)
  assert.equal((await models.Decision.findByPk(first.id)).team, "Legacy team")
  assert.equal(updated.references[0].label, "Updated demo notes")
  assert.equal(updated.references[0].url, "https://example.com/updated-demo-notes")

  const concurrentExtras = {
    ...extras,
    idempotencyKey: "T-INTEGRATION:trigger-2",
  }
  const [concurrentFirst, concurrentRetry] = await Promise.all([
    repository.createDecision(
      identity,
      { title: "Concurrent Slack retry fixture" },
      concurrentExtras,
    ),
    repository.createDecision(
      identity,
      { title: "Concurrent Slack retry fixture" },
      concurrentExtras,
    ),
  ])
  assert.equal(concurrentFirst.id, concurrentRetry.id)

  await repository.supersedeDecision(identity, concurrentFirst.id, first.id)
  const allCandidates = await repository.memorySearchCandidates(identity)
  assert.equal(allCandidates.some((decision) => decision.id === first.id), true)
  assert.equal(
    allCandidates.find((decision) => decision.id === first.id).status,
    "SUPERSEDED",
  )
  const activeCandidates = await repository.memorySearchCandidates(identity, {
    status: "ACTIVE",
  })
  assert.equal(activeCandidates.some((decision) => decision.id === first.id), false)
  assert.equal(allCandidates.find((decision) => decision.id === first.id).sources.length, 1)
  for (const filters of [
    { channel: "integration-channel" },
    { ownerId: user.id },
    { tag: "integration-memory" },
    { appliesTo: "Integration API" },
    { status: "SUPERSEDED" },
  ]) {
    const filtered = await repository.memorySearchCandidates(identity, filters)
    assert.equal(filtered.some((decision) => decision.id === first.id), true)
  }

  const tagged = await repository.createDecision(identity, {
    title: "Use object storage for 100% of rehearsal exports",
    appliesTo: ["Rehearsal pipeline"],
    tags: ["integration-alpha", "integration-beta"],
  })
  const ids = async (filters) =>
    (await repository.listDecisions(identity, filters)).map((decision) => decision.id)

  // Words may come from different fields and different tags, in any order.
  assert.deepEqual(await ids({ q: "rehearsal STORAGE" }), [tagged.id])
  assert.deepEqual(await ids({ q: "integration-beta integration-alpha" }), [tagged.id])
  // Both Slack fixtures share the captured discussion that contains these words.
  assert.deepEqual(
    (await ids({ q: "architecture boring" })).sort(),
    [first.id, concurrentFirst.id].sort(),
  )
  assert.deepEqual(await ids({ q: "storage nonexistentword" }), [])
  // LIKE wildcards in the query are literal text.
  assert.deepEqual(await ids({ q: "100%" }), [tagged.id])
  assert.deepEqual(await ids({ q: "%" }), [tagged.id])
  assert.deepEqual(await ids({ q: "_" }), [])
  assert.deepEqual(await ids({ q: "storage", tag: "integration-alpha" }), [tagged.id])
  assert.deepEqual(await ids({ q: "storage", tag: "integration-memory" }), [])

  const byTag = await repository.listDecisions(identity, { tag: "integration-alpha" })
  assert.deepEqual([...byTag[0].tags].sort(), ["integration-alpha", "integration-beta"])

  const listed = await repository.listDecisions(identity, { status: "SUPERSEDED" })
  assert.deepEqual(listed.find((decision) => decision.id === first.id).supersededBy, [
    { id: concurrentFirst.id, decisionKey: concurrentFirst.decisionKey },
  ])

  await assert.rejects(
    repository.createDecision(identity, {
      title: "Invalid owner fixture",
      ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    (error) => error instanceof DomainError && error.code === "CROSS_WORKSPACE_OWNER",
  )

  // P1: owner names remain filterable without pretending to be user identities.
  const named = await repository.createDecision(identity, {
    title: "Named-owner migration storage", ownerName: "Slack-only owner",
    appliesTo: ["Migration", "Reporting"], tags: ["scope-test"],
  })
  assert.ok((await repository.metadata(identity)).ownerNames.includes("Slack-only owner"))
  assert.deepEqual((await repository.metadata(identity)).channels, ["integration-channel"])
  assert.deepEqual((await ids({ channel: "integration-channel" })).sort(), [first.id, concurrentFirst.id].sort())
  assert.deepEqual(await ids({ channel: "integration-channel", q: "Named-owner" }), [])
  assert.deepEqual(await ids({ ownerId: "name:Slack-only owner", q: "MIGRAT", appliesTo: "Reporting", tag: "scope-test", dateRange: "7" }), [named.id])
  await models.Decision.update({ createdAt: new Date("2020-01-01T00:00:00Z") }, { where: { id: named.id } })
  assert.deepEqual(await ids({ ownerId: "name:Slack-only owner", dateRange: "7" }), [])
  const foreign = await repository.createDecision(otherIdentity, { title: "Foreign private decision", references: [{ kind: "URL", url: "https://example.com/private" }] })
  assert.equal(await repository.getDecision(identity, foreign.id), null)
  assert.equal(await repository.updateDecision(identity, foreign.id, { title: "Should not update" }), null)
  const jiraLink = { kind: "JIRA", label: "MIG-183", url: "https://example.atlassian.net/browse/MIG-183" }
  assert.equal(await repository.addReference(identity, foreign.id, jiraLink), null, "A Jira link cannot be added across workspaces")
  const linked = await repository.addReference(otherIdentity, foreign.id, jiraLink)
  assert.deepEqual(linked.references.map((reference) => reference.label).sort(), ["MIG-183", "Related work"])
  assert.equal((await ids({})).includes(foreign.id), false)
  for (const [current, target, code] of [
    [named.id, named.id, "SELF_SUPERSESSION"],
    [named.id, foreign.id, "DECISION_NOT_FOUND"],
    [named.id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "DECISION_NOT_FOUND"],
    [named.id, first.id, "INACTIVE_SUPERSESSION"],
  ]) {
    await assert.rejects(repository.supersedeDecision(identity, current, target), (error) => error.code === code)
  }
  const old = await repository.createDecision(identity, { title: "Concurrent lifecycle old" })
  const next = await repository.createDecision(identity, { title: "Concurrent lifecycle new" })
  const competitor = await repository.createDecision(identity, { title: "Concurrent lifecycle competitor" })
  const races = await Promise.allSettled([
    repository.supersedeDecision(identity, next.id, old.id),
    repository.supersedeDecision(identity, competitor.id, old.id),
  ])
  assert.equal(races.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(races.find((result) => result.status === "rejected").reason.code, "INACTIVE_SUPERSESSION")
  const oldDetail = await repository.getDecision(identity, old.id)
  assert.equal(oldDetail.status, "SUPERSEDED")
  assert.equal(oldDetail.lifecycle.supersededBy.length, 1)
  assert.equal((await repository.getDecision(identity, oldDetail.lifecycle.supersededBy[0].id)).lifecycle.supersedes[0].id, old.id)
  const counts = async () => Promise.all([models.Decision, models.Tag, models.ExternalReference, models.SourceSnapshot, models.SlackInteraction].map((model) => model.count({ where: { workspaceId: workspace.id } })))
  const before = await counts()
  await assert.rejects(repository.createDecision(identity, {
    title: "Rollback fixture", tags: ["rollback-unique-tag"], references: [{ kind: "URL", url: "https://example.com" }],
  }, { source: { provider: null, capturedAt: new Date() }, idempotencyKey: "rollback-interaction" }))
  assert.deepEqual(await counts(), before, "Failed capture must roll back every dependent record")

  // Signed HTTP boundary through real persistence, with only Slack Web API mocked.
  // geminiApiKey is cleared so this check never sends data to the real Gemini API.
  const slackConfig = { ...config, geminiApiKey: undefined, localWorkspaceId: workspaceKey, localUserId: "integration-user",
    slackTeamId: "T-INTEGRATION", slackSigningSecret: "integration-secret", slackBotToken: "fixture" }
  let searchMatch = named
  const similarSearch = {
    enabled: true,
    search: async () => ({
      candidateCount: 1,
      matches: [{ decisionId: searchMatch.id, score: 90, explanation: "", matchedConcepts: [], decision: searchMatch }],
    }),
  }
  const app = createApp({ config: slackConfig, repository, memorySearch: similarSearch })
  const server = app.listen(0, "127.0.0.1")
  await once(server, "listening")
  const realFetch = globalThis.fetch
  const updates = []
  const ephemerals = []
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith("https://slack.com/api/")) return realFetch(url, init)
    const method = String(url).split("/").at(-1)
    if (method === "views.update") updates.push(JSON.parse(init.body.get("view")))
    if (method === "chat.postEphemeral") ephemerals.push(Object.fromEntries(init.body))
    return { json: async () => ({ ok: true, view: { id: "V-INTEGRATION" },
      permalink: "https://example.slack.com/archives/C1/p1",
      messages: [{ ts: "1", text: "Use durable storage", user: "U1", reply_count: 1 },
        { ts: "2", thread_ts: "1", text: "Agree", user: "U2" }], members: [] }) }
  }
  const base = `http://127.0.0.1:${server.address().port}`
  async function sendSlack(payload) {
    const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = "v0=" + crypto.createHmac("sha256", slackConfig.slackSigningSecret)
      .update(`v0:${timestamp}:${body}`).digest("hex")
    return realFetch(`${base}/slack/interactions`, { method: "POST", body,
      headers: { "content-type": "application/x-www-form-urlencoded", "x-slack-request-timestamp": timestamp, "x-slack-signature": signature } })
  }
  async function waitFor(predicate) {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await delay(10) }
    assert.fail("Slack flow did not complete")
  }
  try {
    await sendSlack({ type: "message_action", callback_id: "save_as_decision", trigger_id: "http-trigger",
      team: { id: "T-INTEGRATION" }, user: { id: "U1" }, channel: { id: "C1", name: "infra-http-capture" },
      message: { ts: "2", thread_ts: "1", text: "Agree", user: "U2" } })
    await waitFor(() => updates.some((view) => view.callback_id === "decision_memory_save"))
    const modal = updates.find((view) => view.callback_id === "decision_memory_save")
    assert.match(JSON.stringify(modal), /Already decided\?/)
    assert.deepEqual(modal.blocks.find((block) => block.block_id === "replaces").element.options.map((option) => option.value), [named.id])
    const state = Object.fromEntries(Object.entries({ title: "HTTP capture fixture", why: "Durable rollback",
      replacementReason: "A new reliability requirement changed our choice.", appliesTo: "Migration", relatedUrl: "https://example.atlassian.net/browse/DEMO-1" })
      .map(([key, value]) => [key, { value: { value } }]))
    state.replaces = { value: { selected_option: { value: named.id } } }
    const submission = { type: "view_submission", team: { id: "T-INTEGRATION" }, user: { id: "U1" },
      view: { id: "V-INTEGRATION", callback_id: "decision_memory_save", private_metadata: modal.private_metadata, state: { values: state } } }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await (await sendSlack(submission)).json()
      assert.equal(response.response_action, "update")
      await waitFor(() => updates.filter((view) => view.title.text === "Decision saved").length === attempt)
    }
    assert.equal((await realFetch(`${base}/api/decisions/${foreign.id}`)).status, 404)
    assert.equal((await realFetch(`${base}/api/decisions/${foreign.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "No access", references: [] }) })).status, 404)
    // The blocked cross-workspace edit left both of its links (the original and MIG-183) intact.
    assert.equal((await repository.getDecision(otherIdentity, foreign.id)).references.length, 2)
    assert.equal((await realFetch(`${base}/api/decisions/${named.id}/supersede`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetId: foreign.id }) })).status, 404)
    const rows = await (await realFetch(`${base}/api/decisions?q=HTTP%20capture`)).json()
    assert.equal(rows.length, 1, "Slack retry must preserve one Decision")
    const detail = await (await realFetch(`${base}/api/decisions/${rows[0].id}`)).json()
    assert.equal(detail.sources[0].messages.length, 2)
    assert.equal(detail.sources[0].anchorText, "Agree")
    assert.equal(detail.sources[0].channelName, "infra-http-capture", "Slack fills in the channel")
    assert.equal(rows[0].sources[0].channelName, "infra-http-capture", "Library rows show the channel")
    const byChannel = await (await realFetch(`${base}/api/decisions?q=infra-http-capture`)).json()
    assert.deepEqual(byChannel.map((row) => row.id), [rows[0].id], "Search finds a Decision by its channel")
    assert.equal(detail.sources[0].sourceContext.captureStatus, "CAPTURED")
    assert.equal(detail.references[0].url, "https://example.atlassian.net/browse/DEMO-1")
    assert.equal(detail.references[0].label, "DEMO-1", "Slack Jira links are labelled by issue key")
    assert.deepEqual(detail.lifecycle.supersedes.map((item) => item.id), [named.id], "Replaces supersedes the chosen Decision")
    assert.equal((await repository.getDecision(identity, named.id)).status, "SUPERSEDED")
    assert.equal(detail.lifecycle.supersedes[0].replacementReason, "A new reliability requirement changed our choice.")
    assert.match(updates.filter((view) => view.title.text === "Decision saved").at(-1).blocks[0].text.text, /It replaces DM-\d+, which is now superseded/)
    console.log("Signed Slack → draft → save/retry → API search/detail passed with real PostgreSQL")

    // Nudges: the Decision saved from thread "1" is known for that thread only,
    // and of several simultaneous claims for one thread exactly one wins.
    assert.deepEqual(await repository.decisionIdsForThread(identity, "C1", "1"), [detail.id])
    assert.deepEqual(await repository.decisionIdsForThread(otherIdentity, "C1", "1"), [])
    const nudge = { channelId: "C9", threadTs: "9.0", kind: "RECALL", decisionId: detail.id }
    const claims = await Promise.all(Array.from({ length: 5 }, () => repository.claimSlackNudge(identity, nudge)))
    assert.equal(claims.filter(Boolean).length, 1, "One nudge per thread and kind")
    assert.equal(await repository.claimSlackNudge(identity, { ...nudge, kind: "CAPTURE", decisionId: null }), true)
    assert.equal(await repository.claimSlackNudge(otherIdentity, nudge), true, "Claims are per workspace")

    // The signed events endpoint through real PostgreSQL.
    searchMatch = await repository.getDecision(identity, detail.id)
    ephemerals.length = 0 // drop the earlier "Saved DM-…" confirmations
    async function sendEvent(event) {
      const body = JSON.stringify({ type: "event_callback", team_id: "T-INTEGRATION", event: { type: "message", channel: "C1", channel_type: "channel", user: "U3", ...event } })
      const timestamp = String(Math.floor(Date.now() / 1000))
      const signature = "v0=" + crypto.createHmac("sha256", slackConfig.slackSigningSecret).update(`v0:${timestamp}:${body}`).digest("hex")
      const response = await realFetch(`${base}/slack/events`, { method: "POST", body,
        headers: { "content-type": "application/json", "x-slack-request-timestamp": timestamp, "x-slack-signature": signature } })
      assert.equal(response.status, 200)
    }
    await sendEvent({ ts: "5.0", text: "Should we keep rollback data durable?" })
    await sendEvent({ ts: "3", thread_ts: "1", text: "Should we keep rollback data durable?" })
    await sendEvent({ ts: "4", thread_ts: "1", text: "Agreed, let's go with it." })
    await sendEvent({ ts: "6.1", thread_ts: "6.0", text: "Agreed, let's go with it." })
    await waitFor(() => ephemerals.length === 2)
    await sendEvent({ ts: "5.0", text: "Should we keep rollback data durable?" })
    await delay(300)
    assert.equal(ephemerals.length, 2, "No nudges in the thread a Decision came from, and none repeated")
    const recall = ephemerals.find((item) => !item.thread_ts)
    assert.match(recall.blocks, new RegExp(`${detail.decisionKey} · HTTP capture fixture`))
    assert.equal(ephemerals.find((item) => item.thread_ts)?.thread_ts, "6.0")
    console.log("Signed Slack events → Already decided and Save it? nudges passed with real PostgreSQL")
  } finally {
    globalThis.fetch = realFetch
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections() })
  }

  // Review regressions: lifecycle traverses successors without calling an
  // intermediate superseded record current.
  const chainA = await repository.createDecision(identity, { title: "Chain review A", appliesTo: ["Evolution review"] })
  const chainB = await repository.createDecision(identity, { title: "Chain review B", appliesTo: ["Evolution review"] })
  const chainC = await repository.createDecision(identity, { title: "Chain review C", appliesTo: ["Evolution review"] })
  await repository.supersedeDecision(identity, chainB.id, chainA.id, "  Local exports now exceed disk capacity.  ")
  await repository.supersedeDecision(identity, chainC.id, chainB.id)
  const chain = await repository.getDecision(identity, chainA.id)
  assert.deepEqual(chain.lifecycle.supersededBy.map((d) => d.id), [chainB.id])
  assert.deepEqual(chain.lifecycle.current.map((d) => d.id), [chainC.id], "US-07: current must resolve to an ACTIVE successor")
  assert.equal(await repository.getDecision(otherIdentity, chainA.id), null)
  assert.equal(chain.lifecycle.supersededBy[0].replacementReason, "Local exports now exceed disk capacity.")
  assert.equal((await repository.getDecision(identity, chainB.id)).lifecycle.supersedes[0].replacementReason, "Local exports now exceed disk capacity.")
  assert.ok(chain.lifecycle.supersededBy[0].replacedAt)
  const scopes = await repository.listScopes(identity)
  assert.deepEqual(scopes.find((scope) => scope.scope === "Evolution review").activeCount, 1)
  const overview = await repository.scopeOverview(identity, "Evolution review")
  assert.equal(overview.decisionCount, 3)
  assert.deepEqual(overview.activeDecisions.map((decision) => decision.id), [chainC.id])
  assert.equal(overview.changes.length, 2)
  assert.ok(overview.changes.some((change) => change.replacementReason === "Local exports now exceed disk capacity."))
  assert.equal(await repository.scopeOverview(otherIdentity, "Evolution review"), null)
  assert.equal((await repository.listScopes(otherIdentity)).some((scope) => scope.scope === "Evolution review"), false)
  const scopeMoved = await repository.createDecision(identity, { title: "Scope review moved", appliesTo: ["New scope review"] })
  await repository.supersedeDecision(identity, scopeMoved.id, chainC.id, "Ownership moved to another service.")
  const oldScope = await repository.scopeOverview(identity, "Evolution review")
  assert.equal(oldScope.activeDecisions.length, 0)
  assert.ok(oldScope.changes.some((change) => change.replacement.id === scopeMoved.id), "Moving scopes preserves the old scope's replacement history")
  await assert.rejects(repository.supersedeDecision(identity, scopeMoved.id, chainA.id, "x".repeat(2001)), (error) => error.issues?.[0]?.path?.length === 0)


  // A real PostgreSQL receipt survives failure and service recreation. Only
  // the outbound Jira create is mocked; linking and transactions are real.
  const requestId = crypto.randomUUID()
  const jiraInput = { projectKey: "MIG", issueTypeId: "10001", summary: "Review retry" }
  let jiraCreates = 0
  let releaseJira
  let startedJira
  const started = new Promise((resolve) => { startedJira = resolve })
  const waitingJira = new Promise((resolve) => { releaseJira = resolve })
  const jira = { createIssue: async () => {
    jiraCreates++; startedJira(); await waitingJira
    return { key: "MIG-999", url: "https://example.atlassian.net/browse/MIG-999" }
  } }
  const args = { repository, jira, identity, decision: chainC, requestId, input: jiraInput }
  const firstJira = createLinkedJiraIssue({ ...args, repository: { ...repository, linkJiraIssueRequest: async () => { throw new Error("local write failed") } } })
  await started
  await assert.rejects(createLinkedJiraIssue(args), (e) => e.code === "JIRA_OUTCOME_UNKNOWN", "A concurrent retry must not create an issue")
  releaseJira()
  await assert.rejects(firstJira, (e) => e.code === "JIRA_LINK_PENDING" && e.issue.key === "MIG-999")
  const recovered = await createLinkedJiraIssue({ ...args, repository: createRepository(models) })
  await Promise.all([createLinkedJiraIssue(args), createLinkedJiraIssue(args)])
  assert.equal(jiraCreates, 1)
  assert.equal(recovered.decision.references.filter((ref) => ref.label === "MIG-999").length, 1)
  assert.equal(await models.ExternalReference.count({ where: { decisionId: chainC.id, label: "MIG-999" } }), 1)
  await assert.rejects(repository.claimJiraIssueRequest(identity, chainC.id, requestId, { ...jiraInput, summary: "changed" }), (e) => e.code === "JIRA_REQUEST_MISMATCH")
  await assert.rejects(repository.linkJiraIssueRequest(otherIdentity, requestId), (e) => e.code === "JIRA_OUTCOME_UNKNOWN")

  // Existing keyword and metadata queries retain older records beyond 200.
  // Real indexed retrieval is exercised by npm run test:local-search.
  const oldMemory = await repository.createDecision(identity, { title: "Older bounded recall sentinel", appliesTo: ["Bounded review"] })
  await models.Decision.update({ createdAt: new Date("2020-01-01") }, { where: { id: oldMemory.id } })
  await models.Decision.bulkCreate(Array.from({ length: 201 }, (_, i) => ({
    workspaceId: workspace.id, decisionKey: `DM-${9000 + i}`, title: `Bounded review ${i}`, appliesTo: ["Bounded review"],
  })))
  const boundedFilters = { appliesTo: "Bounded review" }
  assert.equal(await repository.memorySearchCandidateCount(identity, boundedFilters), 202)
  const bounded = await repository.memorySearchCandidates(identity, boundedFilters)
  assert.equal(bounded.length, 202)
  assert.equal(bounded.some((d) => d.id === oldMemory.id), true)
  assert.deepEqual((await repository.listDecisions(identity, { q: "Older bounded recall sentinel" })).map((d) => d.id), [oldMemory.id])
  assert.equal(await repository.memorySearchCandidateCount(otherIdentity, boundedFilters), 0)

  const capped = await repository.memorySearchCandidates(identity, boundedFilters, { limit: 200 })
  assert.equal(capped.length, 200)
  assert.equal(capped.some(d => d.id === oldMemory.id), false, "Gemini's newest 200 exclude the older matching record")
  await repository.updateDecision(identity, oldMemory.id, { title: oldMemory.title, appliesTo: oldMemory.appliesTo, ownerName: "Recorded Gemini owner", tags: ["gemini-filter-proof"] })
  let sentCards = []
  const gemini = createGeminiMemorySearchService({ config: { geminiModel: "fixture-model" }, repository,
    generateContent: async (request) => {
      sentCards = JSON.parse(request.contents.split("Candidate Decisions:\n")[1])
      return { text: JSON.stringify({ matches: [{ decisionId: sentCards[0].decisionId, score: 90, explanation: "Stored choice", matchedConcepts: [] }] }) }
    } })
  const limited = await gemini.search(identity, { query: "migration memory", filters: boundedFilters })
  assert.equal(limited.candidateCount, 200)
  assert.equal(limited.totalCandidateCount, 202)
  assert.equal(limited.truncated, true)
  const narrowed = await gemini.search(identity, { query: "migration memory", filters: { ...boundedFilters, ownerId: "name:Recorded Gemini owner", tag: "gemini-filter-proof", status: "ACTIVE" } })
  assert.deepEqual(sentCards.map(d => d.decisionId), [oldMemory.id], "All filters are applied before the newest-200 cap")
  assert.equal(narrowed.truncated, false)
  assert.equal((await gemini.search(identity, { query: "migration memory", filters: { ...boundedFilters, dateRange: "7", tag: "gemini-filter-proof" } })).candidateCount, 0)
  const channelFilters = { channel: "integration-channel", tag: "integration-memory", ownerId: user.id, status: "SUPERSEDED", appliesTo: "Integration API", dateRange: "7" }
  assert.equal((await gemini.search(identity, { query: "durable rollback", filters: channelFilters })).matches[0].decisionId, first.id)
  assert.equal((await gemini.search(otherIdentity, { query: "migration memory", filters: boundedFilters })).candidateCount, 0)
  await verifyDecisionDeadlines({ repository, models, config, identity, otherIdentity, source: capturedSource })
  console.log("Gemini candidate proof passed: newest 200, filter-first channel/tag/owner/name/status/scope/date, counts and workspace isolation; provider mocked")
  console.log("Review regressions passed: active successor, durable Jira recovery/concurrency/isolation, uncapped recall filter inputs")

  console.log(
    "Integration verification passed: Slack draft persistence/expiry/isolation, concurrent idempotency, durable source, multi-word search, tag filter, filtered memory candidates, superseded results, references, owner scope",
  )
} finally {
  await models.Workspace.destroy({ where: { externalKey: workspaceKey } })
  await models.Workspace.destroy({ where: { externalKey: otherWorkspaceKey } })
  await models.sequelize.close()
}
