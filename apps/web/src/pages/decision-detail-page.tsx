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
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { slackChannels } from "@/lib/slack"
import type { Decision, SourceMessage, SourceSnapshot } from "@/types"

export function DecisionDetailPage() {
  const { id = "" } = useParams()
  return <DecisionDetail key={id} id={id} />
}

function DecisionDetail({ id }: { id: string }) {
  const [decision, setDecision] = useState<Decision | null>(null)
  const [candidates, setCandidates] = useState<Decision[]>([])
  const [targetId, setTargetId] = useState("")
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

  useEffect(() => {
    if (!supersedeOpen) return
    let active = true
    void api.decisions({ status: "ACTIVE" })
      .then((rows) => { if (active) setCandidates(rows.filter((row) => row.id !== id)) })
      .catch(() => { if (active) setCandidateError("Could not load active Decisions. Close and reopen to retry.") })
    return () => { active = false }
  }, [id, supersedeOpen])

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
      await api.supersede(decision.id, targetId)
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
        <Button className="w-fit" variant="outline" render={<Link to="/" />} nativeButton={false}>
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
      <div className="detail-topbar">
        <Button
          variant="ghost"
          size="sm"
          render={<Link to="/" />}
          nativeButton={false}
          className="-ml-2"
        >
          <ArrowLeft /> Back to decisions
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <CreateJiraIssueDialog
            decision={decision}
            enabled={jiraEnabled}
            onCreated={setDecision}
          />
          {decision.status === "ACTIVE" ? (
            <SupersedeDialog
              open={supersedeOpen}
              onOpenChange={(open) => {
                setSupersedeOpen(open)
                setCandidates([])
                setCandidateError("")
                setTargetId("")
              }}
              candidates={candidates}
              targetId={targetId}
              setTargetId={setTargetId}
              onConfirm={supersede}
              loading={superseding}
              error={candidateError}
            />
          ) : null}
          <Button
            variant="outline"
            render={<Link to={`/decisions/${decision.id}/edit`} />}
            nativeButton={false}
          >
            <Pencil /> Edit
          </Button>
        </div>
      </div>

      <div className="detail-title-block">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={decision.status} />
          <span className="decision-key">{decision.decisionKey}</span>
        </div>
        <h1>{decision.title}</h1>
        <p>
          Recorded {created}
          {decision.owner?.displayName || decision.ownerName
            ? ` · Owned by ${decision.owner?.displayName ?? decision.ownerName}`
            : ""}
          {channels.length ? ` · Discussed in ${channels.join(", ")}` : ""}
        </p>
      </div>

      {decision.lifecycle?.supersededBy.map((item) => (
        <Link
          key={item.id}
          to={`/decisions/${item.id}`}
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 hover:bg-amber-100"
        >
          <RefreshCcw aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            This Decision was replaced. The current Decision is{" "}
            <strong>{item.decisionKey}</strong> · {item.title}
          </span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      ))}

      <div className="detail-layout">
        <article className="detail-article">
          <EditorialSection title="Applies To">
            <div className="flex flex-wrap gap-2">
              {decision.appliesTo.length ? (
                decision.appliesTo.map((item) => (
                  <Badge key={item} variant="outline">
                    <Box />
                    {item}
                  </Badge>
                ))
              ) : (
                <p>No scope was recorded.</p>
              )}
            </div>
          </EditorialSection>
          <EditorialSection title="Decision">
            <p>{decision.title}</p>
          </EditorialSection>
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
                  key={item.id}
                >
                  Superseded by <strong>{item.decisionKey}</strong>
                  <span>{item.title}</span>
                </Link>
              ))}
              {decision.lifecycle?.supersedes.map((item) => (
                <Link
                  className="lifecycle-link"
                  to={`/decisions/${item.id}`}
                  key={item.id}
                >
                  Supersedes <strong>{item.decisionKey}</strong>
                  <span>{item.title}</span>
                </Link>
              ))}
              {!decision.lifecycle?.supersededBy.length &&
              !decision.lifecycle?.supersedes.length ? (
                <p className="text-sm text-muted-foreground">
                  This is the current recorded outcome.
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
  open,
  onOpenChange,
  candidates,
  targetId,
  setTargetId,
  onConfirm,
  loading,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: Decision[]
  targetId: string
  setTargetId: (value: string) => void
  onConfirm: () => void
  loading: boolean
  error: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <RefreshCcw /> Supersede
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supersede an earlier Decision</DialogTitle>
          <DialogDescription>
            The selected Decision becomes superseded and both records will link
            to each other.
          </DialogDescription>
        </DialogHeader>
        {error ? <p role="alert">{error}</p> : null}
        <Select
          value={targetId}
          onValueChange={(value) => setTargetId(value ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {candidates.find((item) => item.id === targetId)?.title ??
                "Select an active Decision"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {candidates.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.decisionKey} · {item.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={onConfirm} disabled={!targetId || loading}>
            {loading ? "Updating…" : "Confirm supersession"}
          </Button>
        </DialogFooter>
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
