import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createGeminiMemorySearchService } from "../src/gemini-memory-search.js"

const identity = { workspaceExternalKey: "owned-workspace" }
const decisions = Array.from({ length: 200 }, (_, i) => ({ id: `stored-${i}`, title: `Decision ${i}`,
  why: "w".repeat(2000), context: "c".repeat(2000), appliesTo: ["Migration"], tags: ["storage"],
  sources: [{ id: "source", provider: "SLACK", channelName: "migration", messages: [{ author: "Maya", text: "Durable rollback", anchor: true }] }] }))
const reply = (matches) => ({ text: JSON.stringify({ matches }) })
const match = (id, score = 90) => ({ decisionId: id, score, explanation: " Durable rollback ", matchedConcepts: [" storage "] })
function service(overrides = {}) {
  return createGeminiMemorySearchService({ config: { geminiModel: "fixture-model" },
    repository: { memorySearchCandidates: async () => decisions, memorySearchCandidateCount: async () => 245 },
    generateContent: async () => reply([match(decisions[0].id)]), ...overrides })
}

describe("Optional Gemini memory search", () => {
  it("passes identity and every filter before the cap, bounds excerpts, and discloses coverage", async () => {
    const filters = { channel: "migration", ownerId: "name:Maya", tag: "storage", status: "ACTIVE", appliesTo: "Migration", dateRange: "30" }
    const seen = []
    const ai = service({ repository: {
      memorySearchCandidates: async (...args) => { seen.push(args); return decisions },
      memorySearchCandidateCount: async (...args) => { seen.push(args); return 245 },
    }, generateContent: async (request) => {
      assert.equal(request.model, "fixture-model")
      assert.match(request.contents, /untrusted data/)
      assert.match(request.contents, /Hồi trước/)
      const cards = JSON.parse(request.contents.split("Candidate Decisions:\n")[1])
      assert.equal(cards.length, 200)
      assert.equal(cards[0].why.length, 1200)
      assert.equal(cards[0].context.length, 1200)
      assert.match(cards[0].capturedDiscussionExcerpt, /Durable rollback/)
      return reply([match(decisions[0].id)])
    } })
    const result = await ai.search(identity, { query: "Hồi trước xử lý migration?", filters })
    assert.deepEqual(seen, [[identity, filters, { limit: 200 }], [identity, filters]])
    assert.equal(result.method, "GEMINI")
    assert.equal(result.candidateCount, 200)
    assert.equal(result.totalCandidateCount, 245)
    assert.equal(result.truncated, true)
    assert.equal(result.matches[0].decision.title, decisions[0].title)
    assert.deepEqual(result.matches[0].decision.sources, [{ id: "source", provider: "SLACK", channelName: "migration" }])
    assert.equal(result.matches[0].explanation, "Durable rollback")
  })

  it("rejects invented, foreign, excluded and duplicate IDs while sorting stored matches", async () => {
    const result = await service({ generateContent: async () => reply([
      match("foreign"), match("stored-200"), match("stored-1", 60), match("stored-1", 99), match("stored-0", 95),
    ]) }).search(identity, { query: "migration" })
    assert.deepEqual(result.matches.map(m => m.decisionId), ["stored-0", "stored-1"])
  })

  it("skips the provider when filters match no decisions", async () => {
    const result = await service({ repository: { memorySearchCandidates: async () => [], memorySearchCandidateCount: async () => 0 },
      generateContent: () => assert.fail("Empty candidates must not call Gemini") }).search(identity, { query: "migration" })
    assert.deepEqual(result, { method: "GEMINI", candidateCount: 0, totalCandidateCount: 0, truncated: false, matches: [] })
  })

  it("is unavailable without a key and never silently chooses local or external search", async () => {
    const ai = createGeminiMemorySearchService({ config: {}, repository: {} })
    assert.equal(ai.enabled, false)
    await assert.rejects(ai.search(identity, { query: "migration" }), e => e.code === "MEMORY_SEARCH_UNAVAILABLE" && /GEMINI_API_KEY/.test(e.message))
  })

  it("reports timeout, rate limit, provider failure and invalid output with fallback advice", async () => {
    for (const [generateContent, code] of [
      [() => new Promise(() => {}), "MEMORY_SEARCH_TIMEOUT"],
      [async () => { throw { status: 429 } }, "MEMORY_SEARCH_RATE_LIMITED"],
      [async () => { throw new Error("private upstream error") }, "MEMORY_SEARCH_UNAVAILABLE"],
      [async () => ({ text: "bad json" }), "MEMORY_SEARCH_INVALID_RESPONSE"],
      [async () => reply([match("stored-1", 101)]), "MEMORY_SEARCH_INVALID_RESPONSE"],
    ]) await assert.rejects(service({ generateContent, timeoutMs: 5 }).search(identity, { query: "migration" }),
      e => e.code === code && /Local and normal search/.test(e.message) && !/private upstream/.test(e.message))
  })
})
