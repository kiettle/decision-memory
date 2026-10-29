import { ArrowRight, FileText } from "lucide-react"
import { headline } from "../../../../shared/decision-deadlines.js"
import { Link } from "react-router-dom"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { recordedDate, scopeHref } from "@/lib/decision-links"
import type { Decision } from "@/types"

const values = (decision: Decision) => [
  [
    "Decision",
    decision.decisionState === "PENDING"
      ? "Not decided yet."
      : headline(decision),
  ],
  ["Original question", decision.title],
  ["Why", decision.why || "No rationale recorded."],
  ["Context", decision.context || "No context recorded."],
  [
    "Applies To",
    [...decision.appliesTo].sort().join(" · ") || "No scope recorded.",
  ],
  [
    "Options Considered",
    [...decision.optionsConsidered].sort().join("\n") ||
      "No alternatives recorded.",
  ],
]

export function DecisionComparison({
  left,
  right,
}: {
  left: Decision
  right: Decision
}) {
  const leftValues = values(left)
  const rightValues = values(right)
  const comparable = (decision: Decision) =>
    [
      decision.decisionState === "PENDING"
        ? "Not decided yet."
        : headline(decision),
      decision.title,
      decision.why ?? "",
      decision.context ?? "",
      [...decision.appliesTo].sort(),
      [...decision.optionsConsidered].sort(),
    ].map((field) => JSON.stringify(field))
  const leftFields = comparable(left)
  const rightFields = comparable(right)
  const differences = leftFields.map(
    (value, index) => value !== rightFields[index]
  )
  const sharedScopes = left.appliesTo.filter((scope) =>
    right.appliesTo.includes(scope)
  )
  const replacement =
    right.lifecycle?.supersedes.find((item) => item.id === left.id) ??
    left.lifecycle?.supersedes.find((item) => item.id === right.id)
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Badge variant="secondary">
          {differences.filter(Boolean).length} of {leftFields.length} fields
          differ
        </Badge>
        <span>
          {sharedScopes.length
            ? `Shared scope: ${sharedScopes.join(", ")}`
            : "No shared scope is recorded."}
        </span>
      </div>
      {replacement ? (
        <section
          aria-label="Reason for replacement"
          className="grid gap-2 border-l-2 border-primary pl-4"
        >
          <h2 className="font-semibold">What changed?</h2>
          <p className="text-sm leading-6 break-words whitespace-pre-wrap">
            {replacement.replacementReason ||
              "No replacement reason was recorded."}
          </p>
          {replacement.replacedAt ? (
            <p className="text-xs text-muted-foreground">
              Recorded when replaced · {recordedDate(replacement.replacedAt)}
            </p>
          ) : null}
        </section>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Compare the recorded wording and evidence to understand whether these
        choices apply in the same situation.
      </p>
      <div className="grid grid-cols-2 gap-4 md:gap-8">
        {[left, right].map((decision, side) => (
          <article
            key={decision.id}
            aria-label={side === 0 ? "First Decision" : "Second Decision"}
            className="grid min-w-0 content-start gap-3 border-t pt-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={decision.status}
                decisionState={decision.decisionState}
              />
              <span className="decision-key">{decision.decisionKey}</span>
            </div>
            <h2 className="text-sm leading-6 font-semibold md:text-xl md:leading-7">
              <span className="md:hidden">
                {side === 0 ? "First" : "Second"} · {decision.decisionKey}
              </span>
              <span className="hidden md:inline">{headline(decision)}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {decision.owner?.displayName ??
                decision.ownerName ??
                "Unassigned"}
              {" · "}
              {recordedDate(decision.createdAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              {decision.evidenceCount} captured source
              {decision.evidenceCount === 1 ? "" : "s"}
              {" · "}
              {decision.references?.length ?? 0} related link
              {decision.references?.length === 1 ? "" : "s"}
            </p>
            <Button
              variant="outline"
              className="w-fit"
              render={<Link to={`/decisions/${decision.id}`} />}
              nativeButton={false}
            >
              Open Decision <ArrowRight data-icon="inline-end" />
            </Button>
          </article>
        ))}
      </div>
      <div>
        {leftValues.map(([label], index) => (
          <section
            key={label}
            aria-label={`${label} comparison`}
            className="comparison-field"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{label}</h2>
              <Badge variant="outline">
                {differences[index] ? "Different wording" : "Same wording"}
              </Badge>
            </div>
            <div className="comparison-grid">
              {[left, right].map((decision, side) => (
                <div
                  key={decision.id}
                  role="group"
                  aria-label={`${side === 0 ? "First" : "Second"} Decision ${label}`}
                  className="grid min-w-0 content-start gap-1"
                >
                  <p className="text-xs font-medium text-muted-foreground md:sr-only">
                    {side === 0 ? "First" : "Second"} · {decision.decisionKey}
                  </p>
                  <div className="comparison-value">
                    {label === "Applies To" && decision.appliesTo.length ? (
                      <div className="flex flex-wrap gap-2">
                        {decision.appliesTo.map((scope) => (
                          <Link
                            key={scope}
                            to={scopeHref(scope, decision.decisionState)}
                            className="text-primary underline underline-offset-4"
                          >
                            {scope}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      (side === 0 ? leftValues : rightValues)[index][1]
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <section aria-label="Evidence comparison" className="comparison-field">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4" /> Evidence and related work
          </h2>
          <div className="comparison-grid">
            {[left, right].map((decision, side) => (
              <div
                key={decision.id}
                role="group"
                aria-label={`${side === 0 ? "First" : "Second"} Decision evidence`}
                className="grid min-w-0 content-start gap-3"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {side === 0 ? "First" : "Second"} · {decision.decisionKey}
                </p>
                {decision.sources?.find((source) => source.anchorText)
                  ?.anchorText ? (
                  <blockquote className="border-l-2 pl-3 text-sm leading-6">
                    {decision.sources
                      .find((source) => source.anchorText)
                      ?.anchorText?.slice(0, 320)}
                  </blockquote>
                ) : null}
                <Link
                  to={`/decisions/${decision.id}`}
                  className="text-sm text-primary underline underline-offset-4"
                >
                  Read saved evidence for {decision.decisionKey}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
