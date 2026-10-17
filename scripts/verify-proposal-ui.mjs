import assert from "node:assert/strict"

export async function verifyProposalUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = [], created = []
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
  await page.route("**/api/metadata", async route => {
    // Navigation or teardown can cancel a slow metadata request mid-fetch.
    const response = await route.fetch().catch(() => null)
    if (!response) return
    const data = await response.json()
    await route.fulfill({ response, json: { ...data, features: { ...data.features, proposalAnalysis: true } } }).catch(() => {})
  })
  const endpoint = "**/api/decisions/check-proposal"
  try {
    await page.goto("http://localhost:5173/#/check-proposal", { waitUntil: "networkidle" })
    assert.equal(await page.title(), "Decision Memory")
    await page.getByRole("heading", { name: "Check a proposed decision" }).waitFor()
    assert.equal(await page.locator("vite-error-overlay").count(), 0)
    const proposal = page.getByLabel("What are you proposing?")
    const analyze = page.getByRole("button", { name: "Analyze with Gemini", exact: true })
    assert.equal(await analyze.isDisabled(), true)

    // An all-scope local check summarizes the closest match and suggests a scope;
    // one explicit click confirms that scope and analyzes. Nothing runs earlier.
    let suggestedCalls = 0
    await page.route(endpoint, async route => {
      const input = route.request().postDataJSON()
      suggestedCalls++
      if (input.method === "LOCAL") { await route.continue(); return }
      assert.equal(input.appliesTo, "Atlas migration", "The suggested scope is sent exactly")
      const response = await route.fetch({ postData: JSON.stringify({ ...input, method: "LOCAL" }) })
      const local = await response.json()
      await route.fulfill({ json: { ...local, method: "GEMINI", analysis: { status: "COMPLETE", assessment: "POSSIBLE_MISMATCH", message: "Mocked analysis.", findings: [] } } })
    })
    await proposal.fill("Keep migration backup files on the database host")
    assert.equal(suggestedCalls, 0)
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    const closest = page.getByRole("region", { name: "Closest recorded decision", exact: true })
    await closest.getByText("A similar choice was replaced", { exact: true }).waitFor()
    assert.match(await closest.innerText(), /DM-102 .* was replaced by DM-104 .*, which is current/)
    const suggested = page.getByRole("region", { name: "Suggested scope", exact: true })
    assert.match(await suggested.innerText(), /Atlas migration/)
    assert.equal(suggestedCalls, 1)
    await suggested.getByRole("button", { name: "Analyze with Gemini in Atlas migration", exact: true }).click()
    await page.getByRole("heading", { name: "Possible mismatch", exact: true }).waitFor()
    assert.equal(suggestedCalls, 2)
    assert.equal(await page.getByRole("combobox", { name: "Applies To", exact: true }).innerText(), "Atlas migration")
    assert.equal(await suggested.count(), 0, "A confirmed scope needs no suggestion")
    assert.match(await page.locator("body").innerText(), /Why DM-102 changed: The rehearsal export outgrew/)
    await page.unroute(endpoint)
    await page.goto("http://localhost:5173/#/check-proposal", { waitUntil: "networkidle" })
    await page.reload({ waitUntil: "networkidle" })
    assert.equal(await proposal.inputValue(), "")

    await proposal.fill("Use object storage for migration backup files")
    assert.equal(await analyze.isDisabled(), true, "AI needs a confirmed scope")
    await page.getByRole("combobox", { name: "Applies To", exact: true }).click()
    await page.getByRole("option", { name: "Atlas migration", exact: true }).click()
    const localResponse = page.waitForResponse(response => response.url().endsWith("/api/decisions/check-proposal"))
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    const local = await (await localResponse).json()
    assert.equal(local.method, "LOCAL")
    assert.ok(local.evidence.some(d => d.decisionKey === "DM-104"))
    await page.getByRole("article", { name: "DM-104", exact: true }).waitFor()
    assert.match(await page.locator("body").innerText(), /Similarity does not establish/)

    const target = local.evidence.find(d => d.decisionKey === "DM-104")
    // Follow the application's return controls, not just browser history.
    const assertReturnedDraft = async () => {
      await page.getByRole("heading", { name: "Check a proposed decision", exact: true }).waitFor()
      assert.equal(new URL(page.url()).hash, "#/check-proposal")
      assert.equal(await proposal.inputValue(), local.proposal)
      assert.equal(await page.getByRole("combobox", { name: "Applies To", exact: true }).innerText(), "Atlas migration")
    }
    await page.getByRole("article", { name: "DM-104", exact: true }).getByRole("link", { name: target.title, exact: true }).click()
    await page.getByText("Back to decisions", { exact: true }).click()
    await assertReturnedDraft()
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    await page.getByRole("article", { name: "DM-104", exact: true }).getByRole("link", { name: "Compare before and after", exact: true }).click()
    await page.getByRole("heading", { name: "Compare decisions", exact: true }).waitFor()
    await page.getByText("Back", { exact: true }).click()
    await assertReturnedDraft()
    await page.screenshot({ path: "/private/tmp/decision-memory-proposal-return-fixed.png", fullPage: true })
    const citation = target.excerpts.find(e => e.field === "outcome")
    const ai = { ...local, method: "GEMINI", analysis: { status: "COMPLETE", assessment: "APPEARS_CONSISTENT",
      message: "AI suggestion, not a decision. Exact citations are checked; the interpretation can still be wrong.",
      findings: [{ assessment: "APPEARS_CONSISTENT", explanation: "This proposal follows the recorded storage choice.", citations: [{ evidenceId: citation.id, quote: citation.text }] }] } }
    let aiCalls = 0
    await page.route(endpoint, async route => {
      const input = route.request().postDataJSON()
      assert.equal(input.method, "GEMINI"); assert.equal(input.appliesTo, "Atlas migration")
      aiCalls++; await route.fulfill({ json: ai })
    })
    await analyze.click()
    await page.getByRole("heading", { name: "Appears consistent", exact: true }).waitFor()
    assert.equal(aiCalls, 1)
    await page.screenshot({ path: "/private/tmp/decision-memory-proposal-desktop.png", fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: "/private/tmp/decision-memory-proposal-mobile.png", fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.unroute(endpoint)

    // Real backend has no key in the isolated run: local cards survive failure.
    await analyze.click()
    await page.getByRole("heading", { name: "Analysis unavailable", exact: true }).waitFor()
    await page.getByRole("article", { name: "DM-104", exact: true }).waitFor()
    assert.equal(await proposal.inputValue(), local.proposal)

    // An in-flight old answer may never overwrite an edit or a navigation.
    let release, started
    const waiting = new Promise(resolve => { release = resolve })
    const begun = new Promise(resolve => { started = resolve })
    await page.route(endpoint, async route => { started(); await waiting; await route.fulfill({ json: ai }) })
    await analyze.click(); await begun
    await proposal.fill("A revised proposal for review")
    release()
    await page.waitForTimeout(100)
    assert.equal(await page.getByRole("heading", { name: "Appears consistent", exact: true }).count(), 0)
    await page.unroute(endpoint)
    let releaseNavigation, startedNavigation
    const navigationWaiting = new Promise(resolve => { releaseNavigation = resolve })
    const navigationBegun = new Promise(resolve => { startedNavigation = resolve })
    await page.route(endpoint, async route => { startedNavigation(); await navigationWaiting; await route.fulfill({ json: ai }) })
    await analyze.click(); await navigationBegun
    await page.getByRole("link", { name: "Scopes", exact: true }).click()
    await page.getByRole("heading", { name: "Scope overviews", exact: true }).waitFor()
    releaseNavigation(); await page.goBack()
    await proposal.waitFor()
    assert.equal(await proposal.inputValue(), "A revised proposal for review")
    assert.equal(await page.getByRole("heading", { name: "Appears consistent", exact: true }).count(), 0)
    await page.unroute(endpoint)

    // Prefill must carry only human text and exact scope; saving stays explicit.
    await page.route(endpoint, route => route.fulfill({ json: { ...local, analysis: { status: "NOT_REQUESTED", assessment: null, message: "Local evidence", findings: [] } } }))
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    await page.getByRole("button", { name: "Revise proposal", exact: true }).click()
    assert.equal(await proposal.evaluate(element => element === document.activeElement), true)
    await page.getByRole("link", { name: "Record this choice", exact: true }).click()
    await page.getByRole("heading", { name: "New Decision" }).waitFor()
    const title = "A revised proposal for review"
    assert.equal(await page.getByLabel("What did you decide?").inputValue(), title)
    assert.equal(await page.getByLabel("Why? (optional)", { exact: true }).isVisible(), true)
    assert.equal(await page.getByLabel("Why? (optional)", { exact: true }).inputValue(), "")
    assert.deepEqual(await page.locator("[data-slot=combobox-chip]").allTextContents(), ["Atlas migration"])
    assert.equal(await models.Decision.count({ where: { workspaceId: workspace.id, title } }), 0)
    const savedResponse = page.waitForResponse(r => r.url().endsWith("/api/decisions") && r.request().method() === "POST")
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    const saved = await (await savedResponse).json(); created.push(saved.id)
    assert.equal(saved.decisionState, "DECIDED"); assert.equal(saved.outcome, title)
    assert.equal(saved.why, null, "Empty rationale remains absent; no AI explanation is persisted")
    assert.deepEqual(saved.appliesTo, ["Atlas migration"])
    await page.getByText("Back to decisions", { exact: true }).click()
    await page.getByRole("heading", { name: "Check a proposed decision", exact: true }).waitFor()
    assert.equal(await proposal.inputValue(), title, "Saving then returning also preserves the proposal")
    assert.deepEqual(errors, [])
    console.log("Proposal UI passed: real local retrieval, explicit mocked analysis/citations, mobile layout, unavailable fallback, edit/navigation races, evidence/comparison/save return paths and explicit human-only capture")
  } finally {
    await page.unrouteAll({ behavior: "wait" })
    await context.close()
    for (const id of created) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  }
}
