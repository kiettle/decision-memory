import { ArrowLeft, Link2, Plus, Save, Trash2 } from "lucide-react"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { RelatedDecisionSearch } from "@/components/related-decision-search"
import { ScopePicker } from "@/components/scope-picker"
import type { DecisionNavigationState } from "@/lib/decision-navigation"
import {
  browserStorageKey,
  readBrowserValue,
  writeBrowserValue,
} from "@/lib/browser-storage"
import {
  recoveredDraftText,
  validDecisionDraft,
  type DecisionFormDraft,
  type ListText,
} from "@/lib/decision-form-draft"

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
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "@/lib/api"
import type { DecisionInput, Metadata } from "@/types"

const emptyForm: DecisionInput = {
  title: "",
  decisionState: "PENDING",
  outcome: null,
  dueDate: null,
  why: "",
  context: "",
  appliesTo: [],
  optionsConsidered: [],
  ownerId: "",
  ownerName: "",
  tags: [],
  references: [],
}

// Tags and alternatives retain their text-entry format; scopes stay as exact values.
const emptyListText: ListText = { tags: "", options: "" }

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
  const location = useLocation()
  const origin = location.state as DecisionNavigationState | null
  const returnedDraft = useRef(origin?.captureDraft)
  const formRef = useRef<HTMLFormElement>(null)
  const libraryUrl =
    typeof origin?.libraryUrl === "string" ? origin.libraryUrl : "/"
  const [form, setForm] = useState(() => {
    const proposal = origin?.proposalDraft?.proposal
    const scope = !editing
      ? (origin?.proposalDraft?.appliesTo ?? origin?.scopePrefill)
      : undefined
    const initial = { ...emptyForm, appliesTo: scope ? [scope] : [] }
    return !editing && typeof proposal === "string" && proposal.trim()
      ? {
          ...initial,
          decisionState: "DECIDED" as const,
          outcome: proposal.slice(0, 500),
        }
      : initial
  })
  const [listText, setListText] = useState(emptyListText)
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [original, setOriginal] = useState({ title: "", outcome: "" })
  const [recoverable, setRecoverable] = useState<DecisionFormDraft | null>(null)
  const [storageError, setStorageError] = useState("")
  const [draftSaved, setDraftSaved] = useState(false)
  const baseline = useRef({ form, listText })
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null)
  const draftKey = useRef("")
  const draftFinished = useRef(false)

  useEffect(() => {
    // Keep the snapshot recoverable through a failed initial load or reload.
    if (loading || loadError || !origin?.captureDraft) return
    void navigate(location.pathname, { replace: true, state: { ...origin, captureDraft: undefined } })
  }, [origin, navigate, location.pathname, loading, loadError])

  useEffect(() => {
    let active = true
    void Promise.all([
      api.metadata(),
      id ? api.decision(id) : Promise.resolve(null),
    ])
      .then(([meta, decision]) => {
        if (!active) return
        setMetadata(meta)
        draftKey.current = browserStorageKey(meta, `form-draft:${id ?? "new"}`)
        setBaseUpdatedAt(decision?.updatedAt ?? null)
        if (decision) {
          setOriginal({
            title: decision.title,
            outcome: decision.outcome ?? decision.title,
          })
          const loadedForm: DecisionInput = {
            title: decision.title,
            decisionState: decision.decisionState ?? "DECIDED",
            outcome: decision.outcome ?? decision.title,
            dueDate: decision.dueDate ?? null,
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
          }
          const loadedListText = {
            tags: decision.tags.join(", "),
            options: decision.optionsConsidered.join("\n"),
          }
          baseline.current = { form: loadedForm, listText: loadedListText }
          setForm(loadedForm)
          setListText(loadedListText)
        }
        const stored = readBrowserValue(draftKey.current, validDecisionDraft)
        const returned = returnedDraft.current
        if (!editing && returned?.storageKey === draftKey.current && validDecisionDraft(returned.draft)) {
          setForm(returned.draft.form)
          setListText(returned.draft.listText)
          setRecoverable(null)
          returnedDraft.current = undefined
        } else {
          setRecoverable(stored.value)
        }
        setStorageError(stored.error)
      })
      .catch((error) => {
        if (active)
          setLoadError(
            error instanceof Error ? error.message : "Could not load the form."
          )
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, attempt, editing])

  useEffect(() => {
    if (
      loading ||
      loadError ||
      recoverable ||
      !draftKey.current ||
      draftFinished.current
    )
      return
    const changed =
      JSON.stringify({ form, listText }) !== JSON.stringify(baseline.current)
    if (!changed && !draftSaved) return
    const ok = writeBrowserValue(
      draftKey.current,
      changed
        ? ({ form, listText, baseUpdatedAt } satisfies DecisionFormDraft)
        : null
    )
    setDraftSaved(ok && changed)
    setStorageError(
      ok
        ? ""
        : "Draft recovery is unavailable: could not write to browser storage. Keep this page open until you save your decision."
    )
  }, [
    form,
    listText,
    loading,
    loadError,
    recoverable,
    draftSaved,
    baseUpdatedAt,
  ])

  function discardDraft() {
    const removed = writeBrowserValue(draftKey.current, null)
    setRecoverable(null)
    setForm(baseline.current.form)
    setListText(baseline.current.listText)
    setDraftSaved(false)
    setStorageError(
      removed
        ? ""
        : "Could not remove the stored draft. It is ignored for this visit and may reappear when you return."
    )
  }

  useEffect(() => {
    if (!loading && !loadError && !editing && origin?.scopePrefill)
      formRef.current?.querySelector<HTMLTextAreaElement>("#decision")?.focus()
  }, [loading, loadError, editing, origin?.scopePrefill])

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
      references: [...current.references, { kind: "URL", label: "", url: "" }],
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

  function reviewChoice() {
    const draft = { form, listText, baseUpdatedAt } satisfies DecisionFormDraft
    const captureDraft = { draft, storageKey: draftKey.current }
    // Keep the previous history entry recoverable for browser Back as well.
    void navigate(location.pathname, { replace: true, state: { ...origin, captureDraft } })
    void navigate("/check-proposal", {
      state: {
        proposalDraft: { proposal: form.outcome ?? "", appliesTo: form.appliesTo.length === 1 ? form.appliesTo[0] : "" },
        captureReturn: { ...captureDraft, origin },
      } satisfies DecisionNavigationState,
    })
  }

  const pending = form.decisionState === "PENDING"
  const primaryValue = pending ? form.title : (form.outcome ?? "")

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (loading || loadError || recoverable || !primaryValue.trim() || saving)
      return
    setSaving(true)
    const input: DecisionInput = {
      ...form,
      title: pending
        ? form.title.trim()
        : !form.title.trim() ||
            (editing &&
              original.title === original.outcome &&
              form.title === original.title)
          ? primaryValue.trim()
          : form.title.trim(),
      outcome: pending ? null : primaryValue.trim(),
      appliesTo: form.appliesTo,
      tags: splitList(listText.tags, ","),
      optionsConsidered: splitList(listText.options, "\n"),
      references: form.references.filter((reference) => reference.url.trim()),
    }
    try {
      const decision = id
        ? await api.updateDecision(id, input)
        : await api.createDecision(input)
      toast.success(id ? "Decision updated." : "Decision saved.")
      draftFinished.current = true
      if (!writeBrowserValue(draftKey.current, null))
        toast.warning(
          "Decision saved, but its browser draft could not be removed."
        )
      navigate(`/decisions/${decision.id}`, { state: origin })
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
    return (
      <div className="page-frame max-w-5xl">
        <h1>Could not load Decision form</h1>
        <p role="alert">{loadError}</p>
        <Button
          className="w-fit"
          onClick={() => {
            setLoading(true)
            setLoadError("")
            setAttempt((value) => value + 1)
          }}
        >
          Try again
        </Button>
        <Button
          className="w-fit"
          variant="outline"
          render={<Link to="/" />}
          nativeButton={false}
        >
          Return to library
        </Button>
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      className="page-frame max-w-5xl pb-28"
      onSubmit={submit}
    >
      <Button
        variant="ghost"
        size="sm"
        render={
          <Link
            to={id ? `/decisions/${id}` : libraryUrl}
            state={id ? origin : (origin?.libraryState ?? origin)}
          />
        }
        nativeButton={false}
        className="-ml-2 w-fit"
      >
        <ArrowLeft data-icon="inline-start" /> Back
      </Button>
      <div>
        <p className="eyebrow">
          {editing ? "Edit record" : "Capture a question or choice"}
        </p>
        <h1>{editing ? "Edit Decision" : "New Decision"}</h1>
        <p className="mt-2 text-muted-foreground">
          {pending
            ? "Start with the question. You can add context and record your choice later."
            : "Save the choice now; add any supporting context when useful."}
        </p>
      </div>
      <section
        aria-label="Form draft recovery"
        className="flex flex-col gap-2 text-sm"
        aria-live="polite"
      >
        {recoverable ? (
          <>
            <p className="font-medium">
              Unfinished draft available in this browser
            </p>
            <p className="break-words text-muted-foreground">
              {recoverable.form.decisionState === "PENDING"
                ? recoverable.form.title
                : recoverable.form.outcome}
            </p>
            {recoverable.baseUpdatedAt !== baseUpdatedAt ? (
              <>
                <p>
                  The saved decision changed since this draft. Copy any text you
                  need below, then discard the draft to edit the latest record.
                </p>
                <details>
                  <summary>Review recovered draft</summary>
                  <Textarea
                    aria-label="Recovered draft text"
                    readOnly
                    value={recoveredDraftText(recoverable, metadata)}
                    className="mt-2 min-h-48"
                  />
                </details>
              </>
            ) : (
              <p>
                Restore it to continue, or discard it to start from the form you
                opened. Nothing is saved to the team record until you select
                Save Decision.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {recoverable.baseUpdatedAt === baseUpdatedAt ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(recoverable.form)
                    setListText(recoverable.listText)
                    setDraftSaved(true)
                    setRecoverable(null)
                  }}
                >
                  Restore draft
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={discardDraft}>
                Discard draft
              </Button>
            </div>
          </>
        ) : draftSaved ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Draft saved in this browser. You can leave and return to continue.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={discardDraft}
            >
              Discard draft
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Unfinished changes are kept in this browser for recovery.
          </p>
        )}
        {storageError ? <p role="alert">{storageError}</p> : null}
      </section>
      <fieldset
        disabled={Boolean(recoverable) || saving}
        className="flex min-w-0 flex-col gap-6"
      >
        {!editing ? (
          <ToggleGroup
            aria-label="Decision type"
            value={[form.decisionState]}
            onValueChange={(values) => {
              if (values[0])
                set(
                  "decisionState",
                  values[0] === "PENDING" ? "PENDING" : "DECIDED"
                )
            }}
            variant="outline"
            spacing={0}
          >
            <ToggleGroupItem value="PENDING">Pending decision</ToggleGroupItem>
            <ToggleGroupItem value="DECIDED">Already decided</ToggleGroupItem>
          </ToggleGroup>
        ) : null}
        <div className="form-layout">
          <FieldGroup className="form-column-main">
            <Field data-invalid={submitted && !primaryValue.trim()}>
              <FieldLabel htmlFor="decision">
                {pending ? "What needs to be decided?" : "What did you decide?"}{" "}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="decision"
                maxLength={500}
                value={primaryValue}
                onChange={(event) =>
                  set(pending ? "title" : "outcome", event.target.value)
                }
                aria-invalid={submitted && !primaryValue.trim()}
                placeholder={
                  pending
                    ? "Which storage should we use for migration backups?"
                    : "Use object storage for migration backups."
                }
                className="min-h-28 resize-y text-base"
                required
              />
              <FieldDescription>
                This is the only required field.
              </FieldDescription>
              {submitted && !primaryValue.trim() ? (
                <FieldError>
                  {pending ? "Enter the question." : "Record the final choice."}
                </FieldError>
              ) : null}
            </Field>
            {!pending ? (
              <Field>
                <FieldLabel htmlFor="why">Why? (optional)</FieldLabel>
                <Textarea
                  id="why"
                  value={form.why}
                  onChange={(event) => set("why", event.target.value)}
                  placeholder="What made this the right choice?"
                  className="min-h-28 resize-y"
                />
                <FieldDescription>
                  Help teammates understand the reason. You can also add it
                  later.
                </FieldDescription>
              </Field>
            ) : null}
            {/* Beside the question so automatic matches are visible while typing. */}
            {!editing && !saving && !recoverable ? (
              <RelatedDecisionSearch
                key={JSON.stringify([
                  form.decisionState,
                  primaryValue,
                  form.appliesTo,
                ])}
                query={primaryValue}
                scopes={form.appliesTo}
                available={Boolean(metadata?.features.memorySearch)}
                origin={origin}
              />
            ) : null}
          </FieldGroup>
          <FieldGroup className="form-column-side">
            <Field>
              <FieldLabel htmlFor="appliesTo">Applies To (optional)</FieldLabel>
              <ScopePicker
                value={form.appliesTo}
                options={metadata?.appliesTo ?? []}
                onChange={(value) => set("appliesTo", value)}
              />
            </Field>
            {pending || editing ? (
              <Field>
                <FieldLabel htmlFor="due-date">
                  {pending
                    ? "Decide by (optional)"
                    : "Original deadline (optional)"}
                </FieldLabel>
                <Input
                  id="due-date"
                  type="date"
                  value={form.dueDate ?? ""}
                  onChange={(event) =>
                    set("dueDate", event.target.value || null)
                  }
                />
              </Field>
            ) : null}
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
                  <SelectGroup>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {metadata?.users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.displayName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </div>
        <details className="decision-more-details" open={editing || undefined}>
          <summary>More details</summary>
          <div className="form-layout">
            <FieldGroup className="form-column-main">
              {!pending ? (
                <Field>
                  <FieldLabel htmlFor="original-question">
                    Original question (optional)
                  </FieldLabel>
                  <Textarea
                    id="original-question"
                    maxLength={500}
                    value={form.title}
                    onChange={(event) => set("title", event.target.value)}
                  />
                  <FieldDescription>
                    Leave blank to use your final choice as the title.
                  </FieldDescription>
                </Field>
              ) : null}
              {pending ? (
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
              ) : null}
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
                              <SelectGroup>
                                <SelectItem value="JIRA">Jira</SelectItem>
                                <SelectItem value="URL">URL</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <Input
                            aria-label={`Related link ${index + 1} label`}
                            value={reference.label}
                            onChange={(event) =>
                              updateReference(index, {
                                label: event.target.value,
                              })
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
                              updateReference(index, {
                                url: event.target.value,
                              })
                            }
                            placeholder="https://..."
                            className="pl-9"
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
        </details>
      </fieldset>
      {!editing && !pending && !recoverable ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={saving || primaryValue.trim().length < 3} onClick={reviewChoice}>
            Review this choice
          </Button>
          <p className="text-xs text-muted-foreground">Check against existing decisions. Your full draft is kept; analysis runs only when requested.</p>
        </div>
      ) : null}
      <div className="form-actions">
        <Button
          type="button"
          variant="outline"
          render={
            <Link
              to={id ? `/decisions/${id}` : libraryUrl}
              state={id ? origin : (origin?.libraryState ?? origin)}
            />
          }
          nativeButton={false}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving || Boolean(recoverable)}>
          <Save data-icon="inline-start" />
          {saving ? "Saving…" : "Save Decision"}
        </Button>
      </div>
    </form>
  )
}
