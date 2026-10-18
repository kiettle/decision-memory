import { useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { DeadlineShortcuts } from "@/components/deadline-shortcuts"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { browserStorageKey } from "@/lib/browser-storage"
import {
  navigationHistoryIndex,
  type CompletionDraft,
  type DecisionNavigationState,
} from "@/lib/decision-navigation"
import { ApiError, api } from "@/lib/api"
import type { Decision } from "@/types"

export function DecisionActions({
  decision,
  onSaved,
  secondary = false,
  resumed,
  onDismiss,
}: {
  decision: Decision
  onSaved: (decision: Decision) => void
  secondary?: boolean
  resumed?: CompletionDraft
  onDismiss?: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [action, setAction] = useState<"DEADLINE" | "OUTCOME" | null>(
    resumed ? "OUTCOME" : null
  )
  const [reviewing, setReviewing] = useState(false)
  const [dueDate, setDueDate] = useState("")
  const [outcome, setOutcome] = useState(resumed?.outcome ?? "")
  const [why, setWhy] = useState(resumed?.why ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState(false)
  const reviewEligible = outcome.replace(/\s/g, "").length >= 3

  const open = (next: typeof action) => {
    setDueDate(decision.dueDate ?? "")
    setOutcome("")
    setWhy(decision.why ?? "")
    setError("")
    setConflict(false)
    setAction(next)
  }
  const dismiss = () => {
    setAction(null)
    onDismiss?.()
  }
  async function review() {
    if (saving || reviewing || !reviewEligible) return
    setReviewing(true)
    setError("")
    try {
      const metadata = await api.metadata()
      if (!metadata.currentUser?.id) throw new Error("Missing identity")
      const draft: CompletionDraft = {
        token: crypto.randomUUID(),
        decisionId: decision.id,
        identityKey: browserStorageKey(metadata, `completion:${decision.id}`),
        outcome,
        why,
      }
      const state = {
        ...(location.state as DecisionNavigationState | null),
        completionDraft: undefined,
      }
      const url = location.pathname + location.search
      const historyIndex = navigationHistoryIndex()
      void navigate(url, {
        replace: true,
        state: { ...state, completionDraft: draft },
      })
      void navigate("/check-proposal", {
        state: {
          proposalDraft: {
            proposal: outcome,
            appliesTo:
              decision.appliesTo.length === 1 ? decision.appliesTo[0] : "",
          },
          completionReturn: { draft, url, state, historyIndex },
        } satisfies DecisionNavigationState,
      })
    } catch {
      setError(
        "Could not open review. Your choice and rationale are kept; try again or record the decision directly."
      )
    } finally {
      setReviewing(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (saving || reviewing) return
    if (action === "OUTCOME" && !outcome.trim()) {
      setError("Record the final choice.")
      return
    }
    setSaving(true)
    setError("")
    setConflict(false)
    try {
      const saved =
        action === "DEADLINE"
          ? await api.updateDeadline(decision.id, dueDate || null)
          : await api.recordOutcome(decision.id, {
              outcome: outcome.trim(),
              why,
            })
      onSaved(saved)
      dismiss()
      toast.success(
        action === "DEADLINE" ? "Deadline updated." : "Decision recorded."
      )
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save. Please retry."
      )
      setConflict(
        failure instanceof ApiError &&
          failure.code === "DECISION_ALREADY_RECORDED"
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      {!resumed ? (
        <div className="flex flex-wrap gap-2">
          {decision.decisionState === "PENDING" ? (
            <Button
              type="button"
              size="sm"
              variant={secondary ? "outline" : "default"}
              onClick={() => open("OUTCOME")}
            >
              Record decision
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => open("DEADLINE")}
          >
            {decision.dueDate ? "Edit deadline" : "Set deadline"}
          </Button>
        </div>
      ) : null}
      <Dialog
        open={action !== null}
        onOpenChange={(value) => {
          if (!value && !saving && !reviewing) dismiss()
        }}
      >
        <DialogContent>
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>
                {action === "DEADLINE" ? "Edit deadline" : "Record decision"}
              </DialogTitle>
              <DialogDescription>
                {action === "DEADLINE"
                  ? "Choose a date or clear it. Deadline indicators use your local date."
                  : `Original question: ${decision.title}`}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-5">
              {action === "DEADLINE" ? (
                <Field>
                  <FieldLabel htmlFor={`deadline-${decision.id}`}>
                    Decide by
                  </FieldLabel>
                  <Input
                    id={`deadline-${decision.id}`}
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    disabled={saving || reviewing}
                  />
                  <FieldDescription>
                    Optional. Past dates are allowed.
                  </FieldDescription>
                  {decision.decisionState === "PENDING" ? (
                    <DeadlineShortcuts onChange={setDueDate} disabled={saving || reviewing} />
                  ) : null}
                  <Button
                    type="button"
                    variant="link"
                    className="w-fit"
                    disabled={saving || !dueDate}
                    onClick={() => setDueDate("")}
                  >
                    Clear date
                  </Button>
                </Field>
              ) : (
                <>
                  <Field data-invalid={Boolean(error) && !outcome.trim()}>
                    <FieldLabel htmlFor={`outcome-${decision.id}`}>
                      What did you decide?
                    </FieldLabel>
                    <Textarea
                      id={`outcome-${decision.id}`}
                      value={outcome}
                      onChange={(event) => setOutcome(event.target.value)}
                      maxLength={500}
                      required
                      disabled={saving || reviewing}
                      aria-invalid={Boolean(error) && !outcome.trim()}
                    />
                    <FieldDescription>
                      This is the only required field. Your original question is
                      preserved.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`why-${decision.id}`}>
                      Why (optional)
                    </FieldLabel>
                    <Textarea
                      id={`why-${decision.id}`}
                      value={why}
                      maxLength={20_000}
                      onChange={(event) => setWhy(event.target.value)}
                      disabled={saving || reviewing}
                    />
                  </Field>
                </>
              )}
              {error ? (
                <FieldError role="alert">
                  {error}
                  {conflict ? (
                    <>
                      {" "}
                      <Link
                        to={`/decisions/${decision.id}/edit`}
                        className="underline"
                      >
                        Open recorded decision to edit
                      </Link>
                    </>
                  ) : null}
                </FieldError>
              ) : null}
            </FieldGroup>
            <DialogFooter>
              {action === "OUTCOME" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || reviewing || !reviewEligible}
                  onClick={() => void review()}
                >
                  {reviewing ? "Opening review…" : "Review this choice"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={saving || reviewing}
                onClick={dismiss}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || reviewing}>
                {saving
                  ? "Saving…"
                  : action === "DEADLINE"
                    ? "Save deadline"
                    : "Record decision"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
