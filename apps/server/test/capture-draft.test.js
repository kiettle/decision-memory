import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createCaptureDrafter } from "../src/capture-draft.js"

const thread = [
  { author: "Alex", timestamp: "1.0", text: "Should migration backups stay in PostgreSQL or GCS?", anchor: false },
  { author: "Maya", timestamp: "2.0", text: "Let's use GCS. The files can become very large.", anchor: true },
  { author: "Kiet", timestamp: "3.0", text: "Agreed.", anchor: false },
]

const reply = (overrides = {}) => ({
  text: JSON.stringify({
    outcome: "DECISION",
    decision: "  Use GCS for migration backup files  ",
    why: "Backups can reach tens of GB.",
    context: "The team compared PostgreSQL and GCS.",
    appliesTo: ["Migration Service", " "],
    optionsConsidered: ["PostgreSQL", "GCS"],
    proposalMessageId: "2.0",
    followUpMessageId: "",
    tags: ["Migration", " storage ", ""],
    otherPossibleDecisions: [],
    relevantMessageIds: ["2.0", "3.0", "invented-id"],
    confidence: "high",
    ...overrides,
  }),
})

function drafterReturning(response, options = {}) {
  const requests = []
  const drafter = createCaptureDrafter({
    config: { geminiModel: "test-model" },
    retryDelayMs: 0,
    generateContent: async (request) => {
      requests.push(request)
      if (response instanceof Error) throw response
      return response
    },
    ...options,
  })
  return { drafter, requests }
}

describe("AI capture draft", () => {
  it("drafts the Decision fields and keeps only message ids from the thread", async () => {
    const { drafter, requests } = drafterReturning(reply())
    const draft = await drafter.draft(thread)
    assert.equal(draft.outcome, "DECISION")
    assert.equal(draft.decision, "Use GCS for migration backup files")
    assert.deepEqual(draft.appliesTo, ["Migration Service"])
    assert.deepEqual(draft.optionsConsidered, ["PostgreSQL", "GCS"])
    assert.deepEqual(draft.relevantMessageIds, ["2.0", "3.0"])
    assert.deepEqual(draft.tags, ["migration", "storage"])
    assert.match(requests[0].contents, /"selected":true/)
    assert.match(requests[0].contents, /same language as the messages/)
    assert.match(requests[0].contents, /not necessarily the last message or the first proposal/)
    assert.match(requests[0].contents, /Never combine separate decisions/)
  })

  it("never invents a Decision when the thread has no clear agreement", async () => {
    const noClear = await drafterReturning(reply({ outcome: "NO_CLEAR_DECISION", decision: "Maybe GCS" })).drafter.draft(thread)
    assert.equal(noClear.outcome, "NO_CLEAR_DECISION")
    assert.equal(noClear.decision, "")
    const blank = await drafterReturning(reply({ decision: "   " })).drafter.draft(thread)
    assert.equal(blank.outcome, "NO_CLEAR_DECISION")
  })

  it("falls back to the plain form on invalid output, errors, and timeouts", async (t) => {
    t.mock.method(console, "warn", () => {})
    assert.equal(await drafterReturning({ text: "not json" }).drafter.draft(thread), null)
    assert.equal(await drafterReturning(reply({ confidence: "certain" })).drafter.draft(thread), null)
    assert.equal(await drafterReturning(new Error("429")).drafter.draft(thread), null)
    const stalled = createCaptureDrafter({
      config: { geminiModel: "test-model" },
      generateContent: () => new Promise(() => {}),
      timeoutMs: 5,
      retryDelayMs: 0,
    })
    assert.equal(await stalled.draft(thread), null)
  })

  it("does nothing without a Gemini key or captured messages", async () => {
    const disabled = createCaptureDrafter({ config: {} })
    assert.equal(disabled.enabled, false)
    assert.equal(await disabled.draft(thread), null)
    assert.equal(await drafterReturning(reply()).drafter.draft([]), null)
  })

  it("sends a bounded window around the selected message for long threads", async () => {
    const long = Array.from({ length: 100 }, (_, index) => ({
      author: "A",
      timestamp: String(index),
      text: "x".repeat(5_000),
      anchor: index === 90,
    }))
    const { drafter, requests } = drafterReturning(reply({ relevantMessageIds: ["90", "5"] }))
    const draft = await drafter.draft(long)
    const sent = JSON.parse(requests[0].contents.split("Messages:\n")[1])
    assert.equal(sent.length, 60)
    assert.ok(sent.some((message) => message.id === "90" && message.selected))
    assert.ok(sent.every((message) => message.text.length <= 1_500))
    assert.deepEqual(draft.relevantMessageIds, ["90"])
  })
})

describe("AI capture retry policy", () => {
  const providerError = (status, details = [], message = "private-provider-text") =>
    Object.assign(new Error(JSON.stringify({ error: { code: status, message, details } })), { status })

  function sequence(t, responses, options = {}) {
    const requests = []
    const logs = []
    t.mock.method(console, "warn", (...args) => logs.push(args))
    const drafter = createCaptureDrafter({
      config: { geminiModel: "test-model" }, retryDelayMs: 0,
      generateContent: async (request) => {
        requests.push(request)
        const response = responses[Math.min(requests.length - 1, responses.length - 1)]
        if (response instanceof Error) throw response
        return typeof response === "function" ? response(request) : response
      },
      ...options,
    })
    return { drafter, requests, logs }
  }

  it("recovers once from transient provider, network, and malformed-output failures", async (t) => {
    for (const failure of [providerError(503), providerError(500), providerError(429),
      new TypeError("fetch failed"), Object.assign(new Error("private-network-text"), { cause: { code: "ECONNRESET" } }),
      { text: "private invalid json" }, null, reply({ confidence: "invalid" })]) {
      const { drafter, requests, logs } = sequence(t, [failure, reply()])
      assert.equal((await drafter.draft(thread)).decision, "Use GCS for migration backup files")
      assert.equal(requests.length, 2)
      assert.equal(requests[0].config.httpOptions.retryOptions.attempts, 1)
      assert.equal(logs[0][1].retry, true)
      assert.ok(logs[0][1].durationMs >= 0)
      assert.doesNotMatch(JSON.stringify(logs), /private|PostgreSQL|GCS/)
    }
  })

  it("stops after two failures and logs only safe diagnostics", async (t) => {
    const { drafter, requests, logs } = sequence(t, [providerError(503)])
    assert.equal(await drafter.draft(thread), null)
    assert.equal(requests.length, 2)
    assert.deepEqual(logs.map((log) => [log[1].category, log[1].retry]), [["overloaded", true], ["overloaded", false]])
    assert.doesNotMatch(JSON.stringify(logs), /private-provider-text/)
  })

  it("does not retry credentials, invalid requests, or known exhausted quotas", async (t) => {
    for (const failure of [providerError(400), providerError(401), providerError(403),
      providerError(429, [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProject" }] }]),
      providerError(429, [{ violations: [{ quotaValue: "0" }] }]),
      providerError(429, [], "Quota exceeded, limit: 0")]) {
      const { drafter, requests, logs } = sequence(t, [failure, reply()])
      assert.equal(await drafter.draft(thread), null)
      assert.equal(requests.length, 1)
      assert.equal(logs[0][1].retry, false)
    }
  })

  it("does not retry a valid no-decision answer or a provider safety block", async (t) => {
    const noDecision = sequence(t, [reply({ outcome: "NO_CLEAR_DECISION", decision: "" })])
    assert.equal((await noDecision.drafter.draft(thread)).outcome, "NO_CLEAR_DECISION")
    assert.equal(noDecision.requests.length, 1)
    assert.equal(noDecision.logs.length, 0)
    const blocked = sequence(t, [{ promptFeedback: { blockReason: "SAFETY" } }])
    assert.equal(await blocked.drafter.draft(thread), null)
    assert.equal(blocked.requests.length, 1)
    assert.equal(blocked.logs[0][1].category, "blocked")
  })

  it("aborts a timed-out attempt and gives the retry a fresh signal", async (t) => {
    const { drafter, requests, logs } = sequence(t, [() => new Promise(() => {}), reply()], { timeoutMs: 5 })
    assert.equal((await drafter.draft(thread)).outcome, "DECISION")
    assert.equal(requests.length, 2)
    assert.equal(requests[0].config.abortSignal.aborted, true)
    assert.equal(requests[1].config.abortSignal.aborted, false)
    assert.equal(logs[0][1].category, "timeout")
  })

  it("caps a hanging request by the total budget even when its attempt timeout is longer", async (t) => {
    const { drafter, requests } = sequence(t, [() => new Promise(() => {})], { timeoutMs: 10_000, totalTimeoutMs: 20 })
    const started = Date.now()
    assert.equal(await drafter.draft(thread), null)
    assert.ok(Date.now() - started < 500, "The total budget must cut off the 10-second attempt")
    assert.ok(requests.every((request) => request.config.abortSignal.aborted))
  })

  it("honors provider retry delays and skips retries that would exceed the budget", async (t) => {
    const retryInfo = (retryDelay) => [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }]
    const retry = sequence(t, [providerError(429, retryInfo("0.02s")), reply()])
    const started = Date.now()
    assert.equal((await retry.drafter.draft(thread)).outcome, "DECISION")
    assert.ok(Date.now() - started >= 19)
    const tooLong = sequence(t, [providerError(429, retryInfo("30s")), reply()])
    assert.equal(await tooLong.drafter.draft(thread), null)
    assert.equal(tooLong.requests.length, 1)
    assert.equal(tooLong.logs[0][1].retry, false)
  })
})

describe("AI capture draft owner and language", () => {
  it("takes the owner from the follow-up author, else the proposer, never an invented name", async () => {
    const proposer = await drafterReturning(reply()).drafter.draft(thread)
    assert.equal(proposer.owner, "Maya")
    const followUp = await drafterReturning(reply({ followUpMessageId: "3.0" })).drafter.draft(thread)
    assert.equal(followUp.owner, "Kiet")
    const unknown = await drafterReturning(reply({ proposalMessageId: "99", followUpMessageId: "" })).drafter.draft(thread)
    assert.equal(unknown.owner, "")
    const noDecision = await drafterReturning(reply({ outcome: "NO_CLEAR_DECISION" })).drafter.draft(thread)
    assert.equal(noDecision.owner, "")
  })

  it("does not draft a Team, which is deferred in favour of the Slack channel", async () => {
    const draft = await drafterReturning(reply()).drafter.draft(thread)
    assert.equal("team" in draft, false)
  })

  it("asks for a Vietnamese draft when the thread is Vietnamese", async () => {
    const { drafter, requests } = drafterReturning(reply())
    await drafter.draft([{ author: "Lan", timestamp: "1", text: "Để GCS đi, file rất lớn.", anchor: true }])
    assert.match(requests[0].contents, /Write every text field in Vietnamese/)
  })
})
