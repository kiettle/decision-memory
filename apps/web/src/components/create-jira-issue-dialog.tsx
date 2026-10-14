import { headline } from "../../../../shared/decision-deadlines.js"
import { TicketPlus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api, ApiError } from "@/lib/api"
import type { Decision, JiraIssueType, JiraProject } from "@/types"

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

type JiraAttempt = { requestId: string; projectKey: string; issueTypeId: string; summary: string; issue?: { key: string; url: string } }

// Spec §18: turn a Decision into Jira work and keep the issue key as related work.
export function CreateJiraIssueDialog({
  decision,
  enabled,
  onCreated,
}: {
  decision: Decision
  enabled: boolean
  onCreated: (decision: Decision) => void
}) {
  const storageKey = `decision-memory:jira-attempt:${decision.id}`
  const [attempt, setAttempt] = useState<JiraAttempt | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) ?? "null") } catch { return null }
  })
  const remember = (next: JiraAttempt | null) => {
    if (next) sessionStorage.setItem(storageKey, JSON.stringify(next))
    else sessionStorage.removeItem(storageKey)
    setAttempt(next)
  }
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<JiraProject[] | null>(null)
  const [projectKey, setProjectKey] = useState("")
  const [issueTypes, setIssueTypes] = useState<JiraIssueType[] | null>(null)
  const [issueTypeId, setIssueTypeId] = useState("")
  const [summary, setSummary] = useState("")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    api
      .jiraProjects()
      .then((rows) => {
        if (!active) return
        setProjects(rows)
        if (rows.length === 1) setProjectKey((current) => current || rows[0].key)
      })
      .catch((loadError) => {
        if (active) setError(message(loadError, "Could not load Jira projects."))
      })
    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    if (!projectKey) return
    let active = true
    api
      .jiraIssueTypes(projectKey)
      .then((types) => {
        if (!active) return
        setIssueTypes(types)
        setIssueTypeId((current) => current || (types.find((type) => type.name === "Task") ?? types[0])?.id || "")
      })
      .catch((loadError) => {
        if (active) setError(message(loadError, "Could not load issue types."))
      })
    return () => {
      active = false
    }
  }, [projectKey])

  function changeOpen(next: boolean) {
    if (creating) return
    setOpen(next)
    if (!next) return
    setProjects(null)
    setProjectKey(attempt?.projectKey ?? "")
    setIssueTypes(null)
    setIssueTypeId(attempt?.issueTypeId ?? "")
    setSummary(attempt?.summary ?? headline(decision).slice(0, 255))
    setError("")
  }

  function chooseProject(key: string) {
    setProjectKey(key)
    setIssueTypes(null)
    setIssueTypeId("")
    setError("")
  }

  async function create() {
    setCreating(true)
    setError("")
    try {
      const pending = attempt ?? { requestId: crypto.randomUUID(), projectKey, issueTypeId, summary }
      remember(pending)
      const { issue: _issue, ...input } = pending
      void _issue
      const result = await api.createJiraIssue(decision.id, input)
      remember(null)
      toast.success(`Created ${result.issue.key}.`)
      onCreated(result.decision)
      setOpen(false)
    } catch (createError) {
      if (createError instanceof ApiError) {
        if (createError.code === "JIRA_REJECTED" || createError.code === "JIRA_NOT_CONFIGURED") remember(null)
        else if (createError.issue) {
          const pending = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as JiraAttempt | null
          if (pending) remember({ ...pending, issue: createError.issue })
        }
      }
      setError(message(createError, "The Jira issue could not be created."))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            disabled={!enabled}
            title={
              enabled
                ? undefined
                : "Add JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to enable."
            }
          />
        }
      >
        <TicketPlus /> Create Jira issue
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Jira issue</DialogTitle>
          <DialogDescription>
            The issue links back to {decision.decisionKey}, and its key is saved
            under Related Work.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field>
            <FieldLabel>Project</FieldLabel>
            <Select
              disabled={creating || Boolean(attempt)}
              value={projectKey}
              onValueChange={(value) => chooseProject(value ?? "")}
            >
              <SelectTrigger className="w-full" aria-label="Jira project">
                <SelectValue>
                  {projects === null
                    ? "Loading projects…"
                    : (projects.find((project) => project.key === projectKey)
                        ?.name ?? "Select a project")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((project) => (
                  <SelectItem key={project.key} value={project.key}>
                    {project.name} ({project.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Issue type</FieldLabel>
            <Select
              disabled={creating || Boolean(attempt)}
              value={issueTypeId}
              onValueChange={(value) => setIssueTypeId(value ?? "")}
            >
              <SelectTrigger className="w-full" aria-label="Jira issue type">
                <SelectValue>
                  {!projectKey
                    ? "Choose a project first"
                    : issueTypes === null
                      ? "Loading issue types…"
                      : (issueTypes.find((type) => type.id === issueTypeId)
                          ?.name ?? "Select an issue type")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(issueTypes ?? []).map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="jira-summary">Summary</FieldLabel>
            <Input
              disabled={creating || Boolean(attempt)}
              id="jira-summary"
              value={summary}
              maxLength={255}
              onChange={(event) => setSummary(event.target.value)}
            />
          </Field>
          {attempt?.issue ? (
            <a href={attempt.issue.url} target="_blank" rel="noreferrer" className="text-primary underline">
              Open created issue {attempt.issue.key}
            </a>
          ) : null}
          {attempt ? <p className="text-sm text-muted-foreground">This attempt is preserved. Retrying will reuse it, including after reloading this page.</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            onClick={() => void create()}
            disabled={!projectKey || !issueTypeId || !summary.trim() || creating}
          >
            {creating ? "Working…" : attempt?.issue ? "Retry linking" : attempt ? "Retry request" : "Create issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
