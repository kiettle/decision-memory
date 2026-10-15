import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { GoogleGenAI } from "@google/genai"
import { setTimeout as delay } from "node:timers/promises"
import { config } from "../apps/server/src/config.js"
import { createProposalReviewService } from "../apps/server/src/proposal-review.js"
import { proposalEvaluationCases as regressionCases } from "./fixtures/proposal-evaluation.mjs"
import { proposalEvaluationCases as regressionV2Cases } from "./fixtures/proposal-evaluation-v2.mjs"
import { proposalEvaluationCases as regressionV3Cases } from "./fixtures/proposal-evaluation-v3.mjs"
import { proposalEvaluationCases as holdoutCases } from "./fixtures/proposal-evaluation-v4.mjs"

// Explicit opt-in is separate from all ordinary tests. Only these synthetic
// fixtures go to Gemini; no database or Slack/Jira connection is made.
if (!process.argv.includes("--live")) throw new Error("Use --live to explicitly send the synthetic evaluation cases to Gemini.")
if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY is not configured; live evaluation was not run.")
const outputIndex = process.argv.indexOf("--output")
const output = resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : `/private/tmp/decision-memory-proposal-evaluation-${Date.now()}.json`)
const results = []
const regression = process.argv.includes("--regression-v1")
const regressionV2 = process.argv.includes("--regression-v2")
const regressionV3 = process.argv.includes("--regression-v3")
const knownFailures = process.argv.includes("--regression-failures")
const failures = new Set(["u02", "u23", "u24", "u26", "m32", "m33", "m34", "m35", "m36", "m37", "c38", "u33"])
const proposalEvaluationCases = knownFailures ? [...regressionCases, ...regressionV2Cases, ...regressionV3Cases].filter(c => failures.has(c.id))
  : regression ? regressionCases : regressionV2 ? regressionV2Cases : regressionV3 ? regressionV3Cases : holdoutCases
const version = knownFailures ? "synthetic-regression-failures" : regression ? "synthetic-regression-v1" : regressionV2 ? "synthetic-regression-v2" : regressionV3 ? "synthetic-regression-v3" : "synthetic-holdout-v4"
const implementationSha256 = createHash("sha256").update(await readFile(new URL("../apps/server/src/proposal-review.js", import.meta.url))).digest("hex")
const fixturesSha256 = createHash("sha256").update(JSON.stringify(proposalEvaluationCases)).digest("hex")
const client = new GoogleGenAI({ apiKey: config.geminiApiKey })
for (const fixture of proposalEvaluationCases) {
  if (results.length) await delay(6000)
  const calls = []
  const service = createProposalReviewService({ config,
    generateContent: async request => {
      const call = { stage: request.contents.startsWith("Independently compare") ? "verification" : "assessment" }
      calls.push(call)
      const start = Date.now()
      try {
        const response = await client.models.generateContent(request)
        call.output = response.text; call.finishReason = response.candidates?.[0]?.finishReason
        return response
      } catch (error) { call.error = error.name; call.status = error.status; throw error }
      finally { call.elapsedMs = Date.now() - start }
    },
    repository: { getDecision: async (_identity, id) => fixture.records.find(d => d.id === id) ?? null },
    memorySearch: { enabled: true, search: async () => ({ matches: fixture.records.map(d => ({ decisionId: d.id })), candidateCount: fixture.records.length, totalCandidateCount: fixture.records.length }) },
  })
  const start = Date.now()
  const result = await service.check({ workspaceExternalKey: "synthetic-evaluation-only" }, fixture.input)
  const row = { id: fixture.id, language: fixture.language, expected: fixture.expected, actual: result.analysis.assessment,
    completed: result.analysis.status === "COMPLETE", correct: result.analysis.assessment === fixture.expected,
    elapsedMs: Date.now() - start, analysis: result.analysis, calls }
  results.push(row)
  console.log(`${row.id} (${row.language}): ${row.actual || result.analysis.status}; expected ${row.expected}; ${row.elapsedMs}ms`)
  await writeFile(output, JSON.stringify({ version, implementationSha256, fixturesSha256, model: config.geminiModel, date: new Date().toISOString(),
    limitation: "Controlled candidate retrieval; tests live assessment, not end-to-end recall or user value. Expected labels are authored, not independent user adjudication.",
    total: proposalEvaluationCases.length, attempted: results.length, completed: results.filter(r => r.completed).length,
    correct: results.filter(r => r.correct).length, results }, null, 2))
}
console.log(`Evaluation: ${results.filter(r => r.correct).length}/${results.length} expected labels matched. Inspect findings and abstentions: ${output}`)
if (results.some(r => !r.correct)) process.exitCode = 1
