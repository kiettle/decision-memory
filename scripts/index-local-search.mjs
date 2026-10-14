import { config } from "../apps/server/src/config.js"
import { createLocalEmbedder } from "../apps/server/src/local-embeddings.js"
import { createDatabase } from "../apps/server/src/models.js"
import { createRepository } from "../apps/server/src/repository.js"
import { createSearchIndexer } from "../apps/server/src/search-indexer.js"

const models = createDatabase(config.databaseUrl, false)
const embedder = createLocalEmbedder()
try {
  await models.sequelize.authenticate()
  const repository = createRepository(models)
  await embedder.prepare()
  await repository.queueUnindexedDecisions(embedder.model)
  const indexer = createSearchIndexer({ repository, embedder })
  const count = await indexer.drain({ onProgress: (count) => console.log(`Indexed ${count} decisions locally…`) })
  console.log(`Local search ready. Indexed ${count} new or changed decisions.`)
} finally {
  await embedder.dispose()
  await models.sequelize.close()
}
