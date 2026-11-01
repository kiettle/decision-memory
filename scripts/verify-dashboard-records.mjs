import assert from "node:assert/strict"
import { QueryTypes } from "sequelize"
import { createAnalyticsRecords } from "../apps/server/src/analytics-records.js"

export async function verifyDashboardRecords({ repository, models, identity, otherIdentity }) {
  const a = { ...identity, workspaceExternalKey: `${identity.workspaceExternalKey}-dashboard`, userExternalId: "dashboard-creator", userDisplayName: "Documentation account" }
  const b = { ...a, userExternalId: "dashboard-owner", userDisplayName: "Alex" }
  const stranger = { ...otherIdentity, workspaceExternalKey: `${otherIdentity.workspaceExternalKey}-dashboard` }
  const keys = [a.workspaceExternalKey, stranger.workspaceExternalKey]
  const analytics = createAnalyticsRecords({ sequelize: models.sequelize, resolveContext: repository.resolveContext })
  try {
    await models.Workspace.destroy({ where: { externalKey: keys } })
    const { workspace, user: creator } = await repository.resolveContext(a)
    const { user: owner } = await repository.resolveContext(b)
    const now = new Date("2026-10-29T12:00:00Z")
    const input = { scope: "Dashboard proof", days: 7, asOf: "2026-10-29" }
    async function make(title, values = {}, dates = {}) {
      const record = await repository.createDecision(a, { title, decisionState: "PENDING", appliesTo: [input.scope], ...values })
      await models.Decision.update({ createdAt: new Date("2026-10-28T12:00:00Z"), ...dates }, { where: { id: record.id } })
      return record
    }
    const overdue = await make("Old unresolved question", { ownerId: owner.id, dueDate: "2026-10-28" }, { createdAt: new Date("2020-01-01") })
    await make("Due today", { ownerId: owner.id, dueDate: "2026-10-29" })
    await make("Due in seven days", { ownerId: owner.id, dueDate: "2026-11-05" })
    await make("Due later", { ownerName: "Alex", dueDate: "2026-11-06" })
    await make("Unassigned without deadline")
    await make("Outside selected scope", { appliesTo: ["Another project"] })
    await repository.createDecision(stranger, { title: "Other workspace private fixture", decisionState: "PENDING", appliesTo: [input.scope], ownerName: "Alex", dueDate: "2020-01-01" })
    const resolved = await make("Question later resolved", { ownerId: owner.id })
    const answered = await repository.recordOutcome(a, resolved.id, { outcome: "The recorded answer", why: "Synthetic proof" })
    assert.equal(answered.initialDecisionState, "PENDING")
    await models.Decision.update({ decidedAt: new Date("2026-10-29T01:00:00Z") }, { where: { id: resolved.id } })
    const captured = await make("Direct choice", { decisionState: "DECIDED", outcome: "Capture the agreed choice", ownerId: owner.id }, { decidedAt: new Date("2026-10-29T03:00:00Z") })
    assert.equal(captured.initialDecisionState, "DECIDED")
    await repository.updateDecision(a, captured.id, { title: captured.title, decisionState: "DECIDED", outcome: "Edited choice", ownerId: owner.id, appliesTo: [input.scope] })
    assert.equal((await repository.getDecision(a, captured.id)).initialDecisionState, "DECIDED")
    await make("Legacy dated choice", { decisionState: "DECIDED", outcome: "Known date, unknown path" }, { initialDecisionState: null, decidedAt: new Date("2026-10-29T23:59:59Z") })
    await make("Legacy unknown date", { decisionState: "DECIDED", outcome: "No invented timestamp" }, { initialDecisionState: null, decidedAt: null })
    const unattributed = await make("Historical creator unavailable", { decisionState: "DECIDED", outcome: "No inferred author" }, { createdById: null, decidedAt: new Date("2026-10-30T00:00:00Z") })
    // A cross-workspace creator FK must not expose the other workspace's name.
    const { user: foreignUser } = await repository.resolveContext(stranger)
    await models.Decision.update({ createdById: foreignUser.id }, { where: { id: unattributed.id } })

    const data = await analytics.dashboardRecords(a, input, now)
    assert.deepEqual(data.pending.map(row => [row.label, row.kind, row.overdue, row.pending]), [
      ["Alex", "LINKED", 1, 2], ["Alex", "NAME", 0, 1], ["Unassigned", "UNASSIGNED", 0, 1],
    ])
    assert.equal(data.contributors.find(row => row.key === `user:${creator.id}`).decided, 4)
    assert.equal(data.contributors.find(row => row.key === `user:${creator.id}`).pending, 4, "Creator counts exclude the old question outside the creation period")
    assert.equal(data.contributors.some(row => row.key === `user:${owner.id}`), false, "Ownership never substitutes for record creation")
    assert.equal(data.contributors.find(row => row.key === "unavailable").decided, 1)
    assert.equal(JSON.stringify(data).includes(foreignUser.displayName), false)
    assert.deepEqual(data.trend.find(row => row.day === "2026-10-29"), { day: "2026-10-29", QUESTIONS: 0, RESOLVED: 1, CAPTURED: 1, UNKNOWN: 1 })
    assert.equal(data.trend.find(row => row.day === "2026-10-28").QUESTIONS, 5)
    assert.deepEqual(data.coverage, { missingRecordingDates: 1, unknownInitialState: 2 })
    for (const row of data.pending) for (const [segment, total] of [["OVERDUE", row.overdue], ["PENDING", row.pending]]) {
      const detail = await analytics.dashboardRecordDetail(a, { ...input, chart: "PENDING", key: row.key, segment }, now)
      assert.equal(detail.total, total)
      assert.equal(detail.records.length, total)
      if (row.key === `user:${owner.id}` && segment === "OVERDUE") assert.equal(detail.records[0].id, overdue.id, "Snapshot includes older unresolved records")
    }
    for (const row of data.contributors) for (const [segment, total] of [["DECIDED", row.decided], ["PENDING", row.pending]]) {
      assert.equal((await analytics.dashboardRecordDetail(a, { ...input, chart: "CONTRIBUTOR", key: row.key, segment }, now)).total, total)
    }
    for (const row of data.trend) for (const segment of ["QUESTIONS", "RESOLVED", "CAPTURED", "UNKNOWN"]) {
      assert.equal((await analytics.dashboardRecordDetail(a, { ...input, chart: "TREND", day: row.day, segment }, now)).total, row[segment])
    }
    assert.equal((await analytics.dashboardRecords(a, { ...input, scope: "No such scope" }, now)).pending.length, 0)
    const other = await analytics.dashboardRecords(stranger, input, now)
    assert.equal(other.pending.reduce((total, row) => total + row.overdue + row.pending, 0), 1)
    assert.equal((await analytics.dashboardRecordDetail(stranger, { ...input, chart: "PENDING", key: `user:${owner.id}`, segment: "OVERDUE" }, now)).total, 0)
    assert.equal((await models.Decision.findByPk(overdue.id)).workspaceId, workspace.id)

    // A week bar's drill-down is the inclusive sum of its days.
    const week = data.trend.slice(0, 7)
    for (const segment of ["QUESTIONS", "RESOLVED", "CAPTURED", "UNKNOWN"]) {
      const total = (await analytics.dashboardRecordDetail(a, { ...input, chart: "TREND", from: week[0].day, through: week[6].day, segment }, now)).total
      assert.equal(total, week.reduce((sum, row) => sum + row[segment], 0))
    }

    // Usage facts: nothing is collected until the workspace turns collection on.
    const decisionId = captured.id
    const search = (identity, values) => analytics.recordSearch(identity, { resultCount: 0, method: "KEYWORD", outcome: "NO_RESULTS", ...values }, now)
    assert.deepEqual(await analytics.recordView(a, { decisionId, session: "session-one" }, now), { recorded: false })
    assert.deepEqual(await search(a, { query: "retention" }), { recorded: false })
    assert.equal((await analytics.usageTracking(a)).enabled, false)
    await analytics.setUsageTracking(a, true)
    const minutes = count => new Date(now.getTime() + count * 60000)
    assert.equal((await analytics.recordView(a, { decisionId, session: "session-one" }, now)).recorded, true)
    assert.equal((await analytics.recordView(a, { decisionId, session: "session-one" }, minutes(20))).recorded, false, "Same 30-minute bucket counts once")
    assert.equal((await analytics.recordView(a, { decisionId, session: "session-one" }, minutes(31))).recorded, true, "The next bucket counts again")
    assert.equal((await analytics.recordView(a, { decisionId, session: "session-two" }, now)).recorded, true)
    const foreign = await repository.createDecision(stranger, { title: "Foreign usage fixture", decisionState: "PENDING" })
    assert.equal((await analytics.recordView(a, { decisionId: foreign.id, session: "session-one" }, now)).recorded, false, "Another workspace's decision is never recorded")
    assert.equal((await analytics.recordView(stranger, { decisionId: foreign.id, session: "session-one" }, now)).recorded, false, "Collection is per workspace")
    await search(a, { query: "Backup retention", scope: input.scope })
    await search(a, { query: "backup retention ", scope: input.scope, method: "LOCAL", outcome: "UNHELPFUL", resultCount: 2 })
    await search(a, { query: "object storage", scope: input.scope, outcome: "RESULTS", resultCount: 1 })
    await search(a, { query: "unscoped gap" })
    const usage = await analytics.dashboardUsage(a, input, now)
    assert.deepEqual(usage.tracking, { enabled: true, retentionDays: 90 })
    assert.deepEqual(usage.consulted.map(row => [row.id, row.views]), [[decisionId, 3]])
    assert.deepEqual(usage.totals, { views: 3, searches: 3, gaps: 2 })
    assert.deepEqual(usage.gaps.map(row => [row.key, row.searches, row.unhelpful]), [["backup retention", 2, 1]])
    assert.equal((await analytics.dashboardUsage(a, { ...input, scope: undefined }, now)).totals.gaps, 3, "Unscoped searches count without a scope filter")
    assert.equal(/session-(one|two)/.test(JSON.stringify(usage)), false, "No viewer token leaves the server")
    assert.deepEqual((await analytics.dashboardUsage(stranger, input, now)).totals, { views: 0, searches: 0, gaps: 0 })
    assert.equal((await analytics.deleteSearches(stranger, usage.gaps[0].ids)).deleted, 0, "Teammates delete only their workspace's searches")
    assert.equal((await analytics.deleteSearches(a, usage.gaps[0].ids)).deleted, 2)
    await models.sequelize.query("UPDATE search_events SET created_at = CAST(:old AS timestamptz) WHERE workspace_id = :id",
      { replacements: { old: new Date(now.getTime() - 91 * 86400000).toISOString(), id: workspace.id } })
    await analytics.dashboardUsage(a, input, now)
    const [{ remaining }] = await models.sequelize.query("SELECT COUNT(*)::int AS remaining FROM search_events WHERE workspace_id = :id",
      { replacements: { id: workspace.id }, type: QueryTypes.SELECT })
    assert.equal(remaining, 0, "Facts older than 90 days are purged")
    await analytics.setUsageTracking(a, false)
    assert.equal((await analytics.recordView(a, { decisionId, session: "session-three" }, now)).recorded, false, "Turning collection off stops new facts")
    console.log("Dashboard usage proof passed: off by default, 30-minute view buckets, workspace isolation, scoped search gaps, deletion and 90-day retention")
    console.log("Dashboard record proof passed: local deadline snapshot, creator/owner separation, workspace-safe counts/drill-downs, pending/direct/unknown provenance and UTC buckets")
  } finally {
    await models.Workspace.destroy({ where: { externalKey: keys } })
  }
}
