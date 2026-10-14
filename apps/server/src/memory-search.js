import { DomainError } from "./domain.js"
import { createLocalEmbedder } from "./local-embeddings.js"

// E5 scores cluster high even for unrelated text. This retrieval cutoff is not
// a probability. scripts/verify-local-search.mjs exercises the real model.
export const MIN_SIMILARITY = 0.82

export function createMemorySearchService({ repository, embedder = createLocalEmbedder() }) {
  async function search(identity, { query, filters = {} }) {
    try {
      const vector = await embedder.embed(query, "query")
      const result = await repository.vectorSearch(identity, {
        vector, model: embedder.model, filters,
      })
      return {
        ...result,
        matches: result.matches
          .filter(({ similarity }) => similarity >= MIN_SIMILARITY)
          .slice(0, 5)
          .map(({ similarity, decision }) => ({
            decisionId: decision.id,
            // Keep Slack's conservative 60/75 bars on a 0–100 relevance scale.
            score: Math.round(Math.max(0, Math.min(1, (similarity - 0.7) / 0.2)) * 100),
            similarity,
            explanation: `Similar meaning in stored decision: “${decision.title.slice(0, 400)}”.`,
            matchedConcepts: [],
            decision,
          })),
      }
    } catch {
      throw new DomainError(
        "Local memory search is unavailable. Run npm run setup:local. Normal keyword search is still available.",
        503,
        "MEMORY_SEARCH_UNAVAILABLE",
      )
    }
  }

  return { enabled: true, search, embedder }
}
