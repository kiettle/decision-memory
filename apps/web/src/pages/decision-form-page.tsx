import { ArrowLeft, Link2, Plus, Save, Trash2 } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { DecisionInput, Metadata } from "@/types"

const emptyForm: DecisionInput = {
  title: "",
  why: "",
  context: "",
  appliesTo: [],
  optionsConsidered: [],
  ownerId: "",
  ownerName: "",
  tags: [],
  references: [],
}

// List fields are edited as plain text and split only on save, so typing
// spaces, commas, and new lines behaves normally.
type ListText = { appliesTo: string; tags: string; options: string }

const emptyListText: ListText = { appliesTo: "", tags: "", options: "" }

const splitList = (value: string, separator: string | RegExp) =>
  value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean)

export function DecisionFormPage() {
  const { id } = useParams()
  return <DecisionForm key={id ?? "new"} id={id} />
}

function DecisionForm({ id }: { id?: string }) {
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [listText, setListText] = useState(emptyListText)
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([
      api.metadata(),
      id ? api.decision(id) : Promise.resolve(null),
    ])
      .then(([meta, decision]) => {
        if (!active) return
        setMetadata(meta)
        if (decision) {
          setForm({
            title: decision.title,
            why: decision.why ?? "",
            context: decision.context ?? "",
            appliesTo: decision.appliesTo,
            optionsConsidered: decision.optionsConsidered,
            ownerId: decision.owner?.id ?? "",
            ownerName: decision.ownerName ?? "",
            tags: decision.tags,
            references: (decision.references ?? []).map((reference) => ({
              kind: reference.kind === "JIRA" ? "JIRA" : "URL",
              label: reference.label,
              url: reference.url,
            })),
          })
          setListText({
            appliesTo: decision.appliesTo.join(", "),
            tags: decision.tags.join(", "),
            options: decision.optionsConsidered.join("\n"),
          })
        }
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load the form.")
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, attempt])

  const set = <K extends keyof DecisionInput>(
    key: K,
    value: DecisionInput[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateReference = (
    index: number,
    patch: Partial<DecisionInput["references"][number]>
  ) => {
    setForm((current) => ({
      ...current,
      references: current.references.map((reference, referenceIndex) =>
        referenceIndex === index ? { ...reference, ...patch } : reference
      ),
    }))
  }

  const addReference = () => {
    setForm((current) => ({
      ...current,
      references: [
        ...current.references,
        { kind: "URL", label: "", url: "" },
      ],
    }))
  }

  const removeReference = (index: number) => {
    setForm((current) => ({
      ...current,
      references: current.references.filter(
        (_, referenceIndex) => referenceIndex !== index
      ),
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (loading || loadError || !form.title.trim()) return
    setSaving(true)
    const input: DecisionInput = {
      ...form,
      appliesTo: splitList(listText.appliesTo, ","),
      tags: splitList(listText.tags, ","),
      optionsConsidered: splitList(listText.options, "\n"),
    }
    try {
      const decision = id
        ? await api.updateDecision(id, input)
        : await api.createDecision(input)
      toast.success(id ? "Decision updated." : "Decision saved.")
      navigate(`/decisions/${decision.id}`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The Decision could not be saved."
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-frame max-w-5xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-120 w-full" />
      </div>
    )
  }

  if (loadError) {
    return <div className="page-frame max-w-5xl">
      <h1>Could not load Decision form</h1>
      <p role="alert">{loadError}</p>
      <Button className="w-fit" onClick={() => { setLoading(true); setLoadError(""); setAttempt((value) => value + 1) }}>Try again</Button>
      <Button className="w-fit" variant="outline" render={<Link to="/" />} nativeButton={false}>Return to library</Button>
    </div>
  }

  return (
    <form className="page-frame max-w-5xl pb-28" onSubmit={submit}>
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link to={id ? `/decisions/${id}` : "/"} />}
          nativeButton={false}
          className="-ml-2 w-fit"
        >
          <ArrowLeft /> Back
        </Button>
        <div>
          <p className="eyebrow">
            {editing ? "Edit record" : "Record an outcome"}
          </p>
          <h1>{editing ? "Edit Decision" : "New Decision"}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Capture enough context that the decision remains useful after the
            original conversation is gone.
          </p>
        </div>
      </div>

      <div className="form-layout">
        <FieldGroup className="form-column-main">
          <Field data-invalid={submitted && !form.title.trim()}>
            <FieldLabel htmlFor="decision">
              Decision <span className="text-destructive">*</span>
            </FieldLabel>
            <Textarea
              id="decision"
              maxLength={500}
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              aria-invalid={submitted && !form.title.trim()}
              placeholder="State the decision as a clear outcome..."
              className="min-h-28 resize-y text-base"
            />
            <FieldDescription>
              This is the only required field.
            </FieldDescription>
            {submitted && !form.title.trim() ? (
              <FieldError>Decision is required.</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="why">Why</FieldLabel>
            <Textarea
              id="why"
              value={form.why}
              onChange={(event) => set("why", event.target.value)}
              placeholder="What made this the right choice?"
              className="min-h-28 resize-y"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="context">Context</FieldLabel>
            <Textarea
              id="context"
              value={form.context}
              onChange={(event) => set("context", event.target.value)}
              placeholder="What situation, constraints, or discussion led here?"
              className="min-h-32 resize-y"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="options">Options Considered</FieldLabel>
            <Textarea
              id="options"
              value={listText.options}
              onChange={(event) =>
                setListText((current) => ({
                  ...current,
                  options: event.target.value,
                }))
              }
              placeholder="One option per line"
              className="min-h-24 resize-y"
            />
          </Field>
        </FieldGroup>

        <FieldGroup className="form-column-side">
          <Field>
            <FieldLabel htmlFor="appliesTo">Applies To</FieldLabel>
            <Input
              id="appliesTo"
              value={listText.appliesTo}
              onChange={(event) =>
                setListText((current) => ({
                  ...current,
                  appliesTo: event.target.value,
                }))
              }
              placeholder="Service, project, component"
            />
          </Field>
          <Field>
            <FieldLabel>Owner</FieldLabel>
            <Select
              value={form.ownerId || "unassigned"}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  ownerId: value === "unassigned" ? "" : (value ?? ""),
                  ownerName: "",
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(metadata?.users.find((user) => user.id === form.ownerId)
                    ?.displayName ??
                    form.ownerName) ||
                    "Unassigned"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {metadata?.users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="tags">Tags</FieldLabel>
            <Input
              id="tags"
              value={listText.tags}
              onChange={(event) =>
                setListText((current) => ({
                  ...current,
                  tags: event.target.value,
                }))
              }
              placeholder="migration, storage"
            />
            <FieldDescription>Separate tags with commas.</FieldDescription>
          </Field>
          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Related work</FieldLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addReference}
              >
                <Plus /> Add link
              </Button>
            </div>
            {form.references.length ? (
              <div className="grid gap-3">
                {form.references.map((reference, index) => (
                  <div
                    className="grid gap-2 rounded-lg border bg-white p-3"
                    key={`${index}-${reference.kind}`}
                  >
                    <div className="flex items-center gap-2">
                      <Select
                        value={reference.kind}
                        onValueChange={(value) =>
                          updateReference(index, {
                            kind: value === "JIRA" ? "JIRA" : "URL",
                          })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue>
                            {reference.kind === "JIRA" ? "Jira" : "URL"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="JIRA">Jira</SelectItem>
                          <SelectItem value="URL">URL</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        aria-label={`Related link ${index + 1} label`}
                        value={reference.label}
                        onChange={(event) =>
                          updateReference(index, { label: event.target.value })
                        }
                        placeholder="Label (optional, Jira key by default)"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove related link ${index + 1}`}
                        onClick={() => removeReference(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="relative">
                      <Link2 className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                      <Input
                        aria-label={`Related link ${index + 1} URL`}
                        type="url"
                        value={reference.url}
                        onChange={(event) =>
                          updateReference(index, { url: event.target.value })
                        }
                        placeholder="https://..."
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <FieldDescription>
                Add Jira work or another supporting URL.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
      </div>

      <div className="form-actions">
        <Button
          type="button"
          variant="outline"
          render={<Link to={id ? `/decisions/${id}` : "/"} />}
          nativeButton={false}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          <Save />
          {saving ? "Saving…" : "Save Decision"}
        </Button>
      </div>
    </form>
  )
}
