import { ArrowRight, Search, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { comparisonHref } from "@/lib/decision-links"
import type { Metadata, MemorySearchMethod, ProposalAssessment, ProposalEvidence, ProposalReview } from "@/types"

const labels: Record<ProposalAssessment, string> = {
  POSSIBLE_MISMATCH: "Possible mismatch", APPEARS_CONSISTENT: "Appears consistent", INSUFFICIENT_EVIDENCE: "Insufficient evidence",
}

export function ProposalReviewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const initial = location.state?.proposalDraft
  const [proposal, setProposal] = useState(() => typeof initial?.proposal === "string" ? initial.proposal.slice(0, 500) : "")
  const [scope, setScope] = useState(() => typeof initial?.appliesTo === "string" ? initial.appliesTo : "")
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [metadataError, setMetadataError] = useState("")
  const [metadataAttempt, setMetadataAttempt] = useState(0)
  const [result, setResult] = useState<ProposalReview | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<MemorySearchMethod | null>(null)
  const revision = useRef(0)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    let active = true
    api.metadata().then(value => { if (active) { setMetadata(value); setMetadataError("") } })
      .catch(() => { if (active) setMetadataError("Could not load scopes. Local checking is still available.") })
    return () => { active = false }
  }, [metadataAttempt])
  useEffect(() => () => { revision.current++ }, [])

  function invalidate() { revision.current++; setResult(null); setError(""); setBusy(null) }
  function remember(nextProposal: string, nextScope: string) {
    void navigate("/check-proposal", { replace: true, state: { proposalDraft: { proposal: nextProposal, appliesTo: nextScope } } })
  }
  async function check(method: MemorySearchMethod) {
    const version = ++revision.current
    setBusy(method); setError("")
    try {
      const next = await api.checkProposal(proposal.trim(), scope, method)
      if (revision.current === version) setResult(next)
    } catch (e) {
      if (revision.current === version) setError(e instanceof Error ? e.message : "Review failed. Try again.")
    } finally { if (revision.current === version) setBusy(null) }
  }
  const valid = proposal.trim().length >= 3
  const canAnalyze = valid && Boolean(scope) && Boolean(metadata?.features.proposalAnalysis)
  const draft = { proposal: proposal.trim(), appliesTo: scope }
  const origin = { libraryUrl: "/check-proposal", libraryState: { proposalDraft: draft } }

  return <div className="page-frame max-w-6xl">
    <header className="flex flex-col gap-2">
      <p className="eyebrow">Before the team decides</p>
      <h1>Check a proposed decision</h1>
      <p className="max-w-2xl text-muted-foreground">Recover what the team decided, why, and what changed. Review the evidence before repeating an old choice.</p>
    </header>
    <form ref={formRef} onSubmit={event => { event.preventDefault(); void check("LOCAL") }} className="flex flex-col gap-5">
      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="proposal">What are you proposing?</FieldLabel>
          <Textarea id="proposal" value={proposal} minLength={3} maxLength={500} required
            placeholder="Keep migration backups in Postgres."
            onChange={event => { invalidate(); setProposal(event.target.value); remember(event.target.value, scope) }} className="min-h-28" aria-invalid={Boolean(error)} />
          <FieldDescription>{proposal.length}/500 characters. Start with a short proposal; nothing is saved by checking.</FieldDescription>
          {error ? <FieldError role="alert">{error}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="proposal-scope">Applies To</FieldLabel>
          <Select value={scope || "__all__"} onValueChange={value => { const next = value === "__all__" ? "" : value ?? ""; invalidate(); setScope(next); remember(proposal, next) }}>
            <SelectTrigger id="proposal-scope" className="w-full sm:max-w-md"><SelectValue>{scope || "All scopes · local retrieval only"}</SelectValue></SelectTrigger>
            <SelectContent><SelectGroup>
              <SelectItem value="__all__">All scopes · local retrieval only</SelectItem>
              {metadata?.appliesTo.map(value => <SelectItem value={value} key={value}>{value}</SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>
          <FieldDescription>Confirm the exact service or project before requesting an AI assessment.</FieldDescription>
          {metadataError ? <><FieldError>{metadataError}</FieldError><Button type="button" variant="outline" className="w-fit" onClick={() => setMetadataAttempt(n => n + 1)}>Retry scopes</Button></> : null}
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!valid || Boolean(busy)}><Search data-icon="inline-start" />{busy === "LOCAL" ? "Checking locally…" : "Check locally"}</Button>
        <Button type="button" variant="outline" disabled={!canAnalyze || Boolean(busy)} onClick={() => void check("GEMINI")}><Sparkles data-icon="inline-start" />{busy === "GEMINI" ? "Analyzing…" : "Analyze with Gemini"}</Button>
      </div>
      <p className="text-sm text-muted-foreground">Local checking stays on this computer. Analyze with Gemini sends your proposal, selected scope, and bounded stored excerpts to Google. Use synthetic or sanitized data.
        {metadata && !metadata.features.proposalAnalysis ? " Gemini is not configured; local checking remains available." : ""}</p>
    </form>
    <Separator />
    <div aria-live="polite" aria-busy={Boolean(busy)} className="flex min-w-0 flex-col gap-6">
      {result ? <>
        <section aria-label="Review assessment" className="flex flex-col gap-3">
          <p className="eyebrow">{result.analysis.status === "NOT_REQUESTED" ? "Local retrieval" : "Assessment"}</p>
          <h2>{result.analysis.assessment ? labels[result.analysis.assessment] : result.analysis.status === "UNAVAILABLE" ? "Analysis unavailable" : "Relevant recorded decisions"}</h2>
          <p className="text-sm text-muted-foreground">{result.analysis.message}</p>
          {result.analysis.findings.map((finding, i) => <article key={i} className="flex min-w-0 flex-col gap-3 rounded-xl border p-5">
            <Badge variant={finding.assessment === "POSSIBLE_MISMATCH" ? "superseded" : "secondary"}>{labels[finding.assessment]}</Badge>
            <p className="whitespace-pre-wrap break-words">{finding.explanation}</p>
            {finding.citations.map((citation, j) => {
              const record = result.evidence.find(d => d.excerpts.some(e => e.id === citation.evidenceId))
              const excerpt = record?.excerpts.find(e => e.id === citation.evidenceId)
              return record ? <blockquote key={j} className="border-l-2 pl-4 text-sm">
                <p className="whitespace-pre-wrap break-words">“{citation.quote}”</p>
                <Link className="text-primary underline" to={`/decisions/${record.decisionId}`} state={origin}>{record.decisionKey} · {excerpt?.label}</Link>
              </blockquote> : null
            })}
          </article>)}
        </section>
        <section aria-label="Stored evidence" className="flex min-w-0 flex-col gap-4">
          <h2>Stored evidence</h2>
          <p className="text-sm text-muted-foreground">{result.coverage.indexed} of {result.coverage.total} matching decisions indexed · {result.coverage.retrieved} retrieved, plus current replacements.
            {result.coverage.indexed < result.coverage.total ? " Some decisions are waiting for indexing; retry shortly or use keyword search." : " Retrieval is approximate and can miss relevant decisions."}
            {result.coverage.omittedSuccessors ? ` ${result.coverage.omittedSuccessors} additional successors are omitted; open the decision for its full lifecycle.` : ""}
            {result.coverage.excerpted ? " Excerpts are shortened; open the record for full context." : ""}</p>
          {result.evidence.length ? result.evidence.map(record => <Evidence key={record.decisionId} record={record} origin={origin} />) :
            <Empty><EmptyHeader><EmptyTitle>No relevant recorded evidence found</EmptyTitle><EmptyDescription>This is not approval. Try another description, select another scope, or use keyword search.</EmptyDescription></EmptyHeader></Empty>}
        </section>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => formRef.current?.querySelector("textarea")?.focus()}>Revise proposal</Button>
          <Link className={buttonVariants()} to="/decisions/new" state={{ ...origin, proposalDraft: draft }}>Record this choice <ArrowRight data-icon="inline-end" /></Link>
        </div>
        <p className="text-sm text-muted-foreground">Recording opens an editable form. You decide what to save; analysis never replaces a decision automatically.</p>
      </> : !busy ? <Empty><EmptyHeader><EmptyTitle>Find the precedent before committing</EmptyTitle><EmptyDescription>Check locally to see recorded choices and their replacements. Similarity alone does not establish agreement or contradiction.</EmptyDescription></EmptyHeader></Empty> : <p>Retrieving stored evidence…</p>}
    </div>
  </div>
}

function Evidence({ record, origin }: { record: ProposalEvidence; origin: { libraryUrl: string; libraryState: { proposalDraft: { proposal: string; appliesTo: string } } } }) {
  return <article aria-label={record.decisionKey} className="flex min-w-0 flex-col gap-3 rounded-xl border p-5">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={record.status === "SUPERSEDED" ? "superseded" : "decided"}>{record.status === "SUPERSEDED" ? "Historical · superseded" : "Current choice"}</Badge>
      <span className="text-sm text-muted-foreground">{record.decisionKey}{record.role === "CURRENT_SUCCESSOR" ? " · Current successor" : ""}</span>
    </div>
    <Link to={`/decisions/${record.decisionId}`} state={origin} className="font-semibold text-primary underline">{record.title}</Link>
    <p className="text-sm break-words">Applies to: {record.appliesTo.join(" · ") || "Not recorded"}{!record.inScope ? " · Scope not confirmed for this proposal" : ""}</p>
    {record.excerpts.filter(e => e.field === "why").map(e => <p key={e.id} className="text-sm whitespace-pre-wrap break-words"><strong>Why: </strong>{e.text}</p>)}
    {record.currentIds.map(id => <Link key={id} to={`/decisions/${id}`} state={origin} className="text-sm text-primary underline">Open current replacement</Link>)}
    {record.replacements.map(r => <div key={r.decisionId} className="flex flex-col gap-2 text-sm">
      <p className="whitespace-pre-wrap break-words"><strong>Why {r.decisionKey} changed: </strong>{r.reason || "No replacement reason recorded."}</p>
      <Link className="text-primary underline" to={comparisonHref(r.decisionId, record.decisionId)} state={{ returnUrl: origin.libraryUrl, returnState: origin.libraryState }}>Compare before and after</Link>
    </div>)}
    <details><summary className="cursor-pointer text-sm font-medium">Inspect stored excerpts ({record.excerpts.length})</summary>
      <dl className="mt-3 flex flex-col gap-3">{record.excerpts.map(e => <div key={e.id}><dt className="text-sm font-medium">{e.label}</dt><dd className="text-sm whitespace-pre-wrap break-words text-muted-foreground">{e.text}</dd></div>)}</dl>
    </details>
  </article>
}
