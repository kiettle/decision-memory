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
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"

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
import type { Decision, MemorySearchMatch, MemorySearchResponse, Metadata } from "@/types"

const initialFilters: Required<DecisionFilters> = {
  q: "",
  channel: "ALL",
  ownerId: "ALL",
  tag: "ALL",
  status: "ALL",
  appliesTo: "ALL",
  dateRange: "ALL",
}

export function LibraryPage() {
  const location = useLocation()
  const [filters, setFilters] = useState(initialFilters)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [memoryResult, setMemoryResult] = useState<MemorySearchResponse | null>(null)
  const [memorySearching, setMemorySearching] = useState(false)
  const [memoryError, setMemoryError] = useState("")
  const recentOnly = location.pathname === "/recent"
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
      const decisionRows = await api.decisions(filters)
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
  }, [filters, recentOnly])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), filters.q ? 180 : 0)
    return () => window.clearTimeout(timeout)
  }, [load, filters.q])

  const invalidateMemory = () => {
    memoryRequest.current++
    setMemorySearching(false)
    setMemoryResult(null)
    setMemoryError("")
  }

  const updateFilter = (key: keyof typeof filters, value: string) => {
    invalidateMemory()
    setFilters((current) => ({ ...current, [key]: value }))
    setMemoryResult(null)
    setMemoryError("")
  }
  const resetFilters = () => {
    invalidateMemory()
    setFilters(initialFilters)
    setMemoryResult(null)
    setMemoryError("")
  }

  const searchByMemory = async () => {
    if (filters.q.trim().length < 3 || !metadata?.features.memorySearch) return
    const request = ++memoryRequest.current
    setMemorySearching(true)
    setMemoryError("")
    try {
      const result = await api.memorySearch(filters.q.trim(), filters)
      if (request === memoryRequest.current) setMemoryResult(result)
    } catch (searchError) {
      if (request !== memoryRequest.current) return
      setMemoryError(
        searchError instanceof Error
          ? searchError.message
          : "Search by memory failed. Normal search is still available; please retry."
      )
    } finally {
      if (request === memoryRequest.current) setMemorySearching(false)
    }
  }

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
        value={filters.status}
        options={[
          { label: "Active", value: "ACTIVE" },
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

  return (
    <div className="page-frame">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Shared product record</p>
          <h1>{recentOnly ? "Recent Decisions" : "Decision Library"}</h1>
        </div>
        <Button
          render={<Link to="/decisions/new" />}
          nativeButton={false}
          size="lg"
        >
          <Plus data-icon="inline-start" />
          New Decision
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <InputGroup className="h-13 rounded-lg border-border bg-white">
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
            memorySearching ||
            filters.q.trim().length < 3 ||
            !metadata?.features.memorySearch
          }
          title={
            metadata && !metadata.features.memorySearch
              ? "Add GEMINI_API_KEY to enable Search by memory."
              : undefined
          }
        >
          <Sparkles data-icon="inline-start" />
          {memorySearching ? "Searching memory…" : "Search by memory"}
        </Button>
        {metadata && !metadata.features.memorySearch ? (
          <p className="text-xs text-muted-foreground sm:col-start-2 sm:text-right">
            Add GEMINI_API_KEY to enable AI-assisted search.
          </p>
        ) : null}
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
              <Sparkles /> AI-assisted match
            </Badge>
            <span className="text-slate-700">
              Ranked by meaning from {memoryResult.candidateCount} stored decisions.
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

      <div className="result-bar">
        <span>
          {loading
            ? "Loading decisions…"
            : `${displayedDecisions.length} decision${displayedDecisions.length === 1 ? "" : "s"}`}
        </span>
        <span className="font-normal text-muted-foreground">Newest first</span>
      </div>

      {error ? (
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
      ) : loading ? (
        <LoadingRows />
      ) : displayedDecisions.length ? (
        <DecisionList decisions={displayedDecisions} matches={matchesByDecision} />
      ) : (
        <Empty className="border-y py-20">
          <EmptyHeader>
            <EmptyTitle>No decisions match these filters</EmptyTitle>
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
}: {
  decisions: Decision[]
  matches: Map<string, MemorySearchMatch>
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
        <span>Date</span>
        <span />
      </div>
      {decisions.map((decision) => (
        <DecisionRow
          key={decision.id}
          decision={decision}
          memoryMatch={matches.get(decision.id)}
        />
      ))}
    </div>
  )
}

function DecisionRow({
  decision,
  memoryMatch,
}: {
  decision: Decision
  memoryMatch?: MemorySearchMatch
}) {
  const ownerLabel = decision.owner?.displayName ?? decision.ownerName
  const initials =
    ownerLabel
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2) || "—"
  return (
    <Link className="decision-row" to={`/decisions/${decision.id}`}>
      <div className="decision-status">
        <StatusBadge status={decision.status} />
      </div>
      <div className="decision-primary">
        <span className="decision-title">{decision.title}</span>
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
        {memoryMatch ? (
          <div className="mt-1 grid gap-1.5 rounded-md border border-blue-100 bg-blue-50/80 p-2.5 text-xs leading-5 text-blue-950">
            <span className="font-semibold">AI-assisted match · {Math.round(memoryMatch.score)}%</span>
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
