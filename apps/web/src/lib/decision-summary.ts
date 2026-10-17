import { headline } from "../../../../shared/decision-deadlines.js"
import type { Decision } from "@/types"

// A portable rendering of stored facts, never an AI-generated interpretation.
export function decisionSummary(decision: Decision) {
  const pending = decision.decisionState === "PENDING"
  const status =
    decision.status === "SUPERSEDED"
      ? "Superseded — historical choice"
      : pending
        ? "Pending — not yet decided"
        : "Decided — current"
  const lines = [
    `${decision.decisionKey} · ${status}`,
    `${pending ? "Question" : "Decision"}: ${headline(decision)}`,
    `Why: ${decision.why?.trim() || "No rationale recorded."}`,
    `Applies To: ${decision.appliesTo.length ? decision.appliesTo.join("; ") : "No scope recorded."}`,
  ]
  if (decision.status === "SUPERSEDED") {
    const current = decision.lifecycle?.current ?? []
    const replacements =
      decision.lifecycle?.supersededBy ?? decision.supersededBy ?? []
    if (current.length)
      lines.push(
        `Current decisions: ${current.map((item) => item.decisionKey).join(", ")}`
      )
    else if (replacements.length)
      lines.push(
        `Replaced by: ${replacements.map((item) => item.decisionKey).join(", ")}`
      )
  }
  const sources = (decision.sources ?? []).filter((source) => source.permalink)
  if (sources.length) {
    lines.push(
      "",
      "Sources:",
      ...sources.map(
        (source) =>
          `- ${source.channelName || source.provider}: ${source.permalink}`
      )
    )
  }
  if (decision.references?.length) {
    lines.push(
      "",
      "Related links:",
      ...decision.references.map(
        (reference) =>
          `- ${reference.label || reference.kind}: ${reference.url}`
      )
    )
  }
  return lines.join("\n")
}
