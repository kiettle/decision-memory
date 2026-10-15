import type {
  Decision,
  DecisionInput,
  JiraIssueType,
  JiraProject,
  MemorySearchResponse,
  MemorySearchMethod,
  Metadata,
  ScopeSummary,
  ScopeOverview,
  ProposalReview,
} from "@/types"

// The competition demo uses the local web app. Enable only for a verified Forge deployment.
const USE_FORGE = false

export class ApiError extends Error {
  code?: string
  issue?: { key: string; url: string }
  constructor(payload: { error?: string; code?: string; issue?: { key: string; url: string } }) {
    super(payload.error ?? "The request failed.")
    this.code = payload.code
    this.issue = payload.issue
  }
}

type Method = "GET" | "POST" | "PUT"

async function request<T>(
  path: string,
  method: Method = "GET",
  body?: unknown
): Promise<T> {
  const headers = { "content-type": "application/json" }
  if (USE_FORGE) {
    const { forgeRequest } = await import("@/lib/forge-transport")
    const response = await forgeRequest(path, method, headers, body)
    if (response.status >= 400) {
      throw new ApiError(response.body ?? {})
    }
    return response.body as T
  }

  const baseUrl = "http://localhost:3011"
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = (await response.json()) as T & { error?: string; code?: string; issue?: { key: string; url: string } }
  if (!response.ok) throw new ApiError(payload)
  return payload
}

export type DecisionFilters = {
  q?: string
  channel?: string
  ownerId?: string
  tag?: string
  status?: string
  decisionState?: string
  deadline?: string
  asOf?: string
  sort?: string
  appliesTo?: string
  dateRange?: string
}

export const api = {
  checkProposal: (proposal: string, appliesTo?: string, method: MemorySearchMethod = "LOCAL") =>
    request<ProposalReview>("/api/decisions/check-proposal", "POST", { proposal, appliesTo: appliesTo || undefined, method }),
  scopes: () => request<ScopeSummary[]>("/api/scopes"),
  scopeOverview: (scope: string) => request<ScopeOverview>(`/api/scopes/overview?${new URLSearchParams({ scope })}`),
  metadata: () => request<Metadata>("/api/metadata"),
  decisions: (filters: DecisionFilters = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "ALL") params.set(key, value)
    })
    const query = params.size ? `?${params}` : ""
    return request<Decision[]>(`/api/decisions${query}`)
  },
  memorySearch: (query: string, filters: DecisionFilters = {}, method: MemorySearchMethod = "LOCAL") =>
    request<MemorySearchResponse>("/api/decisions/memory-search", "POST", {
      query,
      method,
      filters: Object.fromEntries(
        Object.entries(filters).filter(
          ([key, value]) => key !== "q" && value && value !== "ALL"
        )
      ),
    }),
  decision: (id: string) => request<Decision>(`/api/decisions/${id}`),
  createDecision: (input: DecisionInput) =>
    request<Decision>("/api/decisions", "POST", input),
  updateDecision: (id: string, input: DecisionInput) =>
    request<Decision>(`/api/decisions/${id}`, "PUT", input),
  updateDeadline: (id: string, dueDate: string | null) =>
    request<Decision>(`/api/decisions/${id}/deadline`, "PUT", { dueDate }),
  recordOutcome: (id: string, input: { outcome: string; why?: string }) =>
    request<Decision>(`/api/decisions/${id}/decide`, "POST", input),
  supersede: (currentId: string, targetId: string, replacementReason = "") =>
    request<Decision>(`/api/decisions/${currentId}/supersede`, "POST", {
      targetId,
      replacementReason,
    }),
  jiraProjects: () => request<JiraProject[]>("/api/jira/projects"),
  jiraIssueTypes: (projectKey: string) =>
    request<JiraIssueType[]>(
      `/api/jira/projects/${encodeURIComponent(projectKey)}/issue-types`
    ),
  createJiraIssue: (
    decisionId: string,
    input: { requestId: string; projectKey: string; issueTypeId: string; summary: string }
  ) =>
    request<{ issue: { key: string; url: string }; decision: Decision }>(
      `/api/decisions/${decisionId}/jira-issue`,
      "POST",
      input
    ),
}
