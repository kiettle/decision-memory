import { DomainError } from "./domain.js"

// Creates Jira issues from Decisions (spec §18) with the Jira Cloud REST API.
// The API token stays on the server; the browser only sees project names,
// issue types, and the created issue key.
const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,49}$/

const text = (value) => ({ type: "text", text: value })
const labelled = (label, value) => ({
  type: "paragraph",
  content: [{ ...text(`${label}: `), marks: [{ type: "strong" }] }, text(value)],
})

// Jira Cloud expects descriptions in Atlassian Document Format.
export function issueDescription(decision, decisionUrl) {
  return {
    type: "doc",
    version: 1,
    content: [
      labelled("Decision", decision.outcome || decision.title),
      decision.why ? labelled("Why", decision.why) : null,
      decision.context ? labelled("Context", decision.context) : null,
      decision.appliesTo?.length ? labelled("Applies to", decision.appliesTo.join(", ")) : null,
      {
        type: "paragraph",
        content: [
          { ...text(`Decision Memory ${decision.decisionKey}`), marks: [{ type: "link", attrs: { href: decisionUrl } }] },
        ],
      },
    ].filter(Boolean),
  }
}

export function createJiraClient({ config, fetchImpl = (...args) => fetch(...args), timeoutMs = 8_000 }) {
  const baseUrl = config.jiraBaseUrl?.replace(/\/+$/, "")
  const enabled = Boolean(baseUrl && config.jiraEmail && config.jiraApiToken)
  const authorization = enabled
    ? `Basic ${Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString("base64")}`
    : ""

  async function call(path, body) {
    if (!enabled) {
      throw new DomainError(
        "Jira is not configured. Add JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN.",
        503,
        "JIRA_NOT_CONFIGURED",
      )
    }
    let response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          authorization,
          accept: "application/json",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: globalThis.AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new DomainError("Jira could not be reached. Please try again.", 502, "JIRA_UNAVAILABLE")
    }
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      // Jira explains missing fields or permissions; never echo the credentials.
      const detail = [...(result.errorMessages ?? []), ...Object.values(result.errors ?? {})]
        .join(" ")
        .slice(0, 300)
      const error = new DomainError(
        `Jira rejected the request${detail ? `: ${detail}` : ` (HTTP ${response.status}).`}`,
        502,
        "JIRA_REJECTED",
      )
      error.retrySafe = response.status >= 400 && response.status < 500
      throw error
    }
    return result
  }

  function requireProjectKey(projectKey) {
    if (!PROJECT_KEY.test(projectKey ?? "")) {
      throw new DomainError("Choose a valid Jira project.", 400, "JIRA_PROJECT_INVALID")
    }
    return projectKey
  }

  async function projects() {
    const result = await call("/rest/api/3/project/search?maxResults=100&orderBy=name")
    return (result.values ?? []).map((project) => ({ key: project.key, name: project.name }))
  }

  async function issueTypes(projectKey) {
    const project = await call(`/rest/api/3/project/${requireProjectKey(projectKey)}`)
    return (project.issueTypes ?? [])
      .filter((type) => !type.subtask)
      .map((type) => ({ id: String(type.id), name: type.name }))
  }

  async function createIssue({ projectKey, issueTypeId, summary, decision }) {
    const decisionUrl = `${config.appBaseUrl}/#/decisions/${decision.id}`
    const created = await call("/rest/api/3/issue", {
      fields: {
        project: { key: requireProjectKey(projectKey) },
        issuetype: { id: issueTypeId },
        summary: summary.replace(/\s+/g, " ").trim().slice(0, 255),
        description: issueDescription(decision, decisionUrl),
      },
    })
    return { key: created.key, url: `${baseUrl}/browse/${created.key}` }
  }

  return { enabled, projects, issueTypes, createIssue }
}

// The external create is never repeated after an ambiguous outcome. A stored
// receipt lets subsequent requests retry only the local linking transaction.
export async function createLinkedJiraIssue({ repository, jira, identity, decision, requestId, input }) {
  const attempt = await repository.claimJiraIssueRequest(identity, decision.id, requestId, input)
  let issue = attempt.issue
  if (!attempt.claimed && !issue) {
    throw new DomainError("This Jira request is still pending or its outcome is unknown. Check Jira before creating another issue; if it exists, attach its URL using Edit Decision.", 409, "JIRA_OUTCOME_UNKNOWN")
  }
  if (attempt.claimed) {
    try {
      issue = await jira.createIssue({ ...input, decision })
    } catch (error) {
      if (error.retrySafe || error.code === "JIRA_NOT_CONFIGURED") {
        await repository.updateJiraIssueRequest(identity, requestId, { status: "REJECTED" })
        throw error
      }
      throw new DomainError("Jira creation could not be confirmed. Check Jira before creating another issue; retries will not create duplicates.", 409, "JIRA_OUTCOME_UNKNOWN")
    }
  }
  try {
    if (attempt.claimed) await repository.updateJiraIssueRequest(identity, requestId, { status: "CREATED", issue })
    return await repository.linkJiraIssueRequest(identity, requestId)
  } catch {
    const error = new DomainError(`Jira issue ${issue.key} was created, but its link could not be saved. Retry to finish linking; if the result cannot be recovered, attach this URL using Edit Decision.`, 503, "JIRA_LINK_PENDING")
    error.issue = issue
    throw error
  }
}
