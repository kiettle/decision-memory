import assert from "node:assert/strict"
import { it } from "node:test"
import { answerContext } from "../src/answer-context.js"
import { decisionInput } from "../src/validation.js"

it("answer context follows recorded replacement chains while preserving foreign-scope uncertainty and missing rationale", async () => {
  const old = { id: "old", status: "SUPERSEDED", appliesTo: ["Atlas"], lifecycle: { current: [{ id: "current" }] } }
  const current = { id: "current", status: "ACTIVE", appliesTo: ["Billing"], why: null }
  const calls = []
  const repository = { getDecision: async (identity, id) => { calls.push(identity); return { old, current }[id] ?? null } }
  const identity = { workspaceExternalKey: "synthetic" }
  const result = await answerContext(repository, identity, ["old", "foreign"], "Atlas")
  assert.deepEqual(result.decisions, [old, current])
  assert.equal(result.decisions[1].why, null)
  assert.equal(result.scope, "Atlas")
  assert.ok(calls.every(value => value === identity))
})

it("pasted source preserves exact excerpt and bounds origin and content without increasing required capture fields", () => {
  const excerpt = "  Agreed: keep the files.\nReason: recovery.\n"
  const value = decisionInput.parse({ title: "Keep files", pastedSource: { excerpt, origin: "  Synthetic notes  " } })
  assert.equal(value.pastedSource.excerpt, excerpt)
  assert.equal(value.pastedSource.origin, "Synthetic notes")
  assert.equal(decisionInput.safeParse({ title: "Keep files" }).success, true)
  assert.equal(decisionInput.safeParse({ title: "Keep files", pastedSource: { excerpt, origin: "" } }).success, false)
  assert.equal(decisionInput.safeParse({ title: "Keep files", pastedSource: { excerpt: "x".repeat(20001), origin: "Notes" } }).success, false)
})
