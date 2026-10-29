import express from "express"
import { z } from "zod"

import { createLinkedJiraIssue } from "./jira.js"
import { DomainError } from "./domain.js"
import { proposalReviewInput } from "./proposal-review.js"
import { answerContext } from "./answer-context.js"

import { calendarDateInput, deadlineInput, decideInput, decisionInput, replacementReasonInput } from "./validation.js"

const decisionFilters = z.object({
  channel: z.string().max(200).optional(),
  ownerId: z.string().max(205).optional(),
  tag: z.string().max(80).optional(),
  status: z.enum(["ALL", "ACTIVE", "SUPERSEDED"]).optional(),
  decisionState: z.enum(["ALL", "PENDING", "DECIDED"]).optional(),
  deadline: z.enum(["ALL", "OVERDUE", "DUE_SOON", "UPCOMING", "UNSCHEDULED"]).optional(),
  asOf: calendarDateInput.optional(),
  sort: z.enum(["NEWEST", "DEADLINE"]).optional(),
  appliesTo: z.string().max(200).optional(),
  dateRange: z.string().max(20).optional(),
}).refine((filters) => !filters.deadline || filters.deadline === "ALL" || Boolean(filters.asOf), { message: "Deadline filters need the viewer's local date.", path: ["asOf"] })
const memorySearchInput = z.object({
  query: z.string().trim().min(3).max(500),
  method: z.enum(["LOCAL", "GEMINI"]).default("LOCAL"),
  filters: decisionFilters.optional(),
})

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

const jiraIssueInput = z.object({
  requestId: z.string().uuid(),
  projectKey: z.string().regex(/^[A-Z][A-Z0-9_]{0,49}$/, "Choose a Jira project."),
  issueTypeId: z.string().regex(/^\d+$/, "Choose an issue type."),
  summary: z.string().trim().min(1, "Summary is required.").max(255),
})

export function createApiRouter(repository, identityMiddleware, { memorySearch, geminiMemorySearch, jira, proposalReview }, features = {}) {
  const router = express.Router()
  router.use(identityMiddleware)
  router.use(["/follows", "/notifications"], (_req, res, next) => {
    res.set("Cache-Control", "private, no-store")
    next()
  })

  // A malformed id in a link or typed URL is simply a Decision that does not exist.
  router.param("id", (_req, res, next, id) => {
    if (z.string().uuid().safeParse(id).success) {
      next()
      return
    }
    res.status(404).json({ error: "Decision not found." })
  })

  router.get(
    "/metadata",
    asyncRoute(async (req, res) => {
      res.json({
        ...(await repository.metadata(req.identity)),
        features: { ...features, memorySearch: memorySearch.enabled, geminiMemorySearch: geminiMemorySearch.enabled, proposalAnalysis: proposalReview.enabled },
      })
    }),
  )

  router.post(
    "/decisions/check-proposal",
    asyncRoute(async (req, res) => {
      res.json(await proposalReview.check(req.identity, proposalReviewInput.parse(req.body)))
    }),
  )

  router.post(
    "/decisions/memory-search",
    asyncRoute(async (req, res) => {
      const input = memorySearchInput.parse(req.body)
      const service = input.method === "GEMINI" ? geminiMemorySearch : memorySearch
      res.json({ ...(await service.search(req.identity, input)), method: input.method })
    }),
  )

  router.post("/decisions/answer-context", asyncRoute(async (req, res) => {
    const { ids, scope } = z.object({ ids: z.array(z.string().uuid()).max(5), scope: z.string().min(1).max(200).optional() }).strict().parse(req.body)
    res.json(await answerContext(repository, req.identity, ids, scope))
  }))

  router.get("/scopes", asyncRoute(async (req, res) => {
    res.json(await repository.listScopes(req.identity))
  }))

  router.get("/follows", asyncRoute(async (req, res) => res.json(await repository.follows(req.identity))))
  router.put("/follows", asyncRoute(async (req, res) => {
    const input = z.object({ kind: z.enum(["DECISION", "SCOPE"]), target: z.string().min(1).max(200), following: z.boolean() }).strict().parse(req.body)
    if (input.kind === "DECISION" && !z.string().uuid().safeParse(input.target).success) return res.status(404).json({ error: "Decision not found." })
    res.json(await repository.setFollow(req.identity, input))
  }))
  router.get("/notifications", asyncRoute(async (req, res) => res.json(await repository.notifications(req.identity))))
  router.put("/notifications/read", asyncRoute(async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.string().uuid()).max(100) }).strict().parse(req.body)
    res.json(await repository.readNotifications(req.identity, ids))
  }))
  router.put("/decisions/:id/important", asyncRoute(async (req, res) => {
    const { important } = z.object({ important: z.boolean() }).strict().parse(req.body)
    res.json(await repository.setImportant(req.identity, req.params.id, important))
  }))

  router.get("/scopes/overview", asyncRoute(async (req, res) => {
    const { scope } = z.object({ scope: z.string().min(1).max(200) }).parse(req.query)
    const overview = await repository.scopeOverview(req.identity, scope)
    if (!overview) return res.status(404).json({ error: "Scope not found." })
    res.json(overview)
  }))

  router.get(
    "/decisions",
    asyncRoute(async (req, res) => {
      res.json(
        await repository.listDecisions(req.identity, {
          ...decisionFilters.parse(req.query),
          q: typeof req.query.q === "string" ? req.query.q : undefined,
        }),
      )
    }),
  )

  router.get(
    "/decisions/:id",
    asyncRoute(async (req, res) => {
      const decision = await repository.getDecision(req.identity, req.params.id)
      if (!decision) {
        res.status(404).json({ error: "Decision not found." })
        return
      }
      res.json(decision)
    }),
  )

  router.post(
    "/decisions",
    asyncRoute(async (req, res) => {
      const input = decisionInput.parse(req.body)
      res.status(201).json(await repository.createDecision(req.identity, input))
    }),
  )

  router.put(
    "/decisions/:id",
    asyncRoute(async (req, res) => {
      const input = decisionInput.parse(req.body)
      if (input.pastedSource) throw new DomainError("Pasted evidence is attached during new capture. Existing evidence is preserved; add a related evidence link when editing.", 400, "PASTED_SOURCE_CREATE_ONLY")
      const decision = await repository.updateDecision(req.identity, req.params.id, input)
      if (!decision) {
        res.status(404).json({ error: "Decision not found." })
        return
      }
      res.json(decision)
    }),
  )

  router.put("/decisions/:id/deadline", asyncRoute(async (req, res) => {
    const decision = await repository.updateDeadline(req.identity, req.params.id, deadlineInput.parse(req.body))
    if (!decision) return res.status(404).json({ error: "Decision not found." })
    res.json(decision)
  }))

  router.post("/decisions/:id/decide", asyncRoute(async (req, res) => {
    const decision = await repository.recordOutcome(req.identity, req.params.id, decideInput.parse(req.body))
    if (!decision) return res.status(404).json({ error: "Decision not found." })
    res.json(decision)
  }))

  router.get(
    "/jira/projects",
    asyncRoute(async (_req, res) => {
      res.json(await jira.projects())
    }),
  )

  router.get(
    "/jira/projects/:projectKey/issue-types",
    asyncRoute(async (req, res) => {
      res.json(await jira.issueTypes(req.params.projectKey))
    }),
  )

  // Spec §18: create a Jira issue from a Decision and keep its key as related work.
  router.post(
    "/decisions/:id/jira-issue",
    asyncRoute(async (req, res) => {
      const input = jiraIssueInput.parse(req.body)
      const decision = await repository.getDecision(req.identity, req.params.id)
      if (!decision) {
        res.status(404).json({ error: "Decision not found." })
        return
      }
      const { requestId, ...fields } = input
      res.status(201).json(await createLinkedJiraIssue({ repository, jira,
        identity: req.identity, decision, requestId, input: fields }))
    }),
  )

  router.post(
    "/decisions/:id/supersede",
    asyncRoute(async (req, res) => {
      const { targetId, replacementReason } = z.object({ targetId: z.string().uuid(), replacementReason: replacementReasonInput }).parse(req.body)
      res.json(
        await repository.supersedeDecision(req.identity, req.params.id, targetId, replacementReason),
      )
    }),
  )

  router.use((error, _req, res, _next) => {
    void _next
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "The request is invalid.", details: error.issues })
      return
    }
    if (error instanceof DomainError) {
      res.status(error.status).json({ error: error.message, code: error.code, ...(error.issue ? { issue: error.issue } : {}) })
      return
    }
    console.error("API request failed", { code: "INTERNAL_ERROR" })
    res.status(500).json({ error: "The request could not be completed." })
  })

  return router
}
