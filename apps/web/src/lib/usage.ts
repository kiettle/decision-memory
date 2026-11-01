import { api } from "@/lib/api"
import type { SearchEvent } from "@/types"

// Usage facts are best effort: they never block a page or surface an error.
// The server discards them unless the workspace has turned collection on.
const sessionKey = "decision-memory:view-session"
let fallbackSession = ""

function viewSession() {
  try {
    const existing = sessionStorage.getItem(sessionKey)
    if (existing) return existing
    const created = crypto.randomUUID()
    sessionStorage.setItem(sessionKey, created)
    return created
  } catch {
    fallbackSession ||= crypto.randomUUID()
    return fallbackSession
  }
}

// Only a full page open in a visible tab counts; previews and prefetches do not.
export function recordDecisionView(decisionId: string) {
  if (document.visibilityState !== "visible") return
  void api.recordView(decisionId, viewSession()).catch(() => undefined)
}

export function recordSearch(event: SearchEvent) {
  const query = event.query.trim().slice(0, 500)
  if (!query) return
  void api.recordSearch({ ...event, query }).catch(() => undefined)
}
