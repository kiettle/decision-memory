import { replacementReasonInput } from "./validation.js"
import { Op, QueryTypes } from "sequelize"

import { DomainError, requireDecisionTitle, validateSupersession } from "./domain.js"
import { vectorLiteral } from "./local-embeddings.js"

const blankToNull = (value) => {
  if (typeof value !== "string") return value ?? null
  const trimmed = value.trim()
  return trimmed || null
}

const listFrom = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : []

// A Jira issue URL such as .../browse/MIG-182 is labelled by its issue key.
export const jiraIssueKey = (url) => /\/browse\/([A-Z][A-Z0-9_]*-\d+)/i.exec(url)?.[1]?.toUpperCase() ?? null

function referencesFrom(input) {
  return (input.references ?? []).map((reference) => ({
    kind: reference.kind,
    label:
      blankToNull(reference.label) ??
      jiraIssueKey(reference.url) ??
      (reference.kind === "JIRA" ? "Related Jira work" : "Related work"),
    url: reference.url,
  }))
}

// Each word must appear somewhere in the Decision or its captured discussion.
const searchTerms = (query) =>
  (typeof query === "string" ? query : "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)
    .map((term) => `%${term.replace(/[\\%_]/g, "\\$&")}%`)

function serializeDecision(decision) {
  const plain = decision.get({ plain: true })
  return {
    ...plain,
    tags: (plain.tags ?? []).map((tag) => tag.name),
    evidenceCount: (plain.sources ?? []).length,
  }
}

export function createRepository(models) {
  const {
    sequelize,
    Workspace,
    User,
    Decision,
    Tag,
    SourceSnapshot,
    ExternalReference,
    JiraIssueRequest,
    DecisionRelation,
    SlackInteraction,
    SlackCaptureDraft,
    SlackNudge,
  } = models

  const decisionIncludes = [
    { model: User, as: "owner", attributes: ["id", "externalId", "displayName", "avatarUrl"] },
    { model: Tag, as: "tags", attributes: ["id", "name"], through: { attributes: [] } },
    { model: SourceSnapshot, as: "sources", attributes: ["id", "provider", "channelName"] },
  ]

  async function resolveContext(identity, transaction) {
    const [workspace] = await Workspace.findOrCreate({
      where: { externalKey: identity.workspaceExternalKey },
      defaults: {
        cloudId: identity.cloudId,
        name: "Decision Memory Workspace",
      },
      transaction,
    })
    const [user] = await User.findOrCreate({
      where: {
        workspaceId: workspace.id,
        externalId: identity.userExternalId,
      },
      defaults: { displayName: identity.userDisplayName },
      transaction,
    })
    return { workspace, user }
  }

  async function idsFor(sql, replacements) {
    const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT })
    return rows.map((row) => row.id)
  }

  async function decisionWhere(workspaceId, filters = {}) {
    const where = { workspaceId }
    if (filters.status && filters.status !== "ALL") where.status = filters.status
    if (filters.ownerId && filters.ownerId !== "ALL") {
      if (filters.ownerId.startsWith("name:")) {
        where.ownerId = null
        where.ownerName = filters.ownerId.slice(5)
      } else {
        where.ownerId = filters.ownerId
      }
    }
    if (filters.appliesTo && filters.appliesTo !== "ALL") {
      where.appliesTo = { [Op.contains]: [filters.appliesTo] }
    }
    if (filters.dateRange && filters.dateRange !== "ALL") {
      const days = Number(filters.dateRange)
      if (Number.isFinite(days) && days > 0) {
        where.createdAt = { [Op.gte]: new Date(Date.now() - days * 86_400_000) }
      }
    }

    const idSets = []
    if (filters.channel && filters.channel !== "ALL") {
      idSets.push(
        await idsFor(
          `SELECT s.decision_id AS id
           FROM source_snapshots s
           WHERE s.workspace_id = :workspaceId AND s.channel_name = :channel`,
          { workspaceId, channel: filters.channel },
        ),
      )
    }
    if (filters.tag && filters.tag !== "ALL") {
      idSets.push(
        await idsFor(
          `SELECT dt.decision_id AS id
           FROM decision_tags dt
           JOIN tags t ON t.id = dt.tag_id
           WHERE t.workspace_id = :workspaceId AND t.name = :tag`,
          { workspaceId, tag: filters.tag },
        ),
      )
    }
    const terms = searchTerms(filters.q)
    if (terms.length) {
      idSets.push(
        await idsFor(
          `SELECT d.id
           FROM decisions d
           LEFT JOIN users owner
             ON owner.workspace_id = d.workspace_id AND owner.id = d.owner_id
           WHERE d.workspace_id = :workspaceId
             AND concat_ws(' ',
               d.title, d.why, d.context, d.owner_name, owner.display_name,
               d.applies_to::text, d.options_considered::text,
               (SELECT string_agg(t.name, ' ')
                FROM decision_tags dt JOIN tags t ON t.id = dt.tag_id
                WHERE dt.decision_id = d.id),
               (SELECT string_agg(concat_ws(' ', s.channel_name, s.anchor_text, m->>'author', m->>'text'), ' ')
                FROM source_snapshots s
                LEFT JOIN LATERAL jsonb_array_elements(s.messages) m ON true
                WHERE s.workspace_id = d.workspace_id AND s.decision_id = d.id)
             ) ILIKE ALL (ARRAY[:terms])`,
          { workspaceId, terms },
        ),
      )
    }
    if (idSets.length) {
      where.id = {
        [Op.in]: idSets.reduce((left, right) => left.filter((id) => right.includes(id))),
      }
    }
    return where
  }

  async function supersededByLookup(workspaceId) {
    const rows = await sequelize.query(
      `SELECT r.to_decision_id AS "targetId", d.id, d.decision_key AS "decisionKey"
       FROM decision_relations r
       JOIN decisions d ON d.id = r.from_decision_id
       WHERE r.workspace_id = :workspaceId AND r.relation_type = 'SUPERSEDES'`,
      { replacements: { workspaceId }, type: QueryTypes.SELECT },
    )
    const lookup = new Map()
    for (const { targetId, ...decision } of rows) {
      lookup.set(targetId, [...(lookup.get(targetId) ?? []), decision])
    }
    return lookup
  }

  async function listDecisions(identity, filters = {}) {
    const { workspace } = await resolveContext(identity)
    const [decisions, supersededBy] = await Promise.all([
      Decision.findAll({
        where: await decisionWhere(workspace.id, filters),
        include: decisionIncludes,
        order: [["createdAt", "DESC"]],
      }),
      supersededByLookup(workspace.id),
    ])
    return decisions.map((decision) => ({
      ...serializeDecision(decision),
      supersededBy: supersededBy.get(decision.id) ?? [],
    }))
  }

  async function memorySearchCandidates(identity, filters = {}) {
    const { workspace } = await resolveContext(identity)
    const decisions = await Decision.findAll({
      where: await decisionWhere(workspace.id, filters),
      include: [
        { model: User, as: "owner", attributes: ["id", "externalId", "displayName", "avatarUrl"] },
        { model: Tag, as: "tags", attributes: ["id", "name"], through: { attributes: [] } },
        { model: SourceSnapshot, as: "sources", separate: true },
      ],
      order: [["createdAt", "DESC"]],
    })
    return decisions.map(serializeDecision)
  }

  async function memorySearchCandidateCount(identity, filters = {}) {
    const { workspace } = await resolveContext(identity)
    return Decision.count({ where: await decisionWhere(workspace.id, filters) })
  }

  async function queueUnindexedDecisions(model) {
    await sequelize.query(
      `INSERT INTO decision_search_jobs (decision_id, workspace_id)
       SELECT d.id, d.workspace_id FROM decisions d
       WHERE NOT EXISTS (SELECT 1 FROM decision_embeddings e WHERE e.decision_id = d.id AND e.model = :model)
       ON CONFLICT (decision_id) DO NOTHING`,
      { replacements: { model } },
    )
  }

  async function pendingSearchJobs(limit = 5) {
    const jobs = await sequelize.query(
      `SELECT decision_id AS "decisionId", workspace_id AS "workspaceId", revision
       FROM decision_search_jobs ORDER BY queued_at, decision_id LIMIT :limit`,
      { replacements: { limit }, type: QueryTypes.SELECT },
    )
    if (!jobs.length) return []
    const decisions = await Decision.findAll({
      where: { id: { [Op.in]: jobs.map((job) => job.decisionId) } },
      include: [
        { model: User, as: "owner", attributes: ["displayName"] },
        { model: Tag, as: "tags", attributes: ["name"], through: { attributes: [] } },
        { model: SourceSnapshot, as: "sources", separate: true },
      ],
    })
    const byId = new Map(decisions.map((decision) => [decision.id, serializeDecision(decision)]))
    return jobs.filter((job) => byId.has(job.decisionId))
      .map((job) => ({ ...job, decision: byId.get(job.decisionId) }))
  }

  async function completeSearchJob(job, vectors, model) {
    const literals = vectors.map(vectorLiteral)
    if (!literals.length) throw new Error("Cannot publish an empty search index.")
    return sequelize.transaction(async (transaction) => {
      const [current] = await sequelize.query(
        `SELECT revision FROM decision_search_jobs
         WHERE decision_id = :decisionId AND workspace_id = :workspaceId FOR UPDATE`,
        { replacements: job, type: QueryTypes.SELECT, transaction },
      )
      // An edit during inference replaces the revision. Never publish stale work.
      if (!current || current.revision !== job.revision) return false
      await sequelize.query(`DELETE FROM decision_embeddings WHERE decision_id = :decisionId AND workspace_id = :workspaceId`,
        { replacements: job, transaction })
      const replacements = { decisionId: job.decisionId, workspaceId: job.workspaceId, revision: job.revision, model }
      const values = literals.map((literal, index) => {
        replacements[`vector${index}`] = literal
        return `(:decisionId, :workspaceId, ${index}, :model, :revision, CAST(:vector${index} AS vector))`
      })
      await sequelize.query(
        `INSERT INTO decision_embeddings (decision_id, workspace_id, chunk_index, model, revision, embedding)
         VALUES ${values.join(",")}`, { replacements, transaction },
      )
      await sequelize.query(`DELETE FROM decision_search_jobs WHERE decision_id = :decisionId AND revision = :revision`,
        { replacements: job, transaction })
      return true
    })
  }

  // SQL filters avoid materializing every matching ID into application memory.
  function vectorFilters(workspaceId, filters) {
    const replacements = { workspaceId }
    const clauses = ["d.workspace_id = :workspaceId"]
    for (const [key, column] of [["status", "status"], ["ownerId", "owner_id"]]) {
      const value = filters[key]
      if (!value || value === "ALL") continue
      if (key === "ownerId" && value.startsWith("name:")) {
        clauses.push("d.owner_id IS NULL AND d.owner_name = :ownerName")
        replacements.ownerName = value.slice(5)
      } else {
        clauses.push(`d.${column} = :${key}`)
        replacements[key] = value
      }
    }
    if (filters.appliesTo && filters.appliesTo !== "ALL") {
      clauses.push("d.applies_to @> CAST(:appliesTo AS jsonb)")
      replacements.appliesTo = JSON.stringify([filters.appliesTo])
    }
    const days = Number(filters.dateRange)
    if (Number.isFinite(days) && days > 0) {
      clauses.push("d.created_at >= :createdAfter")
      replacements.createdAfter = new Date(Date.now() - days * 86_400_000)
    }
    if (filters.channel && filters.channel !== "ALL") {
      clauses.push(`EXISTS (SELECT 1 FROM source_snapshots s
        WHERE s.decision_id = d.id AND s.workspace_id = d.workspace_id AND s.channel_name = :channel)`)
      replacements.channel = filters.channel
    }
    if (filters.tag && filters.tag !== "ALL") {
      clauses.push(`EXISTS (SELECT 1 FROM decision_tags dt JOIN tags t ON t.id = dt.tag_id
        WHERE dt.decision_id = d.id AND t.workspace_id = d.workspace_id AND t.name = :tag)`)
      replacements.tag = filters.tag
    }
    return { where: clauses.join(" AND "), replacements }
  }

  async function vectorSearch(identity, { vector, model, filters = {} }) {
    const { workspace } = await resolveContext(identity)
    const { where, replacements } = vectorFilters(workspace.id, filters)
    Object.assign(replacements, { vector: vectorLiteral(vector), model })
    return sequelize.transaction({ isolationLevel: "REPEATABLE READ" }, async (transaction) => {
      // Filtered HNSW scans need to keep scanning past other tenants/chunks.
      await sequelize.query("SET LOCAL hnsw.iterative_scan = 'strict_order'", { transaction })
      await sequelize.query("SET LOCAL hnsw.ef_search = 100", { transaction })
      const indexed = `NOT EXISTS (SELECT 1 FROM decision_search_jobs j WHERE j.decision_id = d.id)
        AND EXISTS (SELECT 1 FROM decision_embeddings e WHERE e.decision_id = d.id AND e.workspace_id = d.workspace_id AND e.model = :model)`
      const [counts] = await sequelize.query(
        `SELECT count(*)::int AS "totalCandidateCount", count(*) FILTER (WHERE ${indexed})::int AS "candidateCount"
         FROM decisions d WHERE ${where}`, { replacements, type: QueryTypes.SELECT, transaction },
      )
      const nearest = []
      // Select one decision's best passage, then exclude that entire decision
      // before the next indexed scan. A large thread cannot fill a chunk window
      // and hide all other choices. Keep every scan inside the same snapshot.
      for (let index = 0; index < Math.min(5, counts.candidateCount); index++) {
        const exclude = nearest.length ? "AND e.decision_id NOT IN (:selectedIds)" : ""
        const [row] = await sequelize.query(
          `SELECT e.decision_id AS id, 1 - (e.embedding <=> CAST(:vector AS vector)) AS similarity
           FROM decision_embeddings e JOIN decisions d ON d.id = e.decision_id AND d.workspace_id = e.workspace_id
           WHERE ${where} AND e.model = :model
             AND NOT EXISTS (SELECT 1 FROM decision_search_jobs j WHERE j.decision_id = d.id)
             ${exclude}
           ORDER BY e.embedding <=> CAST(:vector AS vector) LIMIT 1`,
          { replacements: { ...replacements, selectedIds: nearest.map((row) => row.id) }, type: QueryTypes.SELECT, transaction },
        )
        if (!row) break
        nearest.push(row)
      }
      // Approximate scans can discover a closer passage on a later iteration.
      // Display the retrieved decisions in their actual similarity order.
      nearest.sort((left, right) => Number(right.similarity) - Number(left.similarity) || left.id.localeCompare(right.id))
      const decisions = nearest.length ? await Decision.findAll({
        where: { workspaceId: workspace.id, id: { [Op.in]: nearest.map((row) => row.id) } },
        include: decisionIncludes, transaction,
      }) : []
      const byId = new Map(decisions.map((decision) => [decision.id, serializeDecision(decision)]))
      return {
        ...counts,
        truncated: counts.candidateCount < counts.totalCandidateCount,
        matches: nearest.filter((row) => byId.has(row.id))
          .map((row) => ({ similarity: Number(row.similarity), decision: byId.get(row.id) })),
      }
    })
  }

  async function createSlackCaptureDraft(identity, input) {
    const { workspace } = await resolveContext(identity)
    const now = input.now ? new Date(input.now) : new Date()
    await SlackCaptureDraft.destroy({
      where: { workspaceId: workspace.id, expiresAt: { [Op.lte]: now } },
    })
    const [draft] = await SlackCaptureDraft.findOrCreate({
      where: {
        workspaceId: workspace.id,
        externalEventId: input.externalEventId,
      },
      defaults: {
        slackTeamId: input.slackTeamId,
        slackUserId: input.slackUserId,
        source: input.source,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    })
    return draft.get({ plain: true })
  }

  async function getSlackCaptureDraft(identity, draftId, now = new Date()) {
    const { workspace } = await resolveContext(identity)
    const draft = await SlackCaptureDraft.findOne({
      where: {
        id: draftId,
        workspaceId: workspace.id,
        expiresAt: { [Op.gt]: now },
      },
    })
    return draft?.get({ plain: true }) ?? null
  }

  async function setSlackCaptureDraftAi(identity, draftId, aiDraft) {
    const { workspace } = await resolveContext(identity)
    await sequelize.query(
      `UPDATE slack_capture_drafts SET source = jsonb_set(source, '{aiDraft}', CAST(:aiDraft AS jsonb))
       WHERE id = :draftId AND workspace_id = :workspaceId AND expires_at > now()`,
      { replacements: { draftId, workspaceId: workspace.id, aiDraft: JSON.stringify(aiDraft) } },
    )
  }

  // IDs of Decisions already saved from this Slack thread.
  async function decisionIdsForThread(identity, channelId, threadTs) {
    const { workspace } = await resolveContext(identity)
    const sources = await SourceSnapshot.findAll({
      where: { workspaceId: workspace.id, externalChannelId: channelId, externalThreadId: threadTs },
      attributes: ["decisionId"],
    })
    return [...new Set(sources.map((source) => source.decisionId))]
  }

  // Claims the one nudge of this kind for a thread. Returns false when it was
  // already sent, including for duplicate Slack deliveries.
  async function claimSlackNudge(identity, { channelId, threadTs, kind, decisionId = null }) {
    const { workspace } = await resolveContext(identity)
    const [, created] = await SlackNudge.findOrCreate({
      where: { workspaceId: workspace.id, channelId, threadTs, kind },
      defaults: { decisionId },
    })
    return created
  }

  async function getDecision(identity, decisionId, transaction) {
    const { workspace } = await resolveContext(identity, transaction)
    const decision = await Decision.findOne({
      where: { id: decisionId, workspaceId: workspace.id },
      include: decisionIncludes,
      transaction,
    })
    if (!decision) return null

    const sources = await SourceSnapshot.findAll({
      where: { workspaceId: workspace.id, decisionId },
      transaction,
    })
    const references = await ExternalReference.findAll({
      where: { workspaceId: workspace.id, decisionId },
      transaction,
    })
    const outgoing = await DecisionRelation.findAll({
      where: { workspaceId: workspace.id, fromDecisionId: decisionId },
      transaction,
    })
    const incoming = await DecisionRelation.findAll({
      where: { workspaceId: workspace.id, toDecisionId: decisionId },
      transaction,
    })
    const relatedIds = [
      ...outgoing.map((relation) => relation.toDecisionId),
      ...incoming.map((relation) => relation.fromDecisionId),
    ]
    const related = relatedIds.length
      ? await Decision.findAll({
          where: { id: { [Op.in]: relatedIds }, workspaceId: workspace.id },
          attributes: ["id", "decisionKey", "title", "status"],
          transaction,
        })
      : []
    const relatedById = new Map(related.map((item) => [item.id, item.get({ plain: true })]))

    const current = decision.status === "SUPERSEDED"
      ? await sequelize.query(
        `WITH RECURSIVE successors AS (
           SELECT id, decision_key, title, status FROM decisions
           WHERE workspace_id = :workspaceId AND id = :decisionId
           UNION
           SELECT d.id, d.decision_key, d.title, d.status
           FROM successors s
           JOIN decision_relations r ON r.to_decision_id = s.id
             AND r.workspace_id = :workspaceId AND r.relation_type = 'SUPERSEDES'
           JOIN decisions d ON d.id = r.from_decision_id AND d.workspace_id = :workspaceId
         ) SELECT id, decision_key AS "decisionKey", title, status
           FROM successors WHERE status = 'ACTIVE' AND id <> :decisionId`,
        { replacements: { workspaceId: workspace.id, decisionId }, type: QueryTypes.SELECT, transaction },
      ) : []

    return {
      ...serializeDecision(decision),
      sources: sources.map((source) => source.get({ plain: true })),
      references: references.map((reference) => reference.get({ plain: true })),
      lifecycle: {
        current,
        supersedes: outgoing
          .map((relation) => ({ ...relatedById.get(relation.toDecisionId), replacementReason: relation.replacementReason, replacedAt: relation.createdAt }))
          .filter((item) => item.id),
        supersededBy: incoming
          .map((relation) => ({ ...relatedById.get(relation.fromDecisionId), replacementReason: relation.replacementReason, replacedAt: relation.createdAt }))
          .filter((item) => item.id),
      },
    }
  }

  async function nextDecisionKey(workspaceId, transaction) {
    const [row] = await sequelize.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(decision_key FROM 4) AS INTEGER)), 100) AS value
       FROM decisions WHERE workspace_id = :workspaceId`,
      { replacements: { workspaceId }, type: QueryTypes.SELECT, transaction },
    )
    return `DM-${Number(row.value) + 1}`
  }

  async function setTags(decision, workspaceId, names, transaction) {
    const tags = []
    for (const name of listFrom(names)) {
      const [tag] = await Tag.findOrCreate({
        where: { workspaceId, name },
        transaction,
      })
      tags.push(tag)
    }
    await decision.setTags(tags, { transaction })
  }

  async function scopedOwnerId(workspaceId, ownerId, transaction) {
    if (!ownerId) return null
    const owner = await User.findOne({
      where: { id: ownerId, workspaceId },
      transaction,
    })
    if (!owner) {
      throw new DomainError(
        "Owner must belong to the current workspace.",
        403,
        "CROSS_WORKSPACE_OWNER",
      )
    }
    return owner.id
  }

  async function setReferences(decision, workspaceId, input, transaction) {
    await ExternalReference.destroy({
      where: { workspaceId, decisionId: decision.id },
      transaction,
    })
    const references = referencesFrom(input)
    if (!references.length) return
    await ExternalReference.bulkCreate(
      references.map((reference) => ({
        workspaceId,
        decisionId: decision.id,
        ...reference,
      })),
      { transaction },
    )
  }

  async function createDecision(identity, input, extras = {}) {
    return sequelize.transaction(async (transaction) => {
      const { workspace, user } = await resolveContext(identity, transaction)
      await Workspace.findByPk(workspace.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (extras.idempotencyKey) {
        const prior = await SlackInteraction.findOne({
          where: {
            workspaceId: workspace.id,
            externalEventId: extras.idempotencyKey,
          },
          transaction,
        })
        if (prior) return getDecision(identity, prior.decisionId, transaction)
      }
      const decision = await Decision.create(
        {
          workspaceId: workspace.id,
          decisionKey: await nextDecisionKey(workspace.id, transaction),
          title: requireDecisionTitle(input.title),
          why: blankToNull(input.why),
          context: blankToNull(input.context),
          appliesTo: listFrom(input.appliesTo),
          optionsConsidered: listFrom(input.optionsConsidered),
          ownerId: await scopedOwnerId(workspace.id, input.ownerId, transaction),
          ownerName: blankToNull(input.ownerName),
          createdById: user.id,
          status: "ACTIVE",
        },
        { transaction },
      )
      await setTags(decision, workspace.id, input.tags, transaction)
      await setReferences(decision, workspace.id, input, transaction)
      if (extras.source) {
        await SourceSnapshot.create(
          {
            workspaceId: workspace.id,
            decisionId: decision.id,
            ...extras.source,
          },
          { transaction },
        )
      }
      if (extras.idempotencyKey) {
        await SlackInteraction.create(
          {
            workspaceId: workspace.id,
            externalEventId: extras.idempotencyKey,
            decisionId: decision.id,
          },
          { transaction },
        )
      }

      return getDecision(identity, decision.id, transaction)
    })
  }

  async function updateDecision(identity, decisionId, input) {
    return sequelize.transaction(async (transaction) => {
      const { workspace } = await resolveContext(identity, transaction)
      const decision = await Decision.findOne({
        where: { id: decisionId, workspaceId: workspace.id },
        transaction,
      })
      if (!decision) return null
      await decision.update(
        {
          title: requireDecisionTitle(input.title),
          why: blankToNull(input.why),
          context: blankToNull(input.context),
          appliesTo: listFrom(input.appliesTo),
          optionsConsidered: listFrom(input.optionsConsidered),
          ownerId: await scopedOwnerId(workspace.id, input.ownerId, transaction),
          ownerName: blankToNull(input.ownerName),
        },
        { transaction },
      )
      await setTags(decision, workspace.id, input.tags, transaction)
      await setReferences(decision, workspace.id, input, transaction)
      return getDecision(identity, decision.id, transaction)
    })
  }

  // Adds one related link without replacing the existing ones.
  async function addReference(identity, decisionId, reference) {
    const { workspace } = await resolveContext(identity)
    const decision = await Decision.findOne({ where: { id: decisionId, workspaceId: workspace.id } })
    if (!decision) return null
    await ExternalReference.create({ workspaceId: workspace.id, decisionId, ...reference })
    return getDecision(identity, decisionId)
  }

  async function claimJiraIssueRequest(identity, decisionId, requestId, input) {
    const { workspace } = await resolveContext(identity)
    const [request, created] = await JiraIssueRequest.findOrCreate({
      where: { workspaceId: workspace.id, requestId },
      defaults: { decisionId, input, status: "PENDING" },
    })
    if (request.decisionId !== decisionId || Object.keys(input).some((key) => input[key] !== request.input[key])) {
      throw new DomainError("This Jira attempt belongs to different inputs. Restore the original attempt.", 409, "JIRA_REQUEST_MISMATCH")
    }
    if (!created && request.status === "REJECTED") {
      const [claimed] = await JiraIssueRequest.update({ status: "PENDING" }, {
        where: { id: request.id, status: "REJECTED" },
      })
      if (claimed) return { ...request.get({ plain: true }), status: "PENDING", claimed: true }
      await request.reload()
    }
    return { ...request.get({ plain: true }), claimed: created }
  }

  async function updateJiraIssueRequest(identity, requestId, update) {
    const { workspace } = await resolveContext(identity)
    await JiraIssueRequest.update(update, { where: { workspaceId: workspace.id, requestId } })
  }

  async function linkJiraIssueRequest(identity, requestId) {
    return sequelize.transaction(async (transaction) => {
      const { workspace } = await resolveContext(identity, transaction)
      const request = await JiraIssueRequest.findOne({
        where: { workspaceId: workspace.id, requestId }, transaction, lock: transaction.LOCK.UPDATE,
      })
      if (!request?.issue) throw new DomainError("The Jira result is not yet confirmed. Check Jira before creating more work.", 409, "JIRA_OUTCOME_UNKNOWN")
      if (request.status !== "LINKED") {
        await ExternalReference.create({ workspaceId: workspace.id, decisionId: request.decisionId,
          kind: "JIRA", label: request.issue.key, url: request.issue.url }, { transaction })
        await request.update({ status: "LINKED" }, { transaction })
      }
      return { issue: request.issue, decision: await getDecision(identity, request.decisionId, transaction) }
    })
  }

  async function supersedeDecision(identity, currentId, targetId, replacementReason) {
    const reason = blankToNull(replacementReasonInput.parse(replacementReason))
    return sequelize.transaction(async (transaction) => {
      const { workspace } = await resolveContext(identity, transaction)
      // Stable lock order avoids deadlocks for competing reverse relations.
      const participants = await Decision.findAll({
        where: { workspaceId: workspace.id, id: { [Op.in]: [currentId, targetId] } },
        order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE,
      })
      const current = participants.find((decision) => decision.id === currentId)
      const target = participants.find((decision) => decision.id === targetId)
      validateSupersession({
        current: current?.get({ plain: true }),
        target: target?.get({ plain: true }),
        workspaceId: workspace.id,
      })
      await target.update({ status: "SUPERSEDED" }, { transaction })
      await DecisionRelation.create(
        {
          workspaceId: workspace.id,
          fromDecisionId: current.id,
          toDecisionId: target.id,
          relationType: "SUPERSEDES",
          replacementReason: reason,
        },
        { transaction },
      )
      return getDecision(identity, current.id, transaction)
    })
  }

  async function listScopes(identity) {
    const { workspace } = await resolveContext(identity)
    const rows = await sequelize.query(
      `SELECT scope, COUNT(*)::int AS "decisionCount",
              COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS "activeCount",
              MAX(created_at) AS "latestDecisionAt"
       FROM decisions d CROSS JOIN LATERAL (SELECT DISTINCT jsonb_array_elements_text(d.applies_to) AS scope) s
       WHERE d.workspace_id = :workspaceId AND btrim(scope) <> ''
       GROUP BY scope ORDER BY scope`,
      { replacements: { workspaceId: workspace.id }, type: QueryTypes.SELECT },
    )
    return rows
  }

  async function scopeOverview(identity, scope) {
    const { workspace } = await resolveContext(identity)
    const where = { workspaceId: workspace.id, appliesTo: { [Op.contains]: [scope] } }
    const [decisionCount, active, changes] = await Promise.all([
      Decision.count({ where }),
      Decision.findAll({ where: { ...where, status: "ACTIVE" }, include: decisionIncludes, order: [["createdAt", "DESC"]] }),
      sequelize.query(
        `SELECT r.replacement_reason AS "replacementReason", r.created_at AS "replacedAt",
           json_build_object('id', old.id, 'decisionKey', old.decision_key, 'title', old.title, 'status', old.status) AS previous,
           json_build_object('id', newer.id, 'decisionKey', newer.decision_key, 'title', newer.title, 'status', newer.status) AS replacement
         FROM decision_relations r
         JOIN decisions old ON old.id = r.to_decision_id AND old.workspace_id = :workspaceId
         JOIN decisions newer ON newer.id = r.from_decision_id AND newer.workspace_id = :workspaceId
         WHERE r.workspace_id = :workspaceId AND r.relation_type = 'SUPERSEDES'
           AND (old.applies_to @> CAST(:scope AS jsonb) OR newer.applies_to @> CAST(:scope AS jsonb))
         ORDER BY r.created_at DESC, r.id DESC LIMIT 10`,
        { replacements: { workspaceId: workspace.id, scope: JSON.stringify([scope]) }, type: QueryTypes.SELECT },
      ),
    ])
    if (!decisionCount) return null
    return { scope, decisionCount, activeDecisions: active.map(serializeDecision), changes }
  }

  async function metadata(identity) {
    const { workspace, user } = await resolveContext(identity)
    const [users, tags, channels, appliesTo, namedOwners] = await Promise.all([
      User.findAll({ where: { workspaceId: workspace.id }, order: [["displayName", "ASC"]] }),
      Tag.findAll({ where: { workspaceId: workspace.id }, order: [["name", "ASC"]] }),
      sequelize.query(
        `SELECT DISTINCT channel_name AS value
         FROM source_snapshots
         WHERE workspace_id = :workspaceId AND channel_name IS NOT NULL
         ORDER BY value`,
        { replacements: { workspaceId: workspace.id }, type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `SELECT DISTINCT jsonb_array_elements_text(applies_to) AS value
         FROM decisions
         WHERE workspace_id = :workspaceId
         ORDER BY value`,
        {
          replacements: { workspaceId: workspace.id },
          type: QueryTypes.SELECT,
        },
      ),
      Decision.findAll({
        where: { workspaceId: workspace.id, ownerId: null, ownerName: { [Op.not]: null } },
        attributes: [[sequelize.fn("DISTINCT", sequelize.col("owner_name")), "ownerName"]],
        raw: true,
      }),
    ])
    return {
      workspace: workspace.get({ plain: true }),
      currentUser: { id: user.id, displayName: user.displayName },
      ownerNames: namedOwners.map((row) => row.ownerName).filter(Boolean).sort(),
      users: users.map((user) => user.get({ plain: true })),
      tags: tags.map((tag) => tag.name),
      channels: channels.map((row) => row.value),
      appliesTo: appliesTo.map((row) => row.value).filter(Boolean),
    }
  }

  return {
    resolveContext,
    listDecisions,
    memorySearchCandidates,
    memorySearchCandidateCount,
    queueUnindexedDecisions,
    pendingSearchJobs,
    completeSearchJob,
    vectorSearch,
    getDecision,
    createDecision,
    updateDecision,
    supersedeDecision,
    addReference,
    claimJiraIssueRequest,
    updateJiraIssueRequest,
    linkJiraIssueRequest,
    createSlackCaptureDraft,
    getSlackCaptureDraft,
    setSlackCaptureDraftAi,
    decisionIdsForThread,
    claimSlackNudge,
    metadata,
    listScopes,
    scopeOverview,
  }
}
