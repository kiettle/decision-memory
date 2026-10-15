import { proposalReviewInput } from "./proposal-review.js"

const labels = { POSSIBLE_MISMATCH: "Possible mismatch", APPEARS_CONSISTENT: "Appears consistent", INSUFFICIENT_EVIDENCE: "Insufficient evidence" }
const plain = text => ({ type: "plain_text", text })
const section = text => ({ type: "section", text: plain(text.slice(0, 2900)) })
const value = (payload, block) => payload.view?.state?.values?.[block]?.value?.value ?? ""

function modal(config, { proposal = "", scope = "", message = "", result, busy = false, enabled }) {
  const input = (id, label, initial, max, optional = false) => ({
    type: "input", block_id: id, optional, dispatch_action: true, label: plain(label),
    element: { type: "plain_text_input", action_id: "value", max_length: max,
      multiline: id === "review_proposal", ...(initial ? { initial_value: initial } : {}),
      dispatch_action_config: { trigger_actions_on: ["on_character_entered"] } },
  })
  const blocks = [
    section("Review a proposal against recorded choices. Local checking does not call Gemini or save a decision."),
    input("review_proposal", "What are you proposing?", proposal, 500),
    input("review_scope", "Exact Applies To scope (required for Gemini)", scope, 200, true),
    section("Analyze with Gemini sends this proposal, scope and bounded stored excerpts to Google. Use synthetic or sanitized data. Results are private; AI can misinterpret valid citations."),
  ]
  if (message) blocks.push(section(message))
  if (!busy) blocks.push({ type: "actions", elements: [
    { type: "button", action_id: "review_local", text: plain("Check locally") },
    ...(enabled ? [{ type: "button", action_id: "review_gemini", text: plain("Analyze with Gemini") }] : []),
  ] })
  if (!enabled) blocks.push(section("Gemini is not configured. Local checking remains available."))
  if (result) {
    blocks.push(section(`${labels[result.analysis.assessment] || "Local evidence"}\n${result.analysis.message}`))
    for (const finding of result.analysis.findings) {
      blocks.push(section(`${labels[finding.assessment]}\n${finding.explanation}`))
      blocks.push(section(finding.citations.map(c => {
        const record = result.evidence.find(d => d.excerpts.some(e => e.id === c.evidenceId))
        return `${record?.decisionKey || "Evidence"}: “${c.quote}”`
      }).join("\n")))
    }
    const c = result.coverage
    blocks.push(section(`${c.indexed} of ${c.total} matching decisions indexed; ${c.retrieved} retrieved, plus current replacements. Retrieval can miss relevant decisions.${c.indexed < c.total ? " Some records await indexing." : ""}${c.omittedSuccessors ? ` ${c.omittedSuccessors} successors omitted; open the full lifecycle.` : ""}${c.excerpted ? " Excerpts shortened; open records for full context." : ""}`))
    if (!result.evidence.length) blocks.push(section("No relevant recorded evidence found. This is not approval of the proposal."))
    // Up to ten cards; each uses two blocks. Total stays below Slack's 100-block cap.
    for (const d of result.evidence) {
      const why = d.excerpts.find(e => e.field === "why")?.text || "Why was not recorded."
      blocks.push(section(`${d.decisionKey} · ${d.status === "SUPERSEDED" ? "Historical / superseded" : "Current choice"}\n${d.title}\nApplies to: ${d.appliesTo.join(", ") || "Not recorded"}${d.inScope ? "" : " (scope not confirmed for this proposal)"}\nWhy: ${why}\n${d.replacements.map(r => `Replaced ${r.decisionKey}: ${r.reason || "No replacement reason recorded."}`).join("\n")}`))
      blocks.push({ type: "actions", elements: [
        { type: "button", action_id: `review_open_${d.decisionId}`, text: plain("Open evidence"), url: `${config.appBaseUrl}/#/decisions/${d.decisionId}` },
        ...(d.replacements[0] ? [{ type: "button", action_id: `review_compare_${d.decisionId}`, text: plain("Compare replacement"), url: `${config.appBaseUrl}/#/compare?left=${d.replacements[0].decisionId}&right=${d.decisionId}` }] : []),
      ] })
    }
    blocks.push(section("Edit the proposal above to check again. Nothing is saved or posted to the channel by this review."))
  }
  return { type: "modal", callback_id: "decision_memory_review", notify_on_close: true,
    title: plain("Check proposed decision"), close: plain("Close"), submit: plain("Done"), blocks }
}

export function createSlackProposalHandler({ config, proposalReview, slackApi, identityForSlack, plainSlackText }) {
  // Short-lived request generations, not proposal/history storage. Slack supplies
  // editable inputs in each signed interaction; its view hash prevents late writes.
  const generations = new Map()
  function advance(id) {
    for (const [key, entry] of generations) if (Date.now() - entry.at > 30 * 60_000) generations.delete(key)
    const token = Symbol(id)
    generations.set(id, { token, at: Date.now() })
    return token
  }
  return async function handle(payload) {
    if (payload.type === "message_action" && payload.callback_id === "check_proposed_decision") {
      const original = plainSlackText(payload.message?.text ?? "")
      const opened = await slackApi(config, "views.open", { trigger_id: payload.trigger_id,
        view: modal(config, { proposal: original.slice(0, 500), enabled: proposalReview.enabled,
          message: original.length > 500 ? "Only the first 500 characters are shown. Edit this to the short proposal you want to review." : "Edit the proposal if needed, then check locally." }) })
      advance(opened.view.id)
      return
    }
    const id = payload.view?.id
    if (payload.view?.callback_id !== "decision_memory_review" || !id) return
    // Slack requires a submit control for input blocks. Done only dismisses the
    // review; the router's empty acknowledgement closes it without saving.
    if (payload.type === "view_closed" || payload.type === "view_submission") { generations.delete(id); return }
    const action = payload.actions?.[0]
    if (!action || action.action_id.startsWith("review_open_") || action.action_id.startsWith("review_compare_")) return
    const token = advance(id)
    const proposal = value(payload, "review_proposal")
    const scope = value(payload, "review_scope")
    const options = { proposal, scope, enabled: proposalReview.enabled }
    const update = (view, hash) => slackApi(config, "views.update", { view_id: id, hash, view })
    if (action.action_id === "value") {
      await update(modal(config, { ...options, message: "Input changed. Check again for an up-to-date review." }), payload.view.hash)
      return
    }
    if (!["review_local", "review_gemini"].includes(action.action_id)) return
    const parsed = proposalReviewInput.safeParse({ proposal, appliesTo: scope || undefined, method: action.action_id === "review_gemini" ? "GEMINI" : "LOCAL" })
    if (!parsed.success) {
      await update(modal(config, { ...options, message: parsed.error.issues.map(i => i.message).join(" ") }), payload.view.hash)
      return
    }
    const progress = await update(modal(config, { ...options, busy: true, message: "Checking… You can edit the proposal to cancel this result." }), payload.view.hash)
    const hash = progress.view?.hash
    // A missing response hash cannot safely publish over a newer edit.
    if (!hash) return
    let result, message = ""
    try { result = await proposalReview.check(identityForSlack(config, payload), parsed.data) }
    catch { message = "Review is unavailable. Your inputs are preserved; try again or use normal keyword search." }
    if (generations.get(id)?.token !== token) return
    await update(modal(config, { ...options, result, message }), hash)
  }
}
