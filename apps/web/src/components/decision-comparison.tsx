import { ArrowRight, FileText } from "lucide-react"
import { headline } from "../../../../shared/decision-deadlines.js"
import { Link } from "react-router-dom"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { recordedDate, scopeHref } from "@/lib/decision-links"
import type { Decision } from "@/types"

const values = (decision: Decision) => [
  ["Decision", decision.decisionState === "PENDING" ? "Not decided yet." : headline(decision)],
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
      decision.decisionState === "PENDING" ? "Not decided yet." : headline(decision),
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
          {differences.filter(Boolean).length} of {leftFields.length} fields differ
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
      <div className="grid gap-8 md:grid-cols-2">
        {[left, right].map((decision, side) => (
          <article
            key={decision.id}
            aria-label={side === 0 ? "First Decision" : "Second Decision"}
            className="min-w-0 border-t pt-5"
          >
            <div className="mb-5 grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={decision.status} decisionState={decision.decisionState} />
                <span className="decision-key">{decision.decisionKey}</span>
              </div>
              <h2 className="text-xl leading-7 font-semibold">
                {headline(decision)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {decision.owner?.displayName ??
                  decision.ownerName ??
                  "Unassigned"}{" "}
                · {recordedDate(decision.createdAt)}
              </p>
              <Button
                variant="outline"
                className="w-fit"
                render={<Link to={`/decisions/${decision.id}`} />}
                nativeButton={false}
              >
                Open Decision <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
            <dl className="grid gap-5">
              {(side === 0 ? leftValues : rightValues).map(
                ([label, value], index) => (
                  <div key={label} className="grid gap-2">
                    <dt className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {label}
                      <Badge variant="outline">
                        {differences[index]
                          ? "Different wording"
                          : "Same wording"}
                      </Badge>
                    </dt>
                    <dd className="text-sm leading-6 break-words whitespace-pre-wrap">
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
                        value
                      )}
                    </dd>
                  </div>
                )
              )}
            </dl>
            <Separator className="my-5" />
            <div className="grid gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4" /> Evidence and related work
              </h3>
              <p className="text-sm text-muted-foreground">
                {decision.evidenceCount} captured source
                {decision.evidenceCount === 1 ? "" : "s"} ·{" "}
                {decision.references?.length ?? 0} related link
                {decision.references?.length === 1 ? "" : "s"}
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
          </article>
        ))}
      </div>
    </div>
  )
}
