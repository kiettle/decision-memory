import type { DecisionFormDraft } from "@/lib/decision-form-draft"

export type DecisionNavigationState = {
  completionDraft?: CompletionDraft
  completionReturn?: CompletionReviewReturn
  captureDraft?: { draft: DecisionFormDraft; storageKey: string }
  captureReturn?: {
    draft: DecisionFormDraft
    storageKey: string
    origin: DecisionNavigationState | null
  }
  libraryUrl?: string
  libraryState?: DecisionNavigationState & { memoryResult?: unknown }
  scopePrefill?: string
  proposalDraft?: { proposal: string; appliesTo: string }
  proposalOrigin?: string
}

export type CompletionDraft = {
  token: string
  decisionId: string
  identityKey: string
  outcome: string
  why: string
}

export type CompletionReviewReturn = {
  draft: CompletionDraft
  url: string
  state: DecisionNavigationState | null
  historyIndex?: number
}

// HashRouter keeps its entry index in history state. Returning to the original
// entry lets both explicit return and Back consume the same recovery snapshot.
export function navigationHistoryIndex(): number | undefined {
  const index: unknown = window.history.state?.idx
  return typeof index === "number" && Number.isInteger(index)
    ? index
    : undefined
}
