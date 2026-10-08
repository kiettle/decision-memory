import { Op, QueryTypes } from "sequelize"

import { DomainError, requireDecisionTitle, validateSupersession } from "./domain.js"

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
      limit: 200,
    })
    return decisions.map(serializeDecision)
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

    return {
      ...serializeDecision(decision),
      sources: sources.map((source) => source.get({ plain: true })),
      references: references.map((reference) => reference.get({ plain: true })),
      lifecycle: {
        supersedes: outgoing
          .map((relation) => relatedById.get(relation.toDecisionId))
          .filter(Boolean),
        supersededBy: incoming
          .map((relation) => relatedById.get(relation.fromDecisionId))
          .filter(Boolean),
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

  async function supersedeDecision(identity, currentId, targetId) {
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
        },
        { transaction },
      )
      return getDecision(identity, current.id, transaction)
    })
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
    getDecision,
    createDecision,
    updateDecision,
    supersedeDecision,
    addReference,
    createSlackCaptureDraft,
    getSlackCaptureDraft,
    decisionIdsForThread,
    claimSlackNudge,
    metadata,
  }
}
