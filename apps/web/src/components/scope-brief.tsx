import { ArrowUpRight, FileText } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { scopeHref } from "@/lib/decision-links"
import { headline } from "../../../../shared/decision-deadlines.js"
import type { ScopeOverview } from "@/types"

export function ScopeBrief({ overview }: { overview: ScopeOverview }) {
  const important = overview.activeDecisions.filter(decision => decision.handoverImportant)
  return (
    <section aria-label="Project brief" className="scope-brief">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Project brief</h2>
          <Badge variant="secondary">{important.length} important {important.length === 1 ? "choice" : "choices"}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">Selected by linked owners.</p>
          {overview.openCount > 0 ? <Link className="underline underline-offset-4" to={scopeHref(overview.scope, "PENDING")}>{overview.openCount} open {overview.openCount === 1 ? "question" : "questions"}</Link> : <span className="text-muted-foreground">No open questions</span>}
        </div>
      </header>
      {important.length ? important.map(decision => (
        <article key={decision.id} id={`brief-${decision.id}`} tabIndex={-1} className="brief-choice scroll-mt-20">
          <div className="grid gap-2">
            <span className="decision-key">{decision.decisionKey}</span>
            <h3 className="text-base font-semibold leading-6"><Link aria-label={`${decision.decisionKey} · ${headline(decision)}`} className="hover:text-primary hover:underline" to={`/decisions/${decision.id}`}>{headline(decision)}</Link></h3>
            <p className="text-sm leading-6 whitespace-pre-wrap"><strong>Why: </strong>{decision.why || "No rationale was recorded."}</p>
            <p className="text-sm text-muted-foreground">Exact scope: {decision.appliesTo.join(", ") || "Not recorded"}</p>
          </div>
          <dl className="brief-owner">
            <div><dt>Owner</dt><dd>{decision.owner?.displayName ?? decision.ownerName ?? "Unassigned"}</dd></div>
            <div><dt>Contact context</dt><dd>{decision.ownerContact || "Not recorded"}</dd></div>
          </dl>
          {decision.lifecycle?.supersedes.map(previous => <p key={previous.id} className="text-sm leading-6"><Link className="underline underline-offset-4" to={`/decisions/${previous.id}`}>Replaces {previous.decisionKey}</Link> · {previous.replacementReason || "No replacement reason recorded."}</p>)}
          <details className="brief-evidence">
            <summary><FileText aria-hidden="true" className="size-4 shrink-0" /><span>Evidence and history <span className="text-muted-foreground">· {decision.evidenceCount} captured {decision.evidenceCount === 1 ? "source" : "sources"} · {decision.references?.length ?? 0} related {(decision.references?.length ?? 0) === 1 ? "link" : "links"}</span></span></summary>
            <div className="grid gap-3 pb-3 text-sm leading-6">
              {(decision.sources ?? []).map(source => <blockquote key={source.id} className="border-l-2 pl-3 whitespace-pre-wrap"><span className="block font-medium">{source.provider === "PASTED_NOTES" ? `Pasted notes · ${source.sourceContext?.origin ?? "Supplied label"}` : source.provider}</span><p>{source.anchorText?.slice(0, 500) || source.messages?.find(message => message.anchor)?.text.slice(0, 500) || "No source excerpt recorded."}</p></blockquote>)}
              {!decision.sources?.length && !decision.references?.length ? <p>Supporting evidence is missing.</p> : null}
              {(decision.references ?? []).map(reference => <a key={reference.id} className="w-fit underline underline-offset-4" href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a>)}
              <Link className="w-fit underline underline-offset-4" to={`/decisions/${decision.id}`}>Inspect supporting evidence and replacement history ({decision.evidenceCount} captured sources)</Link>
            </div>
          </details>
        </article>
      )) : <p className="text-sm text-muted-foreground">No important choices selected yet. A linked decision owner can mark a current choice from its detail page.</p>}
      <div className="grid gap-3">
        <div className="flex items-center gap-3"><h3 className="font-semibold">Open questions</h3><Badge variant="secondary">{overview.openCount}</Badge></div>
        {overview.openQuestions.length ? <div className="divide-y">{overview.openQuestions.map(question => <article key={question.id} className="brief-question">
          <Link aria-label={`${question.decisionKey} · ${question.title}`} className="flex items-start justify-between gap-3 font-medium hover:text-primary" to={`/decisions/${question.id}`}><span>{question.title}</span><ArrowUpRight aria-hidden="true" className="mt-1 size-4 shrink-0" /></Link>
          <p className="text-sm text-muted-foreground">{question.decisionKey} · Not yet decided · {question.owner?.displayName ?? question.ownerName ?? "Unassigned"}{!question.owner && question.ownerName ? " (recorded name)" : ""}</p>
          {question.ownerContact ? <p className="text-sm">Contact context: {question.ownerContact}</p> : null}
        </article>)}</div> : <p className="text-sm text-muted-foreground">No pending questions in this scope.</p>}
      </div>
    </section>
  )
}
