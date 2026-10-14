import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, api } from "@/lib/api"
import type { Decision } from "@/types"

export function DecisionActions({ decision, onSaved }: { decision: Decision; onSaved: (decision: Decision) => void }) {
  const [action, setAction] = useState<"DEADLINE" | "OUTCOME" | null>(null)
  const [dueDate, setDueDate] = useState("")
  const [outcome, setOutcome] = useState("")
  const [why, setWhy] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState(false)

  const open = (next: typeof action) => {
    setDueDate(decision.dueDate ?? "")
    setOutcome("")
    setWhy(decision.why ?? "")
    setError("")
    setConflict(false)
    setAction(next)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    if (action === "OUTCOME" && !outcome.trim()) { setError("Record the final choice."); return }
    setSaving(true)
    setError("")
    setConflict(false)
    try {
      const saved = action === "DEADLINE"
        ? await api.updateDeadline(decision.id, dueDate || null)
        : await api.recordOutcome(decision.id, { outcome: outcome.trim(), why })
      onSaved(saved)
      setAction(null)
      toast.success(action === "DEADLINE" ? "Deadline updated." : "Decision recorded.")
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save. Please retry.")
      setConflict(failure instanceof ApiError && failure.code === "DECISION_ALREADY_RECORDED")
    } finally { setSaving(false) }
  }
  return <>
    <div className="flex flex-wrap gap-2">
      {decision.decisionState === "PENDING" ? <Button type="button" size="sm" onClick={() => open("OUTCOME")}>Record decision</Button> : null}
      <Button type="button" size="sm" variant="outline" onClick={() => open("DEADLINE")}>{decision.dueDate ? "Edit deadline" : "Set deadline"}</Button>
    </div>
    <Dialog open={action !== null} onOpenChange={(value) => { if (!value && !saving) setAction(null) }}>
      <DialogContent>
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{action === "DEADLINE" ? "Edit deadline" : "Record decision"}</DialogTitle>
            <DialogDescription>{action === "DEADLINE" ? "Choose a date or clear it. Deadline indicators use your local date." : `Original question: ${decision.title}`}</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-5">
            {action === "DEADLINE" ? <Field>
              <FieldLabel htmlFor={`deadline-${decision.id}`}>Decide by</FieldLabel>
              <Input id={`deadline-${decision.id}`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={saving} />
              <FieldDescription>Optional. Past dates are allowed.</FieldDescription>
              <Button type="button" variant="link" className="w-fit" disabled={saving || !dueDate} onClick={() => setDueDate("")}>Clear date</Button>
            </Field> : <>
              <Field data-invalid={Boolean(error) && !outcome.trim()}>
                <FieldLabel htmlFor={`outcome-${decision.id}`}>What did you decide?</FieldLabel>
                <Textarea id={`outcome-${decision.id}`} value={outcome} onChange={(event) => setOutcome(event.target.value)} maxLength={500} required disabled={saving} aria-invalid={Boolean(error) && !outcome.trim()} />
                <FieldDescription>This is the only required field. Your original question is preserved.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`why-${decision.id}`}>Why (optional)</FieldLabel>
                <Textarea id={`why-${decision.id}`} value={why} maxLength={20_000} onChange={(event) => setWhy(event.target.value)} disabled={saving} />
              </Field>
            </>}
            {error ? <FieldError role="alert">{error}{conflict ? <> <Link to={`/decisions/${decision.id}/edit`} className="underline">Open recorded decision to edit</Link></> : null}</FieldError> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setAction(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : action === "DEADLINE" ? "Save deadline" : "Record decision"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>
}
