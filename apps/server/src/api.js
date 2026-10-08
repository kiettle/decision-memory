import express from "express"
import { z } from "zod"

import { DomainError } from "./domain.js"

import { decisionInput } from "./validation.js"

const decisionFilters = z.object({
  channel: z.string().max(200).optional(),
  ownerId: z.string().max(205).optional(),
  tag: z.string().max(80).optional(),
  status: z.enum(["ALL", "ACTIVE", "SUPERSEDED"]).optional(),
  appliesTo: z.string().max(200).optional(),
  dateRange: z.string().max(20).optional(),
})
const memorySearchInput = z.object({
  query: z.string().trim().min(3).max(500),
  filters: decisionFilters.optional(),
})

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

const jiraIssueInput = z.object({
  projectKey: z.string().regex(/^[A-Z][A-Z0-9_]{0,49}$/, "Choose a Jira project."),
  issueTypeId: z.string().regex(/^\d+$/, "Choose an issue type."),
  summary: z.string().trim().min(1, "Summary is required.").max(255),
})

export function createApiRouter(repository, identityMiddleware, { memorySearch, jira }, features = {}) {
  const router = express.Router()
  router.use(identityMiddleware)

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
        features: { ...features, memorySearch: memorySearch.enabled },
      })
    }),
  )

  router.post(
    "/decisions/memory-search",
    asyncRoute(async (req, res) => {
      const input = memorySearchInput.parse(req.body)
      res.json(await memorySearch.search(req.identity, input))
    }),
  )

  router.get(
    "/decisions",
    asyncRoute(async (req, res) => {
      res.json(
        await repository.listDecisions(req.identity, {
          q: typeof req.query.q === "string" ? req.query.q : undefined,
          status: req.query.status,
          channel: req.query.channel,
          ownerId: req.query.ownerId,
          tag: req.query.tag,
          appliesTo: req.query.appliesTo,
          dateRange: req.query.dateRange,
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
      const decision = await repository.updateDecision(req.identity, req.params.id, input)
      if (!decision) {
        res.status(404).json({ error: "Decision not found." })
        return
      }
      res.json(decision)
    }),
  )

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
      const issue = await jira.createIssue({ ...input, decision })
      const updated = await repository.addReference(req.identity, decision.id, {
        kind: "JIRA",
        label: issue.key,
        url: issue.url,
      })
      res.status(201).json({ issue, decision: updated })
    }),
  )

  router.post(
    "/decisions/:id/supersede",
    asyncRoute(async (req, res) => {
      const { targetId } = z.object({ targetId: z.string().uuid() }).parse(req.body)
      res.json(
        await repository.supersedeDecision(req.identity, req.params.id, targetId),
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
      res.status(error.status).json({ error: error.message, code: error.code })
      return
    }
    console.error("API request failed", { code: "INTERNAL_ERROR" })
    res.status(500).json({ error: "The request could not be completed." })
  })

  return router
}
