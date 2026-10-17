import { ArrowRight, Search, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field"
import { SearchableSelect } from "@/components/searchable-select"
import {
  navigationHistoryIndex,
  type DecisionNavigationState,
} from "@/lib/decision-navigation"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { comparisonHref } from "@/lib/decision-links"
import type {
  Metadata,
  MemorySearchMethod,
  ProposalAssessment,
  ProposalEvidence,
  ProposalReview,
} from "@/types"

const labels: Record<ProposalAssessment, string> = {
  POSSIBLE_MISMATCH: "Possible mismatch",
  APPEARS_CONSISTENT: "Appears consistent",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
}

export function ProposalReviewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationState = location.state as DecisionNavigationState | null
  const initial = navigationState?.proposalDraft
  const captureReturn = navigationState?.captureReturn
  const completionReturn = navigationState?.completionReturn
  function backToCompletion() {
    if (!completionReturn) return
    const currentIndex = navigationHistoryIndex()
    if (
      currentIndex !== undefined &&
      completionReturn.historyIndex !== undefined &&
      currentIndex > completionReturn.historyIndex
    ) {
      void navigate(completionReturn.historyIndex - currentIndex)
    } else {
      void navigate(completionReturn.url, {
        replace: true,
        state: {
          ...completionReturn.state,
          completionDraft: completionReturn.draft,
        },
      })
    }
  }
  const captureState: DecisionNavigationState | undefined = captureReturn
    ? {
        ...captureReturn.origin,
        captureDraft: {
          draft: captureReturn.draft,
          storageKey: captureReturn.storageKey,
        },
      }
    : undefined
  const [proposal, setProposal] = useState(() =>
    typeof initial?.proposal === "string" ? initial.proposal.slice(0, 500) : ""
  )
  const [scope, setScope] = useState(() =>
    typeof initial?.appliesTo === "string" ? initial.appliesTo : ""
  )
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
    api
      .metadata()
      .then((value) => {
        if (active) {
          setMetadata(value)
          setMetadataError("")
        }
      })
      .catch(() => {
        if (active)
          setMetadataError(
            "Could not load scopes. Local checking is still available."
          )
      })
    return () => {
      active = false
    }
  }, [metadataAttempt])
  useEffect(
    () => () => {
      revision.current++
    },
    []
  )

  useEffect(() => {
    if (navigationState?.proposalOrigin)
      formRef.current?.querySelector("textarea")?.focus()
  }, [navigationState?.proposalOrigin])

  function invalidate() {
    revision.current++
    setResult(null)
    setError("")
    setBusy(null)
  }
  function remember(nextProposal: string, nextScope: string) {
    void navigate("/check-proposal", {
      replace: true,
      state: {
        ...navigationState,
        proposalDraft: { proposal: nextProposal, appliesTo: nextScope },
      },
    })
  }
  async function check(method: MemorySearchMethod, scopeValue = scope) {
    const version = ++revision.current
    setBusy(method)
    setError("")
    try {
      const next = await api.checkProposal(proposal.trim(), scopeValue, method)
      if (revision.current === version) setResult(next)
    } catch (e) {
      if (revision.current === version)
        setError(e instanceof Error ? e.message : "Review failed. Try again.")
    } finally {
      if (revision.current === version) setBusy(null)
    }
  }
  // Clicking a suggested scope is the explicit confirmation analysis requires.
  function applySuggestedScope(next: string, method: MemorySearchMethod) {
    invalidate()
    setScope(next)
    remember(proposal, next)
    void check(method, next)
  }
  const valid = proposal.trim().length >= 3
  const canAnalyze =
    valid && Boolean(scope) && Boolean(metadata?.features.proposalAnalysis)
  const suggestion = result
    ? suggestedScope(result, metadata?.appliesTo ?? [])
    : null
  const summary = result ? retrievalHeadline(result) : null
  const draft = { proposal: proposal.trim(), appliesTo: scope }
  const origin = {
    libraryUrl: "/check-proposal",
    libraryState: {
      proposalDraft: draft,
      proposalOrigin: navigationState?.proposalOrigin,
      captureReturn,
      completionReturn,
    },
  }

  return (
    <div className="page-frame max-w-6xl">
      {completionReturn ? (
        <Button variant="ghost" className="w-fit" onClick={backToCompletion}>
          Back to completion
        </Button>
      ) : captureReturn ? (
        <Link
          className={buttonVariants({ variant: "ghost", className: "w-fit" })}
          to="/decisions/new"
          state={captureState}
          replace
        >
          Back to draft
        </Link>
      ) : navigationState?.proposalOrigin ? (
        <Link
          className={buttonVariants({ variant: "ghost", className: "w-fit" })}
          to={navigationState.proposalOrigin}
        >
          Back to scope
        </Link>
      ) : null}
      <header className="flex flex-col gap-2">
        <p className="eyebrow">Before the team decides</p>
        <h1>Check a proposed decision</h1>
        <p className="max-w-2xl text-muted-foreground">
          Recover what the team decided, why, and what changed. Review the
          evidence before repeating an old choice.
        </p>
      </header>
      {completionReturn ? (
        <p className="text-sm text-muted-foreground">
          Your original completion choice and rationale are kept. Changes here
          are for review only; return to the completion dialog to edit or record
          them.
        </p>
      ) : null}
      {captureReturn ? (
        <p className="text-sm text-muted-foreground">
          Your original draft is kept. Changes made here are for review only;
          return to the draft to edit or save it.
        </p>
      ) : null}
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault()
          void check("LOCAL")
        }}
        className="flex flex-col gap-5"
      >
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="proposal">What are you proposing?</FieldLabel>
            <Textarea
              id="proposal"
              value={proposal}
              minLength={3}
              maxLength={500}
              required
              placeholder="Keep migration backups in Postgres."
              onChange={(event) => {
                invalidate()
                setProposal(event.target.value)
                remember(event.target.value, scope)
              }}
              className="min-h-28"
              aria-invalid={Boolean(error)}
            />
            <FieldDescription>
              {proposal.length}/500 characters. Checking never saves anything.
            </FieldDescription>
            {error ? <FieldError role="alert">{error}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="proposal-scope">Applies To</FieldLabel>
            <SearchableSelect
              id="proposal-scope"
              label="Applies To"
              value={scope}
              options={[
                { label: "All scopes · local retrieval only", value: "" },
                ...(metadata?.appliesTo ?? []).map((value) => ({
                  label: value,
                  value,
                })),
              ]}
              className="h-10 w-full justify-between sm:max-w-md"
              onChange={(next) => {
                invalidate()
                setScope(next)
                remember(proposal, next)
              }}
            />
            <FieldDescription>
              Gemini analysis needs one exact scope.
            </FieldDescription>
            {metadataError ? (
              <>
                <FieldError>{metadataError}</FieldError>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={() => setMetadataAttempt((n) => n + 1)}
                >
                  Retry scopes
                </Button>
              </>
            ) : null}
          </Field>
        </FieldGroup>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!valid || Boolean(busy)}>
            <Search data-icon="inline-start" />
            {busy === "LOCAL" ? "Checking locally…" : "Check locally"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canAnalyze || Boolean(busy)}
            onClick={() => void check("GEMINI")}
          >
            <Sparkles data-icon="inline-start" />
            {busy === "GEMINI" ? "Analyzing…" : "Analyze with Gemini"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Check locally stays on this computer. Analyze with Gemini sends your
          proposal, scope and short stored excerpts to Google; use synthetic or
          sanitized data.
          {metadata && !metadata.features.proposalAnalysis
            ? " Gemini is not configured; local checking remains available."
            : ""}
        </p>
      </form>
      <Separator />
      <div
        aria-live="polite"
        aria-busy={Boolean(busy)}
        className="flex min-w-0 flex-col gap-6"
      >
        {result ? (
          <>
            {summary ? (
              <section
                aria-label="Closest recorded decision"
                className={
                  summary.replaced
                    ? "flex min-w-0 flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"
                    : "flex min-w-0 flex-col gap-1 rounded-lg border bg-muted/40 px-4 py-3"
                }
              >
                <p className="font-semibold">{summary.title}</p>
                <p className="text-sm break-words">
                  {summary.text}{" "}
                  {summary.current ? (
                    <Link
                      className="whitespace-nowrap text-primary underline"
                      to={`/decisions/${summary.current.decisionId}`}
                      state={origin}
                    >
                      Open {summary.current.decisionKey}
                    </Link>
                  ) : null}
                </p>
              </section>
            ) : null}
            {suggestion ? (
              <section
                aria-label="Suggested scope"
                className="flex min-w-0 flex-wrap items-center gap-3"
              >
                <p className="text-sm">
                  Suggested scope from the closest matches:{" "}
                  <strong>{suggestion}</strong>
                </p>
                {valid && metadata?.features.proposalAnalysis ? (
                  <Button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => applySuggestedScope(suggestion, "GEMINI")}
                  >
                    <Sparkles data-icon="inline-start" />
                    Analyze with Gemini in {suggestion}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={!valid || Boolean(busy)}
                  onClick={() => applySuggestedScope(suggestion, "LOCAL")}
                >
                  Use {suggestion}
                  {metadata?.features.proposalAnalysis ? " locally" : ""}
                </Button>
              </section>
            ) : null}
            <section
              aria-label="Review assessment"
              className="flex flex-col gap-3"
            >
              <p className="eyebrow">
                {result.analysis.status === "NOT_REQUESTED"
                  ? "Local retrieval"
                  : "Assessment"}
              </p>
              <h2>
                {result.analysis.assessment
                  ? labels[result.analysis.assessment]
                  : result.analysis.status === "UNAVAILABLE"
                    ? "Analysis unavailable"
                    : "Relevant recorded decisions"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {result.analysis.message}
              </p>
              {result.analysis.findings.map((finding, i) => (
                <article
                  key={i}
                  className="flex min-w-0 flex-col gap-3 rounded-xl border p-5"
                >
                  <Badge
                    variant={
                      finding.assessment === "POSSIBLE_MISMATCH"
                        ? "superseded"
                        : "secondary"
                    }
                  >
                    {labels[finding.assessment]}
                  </Badge>
                  <p className="break-words whitespace-pre-wrap">
                    {finding.explanation}
                  </p>
                  {finding.citations.map((citation, j) => {
                    const record = result.evidence.find((d) =>
                      d.excerpts.some((e) => e.id === citation.evidenceId)
                    )
                    const excerpt = record?.excerpts.find(
                      (e) => e.id === citation.evidenceId
                    )
                    return record ? (
                      <blockquote key={j} className="border-l-2 pl-4 text-sm">
                        <p className="break-words whitespace-pre-wrap">
                          “{citation.quote}”
                        </p>
                        <Link
                          className="text-primary underline"
                          to={`/decisions/${record.decisionId}`}
                          state={origin}
                        >
                          {record.decisionKey} · {excerpt?.label}
                        </Link>
                      </blockquote>
                    ) : null
                  })}
                </article>
              ))}
            </section>
            <section
              aria-label="Stored evidence"
              className="flex min-w-0 flex-col gap-4"
            >
              <h2>Stored evidence</h2>
              <p className="text-sm text-muted-foreground">
                Searched {result.coverage.indexed} of {result.coverage.total}{" "}
                decisions; showing {result.coverage.retrieved} plus current
                replacements.
                {result.coverage.indexed < result.coverage.total
                  ? " Some decisions are waiting for indexing; retry shortly or use keyword search."
                  : " Search can miss decisions."}
                {result.coverage.omittedSuccessors
                  ? ` ${result.coverage.omittedSuccessors} additional successors are omitted; open the decision for its full lifecycle.`
                  : ""}
                {result.coverage.excerpted
                  ? " Excerpts are shortened; open a record for full context."
                  : ""}
              </p>
              {result.evidence.length ? (
                result.evidence.map((record) => (
                  <Evidence
                    key={record.decisionId}
                    record={record}
                    origin={origin}
                  />
                ))
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No relevant recorded evidence found</EmptyTitle>
                    <EmptyDescription>
                      This is not approval. Try another description, select
                      another scope, or use keyword search.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </section>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  formRef.current?.querySelector("textarea")?.focus()
                }
              >
                Revise proposal
              </Button>
              {completionReturn ? (
                <Button onClick={backToCompletion}>
                  Return to completion <ArrowRight data-icon="inline-end" />
                </Button>
              ) : (
                <Link
                  className={buttonVariants()}
                  to="/decisions/new"
                  state={
                    captureReturn
                      ? captureState
                      : { ...origin, proposalDraft: draft }
                  }
                  replace={Boolean(captureReturn)}
                >
                  {captureReturn ? "Return to draft" : "Record this choice"}{" "}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {completionReturn
                ? "Return to the completion dialog to edit or record your original choice."
                : captureReturn
                  ? "Return to your original draft to edit or save it."
                  : "Recording opens an editable form; nothing is saved until you choose."}
            </p>
          </>
        ) : !busy ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Find the precedent before committing</EmptyTitle>
              <EmptyDescription>
                Check locally to see recorded choices and what replaced them.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <p>Retrieving stored evidence…</p>
        )}
      </div>
    </div>
  )
}

// Describes retrieval order only; assessments come from the separate analysis.
function retrievalHeadline(result: ProposalReview) {
  const closest = result.evidence.find((record) => record.role === "MATCH")
  if (!closest) return null
  const quoted = (record: ProposalEvidence) =>
    `${record.decisionKey} “${record.title}”`
  if (closest.status !== "SUPERSEDED")
    return {
      replaced: false,
      title: "Closest recorded decision",
      text: `${quoted(closest)} is the current choice.`,
      current: closest,
    }
  const current = closest.currentIds
    .map((id) => result.evidence.find((record) => record.decisionId === id))
    .find((record) => record !== undefined)
  return {
    replaced: true,
    title: "A similar choice was replaced",
    text: current
      ? `${quoted(closest)} was replaced by ${quoted(current)}, which is current.`
      : `${quoted(closest)} was replaced. Open it to see its current replacement.`,
    current: current ?? closest,
  }
}

// Ranked scope vote over the retrieved matches; only offered for an all-scope check.
function suggestedScope(result: ProposalReview, knownScopes: string[]) {
  if (result.appliesTo) return null
  const matches = result.evidence.filter((record) => record.role === "MATCH")
  const weights = new Map<string, number>()
  matches.forEach((record, index) => {
    for (const scope of record.appliesTo) {
      if (!knownScopes.includes(scope)) continue
      weights.set(scope, (weights.get(scope) ?? 0) + matches.length - index)
    }
  })
  let best: string | null = null
  let bestWeight = 0
  for (const [scope, weight] of weights) {
    if (weight > bestWeight) {
      best = scope
      bestWeight = weight
    }
  }
  return best
}

function Evidence({
  record,
  origin,
}: {
  record: ProposalEvidence
  origin: {
    libraryUrl: string
    libraryState: { proposalDraft: { proposal: string; appliesTo: string } }
  }
}) {
  return (
    <article
      aria-label={record.decisionKey}
      className="flex min-w-0 flex-col gap-3 rounded-xl border p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={record.status === "SUPERSEDED" ? "superseded" : "decided"}
        >
          {record.status === "SUPERSEDED"
            ? "Historical · superseded"
            : "Current choice"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {record.decisionKey}
          {record.role === "CURRENT_SUCCESSOR" ? " · Current successor" : ""}
        </span>
      </div>
      <Link
        to={`/decisions/${record.decisionId}`}
        state={origin}
        className="font-semibold text-primary underline"
      >
        {record.title}
      </Link>
      <p className="text-sm break-words">
        Applies to: {record.appliesTo.join(" · ") || "Not recorded"}
        {!record.inScope ? " · Scope not confirmed for this proposal" : ""}
      </p>
      {record.excerpts
        .filter((e) => e.field === "why")
        .map((e) => (
          <p key={e.id} className="text-sm break-words whitespace-pre-wrap">
            <strong>Why: </strong>
            {e.text}
          </p>
        ))}
      {record.currentIds.map((id) => (
        <Link
          key={id}
          to={`/decisions/${id}`}
          state={origin}
          className="text-sm text-primary underline"
        >
          Open current replacement
        </Link>
      ))}
      {record.replacements.map((r) => (
        <div key={r.decisionId} className="flex flex-col gap-2 text-sm">
          <p className="break-words whitespace-pre-wrap">
            <strong>Why {r.decisionKey} changed: </strong>
            {r.reason || "No replacement reason recorded."}
          </p>
          <Link
            className="text-primary underline"
            to={comparisonHref(r.decisionId, record.decisionId)}
            state={{
              returnUrl: origin.libraryUrl,
              returnState: origin.libraryState,
            }}
          >
            Compare before and after
          </Link>
        </div>
      ))}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Inspect stored excerpts ({record.excerpts.length})
        </summary>
        <dl className="mt-3 flex flex-col gap-3">
          {record.excerpts.map((e) => (
            <div key={e.id}>
              <dt className="text-sm font-medium">{e.label}</dt>
              <dd className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
                {e.text}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </article>
  )
}
