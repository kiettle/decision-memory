import type { DecisionInput, Metadata } from "@/types"

export type ListText = { tags: string; options: string }
export type DecisionFormDraft = {
  form: DecisionInput
  listText: ListText
  baseUpdatedAt: string | null
}

export function recoveredDraftText(
  draft: DecisionFormDraft,
  metadata: Metadata | null
) {
  const { form, listText } = draft
  const owner =
    metadata?.users.find((user) => user.id === form.ownerId)?.displayName ||
    form.ownerName ||
    form.ownerId ||
    "Unassigned"
  return [
    `Decision type: ${form.decisionState === "PENDING" ? "Pending" : "Already decided"}`,
    `Question: ${form.title}`,
    `Final choice: ${form.outcome ?? ""}`,
    `Why: ${form.why}`,
    `Context: ${form.context}`,
    `Applies To:\n${form.appliesTo.join("\n")}`,
    `Decide by: ${form.dueDate ?? ""}`,
    `Owner: ${owner}`,
    `Tags: ${listText.tags}`,
    `Options Considered:\n${listText.options}`,
    `Related work:\n${form.references.map((link) => `${link.kind}: ${link.label}\n${link.url}`).join("\n")}`,
  ].join("\n\n")
}

export function validDecisionDraft(value: unknown): value is DecisionFormDraft {
  if (!value || typeof value !== "object") return false
  const draft = value as DecisionFormDraft
  const form = draft.form
  const strings = (items: unknown): items is string[] =>
    Array.isArray(items) && items.every((item) => typeof item === "string")
  return Boolean(
    form &&
    draft.listText &&
    (draft.baseUpdatedAt === null || typeof draft.baseUpdatedAt === "string") &&
    typeof draft.listText.tags === "string" &&
    typeof draft.listText.options === "string" &&
    typeof form.title === "string" &&
    (form.decisionState === "PENDING" || form.decisionState === "DECIDED") &&
    (form.outcome === null || typeof form.outcome === "string") &&
    (form.dueDate === null || typeof form.dueDate === "string") &&
    [form.why, form.context, form.ownerId, form.ownerName].every(
      (item) => typeof item === "string"
    ) &&
    strings(form.appliesTo) &&
    strings(form.tags) &&
    strings(form.optionsConsidered) &&
    Array.isArray(form.references) &&
    form.references.every(
      (item) =>
        item &&
        (item.kind === "URL" || item.kind === "JIRA") &&
        typeof item.label === "string" &&
        typeof item.url === "string"
    )
  )
}
