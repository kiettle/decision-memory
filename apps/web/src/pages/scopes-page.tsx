import { ArrowLeft, ArrowRight, Box, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import type { DecisionNavigationState } from "@/lib/decision-navigation"

import { headline } from "../../../../shared/decision-deadlines.js"
import { StatusBadge } from "@/components/status-badge"
import { FollowButton } from "@/components/follow-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { comparisonHref, recordedDate, scopeHref } from "@/lib/decision-links"
import type { ScopeOverview, ScopeSummary } from "@/types"

export function ScopesPage() {
  const [params] = useSearchParams()
  const scope = params.get("scope")
  return scope ? <ScopeDetail key={scope} scope={scope} /> : <ScopeDirectory />
}

function ScopeDirectory() {
  const [rows, setRows] = useState<ScopeSummary[]>([])
  const [query, setQuery] = useState("")
  const [withPending, setWithPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    void api
      .scopes()
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load scopes."
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])
  const filtered = rows.filter((row) =>
    row.scope.toLowerCase().includes(query.toLowerCase().trim()) &&
    (!withPending || row.openCount > 0)
  )
  return (
    <div className="page-frame">
      <div>
        <p className="eyebrow">Understand a service before your next change</p>
        <h1>Scope overviews</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Explore current choices, pending questions, and how decisions evolved for
          each service, feature, or component.
        </p>
      </div>
      <InputGroup>
        <InputGroupInput
          aria-label="Find a scope"
          placeholder="Find a service, feature, or component…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>
      <Button
        type="button"
        variant={withPending ? "secondary" : "outline"}
        className="w-fit"
        aria-pressed={withPending}
        onClick={() => setWithPending((value) => !value)}
      >
        With pending questions
      </Button>
      {loading ? (
        <Skeleton className="h-60 w-full" />
      ) : error ? (
        <Empty className="border-y">
          <EmptyHeader>
            <EmptyTitle>Could not load scopes</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true)
              setError("")
              setRetry((value) => value + 1)
            }}
          >
            Try again
          </Button>
        </Empty>
      ) : filtered.length ? (
        <div className="divide-y border-y">
          {filtered.map((row) => (
            <div
              key={row.scope}
              className="flex items-start gap-4 py-6"
            >
              <Box className="size-5 shrink-0 text-primary" />
              <div className="grid min-w-0 flex-1 gap-2">
                <h2 className="font-semibold break-words">
                  <Link to={scopeHref(row.scope)} className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">
                    {row.scope}
                  </Link>
                </h2>
                <p className="text-sm text-muted-foreground">
                  {row.activeCount} active ·{" "}
                  {row.decisionCount - row.activeCount} superseded
                  {row.latestDecisionAt
                    ? ` · Latest recorded ${recordedDate(row.latestDecisionAt)}`
                    : ""}
                </p>
                {row.openCount > 0 ? (
                  <Link
                    to={scopeHref(row.scope, "PENDING")}
                    aria-label={`Pending questions (${row.openCount}) in ${row.scope}`}
                    className="w-fit rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    Pending questions ({row.openCount})
                  </Link>
                ) : null}
              </div>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </div>
          ))}
        </div>
      ) : (
        <Empty className="border-y">
          <EmptyHeader>
            <EmptyTitle>
              {!rows.length
                ? "No scopes recorded yet"
                : withPending
                  ? "No scopes with pending questions match these controls"
                  : "No scopes match your search"}
            </EmptyTitle>
            <EmptyDescription>
              {!rows.length
                ? "Use Applies To when recording a Decision to make it part of a service or feature overview."
                : withPending
                  ? "Try another scope name or include scopes without pending questions."
                  : "Try a different scope name."}
            </EmptyDescription>
          </EmptyHeader>
          {rows.length && withPending ? (
            <Button type="button" variant="outline" onClick={() => setWithPending(false)}>
              Show scopes without pending questions
            </Button>
          ) : null}
          {rows.length && query ? (
            <Button type="button" variant="outline" onClick={() => setQuery("")}>
              Clear scope name search
            </Button>
          ) : null}
          <Button
            variant="outline"
            render={<Link to="/decisions/new" />}
            nativeButton={false}
          >
            New Decision
          </Button>
        </Empty>
      )}
    </div>
  )
}

function ScopeDetail({ scope }: { scope: string }) {
  const [overview, setOverview] = useState<ScopeOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    void api
      .scopeOverview(scope)
      .then((data) => {
        if (active) setOverview(data)
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load this scope."
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [scope, retry])
  const libraryUrl = `/?${new URLSearchParams({ appliesTo: scope })}`
  return (
    <div className="page-frame max-w-[1240px]">
      <Button
        className="w-fit"
        variant="ghost"
        render={<Link to="/scopes" />}
        nativeButton={false}
      >
        <ArrowLeft data-icon="inline-start" /> All scopes
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Scope overview</p>
          <h1 className="break-words">{scope}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            What applies today, why it was chosen, and what changed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {overview ? (
            <>
              <FollowButton kind="SCOPE" target={scope} />
              <Button
                render={
                  <Link
                    to="/check-proposal"
                    state={
                      {
                        proposalDraft: { proposal: "", appliesTo: scope },
                        proposalOrigin: scopeHref(scope),
                      } satisfies DecisionNavigationState
                    }
                  />
                }
                nativeButton={false}
              >
                Check a proposal in this scope
              </Button>
              <Button
                variant="outline"
                render={
                  <Link
                    to="/decisions/new"
                    state={
                      {
                        scopePrefill: scope,
                        libraryUrl: scopeHref(scope),
                      } satisfies DecisionNavigationState
                    }
                  />
                }
                nativeButton={false}
              >
                New decision in this scope
              </Button>
            </>
          ) : null}
          <Button
            variant="outline"
            render={<Link to={libraryUrl} />}
            nativeButton={false}
          >
            Browse all decisions <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-80 w-full" />
      ) : !overview ? (
        <Empty className="border-y">
          <EmptyHeader>
            <EmptyTitle>Could not load scope overview</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true)
              setError("")
              setRetry((value) => value + 1)
            }}
          >
            Try again
          </Button>
        </Empty>
      ) : (
        <>
          <section aria-label="Project brief" className="grid gap-4 border-y py-5">
            <h2 className="text-lg font-semibold">Project brief</h2>
            <p className="text-sm text-muted-foreground">Important current choices selected by their linked owners. Every item opens its record and evidence. No AI summary is required.</p>
            {overview.activeDecisions.filter(decision => decision.handoverImportant).length ? overview.activeDecisions.filter(decision => decision.handoverImportant).map(decision => <article key={decision.id} className="grid gap-2 border-b pb-4">
              <h3 className="font-semibold"><Link className="underline" to={`/decisions/${decision.id}`}>{decision.decisionKey} · {headline(decision)}</Link></h3>
              <p className="whitespace-pre-wrap text-sm"><strong>Why: </strong>{decision.why || "No rationale was recorded."}</p>
              <p className="text-sm">Exact scope: {decision.appliesTo.join(", ") || "Not recorded"}</p>
              <p className="text-sm">Owner: {decision.owner?.displayName ?? decision.ownerName ?? "Unassigned"} · Contact context: {decision.ownerContact || "Not recorded"}</p>
              {(decision.sources ?? []).map(source => <blockquote key={source.id} className="border-l-2 pl-3 text-sm whitespace-pre-wrap">{source.provider === "PASTED_NOTES" ? `Pasted notes · ${source.sourceContext?.origin ?? "Supplied label"}` : source.provider}: {source.anchorText?.slice(0, 500) || source.messages?.find(message => message.anchor)?.text.slice(0, 500) || "No source excerpt recorded."}</blockquote>)}
              {!decision.sources?.length && !decision.references?.length ? <p className="text-sm">Supporting evidence is missing.</p> : null}
              {(decision.references ?? []).map(reference => <a key={reference.id} className="text-sm underline" href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a>)}
              {decision.lifecycle?.supersedes.map(previous => <p key={previous.id} className="text-sm"><Link className="underline" to={`/decisions/${previous.id}`}>Previously {previous.decisionKey} · {previous.outcome ?? previous.title}</Link> · What changed: {previous.replacementReason || "No replacement reason recorded."}</p>)}
              <Link className="text-sm underline" to={`/decisions/${decision.id}`}>Inspect supporting evidence and replacement history ({decision.evidenceCount} captured sources)</Link>
            </article>) : <p className="text-sm text-muted-foreground">No important choices selected yet. A linked decision owner can mark a current choice from its detail page.</p>}
            <h3 className="font-semibold">Open questions</h3>
            {overview.openQuestions.length ? overview.openQuestions.map(question => <article key={question.id} className="grid gap-1 border-b pb-3 text-sm">
              <Link className="underline" to={`/decisions/${question.id}`}>{question.decisionKey} · {question.title}</Link>
              <p>Not yet decided · Owner: {question.owner?.displayName ?? question.ownerName ?? "Unassigned"} · Contact context: {question.ownerContact || "Not recorded"}</p>
              <Link className="underline" to={`/decisions/${question.id}`}>Open question, follow resolution or record the answer</Link>
            </article>) : <p className="text-sm text-muted-foreground">No pending questions in this scope.</p>}
            <p className="text-sm text-muted-foreground">Recent scope replacements are recorded below under How this scope evolved.</p>
          </section>
          <section aria-label="Active decisions" className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Current decisions</h2>
              <Badge variant="secondary">
                {overview.activeDecisions.length} active
              </Badge>
              <Badge variant="secondary">
                {overview.decisionCount - overview.activeDecisions.length} superseded
              </Badge>
              <span className="text-sm text-muted-foreground">
                {overview.decisionCount} recorded in this scope
              </span>
            </div>
            {overview.activeDecisions.length ? (
              <div className="divide-y border-y">
                {overview.activeDecisions.map((decision) => (
                  <article key={decision.id} className="grid gap-3 py-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={decision.status}
                        decisionState={decision.decisionState}
                      />
                      <span className="decision-key">
                        {decision.decisionKey}
                      </span>
                      {decision.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold">
                      <Link
                        to={`/decisions/${decision.id}`}
                        state={{ libraryUrl: scopeHref(scope) }}
                        className="hover:text-primary"
                      >
                        {headline(decision)}
                      </Link>
                    </h3>
                    <p className="text-sm leading-6 break-words whitespace-pre-wrap">
                      <strong>Why: </strong>
                      {decision.why || "No rationale was recorded."}
                    </p>
                    {decision.context ? (
                      <p className="text-sm leading-6 break-words whitespace-pre-wrap text-muted-foreground">
                        {decision.context}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span>
                        {decision.owner?.displayName ??
                          decision.ownerName ??
                          "Unassigned"}
                      </span>
                      <span>
                        {decision.evidenceCount} captured source
                        {decision.evidenceCount === 1 ? "" : "s"}
                      </span>
                      <Link
                        to={`/decisions/${decision.id}`}
                        state={{ libraryUrl: scopeHref(scope) }}
                        className="text-primary underline underline-offset-4"
                      >
                        Open decision and evidence
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="border-y py-6 text-sm text-muted-foreground">
                {overview.decisionCount
                  ? "Every recorded Decision in this scope has been superseded. Open the history to follow the replacement into its current scope."
                  : "No recorded choices yet"}
              </p>
            )}
          </section>
          {overview.openCount > 0 ? (
            <Link
              to={scopeHref(scope, "PENDING")}
              className="w-fit rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Pending questions ({overview.openCount})
            </Link>
          ) : null}
          <section id="scope-replacement-history" aria-label="Recent replacements" className="grid gap-5">
            <div>
              <h2 className="text-lg font-semibold">How this scope evolved</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The latest 10 replacements involving this scope. Reasons are
                recorded by the person making the change.
              </p>
            </div>
            {overview.changes.length ? (
              <ol className="divide-y border-y">
                {overview.changes.map((change) => (
                  <li
                    key={`${change.previous.id}:${change.replacement.id}`}
                    className="grid gap-3 py-6"
                  >
                    <p className="text-xs text-muted-foreground">
                      {recordedDate(change.replacedAt)}
                    </p>
                    <div className="grid gap-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">
                          Previously:{" "}
                        </span>
                        <Link
                          to={`/decisions/${change.previous.id}`}
                          className="underline underline-offset-4"
                        >
                          {change.previous.decisionKey} ·{" "}
                          {headline(change.previous)}
                        </Link>
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Replaced by:{" "}
                        </span>
                        <Link
                          to={`/decisions/${change.replacement.id}`}
                          className="underline underline-offset-4"
                        >
                          {change.replacement.decisionKey} ·{" "}
                          {headline(change.replacement)}
                        </Link>{" "}
                        <StatusBadge status={change.replacement.status} />
                      </p>
                    </div>
                    <p className="text-sm leading-6 break-words whitespace-pre-wrap">
                      <strong>What changed: </strong>
                      {change.replacementReason ||
                        "No replacement reason was recorded."}
                    </p>
                    <Button
                      className="w-fit"
                      variant="outline"
                      render={
                        <Link
                          to={comparisonHref(
                            change.previous.id,
                            change.replacement.id
                          )}
                          state={{ returnUrl: scopeHref(scope) }}
                        />
                      }
                      nativeButton={false}
                    >
                      Compare before and after{" "}
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="border-y py-6 text-sm text-muted-foreground">
                No replacement history is recorded for this scope yet.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
