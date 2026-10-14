import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { DomainError } from "../src/domain.js"
import { decisionPassages, EMBEDDING_DIMENSIONS, vectorLiteral } from "../src/local-embeddings.js"
import { createMemorySearchService } from "../src/memory-search.js"
import { createSearchIndexer } from "../src/search-indexer.js"

const vector = [1, ...Array(EMBEDDING_DIMENSIONS - 1).fill(0)]
const decision = { id: "stored-id", title: "Use object storage for migration backup files", sources: [{ id: "source", channelName: "migration" }] }
const embedder = { model: "local-test-model", embed: async () => vector, passages: async () => [[1, 2]] }
const characterTokenizer = {
  encode: (text, { add_special_tokens }) => ({
    ids: [...(add_special_tokens ? [0] : []), ...Array.from(text, (character) => character.codePointAt(0) + 3), ...(add_special_tokens ? [2] : [])],
  }),
  decode: (ids) => ids.filter((id) => id > 2).map((id) => String.fromCodePoint(id - 3)).join(""),
}
const result = {
  candidateCount: 250, totalCandidateCount: 251, truncated: true,
  matches: [{ decision, similarity: 0.94 }, { decision: { ...decision, id: "weak" }, similarity: 0.72 }],
}

function service(overrides = {}) {
  return createMemorySearchService({ repository: { vectorSearch: async () => result }, embedder, ...overrides })
}

describe("Local memory search", () => {
  it("works without Gemini and passes identity, filters and query embedding to retrieval", async () => {
    const identity = { workspaceExternalKey: "my-workspace" }
    const filters = { status: "ACTIVE", tag: "storage" }
    const seen = []
    const search = service({
      embedder: { ...embedder, embed: async (...args) => { seen.push(args); return vector } },
      repository: { vectorSearch: async (user, input) => {
        assert.equal(user, identity)
        assert.deepEqual(input, { vector, model: embedder.model, filters })
        return result
      } },
    })
    assert.equal(search.enabled, true)
    const response = await search.search(identity, { query: "Hồi trước xử lý file lớn sao?", filters })
    assert.deepEqual(seen, [["Hồi trước xử lý file lớn sao?", "query"]])
    assert.equal(response.candidateCount, 250)
    assert.equal(response.totalCandidateCount, 251)
    assert.equal(response.truncated, true)
    assert.equal(response.matches.length, 1)
    assert.equal(response.matches[0].decisionId, decision.id)
    assert.equal(response.matches[0].score, 100)
    assert.match(response.matches[0].explanation, /Use object storage/)
  })

  it("returns no matches for unrelated vectors", async () => {
    const response = await service({ repository: { vectorSearch: async () => ({ ...result, matches: result.matches.slice(1) }) } })
      .search({}, { query: "unrelated" })
    assert.deepEqual(response.matches, [])
  })

  it("offers setup and keyword fallback when the local model or database fails", async () => {
    for (const overrides of [
      { embedder: { embed: async () => { throw new Error("missing cache") } } },
      { repository: { vectorSearch: async () => { throw new Error("database unavailable") } } },
    ]) {
      await assert.rejects(service(overrides).search({}, { query: "migration" }), (error) => {
        assert.ok(error instanceof DomainError)
        assert.equal(error.code, "MEMORY_SEARCH_UNAVAILABLE")
        assert.match(error.message, /npm run setup:local/)
        assert.match(error.message, /keyword search is still available/)
        return true
      })
    }
  })
})

it("rejects malformed, nonfinite and zero embeddings before SQL", () => {
  for (const bad of [[1], Array(384).fill(0), [NaN, ...vector.slice(1)], [Infinity, ...vector.slice(1)]]) {
    assert.throws(() => vectorLiteral(bad), /384-dimensional/)
  }
  assert.match(vectorLiteral(vector), /^\[1,0,/)
})

it("indexes source evidence past the first model window with overlapping passages", () => {
  const passages = decisionPassages({ ...decision, context: "a".repeat(2500), sources: [{ messages: [{ author: "Maya", text: "LATE DISCUSSION EVIDENCE" }] }] }, characterTokenizer)
  assert.ok(passages.length > 3)
  assert.ok(passages.some((passage) => characterTokenizer.decode(passage).includes("LATE DISCUSSION EVIDENCE")))
  assert.ok(passages.every((passage) => passage.length <= 512))
})

it("retains dense content and a long title while reserving all input framing", () => {
  const title = "t".repeat(480) + "TITLE END"
  const marker = "EVIDENCE IN OLD GAP"
  const passages = decisionPassages({ title, context: "a".repeat(600) + marker + "b".repeat(1200) }, characterTokenizer)
  const text = passages.map(characterTokenizer.decode)
  assert.ok(passages.every((input) => input.length <= 512))
  assert.ok(text.some((input) => input.includes("TITLE END")), "The full title must remain indexed independently of its header budget")
  assert.ok(text.some((input) => input.includes(marker)), "Content must not fall between clipped windows")
  const empty = decisionPassages({}, characterTokenizer)
  assert.ok(empty.length === 1 && empty[0].length <= 512)
})

it("covers every source and title token without gaps, independently of text density", () => {
  const title = Array.from({ length: 500 }, (_, index) => String.fromCodePoint(0x4000 + index)).join("")
  const context = Array.from({ length: 2000 }, (_, index) => String.fromCodePoint(0x1000 + index)).join("")
  const passages = decisionPassages({ title, context }, characterTokenizer)
  const covered = new Set(passages.flat())
  const required = characterTokenizer.encode(title + context, { add_special_tokens: false }).ids
  assert.ok(required.every((token) => covered.has(token)), "Every distinct original token must occur in at least one complete input window")
  assert.ok(passages.every((input) => input.length <= 512))
})

it("keeps failed indexing work retryable and indexes successfully on a later drain", async () => {
  let pending = [{ decisionId: decision.id, revision: "r1", decision }]
  let fail = true
  const repository = {
    pendingSearchJobs: async () => pending,
    completeSearchJob: async (_job, vectors, model) => {
      assert.equal(model, embedder.model)
      assert.ok(vectors.length >= 1)
      assert.ok(vectors.every((value) => JSON.stringify(value) === JSON.stringify(vector)))
      pending = []
      return true
    },
  }
  const indexer = createSearchIndexer({ repository, embedder: { ...embedder, embed: async () => {
    if (fail) throw new Error("interrupted inference")
    return vector
  } } })
  await assert.rejects(indexer.drain(), /interrupted/)
  assert.equal(pending.length, 1)
  fail = false
  assert.equal(await indexer.drain(), 1)
  assert.equal(pending.length, 0)
})
