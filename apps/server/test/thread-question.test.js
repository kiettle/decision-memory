import assert from "node:assert/strict"
import { it } from "node:test"
import { createThreadQuestionSummarizer } from "../src/thread-question.js"

const messages = [
  { timestamp: "1", text: "How is migration going?" },
  { timestamp: "2", text: "It is going well." },
  { timestamp: "3", text: "Why did we choose PostgreSQL?", anchor: true },
]
const reply = (query = "Why did we choose PostgreSQL for migration?", messageIds = ["1", "3"]) => ({ text: JSON.stringify({ query, messageIds }) })

it("thread summarization is disabled without a configured model credential or injected provider", async () => {
  const service = createThreadQuestionSummarizer({ config: {} })
  assert.equal(service.enabled, false)
  assert.equal(await service.summarize(messages), null)
})

it("rewrites a question from a bounded root-and-anchor excerpt without author identifiers", async () => {
  let request
  const service = createThreadQuestionSummarizer({ config: { geminiModel: "configured-model" }, generateContent: async (input) => { request = input; return reply("Why PostgreSQL for migration?", ["0", "99"]) } })
  const long = Array.from({ length: 100 }, (_, i) => ({ timestamp: String(i), text: "x".repeat(2000), author: "Private author", anchor: i === 99 }))
  assert.equal(await service.summarize(long), "Why PostgreSQL for migration?")
  const sent = JSON.parse(request.contents.split("\nMessages: ")[1])
  assert.equal(sent.length, 60)
  assert.equal(sent[0].id, "0", "Keep the thread topic even when the selected reply is late")
  assert.equal(sent.find((message) => message.selected).id, "99")
  assert.ok(sent.every((message) => message.text.length <= 1500 && !Object.hasOwn(message, "author")))
  assert.equal(request.model, "configured-model")
  assert.equal(request.config.httpOptions.retryOptions.attempts, 1)
  assert.match(request.contents, /untrusted data/)
})

it("rejects invalid output, missing or invented source IDs, and insufficient context", async () => {
  for (const response of [
    { text: "not JSON" }, reply("Why PostgreSQL?", ["1", "invented"]),
    reply("Why PostgreSQL?", ["1"]), reply("", []), reply("x".repeat(501)),
    { ...reply(), promptFeedback: { blockReason: "SAFETY" } },
  ]) {
    const service = createThreadQuestionSummarizer({ config: {}, generateContent: async () => response })
    assert.equal(await service.summarize(messages), null)
  }
})

it("provider failure and a bounded timeout preserve the local fallback", async () => {
  const failed = createThreadQuestionSummarizer({ config: {}, generateContent: async () => { throw new Error("Private provider failure") } })
  assert.equal(await failed.summarize(messages), null)
  let signal
  const stalled = createThreadQuestionSummarizer({ config: {}, timeoutMs: 5, generateContent: async (request) => { signal = request.config.abortSignal; return new Promise(() => {}) } })
  assert.equal(await stalled.summarize(messages), null)
  assert.equal(signal.aborted, true)
})
