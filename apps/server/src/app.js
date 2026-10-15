import cors from "cors"
import express from "express"
import helmet from "helmet"

import { createApiRouter } from "./api.js"
import { createIdentityMiddleware } from "./auth.js"
import { createCaptureDrafter } from "./capture-draft.js"
import { createJiraClient } from "./jira.js"
import { createMemorySearchService } from "./memory-search.js"
import { createGeminiMemorySearchService } from "./gemini-memory-search.js"
import { createSlackRouter } from "./slack.js"
import { createProposalReviewService } from "./proposal-review.js"

// The integrations shared by the API and the Slack listener. Tests pass fakes.
export function createServices({ config, repository, memorySearch, geminiMemorySearch, captureDrafter, jira, proposalReview }) {
  const localSearch = memorySearch ?? createMemorySearchService({ config, repository })
  return {
    memorySearch: localSearch,
    proposalReview: proposalReview ?? createProposalReviewService({ config, repository, memorySearch: localSearch }),
    geminiMemorySearch: geminiMemorySearch ?? createGeminiMemorySearchService({ config, repository }),
    captureDrafter: captureDrafter ?? createCaptureDrafter({ config }),
    jira: jira ?? createJiraClient({ config }),
  }
}

export function createApp({ config, repository, ...overrides }) {
  const services = createServices({ config, repository, ...overrides })
  const app = express()
  app.disable("x-powered-by")
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: config.webOrigin }))
  app.use("/slack", createSlackRouter(config, repository, services))
  app.use(express.json({ limit: "1mb" }))

  const identity = createIdentityMiddleware(config)
  const features = {
    slack: Boolean(config.slackBotToken && config.slackSigningSecret && config.slackTeamId),
    jira: services.jira.enabled,
  }
  app.use("/api", createApiRouter(repository, identity, services, features))

  app.get("/health", (_req, res) => res.json({ status: "ok" }))
  return app
}

// This is the only listener that the local Slack tunnel should expose.
// Never mount the synthetic-identity API on this application.
export function createSlackApp({ config, repository, ...overrides }) {
  const services = createServices({ config, repository, ...overrides })
  const app = express()
  app.disable("x-powered-by")
  app.use(helmet())
  app.use("/slack", createSlackRouter(config, repository, services))
  app.use((_req, res) => res.status(404).json({ error: "Not found." }))
  return app
}
