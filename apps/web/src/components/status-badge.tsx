import { Badge } from "@/components/ui/badge"
import type { DecisionState, DecisionStatus } from "@/types"

export function StatusBadge({ status, decisionState }: { status: DecisionStatus; decisionState?: DecisionState }) {
  const pending = decisionState === "PENDING"
  return (
    <Badge
      variant={pending ? "pending" : status === "ACTIVE" ? "decided" : "superseded"}
    >
      <span
        aria-hidden="true"
        className="state-dot"
      />
      {pending ? "Pending" : status === "ACTIVE" ? "Decided" : "Superseded"}
    </Badge>
  )
}
