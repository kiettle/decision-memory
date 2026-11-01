import { ArrowRight } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { headline } from "../../../../shared/decision-deadlines.js"
import { FilterSelect } from "@/components/filter-select"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useLocalDate } from "@/hooks/use-local-date"
import { api } from "@/lib/api"
import { recordedDate } from "@/lib/decision-links"
import type { Dashboard, DashboardRecordPage, DashboardRecordQuery, DashboardTrendSeries, Decision } from "@/types"

// Answers one question: what should the team decide or write down next?
// Counts are documentation and consultation facts, never performance.

const periods = [7, 30, 90] as const
const choiceSeries: DashboardTrendSeries[] = ["RESOLVED", "CAPTURED", "UNKNOWN"]
type Drill = { title: string; description: string; queries: DashboardRecordQuery[] }

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
const shortDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
const initialsOf = (name: string) =>
  name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()

export function DashboardPage() {
  const today = useLocalDate()
  // Scope and period live in the URL so a view can be shared.
  const [params, setParams] = useSearchParams()
  const scope = params.get("appliesTo") || "ALL"
  const requestedDays = Number(params.get("days"))
  const days = periods.some((period) => period === requestedDays) ? requestedDays : 90
  const setView = (key: "appliesTo" | "days", value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  const [scopes, setScopes] = useState<string[]>([])
  const [data, setData] = useState<Dashboard | null>(null)
  const [dueNext, setDueNext] = useState<Decision[] | null>(null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [drill, setDrill] = useState<Drill | null>(null)
  const [switching, setSwitching] = useState(false)
  const input = useMemo(() => ({ scope: scope === "ALL" ? undefined : scope, days, asOf: today }), [scope, days, today])

  useEffect(() => {
    let active = true
    api.metadata().then((metadata) => { if (active) setScopes(metadata.appliesTo) }).catch(() => undefined)
    return () => { active = false }
  }, [])

  // The open questions themselves, earliest deadline first, so the next answer is one click away.
  useEffect(() => {
    let active = true
    api.decisions({ status: "ACTIVE", decisionState: "PENDING", sort: "DEADLINE", asOf: input.asOf, appliesTo: input.scope })
      .then((rows) => { if (active) setDueNext(rows.slice(0, 3)) })
      .catch(() => { if (active) setDueNext([]) })
    return () => { active = false }
  }, [input, attempt])

  useEffect(() => {
    let active = true
    api.dashboard(input)
      .then((next) => { if (active) { setData(next); setError("") } })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load the dashboard.") })
    return () => { active = false }
  }, [input, attempt])

  const refresh = useCallback(() => setAttempt((value) => value + 1), [])

  async function setTracking(enabled: boolean) {
    setSwitching(true)
    try {
      await api.setUsageTracking(enabled)
      refresh()
      window.dispatchEvent(new Event("usage-tracking"))
    } catch (switchError) {
      toast.error(switchError instanceof Error ? switchError.message : "Could not change usage collection.")
    } finally {
      setSwitching(false)
    }
  }

  async function dismissSearch(ids: string[]) {
    try {
      await api.deleteSearches(ids)
      refresh()
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Could not remove the search.")
    }
  }

  const ready = data && data.window.days === days
  const openTotal = data ? data.pending.reduce((sum, row) => sum + row.pending + row.overdue, 0) : 0
  const overdueTotal = data ? data.pending.reduce((sum, row) => sum + row.overdue, 0) : 0
  const finding = data ? findingLine(data, openTotal, overdueTotal) : null

  return (
    <div className="page-frame dashboard-page">
      <div className="dashboard-title-row">
        <div className="grid gap-1.5">
          <h1>Team memory</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {finding ?? "What the team should decide or write down next."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            searchable
            label="Applies To"
            value={scope}
            options={scopes.map((value) => ({ label: value, value }))}
            onChange={(value) => setView("appliesTo", value === "ALL" ? null : value)}
          />
          <ToggleGroup
            aria-label="Period"
            variant="outline"
            spacing={0}
            value={[String(days)]}
            onValueChange={(values) => { if (values[0]) setView("days", values[0] === "90" ? null : values[0]) }}
          >
            {periods.map((period) => (
              <ToggleGroupItem key={period} value={String(period)} aria-label={`Last ${period} days`}>
                {period} days
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {error && !data ? (
        <div role="alert" className="dashboard-panel flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Couldn't load the dashboard. {error}</p>
          <Button variant="outline" onClick={refresh}>Retry</Button>
        </div>
      ) : null}
      {error && data ? (
        <p role="alert" className="text-sm text-muted-foreground">
          Couldn't refresh; showing the last loaded figures. <Button variant="link" className="h-auto p-0" onClick={refresh}>Retry</Button>
        </p>
      ) : null}

      <div className="dashboard-grid" aria-busy={!ready}>
        <section aria-labelledby="dashboard-owners" className="dashboard-panel dashboard-span-7">
          <PanelHeader id="dashboard-owners" title="Questions waiting on an owner" meta="Open now, any age" />
          {data ? (
            <OwnerQuestions data={data} openTotal={openTotal} overdueTotal={overdueTotal} onDrill={setDrill} dueNext={dueNext} today={today} />
          ) : <RowsSkeleton rows={3} />}
        </section>

        <section aria-labelledby="dashboard-gaps" className="dashboard-panel dashboard-span-5">
          <PanelHeader
            id="dashboard-gaps"
            title="Searches that found nothing"
            meta={data?.usage.tracking.enabled || data?.usage.totals.searches ? `${data.usage.totals.gaps} of ${plural(data.usage.totals.searches, "search", "searches")}` : undefined}
          />
          {data ? (
            <SearchGaps data={data} onDismiss={dismissSearch} onEnable={() => void setTracking(true)} switching={switching} />
          ) : <RowsSkeleton rows={4} />}
        </section>

        <section aria-labelledby="dashboard-trend" className="dashboard-panel dashboard-span-7">
          <PanelHeader
            id="dashboard-trend"
            title="Questions and choices recorded"
            meta={data ? `${shortDate(data.window.from)} – ${shortDate(data.window.through)}` : undefined}
            legend
          />
          {data ? <TrendChart data={data} onDrill={setDrill} /> : <Skeleton className="h-[204px] w-full" />}
          <div className="grid gap-2 border-t pt-3">
            <h3 id="dashboard-contributors" className="text-xs text-muted-foreground">Recorded by, in the period</h3>
            {data ? <Contributors data={data} onDrill={setDrill} /> : <RowsSkeleton rows={2} />}
          </div>
        </section>

        <section aria-labelledby="dashboard-consulted" className="dashboard-panel dashboard-span-5">
          <PanelHeader id="dashboard-consulted" title="Most consulted decisions" meta={data ? plural(data.usage.totals.views, "page open") : undefined} />
          {data ? <MostConsulted data={data} /> : <RowsSkeleton rows={5} />}
        </section>

      </div>

      <section aria-labelledby="dashboard-about" className="dashboard-about">
        <h2 id="dashboard-about">About these figures</h2>
        {data ? (
          <AboutData data={data} switching={switching} onTracking={(enabled) => void setTracking(enabled)} />
        ) : <RowsSkeleton rows={2} />}
      </section>

      <RecordSheet key={drill ? JSON.stringify(drill) : "closed"} drill={drill} input={input} onClose={() => setDrill(null)} />
    </div>
  )
}

function findingLine(data: Dashboard, openTotal: number, overdueTotal: number) {
  const parts: string[] = []
  if (overdueTotal) parts.push(`${plural(overdueTotal, "question is", "questions are")} past due`)
  else if (openTotal) parts.push(`${plural(openTotal, "question is", "questions are")} open, none past due`)
  else parts.push("No open questions")
  const gaps = data.usage.gaps.length
  if (gaps) parts.push(`${plural(gaps, "search", "searches")} found nothing in the last ${data.window.days} days`)
  return `${parts.join("; ")}.`
}

function PanelHeader({ id, title, meta, legend = false }: { id: string; title: string; meta?: string; legend?: boolean }) {
  return (
    <div className="dashboard-panel-header">
      <h2 id={id}>{title}</h2>
      {legend ? (
        <span className="dashboard-legend">
          <span><i className="is-choice" aria-hidden="true" />Choices</span>
          <span><i className="is-question" aria-hidden="true" />Questions opened</span>
          {meta ? <span>{meta}</span> : null}
        </span>
      ) : meta ? <span className="dashboard-meta">{meta}</span> : null}
    </div>
  )
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-5 w-full" />)}
    </div>
  )
}

function OwnerQuestions({ data, openTotal, overdueTotal, onDrill, dueNext, today }: {
  data: Dashboard
  openTotal: number
  overdueTotal: number
  onDrill: (drill: Drill) => void
  dueNext: Decision[] | null
  today: string
}) {
  if (!data.pending.length)
    return <p className="dashboard-empty">No open questions. Questions recorded as pending appear here until someone records the answer.</p>
  const largest = Math.max(...data.pending.map((row) => row.overdue + row.pending))
  return (
    <div className="grid gap-5">
      <p className="dashboard-figure">
        <span>{openTotal}</span> open
        {overdueTotal ? <span className="is-overdue">{overdueTotal} past due</span> : <span className="text-muted-foreground">none past due</span>}
      </p>
      <ul className="dashboard-list">
        {data.pending.map((row) => {
          const total = row.overdue + row.pending
          const open = (segment: "OVERDUE" | "PENDING") => onDrill({
            title: `${row.label}: ${segment === "OVERDUE" ? "past due" : "open, not past due"}`,
            description: "Open questions owned here. Open one to record the answer.",
            queries: [{ chart: "PENDING", segment, key: row.key }],
          })
          return (
            <li key={row.key} className="owner-row">
              <span className="owner-avatar" aria-hidden="true">{row.kind === "UNASSIGNED" ? "–" : initialsOf(row.label)}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.label}</span>
                <span className="owner-bar" aria-hidden="true">
                  <span className="is-overdue" style={{ width: `${(row.overdue / largest) * 100}%` }} />
                  <span className="is-open" style={{ width: `${(row.pending / largest) * 100}%` }} />
                </span>
              </span>
              <span className="owner-counts">
                {row.overdue ? (
                  <button type="button" className="is-overdue" onClick={() => open("OVERDUE")}>{row.overdue} past due</button>
                ) : null}
                {row.pending ? (
                  <button type="button" onClick={() => open("PENDING")}>{row.pending} open</button>
                ) : null}
                <span className="sr-only">{plural(total, "question")} in total</span>
              </span>
            </li>
          )
        })}
      </ul>
      {dueNext?.length ? (
        <div className="grid gap-2">
          <h3 className="text-xs text-muted-foreground">Due next</h3>
          <ul className="dashboard-list">
            {dueNext.map((question) => {
              const late = Boolean(question.dueDate && question.dueDate < today)
              return (
                <li key={question.id} className="due-row">
                  <Link to={`/decisions/${question.id}`} className="min-w-0 font-medium hover:underline">{headline(question)}</Link>
                  <span className={late ? "shrink-0 text-xs font-medium text-destructive" : "shrink-0 text-xs text-muted-foreground"}>
                    {question.dueDate ? `${late ? "Past due" : "Due"} ${shortDate(question.dueDate)}` : "No deadline"}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function SearchGaps({ data, onDismiss, onEnable, switching }: {
  data: Dashboard
  onDismiss: (ids: string[]) => void
  onEnable: () => void
  switching: boolean
}) {
  if (!data.usage.tracking.enabled && !data.usage.totals.searches)
    return (
      <div className="grid gap-3">
        <p className="dashboard-empty">Usage collection is off, so searches are not recorded. Turn it on to see what teammates looked for and could not find.</p>
        <Button variant="outline" className="w-fit" disabled={switching} onClick={onEnable}>Turn on usage collection</Button>
      </div>
    )
  if (!data.usage.gaps.length)
    return <p className="dashboard-empty">Every recorded search in this period found something.</p>
  return (
    <ul className="dashboard-list">
      {data.usage.gaps.map((gap) => (
        <li key={`${gap.key}:${gap.scope ?? ""}`} className="gap-row">
          <span className="min-w-0">
            <span className="block break-words font-medium">“{gap.query}”</span>
            <span className="block text-xs text-muted-foreground">
              {plural(gap.searches, "search", "searches")}
              {gap.unhelpful ? ` · ${gap.unhelpful} not helpful` : ""}
              {gap.scope ? ` · ${gap.scope}` : ""}
              {` · last ${recordedDate(gap.lastSearchedAt)}`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              render={<Link to="/decisions/new" state={{ questionPrefill: gap.query, scopePrefill: gap.scope ?? undefined, libraryUrl: "/dashboard" }} />}
              nativeButton={false}
            >
              Record as question
            </Button>
            <Button variant="ghost" size="sm" aria-label={`Remove search “${gap.query}”`} onClick={() => onDismiss(gap.ids)}>
              Remove
            </Button>
          </span>
        </li>
      ))}
    </ul>
  )
}

function TrendChart({ data, onDrill }: { data: Dashboard; onDrill: (drill: Drill) => void }) {
  // 90 days read as weeks; shorter periods as days.
  const size = data.window.days === 90 ? 7 : 1
  const buckets: { from: string; through: string; questions: number; choices: number }[] = []
  for (let index = 0; index < data.trend.length; index += size) {
    const rows = data.trend.slice(index, index + size)
    buckets.push({
      from: rows[0].day,
      through: rows[rows.length - 1].day,
      questions: rows.reduce((sum, row) => sum + row.QUESTIONS, 0),
      choices: rows.reduce((sum, row) => sum + row.RESOLVED + row.CAPTURED + row.UNKNOWN, 0),
    })
  }
  const largest = Math.max(1, ...buckets.map((bucket) => Math.max(bucket.questions, bucket.choices)))
  const step = largest <= 4 ? 1 : largest <= 10 ? 2 : largest <= 25 ? 5 : 10
  // Round ticks with the top one above the largest bar.
  const top = Math.floor(largest / step) * step + step
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => index * step)
  const labelEvery = Math.ceil(buckets.length / 6)
  const label = (bucket: (typeof buckets)[number]) =>
    bucket.from === bucket.through ? shortDate(bucket.from) : `${shortDate(bucket.from)} – ${shortDate(bucket.through)}`
  const recorded = buckets.reduce((sum, bucket) => sum + bucket.choices + bucket.questions, 0)

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="trend-plot">
        <div className="trend-ticks" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}><b>{tick}</b></span>
          ))}
        </div>
        <ol className="trend-bars" aria-label="Questions opened and choices recorded per period">
          {buckets.map((bucket) => (
            <li key={bucket.from}>
              <button
                type="button"
                disabled={!bucket.choices && !bucket.questions}
                aria-label={`${label(bucket)}: ${plural(bucket.choices, "choice")} recorded, ${plural(bucket.questions, "question")} opened`}
                title={`${label(bucket)} · ${bucket.choices} choices · ${bucket.questions} questions`}
                onClick={() => onDrill({
                  title: label(bucket),
                  description: "Questions opened and choices recorded on these UTC days.",
                  queries: [
                    ...choiceSeries.map((segment) => ({ chart: "TREND" as const, segment, from: bucket.from, through: bucket.through })),
                    { chart: "TREND", segment: "QUESTIONS", from: bucket.from, through: bucket.through },
                  ],
                })}
              >
                <span className="is-choice" style={{ height: `${(bucket.choices / top) * 100}%` }} />
                <span className="is-question" style={{ height: `${(bucket.questions / top) * 100}%` }} />
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="trend-labels" aria-hidden="true">
        {buckets.map((bucket, index) => (
          <span key={bucket.from}>{index % labelEvery === 0 ? shortDate(bucket.from) : ""}</span>
        ))}
      </div>
      {!recorded ? <p className="dashboard-empty">Nothing was recorded in this period.</p> : null}
    </div>
  )
}

function MostConsulted({ data }: { data: Dashboard }) {
  const rows = data.usage.consulted
  if (!rows.length)
    return (
      <p className="dashboard-empty">
        {data.usage.tracking.enabled ? "No decision pages were opened in this period." : "Usage collection is off, so page opens are not recorded."}
      </p>
    )
  const largest = rows[0].views
  return (
    <ol className="dashboard-list">
      {rows.map((row, index) => (
        <li key={row.id} className="consulted-row">
          <span className="grid min-w-0 flex-1">
            <Link to={`/decisions/${row.id}`} className="block truncate font-medium hover:underline">
              {headline(row)}
            </Link>
            <span className="text-xs text-muted-foreground">{row.decisionKey}{row.status === "SUPERSEDED" ? " · replaced" : ""}</span>
            <span className="consulted-bar" aria-hidden="true">
              <span className={index === 0 ? "is-top" : undefined} style={{ width: `${(row.views / largest) * 100}%` }} />
            </span>
          </span>
          <span className="dashboard-number">{plural(row.views, "open")}</span>
        </li>
      ))}
    </ol>
  )
}

function Contributors({ data, onDrill }: { data: Dashboard; onDrill: (drill: Drill) => void }) {
  if (!data.contributors.length) return <p className="dashboard-empty">Nobody recorded a decision or question in this period.</p>
  return (
    <ul className="dashboard-list">
      {data.contributors.map((row) => (
        <li key={row.key} className="contributor-row">
          <span className="min-w-0 truncate">{row.label}</span>
          <span className="owner-counts">
            {row.decided ? (
              <button type="button" onClick={() => onDrill({ title: `Choices recorded by ${row.label}`, description: "Recorded in the period from this account.", queries: [{ chart: "CONTRIBUTOR", segment: "DECIDED", key: row.key }] })}>
                {plural(row.decided, "choice")}
              </button>
            ) : null}
            {row.pending ? (
              <button type="button" onClick={() => onDrill({ title: `Questions recorded by ${row.label}`, description: "Still open; recorded in the period from this account.", queries: [{ chart: "CONTRIBUTOR", segment: "PENDING", key: row.key }] })}>
                {plural(row.pending, "question")}
              </button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

function AboutData({ data, switching, onTracking }: { data: Dashboard; switching: boolean; onTracking: (enabled: boolean) => void }) {
  const { tracking } = data.usage
  return (
    <div className="grid gap-3 text-sm leading-6">
      <p>
        Open questions are a live snapshot. Everything else covers {shortDate(data.window.from)} – {shortDate(data.window.through)} in UTC.
        Counts show documentation and consultation, not anyone's performance.
      </p>
      {data.coverage.missingRecordingDates || data.coverage.unknownInitialState ? (
        <p className="text-muted-foreground">
          {data.coverage.missingRecordingDates ? `${plural(data.coverage.missingRecordingDates, "choice has", "choices have")} no recorded date and ${data.coverage.missingRecordingDates === 1 ? "is" : "are"} left out of the chart. ` : ""}
          {data.coverage.unknownInitialState ? `${plural(data.coverage.unknownInitialState, "older choice does", "older choices do")} not record whether ${data.coverage.unknownInitialState === 1 ? "it" : "they"} began as a question.` : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="text-muted-foreground">
          {tracking.enabled
            ? `Usage collection is on. A page open counts once per viewer every 30 minutes; searches are kept ${tracking.retentionDays} days without names.`
            : "Usage collection is off. Page opens and searches are not recorded."}
        </p>
        <Button variant="outline" size="sm" disabled={switching} onClick={() => onTracking(!tracking.enabled)}>
          {tracking.enabled ? "Turn off collection" : "Turn on collection"}
        </Button>
      </div>
    </div>
  )
}

function RecordSheet({ drill, input, onClose }: {
  drill: Drill | null
  input: { scope?: string; days: number; asOf: string }
  onClose: () => void
}) {
  // Each drill-down mounts fresh (keyed by its queries), so it starts loading.
  const [records, setRecords] = useState<DashboardRecordPage["records"]>([])
  const [loading, setLoading] = useState(Boolean(drill))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!drill) return
    let active = true
    Promise.all(drill.queries.map((query) => api.dashboardRecords({ ...input, ...query })))
      .then((pages) => {
        if (!active) return
        const seen = new Set<string>()
        setRecords(pages.flatMap((page) => page.records).filter((record) => !seen.has(record.id) && Boolean(seen.add(record.id))))
      })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [drill, input])

  return (
    <Sheet open={Boolean(drill)} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{drill?.title}</SheetTitle>
          <SheetDescription>{drill?.description}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-1 overflow-auto px-4 pb-6">
          {loading ? <RowsSkeleton rows={4} /> : failed ? (
            <p role="alert" className="text-sm">Couldn't load these records. Close and try again.</p>
          ) : records.length ? records.map((record) => (
            <Link key={record.id} to={`/decisions/${record.id}`} className="drill-row" onClick={onClose}>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={record.status} decisionState={record.decisionState} />
                {record.decisionKey} · {record.ownerLabel}
                {record.dueDate ? ` · due ${shortDate(record.dueDate)}` : ""}
              </span>
              <span className="font-medium">{headline(record)}</span>
              {record.decisionState === "PENDING" ? (
                <span className="inline-flex items-center gap-1 text-xs text-primary">Open to record the answer <ArrowRight className="size-3" /></span>
              ) : null}
            </Link>
          )) : <p className="text-sm text-muted-foreground">No records.</p>}
        </div>
      </SheetContent>
    </Sheet>
  )
}
