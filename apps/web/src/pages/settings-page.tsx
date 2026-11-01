import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import type { IntegrationKey, IntegrationProvider, IntegrationSettings } from "@/types"

type FieldDefinition = { key: IntegrationKey; label: string; secret?: boolean; type?: "email" | "url"; hint?: string }
const providers: { id: IntegrationProvider; label: string; description: string; fields: FieldDefinition[] }[] = [
  { id: "slack", label: "Slack", description: "Connect the Slack workspace used for capture and recall.", fields: [
    { key: "SLACK_BOT_TOKEN", label: "Bot token", secret: true, hint: "Starts with xoxb-." },
    { key: "SLACK_SIGNING_SECRET", label: "Signing secret", secret: true, hint: "32 hexadecimal characters from your Slack app credentials." },
    { key: "SLACK_TEAM_ID", label: "Workspace ID", hint: "Starts with T. Only this Slack workspace is accepted." },
  ] },
  { id: "gemini", label: "Gemini", description: "Enable AI search, capture drafts, proposal analysis, and explicit thread summaries.", fields: [
    { key: "GEMINI_API_KEY", label: "API key", secret: true, hint: "Gemini features send disclosed data to Google. Use synthetic or sanitized data." },
  ] },
  { id: "jira", label: "Jira", description: "Create Jira issues from decisions using this shared account.", fields: [
    { key: "JIRA_BASE_URL", label: "Site URL", type: "url", hint: "For example, https://acme.atlassian.net" },
    { key: "JIRA_EMAIL", label: "Account email", type: "email" },
    { key: "JIRA_API_TOKEN", label: "API token", secret: true },
  ] },
]

function IntegrationForm({ provider, settings, onSaved, onReload }: {
  provider: typeof providers[number]
  settings: IntegrationSettings
  onSaved: (settings: IntegrationSettings) => void
  onReload: () => void
}) {
  const [changes, setChanges] = useState<Partial<Record<IntegrationKey, string | null>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState(false)
  const integration = settings.integrations[provider.id]
  const dirty = Object.keys(changes).length > 0
  const change = (key: IntegrationKey, value: string | null | undefined) => {
    setChanges(current => {
      const next = { ...current }
      if (value === undefined) delete next[key]
      else next[key] = value
      return next
    })
    setSaved(false)
    if (!conflict) setError("")
  }

  return (
    <section className="editorial-section" aria-labelledby={`${provider.id}-heading`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`${provider.id}-heading`}>{provider.label}</h2>
        <Badge variant={integration.configured ? "secondary" : "outline"}>
          {integration.configured ? "Configured" : "Not configured"}
        </Badge>
      </div>
      <p>{provider.description}</p>
      <form onSubmit={async event => {
        event.preventDefault()
        setSaving(true)
        setError("")
        setConflict(false)
        try {
          const result = await api.saveIntegrationSettings(provider.id, settings.revision, changes)
          onSaved(result)
          setChanges({})
          setSaved(true)
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Could not save settings.")
          setConflict(saveError instanceof ApiError && saveError.code === "SETTINGS_CONFLICT")
        } finally { setSaving(false) }
      }}>
        <fieldset disabled={saving} className="min-w-0">
          <legend className="sr-only">{provider.label} integration settings</legend>
          <FieldGroup>
            {provider.fields.map(field => {
              const stored = integration.fields[field.key]
              const pending = changes[field.key]
              const editing = !field.secret || !stored?.configured || pending !== undefined
              const showInput = editing && (pending !== null || !field.secret)
              const inputId = `setting-${field.key}`
              return (
                <Field key={field.key} data-invalid={error.includes(field.key) || undefined}>
                  <FieldLabel htmlFor={showInput ? inputId : undefined}>{field.label}</FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    {showInput ? (
                      <Input id={inputId} name={field.key} className="min-w-0 flex-1 basis-60"
                        type={field.secret ? "password" : field.type ?? "text"}
                        autoComplete={field.secret ? "new-password" : "off"} spellCheck={false} maxLength={4096}
                        required={field.secret && pending !== undefined}
                        value={pending === null ? "" : pending ?? (field.secret ? "" : stored?.value ?? "")}
                        aria-describedby={`${inputId}-description`}
                        aria-invalid={error.includes(field.key) || undefined}
                        onChange={event => change(field.key, event.target.value || (field.secret && stored?.configured ? "" : field.secret ? undefined : null))} />
                    ) : (
                      <Badge variant="outline">{pending === null ? "Will be cleared" : "Configured"}</Badge>
                    )}
                    {field.secret && stored?.configured && pending === undefined ? (
                      <Button type="button" variant="outline" onClick={() => change(field.key, "")} aria-label={`Replace ${provider.label} ${field.label.toLowerCase()}`}>Replace</Button>
                    ) : null}
                    {stored?.configured && pending !== null ? (
                      <Button type="button" variant="ghost" onClick={() => change(field.key, null)} aria-label={`Clear ${provider.label} ${field.label.toLowerCase()}`}>Clear</Button>
                    ) : null}
                    {pending !== undefined ? (
                      <Button type="button" variant="ghost" onClick={() => change(field.key, undefined)} aria-label={`Undo ${provider.label} ${field.label.toLowerCase()}`}>Undo</Button>
                    ) : null}
                  </div>
                  <FieldDescription id={`${inputId}-description`}>
                    <code>{field.key}</code>{field.hint ? ` · ${field.hint}` : ""}
                  </FieldDescription>
                </Field>
              )
            })}
          </FieldGroup>
          {!integration.configured ? (
            <p className="mt-4 text-sm text-muted-foreground">Missing: {provider.fields.filter(field => !integration.fields[field.key]?.configured).map(field => field.label).join(", ")}. This integration is unavailable until all fields are saved.</p>
          ) : null}
          {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
          {conflict ? <Button type="button" variant="outline" className="mt-3" onClick={onReload}>Discard edits &amp; reload settings</Button> : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!dirty || saving || conflict}>{saving ? "Saving…" : `Save ${provider.label}`}</Button>
            {dirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
            {saved ? <span role="status" className="text-sm text-muted-foreground">Saved. New operations use these settings.</span> : null}
          </div>
        </fieldset>
      </form>
    </section>
  )
}

export function SettingsPage() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    api.integrationSettings().then(result => {
      if (active) setSettings(result)
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Could not load settings.")
    })
    return () => { active = false }
  }, [attempt])
  const reload = () => { setSettings(null); setError(""); setAttempt(current => current + 1) }

  return (
    <div className="page-frame max-w-4xl">
      <div>
        <h1>Settings</h1>
        <p className="mt-1.5">Shared by all users. Changes apply to new operations immediately.</p>
        <p className="mt-2 text-sm text-muted-foreground">Saved secrets stay hidden; replace or clear them here. Configured means required values are present, not that the connection has been tested.</p>
      </div>
      {error ? (
        <Empty role="alert">
          <EmptyHeader><EmptyTitle role="heading" aria-level={2}>Could not load settings</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader>
          <Button variant="outline" onClick={reload}>Try again</Button>
        </Empty>
      ) : settings ? (
        <div>
          <Separator className="mb-6" />
          <div>
            {providers.map(provider => <IntegrationForm key={`${attempt}-${provider.id}`} provider={provider} settings={settings} onSaved={setSettings} onReload={reload} />)}
          </div>
        </div>
      ) : <div aria-label="Loading settings" className="flex flex-col gap-4"><Skeleton className="h-8 w-36" /><Skeleton className="h-40 w-full" /></div>}
    </div>
  )
}
