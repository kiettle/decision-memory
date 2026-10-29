import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { Follow } from "@/types"

export function FollowButton({ kind, target }: { kind: Follow["kind"]; target: string }) {
  const [following, setFollowing] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    api.follows().then(rows => { if (active) setFollowing(rows.some(row => row.kind === kind && row.target === target)) })
      .catch(() => { if (active) setError("Could not load follow status.") })
    return () => { active = false }
  }, [kind, target, retry])
  async function toggle() {
    setBusy(true); setError("")
    try { await api.setFollow(kind, target, !following); setFollowing(!following); window.dispatchEvent(new Event("memory-changes")) }
    catch (error) { setError(error instanceof Error ? error.message : "Follow could not be saved.") }
    finally { setBusy(false) }
  }
  return <div className="flex flex-col items-start gap-1">
    <Button type="button" variant="outline" disabled={busy || following === null} aria-pressed={following ?? false} onClick={() => void toggle()}>
      {following ? "Unfollow" : "Follow"} {kind === "SCOPE" ? "scope" : "decision"}
    </Button>
    {error ? <p role="alert" className="text-sm">{error} {following === null ? <button type="button" className="underline" onClick={() => { setError(""); setRetry(n => n + 1) }}>Retry follow status</button> : null}</p> : null}
  </div>
}
