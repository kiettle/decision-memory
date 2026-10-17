import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { DecisionActions } from "@/components/decision-actions"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { browserStorageKey } from "@/lib/browser-storage"
import type {
  CompletionDraft,
  DecisionNavigationState,
} from "@/lib/decision-navigation"
import type { Decision } from "@/types"

// One host per page, independent of filtered rows. A concurrent completion may
// remove the row, but the original input must still reach the narrow conflict API.
export function CompletionReturn({
  onSaved,
}: {
  onSaved: (decision: Decision) => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [entry] = useState(() => ({
    draft: (location.state as DecisionNavigationState | null)?.completionDraft,
    state: {
      ...(location.state as DecisionNavigationState | null),
      completionDraft: undefined,
    },
    url: location.pathname + location.search,
  }))
  const [ready, setReady] = useState<{
    decision: Decision
    draft: CompletionDraft
  } | null>(null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    const draft = entry.draft
    if (!draft || dismissed) return
    let active = true
    void Promise.all([api.metadata(), api.decision(draft.decisionId)])
      .then(([metadata, decision]) => {
        if (!active) return
        if (
          !metadata.currentUser?.id ||
          draft.identityKey !==
            browserStorageKey(metadata, `completion:${decision.id}`) ||
          draft.decisionId !== decision.id ||
          typeof draft.token !== "string" ||
          typeof draft.outcome !== "string" ||
          draft.outcome.length > 500 ||
          typeof draft.why !== "string" ||
          draft.why.length > 20_000
        ) {
          setError(
            "This completion belongs to another signed-in context or is no longer available. Open the record to continue."
          )
          setDismissed(true)
        } else {
          setReady({ decision, draft })
        }
        // Consume only after identity/detail loading, so failed loading/reload can retry.
        void navigate(entry.url, { replace: true, state: entry.state })
      })
      .catch(() => {
        if (active)
          setError(
            "Could not reopen completion. Your inputs are kept in this navigation entry; retry to continue."
          )
      })
    return () => {
      active = false
    }
  }, [entry, attempt, dismissed, navigate])

  if (!entry.draft) return null
  if (ready && !dismissed)
    return (
      <DecisionActions
        decision={ready.decision}
        resumed={ready.draft}
        onSaved={onSaved}
        onDismiss={() => {
          setDismissed(true)
          // Drop forward review/detour entries after completion or dismissal. The
          // original entry has already been consumed; Back cannot resurrect this dialog.
          void navigate(entry.url, { state: entry.state })
        }}
      />
    )
  if (error)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
        <p>{error}</p>
        {!dismissed ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError("")
              setAttempt((value) => value + 1)
            }}
          >
            Retry completion
          </Button>
        ) : null}
      </div>
    )
  return dismissed ? null : <p role="status">Reopening completion…</p>
}
