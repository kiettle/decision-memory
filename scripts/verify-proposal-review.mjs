import assert from "node:assert/strict"
import { createProposalReviewService } from "../apps/server/src/proposal-review.js"

export async function verifyProposalReview({ repository, identity, otherIdentity }) {
  const scope = "Proposal review integration"
  const old = await repository.createDecision(identity, { title: "Keep backups in Postgres", appliesTo: [scope] })
  const middle = await repository.createDecision(identity, { title: "Use object storage for backups", appliesTo: [scope] })
  const current = await repository.createDecision(identity, { title: "Archive backups after 30 days", why: "Retention increased to 90 days.", appliesTo: [scope] })
  await repository.supersedeDecision(identity, middle.id, old.id, "Large files exhausted the host.")
  await repository.supersedeDecision(identity, current.id, middle.id, "Retention increased.")
  const pending = await repository.createDecision(identity, { title: "Where should backups go?", decisionState: "PENDING", appliesTo: [scope] })
  const local = { enabled: true, search: async () => ({ candidateCount: 3, totalCandidateCount: 3, matches: [old, pending].map(d => ({ decisionId: d.id })) }) }
  let calls = 0
  const service = createProposalReviewService({ config: {}, repository, memorySearch: local,
    generateContent: async request => {
      calls++
      if (request.contents.startsWith("Independently compare")) return { text: JSON.stringify({ checks: [{ decisionId: current.id, relation: "CONFLICTS", reason: "Fixture relation" }] }) }
      return { text: JSON.stringify({ findings: [{ assessment: "POSSIBLE_MISMATCH", explanation: "The current choice archives older backups.", citations: [{ evidenceId: `${current.id}:outcome`, quote: "Archive backups after 30 days" }] }] }) }
    } })
  const request = { proposal: "Keep all backups in Postgres", appliesTo: scope }
  const found = await service.check(identity, request)
  assert.deepEqual(found.evidence.map(d => d.decisionId), [old.id, current.id])
  assert.equal(found.evidence[0].status, "SUPERSEDED")
  assert.equal(found.evidence[1].replacements[0].reason, "Retention increased.")
  assert.equal(calls, 0)
  assert.equal((await service.check(identity, { ...request, method: "GEMINI" })).analysis.assessment, "POSSIBLE_MISMATCH")
  assert.deepEqual((await service.check(otherIdentity, { ...request, method: "GEMINI" })).evidence, [])
  assert.equal(calls, 2, "Foreign workspace must not send evidence to the provider; analysis uses two bounded calls")
  assert.equal((await repository.getDecision(identity, pending.id)).decisionState, "PENDING")
  console.log("Proposal review integration passed: real lifecycle chains/reasons, pending exclusion, tenant-scoped hydration and explicit provider; retrieval/provider mocked")
}
