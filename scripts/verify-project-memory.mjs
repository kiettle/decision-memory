import assert from "node:assert/strict"
import { answerContext } from "../apps/server/src/answer-context.js"

export async function verifyProjectMemory({ repository, models, identity, otherIdentity }) {
  const scope = "Project memory synthetic Atlas"
  const teammate = { ...identity, userExternalId: "project-memory-follower" }
  const { workspace, user } = await repository.resolveContext(identity)
  await repository.resolveContext(teammate)
  const old = await repository.createDecision(identity, { title: "Atlas exports use local disk", appliesTo: [scope], ownerId: user.id })
  const excerpt = "Atlas planning (synthetic)\nAgreed: Keep exports in object storage.\nReason: Workers restart.\nOpen: Who owns retention?"
  const current = await repository.createDecision(identity, {
    title: "Atlas exports use object storage", why: "Workers restart.", appliesTo: [scope], ownerId: user.id,
    ownerContact: "Ask in the synthetic Atlas planning meeting.", optionsConsidered: ["Local disk"],
    pastedSource: { excerpt, origin: "Synthetic planning notes" },
    references: [{ kind: "URL", url: "https://example.com/synthetic-atlas", label: "Synthetic evidence" }],
  })
  assert.equal(current.sources[0].provider, "PASTED_NOTES")
  assert.equal(current.sources[0].anchorText, excerpt)
  assert.equal(current.sources[0].sourceContext.origin, "Synthetic planning notes")
  await repository.setFollow(teammate, { kind: "SCOPE", target: scope, following: true })
  assert.deepEqual((await repository.notifications(teammate)).items, [], "Following never reveals earlier events")
  await repository.supersedeDecision(identity, current.id, old.id, "Workers restart; local disk loses exports.")
  const context = await answerContext(repository, identity, [old.id], scope)
  assert.equal(context.decisions[0].id, current.id)
  assert.equal(context.decisions[0].why, "Workers restart.")
  assert.equal(context.decisions[1].status, "SUPERSEDED")
  assert.deepEqual(context.decisions[1].lifecycle.current.map(d => d.id), [current.id])
  assert.deepEqual((await answerContext(repository, otherIdentity, [old.id], scope)).decisions, [], "Answer context cannot hydrate foreign evidence")
  await assert.rejects(repository.setImportant(teammate, current.id, true), error => error.code === "BRIEF_OWNER_REQUIRED" && /linked decision owner/.test(error.message))
  await assert.rejects(repository.setImportant(otherIdentity, current.id, true), error => error.status === 404)
  await assert.rejects(repository.setImportant(identity, old.id, true), error => error.code === "CURRENT_CHOICE_REQUIRED")
  await repository.setImportant(identity, current.id, true)
  const questionText = "How should Atlas retain exports?"
  const question = await repository.createDecision(identity, { title: questionText, decisionState: "PENDING", appliesTo: [scope], ownerId: user.id,
    context: "Created from an insufficient search; original query retained in the question." })
  await repository.setFollow(teammate, { kind: "DECISION", target: question.id, following: true })
  await repository.setFollow(teammate, { kind: "DECISION", target: question.id.toUpperCase(), following: true })
  assert.equal((await repository.follows(teammate)).filter(follow => follow.target === question.id).length, 1, "UUID spelling cannot create a dead or duplicate follow")
  let overview = await repository.scopeOverview(identity, scope)
  assert.deepEqual(overview.activeDecisions.filter(d => d.handoverImportant).map(d => d.id), [current.id])
  assert.equal(overview.activeDecisions.find(d => d.id === current.id).sources[0].anchorText, excerpt)
  assert.deepEqual(overview.openQuestions.map(d => [d.title, d.owner.id]), [[questionText, user.id]])
  assert.equal(overview.changes[0].replacementReason, "Workers restart; local disk loses exports.")
  assert.equal((await repository.memorySearchCandidates(identity, { appliesTo: scope })).some(d => d.id === question.id), false)
  // Evidence can be attached before completion using the existing editor.
  await repository.updateDecision(identity, question.id, { title: questionText, decisionState: "PENDING", appliesTo: [scope], ownerId: user.id,
    references: [{ kind: "URL", url: "https://example.com/retention", label: "Retention agreement" }] })
  const completed = await repository.recordOutcome(identity, question.id, { outcome: "Retain Atlas exports for 30 days", why: "Recovery window agreed with support." })
  assert.equal(completed.title, questionText)
  assert.equal(completed.references[0].label, "Retention agreement")
  assert.equal((await repository.listDecisions(identity, { q: "Atlas 30 days" })).some(d => d.id === question.id), true)
  assert.equal((await repository.memorySearchCandidates(identity, { appliesTo: scope })).some(d => d.id === question.id), true)
  const feed = await repository.notifications(teammate)
  assert.deepEqual(feed.items.map(item => item.kind).sort(), ["ANSWERED", "REPLACED"])
  const replacement = feed.items.find(item => item.kind === "REPLACED")
  assert.equal(replacement.previous.choice, old.outcome)
  assert.equal(replacement.current.choice, current.outcome)
  assert.equal(replacement.reason, "Workers restart; local disk loses exports.")
  assert.deepEqual((await repository.notifications(identity)).items, [], "Actors are never implicitly followed")
  assert.deepEqual((await repository.notifications(otherIdentity)).items, [], "Foreign workspace cannot receive a change")
  await assert.rejects(repository.setFollow(otherIdentity, { kind: "DECISION", target: current.id, following: true }), error => error.code === "FOLLOW_TARGET_NOT_FOUND")
  await assert.rejects(repository.setFollow(otherIdentity, { kind: "SCOPE", target: scope, following: true }), error => error.code === "FOLLOW_TARGET_NOT_FOUND")
  await repository.createDecision(otherIdentity, { title: "Foreign workspace Atlas choice", appliesTo: [scope] })
  await repository.setFollow(otherIdentity, { kind: "SCOPE", target: scope, following: true })
  assert.deepEqual((await repository.notifications(otherIdentity)).items, [], "An identically named foreign scope never reveals another workspace's events")
  await repository.createDecision(otherIdentity, { title: "Foreign workspace second Atlas choice", appliesTo: [scope] })
  assert.equal((await repository.notifications(otherIdentity)).items.length, 1, "Foreign user can receive their own scope events")
  assert.equal((await repository.notifications(teammate)).items.length, 2, "Foreign scope events never reach a matching local scope follower")
  await assert.rejects(repository.follows({ ...identity, userExternalId: "forge-user" }), error => error.code === "PERSONAL_IDENTITY_REQUIRED")
  await repository.readNotifications(teammate, feed.items.map(item => item.id))
  assert.ok((await repository.notifications(teammate)).items.every(item => item.read))
  await repository.readNotifications(otherIdentity, feed.items.map(item => item.id))
  assert.ok((await repository.notifications(otherIdentity)).items.every(item => !item.read), "Read state belongs only to the viewer")
  const count = feed.items.length
  await repository.recordOutcome(identity, question.id, { outcome: completed.outcome, why: completed.why })
  await repository.updateDeadline(identity, question.id, { dueDate: "2026-11-15" })
  assert.equal((await repository.notifications(teammate)).items.length, count, "Completion retry/deadline/curation are not qualifying changes")
  // A workspace-wide update cannot bypass explicit follows.
  await repository.setFollow(teammate, { kind: "SCOPE", target: scope, following: false })
  await repository.setFollow(teammate, { kind: "DECISION", target: question.id, following: false })
  assert.deepEqual((await repository.notifications(teammate)).items, [], "Unfollow hides old items immediately")
  await repository.updateDecision(identity, current.id, { title: current.title, outcome: "Atlas exports use replicated object storage", appliesTo: [scope], why: "Regional recovery.", ownerId: user.id })
  assert.deepEqual((await repository.notifications(teammate)).items, [])
  await repository.setFollow(teammate, { kind: "SCOPE", target: scope, following: true })
  assert.deepEqual((await repository.notifications(teammate)).items, [], "Refollow starts now, not retroactively")
  await repository.createDecision(identity, { title: "Atlas validates export checksums", appliesTo: [scope], why: "Catch corruption." })
  assert.deepEqual((await repository.notifications(teammate)).items.map(item => item.kind), ["RECORDED"])
  const changed = await repository.updateDecision(identity, current.id, { title: current.title, outcome: "Atlas exports use replicated object storage", appliesTo: [scope, "Atlas recovery"], why: "Regional recovery.", ownerId: user.id })
  assert.equal((await repository.notifications(teammate)).items[0].kind, "UPDATED")
  await repository.updateDecision(identity, current.id, { title: changed.title, outcome: changed.outcome, appliesTo: changed.appliesTo, why: changed.why, ownerId: user.id, tags: ["non-qualifying"] })
  assert.equal((await repository.notifications(teammate)).items.length, 2, "Tag-only edits do not emit noise")
  await models.Decision.update({ appliesTo: [scope, scope, "Atlas recovery"] }, { where: { id: current.id } })
  await repository.updateDecision(identity, current.id, { title: changed.title, outcome: changed.outcome, appliesTo: [...changed.appliesTo].reverse(), why: changed.why, ownerId: user.id })
  assert.equal((await repository.notifications(teammate)).items.length, 2, "Scope order and legacy duplicate cleanup do not change the applicable scope set")
  overview = await repository.scopeOverview(identity, scope)
  assert.equal(overview.activeDecisions.find(d => d.id === current.id).handoverImportant, true)
  await repository.updateDecision(identity, current.id, { title: changed.title, outcome: changed.outcome, appliesTo: changed.appliesTo, why: changed.why, ownerId: null })
  assert.equal((await repository.getDecision(identity, current.id)).handoverImportant, false, "Ownership transfer clears the old owner's brief selection")
  const delayed = await models.sequelize.transaction()
  try {
    await repository.recordChange(workspace.id, null, { ...changed, title: "Delayed commit change sentinel" }, delayed)
    const displayed = await repository.notifications(teammate)
    await repository.readNotifications(teammate, displayed.items.map(item => item.id))
    await delayed.commit()
  } finally { if (!delayed.finished) await delayed.rollback() }
  const lateEvent = (await repository.notifications(teammate)).items.find(item => item.current.title === "Delayed commit change sentinel")
  assert.ok(lateEvent)
  assert.equal(lateEvent.read, false, "A change committed after mark-read must remain unread, even if inserted earlier")
  // Event persistence failure must roll back the decision, not silently lose a notification.
  const query = models.sequelize.query.bind(models.sequelize)
  models.sequelize.query = (...args) => /INSERT INTO memory_changes/.test(args[0]) ? Promise.reject(new Error("synthetic event failure")) : query(...args)
  try { await assert.rejects(repository.createDecision(identity, { title: "Atomic event rollback sentinel", appliesTo: [scope] }), /synthetic event failure/) }
  finally { models.sequelize.query = query }
  assert.equal(await models.Decision.count({ where: { workspaceId: workspace.id, title: "Atomic event rollback sentinel" } }), 0)
  console.log("Project memory integration passed: current history, exact pasted evidence, owner-only brief, owned searchable question completion, personal/tenant follows, qualifying events, unfollow/refollow and atomic rollback")
}
