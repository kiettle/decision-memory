import { Bookmark, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { SearchableSelect } from "@/components/searchable-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { readBrowserValue, writeBrowserValue } from "@/lib/browser-storage"

const viewKeys = [
  "q",
  "channel",
  "ownerId",
  "tag",
  "status",
  "appliesTo",
  "dateRange",
  "deadline",
  "view",
  "sort",
]

// Store only known library inputs, never navigation state or generated results.
export function libraryViewSearch(search: string) {
  const source = new URLSearchParams(search)
  const result = new URLSearchParams()
  for (const key of viewKeys) {
    let value = source.get(key)
    if (key === "status" && value === "ACTIVE") value = "DECIDED"
    if (
      value &&
      value !== "ALL" &&
      !(key === "view" && value === "flat") &&
      !(key === "sort" && value === "NEWEST")
    )
      result.set(key, value)
  }
  return result.toString()
}

type SavedView = { id: string; name: string; search: string }
function validViews(value: unknown): value is SavedView[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        item.id.length > 0 &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        item.name.length <= 80 &&
        typeof item.search === "string" &&
        libraryViewSearch(item.search) === item.search
    )
  )
}

export function SavedLibraryViews({
  storageKey,
  search,
  onApply,
}: {
  storageKey: string
  search: string
  onApply: (search: string) => void
}) {
  const [stored] = useState(() => readBrowserValue(storageKey, validViews))
  const [views, setViews] = useState(stored.value ?? [])
  const [error, setError] = useState(stored.error)
  const [mode, setMode] = useState<"save" | "rename" | null>(null)
  const open = mode !== null
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const current = libraryViewSearch(search)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => stored.value?.find((view) => view.search === current)?.id ?? null
  )
  // Retain the chosen identity while filters change; never persist implicitly.
  const selected =
    selectedId === null
      ? views.find((view) => view.search === current)
      : views.find((view) => view.id === selectedId)
  const modified = Boolean(selected && selected.search !== current)

  function begin(nextMode: "save" | "rename") {
    setName(nextMode === "rename" ? (selected?.name ?? "") : "")
    setNameError("")
    setMode(nextMode)
  }

  function updateView() {
    if (!selected) return
    const duplicate = views.find(
      (view) => view.id !== selected.id && view.search === current
    )
    if (duplicate) {
      setError(`This configuration is already saved as “${duplicate.name}”.`)
      return
    }
    if (
      persist(
        views.map((view) =>
          view.id === selected.id ? { ...view, search: current } : view
        )
      )
    ) {
      toast.success("Saved view updated.")
    }
  }

  function persist(next: SavedView[]) {
    if (!writeBrowserValue(storageKey, next)) {
      setError(
        "Could not save views in this browser. Check browser storage and try again."
      )
      return false
    }
    setViews(next)
    setError("")
    return true
  }

  return (
    <section aria-label="Saved library views" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchableSelect
          label="Saved views"
          value={selected?.id ?? ""}
          options={[
            {
              value: "",
              label: views.length
                ? "Choose a saved view"
                : "No saved views yet",
            },
            ...views.map((view) => ({ value: view.id, label: view.name })),
          ]}
          onChange={(id) => {
            const view = views.find((item) => item.id === id)
            setSelectedId(id)
            setError("")
            if (view) onApply(view.search)
          }}
        />
        <Button variant="outline" onClick={() => begin("save")}>
          <Bookmark data-icon="inline-start" />
          {selected ? "Save as new" : "Save view"}
        </Button>
        {modified ? (
          <Button variant="outline" onClick={updateView}>
            Update view
          </Button>
        ) : null}
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next) setMode(null)
            setNameError("")
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {mode === "rename"
                  ? "Rename library view"
                  : "Save library view"}
              </DialogTitle>
              <DialogDescription>
                {mode === "rename"
                  ? "Change the name only. Your saved configuration and current filters stay the same."
                  : "Keep this query, filters, sort and layout for this workspace and user in this browser. AI results are not saved."}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const trimmed = name.trim()
                if (!trimmed) {
                  setNameError("Enter a view name.")
                  return
                }
                if (
                  views.some(
                    (view) =>
                      (mode !== "rename" || view.id !== selected?.id) &&
                      view.name.toLowerCase() === trimmed.toLowerCase()
                  )
                ) {
                  setNameError(
                    "A view with this name already exists. Choose another name."
                  )
                  return
                }
                if (mode === "rename" && selected) {
                  if (
                    persist(
                      views.map((view) =>
                        view.id === selected.id
                          ? { ...view, name: trimmed }
                          : view
                      )
                    )
                  ) {
                    setMode(null)
                    toast.success("Saved view renamed.")
                  }
                  return
                }
                const duplicate = views.find((view) => view.search === current)
                if (duplicate) {
                  setNameError(
                    `This configuration is already saved as “${duplicate.name}”.`
                  )
                  return
                }
                const id = crypto.randomUUID()
                if (
                  persist([...views, { id, name: trimmed, search: current }])
                ) {
                  setSelectedId(id)
                  setMode(null)
                  setName("")
                  toast.success("View saved in this browser.")
                }
              }}
              className="flex flex-col gap-4"
            >
              <FieldGroup>
                <Field data-invalid={Boolean(nameError)}>
                  <FieldLabel htmlFor="saved-view-name">View name</FieldLabel>
                  <Input
                    id="saved-view-name"
                    maxLength={80}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setNameError("")
                    }}
                    placeholder="My overdue decisions"
                    aria-invalid={Boolean(nameError)}
                    autoFocus
                  />
                  {nameError ? (
                    <FieldError role="alert">{nameError}</FieldError>
                  ) : null}
                </Field>
              </FieldGroup>
              {error ? <p role="alert">{error}</p> : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode(null)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {mode === "rename" ? "Rename view" : "Save view"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {selected ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Rename saved view ${selected.name}`}
              title="Rename view"
              onClick={() => begin("rename")}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Delete view"
              aria-label={`Delete saved view ${selected.name}`}
              onClick={() => {
                if (persist(views.filter((view) => view.id !== selected.id))) {
                  setSelectedId(null)
                  toast.success(
                    "Saved view deleted. Your current filters are kept."
                  )
                }
              }}
            >
              <Trash2 />
            </Button>
          </>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {modified ? "Unsaved changes · " : ""}Saved in this browser
        </span>
      </div>
      {error && !open ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
    </section>
  )
}
