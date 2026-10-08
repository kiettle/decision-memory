import type {
  Decision,
  DecisionInput,
  JiraIssueType,
  JiraProject,
  MemorySearchResponse,
  Metadata,
} from "@/types"

// The competition demo uses the local web app. Enable only for a verified Forge deployment.
const USE_FORGE = false

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
      throw new Error(String(response.body?.error ?? "The request failed."))
    }
    return response.body as T
  }

  const baseUrl = "http://localhost:3011"
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? "The request failed.")
  return payload
}

export type DecisionFilters = {
  q?: string
  channel?: string
  ownerId?: string
  tag?: string
  status?: string
  appliesTo?: string
  dateRange?: string
}

export const api = {
  metadata: () => request<Metadata>("/api/metadata"),
  decisions: (filters: DecisionFilters = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "ALL") params.set(key, value)
    })
    const query = params.size ? `?${params}` : ""
    return request<Decision[]>(`/api/decisions${query}`)
  },
  memorySearch: (query: string, filters: DecisionFilters = {}) =>
    request<MemorySearchResponse>("/api/decisions/memory-search", "POST", {
      query,
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
  supersede: (currentId: string, targetId: string) =>
    request<Decision>(`/api/decisions/${currentId}/supersede`, "POST", {
      targetId,
    }),
  jiraProjects: () => request<JiraProject[]>("/api/jira/projects"),
  jiraIssueTypes: (projectKey: string) =>
    request<JiraIssueType[]>(
      `/api/jira/projects/${encodeURIComponent(projectKey)}/issue-types`
    ),
  createJiraIssue: (
    decisionId: string,
    input: { projectKey: string; issueTypeId: string; summary: string }
  ) =>
    request<{ issue: { key: string; url: string }; decision: Decision }>(
      `/api/decisions/${decisionId}/jira-issue`,
      "POST",
      input
    ),
}
