import {
  Box,
  CalendarDays,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Hash,
  Columns3,
  List,
  Bookmark,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom"

import { headline } from "../../../../shared/decision-deadlines.js"
import {
  LibraryMetadataFilter,
  ownerFilter,
  type ApplyMetadataFilter,
} from "@/components/library-metadata-filter"
import { RelatedDecisionPreview } from "@/components/related-decision-preview"
import { CurrentAnswers } from "@/components/current-answers"
import { CompletionReturn } from "@/components/completion-return"
import { DecisionActions } from "@/components/decision-actions"
import { DecisionBoard } from "@/components/decision-board"
import { SavedLibraryViews } from "@/components/saved-library-views"
import { browserStorageKey } from "@/lib/browser-storage"
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
import { recordSearch } from "@/lib/usage"
import type {
  Decision,
  MemorySearchMatch,
  MemorySearchMethod,
  MemorySearchResponse,
  Metadata,
} from "@/types"

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
  const serializedFilters = JSON.stringify(
    Object.fromEntries(
      Object.entries(initialFilters).map(([key, value]) => [
        key,
        searchParams.get(key) ?? value,
      ])
    )
  )
  // Changing presentation does not refetch the same dataset or flash loading rows.
  const filters = useMemo(
    () => JSON.parse(serializedFilters) as typeof initialFilters,
    [serializedFilters]
  )
  const setFilters = (next: typeof initialFilters) => {
    if (
      Object.entries(next).every(
        ([key, value]) => filters[key as keyof typeof filters] === value
      )
    )
      return
    latestRequest.current++
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (value === initialFilters[key as keyof typeof initialFilters])
        params.delete(key)
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
  useEffect(() => {
    navigationUrl.current = location.pathname + location.search
  }, [location.pathname, location.search])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [savedViewsOpen, setSavedViewsOpen] = useState(false)
  const [metadataError, setMetadataError] = useState(false)
  const [metadataAttempt, setMetadataAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  // Keyword searches count for the Dashboard only when submitted with Enter.
  const [loadedFor, setLoadedFor] = useState("")
  const submittedSearch = useRef<{ query: string; key: string } | null>(null)
  const [unhelpfulFor, setUnhelpfulFor] = useState("")
  const [error, setError] = useState("")
  const [memoryResult, setMemoryResult] = useState<MemorySearchResponse | null>(
    location.state?.memoryResult ?? null
  )
  const [memorySearching, setMemorySearching] =
    useState<MemorySearchMethod | null>(null)
  const [memoryError, setMemoryError] = useState("")
  const recentOnly = location.pathname === "/recent"
  const apiFilters = useMemo<DecisionFilters>(
    () => ({
      ...filters,
      status:
        filters.status === "PENDING" || filters.status === "DECIDED"
          ? "ACTIVE"
          : filters.status,
      decisionState:
        filters.status === "PENDING"
          ? "PENDING"
          : filters.status !== "ALL"
            ? "DECIDED"
            : "ALL",
      asOf: today,
      sort: recentOnly ? "NEWEST" : sort,
    }),
    [filters, today, sort, recentOnly]
  )
  const memoryAllowed =
    filters.status !== "PENDING" && filters.deadline === "ALL"
  const latestRequest = useRef(0)
  const memoryRequest = useRef(0)
  // Empty keyword results try local meaning search once per query/filter set.
  const filterKey = JSON.stringify(apiFilters)
  const [keywordEmptyFor, setKeywordEmptyFor] = useState("")
  const [autoMeaningEmptyFor, setAutoMeaningEmptyFor] = useState("")
  const meaningTriedFor = useRef("")
  const autoMeaning = useRef<(key: string) => void>(() => {})
  const identifierOnly = /^DM-\d+$/i.test(filters.q.trim())

  const applySavedView = (search: string) => {
    latestRequest.current++
    invalidateMemory()
    setSearchParams(new URLSearchParams(search), { state: null })
  }

  useEffect(
    () => () => {
      memoryRequest.current++
    },
    []
  )

  useEffect(() => {
    let active = true
    api
      .metadata()
      .then((value) => {
        if (active) {
          setMetadata(value)
          setMetadataError(false)
        }
      })
      .catch(() => {
        if (active) setMetadataError(true)
      })
    return () => {
      active = false
    }
  }, [metadataAttempt])

  const scopeForEvents = filters.appliesTo === "ALL" ? undefined : filters.appliesTo
  const recordKeywordSearch = useCallback((query: string, count: number) => recordSearch({
    query, scope: scopeForEvents, method: "KEYWORD", outcome: count ? "RESULTS" : "NO_RESULTS", resultCount: count,
  }), [scopeForEvents])

  const load = useCallback(async () => {
    // Ignore responses from searches the user has already typed past.
    const request = ++latestRequest.current
    setLoading(true)
    setError("")
    try {
      const decisionRows = await api.decisions(apiFilters)
      if (request !== latestRequest.current) return
      setDecisions(recentOnly ? decisionRows.slice(0, 5) : decisionRows)
      const loadedKey = JSON.stringify(apiFilters)
      setLoadedFor(loadedKey)
      if (submittedSearch.current?.key === loadedKey) {
        recordKeywordSearch(submittedSearch.current.query, decisionRows.length)
        submittedSearch.current = null
      }
      setKeywordEmptyFor(decisionRows.length ? "" : JSON.stringify(apiFilters))
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
  }, [apiFilters, recentOnly, recordKeywordSearch])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), filters.q ? 180 : 0)
    return () => window.clearTimeout(timeout)
  }, [load, filters.q])

  const invalidateMemory = () => {
    void navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    })
    memoryRequest.current++
    setMemorySearching(null)
    setMemoryResult(null)
    setMemoryError("")
  }

  const updateFilter = (key: keyof typeof filters, value: string) => {
    if (filters[key] === value) return
    invalidateMemory()
    setFilters({ ...filters, [key]: value })
    setMemoryResult(null)
    setMemoryError("")
  }
  const resetFilters = () => {
    invalidateMemory()
    setFilters({ ...initialFilters, q: filters.q })
    setMemoryResult(null)
    setMemoryError("")
  }

  const searchByMemory = async (
    method: MemorySearchMethod = "LOCAL",
    automatic = false
  ) => {
    const enabled =
      method === "GEMINI"
        ? metadata?.features.geminiMemorySearch
        : metadata?.features.memorySearch
    if (filters.q.trim().length < 3 || !enabled || !memoryAllowed) return
    const request = ++memoryRequest.current
    // Any meaning search for these filters, manual or automatic, stops the fallback.
    const key = filterKey
    meaningTriedFor.current = key
    void navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    })
    setMemorySearching(method)
    setMemoryResult(null)
    setMemoryError("")
    try {
      const result = await api.memorySearch(
        filters.q.trim(),
        apiFilters,
        method
      )
      if (request !== memoryRequest.current) return
      if (!automatic)
        recordSearch({
          query: filters.q,
          scope: filters.appliesTo === "ALL" ? undefined : filters.appliesTo,
          method,
          outcome: result.matches.length ? "RESULTS" : "NO_RESULTS",
          resultCount: result.matches.length,
        })
      if (automatic && !result.matches.length) {
        // Keep the keyword empty state; it says meaning search found nothing too.
        setAutoMeaningEmptyFor(key)
      } else {
        const labeledResult = { ...result, method, automatic }
        setMemoryResult(labeledResult)
        void navigate(navigationUrl.current, {
          replace: true,
          state: { memoryResult: labeledResult },
        })
      }
    } catch (searchError) {
      if (request !== memoryRequest.current) return
      setMemoryError(
        searchError instanceof Error
          ? searchError.message
          : "Find by meaning failed. Keyword search is still available; please retry."
      )
    } finally {
      if (request === memoryRequest.current) setMemorySearching(null)
    }
  }

  useEffect(() => {
    autoMeaning.current = (key) => {
      if (key === filterKey) void searchByMemory("LOCAL", true)
    }
  })
  const autoMeaningEligible =
    keywordEmptyFor === filterKey &&
    !identifierOnly &&
    !memoryResult &&
    !memorySearching &&
    !memoryError &&
    filters.q.trim().length >= 3 &&
    memoryAllowed &&
    Boolean(metadata?.features.memorySearch)
  useEffect(() => {
    if (!autoMeaningEligible || meaningTriedFor.current === filterKey) return
    // Local only: Gemini search always waits for its own explicit action.
    const timeout = window.setTimeout(() => autoMeaning.current(filterKey), 400)
    return () => window.clearTimeout(timeout)
  }, [autoMeaningEligible, filterKey])
  const autoMeaningEmpty = autoMeaningEmptyFor === filterKey

  const geminiResult = memoryResult?.method === "GEMINI"

  const displayedDecisions = memoryResult
    ? memoryResult.matches.map((match) => match.decision)
    : decisions
  const resultsLoading = loading && !memoryResult
  const feedbackKey = `${filterKey}:${memoryResult?.method ?? "KEYWORD"}`
  const unhelpfulAction =
    metadata?.features.usageTracking && filters.q.trim() && !resultsLoading && !memorySearching && !(error && !memoryResult) ? (
      unhelpfulFor === feedbackKey ? (
        <span className="text-xs font-normal text-muted-foreground" role="status">Noted for the team Dashboard</span>
      ) : (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs font-normal text-muted-foreground"
          onClick={() => {
            recordSearch({
              query: filters.q,
              scope: filters.appliesTo === "ALL" ? undefined : filters.appliesTo,
              method: memoryResult?.method ?? "KEYWORD",
              outcome: "UNHELPFUL",
              resultCount: displayedDecisions.length,
            })
            setUnhelpfulFor(feedbackKey)
          }}
        >
          Not what I needed
        </Button>
      )
    ) : null
  const resultsUnavailable = Boolean(error && !memoryResult)
  const matchesByDecision = new Map(
    (memoryResult?.matches ?? []).map((match) => [match.decisionId, match])
  )
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "q" && value !== "ALL"
  ).length

  const moreFilterCount =
    activeFilterCount - (filters.appliesTo !== "ALL" ? 1 : 0)
  const currentUserId = metadata?.currentUser?.id
  const assignedToMe = Boolean(
    currentUserId && filters.ownerId === currentUserId
  )
  const memoryHelp = !memoryAllowed
    ? "Use keyword search for pending questions and deadline filters."
    : filters.q.trim().length < 3
      ? "Type at least 3 characters for meaning search."
      : !metadata?.features.memorySearch
        ? "Meaning search unavailable. Use keyword search."
        : identifierOnly
          ? "Decision keys use keywords. Meaning search is optional."
          : "Local search also runs when keywords find nothing."

  const options = useMemo(
    () => ({
      channels: (metadata?.channels ?? []).map((channel) => ({
        label: `#${channel}`,
        value: channel,
      })),
      owners: [
        { label: "Unassigned", value: "UNASSIGNED" },
        ...(metadata?.users ?? []).map((user) => ({
          label: user.displayName,
          value: user.id,
        })),
        ...(metadata?.ownerNames ?? []).map((name) => ({
          label: `${name} (recorded name)`,
          value: `name:${name}`,
        })),
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
        searchable
        label="Channel"
        value={filters.channel}
        options={options.channels}
        onChange={(value) => updateFilter("channel", value)}
      />
      <FilterSelect
        searchable
        label="Owner"
        value={filters.ownerId}
        options={options.owners}
        onChange={(value) => updateFilter("ownerId", value)}
      />
      <FilterSelect
        searchable
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
        label="Deadline"
        value={filters.deadline}
        options={[
          { label: "Overdue", value: "OVERDUE" },
          { label: "Due soon", value: "DUE_SOON" },
          { label: "Upcoming", value: "UPCOMING" },
          { label: "No deadline", value: "UNSCHEDULED" },
        ]}
        onChange={(value) => updateFilter("deadline", value)}
      />
      <FilterSelect
        label="Created date"
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

  const shortcuts = [
    { label: "Current choices", status: "DECIDED", deadline: "ALL" },
    { label: "Pending", status: "PENDING", deadline: "ALL" },
    { label: "Overdue", status: "PENDING", deadline: "OVERDUE" },
    { label: "Due soon", status: "PENDING", deadline: "DUE_SOON" },
  ]
  const selectedShortcut = shortcuts.find(
    (item) =>
      item.status ===
        (filters.status === "ACTIVE" ? "DECIDED" : filters.status) &&
      item.deadline === filters.deadline
  )?.label
  const filterLabels: Record<string, string> = {
    channel: "Channel",
    ownerId: "Owner",
    tag: "Tag",
    status: "Status",
    appliesTo: "Applies To",
    dateRange: "Created date",
    deadline: "Deadline",
  }
  const chipValue = (key: string, value: string) => {
    if (key === "ownerId")
      return (
        options.owners.find((option) => option.value === value)?.label ?? value
      )
    if (key === "channel") return `#${value}`
    if (key === "dateRange") return `Last ${value} days`
    if (key === "status")
      return (
        {
          ACTIVE: "Decided",
          DECIDED: "Decided",
          PENDING: "Pending",
          SUPERSEDED: "Superseded",
        }[value] ?? value
      )
    if (key === "deadline")
      return (
        {
          OVERDUE: "Overdue",
          DUE_SOON: "Due soon",
          UPCOMING: "Upcoming",
          UNSCHEDULED: "No deadline",
        }[value] ?? value
      )
    return value
  }

  const onSaved = (saved: Decision) => {
    if (memoryResult) {
      const next = {
        ...memoryResult,
        matches: memoryResult.matches.map((match) =>
          match.decisionId === saved.id ? { ...match, decision: saved } : match
        ),
      }
      setMemoryResult(next)
      void navigate(navigationUrl.current, {
        replace: true,
        state: { memoryResult: next },
      })
    }
    void load()
  }

  // The Search options overlay closes on outside clicks and Escape.
  const searchOptions = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (event: Event) => {
      const details = searchOptions.current
      if (!details?.open) return
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return
        details.open = false
        details.querySelector("summary")?.focus()
      } else if (!details.contains(event.target as Node)) details.open = false
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", close)
    }
  }, [])

  // Browser Back/Forward can change filters without a control's handler.
  const clearSearchOnHistory = useCallback(() => {
    memoryRequest.current++
    setMemoryResult(null)
    setMemorySearching(null)
    setMemoryError("")
  }, [])
  useEffect(() => {
    window.addEventListener("popstate", clearSearchOnHistory)
    return () => window.removeEventListener("popstate", clearSearchOnHistory)
  }, [clearSearchOnHistory])

  const recordQuestionAction = (<Button variant="outline" render={<Link to="/decisions/new" state={{ questionPrefill: filters.q, scopePrefill: filters.appliesTo === "ALL" ? undefined : filters.appliesTo, libraryUrl: location.pathname + location.search }} />} nativeButton={false}>Record unanswered question</Button>)
  const reviewProposalAction = (<Button variant="outline" render={<Link to="/check-proposal" state={{ proposalDraft: { proposal: filters.q, appliesTo: filters.appliesTo === "ALL" ? "" : filters.appliesTo }, proposalOrigin: location.pathname + location.search }} />} nativeButton={false}>Check a proposal against evidence</Button>)

  return (
    <div className="page-frame library-page">
      <CompletionReturn onSaved={onSaved} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1>{recentOnly ? "Recent Decisions" : "Decision Library"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <CompareDecisionsDialog compact />
          <Button
            render={
              <Link
                to="/decisions/new"
                state={{
                  scopePrefill:
                    filters.appliesTo === "ALL" ? undefined : filters.appliesTo,
                  libraryUrl: location.pathname + location.search,
                  libraryState: location.state,
                }}
              />
            }
            nativeButton={false}
            size="lg"
            className="max-sm:size-11 max-sm:p-0"
            title="New Decision"
          >
            <Plus data-icon="inline-start" />
            <span className="max-sm:sr-only">New Decision</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 items-start gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-y-2">
        <InputGroup className="col-span-2 h-11 rounded-lg border-border bg-background sm:col-span-1">
          <InputGroupInput
            aria-label="Search decisions"
            placeholder="Search decisions or evidence…"
            value={filters.q}
            onChange={(event) => updateFilter("q", event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !filters.q.trim() || memoryResult) return
              if (!loading && loadedFor === filterKey) recordKeywordSearch(filters.q, decisions.length)
              else submittedSearch.current = { query: filters.q.trim(), key: filterKey }
            }}
            className="h-10 px-1 text-base"
          />
          <InputGroupAddon align="inline-start" className="pl-4">
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <Button
          variant="outline"
          size="lg"
          className="h-11"
          title="Find by meaning"
          onClick={() => void searchByMemory()}
          disabled={
            Boolean(memorySearching) ||
            filters.q.trim().length < 3 ||
            !memoryAllowed ||
            !metadata?.features.memorySearch
          }
          aria-describedby="meaning-search-help"
        >
          <Sparkles data-icon="inline-start" />
          {memorySearching === "LOCAL"
            ? "Finding by meaning…"
            : "Find by meaning"}
        </Button>
        {/* Opens as an overlay so the search row keeps its height. */}
        <details ref={searchOptions} className="relative min-w-0 text-sm">
          <summary className="flex h-11 cursor-pointer items-center justify-center rounded-lg border px-3 font-medium focus-visible:outline-2 focus-visible:outline-ring">
            Search options
          </summary>
          <div className="absolute top-full right-0 z-20 mt-2 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg">
            <p
              id="gemini-search-help"
              className="text-xs leading-5 text-muted-foreground"
            >
              Gemini sends your query and excerpts from up to the newest 200
              decisions matching your filters to Google. AI can miss or misrank
              results.
              {!memoryAllowed
                ? " Use keyword search for pending questions and deadline filters."
                : ""}
              {filters.q.trim().length < 3
                ? " Enter at least 3 characters."
                : ""}
              {!metadata?.features.geminiMemorySearch
                ? " Gemini search is unavailable because it is not configured or its availability could not be checked."
                : ""}
            </p>
            <Button
              variant="outline"
              onClick={() => void searchByMemory("GEMINI")}
              disabled={
                Boolean(memorySearching) ||
                !memoryAllowed ||
                filters.q.trim().length < 3 ||
                !metadata?.features.geminiMemorySearch
              }
              aria-describedby="gemini-search-help"
            >
              {memorySearching === "GEMINI"
                ? "Searching Gemini…"
                : "Search with Gemini"}
            </Button>
          </div>
        </details>
        <p
          id="meaning-search-help"
          className="col-span-2 text-xs leading-5 text-muted-foreground sm:col-span-3"
        >
          {memoryHelp}
        </p>
      </div>

      {memoryError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {memoryError}
        </div>
      ) : null}

      {memoryResult ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-background">
              <Sparkles />{" "}
              {geminiResult ? "Gemini AI match" : "Local semantic match"}
            </Badge>
            <span className="text-foreground/80">
              {memoryResult.automatic
                ? "No exact keyword matches, so we searched by meaning. "
                : ""}
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
            Back to keyword results
          </Button>
        </div>
      ) : null}

      {metadataError ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <span>
            Could not load filter options. Your selected filters are kept.
          </span>
          <Button
            variant="outline"
            onClick={() => setMetadataAttempt((value) => value + 1)}
          >
            Retry filter options
          </Button>
        </div>
      ) : null}
      {/* One toolbar: filters on the left, presentation on the right. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          {!recentOnly ? (
            <>
              <ToggleGroup
                aria-label="Quick filters"
                variant="outline"
                spacing={1}
                className="library-quick-filters max-sm:basis-full"
                value={selectedShortcut ? [selectedShortcut] : []}
                onValueChange={(values) => {
                  const next = shortcuts.find(
                    (item) => item.label === values[0]
                  )
                  if (!next || next.label === selectedShortcut) return
                  invalidateMemory()
                  setFilters({
                    ...filters,
                    status: next.status,
                    deadline: next.deadline,
                  })
                }}
              >
                {shortcuts.map((item) => (
                  <ToggleGroupItem
                    key={item.label}
                    value={item.label}
                    className="max-sm:px-1.5"
                  >
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Button
                variant={assignedToMe ? "secondary" : "outline"}
                size="sm"
                aria-pressed={assignedToMe}
                disabled={!currentUserId}
                aria-describedby={
                  !currentUserId ? "assignment-help" : undefined
                }
                onClick={() =>
                  updateFilter("ownerId", assignedToMe ? "ALL" : currentUserId!)
                }
              >
                Assigned to me
              </Button>
            </>
          ) : null}
          <FilterSelect
            searchable
            label="Applies To"
            value={filters.appliesTo}
            options={options.appliesTo}
            onChange={(value) => updateFilter("appliesTo", value)}
          />
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>
              <SlidersHorizontal />
              <span className="max-sm:sr-only">More filters</span>
              {moreFilterCount ? ` (${moreFilterCount})` : ""}
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85svh] rounded-t-lg">
              <SheetHeader>
                <SheetTitle>More filters</SheetTitle>
                <SheetDescription>
                  Combine filters to narrow the library.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-3 overflow-auto px-4 sm:grid-cols-2 lg:grid-cols-3 [&_[data-slot=combobox-trigger]]:w-full [&_[data-slot=select-trigger]]:w-full">
                {filterControls}
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          {activeFilterCount > 0 ? (
            <Button variant="link" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
      {!recentOnly && !currentUserId ? (
        <p id="assignment-help" className="text-xs text-muted-foreground">
          Assigned to me is unavailable because your signed-in identity could
          not be loaded. Other filters are still available.
        </p>
      ) : null}
      {activeFilterCount > 0 ? (
        <div
          aria-label="Active filters"
          className="flex flex-wrap items-center gap-2"
        >
          {Object.entries(filters)
            .filter(([key, value]) => key !== "q" && value !== "ALL")
            .map(([key, value]) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                className="h-auto max-w-full py-1.5"
                aria-label={`Remove ${filterLabels[key]} filter`}
                onClick={() => updateFilter(key as keyof typeof filters, "ALL")}
              >
                <span className="min-w-0 break-words whitespace-normal">
                  {filterLabels[key]}: {chipValue(key, value)}
                </span>
                <X data-icon="inline-end" />
              </Button>
            ))}
        </div>
      ) : null}

      <div className="library-results-toolbar">
        <span className="text-sm font-semibold" role="status" aria-live="polite" aria-atomic="true">
          {resultsLoading ? <>Loading…<span className="sr-only"> decisions</span></> : resultsUnavailable
            ? "Unavailable"
            : memorySearching ? "Searching…"
            : `${displayedDecisions.length} decision${displayedDecisions.length === 1 ? "" : "s"}`}
          {memoryResult ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · best match first
            </span>
          ) : null}
        </span>
        {unhelpfulAction}
        {!recentOnly && view === "flat" && !memoryResult ? (
          <FilterSelect
            label="Sort"
            includeAll={false}
            value={sort}
            options={[
              { label: "Newest first", value: "NEWEST" },
              { label: "Earliest deadline first", value: "DEADLINE" },
            ]}
            onChange={(value) => setPresentation("sort", value)}
          />
        ) : null}
        {!recentOnly ? (
          <ToggleGroup
            aria-label="Library view"
            variant="outline"
            spacing={0}
            value={[view]}
            onValueChange={(values) => {
              if (values[0]) setPresentation("view", values[0])
            }}
          >
            <ToggleGroupItem value="flat" className="max-sm:w-11">
              <List />
              <span className="max-sm:sr-only">Flat</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" className="max-sm:w-11">
              <Columns3 />
              <span className="max-sm:sr-only">Kanban</span>
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}
        {!recentOnly && metadata?.currentUser?.id ? (
          <Button
            variant="outline"
            className="size-11 p-0 lg:hidden"
            aria-label="Show saved views"
            title="Saved views"
            aria-expanded={savedViewsOpen}
            aria-controls="library-saved-views"
            onClick={() => setSavedViewsOpen((open) => !open)}
          >
            <Bookmark />
          </Button>
        ) : null}
        {!recentOnly && metadata?.currentUser?.id ? (
          <div
            id="library-saved-views"
            className={
              savedViewsOpen
                ? "library-saved-views"
                : "library-saved-views hidden lg:block"
            }
          >
            <SavedLibraryViews
              key={browserStorageKey(metadata, "library-views")}
              storageKey={browserStorageKey(metadata, "library-views")}
              search={location.search}
              onApply={applySavedView}
            />
          </div>
        ) : null}
      </div>

      {!recentOnly && filters.q.trim() && !resultsLoading && !resultsUnavailable && displayedDecisions.length ? <section aria-label="Search next steps" className="search-next-steps">
        <CurrentAnswers ids={displayedDecisions.map(d => d.id)} scope={filters.appliesTo === "ALL" ? undefined : filters.appliesTo} />
        <details className="search-actions">
          <summary>Record a question or check a proposal</summary>
          <div className="flex flex-wrap gap-2 pt-3">
            {recordQuestionAction}
            {reviewProposalAction}
          </div>
        </details>
      </section> : null}

      <section aria-label="Decision results" aria-busy={Boolean(resultsLoading || memorySearching)} className="min-w-0">
      {resultsUnavailable ? (
        <Empty role="alert" className="items-start justify-start gap-4 rounded-lg border border-solid p-4 text-left sm:p-5">
          <EmptyHeader className="items-start">
            <EmptyTitle>Could not load the Decision Library</EmptyTitle>
            <EmptyDescription>
              {error} Your query and filters are kept.
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void load()}>Try again</Button>
            {!recentOnly && filters.q.trim() ? recordQuestionAction : null}
          </div>
          {!recentOnly && filters.q.trim() ? <details className="text-sm"><summary className="cursor-pointer py-2">Other search actions</summary><div className="pt-2">{reviewProposalAction}</div></details> : null}
        </Empty>
      ) : resultsLoading ? (
        <LoadingRows previous={decisions} />
      ) : !recentOnly && view === "kanban" && displayedDecisions.length ? (
        <DecisionBoard
          key={location.search.replace(/(?:\?|&)view=[^&]+/, "")}
          decisions={displayedDecisions}
          today={today}
          matches={matchesByDecision}
          onSaved={onSaved}
          onFilter={updateFilter}
        />
      ) : displayedDecisions.length ? (
        <DecisionList
          decisions={displayedDecisions}
          today={today}
          matches={matchesByDecision}
          method={memoryResult?.method ?? "LOCAL"}
          onSaved={onSaved}
          onFilter={updateFilter}
        />
      ) : (
        <Empty className="items-start justify-start gap-4 rounded-lg border border-solid p-4 text-left sm:p-5">
          <EmptyHeader className="items-start">
            <EmptyTitle role="heading" aria-level={2}>
              {memoryResult
                ? "No memory matches in the searched decisions"
                : identifierOnly
                  ? "No matching decision under these filters."
                  : activeFilterCount || filters.q.trim()
                    ? "No decisions match these filters"
                    : "No decisions yet"}
            </EmptyTitle>
            <EmptyDescription>
              {memoryResult
                ? "No matches were found in the searched records. Try keyword search or broaden your filters."
                : identifierOnly && !memorySearching
                  ? "Check the key or adjust your filters. You can still search by meaning explicitly."
                  : memorySearching === "LOCAL"
                    ? "No exact keyword matches. Searching by meaning on this computer…"
                    : autoMeaningEmpty
                      ? "Find by meaning also found nothing similar. Try different words or remove a filter."
                      : activeFilterCount || filters.q.trim()
                        ? "Try different words or remove a filter."
                        : "Capture a pending question or a choice your team has already made."}
              {filters.q.trim() && !memorySearching ? " No result is not approval." : ""}
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex flex-wrap gap-2">
            {!recentOnly && filters.q.trim() && !memorySearching ? recordQuestionAction : null}
            {!recentOnly && filters.q.trim() && !memorySearching ? reviewProposalAction : null}
            {memoryResult ? (
              <Button
                variant="outline"
                onClick={invalidateMemory}
                aria-label="Back to keyword results from empty search"
              >
                Back to keyword results
              </Button>
            ) : null}
            {!memoryResult &&
            !autoMeaningEmpty &&
            filters.q.trim().length >= 3 &&
            memoryAllowed &&
            metadata?.features.memorySearch ? (
              <Button
                variant="outline"
                disabled={Boolean(memorySearching)}
                aria-label="Find by meaning in empty results"
                onClick={() => void searchByMemory()}
              >
                {memorySearching ? "Finding by meaning…" : "Find by meaning"}
              </Button>
            ) : null}
            {filters.dateRange !== "ALL" ? (
              <Button
                variant="outline"
                onClick={() => updateFilter("dateRange", "ALL")}
              >
                Remove date filter
              </Button>
            ) : null}
            {filters.appliesTo !== "ALL" ? (
              <Button
                variant="outline"
                onClick={() => updateFilter("appliesTo", "ALL")}
              >
                Search all scopes
              </Button>
            ) : null}
            {activeFilterCount > 0 ? (
              <Button variant="outline" onClick={resetFilters}>
                {identifierOnly && !memoryResult
                  ? "Clear filters and keep this key"
                  : "Clear non-search filters"}
              </Button>
            ) : null}
            {filters.q ? (
              <Button variant="outline" onClick={() => updateFilter("q", "")}>
                Clear search text
              </Button>
            ) : null}
            <Button
              render={
                <Link
                  to="/decisions/new"
                  state={{
                    libraryUrl: location.pathname + location.search,
                    libraryState: location.state,
                    scopePrefill:
                      filters.appliesTo === "ALL"
                        ? undefined
                        : filters.appliesTo,
                  }}
                />
              }
              nativeButton={false}
            >
              New Decision
            </Button>
          </div>
        </Empty>
      )}
      </section>
    </div>
  )
}

function DecisionList({
  decisions,
  matches,
  method,
  today,
  onSaved,
  onFilter,
}: {
  onFilter: ApplyMetadataFilter
  onSaved: (decision: Decision) => void
  today: string
  decisions: Decision[]
  matches: Map<string, MemorySearchMatch>
  method: MemorySearchMethod
}) {
  return (
    <div className="decision-list">
      {decisions.map((decision) => (
        <DecisionRow
          key={decision.id}
          decision={decision}
          memoryMatch={matches.get(decision.id)}
          method={method}
          today={today}
          onSaved={onSaved}
          onFilter={onFilter}
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
  onSaved,
  onFilter,
}: {
  onFilter: ApplyMetadataFilter
  onSaved: (decision: Decision) => void
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
    <article className="decision-row" aria-label={decision.decisionKey}>
      <div className="decision-status">
        <StatusBadge
          status={decision.status}
          decisionState={decision.decisionState}
        />
        <span className="decision-key">
          {decision.decisionKey}
          {decision.supersededBy?.length
            ? ` · Superseded by ${decision.supersededBy
                .map((item) => item.decisionKey)
                .join(", ")}`
            : ""}
        </span>
      </div>
      <div className="decision-primary">
        <Link
          className="decision-title rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          to={`/decisions/${decision.id}`}
          state={{
            libraryUrl: location.pathname + location.search,
            libraryState: location.state,
          }}
        >
          {headline(decision)}
        </Link>
        {decision.decisionState === "PENDING" || decision.dueDate ? (
          <div className="decision-pending-line">
            <DecisionDeadline decision={decision} today={today} />
            {decision.decisionState === "PENDING" ? (
              <DecisionActions decision={decision} onSaved={onSaved} secondary />
            ) : null}
          </div>
        ) : null}
        {memoryMatch ? (
          <div className="mt-1 grid gap-1.5 rounded-md bg-muted p-2.5 text-xs leading-5 text-foreground">
            <span className="font-semibold">
              {method === "GEMINI" ? "Gemini AI match" : "Local semantic match"}{" "}
              · relevance {Math.round(memoryMatch.score)}/100
            </span>
            <span>{memoryMatch.explanation}</span>
            {memoryMatch.matchedConcepts.length ? (
              <span className="text-muted-foreground">
                {memoryMatch.matchedConcepts.join(" · ")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {decision.why ? <p className="decision-why">{decision.why}</p> : null}
      <div className="decision-metadata">
        <RelatedDecisionPreview
          decision={decision}
          context="library"
          origin={{
            libraryUrl: location.pathname + location.search,
            libraryState: location.state,
          }}
        />
        {decision.appliesTo.length ? (
          <span className="decision-cell">
            <Box aria-hidden="true" />
            <span className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
              {decision.appliesTo.map((scope) => (
                <LibraryMetadataFilter
                  key={scope}
                  field="appliesTo"
                  value={scope}
                  label={`Applies To to ${scope}`}
                  onFilter={onFilter}
                >
                  {scope}
                </LibraryMetadataFilter>
              ))}
            </span>
          </span>
        ) : null}
        <span className="decision-owner">
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <LibraryMetadataFilter
            field="ownerId"
            value={ownerFilter(decision)}
            label={`Owner to ${ownerLabel || "Unassigned"}${!decision.owner && decision.ownerName ? " (recorded name)" : ""}`}
            onFilter={onFilter}
          >
            {ownerLabel || "Unassigned"}
          </LibraryMetadataFilter>
        </span>
        <span className="decision-date">
          <CalendarDays aria-hidden="true" />
          <time dateTime={decision.createdAt}>
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(decision.createdAt))}
          </time>
        </span>
        {slackChannels(decision).length ? (
          <span className="decision-cell">
            <Hash aria-hidden="true" />
            <span className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
              {slackChannels(decision).map((channel) => (
                <LibraryMetadataFilter
                  key={channel}
                  field="channel"
                  value={channel.slice(1)}
                  label={`Channel to ${channel}`}
                  onFilter={onFilter}
                >
                  {channel}
                </LibraryMetadataFilter>
              ))}
            </span>
          </span>
        ) : null}
        {decision.evidenceCount > 0 ? (
          <span className="decision-cell">
            <FileText aria-hidden="true" />
            <span>
              {decision.evidenceCount} source
              {decision.evidenceCount === 1 ? "" : "s"}
            </span>
          </span>
        ) : null}
        {decision.tags.length ? (
          <span className="flex flex-wrap gap-1.5">
            {decision.tags.map((tag) => (
              <LibraryMetadataFilter
                key={tag}
                field="tag"
                value={tag}
                label={`Tag to ${tag}`}
                onFilter={onFilter}
              >
                {tag}
              </LibraryMetadataFilter>
            ))}
          </span>
        ) : null}
      </div>
    </article>
  )
}

function LoadingRows({ previous }: { previous: Decision[] }) {
  const rows = previous.length ? previous.slice(0, 6) : Array.from({ length: 4 }, () => null)
  return (
    <div className="decision-list" aria-hidden="true">
      {rows.map((row, index) => (
        <div key={index} className="decision-loading-row">
          <Skeleton className="h-5 w-20" />
          <div className="decision-primary">
            <Skeleton className="h-5 w-4/5 max-w-lg" />
            <Skeleton className="h-4 w-16" />
          </div>
          {row?.decisionState === "PENDING" || !row ? <>
            <div className="grid gap-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /></div>
            <div className="flex gap-2"><Skeleton className="h-11 w-28 sm:h-7" /><Skeleton className="h-11 w-24 sm:h-7" /></div>
          </> : row.why ? <Skeleton className="h-4 w-5/6" /> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Skeleton className="h-11 w-16 sm:h-7" /><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
