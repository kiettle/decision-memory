import { ArrowDown, ArrowRight } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

export type LineageItem = {
  id: string
  decisionKey: string
  title: string
  date?: string | null
}

// The earlier choice, the choice that replaced it, and why. The current choice
// carries the one data hue; the earlier one stays in grey.
export function DecisionLineage({
  earlier,
  current,
  reason,
  selfId,
  state,
  actions,
  currentIsActive = true,
}: {
  earlier: LineageItem
  current: LineageItem
  reason?: string | null
  selfId?: string
  state?: unknown
  actions?: ReactNode
  // False when the replacement was itself replaced later.
  currentIsActive?: boolean
}) {
  return (
    <div className="decision-lineage">
      <div className="lineage-steps">
        <LineageStep item={earlier} label="Replaced" selfId={selfId} state={state} />
        <span className="lineage-arrow" aria-hidden="true">
          <ArrowRight className="max-sm:hidden" />
          <ArrowDown className="sm:hidden" />
        </span>
        <LineageStep item={current} label={currentIsActive ? "Current" : "Later replaced"} selfId={selfId} state={state} current={currentIsActive} />
      </div>
      <div className="lineage-reason">
        <span>Why it changed</span>
        <p>{reason || "No replacement reason was recorded."}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

function LineageStep({
  item,
  label,
  current = false,
  selfId,
  state,
}: {
  item: LineageItem
  label: string
  current?: boolean
  selfId?: string
  state?: unknown
}) {
  return (
    <div className={current ? "lineage-step is-current" : "lineage-step"}>
      <span className="lineage-meta">
        {item.decisionKey} · {label}
        {item.date ? ` · ${item.date}` : ""}
      </span>
      {item.id === selfId ? (
        <span className="lineage-title" aria-current="page">{item.title}</span>
      ) : (
        <Link className="lineage-title hover:underline" to={`/decisions/${item.id}`} state={state}>
          {item.title}
        </Link>
      )}
    </div>
  )
}
