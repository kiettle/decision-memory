import express from "express"
import { DomainError } from "./domain.js"

export function createSettingsRouter(config, settings) {
  const router = express.Router()
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store")
    if (!settings || config.nodeEnv !== "development" || !config.localDemoMode) {
      res.status(404).json({ error: "Settings are only available in the local app." })
      return
    }
    next()
  })
  router.use(express.json({ limit: "32kb" }))
  router.get("/integrations", (_req, res) => res.json(settings.read()))
  router.put("/integrations/:provider", async (req, res) => {
    if (req.get("origin") !== config.webOrigin || !req.is("application/json")) {
      res.status(403).json({ error: "Open Settings in the local app to make changes." })
      return
    }
    try {
      res.json(await settings.save(req.params.provider, req.body))
    } catch (error) {
      if (error instanceof DomainError) {
        res.status(error.status).json({ error: error.message, code: error.code })
        return
      }
      console.error("Integration settings save failed", { code: "SETTINGS_SAVE_FAILED" })
      res.status(500).json({ error: "Settings could not be saved. Your previous settings remain active." })
    }
  })
  // Body parser errors must not echo or log partially entered credentials.
  router.use((error, _req, res, _next) => {
    void _next
    const status = error.type === "entity.too.large" ? 413 : error.type === "entity.parse.failed" ? 400 : 500
    res.status(status).json({ error: status === 500 ? "Settings could not be read." : "Enter a valid settings request." })
  })
  return router
}
