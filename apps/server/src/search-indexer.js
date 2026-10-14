import { setTimeout as delay } from "node:timers/promises"

export function createSearchIndexer({ repository, embedder, onError = console.error }) {
  let controller
  let running

  async function drain({ signal, onProgress = () => {} } = {}) {
    let indexed = 0
    while (!signal?.aborted) {
      const jobs = await repository.pendingSearchJobs(5)
      if (!jobs.length) break
      for (const job of jobs) {
        if (signal?.aborted) return indexed
        const vectors = []
        for (const passage of await embedder.passages(job.decision)) {
          if (signal?.aborted) return indexed
          vectors.push(await embedder.embed(passage, "passage"))
        }
        if (await repository.completeSearchJob(job, vectors, embedder.model)) {
          indexed++
          onProgress(indexed)
        }
      }
    }
    return indexed
  }

  function start() {
    if (running) return
    controller = new globalThis.AbortController()
    const { signal } = controller
    running = (async () => {
      while (!signal.aborted) {
        try {
          await drain({ signal })
        } catch {
          onError("Local search indexing paused. Run npm run setup:local if the model is missing; retrying.")
        }
        await delay(2_000, undefined, { signal }).catch(() => {})
      }
    })()
  }

  async function stop() {
    controller?.abort()
    await running
    running = null
  }

  return { drain, start, stop }
}
