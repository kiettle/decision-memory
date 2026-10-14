import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
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
  useEffect(() => {
    api
      .metadata()
      .then(setMetadata)
      .catch(() => setMetadata(null))
  }, [])

  return (
    <div className="page-frame max-w-4xl">
      <div>
        <p className="eyebrow">Local demo</p>
        <h1>Settings</h1>
      </div>
      <section className="editorial-section border-t pt-6">
        <div>
          <h2>Connections</h2>
          <p>
            Credentials are read from the local environment and never displayed
            here.
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
            <dt>Notifications</dt>
            <dd>
              <Badge variant="outline">Deferred</Badge>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
