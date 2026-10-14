import { ArrowLeft, ArrowRight, Box, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import { headline } from "../../../../shared/decision-deadlines.js"
import { StatusBadge } from "@/components/status-badge"
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
    row.scope.toLowerCase().includes(query.toLowerCase().trim())
  )
  return (
    <div className="page-frame">
      <div>
        <p className="eyebrow">Understand a service before your next change</p>
        <h1>Scope overviews</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Explore the current choices, their reasons, and how they evolved for
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
            <Link
              key={row.scope}
              to={scopeHref(row.scope)}
              className="flex items-center gap-4 py-6 hover:bg-muted/50"
            >
              <Box className="size-5 shrink-0 text-primary" />
              <div className="grid min-w-0 flex-1 gap-2">
                <h2 className="font-semibold break-words">{row.scope}</h2>
                <p className="text-sm text-muted-foreground">
                  {row.activeCount} active ·{" "}
                  {row.decisionCount - row.activeCount} superseded · Latest
                  recorded {recordedDate(row.latestDecisionAt)}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      ) : (
        <Empty className="border-y">
          <EmptyHeader>
            <EmptyTitle>
              {rows.length
                ? "No scopes match your search"
                : "No scopes recorded yet"}
            </EmptyTitle>
            <EmptyDescription>
              Use Applies To when recording a Decision to make it part of a
              service or feature overview.
            </EmptyDescription>
          </EmptyHeader>
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
        <Button
          variant="outline"
          render={<Link to={libraryUrl} />}
          nativeButton={false}
        >
          Browse all decisions <ArrowRight data-icon="inline-end" />
        </Button>
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
          <section aria-label="Active decisions" className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Current decisions</h2>
              <Badge variant="secondary">
                {overview.activeDecisions.length} active
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
                      <StatusBadge status={decision.status} decisionState={decision.decisionState} />
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
                Every recorded Decision in this scope has been superseded. Open
                the history to follow the replacement into its current scope.
              </p>
            )}
          </section>
          <section aria-label="Recent replacements" className="grid gap-5">
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
