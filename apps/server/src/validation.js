import { z } from "zod"

const optionalText = z.string().max(20_000).optional().nullable()
export const decisionInput = z.object({
  title: z.string().trim().min(1, "Decision is required.").max(500, "Use at most 500 characters."),
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
