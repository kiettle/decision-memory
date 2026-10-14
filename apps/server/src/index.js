import { createApp, createServices, createSlackApp } from "./app.js"
import { config } from "./config.js"
import { createDatabase } from "./models.js"
import { createRepository } from "./repository.js"
import { createSearchIndexer } from "./search-indexer.js"

const models = createDatabase(config.databaseUrl, false)
await models.sequelize.authenticate()

const repository = createRepository(models)
const services = createServices({ config, repository })
await repository.queueUnindexedDecisions(services.memorySearch.embedder.model)
const indexer = createSearchIndexer({ repository, embedder: services.memorySearch.embedder })
indexer.start()
const app = createApp({ config, repository, ...services })
const server = app.listen(config.port, "127.0.0.1", () => {
  console.log(`Decision Memory API listening on http://localhost:${config.port}`)
})

const slackServer = createSlackApp({ config, repository, ...services }).listen(config.slackPort, "127.0.0.1", () => {
  console.log(`Slack-only ingress listening on http://localhost:${config.slackPort}`)
})
slackServer.on("error", (error) => {
  console.error("Slack ingress failed to start", error.message)
  server.close()
  void models.sequelize.close().finally(() => { process.exitCode = 1 })
})

server.on("error", (error) => {
  console.error("Decision Memory API failed to start", error.message)
  process.exitCode = 1
})

async function shutdown() {
  await indexer.stop()
  await services.memorySearch.embedder.dispose()
  slackServer.close()
  server.close(async () => {
    await models.sequelize.close()
    process.exit(0)
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
