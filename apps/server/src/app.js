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
import { createThreadQuestionSummarizer } from "./thread-question.js"
import { createSettingsRouter } from "./settings-api.js"

// The integrations shared by the API and the Slack listener. Tests pass fakes.
export function createServices({ config, repository, memorySearch, geminiMemorySearch, captureDrafter, jira, proposalReview, threadQuestionSummarizer }) {
  const localSearch = memorySearch ?? createMemorySearchService({ config, repository })
  return {
    memorySearch: localSearch,
    proposalReview: proposalReview ?? createProposalReviewService({ config, repository, memorySearch: localSearch }),
    geminiMemorySearch: geminiMemorySearch ?? createGeminiMemorySearchService({ config, repository }),
    captureDrafter: captureDrafter ?? createCaptureDrafter({ config }),
    threadQuestionSummarizer: threadQuestionSummarizer ?? createThreadQuestionSummarizer({ config }),
    jira: jira ?? createJiraClient({ config }),
  }
}

// Each dispatch retains the routers and clients from one immutable snapshot,
// including work that continues after Slack has acknowledged a request.
export function createRuntime({ config, repository, ...overrides }) {
  const services = createServices({ config, repository, ...overrides })
  const features = {
    slack: Boolean(config.slackBotToken && config.slackSigningSecret && config.slackTeamId),
    jira: services.jira.enabled,
  }
  return Object.freeze({
    services,
    api: createApiRouter(repository, createIdentityMiddleware(config), services, features),
    slack: createSlackRouter(config, repository, services),
  })
}

export function createApp({ config, repository, settings, ...overrides }) {
  const getRuntime = settings?.getRuntime ?? (() => runtime)
  const runtime = settings ? null : createRuntime({ config, repository, ...overrides })
  const app = express()
  app.disable("x-powered-by")
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: config.webOrigin }))
  app.use("/slack", (req, res, next) => getRuntime().slack(req, res, next))
  app.use("/api/settings", createSettingsRouter(config, settings))
  app.use(express.json({ limit: "1mb" }))
  app.use("/api", (req, res, next) => getRuntime().api(req, res, next))

  app.get("/health", (_req, res) => res.json({ status: "ok" }))
  return app
}

// This is the only listener that the local Slack tunnel should expose.
// Never mount the synthetic-identity API on this application.
export function createSlackApp({ config, repository, settings, ...overrides }) {
  const runtime = settings ? null : createRuntime({ config, repository, ...overrides })
  const getRuntime = settings?.getRuntime ?? (() => runtime)
  const app = express()
  app.disable("x-powered-by")
  app.use(helmet())
  app.use("/slack", (req, res, next) => getRuntime().slack(req, res, next))
  app.use((_req, res) => res.status(404).json({ error: "Not found." }))
  return app
}
