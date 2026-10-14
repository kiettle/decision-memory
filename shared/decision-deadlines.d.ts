type DecisionLike = {
  id: string
  title: string
  decisionState?: "PENDING" | "DECIDED"
  dueDate?: string | null
  outcome?: string | null
  decidedAt?: string | null
  createdAt: string
}
export type DeadlineBucket = "OVERDUE" | "DUE_SOON" | "UPCOMING" | "UNSCHEDULED" | "DECIDED"
export function calendarDay(value: unknown): number | null
export function localCalendarDate(date?: Date): string
export function headline(decision: Pick<DecisionLike, "title" | "outcome" | "decisionState">): string
export function deadlineBucket(decision: Pick<DecisionLike, "decisionState" | "dueDate">, today: string): DeadlineBucket
export function deadlineLabel(decision: Pick<DecisionLike, "decisionState" | "dueDate">, today: string): string
export function deadlineDate(value: string): string
export function compareDecisions(left: DecisionLike, right: DecisionLike, sort?: "NEWEST" | "DEADLINE"): number
