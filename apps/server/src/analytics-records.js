import { createHash } from "node:crypto"
import { QueryTypes } from "sequelize"

// These expressions are shared by counts and record inspection. In particular,
// period bounds never enter the current pending-question predicate.
const ownerKey = `CASE WHEN o.id IS NOT NULL THEN 'user:' || o.id::text
  WHEN d.owner_id IS NOT NULL THEN 'unavailable'
  WHEN d.owner_name IS NOT NULL THEN 'name:' || d.owner_name ELSE 'unassigned' END`
const contributorKey = `CASE WHEN c.id IS NOT NULL THEN 'user:' || c.id::text ELSE 'unavailable' END`
const questionStarted = `(d.initial_decision_state = 'PENDING' OR d.decision_state = 'PENDING')`
const series = {
  QUESTIONS: { predicate: questionStarted, date: "d.created_at" },
  RESOLVED: { predicate: "d.initial_decision_state = 'PENDING' AND d.decision_state = 'DECIDED'", date: "d.decided_at" },
  CAPTURED: { predicate: "d.initial_decision_state = 'DECIDED' AND d.decision_state = 'DECIDED'", date: "d.decided_at" },
  UNKNOWN: { predicate: "d.initial_decision_state IS NULL AND d.decision_state = 'DECIDED'", date: "d.decided_at" },
}
const joins = `LEFT JOIN users o ON o.id=d.owner_id AND o.workspace_id=d.workspace_id
  LEFT JOIN users c ON c.id=d.created_by_id AND c.workspace_id=d.workspace_id`
const scoped = `d.workspace_id=:workspaceId AND (:scope IS NULL OR d.applies_to @> CAST(:scopeJson AS jsonb))`
const inPeriod = date => `${date} >= CAST(:start AS timestamptz) AND ${date} < CAST(:end AS timestamptz)`

export function analyticsWindow(days, now = new Date()) {
  if (![7, 30, 90].includes(days)) throw new RangeError("Choose 7, 30 or 90 UTC calendar days.")
  const through = now.toISOString().slice(0, 10)
  const end = new Date(`${through}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - days)
  return { start: start.toISOString(), end: end.toISOString(), from: start.toISOString().slice(0, 10), through, days }
}

// A page open counts once per decision and viewer in each fixed 30-minute UTC bucket.
export function viewBucket(now = new Date()) {
  const bucket = new Date(now)
  bucket.setUTCSeconds(0, 0)
  bucket.setUTCMinutes(bucket.getUTCMinutes() < 30 ? 0 : 30)
  return bucket.toISOString()
}

// One-way and workspace-bound: it deduplicates opens but never identifies or counts people.
export function viewerKey(workspaceId, userId, session) {
  return createHash("sha256").update(`${workspaceId}:${userId}:${session}`).digest("hex")
}

export const usageRetentionDays = 90
const gapOutcomes = "s.outcome IN ('NO_RESULTS','UNHELPFUL')"

export function createAnalyticsRecords({ sequelize, resolveContext }) {
  const select = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT })
  async function context(identity, { scope, days = 30, asOf }, now) {
    const { workspace } = await resolveContext(identity)
    const window = analyticsWindow(days, now)
    return { window, replacements: { workspaceId: workspace.id, scope: scope ?? null,
      scopeJson: JSON.stringify(scope ? [scope] : []), asOf, start: window.start, end: window.end } }
  }
  async function dashboardRecords(identity, input, now) {
    const { window, replacements } = await context(identity, input, now)
    const [pending, contributors, trendRows, coverage] = await Promise.all([
      select(`SELECT ${ownerKey} AS key,
        CASE WHEN o.id IS NOT NULL THEN o.display_name WHEN d.owner_id IS NOT NULL THEN 'Linked owner unavailable'
          ELSE COALESCE(d.owner_name,'Unassigned') END AS label,
        CASE WHEN o.id IS NOT NULL THEN 'LINKED' WHEN d.owner_id IS NOT NULL THEN 'UNAVAILABLE'
          WHEN d.owner_name IS NOT NULL THEN 'NAME' ELSE 'UNASSIGNED' END AS kind,
        COUNT(*) FILTER (WHERE d.due_date < CAST(:asOf AS date))::int AS overdue,
        COUNT(*) FILTER (WHERE d.due_date IS NULL OR d.due_date >= CAST(:asOf AS date))::int AS pending
        FROM decisions d ${joins} WHERE ${scoped} AND d.decision_state='PENDING'
        GROUP BY 1,2,3 ORDER BY overdue DESC,pending DESC,label,key`, replacements),
      select(`SELECT ${contributorKey} AS key, COALESCE(c.display_name,'Attribution unavailable') AS label,
        COUNT(*) FILTER (WHERE d.decision_state='DECIDED')::int AS decided,
        COUNT(*) FILTER (WHERE d.decision_state='PENDING')::int AS pending
        FROM decisions d ${joins} WHERE ${scoped} AND ${inPeriod("d.created_at")}
        GROUP BY 1,2 ORDER BY decided DESC,pending DESC,label,key`, replacements),
      select(Object.entries(series).map(([key, definition]) => `SELECT '${key}' AS series,
        to_char(${definition.date} AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, COUNT(*)::int AS count
        FROM decisions d WHERE ${scoped} AND ${definition.predicate} AND ${inPeriod(definition.date)} GROUP BY 2`).join(" UNION ALL "), replacements),
      select(`SELECT COUNT(*) FILTER (WHERE d.decision_state='DECIDED' AND d.decided_at IS NULL)::int AS "missingRecordingDates",
        COUNT(*) FILTER (WHERE d.decision_state='DECIDED' AND d.initial_decision_state IS NULL)::int AS "unknownInitialState"
        FROM decisions d WHERE ${scoped}`, replacements),
    ])
    const trend = Array.from({ length: window.days }, (_, index) => {
      const date = new Date(window.start)
      date.setUTCDate(date.getUTCDate() + index)
      const day = date.toISOString().slice(0, 10)
      return { day, QUESTIONS: 0, RESOLVED: 0, CAPTURED: 0, UNKNOWN: 0 }
    })
    const byDay = new Map(trend.map(row => [row.day, row]))
    for (const row of trendRows) byDay.get(row.day)[row.series] = row.count
    return { window, asOf: input.asOf, pending, contributors, trend, coverage: coverage[0] }
  }
  async function dashboardRecordDetail(identity, input, now) {
    const { replacements } = await context(identity, input, now)
    let predicate
    if (input.chart === "PENDING") {
      predicate = `d.decision_state='PENDING' AND ${ownerKey}=:key AND ` + (input.segment === "OVERDUE"
        ? "d.due_date < CAST(:asOf AS date)" : "(d.due_date IS NULL OR d.due_date >= CAST(:asOf AS date))")
    } else if (input.chart === "CONTRIBUTOR") {
      predicate = `${contributorKey}=:key AND d.decision_state=:segment AND ${inPeriod("d.created_at")}`
    } else {
      const definition = series[input.segment]
      if (!definition) throw new RangeError("Unknown trend series.")
      predicate = `${definition.predicate} AND ${inPeriod(definition.date)}
        AND to_char(${definition.date} AT TIME ZONE 'UTC','YYYY-MM-DD') BETWEEN :dayFrom AND :dayThrough`
    }
    // A trend drill-down covers one day or an inclusive run of days (a week bar).
    const params = { ...replacements, key: input.key ?? "", segment: input.segment, offset: input.offset ?? 0,
      dayFrom: input.from ?? input.day ?? "", dayThrough: input.through ?? input.day ?? "" }
    const where = `${scoped} AND ${predicate}`
    const [count, records] = await Promise.all([
      select(`SELECT COUNT(*)::int AS total FROM decisions d ${joins} WHERE ${where}`, params),
      select(`SELECT d.id,d.decision_key AS "decisionKey",d.title,d.outcome,d.status,d.decision_state AS "decisionState",
        d.due_date AS "dueDate",d.applies_to AS "appliesTo",d.created_at AS "createdAt",d.decided_at AS "decidedAt",
        CASE WHEN o.id IS NOT NULL THEN o.display_name WHEN d.owner_id IS NOT NULL THEN 'Linked owner unavailable'
          ELSE COALESCE(d.owner_name,'Unassigned') END AS "ownerLabel"
        FROM decisions d ${joins} WHERE ${where} ORDER BY d.created_at DESC,d.id LIMIT 50 OFFSET :offset`, params),
    ])
    return { records, total: count[0].total, offset: params.offset }
  }
  async function trackingEnabled(workspaceId) {
    const [row] = await select(`SELECT usage_tracking_enabled AS enabled FROM workspaces WHERE id=:workspaceId`, { workspaceId })
    return Boolean(row?.enabled)
  }
  async function purge(workspaceId, now = new Date()) {
    const replacements = { workspaceId, now: now.toISOString() }
    await sequelize.query(`DELETE FROM decision_view_events WHERE workspace_id=:workspaceId
      AND bucket_start < CAST(:now AS timestamptz) - interval '${usageRetentionDays} days'`, { replacements })
    await sequelize.query(`DELETE FROM search_events WHERE workspace_id=:workspaceId
      AND created_at < CAST(:now AS timestamptz) - interval '${usageRetentionDays} days'`, { replacements })
  }
  async function usageTracking(identity) {
    const { workspace } = await resolveContext(identity)
    return { enabled: await trackingEnabled(workspace.id), retentionDays: usageRetentionDays }
  }
  async function setUsageTracking(identity, enabled) {
    const { workspace } = await resolveContext(identity)
    await sequelize.query(`UPDATE workspaces SET usage_tracking_enabled=:enabled WHERE id=:workspaceId`,
      { replacements: { enabled, workspaceId: workspace.id } })
    return { enabled, retentionDays: usageRetentionDays }
  }
  async function recordView(identity, { decisionId, session }, now = new Date()) {
    const { workspace, user } = await resolveContext(identity)
    if (!(await trackingEnabled(workspace.id))) return { recorded: false }
    const rows = await select(`INSERT INTO decision_view_events (workspace_id, decision_id, viewer_key, bucket_start)
      SELECT :workspaceId, d.id, :viewerKey, :bucket FROM decisions d WHERE d.id=:decisionId AND d.workspace_id=:workspaceId
      ON CONFLICT DO NOTHING RETURNING id`, { workspaceId: workspace.id, decisionId,
      viewerKey: viewerKey(workspace.id, user.id, session), bucket: viewBucket(now) })
    return { recorded: rows.length > 0 }
  }
  async function recordSearch(identity, { query, scope, method, outcome, resultCount }, now = new Date()) {
    const { workspace } = await resolveContext(identity)
    if (!(await trackingEnabled(workspace.id))) return { recorded: false }
    await sequelize.query(`INSERT INTO search_events (workspace_id, query, scope, method, outcome, result_count, created_at)
      VALUES (:workspaceId, :query, :scope, :method, :outcome, :resultCount, :createdAt)`, { replacements: {
      workspaceId: workspace.id, query, scope: scope ?? null, method, outcome, resultCount, createdAt: now.toISOString() } })
    return { recorded: true }
  }
  async function deleteSearches(identity, ids) {
    const { workspace } = await resolveContext(identity)
    if (!ids.length) return { deleted: 0 }
    const rows = await select(`DELETE FROM search_events WHERE workspace_id=:workspaceId AND id IN (:ids) RETURNING id`,
      { workspaceId: workspace.id, ids })
    return { deleted: rows.length }
  }
  // Consultation and search-gap facts for the same scope and period as the record charts.
  async function dashboardUsage(identity, input, now) {
    const { replacements } = await context(identity, input, now)
    await purge(replacements.workspaceId, now)
    const viewed = `FROM decision_view_events v JOIN decisions d ON d.id=v.decision_id AND d.workspace_id=v.workspace_id
      WHERE v.workspace_id=:workspaceId AND ${scoped} AND ${inPeriod("v.bucket_start")}`
    const searched = `FROM search_events s WHERE s.workspace_id=:workspaceId
      AND (:scope IS NULL OR s.scope=:scope) AND ${inPeriod("s.created_at")}`
    const [enabled, consulted, gaps, totals] = await Promise.all([
      trackingEnabled(replacements.workspaceId),
      select(`SELECT d.id, d.decision_key AS "decisionKey", d.title, d.outcome, d.status,
        d.decision_state AS "decisionState", COUNT(*)::int AS views ${viewed}
        GROUP BY d.id ORDER BY views DESC, d.decision_key LIMIT 5`, replacements),
      select(`SELECT lower(btrim(s.query)) AS key, (array_agg(s.query ORDER BY s.created_at DESC))[1] AS query,
        s.scope, COUNT(*)::int AS searches, COUNT(*) FILTER (WHERE s.outcome='UNHELPFUL')::int AS unhelpful,
        MAX(s.created_at) AS "lastSearchedAt", array_agg(s.id) AS ids
        ${searched} AND ${gapOutcomes} GROUP BY 1, s.scope ORDER BY searches DESC, "lastSearchedAt" DESC LIMIT 6`, replacements),
      select(`SELECT (SELECT COUNT(*)::int ${viewed}) AS views, (SELECT COUNT(*)::int ${searched}) AS searches,
        (SELECT COUNT(*)::int ${searched} AND ${gapOutcomes}) AS gaps`, replacements),
    ])
    return { tracking: { enabled, retentionDays: usageRetentionDays }, consulted, gaps, totals: totals[0] }
  }
  return { dashboardRecords, dashboardRecordDetail, dashboardUsage, usageTracking, setUsageTracking, recordView, recordSearch, deleteSearches }
}
