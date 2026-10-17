import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  compareDecisions,
  deadlineBucket,
  headline,
  type DeadlineBucket,
} from "../../../../shared/decision-deadlines.js"
import {
  LibraryMetadataFilter,
  ownerFilter,
  type ApplyMetadataFilter,
} from "@/components/library-metadata-filter"
import { RelatedDecisionPreview } from "@/components/related-decision-preview"
import { DecisionActions } from "@/components/decision-actions"
import { DecisionDeadline } from "@/components/decision-deadline"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Decision, MemorySearchMatch } from "@/types"

const columns: { key: DeadlineBucket; label: string }[] = [
  { key: "OVERDUE", label: "Overdue" },
  { key: "DUE_SOON", label: "Due soon" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "UNSCHEDULED", label: "No deadline" },
  { key: "DECIDED", label: "Decided" },
]

export function DecisionBoard({
  decisions,
  today,
  matches,
  onSaved,
  onFilter,
}: {
  onFilter: ApplyMetadataFilter
  decisions: Decision[]
  today: string
  matches: Map<string, MemorySearchMatch>
  onSaved: (decision: Decision) => void
}) {
  const [decidedLimit, setDecidedLimit] = useState(10)
  const location = useLocation()
  const groups = new Map<DeadlineBucket, Decision[]>(
    columns.map(({ key }) => [key, []])
  )
  for (const decision of decisions)
    groups.get(deadlineBucket(decision, today))!.push(decision)
  const memoryResults = matches.size > 0
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Grouped automatically by deadline using your local date. Due soon
        includes today through seven days ahead.
      </p>
      <div
        className="decision-board"
        role="region"
        aria-label="Decision Kanban board"
        tabIndex={0}
      >
        {columns.map(({ key, label }) => {
          const rows = groups.get(key)!
          if (!memoryResults)
            rows.sort((a, b) =>
              compareDecisions(
                a,
                b,
                key === "UNSCHEDULED" ? "NEWEST" : "DEADLINE"
              )
            )
          const visible = key === "DECIDED" ? rows.slice(0, decidedLimit) : rows
          return (
            <section
              key={key}
              className="board-column"
              aria-label={`${label} decisions`}
            >
              <div className="board-column-heading">
                <h2>{label}</h2>
                <Badge
                  variant="secondary"
                  aria-label={`${rows.length} ${label.toLowerCase()} decisions`}
                >
                  {rows.length}
                </Badge>
              </div>
              {key === "DECIDED" && rows.length > 10 ? (
                <p className="text-xs text-muted-foreground">
                  Showing {visible.length} of {rows.length}
                </p>
              ) : null}
              {visible.length ? (
                visible.map((decision) => (
                  <article className="board-card" key={decision.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="decision-key">
                        {decision.decisionKey}
                      </span>
                      <StatusBadge
                        status={decision.status}
                        decisionState={decision.decisionState}
                      />
                    </div>
                    <Link
                      className="board-card-title"
                      to={`/decisions/${decision.id}`}
                      state={{
                        libraryUrl: location.pathname + location.search,
                        libraryState: location.state,
                      }}
                    >
                      {headline(decision)}
                    </Link>
                    <LibraryMetadataFilter
                      field="ownerId"
                      value={ownerFilter(decision)}
                      label={`Owner to ${decision.owner?.displayName ?? decision.ownerName ?? "Unassigned"}${!decision.owner && decision.ownerName ? " (recorded name)" : ""}`}
                      onFilter={onFilter}
                    >
                      {decision.owner?.displayName ??
                        decision.ownerName ??
                        "Unassigned"}
                    </LibraryMetadataFilter>
                    {decision.decisionState === "PENDING" ||
                    decision.dueDate ? (
                      <DecisionDeadline decision={decision} today={today} />
                    ) : null}
                    {matches.get(decision.id) ? (
                      <p className="text-xs text-muted-foreground">
                        Relevance {Math.round(matches.get(decision.id)!.score)}
                        /100 · {matches.get(decision.id)!.explanation}
                      </p>
                    ) : null}
                    {decision.decisionState === "PENDING" ? (
                      <DecisionActions decision={decision} onSaved={onSaved} />
                    ) : null}
                    <RelatedDecisionPreview
                      decision={decision}
                      context="library"
                      origin={{
                        libraryUrl: location.pathname + location.search,
                        libraryState: location.state,
                      }}
                    />
                  </article>
                ))
              ) : (
                <p className="board-empty">No decisions in this column.</p>
              )}
              {key === "DECIDED" && visible.length < rows.length ? (
                <Button
                  variant="outline"
                  onClick={() => setDecidedLimit((value) => value + 10)}
                >
                  Show more
                </Button>
              ) : null}
            </section>
          )
        })}
      </div>
    </>
  )
}
