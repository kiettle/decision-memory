import { Badge } from "@/components/ui/badge"
import type { DecisionStatus } from "@/types"

export function StatusBadge({ status }: { status: DecisionStatus }) {
  return (
    <Badge
      variant="secondary"
      className={
        status === "ACTIVE"
          ? "border-0 bg-emerald-100 text-emerald-800"
          : "border-0 bg-amber-100 text-amber-800"
      }
    >
      <span
        aria-hidden="true"
        className={
          status === "ACTIVE"
            ? "size-2 rounded-full bg-emerald-600"
            : "size-2 rounded-full bg-amber-600"
        }
      />
      {status === "ACTIVE" ? "ACTIVE" : "SUPERSEDED"}
    </Badge>
  )
}
