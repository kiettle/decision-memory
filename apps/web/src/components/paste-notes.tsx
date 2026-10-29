import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function PasteNotes({ source, onChange, onReview }: {
  source?: { excerpt: string; origin: string }
  onChange: (source: { excerpt: string; origin: string } | undefined) => void
  onReview: (choice: string) => void
}) {
  const notes = source?.excerpt ?? ""
  const candidates = [...new Set(notes.split(/\n+/).map(line => line.trim()).filter(line => line.length >= 3))].slice(0, 12)
  return <details className="border-y py-4">
    <summary className="cursor-pointer font-medium">Paste meeting notes or discussion</summary>
    <FieldGroup className="mt-4">
      <Field><FieldLabel htmlFor="notes-origin">Notes origin (your label)</FieldLabel><Input id="notes-origin" maxLength={200} value={source?.origin ?? "Meeting notes"} onChange={e => onChange({ excerpt: notes, origin: e.target.value })} /><FieldDescription>For example: Atlas planning, 29 October. This label does not verify the source.</FieldDescription></Field>
      <Field><FieldLabel htmlFor="pasted-notes">Pasted notes</FieldLabel><Textarea id="pasted-notes" maxLength={20000} value={notes} className="min-h-32" onChange={e => onChange(e.target.value ? { excerpt: e.target.value, origin: source?.origin ?? "Meeting notes" } : undefined)} /><FieldDescription>Stays local until Save Decision. No AI is used. The complete supplied excerpt will be attached as pasted notes, visible to this workspace.</FieldDescription></Field>
      {candidates.length ? <section aria-label="Candidate decisions" className="grid gap-3"><h2 className="font-semibold">Review a candidate</h2><p className="text-sm text-muted-foreground">These are note lines, not established decisions. Select one, then correct the choice, reason and scope below. Save one confirmed decision at a time. Other lines may be questions or discussion.</p>
        {candidates.map((candidate, index) => <div key={index} className="flex flex-wrap items-start justify-between gap-2 border-b pb-3"><p className="min-w-0 flex-1 break-words text-sm whitespace-pre-wrap">{candidate.slice(0, 500)}{candidate.length > 500 ? "… (review the full notes)" : ""}</p><Button type="button" variant="outline" onClick={() => onReview(candidate.slice(0, 500))}>Review candidate {index + 1}</Button></div>)}
        <p className="text-sm">Showing up to 12 distinct note lines. You can write a choice manually from any part of the full excerpt.</p>
      </section> : null}
      {source ? <Button className="w-fit" type="button" variant="ghost" onClick={() => onChange(undefined)}>Remove pasted source from draft</Button> : null}
    </FieldGroup>
  </details>
}
