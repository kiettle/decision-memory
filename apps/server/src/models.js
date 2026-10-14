import { DataTypes, Sequelize } from "sequelize"

export function createDatabase(databaseUrl, logging = false) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required")
  }

  const sequelize = new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging,
    define: {
      underscored: true,
      timestamps: true,
    },
  })

  const Workspace = sequelize.define(
    "Workspace",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      externalKey: { type: DataTypes.TEXT, allowNull: false, unique: true },
      cloudId: DataTypes.TEXT,
      name: { type: DataTypes.TEXT, allowNull: false },
    },
    { tableName: "workspaces" },
  )

  const User = sequelize.define(
    "User",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspaceId: { type: DataTypes.UUID, allowNull: false },
      externalId: { type: DataTypes.TEXT, allowNull: false },
      displayName: { type: DataTypes.TEXT, allowNull: false },
      avatarUrl: DataTypes.TEXT,
    },
    { tableName: "users" },
  )

  const Decision = sequelize.define(
    "Decision",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspaceId: { type: DataTypes.UUID, allowNull: false },
      decisionKey: { type: DataTypes.TEXT, allowNull: false },
      title: { type: DataTypes.TEXT, allowNull: false },
      why: DataTypes.TEXT,
      context: DataTypes.TEXT,
      appliesTo: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      optionsConsidered: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      team: DataTypes.TEXT,
      ownerId: DataTypes.UUID,
      ownerName: DataTypes.TEXT,
      status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "ACTIVE" },
      decisionState: { type: DataTypes.TEXT, allowNull: false, defaultValue: "DECIDED" },
      dueDate: DataTypes.DATEONLY,
      outcome: DataTypes.TEXT,
      decidedAt: DataTypes.DATE,
      createdById: DataTypes.UUID,
    },
    { tableName: "decisions" },
  )

  const Tag = sequelize.define(
    "Tag",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspaceId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.TEXT, allowNull: false },
    },
    { tableName: "tags", updatedAt: false },
  )

  const SourceSnapshot = sequelize.define(
    "SourceSnapshot",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspaceId: { type: DataTypes.UUID, allowNull: false },
      decisionId: { type: DataTypes.UUID, allowNull: false },
      provider: { type: DataTypes.TEXT, allowNull: false },
      externalChannelId: DataTypes.TEXT,
      channelName: DataTypes.TEXT,
      externalThreadId: DataTypes.TEXT,
      anchorExternalId: DataTypes.TEXT,
      anchorText: DataTypes.TEXT,
      permalink: DataTypes.TEXT,
      capturedAt: { type: DataTypes.DATE, allowNull: false },
      messages: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      sourceContext: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    { tableName: "source_snapshots", updatedAt: false },
  )

  const ExternalReference = sequelize.define(
    "ExternalReference",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspaceId: { type: DataTypes.UUID, allowNull: false },
      decisionId: { type: DataTypes.UUID, allowNull: false },
      kind: { type: DataTypes.TEXT, allowNull: false },
      label: { type: DataTypes.TEXT, allowNull: false },
      url: { type: DataTypes.TEXT, allowNull: false },
    },
    { tableName: "external_references", updatedAt: false },
  )

  const JiraIssueRequest = sequelize.define("JiraIssueRequest", {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    workspaceId: { type: DataTypes.UUID, allowNull: false },
    decisionId: { type: DataTypes.UUID, allowNull: false },
    requestId: { type: DataTypes.UUID, allowNull: false },
    input: { type: DataTypes.JSONB, allowNull: false },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "PENDING" },
    issue: DataTypes.JSONB,
  }, { tableName: "jira_issue_requests" })

  const DecisionRelation = sequelize.define(
    "DecisionRelation",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspaceId: { type: DataTypes.UUID, allowNull: false },
      fromDecisionId: { type: DataTypes.UUID, allowNull: false },
      toDecisionId: { type: DataTypes.UUID, allowNull: false },
      relationType: { type: DataTypes.TEXT, allowNull: false },
      replacementReason: DataTypes.TEXT,
    },
    { tableName: "decision_relations", updatedAt: false },
  )

  const SlackInteraction = sequelize.define(
    "SlackInteraction",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspaceId: { type: DataTypes.UUID, allowNull: false },
      externalEventId: { type: DataTypes.TEXT, allowNull: false },
      decisionId: { type: DataTypes.UUID, allowNull: false },
    },
    { tableName: "slack_interactions", updatedAt: false },
  )

  const SlackCaptureDraft = sequelize.define(
    "SlackCaptureDraft",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspaceId: { type: DataTypes.UUID, allowNull: false },
      externalEventId: { type: DataTypes.TEXT, allowNull: false },
      slackTeamId: { type: DataTypes.TEXT, allowNull: false },
      slackUserId: DataTypes.TEXT,
      source: { type: DataTypes.JSONB, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: "slack_capture_drafts", updatedAt: false },
  )

  const SlackNudge = sequelize.define(
    "SlackNudge",
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspaceId: { type: DataTypes.UUID, allowNull: false },
      channelId: { type: DataTypes.TEXT, allowNull: false },
      threadTs: { type: DataTypes.TEXT, allowNull: false },
      kind: { type: DataTypes.TEXT, allowNull: false },
      decisionId: DataTypes.UUID,
    },
    { tableName: "slack_nudges", updatedAt: false },
  )

  Workspace.hasMany(User, { foreignKey: "workspaceId" })
  User.belongsTo(Workspace, { foreignKey: "workspaceId" })
  Workspace.hasMany(Decision, { foreignKey: "workspaceId" })
  Decision.belongsTo(Workspace, { foreignKey: "workspaceId" })
  Decision.belongsTo(User, { as: "owner", foreignKey: "ownerId" })
  Decision.belongsTo(User, { as: "createdBy", foreignKey: "createdById" })
  Decision.belongsToMany(Tag, {
    through: "decision_tags",
    as: "tags",
    foreignKey: "decisionId",
    otherKey: "tagId",
    timestamps: false,
  })
  Tag.belongsToMany(Decision, {
    through: "decision_tags",
    as: "decisions",
    foreignKey: "tagId",
    otherKey: "decisionId",
    timestamps: false,
  })
  Decision.hasMany(SourceSnapshot, {
    as: "sources",
    foreignKey: "decisionId",
  })
  Decision.hasMany(ExternalReference, {
    as: "references",
    foreignKey: "decisionId",
  })
  Workspace.hasMany(SlackCaptureDraft, { foreignKey: "workspaceId" })
  SlackCaptureDraft.belongsTo(Workspace, { foreignKey: "workspaceId" })

  return {
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
  }
}
