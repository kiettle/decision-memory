import { z } from "zod"
import { calendarDay } from "../../../shared/decision-deadlines.js"

const optionalText = z.string().max(20_000).optional().nullable()
export const calendarDateInput = z.string().refine((value) => calendarDay(value) !== null, "Enter a valid YYYY-MM-DD date.")
export const deadlineInput = z.object({ dueDate: calendarDateInput.nullable() }).strict()
export const decideInput = z.object({
  outcome: z.string().trim().min(1, "Record the final choice.").max(500),
  why: optionalText,
}).strict()
export const replacementReasonInput = z.string().trim().max(2000, "Use at most 2,000 characters for what changed.").optional()
export const decisionInput = z.object({
  title: z.string().trim().min(1, "Decision is required.").max(500, "Use at most 500 characters."),
  decisionState: z.enum(["PENDING", "DECIDED"]).optional(),
  dueDate: calendarDateInput.optional().nullable(),
  outcome: z.string().trim().max(500).optional().nullable(),
  why: optionalText,
  context: optionalText,
  appliesTo: z.array(z.string().max(200)).max(30).optional(),
  optionsConsidered: z.array(z.string().max(500)).max(30).optional(),
  ownerId: z.string().uuid().optional().nullable().or(z.literal("")),
  ownerName: z.string().max(200).optional().nullable(),
  tags: z.array(z.string().max(80)).max(30).optional(),
  references: z.array(z.object({
    kind: z.enum(["JIRA", "URL"]),
    label: z.string().max(200).optional().nullable(),
    url: z.string().trim().url("Enter a valid URL.").refine(
      (value) => /^https?:\/\//i.test(value), "Use an http:// or https:// URL.",
    ),
  })).max(20).optional(),
})
