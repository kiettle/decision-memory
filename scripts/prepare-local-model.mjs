import { mkdir } from "node:fs/promises"

import { createLocalEmbedder, MODEL_DIRECTORY } from "../apps/server/src/local-embeddings.js"

await mkdir(MODEL_DIRECTORY, { recursive: true })
console.log("Preparing the local multilingual embedding model (first run downloads public weights)…")
const embedder = createLocalEmbedder({ allowDownload: true })
await embedder.embed("Local search setup", "query")
await embedder.dispose()
console.log("Local model cached and CPU inference verified. No API key needed.")
