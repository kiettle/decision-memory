import { QueryTypes } from "sequelize"
import { DomainError } from "./domain.js"

export const changeSnapshot = (decision) => ({
  id: decision.id, decisionKey: decision.decisionKey, title: decision.title,
  choice: decision.decisionState === "PENDING" ? null : decision.outcome ?? decision.title,
  why: decision.why ?? null, appliesTo: decision.appliesTo ?? [],
})

export function createProjectMemory({ sequelize, Decision, User, resolveContext, getDecision }) {
  const select = (sql, replacements, transaction) => sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT })
  function personal(identity) {
    if (!identity.userExternalId || identity.userExternalId === "forge-user") {
      throw new DomainError("Personal follows need a stable signed-in identity. Open the app with your account (docs/product/everyday-project-memory.md).", 403, "PERSONAL_IDENTITY_REQUIRED")
    }
  }
  async function recordChange(workspaceId, previous, current, transaction, replacementReason) {
    const before = previous ? changeSnapshot(previous) : null
    const after = changeSnapshot(current)
    const replacement = replacementReason !== undefined
    if (!replacement && current.decisionState === "PENDING") return
    const same = before && before.choice === after.choice && before.why === after.why &&
      JSON.stringify([...new Set(before.appliesTo)].sort()) === JSON.stringify([...new Set(after.appliesTo)].sort())
    if (!replacement && same) return
    const kind = replacement ? "REPLACED" : !before ? "RECORDED" : previous.decisionState === "PENDING" ? "ANSWERED" : "UPDATED"
    await sequelize.query(`INSERT INTO memory_changes(workspace_id, decision_id, replacement_id, kind, previous, current_value, reason, scopes)
      VALUES (:workspaceId, :decisionId, :replacementId, :kind, CAST(:previous AS jsonb), CAST(:current AS jsonb), :reason, CAST(:scopes AS jsonb))`, {
      transaction, replacements: { workspaceId, decisionId: previous?.id ?? current.id,
        replacementId: replacement ? current.id : null, kind, previous: before ? JSON.stringify(before) : null,
        current: JSON.stringify(after), reason: replacement ? replacementReason || null : after.why,
        scopes: JSON.stringify([...new Set([...(before?.appliesTo ?? []), ...after.appliesTo])]) },
    })
  }
  async function follows(identity) {
    personal(identity)
    const { workspace, user } = await resolveContext(identity)
    return select(`SELECT f.kind, f.target, f.created_at AS "createdAt",
      CASE WHEN f.kind='SCOPE' THEN f.target ELSE COALESCE(d.decision_key || ' · ' || COALESCE(d.outcome,d.title), 'Decision no longer available') END AS label
      FROM memory_follows f LEFT JOIN decisions d ON f.kind='DECISION' AND f.target=d.id::text AND d.workspace_id=f.workspace_id
      WHERE f.workspace_id = :workspaceId AND f.user_id = :userId`, { workspaceId: workspace.id, userId: user.id })
  }
  async function setFollow(identity, { kind, target, following }) {
    personal(identity)
    if (kind === "DECISION") target = target.toLowerCase()
    return sequelize.transaction(async transaction => {
      const { workspace, user } = await resolveContext(identity, transaction)
      // Serialize subscription changes per person; identity is never supplied by clients.
      await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE })
      const found = kind === "DECISION"
        ? await Decision.findOne({ where: { workspaceId: workspace.id, id: target }, transaction })
        : (await select(`SELECT id FROM decisions WHERE workspace_id = :workspaceId AND applies_to @> CAST(:scope AS jsonb) LIMIT 1`, { workspaceId: workspace.id, scope: JSON.stringify([target]) }, transaction))[0]
      if (!found && following) throw new DomainError("Follow target not found in this workspace. Open an accessible decision or scope.", 404, "FOLLOW_TARGET_NOT_FOUND")
      const replacements = { workspaceId: workspace.id, userId: user.id, kind, target }
      await sequelize.query(following
        ? `INSERT INTO memory_follows(workspace_id,user_id,kind,target) VALUES (:workspaceId,:userId,:kind,:target) ON CONFLICT DO NOTHING`
        : `DELETE FROM memory_follows WHERE workspace_id=:workspaceId AND user_id=:userId AND kind=:kind AND target=:target`, { replacements, transaction })
      return { kind, target, following }
    })
  }
  async function notifications(identity) {
    personal(identity)
    const { workspace, user } = await resolveContext(identity)
    const [clock] = await select('SELECT clock_timestamp() AS "asOf"', {})
    const items = await select(`SELECT c.id, c.kind, c.previous, c.current_value AS current, c.reason, c.scopes, c.created_at AS "createdAt",
      EXISTS (SELECT 1 FROM memory_change_reads r WHERE r.workspace_id=c.workspace_id AND r.user_id=:userId AND r.change_id=c.id) AS read
      FROM memory_changes c
      JOIN decisions d ON d.id=c.decision_id AND d.workspace_id=c.workspace_id
      WHERE c.workspace_id=:workspaceId AND c.created_at <= :asOf AND EXISTS (
        SELECT 1 FROM memory_follows f WHERE f.workspace_id=c.workspace_id AND f.user_id=:userId AND f.created_at <= c.created_at
        AND ((f.kind='DECISION' AND (f.target=c.decision_id::text OR f.target=c.replacement_id::text))
          OR (f.kind='SCOPE' AND c.scopes @> jsonb_build_array(f.target))))
      ORDER BY c.created_at DESC, c.id DESC LIMIT 100`, { workspaceId: workspace.id, userId: user.id, asOf: clock.asOf })
    return { items, asOf: clock.asOf }
  }
  async function readNotifications(identity, ids) {
    personal(identity)
    const { workspace, user } = await resolveContext(identity)
    if (ids.length) await sequelize.query(`INSERT INTO memory_change_reads(workspace_id,user_id,change_id)
      SELECT c.workspace_id,:userId,c.id FROM memory_changes c
      WHERE c.workspace_id=:workspaceId AND c.id IN (:ids) AND EXISTS (
        SELECT 1 FROM memory_follows f WHERE f.workspace_id=c.workspace_id AND f.user_id=:userId AND f.created_at <= c.created_at
        AND ((f.kind='DECISION' AND (f.target=c.decision_id::text OR f.target=c.replacement_id::text)) OR (f.kind='SCOPE' AND c.scopes @> jsonb_build_array(f.target))))
      ON CONFLICT DO NOTHING`, { replacements: { ids, workspaceId: workspace.id, userId: user.id } })
    return { read: true }
  }
  async function setImportant(identity, id, important) {
    return sequelize.transaction(async transaction => {
      const { workspace, user } = await resolveContext(identity, transaction)
      const decision = await Decision.findOne({ where: { id, workspaceId: workspace.id }, transaction, lock: transaction.LOCK.UPDATE })
      if (!decision) throw new DomainError("Decision not found.", 404, "DECISION_NOT_FOUND")
      if (decision.ownerId !== user.id) throw new DomainError("Only the linked decision owner may select important choices (docs/product/everyday-project-memory.md). Ask the recorded owner to curate this brief.", 403, "BRIEF_OWNER_REQUIRED")
      if (decision.status !== "ACTIVE" || decision.decisionState !== "DECIDED") throw new DomainError("Select a current recorded choice for the brief.", 409, "CURRENT_CHOICE_REQUIRED")
      await decision.update({ handoverImportant: important }, { transaction })
      return getDecision(identity, id, transaction)
    })
  }
  return { recordChange, follows, setFollow, notifications, readNotifications, setImportant }
}
