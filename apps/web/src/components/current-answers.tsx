import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import type { Decision } from "@/types"
import { headline } from "../../../../shared/decision-deadlines.js"

export function CurrentAnswers({ ids, scope }: { ids: string[]; scope?: string }) {
  return <AnswerContent key={JSON.stringify([ids.slice(0, 5), scope])} ids={ids} scope={scope} />
}

function AnswerContent({ ids, scope }: { ids: string[]; scope?: string }) {
  const location = useLocation()
  const origin = { libraryUrl: location.pathname + location.search, libraryState: location.state }
  const key = JSON.stringify(ids.slice(0, 5))
  const [data, setData] = useState<{ decisions: Decision[]; omittedSuccessors: number } | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!expanded) return
    let active = true
    api.answerContext(JSON.parse(key), scope).then(result => { if (active) { setData(result); setError("") } }).catch(() => { if (active) setError("Could not load current answer evidence. Search results remain available.") })
    return () => { active = false }
  }, [key, scope, retry, expanded])
  const current = data?.decisions.filter(d => d.status === "ACTIVE" && d.decisionState === "DECIDED" && (!scope || d.appliesTo.includes(scope))) ?? []
  return <details className="current-answers" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer font-semibold">Current answer candidates and evidence</summary>
    {expanded ? <div className="mt-3 grid gap-3 text-sm">
      <p>{scope ? `Exact selected scope: ${scope}.` : "Scope is ambiguous: choose Applies To to narrow your work."} Recorded status and scope do not establish that a choice answers this query.</p>
      {error ? <p role="alert">{error} <Button variant="outline" size="sm" onClick={() => setRetry(n => n + 1)}>Retry evidence</Button></p> : !data ? <p role="status">Loading recorded evidence…</p> : <>
        {current.length > 1 ? <p role="status">Multiple current records may disagree. Compare their exact scope and evidence or check your proposal; ranking does not resolve a conflict.</p> : !current.length ? <p>No confirmed current choice in this selection. No result is not approval. Clarify scope or record an unanswered question.</p> : null}
        <p className="text-muted-foreground">Evidence for up to the first five search records and their current replacements. {data.omittedSuccessors ? `${data.omittedSuccessors} replacement records omitted; open the history.` : ""}</p>
        {data.decisions.map(decision => <article key={decision.id} className="grid gap-2 border-b pb-3 break-words">
          <div><Badge variant="outline">{decision.decisionState === "PENDING" ? "Pending question · not evidence" : decision.status === "SUPERSEDED" ? "Historical choice" : "Current recorded choice"}</Badge>{scope && !decision.appliesTo.includes(scope) ? " · Outside selected scope" : ""}</div>
          <Link className="font-semibold underline" to={`/decisions/${decision.id}`} state={origin}>{decision.decisionKey} · {headline(decision)}</Link>
          <p>Applies exactly to: {decision.appliesTo.join(", ") || "No scope recorded; applicability is uncertain."}</p>
          <p className="whitespace-pre-wrap">Why: {decision.why || "No rationale recorded; ask the owner."}</p>
          <p>Owner: {decision.owner?.displayName ?? decision.ownerName ?? "Unassigned"}</p>
          {decision.decisionState !== "PENDING" ? <>
            {(decision.sources ?? []).map(source => <blockquote key={source.id} className="border-l-2 pl-3 whitespace-pre-wrap text-muted-foreground">{source.provider === "PASTED_NOTES" ? `Pasted notes · ${source.sourceContext?.origin ?? "Supplied label"}` : source.provider} · {source.anchorText?.slice(0, 500) || source.messages?.find(m => m.anchor)?.text.slice(0, 500) || "Open the record to inspect captured evidence."}</blockquote>)}
            {!decision.sources?.length && !decision.references?.length ? <p>Supporting evidence is missing. Confirm with the owner.</p> : null}
            <Link className="underline" to={`/decisions/${decision.id}`} state={origin}>Inspect full evidence and references ({decision.references?.length ?? 0})</Link>
          </> : null}
          {decision.status === "SUPERSEDED" ? <p>Current replacements: {decision.lifecycle?.current?.length ? decision.lifecycle.current.map(item => <Link key={item.id} className="mr-2 underline" to={`/decisions/${item.id}`} state={origin}>{item.decisionKey} · {headline(item)}</Link>) : "No current replacement found; inspect history."}</p> : null}
        </article>)}
      </>}
    </div> : null}
  </details>
}
