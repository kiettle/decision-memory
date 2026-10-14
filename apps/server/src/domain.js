export class DomainError extends Error {
  constructor(message, status = 400, code = "INVALID_REQUEST") {
    super(message)
    this.name = "DomainError"
    this.status = status
    this.code = code
  }
}

export function requireDecisionTitle(value) {
  const title = typeof value === "string" ? value.trim() : ""
  if (!title) {
    throw new DomainError("Decision is required.", 400, "DECISION_REQUIRED")
  }
  return title
}

export function validateSupersession({ current, target, workspaceId }) {
  if (!current || !target) {
    throw new DomainError("Both decisions must exist.", 404, "DECISION_NOT_FOUND")
  }
  if (current.workspaceId !== workspaceId || target.workspaceId !== workspaceId) {
    throw new DomainError(
      "Decisions must belong to the current workspace.",
      403,
      "CROSS_WORKSPACE_RELATION",
    )
  }
  if (current.id === target.id) {
    throw new DomainError(
      "A decision cannot supersede itself.",
      400,
      "SELF_SUPERSESSION",
    )
  }
  if (current.status !== "ACTIVE" || target.status !== "ACTIVE") {
    throw new DomainError(
      "Only active decisions can participate in a new supersession.",
      409,
      "INACTIVE_SUPERSESSION",
    )
  }
  if (current.decisionState === "PENDING" || target.decisionState === "PENDING") {
    throw new DomainError("Record both final choices before replacing a decision (decision-deadlines.md).", 409, "PENDING_SUPERSESSION")
  }
}

export function slackIdempotencyKey(payload) {
  const teamId = payload.team?.id ?? payload.team_id ?? "unknown-team"
  const eventId =
    payload.view?.id ??
    payload.trigger_id ??
    payload.message?.ts ??
    payload.callback_id ??
    payload.command ??
    "unknown-event"
  return `${teamId}:${eventId}`
}
