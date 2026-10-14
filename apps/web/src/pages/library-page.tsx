import {
  Box,
  CalendarDays,
  ChevronRight,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Hash,
  Columns3,
  List,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"

import { headline } from "../../../../shared/decision-deadlines.js"
import { DecisionBoard } from "@/components/decision-board"
import { DecisionDeadline } from "@/components/decision-deadline"
import { useLocalDate } from "@/hooks/use-local-date"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CompareDecisionsDialog } from "@/components/compare-decisions-dialog"
import { FilterSelect } from "@/components/filter-select"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type DecisionFilters } from "@/lib/api"
import { slackChannels } from "@/lib/slack"
import type { Decision, MemorySearchMatch, MemorySearchMethod, MemorySearchResponse, Metadata } from "@/types"

const initialFilters = {
  q: "",
  channel: "ALL",
  ownerId: "ALL",
  tag: "ALL",
  status: "ALL",
  appliesTo: "ALL",
  dateRange: "ALL",
  deadline: "ALL",
}

export function LibraryPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const serializedFilters = JSON.stringify(Object.fromEntries(
    Object.entries(initialFilters).map(([key, value]) => [key, searchParams.get(key) ?? value])
  ))
  // Changing presentation does not refetch the same dataset or flash loading rows.
  const filters = useMemo(() => JSON.parse(serializedFilters) as typeof initialFilters, [serializedFilters])
  const setFilters = (next: typeof initialFilters) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (value === initialFilters[key as keyof typeof initialFilters]) params.delete(key)
      else params.set(key, value)
    }
    setSearchParams(params, { replace: true, state: null })
  }
  const view = searchParams.get("view") === "kanban" ? "kanban" : "flat"
  const sort = searchParams.get("sort") === "DEADLINE" ? "DEADLINE" : "NEWEST"
  const setPresentation = (key: "view" | "sort", value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value === "flat" || value === "NEWEST") params.delete(key)
    else params.set(key, value)
    setSearchParams(params, { replace: true, state: location.state })
  }
  const today = useLocalDate()
  const navigationUrl = useRef(location.pathname + location.search)
  useEffect(() => { navigationUrl.current = location.pathname + location.search }, [location.pathname, location.search])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [memoryResult, setMemoryResult] = useState<MemorySearchResponse | null>(location.state?.memoryResult ?? null)
  const [memorySearching, setMemorySearching] = useState<MemorySearchMethod | null>(null)
  const [memoryError, setMemoryError] = useState("")
  const recentOnly = location.pathname === "/recent"
  const apiFilters = useMemo<DecisionFilters>(() => ({
    ...filters,
    status: filters.status === "PENDING" || filters.status === "DECIDED" ? "ACTIVE" : filters.status,
    decisionState: filters.status === "PENDING" ? "PENDING" : filters.status !== "ALL" ? "DECIDED" : "ALL",
    asOf: today,
    sort: recentOnly ? "NEWEST" : sort,
  }), [filters, today, sort, recentOnly])
  const memoryAllowed = filters.status !== "PENDING" && filters.deadline === "ALL"
  const latestRequest = useRef(0)
  const memoryRequest = useRef(0)

  useEffect(() => () => { memoryRequest.current++ }, [])

  useEffect(() => {
    api
      .metadata()
      .then(setMetadata)
      .catch(() => setMetadata(null))
  }, [])

  const load = useCallback(async () => {
    // Ignore responses from searches the user has already typed past.
    const request = ++latestRequest.current
    setLoading(true)
    setError("")
    try {
      const decisionRows = await api.decisions(apiFilters)
      if (request !== latestRequest.current) return
      setDecisions(recentOnly ? decisionRows.slice(0, 5) : decisionRows)
    } catch (loadError) {
      if (request !== latestRequest.current) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load decisions."
      )
    } finally {
      if (request === latestRequest.current) setLoading(false)
    }
  }, [apiFilters, recentOnly])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), filters.q ? 180 : 0)
    return () => window.clearTimeout(timeout)
  }, [load, filters.q])

  const invalidateMemory = () => {
    void navigate(location.pathname + location.search, { replace: true, state: null })
    memoryRequest.current++
    setMemorySearching(null)
    setMemoryResult(null)
    setMemoryError("")
  }

  const updateFilter = (key: keyof typeof filters, value: string) => {
    invalidateMemory()
    setFilters({ ...filters, [key]: value })
    setMemoryResult(null)
    setMemoryError("")
  }
  const resetFilters = () => {
    invalidateMemory()
    setFilters(initialFilters)
    setMemoryResult(null)
    setMemoryError("")
  }

  const searchByMemory = async (method: MemorySearchMethod = "LOCAL") => {
    const enabled = method === "GEMINI" ? metadata?.features.geminiMemorySearch : metadata?.features.memorySearch
    if (filters.q.trim().length < 3 || !enabled || !memoryAllowed) return
    const request = ++memoryRequest.current
    void navigate(location.pathname + location.search, { replace: true, state: null })
    setMemorySearching(method)
    setMemoryResult(null)
    setMemoryError("")
    try {
      const result = await api.memorySearch(filters.q.trim(), apiFilters, method)
      if (request === memoryRequest.current) {
        const labeledResult = { ...result, method }
        setMemoryResult(labeledResult)
        void navigate(navigationUrl.current, { replace: true, state: { memoryResult: labeledResult } })
      }
    } catch (searchError) {
      if (request !== memoryRequest.current) return
      setMemoryError(
        searchError instanceof Error
          ? searchError.message
          : "Search by memory failed. Normal search is still available; please retry."
      )
    } finally {
      if (request === memoryRequest.current) setMemorySearching(null)
    }
  }

  const geminiResult = memoryResult?.method === "GEMINI"

  const displayedDecisions = memoryResult
    ? memoryResult.matches.map((match) => match.decision)
    : decisions
  const matchesByDecision = new Map(
    (memoryResult?.matches ?? []).map((match) => [match.decisionId, match])
  )
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "q" && value !== "ALL"
  ).length

  const options = useMemo(
    () => ({
      channels: (metadata?.channels ?? []).map((channel) => ({
        label: `#${channel}`,
        value: channel,
      })),
      owners: [
        ...(metadata?.users ?? []).map((user) => ({ label: user.displayName, value: user.id })),
        ...(metadata?.ownerNames ?? []).map((name) => ({ label: `${name} (recorded name)`, value: `name:${name}` })),
      ],
      tags: (metadata?.tags ?? []).map((tag) => ({ label: tag, value: tag })),
      appliesTo: (metadata?.appliesTo ?? []).map((item) => ({
        label: item,
        value: item,
      })),
    }),
    [metadata]
  )

  const filterControls = (
    <>
      <FilterSelect
        label="Channel"
        value={filters.channel}
        options={options.channels}
        onChange={(value) => updateFilter("channel", value)}
      />
      <FilterSelect
        label="Owner"
        value={filters.ownerId}
        options={options.owners}
        onChange={(value) => updateFilter("ownerId", value)}
      />
      <FilterSelect
        label="Tag"
        value={filters.tag}
        options={options.tags}
        onChange={(value) => updateFilter("tag", value)}
      />
      <FilterSelect
        label="Status"
        value={filters.status === "ACTIVE" ? "DECIDED" : filters.status}
        options={[
          { label: "Pending", value: "PENDING" },
          { label: "Decided", value: "DECIDED" },
          { label: "Superseded", value: "SUPERSEDED" },
        ]}
        onChange={(value) => updateFilter("status", value)}
      />
      <FilterSelect
        label="Applies To"
        value={filters.appliesTo}
        options={options.appliesTo}
        onChange={(value) => updateFilter("appliesTo", value)}
      />
      <FilterSelect label="Deadline" value={filters.deadline} options={[
        { label: "Overdue", value: "OVERDUE" }, { label: "Due soon", value: "DUE_SOON" },
        { label: "Upcoming", value: "UPCOMING" }, { label: "No deadline", value: "UNSCHEDULED" },
      ]} onChange={(value) => updateFilter("deadline", value)} />
      <FilterSelect
        label="Date Range"
        value={filters.dateRange}
        options={[
          { label: "Last 7 days", value: "7" },
          { label: "Last 30 days", value: "30" },
          { label: "Last 90 days", value: "90" },
        ]}
        onChange={(value) => updateFilter("dateRange", value)}
      />
    </>
  )

  const onSaved = (saved: Decision) => {
    if (memoryResult) {
      const next = { ...memoryResult, matches: memoryResult.matches.map((match) => match.decisionId === saved.id ? { ...match, decision: saved } : match) }
      setMemoryResult(next)
      void navigate(navigationUrl.current, { replace: true, state: { memoryResult: next } })
    }
    void load()
  }

  return (
    <div className="page-frame">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Shared product record</p>
          <h1>{recentOnly ? "Recent Decisions" : "Decision Library"}</h1>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" render={<Link to="/scopes" />} nativeButton={false}><Box data-icon="inline-start" /> Explore scopes</Button><CompareDecisionsDialog />
        <Button
          render={<Link to="/decisions/new" state={{ libraryUrl: location.pathname + location.search, libraryState: location.state }} />}
          nativeButton={false}
          size="lg"
        >
          <Plus data-icon="inline-start" />
          New Decision
        </Button></div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <InputGroup className="h-13 rounded-lg border-border bg-white sm:col-span-2 lg:col-span-1">
          <InputGroupInput
            aria-label="Search decisions"
            placeholder="Search decisions, context, channels, or captured discussion..."
            value={filters.q}
            onChange={(event) => updateFilter("q", event.target.value)}
            className="h-12 px-1 text-base"
          />
          <InputGroupAddon align="inline-start" className="pl-4">
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <Button
          size="lg"
          variant="outline"
          className="h-13"
          onClick={() => void searchByMemory()}
          disabled={
            Boolean(memorySearching) ||
            filters.q.trim().length < 3 ||
            !memoryAllowed ||
            !metadata?.features.memorySearch
          }
          title={
            metadata && !metadata.features.memorySearch
              ? "Run npm run setup:local to prepare memory search."
              : undefined
          }
        >
          <Sparkles data-icon="inline-start" />
          {memorySearching === "LOCAL" ? "Searching memory…" : "Search by memory"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-13"
          onClick={() => void searchByMemory("GEMINI")}
          disabled={Boolean(memorySearching) || !memoryAllowed || filters.q.trim().length < 3 || !metadata?.features.geminiMemorySearch}
          title={metadata && !metadata.features.geminiMemorySearch ? "Add GEMINI_API_KEY to enable Gemini search." : undefined}
        >
          <Sparkles data-icon="inline-start" />
          {memorySearching === "GEMINI" ? "Searching Gemini…" : "Search with Gemini"}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-3">
          Memory search finds recorded choices. Search by memory uses local vectors. Gemini sends your query and up to 200 decisions matching your filters to Google. Narrow with filters; AI can miss or misrank results.
          {!memoryAllowed ? " Use normal search for pending questions and deadline filters." : ""}
          {metadata && !metadata.features.geminiMemorySearch ? " Gemini search is not configured." : ""}
          {metadata && !metadata.features.memorySearch ? " Run npm run setup:local to prepare local memory search." : ""}
        </p>
      </div>

      {memoryError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {memoryError}
        </div>
      ) : null}

      {memoryResult ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary text-primary-foreground">
              <Sparkles /> {geminiResult ? "Gemini AI match" : "Local semantic match"}
            </Badge>
            <span className="text-slate-700">
              {geminiResult
                ? memoryResult.truncated
                  ? `Gemini searched the newest ${memoryResult.candidateCount} of ${memoryResult.totalCandidateCount} decisions matching your filters. Older matching decisions were not included. Narrow your filters or use local search; AI can miss or misrank results.`
                  : `Gemini searched ${memoryResult.candidateCount} decisions matching your filters. AI can miss or misrank results; review the stored evidence.`
                : memoryResult.truncated
                ? `Searched ${memoryResult.candidateCount} of ${memoryResult.totalCandidateCount} decisions matching your filters. The remaining decisions are waiting for local indexing. Retry shortly or use normal search.`
                : `Searched the local index of ${memoryResult.candidateCount} stored decisions. No external AI request.`}
            </span>
          </div>
          <Button variant="link" onClick={invalidateMemory}>
            Back to normal results
          </Button>
        </div>
      ) : null}

      <div className="desktop-filters">
        <div className="flex flex-wrap gap-3">{filterControls}</div>
        <Button variant="link" onClick={resetFilters}>
          Clear filters
        </Button>
      </div>
      <div className="mobile-filter-row">
        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>
            <SlidersHorizontal />
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85svh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Filter decisions</SheetTitle>
              <SheetDescription>
                Combine filters to narrow the library.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-3 overflow-auto px-4 [&_[data-slot=select-trigger]]:w-full">
              {filterControls}
            </div>
            <SheetFooter>
              <Button
                variant="outline"
                onClick={resetFilters}
              >
                Clear filters
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {!recentOnly ? <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup aria-label="Library view" variant="outline" spacing={0} value={[view]} onValueChange={(values) => { if (values[0]) setPresentation("view", values[0]) }}>
          <ToggleGroupItem value="flat"><List /> Flat</ToggleGroupItem>
          <ToggleGroupItem value="kanban"><Columns3 /> Kanban</ToggleGroupItem>
        </ToggleGroup>
        {view === "flat" && !memoryResult ? <FilterSelect label="Sort" includeAll={false} value={sort} options={[{ label: "Newest first", value: "NEWEST" }, { label: "Earliest deadline first", value: "DEADLINE" }]} onChange={(value) => setPresentation("sort", value)} /> : null}
      </div> : null}
      <div className="result-bar">
        <span>
          {loading && !memoryResult
            ? "Loading decisions…"
            : `${displayedDecisions.length} decision${displayedDecisions.length === 1 ? "" : "s"}`}
        </span>
        <span className="font-normal text-muted-foreground">{memoryResult ? "Best match first" : !recentOnly && view === "kanban" ? "Grouped by deadline" : !recentOnly && sort === "DEADLINE" ? "Earliest deadline first" : "Newest first"}</span>
      </div>

      {error && !memoryResult ? (
        <Empty className="border-y py-20">
          <EmptyHeader>
            <EmptyTitle>Could not load the Decision Library</EmptyTitle>
            <EmptyDescription>
              {error} Check that PostgreSQL and the API are running.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </Empty>
      ) : loading && !memoryResult ? (
        <LoadingRows />
      ) : !recentOnly && view === "kanban" ? (
        <DecisionBoard key={location.search.replace(/(?:\?|&)view=[^&]+/, "")} decisions={displayedDecisions} today={today} matches={matchesByDecision} onSaved={onSaved} />
      ) : displayedDecisions.length ? (
        <DecisionList decisions={displayedDecisions} today={today} matches={matchesByDecision} method={memoryResult?.method ?? "LOCAL"} />
      ) : (
        <Empty className="border-y py-20">
          <EmptyHeader>
            <EmptyTitle>{memoryResult ? "No memory matches in the searched decisions" : "No decisions match these filters"}</EmptyTitle>
            <EmptyDescription>
              Clear a filter or record a new decision.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}

function DecisionList({
  decisions,
  matches,
  method,
  today,
}: {
  today: string
  decisions: Decision[]
  matches: Map<string, MemorySearchMatch>
  method: MemorySearchMethod
}) {
  return (
    <div className="decision-list">
      <div className="decision-list-header" aria-hidden="true">
        <span>Status</span>
        <span>Decision</span>
        <span>Applies to</span>
        <span>Why (summary)</span>
        <span>Channel</span>
        <span>Owner</span>
        <span>Evidence</span>
        <span>Created</span>
        <span />
      </div>
      {decisions.map((decision) => (
        <DecisionRow
          key={decision.id}
          decision={decision}
          memoryMatch={matches.get(decision.id)}
          method={method}
          today={today}
        />
      ))}
    </div>
  )
}

function DecisionRow({
  decision,
  memoryMatch,
  method,
  today,
}: {
  today: string
  decision: Decision
  memoryMatch?: MemorySearchMatch
  method: MemorySearchMethod
}) {
  const location = useLocation()
  const ownerLabel = decision.owner?.displayName ?? decision.ownerName
  const initials =
    ownerLabel
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2) || "—"
  return (
    <Link className="decision-row" to={`/decisions/${decision.id}`} state={{ libraryUrl: location.pathname + location.search, libraryState: location.state }}>
      <div className="decision-status">
        <StatusBadge status={decision.status} decisionState={decision.decisionState} />
      </div>
      <div className="decision-primary">
        <span className="decision-title">{headline(decision)}</span>
        <span className="decision-key">
          {decision.decisionKey}
          {decision.supersededBy?.length
            ? ` · Superseded by ${decision.supersededBy
                .map((item) => item.decisionKey)
                .join(", ")}`
            : ""}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {decision.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="bg-blue-50 text-blue-700"
            >
              {tag}
            </Badge>
          ))}
        </div>
        {decision.decisionState === "PENDING" || decision.dueDate ? <DecisionDeadline decision={decision} today={today} /> : null}
        {memoryMatch ? (
          <div className="mt-1 grid gap-1.5 rounded-md border border-blue-100 bg-blue-50/80 p-2.5 text-xs leading-5 text-blue-950">
            <span className="font-semibold">{method === "GEMINI" ? "Gemini AI match" : "Local semantic match"} · relevance {Math.round(memoryMatch.score)}/100</span>
            <span>{memoryMatch.explanation}</span>
            {memoryMatch.matchedConcepts.length ? (
              <span className="text-blue-700">
                {memoryMatch.matchedConcepts.join(" · ")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="decision-cell">
        <Box /> <span>{decision.appliesTo.join(" · ") || "—"}</span>
      </div>
      <div className="decision-why">
        {decision.why ?? "No rationale recorded."}
      </div>
      <div className="decision-cell">
        <Hash /> <span>{slackChannels(decision).join(", ") || "—"}</span>
      </div>
      <div className="decision-owner">
        <Avatar size="sm">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span>
          {decision.owner?.displayName ?? decision.ownerName ?? "Unassigned"}
        </span>
      </div>
      <div className="decision-cell text-primary">
        <FileText />{" "}
        <span>
          {decision.evidenceCount
            ? `${decision.evidenceCount} source`
            : "No source"}
        </span>
      </div>
      <div className="decision-date">
        <CalendarDays />
        {new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date(decision.createdAt))}
      </div>
      <ChevronRight className="decision-chevron" aria-hidden="true" />
    </Link>
  )
}

function LoadingRows() {
  return (
    <div className="grid border-y">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex gap-5 border-b py-6 last:border-b-0">
          <Skeleton className="h-5 w-24" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
