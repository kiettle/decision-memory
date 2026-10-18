// Calendar dates stay dates: never parse YYYY-MM-DD as a viewer-local instant.
export function calendarDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  if (year < 1) return null
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.getTime() / 86_400_000
}

export function localCalendarDate(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// Add calendar days, not elapsed local hours (which vary across DST changes).
export function localCalendarDateAfter(days, date = new Date()) {
  return new Date((calendarDay(localCalendarDate(date)) + days) * 86_400_000)
    .toISOString().slice(0, 10)
}

export function headline(decision) {
  return decision.decisionState === "PENDING" ? decision.title : decision.outcome || decision.title
}

export function deadlineBucket(decision, today) {
  if (decision.decisionState !== "PENDING") return "DECIDED"
  if (!decision.dueDate) return "UNSCHEDULED"
  const delta = calendarDay(decision.dueDate) - calendarDay(today)
  return delta < 0 ? "OVERDUE" : delta <= 7 ? "DUE_SOON" : "UPCOMING"
}

export function deadlineLabel(decision, today) {
  if (!decision.dueDate) return "No deadline"
  if (decision.decisionState !== "PENDING") return "Original deadline"
  const delta = calendarDay(decision.dueDate) - calendarDay(today)
  if (delta < 0) return `${-delta} day${delta === -1 ? "" : "s"} overdue`
  if (delta === 0) return "Due today"
  return `Due in ${delta} day${delta === 1 ? "" : "s"}`
}

export function deadlineDate(value) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(calendarDay(value) * 86_400_000))
}

export function compareDecisions(left, right, sort = "NEWEST") {
  const newest = (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
  if (sort === "NEWEST") return newest(left, right)
  const leftPending = left.decisionState === "PENDING"
  const rightPending = right.decisionState === "PENDING"
  if (leftPending !== rightPending) return leftPending ? -1 : 1
  if (!leftPending) return (right.decidedAt || right.createdAt).localeCompare(left.decidedAt || left.createdAt) || newest(left, right)
  if (Boolean(left.dueDate) !== Boolean(right.dueDate)) return left.dueDate ? -1 : 1
  return (left.dueDate || "").localeCompare(right.dueDate || "") || newest(left, right)
}
