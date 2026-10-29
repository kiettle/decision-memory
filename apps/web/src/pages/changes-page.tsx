import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import type { ChangeFeed, Follow } from "@/types"

export function ChangesPage() {
  const [feed, setFeed] = useState<ChangeFeed | null>(null)
  const [follows, setFollows] = useState<Follow[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(true)
  async function refresh() {
    setBusy(true); setError("")
    try { const [next, subscriptions] = await Promise.all([api.notifications(), api.follows()]); setFeed(next); setFollows(subscriptions) }
    catch (error) { setError(error instanceof Error ? error.message : "Could not load changes.") }
    finally { setBusy(false) }
  }
  useEffect(() => {
    let active = true
    Promise.all([api.notifications(), api.follows()]).then(([next, subscriptions]) => {
      if (active) { setFeed(next); setFollows(subscriptions) }
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load changes.") })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [])
  async function unfollow(follow: Follow) {
    setBusy(true)
    try { await api.setFollow(follow.kind, follow.target, false); await refresh() }
    catch (error) { setError(error instanceof Error ? error.message : "Could not unfollow."); setBusy(false) }
  }
  return <div className="page-frame max-w-5xl">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Your follows</p><h1>Changes</h1><p className="mt-2 text-muted-foreground">Recorded changes to decisions and scopes you explicitly follow.</p></div>
      <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Refresh changes</Button></div>
    <p className="text-sm text-muted-foreground">In-app only. Follow a decision or scope to see future changes here. Local demo sessions share the configured identity.</p>
    {error ? <p role="alert">{error}</p> : null}
    {!feed && busy ? <p role="status">Loading changes…</p> : null}
    {feed ? <>
      <Button className="w-fit" variant="outline" disabled={busy} onClick={async () => {
        setBusy(true)
        try { await api.readNotifications(feed.items.map(item => item.id)); setFeed({ ...feed, items: feed.items.map(item => ({ ...item, read: true })) }); window.dispatchEvent(new Event("memory-changes")) }
        catch { setError("Could not mark changes read. Retry.") }
        finally { setBusy(false) }
      }}>Mark displayed changes read</Button>
      <section aria-label="Followed changes" className="divide-y border-y">
        {!feed.items.length ? <p className="py-6 text-muted-foreground">No changes since you started following. Nothing here implies approval of a choice.</p> : feed.items.map(item => <article key={item.id} className="grid gap-3 py-6 break-words">
          <div className="flex flex-wrap gap-2"><Badge variant="outline">{({ RECORDED: "New recorded choice", UPDATED: "Choice, reason or scope changed", ANSWERED: "Question answered", REPLACED: "Decision replaced" })[item.kind]}</Badge>
            {!item.read ? <Badge variant="secondary">Unread</Badge> : null}
            <span className="text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span></div>
          {item.previous ? <p><strong>{item.kind === "ANSWERED" ? "Original question" : "Previously"}: </strong><Link className="underline" to={`/decisions/${item.previous.id}`} state={{ libraryUrl: "/changes" }}>{item.previous.decisionKey} · {item.previous.choice ?? item.previous.title}</Link></p> : null}
          <p><strong>Recorded choice: </strong><Link className="underline" to={`/decisions/${item.current.id}`} state={{ libraryUrl: "/changes" }}>{item.current.decisionKey} · {item.current.choice}</Link></p>
          <p className="whitespace-pre-wrap"><strong>{item.kind === "REPLACED" ? "Replacement reason" : "Recorded rationale"}: </strong>{item.reason || "No reason was recorded."}</p>
          {item.previous && item.previous.why !== item.current.why ? <p className="whitespace-pre-wrap text-sm">Previous rationale: {item.previous.why || "Not recorded"}</p> : null}
          <p className="text-sm">Previous scope: {item.previous?.appliesTo.join(", ") || "Not recorded"} · Current scope: {item.current.appliesTo.join(", ") || "Not recorded"}</p>
          <Link className="text-sm underline" to={`/decisions/${item.current.id}`} state={{ libraryUrl: "/changes" }}>Open current record and evidence</Link>
          <p className="text-xs text-muted-foreground">Snapshot at change time; open the record for today’s status.</p>
        </article>)}
      </section>
      {feed.items.length === 100 ? <p className="text-sm">Showing the latest 100 relevant changes.</p> : null}
    </> : null}
    <section className="grid gap-3" aria-label="Manage follows"><h2 className="text-lg font-semibold">Following ({follows.length})</h2>
      {follows.map(follow => <div key={`${follow.kind}:${follow.target}`} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
        <Link className="underline break-words" to={follow.kind === "DECISION" ? `/decisions/${follow.target}` : `/scopes?scope=${encodeURIComponent(follow.target)}`}>{follow.label ?? (follow.kind === "SCOPE" ? follow.target : "Followed decision")}</Link>
        <Button variant="ghost" disabled={busy} onClick={() => void unfollow(follow)}>Unfollow</Button>
      </div>)}
    </section>
  </div>
}
