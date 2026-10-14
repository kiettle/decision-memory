import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { api } from "@/lib/api"
import type { Metadata } from "@/types"

function Status({ enabled }: { enabled?: boolean }) {
  if (enabled === undefined) return <Badge variant="outline">Checking…</Badge>
  return enabled ? (
    <Badge variant="secondary">Configured</Badge>
  ) : (
    <Badge variant="outline">Not configured</Badge>
  )
}

export function SettingsPage() {
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    api
      .metadata()
      .then((result) => {
        if (active) setMetadata(result)
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load connections."
          )
      })
    return () => {
      active = false
    }
  }, [attempt])

  return (
    <div className="page-frame max-w-4xl">
      <div>
        <p className="eyebrow">Local demo</p>
        <h1>Settings</h1>
      </div>
      {error ? (
        <Empty className="border-y py-12" role="alert">
          <EmptyHeader>
            <EmptyTitle>Could not load connections</EmptyTitle>
            <EmptyDescription>
              {error} Check that the API is running, then retry.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            onClick={() => {
              setMetadata(null)
              setError("")
              setAttempt((current) => current + 1)
            }}
          >
            Try again
          </Button>
        </Empty>
      ) : (
        <section className="editorial-section border-t pt-6">
          <div>
            <h2>Connections</h2>
            <p>
              Credentials are read from the local environment and never
              displayed here.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="metadata-item">
              <dt>Workspace</dt>
              <dd>
                <Badge variant="secondary">
                  {metadata?.workspace.name ?? "—"}
                </Badge>
              </dd>
            </div>
            <div className="metadata-item">
              <dt>Slack</dt>
              <dd>
                <Status enabled={metadata?.features.slack} />
              </dd>
            </div>
            <div className="metadata-item">
              <dt>Local Search by memory</dt>
              <dd>
                <Status enabled={metadata?.features.memorySearch} />
              </dd>
            </div>
            <div className="metadata-item">
              <dt>Gemini AI search</dt>
              <dd>
                <Status enabled={metadata?.features.geminiMemorySearch} />
              </dd>
            </div>
            <div className="metadata-item">
              <dt>Notifications</dt>
              <dd>
                <Badge variant="outline">Deferred</Badge>
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  )
}
