import { deadlineBucket, deadlineDate, deadlineLabel } from "../../../../shared/decision-deadlines.js"
import { cn } from "@/lib/utils"
import type { Decision } from "@/types"

export function DecisionDeadline({ decision, today }: { decision: Decision; today: string }) {
  return <div className={cn("decision-deadline", deadlineBucket(decision, today) === "OVERDUE" && "is-overdue", deadlineBucket(decision, today) === "DUE_SOON" && "is-soon")}>
    <span>{deadlineLabel(decision, today)}</span>
    {decision.dueDate ? <time dateTime={decision.dueDate}>{deadlineDate(decision.dueDate)}</time> : null}
  </div>
}
