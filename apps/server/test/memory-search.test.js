import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { DomainError } from "../src/domain.js"
import { createMemorySearchService } from "../src/memory-search.js"

const decisions = [
  {
    id: "33333333-3333-4333-8333-333333333301",
    decisionKey: "DM-104",
    title: "Use object storage for migration backup files",
    why: "Durable rollback without database load.",
    context: "Large migration exports were timing out.",
    appliesTo: ["Atlas migration"],
    optionsConsidered: ["Database host"],
    team: "Platform",
    ownerName: "Maya Chen",
    status: "ACTIVE",
    tags: ["migration", "storage"],
    sources: [
      {
        messages: [
          {
            author: "Maya Chen",
            text: "Keep rollback files away from the database host.",
            anchor: true,
          },
        ],
      },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333302",
    decisionKey: "DM-103",
    title: "Keep billing orchestration in the existing service",
    why: "Avoid migration risk.",
    context: "Payments reliability work.",
    appliesTo: ["Billing"],
    optionsConsidered: [],
    team: "Payments",
    status: "SUPERSEDED",
    tags: ["payments"],
    sources: [],
  },
]

const repository = {
  memorySearchCandidates: async () => decisions,
}

function serviceWith(response, options = {}) {
  return createMemorySearchService({
    config: { geminiModel: "test-model" },
    repository,
    generateContent: async () => response,
    ...options,
  })
}

describe("AI-assisted memory search", () => {
  it("parses vague cross-language matches and rejects unknown IDs", async () => {
    const service = serviceWith({
      text: JSON.stringify({
        matches: [
          {
            decisionId: decisions[0].id,
            score: 94,
            explanation: "Khớp với quyết định lưu file rollback lớn ngoài database.",
            matchedConcepts: ["rollback", "large files", "object storage"],
          },
          {
            decisionId: "99999999-9999-4999-8999-999999999999",
            score: 99,
            explanation: "Invented",
            matchedConcepts: [],
          },
        ],
      }),
    })
    const result = await service.search({}, {
      query: "Hồi trước mình xử lý file migration lớn hay timeout như thế nào?",
    })
    assert.equal(result.candidateCount, 2)
    assert.equal(result.matches.length, 1)
    assert.equal(result.matches[0].decision.id, decisions[0].id)
  })

  it("accepts a valid no-match result", async () => {
    const result = await serviceWith({ text: '{"matches":[]}' }).search({}, {
      query: "unrelated memory",
    })
    assert.deepEqual(result.matches, [])
  })

  it("rejects malformed structured output", async () => {
    await assert.rejects(
      serviceWith({ text: "not json" }).search({}, { query: "migration memory" }),
      (error) =>
        error instanceof DomainError && error.code === "MEMORY_SEARCH_INVALID_RESPONSE",
    )
  })

  it("maps rate limits to a retryable domain error", async () => {
    const service = createMemorySearchService({
      config: { geminiModel: "test-model" },
      repository,
      generateContent: async () => {
        const error = new Error("rate limited")
        error.status = 429
        throw error
      },
    })
    await assert.rejects(
      service.search({}, { query: "migration memory" }),
      (error) => error instanceof DomainError && error.code === "MEMORY_SEARCH_RATE_LIMITED",
    )
  })

  it("times out without affecting normal search", async () => {
    const service = createMemorySearchService({
      config: { geminiModel: "test-model" },
      repository,
      generateContent: async () => new Promise(() => {}),
      timeoutMs: 5,
    })
    await assert.rejects(
      service.search({}, { query: "migration memory" }),
      (error) => error instanceof DomainError && error.code === "MEMORY_SEARCH_TIMEOUT",
    )
  })
})

describe("AI-assisted memory search output", () => {
  it("shortens verbose output instead of rejecting it and omits snapshots", async () => {
    const result = await serviceWith({
      text: JSON.stringify({
        matches: [
          {
            decisionId: decisions[0].id,
            score: 90,
            explanation: "x".repeat(900),
            matchedConcepts: ["a", "b", "c", "d", "e", "f", "y".repeat(300)],
          },
        ],
      }),
    }).search({}, { query: "migration memory" })
    assert.equal(result.matches[0].explanation.length, 500)
    assert.equal(result.matches[0].matchedConcepts.length, 5)
    assert.equal(result.matches[0].decision.sources, undefined)
    assert.equal(decisions[0].sources.length, 1)
  })
})

it("returns each grounded Decision only once", async () => {
  const match = { decisionId: decisions[0].id, score: 90, explanation: "Stored evidence", matchedConcepts: [] }
  const result = await serviceWith({ text: JSON.stringify({ matches: [match, match, match] }) }).search({}, { query: "migration" })
  assert.equal(result.matches.length, 1)
})
