import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"

import { headline } from "../../../../shared/decision-deadlines.js"
import { StatusBadge } from "@/components/status-badge"
import { RelatedDecisionPreview } from "@/components/related-decision-preview"
import { Button } from "@/components/ui/button"
import { SearchableSelect } from "@/components/searchable-select"
import { api } from "@/lib/api"
import type { DecisionNavigationState } from "@/lib/decision-navigation"
import type { MemorySearchResponse } from "@/types"

// Lookup selection and expansion belong to this form visit. Only transient
// retrieval remounts when its inputs change, cancelling timers and late replies.
export function RelatedDecisionSearch(props: {
  query: string
  mode: "PENDING" | "DECIDED"
  scopes: string[]
  available: boolean
  saving: boolean
  origin: DecisionNavigationState | null
}) {
  const { query, scopes, mode } = props
  const scopesKey = JSON.stringify(scopes)
  const [previousInputs, setPreviousInputs] = useState({ scopesKey, mode })
  const [lookupScope, setLookupScope] = useState(
    scopes.length === 1 ? scopes[0] : ""
  )
  const [expanded, setExpanded] = useState(false)
  if (previousInputs.scopesKey !== scopesKey || previousInputs.mode !== mode) {
    setPreviousInputs({ scopesKey, mode })
    // Keep valid exact selections and explicit All while several scopes remain.
    if (
      previousInputs.mode !== mode ||
      !(lookupScope ? scopes.includes(lookupScope) : scopes.length > 1)
    )
      setLookupScope(scopes.length === 1 ? scopes[0] : "")
  }
  // Stop transient work during save while keeping preferences for a failed save.
  if (props.saving) return null
  return (
    <section
      aria-label="Related decisions"
      className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"
    >
      {scopes.length > 1 ? (
        <SearchableSelect
          label="Search within"
          value={lookupScope}
          options={[
            { label: "All scopes", value: "" },
            ...scopes.map((scope) => ({ label: scope, value: scope })),
          ]}
          onChange={setLookupScope}
          className="h-9 w-full min-w-0 justify-between sm:max-w-sm"
        />
      ) : null}
      <RelatedLookup
        key={JSON.stringify([mode, query, scopes, lookupScope])}
        {...props}
        lookupScope={lookupScope}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
    </section>
  )
}

function RelatedLookup({
  query,
  scopes,
  available,
  origin,
  lookupScope,
  expanded,
  onExpandedChange,
}: {
  query: string
  scopes: string[]
  available: boolean
  origin: DecisionNavigationState | null
  lookupScope: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}) {
  const [result, setResult] = useState<MemorySearchResponse | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")
  const revision = useRef(0)
  const active = useRef(false)
  const inFlight = useRef(false)
  // A manual or automatic search for the current lookup scope skips the automatic one.
  const searched = useRef(false)
  const autoSearch = useRef(() => {})
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  useEffect(() => {
    autoSearch.current = () => {
      if (!searched.current) void search()
    }
  })
  useEffect(() => {
    const timeout = window.setTimeout(() => autoSearch.current(), 700)
    return () => window.clearTimeout(timeout)
  }, [available])
  const scopeHelp = lookupScope
    ? `Search scope: ${lookupScope} (exact scope).`
    : scopes.length > 1
      ? "Search scope: all scopes. Choose one selected draft scope to narrow this lookup."
      : "Search scope: all scopes (none selected)."

  async function search() {
    if (!available || query.trim().length < 3 || inFlight.current) return
    const request = ++revision.current
    inFlight.current = true
    searched.current = true
    setSearching(true)
    setError("")
    setResult(null)
    try {
      const response = await api.memorySearch(
        query.trim(),
        lookupScope ? { appliesTo: lookupScope } : {},
        "LOCAL"
      )
      if (active.current && request === revision.current) setResult(response)
    } catch {
      if (active.current && request === revision.current)
        setError(
          "Related lookup could not finish. Your form is kept; you can retry or save without searching."
        )
    } finally {
      if (active.current && request === revision.current) {
        inFlight.current = false
        setSearching(false)
      }
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void search()}
          disabled={searching || !available || query.trim().length < 3}
          aria-describedby="related-search-help"
        >
          {searching ? "Finding related decisions…" : "Find related decisions"}
        </Button>
        <p className="min-w-0 text-sm break-words text-muted-foreground">
          {scopeHelp}
        </p>
      </div>
      <p id="related-search-help" className="text-xs text-muted-foreground">
        Similar recorded decisions appear here when you pause typing, searched
        on this computer only. Similarity helps discovery; it does not approve a
        choice.
        {!available
          ? " Local search is unavailable. You can still save normally."
          : query.trim().length < 3
            ? " Enter at least 3 characters in the question or final choice."
            : ""}
      </p>
      <div aria-live="polite" className="flex min-w-0 flex-col gap-3">
        {error ? (
          <p role="alert" className="text-sm">
            {error}
          </p>
        ) : null}
        {result ? (
          <>
            <h2 className="font-semibold">Related decisions</h2>
            <p className="text-xs text-muted-foreground">
              {result.truncated
                ? `Searched ${result.candidateCount} of ${result.totalCandidateCount} recorded decisions. Remaining records are waiting for local indexing; try again later or use keyword search in the library.`
                : `Searched the local index of ${result.candidateCount} recorded decisions. No external AI request.`}
            </p>
            {!result.matches.length ? (
              <p className="text-sm">
                No related decisions were found in the searched records.
              </p>
            ) : null}
            {result.matches.slice(0, expanded ? 5 : 2).map(({ decision }) => (
              <article
                key={decision.id}
                className="flex min-w-0 flex-col gap-2 rounded-md border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {decision.decisionKey}
                  </span>
                  <StatusBadge
                    status={decision.status}
                    decisionState={decision.decisionState}
                  />
                  {decision.status === "ACTIVE" ? (
                    <span className="text-xs text-muted-foreground">
                      Current choice
                    </span>
                  ) : null}
                </div>
                <p className="font-medium break-words">{headline(decision)}</p>
                <p className="break-words text-muted-foreground">
                  Applies To:{" "}
                  {decision.appliesTo.join(" · ") || "No scope recorded"}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <RelatedDecisionPreview decision={decision} origin={origin} />
                  <Link
                    to={`/decisions/${decision.id}`}
                    state={origin}
                    className="w-fit rounded-sm underline focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`Open decision ${decision.decisionKey}`}
                  >
                    Open decision
                  </Link>
                </div>
              </article>
            ))}
            {result.matches.length > 2 ? (
              <Button
                type="button"
                variant="link"
                className="w-fit"
                aria-expanded={expanded}
                onClick={() => onExpandedChange(!expanded)}
              >
                {expanded
                  ? "Show fewer"
                  : `Show all ${Math.min(result.matches.length, 5)} related decisions`}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  )
}
