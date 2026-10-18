import {
  ArrowLeft,
  ArrowRight,
  Box,
  CalendarDays,
  ExternalLink,
  Hash,
  Link2,
  MessageSquare,
  Pencil,
  RefreshCcw,
  Tag,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { toast } from "sonner"

import { headline } from "../../../../shared/decision-deadlines.js"
import { useLocalDate } from "@/hooks/use-local-date"
import { CompletionReturn } from "@/components/completion-return"
import { DecisionActions } from "@/components/decision-actions"
import { CopyDecisionSummary } from "@/components/copy-decision-summary"
import { DecisionDeadline } from "@/components/decision-deadline"
import { CompareDecisionsDialog } from "@/components/compare-decisions-dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { comparisonHref, recordedDate, scopeHref } from "@/lib/decision-links"
import { CreateJiraIssueDialog } from "@/components/create-jira-issue-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { slackChannels } from "@/lib/slack"
import type { Decision, SourceMessage, SourceSnapshot } from "@/types"

export function DecisionDetailPage() {
  const { id = "" } = useParams()
  return <DecisionDetail key={id} id={id} />
}

function DecisionDetail({ id }: { id: string }) {
  const location = useLocation()
  const today = useLocalDate()
  const libraryState = location.state?.libraryState ?? null
  const libraryUrl = typeof location.state?.libraryUrl === "string" ? location.state.libraryUrl : "/"
  const [decision, setDecision] = useState<Decision | null>(null)
  const [candidates, setCandidates] = useState<Decision[]>([])
  const [suggestedIds, setSuggestedIds] = useState<string[]>([])
  const [targetId, setTargetId] = useState("")
  const [replacementReason, setReplacementReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)
  const [candidateError, setCandidateError] = useState("")
  const [superseding, setSuperseding] = useState(false)
  const [supersedeOpen, setSupersedeOpen] = useState(false)
  const [jiraEnabled, setJiraEnabled] = useState(false)

  useEffect(() => {
    let active = true
    api
      .metadata()
      .then((metadata) => {
        if (active) setJiraEnabled(metadata.features.jira)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    void api.decision(id)
      .then((detail) => { if (active) setDecision(detail) })
      .catch((error) => {
        if (active) setError(error instanceof Error ? error.message : "Could not load the Decision.")
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [id, reload])

  const query = decision ? headline(decision) : ""
  useEffect(() => {
    if (!supersedeOpen) return
    let active = true
    void api.decisions({ status: "ACTIVE", decisionState: "DECIDED" })
      .then((rows) => { if (active) setCandidates(rows.filter((row) => row.id !== id)) })
      .catch(() => { if (active) setCandidateError("Could not load active Decisions. Close and reopen to retry.") })
    // Similar active choices are likely the one being replaced; local search only.
    if (query.trim().length >= 3) {
      void api.memorySearch(query, {}, "LOCAL")
        .then((result) => {
          if (active) setSuggestedIds(result.matches
            .filter((match) => match.decisionId !== id && match.decision.status === "ACTIVE" && match.decision.decisionState === "DECIDED")
            .slice(0, 3).map((match) => match.decisionId))
        })
        .catch(() => undefined)
    }
    return () => { active = false }
  }, [id, supersedeOpen, query])

  const created = useMemo(
    () =>
      decision
        ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
            new Date(decision.createdAt)
          )
        : "",
    [decision]
  )

  async function supersede() {
    if (!targetId || !decision) return
    setSuperseding(true)
    try {
      await api.supersede(decision.id, targetId, replacementReason)
      toast.success("Lifecycle updated.")
      setSupersedeOpen(false)
      setTargetId("")
      setDecision(await api.decision(id))
      setCandidates([])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not supersede the Decision."
      )
    } finally {
      setSuperseding(false)
    }
  }

  if (loading) return <DetailSkeleton />
  if (!decision) {
    return (
      <div className="page-frame">
        <h1>Could not load Decision</h1>
        <p role="alert">{error || "Decision not found."}</p>
        <Button className="w-fit" onClick={() => { setLoading(true); setError(""); setReload((value) => value + 1) }}>Try again</Button>
        <Button className="w-fit" variant="outline" render={<Link to={libraryUrl} state={libraryState} />} nativeButton={false}>
          Return to library
        </Button>
      </div>
    )
  }

  const ownerLabel = decision.owner?.displayName ?? decision.ownerName
  // Where the discussion happened, filled in automatically by Slack capture.
  const channels = slackChannels(decision)
  const initials =
    ownerLabel
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2) || "—"
  return (
    <div className="page-frame max-w-[1240px]">
      <CompletionReturn onSaved={setDecision} />
      <div className="detail-topbar flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          render={<Link to={libraryUrl} state={libraryState} />}
          nativeButton={false}
          className="-ml-2"
        >
          <ArrowLeft /> Back to decisions
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <CopyDecisionSummary decision={decision} />
          <CopyDecisionSummary decision={decision} linkOnly />
          {/* Decided records keep any historical deadline but no deadline action. */}
          {decision.decisionState === "PENDING" ? (
            <DecisionActions decision={decision} onSaved={setDecision} />
          ) : null}
          <CompareDecisionsDialog decision={decision} />
          <CreateJiraIssueDialog
            decision={decision}
            enabled={jiraEnabled}
            onCreated={setDecision}
          />
          {decision.status === "ACTIVE" && decision.decisionState !== "PENDING" ? (
            <SupersedeDialog
              open={supersedeOpen}
              onOpenChange={(open) => {
                setSupersedeOpen(open)
                setCandidates([])
                setSuggestedIds([])
                setCandidateError("")
                setTargetId("")
                setReplacementReason("")
              }}
              decision={decision}
              replacementReason={replacementReason}
              setReplacementReason={setReplacementReason}
              candidates={candidates}
              suggestedIds={suggestedIds}
              targetId={targetId}
              setTargetId={setTargetId}
              onConfirm={supersede}
              loading={superseding}
              error={candidateError}
            />
          ) : null}
          <Button
            variant="outline"
            render={<Link to={`/decisions/${decision.id}/edit`} state={location.state} />}
            nativeButton={false}
          >
            <Pencil /> Edit
          </Button>
        </div>
      </div>

      <div className="detail-title-block">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={decision.status} decisionState={decision.decisionState} />
          <span className="decision-key">{decision.decisionKey}</span>
        </div>
        <h1>{headline(decision)}</h1>
        <p>
          {decision.decisionState === "PENDING" ? "Created" : "Recorded"} {created}
          {decision.owner?.displayName || decision.ownerName
            ? ` · Owned by ${decision.owner?.displayName ?? decision.ownerName}`
            : ""}
          {channels.length ? ` · Discussed in ${channels.join(", ")}` : ""}
        </p>
      </div>

      {decision.decisionState === "PENDING" || decision.dueDate ? <DecisionDeadline decision={decision} today={today} /> : null}

      {decision.lifecycle?.supersededBy.map((item) => (
        <Link
          key={item.id}
          to={`/decisions/${item.id}`}
          state={{ libraryUrl, libraryState }}
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 hover:bg-amber-100"
        >
          <RefreshCcw aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            This Decision was replaced by{" "}
            <strong>{item.decisionKey}</strong> · {headline(item)}
          </span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      ))}

      {decision.lifecycle?.current?.map((item) => (
        <Link key={item.id} to={`/decisions/${item.id}`} state={{ libraryUrl, libraryState }} className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <span className="min-w-0 flex-1">Current active Decision: <strong>{item.decisionKey}</strong> · {headline(item)}</span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      ))}

      {decision.lifecycle?.supersedes.length || decision.lifecycle?.supersededBy.length ? (
        <section aria-label="Decision evolution" className="grid gap-4 border-y py-5">
          <h2 className="text-lg font-semibold">Why did this change?</h2>
          {[
            ...(decision.lifecycle.supersedes.map((item) => ({ item, earlierId: item.id, newerId: decision.id, label: `Replaces ${item.decisionKey}` }))),
            ...(decision.lifecycle.supersededBy.map((item) => ({ item, earlierId: decision.id, newerId: item.id, label: `Replaced by ${item.decisionKey}` }))),
          ].map(({ item, earlierId, newerId, label }) => <div key={`${earlierId}:${newerId}`} className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{label}</span>{item.replacedAt ? <span className="text-xs text-muted-foreground">{recordedDate(item.replacedAt)}</span> : null}</div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{item.replacementReason || "No replacement reason was recorded."}</p>
            <Button className="w-fit" variant="outline" render={<Link to={comparisonHref(earlierId, newerId)} state={{ returnUrl: location.pathname + location.search, returnState: location.state }} />} nativeButton={false}>Compare before and after <ArrowRight data-icon="inline-end" /></Button>
          </div>)}
        </section>
      ) : null}

      <div className="detail-layout">
        <article className="detail-article">
          <EditorialSection title="Applies To">
            <div className="flex flex-wrap gap-2">
              {decision.appliesTo.length ? (
                decision.appliesTo.map((item) => (
                  <Badge key={item} variant="outline">
                    <Box />
                    <Link to={scopeHref(item, decision.decisionState)} className="hover:underline">{item}</Link>
                  </Badge>
                ))
              ) : (
                <p>No scope was recorded.</p>
              )}
            </div>
          </EditorialSection>
          {/* The page title is already the choice (or the pending question). */}
          {decision.decisionState === "DECIDED" && decision.title !== headline(decision) ? <EditorialSection title="Original question"><p>{decision.title}</p></EditorialSection> : null}
          <EditorialSection title="Why">
            <p>{decision.why || "No rationale was recorded."}</p>
          </EditorialSection>
          <EditorialSection title="Context">
            <p>{decision.context || "No additional context was recorded."}</p>
          </EditorialSection>
          <EditorialSection title="Options Considered">
            {decision.optionsConsidered.length ? (
              <ul>
                {decision.optionsConsidered.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            ) : (
              <p>No alternatives were recorded.</p>
            )}
          </EditorialSection>
          <EditorialSection title="Relevant Discussion">
            <CapturedDiscussion sources={decision.sources ?? []} />
          </EditorialSection>

        </article>

        <aside className="detail-rail">
          <section>
            <h2>Details</h2>
            <dl>
              <MetadataRow
                icon={
                  <Avatar size="sm">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                }
                label="Owner"
                value={
                  decision.owner?.displayName ??
                  decision.ownerName ??
                  "Unassigned"
                }
              />
              <MetadataRow
                icon={<Tag />}
                label="Tags"
                value={decision.tags.join(", ") || "—"}
              />
              {channels.length ? (
                <MetadataRow
                  icon={<Hash />}
                  label="Slack channel"
                  value={channels.join(", ")}
                />
              ) : null}
              <MetadataRow
                icon={<CalendarDays />}
                label="Created"
                value={created}
              />
            </dl>
          </section>
          <section>
            <h2>Sources</h2>
            <div className="grid gap-2">
              {decision.sources?.length ? (
                decision.sources.map((source) =>
                  source.permalink ? (
                    <a
                      className="rail-link"
                      href={source.permalink}
                      target="_blank"
                      rel="noreferrer"
                      key={source.id}
                    >
                      <MessageSquare />
                      {source.channelName ? `Slack · #${source.channelName}` : "Slack discussion"}
                      <ExternalLink />
                    </a>
                  ) : (
                    <span className="rail-link" key={source.id}>
                      <MessageSquare />
                      {source.channelName ? `Slack · #${source.channelName}` : "Slack snapshot"}
                    </span>
                  )
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  No sources attached.
                </p>
              )}
            </div>
          </section>
          <section>
            <h2>Related Work</h2>
            <div className="grid gap-2">
              {decision.references?.length ? (
                decision.references.map((reference) => (
                  <a
                    className="rail-link"
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    key={reference.id}
                  >
                    <Link2 />
                    {reference.label}
                    <ExternalLink />
                  </a>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No related work attached.
                </p>
              )}
            </div>
          </section>
          <section>
            <h2>Lifecycle</h2>
            <div className="grid gap-2">
              {decision.lifecycle?.supersededBy.map((item) => (
                <Link
                  className="lifecycle-link"
                  to={`/decisions/${item.id}`}
          state={{ libraryUrl, libraryState }}
                  key={item.id}
                >
                  Superseded by <strong>{item.decisionKey}</strong>
                  <span>{headline(item)}</span>
                </Link>
              ))}
              {decision.lifecycle?.supersedes.map((item) => (
                <Link
                  className="lifecycle-link"
                  to={`/decisions/${item.id}`}
          state={{ libraryUrl, libraryState }}
                  key={item.id}
                >
                  Supersedes <strong>{item.decisionKey}</strong>
                  <span>{headline(item)}</span>
                </Link>
              ))}
              {!decision.lifecycle?.supersededBy.length &&
              !decision.lifecycle?.supersedes.length ? (
                <p className="text-sm text-muted-foreground">
                  {decision.decisionState === "PENDING" ? "This question has not been decided yet." : "This is the current recorded outcome."}
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function messagesFromSources(sources: SourceSnapshot[]) {
  return sources.flatMap((source) =>
    source.messages.length
      ? source.messages
      : source.anchorText
        ? [
            {
              author: "Slack",
              timestamp: source.capturedAt,
              text: source.anchorText,
              anchor: true,
            },
          ]
        : []
  )
}

function compactDiscussion(
  messages: SourceMessage[],
  relevantIds: Set<string>,
  limit = 5
) {
  if (messages.length <= limit) return messages
  // Prefer the messages the AI draft cited as support, always keeping the anchor.
  const relevant = messages.filter(
    (message) => message.anchor || relevantIds.has(message.timestamp)
  )
  if (relevant.length > 1) {
    const anchor = relevant.find((message) => message.anchor)
    const others = relevant.filter((message) => !message.anchor)
    const kept = new Set([anchor, ...others].filter(Boolean).slice(0, limit))
    return messages.filter((message) => kept.has(message))
  }
  const anchorIndex = messages.findIndex((message) => message.anchor)
  if (anchorIndex < 0) return messages.slice(0, limit)
  const before = Math.floor((limit - 1) / 2)
  const start = Math.max(0, Math.min(anchorIndex - before, messages.length - limit))
  return messages.slice(start, start + limit)
}

function CapturedDiscussion({ sources }: { sources: SourceSnapshot[] }) {
  const messages = messagesFromSources(sources)
  if (!messages.length) return <p>No captured discussion is attached.</p>
  const relevantIds = new Set(
    sources.flatMap((source) => source.sourceContext?.aiDraft?.relevantMessageIds ?? [])
  )
  const aiDrafted = sources.some((source) => source.sourceContext?.aiDraft)
  const compact = compactDiscussion(messages, relevantIds)
  const textTruncated = sources.some((source) => source.sourceContext?.textTruncated)
  const incomplete = sources.some((source) => source.sourceContext?.captureStatus === "INCOMPLETE")
  const truncated = sources.some((source) => source.sourceContext?.captureTruncated)
  const reportedTotal = sources.reduce(
    (total, source) => total + (source.sourceContext?.totalMessageCount ?? source.messages.length),
    0
  )

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {incomplete
          ? "Slack thread retrieval was incomplete. Only the messages shown here were preserved; other discussion may be missing."
          : "Captured context is stored here independently of Slack. If the original message is unavailable, this copy remains readable."}
      </p>
      {textTruncated ? <p className="text-sm text-muted-foreground">Long message text was shortened to 4,000 characters.</p> : null}
      {aiDrafted ? (
        <p className="text-sm text-muted-foreground">
          The form was drafted by AI from this discussion, then reviewed and
          saved by a person.
        </p>
      ) : null}
      <DiscussionMessages messages={compact} />
      {messages.length > compact.length ? (
        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="mt-2 w-fit" />}>
            <MessageSquare /> View captured discussion ({messages.length})
          </DialogTrigger>
          <DialogContent className="max-h-[85svh] overflow-hidden sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Captured Slack discussion</DialogTitle>
              <DialogDescription>
                Durable evidence stored with this Decision at capture time.
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[62svh] gap-3 overflow-y-auto pr-2">
              <DiscussionMessages messages={messages} />
            </div>
            {truncated && !incomplete && reportedTotal > messages.length ? (
              <p className="text-xs text-muted-foreground">
                Slack reported {reportedTotal} messages; the saved snapshot is capped at {messages.length}.
              </p>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : truncated && !incomplete && reportedTotal > messages.length ? (
        <p className="text-xs text-muted-foreground">
          Slack reported {reportedTotal} messages; this snapshot contains {messages.length}.
        </p>
      ) : null}
    </>
  )
}

function DiscussionMessages({ messages }: { messages: SourceMessage[] }) {
  return messages.map((message, index) => (
    <div className="source-message" key={`${message.timestamp}-${index}`}>
      <div className="source-message-meta">
        <strong>{message.author}</strong>
        <span>{formatTimestamp(message.timestamp)}</span>
        {message.anchor ? <Badge variant="secondary">Anchor</Badge> : null}
      </div>
      <p className="whitespace-pre-wrap break-words">{message.text}</p>
    </div>
  ))
}

function EditorialSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="editorial-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function MetadataRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="metadata-row">
      <div className="metadata-icon">{icon}</div>
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  )
}

function SupersedeDialog({
  open, onOpenChange, candidates, suggestedIds, targetId, setTargetId, onConfirm, loading, error,
  decision, replacementReason, setReplacementReason,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: Decision[]
  suggestedIds: string[]
  targetId: string
  setTargetId: (value: string) => void
  onConfirm: () => void
  loading: boolean
  error: string
  decision: Decision
  replacementReason: string
  setReplacementReason: (value: string) => void
}) {
  const earlier = candidates.find((item) => item.id === targetId)
  // Similar active choices come first; the full list stays below them.
  const suggested = suggestedIds.map((sid) => candidates.find((item) => item.id === sid)).filter((item): item is Decision => Boolean(item))
  const ordered = [...suggested, ...candidates.filter((item) => !suggestedIds.includes(item.id))]
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next) }}>
      <DialogTrigger render={<Button variant="outline" />}><RefreshCcw /> Supersede</DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Supersede an earlier Decision</DialogTitle><DialogDescription>Review the earlier choice, then record what changed. It will remain searchable and link to this Decision.</DialogDescription></DialogHeader>
        {error ? <p role="alert">{error}</p> : null}
        <FieldGroup>
          <Field><FieldLabel>Earlier Decision</FieldLabel>
            <SearchableSelect label="Earlier Decision" value={targetId} disabled={loading}
              onChange={setTargetId} className="w-full justify-between"
              options={[{ value: "", label: "Select an active Decision" }, ...ordered.map(item => ({ value: item.id, label: `${suggestedIds.includes(item.id) ? "Similar · " : ""}${item.decisionKey} · ${headline(item)}` }))]} />
            {suggested.length ? <FieldDescription>Similar choices found on this computer are listed first.</FieldDescription> : null}
          </Field>
          {earlier ? <div className="grid gap-4 border-y py-4 sm:grid-cols-2">{[earlier, decision].map((item, index) => <section key={item.id} aria-label={index === 0 ? "Earlier choice" : "Replacing choice"} className="grid min-w-0 content-start gap-2">
            <p className="text-xs font-semibold text-muted-foreground">{index === 0 ? "Earlier choice" : "Replacing choice"} · {item.decisionKey}</p><h3 className="break-words text-sm font-semibold">{headline(item)}</h3><p className="break-words text-xs text-muted-foreground">Applies to: {item.appliesTo.join(", ") || "No scope recorded"}</p><p className="whitespace-pre-wrap break-words text-sm leading-6">{item.why || "No rationale recorded."}</p>
          </section>)}</div> : null}
          <Field><FieldLabel htmlFor="replacement-reason">What changed?</FieldLabel><Textarea id="replacement-reason" value={replacementReason} maxLength={2000} disabled={loading} onChange={(event) => setReplacementReason(event.target.value)} placeholder="For example: exports now exceed local disk capacity, so the earlier approach no longer fits." /><FieldDescription>Optional. Record the circumstance or assumption that changed, so teammates can understand this replacement later.</FieldDescription></Field>
        </FieldGroup>
        <DialogFooter><Button onClick={onConfirm} disabled={!targetId || loading}>{loading ? "Updating…" : "Confirm supersession"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailSkeleton() {
  return (
    <div className="page-frame max-w-[1240px]">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-14 w-3/4" />
      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <Skeleton className="h-150" />
        <Skeleton className="h-100" />
      </div>
    </div>
  )
}

function formatTimestamp(value: string) {
  const parsed = Number(value)
    ? new Date(Number(value) * 1000)
    : new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed)
}
