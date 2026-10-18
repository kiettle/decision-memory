import assert from "node:assert/strict"

export async function verifyDiscoveryUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:5173" })
  const page = await context.newPage()
  const created = [], errors = [], reviewCalls = []
  let expectedFailure = false, detailCalls = 0, writes = 0
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error" && !expectedFailure) errors.push(message.text()) })
  page.on("request", request => {
    if (/\/api\/decisions\/[\da-f-]+$/.test(request.url()) && request.method() === "GET") detailCalls++
    // Review and the automatic related lookup are reads sent as POST.
    if (["POST", "PUT"].includes(request.method()) && !/(check-proposal|memory-search)$/.test(request.url())) writes++
    if (request.url().endsWith("check-proposal")) reviewCalls.push(request.postDataJSON())
  })
  const base = "http://localhost:5173/#"
  const api = "http://localhost:3011/api"
  const metadata = await (await page.request.get(`${api}/metadata`)).json()
  const prefix = `decision-memory:v1:${encodeURIComponent(metadata.workspace.id)}:${encodeURIComponent(metadata.currentUser.id)}:`
  const create = async data => {
    const response = await page.request.post(`${api}/decisions`, { data: { tags: ["discovery-ui"], appliesTo: ["Discovery UI"], ...data } })
    assert.equal(response.status(), 201)
    const record = await response.json(); created.push(record.id); return record
  }
  const formReady = () => page.getByRole("heading", { name: "New Decision", exact: true }).waitFor()
  const primary = () => page.locator("#decision")
  const details = () => page.getByText("More details", { exact: true })
  const library = `${base}/?tag=discovery-ui`
  try {
    const record = await create({ title: "Discovery object archive", why: "Full stored rationale for preview.", references: [{ kind: "URL", label: "Design proof", url: "https://example.com/discovery-design" }] })
    const pending = await create({ title: "Discovery pending question", decisionState: "PENDING" })
    await create({ title: "Discovery named owner", ownerName: "Recorded person" })
    await create({ title: "Discovery assigned owner", ownerId: metadata.currentUser.id })
    await page.goto(`${library}&q=${record.decisionKey.toLowerCase()}`)
    await page.getByRole("link", { name: record.title, exact: true }).waitFor()
    assert.equal(await page.title(), "Decision Memory")
    assert.equal(await page.locator(".decision-row").count(), 1)
    assert.equal(await page.locator("vite-error-overlay").count(), 0)
    assert.equal(detailCalls, 0, "Library renders without fetching every full decision")
    const previewButton = page.getByRole("button", { name: `Preview ${record.decisionKey}`, exact: true })
    await previewButton.focus(); await page.keyboard.press("Enter")
    const preview = page.getByRole("dialog", { name: "Decision preview", exact: true })
    await preview.getByText(record.why, { exact: true }).waitFor()
    assert.ok(detailCalls > 0, "Preview fetches full details only after opening (StrictMode may replay the effect)")
    await preview.getByRole("link", { name: "Design proof", exact: true }).waitFor()
    await preview.getByRole("button", { name: "Copy link", exact: true }).click()
    await page.getByText("Decision link copied.", { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${base}/decisions/${record.id}`)
    await preview.getByRole("button", { name: "Copy summary", exact: true }).click()
    await page.getByText("Decision summary copied.", { exact: true }).waitFor()
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /https:\/\/example.com\/discovery-design/)
    await page.screenshot({ path: "/private/tmp/decision-discovery-preview-desktop.png", animations: "disabled" })
    await page.keyboard.press("Escape")
    await preview.waitFor({ state: "hidden" })
    assert.equal(await previewButton.evaluate(el => el === document.activeElement), true)
    assert.ok(page.url().includes(record.decisionKey.toLowerCase()))
    expectedFailure = true
    await page.route(`**/api/decisions/${record.id}`, route => route.fulfill({ status: 503, json: { error: "Preview fixture failure" } }))
    await previewButton.click()
    await preview.getByRole("alert").waitFor()
    await page.unroute(`**/api/decisions/${record.id}`)
    await preview.getByRole("button", { name: "Retry preview", exact: true }).click()
    await preview.getByText(record.why, { exact: true }).waitFor()
    expectedFailure = false
    await preview.getByRole("button", { name: "Back to results", exact: true }).click()
    await page.getByRole("button", { name: "Kanban", exact: true }).click()
    await previewButton.click()
    await preview.getByText(record.why, { exact: true }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: "/private/tmp/decision-discovery-preview-mobile.png", animations: "disabled" })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await preview.getByRole("button", { name: "Back to results", exact: true }).click()
    await page.setViewportSize({ width: 1440, height: 1000 })

    // Searchable comparison and replacement pickers support key/title and exclude invalid choices.
    await page.getByRole("button", { name: "Compare decisions", exact: true }).click()
    const compare = page.getByRole("dialog", { name: "Compare two Decisions", exact: true })
    await compare.getByRole("combobox", { name: "First Decision", exact: true }).click()
    await page.getByRole("combobox", { name: "Search first decision", exact: true }).fill(record.decisionKey.toLowerCase())
    await page.getByRole("option", { name: `${record.decisionKey} · ${record.title}`, exact: true }).click()
    await compare.getByRole("combobox", { name: "Second Decision", exact: true }).click()
    await page.getByRole("combobox", { name: "Search second decision", exact: true }).fill(pending.title)
    await page.getByRole("option", { name: `${pending.decisionKey} · ${pending.title}`, exact: true }).click()
    await compare.getByRole("button", { name: "Open comparison", exact: true }).click()
    await page.getByRole("article", { name: "Second Decision", exact: true }).waitFor()
    await page.goto(`${base}/decisions/${record.id}`)
    await page.getByRole("button", { name: "Supersede", exact: true }).click()
    await page.getByRole("combobox", { name: "Earlier Decision", exact: true }).click()
    await page.getByRole("combobox", { name: "Search earlier decision", exact: true }).fill("Discovery named")
    await page.getByRole("option", { name: /Discovery named owner/ }).click()
    await page.getByRole("region", { name: "Earlier choice", exact: true }).waitFor()
    await page.keyboard.press("Escape")

    await page.goto(library)
    await page.getByRole("button", { name: /^More filters/ }).click()
    const filters = page.getByRole("dialog", { name: "More filters", exact: true })
    await filters.getByRole("combobox", { name: "Owner", exact: true }).click()
    await page.getByRole("option", { name: "Unassigned", exact: true }).click()
    await filters.getByRole("button", { name: "Close", exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll(".decision-row").length === 2)
    await page.getByRole("button", { name: "Pending", exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll(".decision-row").length === 1)
    await page.getByRole("link", { name: pending.title, exact: true }).waitFor()
    await page.getByRole("button", { name: "Save view", exact: true }).click()
    const save = page.getByRole("dialog", { name: "Save library view", exact: true })
    await save.getByLabel("View name").fill("Unowned questions")
    await save.getByRole("button", { name: "Save view", exact: true }).click()
    await save.waitFor({ state: "hidden" })
    await page.reload()
    await page.getByRole("combobox", { name: "Saved views", exact: true }).filter({ hasText: "Unowned questions" }).waitFor()
    await page.getByRole("link", { name: pending.title, exact: true }).waitFor()
    assert.ok(page.url().includes("ownerId=UNASSIGNED"))

    // Both library creation entries carry scope, but do not turn a search into a choice.
    const scoped = `${base}/?appliesTo=Discovery+UI`
    await page.goto(scoped)
    await page.getByRole("button", { name: "New Decision", exact: true }).click()
    await formReady()
    assert.equal(await primary().inputValue(), "")
    await page.getByRole("button", { name: "Remove scope Discovery UI", exact: true }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Review this choice", exact: true }).count(), 0)
    await page.getByRole("button", { name: "Cancel", exact: true }).click()
    await page.goto(`${scoped}&q=no-such-discovery-record`)
    await page.getByRole("heading", { name: "No decisions match these filters", exact: true }).waitFor()
    await page.getByRole("button", { name: "New Decision", exact: true }).last().click()
    await formReady()
    await page.getByRole("button", { name: "Remove scope Discovery UI", exact: true }).waitFor()
    await page.getByLabel("Decide by (optional)").fill("2026-11-05")
    await primary().fill("Original archive question")
    await page.getByRole("combobox").filter({ hasText: "Unassigned" }).click()
    await page.getByRole("option", { name: metadata.currentUser.displayName, exact: true }).click()
    await page.getByRole("button", { name: "Already decided", exact: true }).click()
    await primary().fill("Keep the full discovery draft")
    await page.getByLabel("Why? (optional)").fill("Human rationale stays unchanged")
    await details().click()
    await page.getByLabel("Context", { exact: true }).fill("Context with unfinished input")
    await page.getByLabel("Tags", { exact: true }).fill("first, second, ")
    await page.getByLabel("Options Considered", { exact: true }).fill("Option A\nOption B ")
    await page.getByRole("button", { name: "Add link", exact: true }).click()
    await page.getByLabel("Related link 1 URL", { exact: true }).fill("https://example.com/draft")
    const originalForm = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), `${prefix}form-draft:new`)
    const assertDraft = async () => {
      await formReady()
      await page.waitForFunction(() => document.querySelector("#decision")?.value === "Keep the full discovery draft")
      assert.equal(await page.getByLabel("Why? (optional)").inputValue(), originalForm.form.why)
      if (!await page.getByLabel("Context", { exact: true }).isVisible()) await details().click()
      assert.equal(await page.getByLabel("Context", { exact: true }).inputValue(), originalForm.form.context)
      assert.equal(await page.getByLabel("Tags", { exact: true }).inputValue(), originalForm.listText.tags)
      assert.equal(await page.getByLabel("Options Considered", { exact: true }).inputValue(), originalForm.listText.options)
      assert.equal(await page.getByLabel("Related link 1 URL", { exact: true }).inputValue(), "https://example.com/draft")
      assert.equal(await page.getByLabel("Original question (optional)").inputValue(), "Original archive question")
      await page.getByRole("combobox").filter({ hasText: metadata.currentUser.displayName }).waitFor()
      await page.getByRole("button", { name: "Remove scope Discovery UI", exact: true }).waitFor()
      assert.equal(await page.getByRole("button", { name: "Restore draft", exact: true }).count(), 0)
    }
    const openReview = async () => {
      await page.getByRole("button", { name: "Review this choice", exact: true }).click()
      await page.getByRole("heading", { name: "Check a proposed decision", exact: true }).waitFor()
      assert.equal(await page.getByLabel("What are you proposing?").inputValue(), "Keep the full discovery draft")
      assert.match(await page.getByRole("combobox", { name: "Applies To", exact: true }).innerText(), /Discovery UI/)
    }
    await openReview()
    assert.equal(reviewCalls.length, 0)
    await page.goBack(); await assertDraft()

    // Review results and evidence/comparison detours preserve the capture origin.
    const earlier = await create({ title: "Earlier review proof", tags: ["review-draft-proof"] })
    const reviewResponse = {
      proposal: "Keep the full discovery draft", appliesTo: "Discovery UI", method: "LOCAL",
      coverage: { indexed: 1, total: 1, retrieved: 1, omittedSuccessors: 0, excerpted: false },
      analysis: { status: "NOT_REQUESTED", assessment: null, message: "Local evidence only", findings: [] },
      evidence: [{ decisionId: record.id, decisionKey: record.decisionKey, title: record.title, status: "ACTIVE", role: "MATCH", inScope: true,
        appliesTo: ["Discovery UI"], excerpts: [{ id: "why-proof", decisionId: record.id, field: "why", label: "Why", text: record.why }],
        currentIds: [], replacements: [{ decisionId: earlier.id, decisionKey: earlier.decisionKey, reason: "Stored change" }], excerpted: false }],
    }
    await page.route("**/api/decisions/check-proposal", route => route.fulfill({ json: reviewResponse }))
    await openReview()
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    const evidence = page.getByRole("article", { name: record.decisionKey, exact: true })
    await evidence.getByRole("link", { name: record.title, exact: true }).click()
    await page.getByRole("button", { name: "Back to decisions", exact: true }).click()
    await page.getByRole("link", { name: "Back to draft", exact: true }).waitFor()
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    await evidence.getByRole("link", { name: "Compare before and after", exact: true }).click()
    await page.getByRole("article", { name: "Second Decision", exact: true }).waitFor()
    await page.getByRole("button", { name: "Back", exact: true }).click()
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    assert.equal(await page.getByRole("link", { name: "Record this choice", exact: true }).count(), 0)
    await page.getByRole("link", { name: "Return to draft", exact: true }).click()
    await assertDraft()
    await page.unroute("**/api/decisions/check-proposal")
    // Even denied persistence cannot lose the in-progress form on review/return.
    await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("Denied", "SecurityError") } })
    await page.evaluate(() => {
      window.originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = () => { throw new DOMException("Denied", "SecurityError") }
    })
    await openReview()
    await page.reload()
    await page.getByRole("link", { name: "Back to draft", exact: true }).waitFor()
    expectedFailure = true
    await page.route("**/api/decisions/check-proposal", route => route.fulfill({ status: 503, json: { error: "Review unavailable for proof" } }))
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    await page.getByText("Review unavailable for proof", { exact: true }).waitFor()
    await page.getByLabel("What are you proposing?").fill("Review-only edit must not replace original")
    await page.route("**/api/metadata", route => route.fulfill({ status: 503, json: { error: "Form load retry proof" } }))
    await page.getByRole("link", { name: "Back to draft", exact: true }).click()
    await page.getByRole("heading", { name: "Could not load Decision form", exact: true }).waitFor()
    await page.reload()
    await page.getByRole("heading", { name: "Could not load Decision form", exact: true }).waitFor()
    await page.unroute("**/api/metadata")
    await page.getByRole("button", { name: "Try again", exact: true }).click()
    await assertDraft()
    expectedFailure = false
    await page.unroute("**/api/decisions/check-proposal")
    await page.screenshot({ path: "/private/tmp/decision-discovery-draft-return.png", fullPage: true, animations: "disabled" })
    assert.equal(reviewCalls.length, 4)
    assert.ok(reviewCalls.every(call => call.method === "LOCAL"))
    assert.equal(writes, 0, "Browsing, previews and review never save a decision")

    // A choice with multiple scopes requires explicit scope selection in review.
    await page.getByRole("combobox", { name: "Applies To", exact: true }).fill("Second discovery scope")
    await page.getByRole("option", { name: 'Add “Second discovery scope”', exact: true }).click()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Review this choice", exact: true }).click()
    await page.getByRole("heading", { name: "Check a proposed decision", exact: true }).waitFor()
    assert.match(await page.getByRole("combobox", { name: "Applies To", exact: true }).innerText(), /All scopes/)
    assert.equal(await page.getByRole("button", { name: "Analyze with Gemini", exact: true }).isDisabled(), true)
    await page.getByRole("link", { name: "Back to draft", exact: true }).click()
    await assertDraft()
    await page.getByRole("button", { name: "Remove scope Second discovery scope", exact: true }).waitFor()
    expectedFailure = true
    await page.route("**/api/decisions", route => route.request().method() === "POST" ? route.fulfill({ status: 503, json: { error: "Save unavailable for proof" } }) : route.continue())
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    await page.getByText("Save unavailable for proof", { exact: true }).waitFor()
    await assertDraft()
    await page.unroute("**/api/decisions")
    expectedFailure = false
    const [savedResponse] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith("/api/decisions") && response.request().method() === "POST"),
      page.getByRole("button", { name: "Save Decision", exact: true }).click(),
    ])
    const saved = await savedResponse.json()
    created.push(saved.id)
    assert.equal(saved.title, "Original archive question")
    assert.equal(saved.outcome, "Keep the full discovery draft")
    assert.equal(saved.dueDate, "2026-11-05")
    assert.equal(saved.owner.id, metadata.currentUser.id)
    assert.deepEqual(saved.appliesTo, ["Discovery UI", "Second discovery scope"])
    assert.equal(saved.references[0].url, "https://example.com/draft")
    await page.getByRole("heading", { name: saved.outcome, exact: true, level: 1 }).waitFor()
    assert.deepEqual(errors, [])
    console.log("Discovery UI passed: exact-key lookup, lazy preview/copy/retry/keyboard/mobile, searchable pickers, unassigned saved view, scope-prefilled capture and full draft review/Back/refresh/failure, evidence/comparison returns, multiple-scope confirmation and explicit save")
  } catch (error) {
    console.error("Discovery failure page:", page.url(), await page.locator("body").innerText())
    await page.screenshot({ path: "/private/tmp/decision-discovery-failure.png", fullPage: true })
    throw error
  } finally {
    await context.close()
    for (const id of created) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  }
}

export async function verifyPracticalUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "UTC" })
  const page = await context.newPage()
  const api = "http://localhost:3011/api", base = "http://localhost:5173/#"
  const created = [], errors = [], semantic = [], reviews = [], writes = []
  let expectedFailure = false, detailReads = 0
  page.on("pageerror", e => errors.push(e.message))
  page.on("console", m => { if (m.type() === "error" && !expectedFailure) errors.push(m.text()) })
  page.on("request", r => {
    if (r.url().endsWith("/memory-search")) semantic.push(r.postDataJSON())
    else if (r.url().endsWith("/check-proposal")) reviews.push(r.postDataJSON())
    else if (["POST", "PUT"].includes(r.method()) && r.url().includes("/api/decisions")) writes.push(r.url())
    if (r.method() === "GET" && /\/api\/decisions\/[\da-f-]+$/.test(r.url())) detailReads++
  })
  const metadata = await (await page.request.get(`${api}/metadata`)).json()
  const scope = "Practical scope, exact", secondScope = "Practical second scope"
  const create = async input => {
    const response = await page.request.post(`${api}/decisions`, { data: { title: "Practical fixture", appliesTo: [scope], tags: ["practical-ui"], ...input } })
    assert.equal(response.status(), 201)
    const record = await response.json(); created.push(record.id); return record
  }
  const go = async path => {
    await page.goto(`${base}${path}`)
    await page.reload({ waitUntil: "networkidle" })
    await page.locator("h1").waitFor()
  }
  const params = () => Object.fromEntries(new URLSearchParams(page.url().split("?")[1] ?? ""))
  const row = record => page.locator(".decision-row, .board-card").filter({ has: page.getByRole("link", { name: record.outcome ?? record.title, exact: true }) })
  const preview = () => page.getByRole("dialog", { name: "Decision preview", exact: true })
  const dialog = () => page.getByRole("dialog", { name: "Record decision", exact: true })
  const related = () => page.getByRole("region", { name: "Related decisions", exact: true })
  const find = () => related().getByRole("button", { name: "Find related decisions", exact: true })
  const addScope = async value => {
    await page.getByRole("combobox", { name: "Applies To", exact: true }).fill(value)
    await page.getByRole("option", { name: `Add “${value}”`, exact: true }).click()
    await page.keyboard.press("Escape")
  }
  const chooseLookup = async value => {
    await related().getByRole("combobox", { name: "Search within", exact: true }).click()
    await page.getByRole("option", { name: value || "All scopes", exact: true }).click()
    await page.locator('[data-slot="combobox-content"]').waitFor({ state: "hidden" })
  }
  const input = "  Practical raw final choice  ", rationale = "  Original rationale\nKeep this spacing.  "
  const assertCompletion = async () => {
    await dialog().waitFor()
    assert.equal(await dialog().getByLabel("What did you decide?").inputValue(), input)
    assert.equal(await dialog().getByLabel("Why (optional)").inputValue(), rationale)
  }
  let releaseSearch
  try {
    await page.clock.install({ time: new Date("2026-10-17T12:00:00Z") })
    const linked = await create({ title: "Practical linked choice", ownerId: metadata.currentUser.id, appliesTo: [scope, secondScope], tags: ["practical-ui", "Exact tag"], why: "Stored rationale", dueDate: "2026-10-10" })
    const named = await create({ title: "Practical named choice", ownerName: "Recorded owner" })
    const unassigned = await create({ title: "Practical unassigned choice" })
    for (const channelName of ["practical-channel", "practical-second"]) await models.SourceSnapshot.create({ workspaceId: workspace.id, decisionId: linked.id, provider: "SLACK", capturedAt: new Date(), channelName, permalink: "https://example.com/source", messages: [], sourceContext: {} })
    const baseline = { q: "Practical", tag: "practical-ui", appliesTo: scope, status: "DECIDED", dateRange: "7", sort: "DEADLINE" }
    const url = values => `/?${new URLSearchParams(values)}`
    for (const [record, label, key, value] of [
      [linked, "Tag to Exact tag", "tag", "Exact tag"],
      [linked, `Owner to ${metadata.currentUser.displayName}`, "ownerId", metadata.currentUser.id],
      [named, "Owner to Recorded owner (recorded name)", "ownerId", "name:Recorded owner"],
      [unassigned, "Owner to Unassigned", "ownerId", "UNASSIGNED"],
      [linked, `Applies To to ${secondScope}`, "appliesTo", secondScope],
      [linked, "Channel to #practical-second", "channel", "practical-second"],
    ]) {
      await go(url(baseline))
      await row(record).getByRole("button", { name: `Filter ${label}`, exact: true }).focus()
      await page.keyboard.press("Enter")
      await page.getByRole("button", { name: `Remove ${{ tag: "Tag", ownerId: "Owner", appliesTo: "Applies To", channel: "Channel" }[key]} filter`, exact: true }).waitFor()
      assert.deepEqual(params(), { ...baseline, [key]: value })
    }
    for (const record of [linked, named, unassigned]) {
      await go(url({ ...baseline, view: "kanban" }))
      const control = row(record).getByRole("button", { name: /^Filter Owner to / })
      await control.click()
      const value = record.owner?.id ?? (record.ownerName ? `name:${record.ownerName}` : "UNASSIGNED")
      assert.deepEqual(params(), { ...baseline, view: "kanban", ownerId: value })
      assert.equal(await row(record).getByRole("button", { name: /^Filter (Tag|Applies To|Channel) / }).count(), 0, "Do not add metadata to Kanban solely for controls")
    }
    await page.route("**/api/metadata", route => route.fulfill({ json: { ...metadata, features: { ...metadata.features, memorySearch: true, proposalAnalysis: true } } }))
    const match = record => ({ method: "LOCAL", candidateCount: 3, totalCandidateCount: 3, matches: [{ decisionId: record.id, decision: record, score: 90, explanation: "Stored match", matchedConcepts: [] }] })
    await page.route("**/api/decisions/memory-search", route => route.fulfill({ json: match(linked) }))
    await go(url(baseline))
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click()
    await page.getByText("Local semantic match", { exact: true }).first().waitFor()
    const beforeNoOp = semantic.length, oldUrl = page.url()
    await row(linked).getByRole("button", { name: "Filter Tag to practical-ui", exact: true }).click()
    assert.equal(page.url(), oldUrl)
    await page.getByText("Local semantic match", { exact: true }).first().waitFor()
    assert.equal(semantic.length, beforeNoOp)
    await row(linked).getByRole("button", { name: "Filter Tag to Exact tag", exact: true }).click()
    await page.getByText("Local semantic match", { exact: true }).first().waitFor({ state: "hidden" })
    assert.equal(semantic.length, beforeNoOp)
    await go(url(baseline))
    let started
    const begun = new Promise(resolve => { started = resolve })
    const held = new Promise(resolve => { releaseSearch = resolve })
    await page.route("**/api/decisions/memory-search", async route => { started(); await held; await route.fulfill({ json: match(linked) }) })
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click(); await begun
    await row(linked).getByRole("button", { name: `Filter Applies To to ${secondScope}`, exact: true }).click()
    releaseSearch(); await page.waitForLoadState("networkidle")
    assert.equal(await page.getByText("Local semantic match", { exact: true }).count(), 0)
    assert.ok(semantic.every(call => call.method === "LOCAL"))
    const longRecord = await create({ title: "Practical long metadata", ownerName: "owner".repeat(38), appliesTo: ["scope".repeat(38)], tags: ["practical-ui", "tag".repeat(26)] })
    await models.SourceSnapshot.create({ workspaceId: workspace.id, decisionId: longRecord.id, provider: "SLACK", capturedAt: new Date(), channelName: "channel".repeat(25), messages: [] })
    await go("/?tag=practical-ui")
    await page.setViewportSize({ width: 390, height: 844 })
    await row(longRecord).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await row(longRecord).scrollIntoViewIfNeeded()
    await page.screenshot({ path: "/private/tmp/decision-practical-metadata-mobile.png", animations: "disabled" })
    await page.setViewportSize({ width: 1440, height: 1000 })
    console.log("Practical metadata filters passed: all exact mappings, no-op semantic cache, keyboard, context and stale response")

    const middle = await create({ title: "Practical historical middle" })
    const current = await create({ title: "Practical current replacement" })
    const branch = await create({ title: "Practical second current replacement" })
    assert.equal((await page.request.post(`${api}/decisions/${middle.id}/supersede`, { data: { targetId: linked.id } })).ok(), true)
    assert.equal((await page.request.post(`${api}/decisions/${current.id}/supersede`, { data: { targetId: middle.id } })).ok(), true)
    await models.DecisionRelation.create({ workspaceId: workspace.id, fromDecisionId: branch.id, toDecisionId: linked.id, relationType: "SUPERSEDES", replacementReason: "Synthetic branch" })
    const noSuccessor = await create({ title: "Practical historical without successor" })
    await models.Decision.update({ status: "SUPERSEDED" }, { where: { id: noSuccessor.id, workspaceId: workspace.id } })
    const pending = await create({ title: "Practical pending completion", decisionState: "PENDING", ownerId: metadata.currentUser.id, dueDate: "2026-10-10", why: "Original pending reason", context: "Preserved original context", optionsConsidered: ["One", "Two"], references: [{ kind: "URL", label: "Evidence", url: "https://example.com/retained" }] })
    const beforePreviewReads = detailReads
    await go("/?tag=practical-ui&sort=DEADLINE")
    assert.equal(detailReads, beforePreviewReads, "Library lists never eagerly load full preview records")
    const beforePreviewWrites = writes.length, beforePreviewAi = semantic.length + reviews.length
    await row(linked).getByRole("button", { name: `Preview ${linked.decisionKey}`, exact: true }).click()
    await preview().getByText(metadata.currentUser.displayName, { exact: true }).waitFor()
    await preview().locator('time[datetime="2026-10-10"]').waitFor()
    assert.equal(await preview().locator(".is-overdue").count(), 0, "Decided deadlines stay historical")
    const replacements = preview().getByRole("region", { name: "Current replacements", exact: true })
    assert.equal(await replacements.getByRole("link").count(), 2)
    await replacements.getByRole("link", { name: `${current.decisionKey} · ${current.title}`, exact: true }).waitFor()
    assert.equal(await replacements.getByText(middle.title, { exact: false }).count(), 0)
    await page.screenshot({ path: "/private/tmp/decision-practical-preview-desktop.png", animations: "disabled" })
    await replacements.getByRole("link", { name: `${branch.decisionKey} · ${branch.title}`, exact: true }).click()
    await page.waitForURL(`**/#/decisions/${branch.id}`)
    await page.getByRole("button", { name: "Back to decisions", exact: true }).click()
    await page.waitForURL("**/#/?tag=practical-ui&sort=DEADLINE")
    await row(pending).getByRole("button", { name: `Preview ${pending.decisionKey}`, exact: true }).click()
    await preview().locator(".decision-deadline.is-overdue").waitFor()
    await page.keyboard.press("Escape"); await preview().waitFor({ state: "hidden" })
    assert.equal(await row(pending).getByRole("button", { name: `Preview ${pending.decisionKey}`, exact: true }).evaluate(el => el === document.activeElement), true)
    await row(named).getByRole("button", { name: `Preview ${named.decisionKey}`, exact: true }).click()
    await preview().getByText("Recorded owner", { exact: true }).waitFor()
    assert.equal(await preview().getByRole("heading", { name: "Deadline", exact: true }).count(), 0)
    await page.keyboard.press("Escape")
    await row(noSuccessor).getByRole("button", { name: `Preview ${noSuccessor.decisionKey}`, exact: true }).click()
    await preview().getByText(/No current replacement information is available/).waitFor()
    await page.keyboard.press("Escape")
    assert.equal(writes.length, beforePreviewWrites)
    assert.equal(semantic.length + reviews.length, beforePreviewAi)
    console.log("Practical preview passed: loaded owner, deadline urgency/history, all current branches, no intermediate successor, missing history and origin links")

    await page.unroute("**/api/decisions/memory-search")
    await page.route("**/api/decisions/memory-search", route => route.fulfill({ json: match(linked) }))
    await go("/decisions/new")
    await page.locator("#decision").fill("Practical draft question")
    await addScope(scope); await addScope(secondScope)
    const beforeScope = semantic.length
    await chooseLookup(secondScope)
    assert.equal(semantic.length, beforeScope, "Selecting a lookup scope waits for a pause before searching")
    assert.deepEqual(await page.locator('[data-slot="combobox-chip"]').allTextContents(), [scope, secondScope])
    // The selected lookup scope is then searched automatically, locally.
    await related().getByRole("article").waitFor()
    assert.deepEqual(semantic.at(-1), { query: "Practical draft question", method: "LOCAL", filters: { appliesTo: secondScope } })
    await related().getByRole("button", { name: `Preview ${linked.decisionKey}`, exact: true }).click()
    await preview().getByText(metadata.currentUser.displayName, { exact: true }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: "/private/tmp/decision-practical-preview-mobile.png", animations: "disabled" })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await preview().getByRole("button", { name: "Back to draft", exact: true }).click()
    await preview().waitFor({ state: "hidden" })
    await related().getByRole("combobox", { name: "Search within", exact: true }).filter({ hasText: secondScope }).waitFor()
    assert.equal(await page.locator("#decision").inputValue(), "Practical draft question")
    await chooseLookup("")
    assert.equal(await related().getByRole("article").count(), 0)
    await find().click(); await related().getByRole("article").waitFor()
    assert.deepEqual(semantic.at(-1).filters, {})
    await chooseLookup(scope)
    expectedFailure = true
    const failLookup = route => route.fulfill({ status: 503, json: { error: "Practical lookup failure" } })
    await page.route("**/api/decisions/memory-search", failLookup)
    await find().click(); await related().getByRole("alert").waitFor()
    const beforeLookupChange = semantic.length
    await chooseLookup(secondScope)
    assert.equal(await related().getByRole("alert").count(), 0)
    assert.equal(semantic.length, beforeLookupChange)
    await page.unroute("**/api/decisions/memory-search", failLookup)
    expectedFailure = false
    await chooseLookup(scope)
    let releaseOld, beginOld
    const oldBegun = new Promise(resolve => { beginOld = resolve }), oldHeld = new Promise(resolve => { releaseOld = resolve })
    await page.route("**/api/decisions/memory-search", async route => { beginOld(); await oldHeld; await route.fulfill({ json: match(linked) }) })
    await find().click(); await oldBegun
    await chooseLookup(secondScope)
    await page.route("**/api/decisions/memory-search", route => route.fulfill({ json: match(named) }))
    await find().click(); await related().getByText(named.title, { exact: true }).waitFor()
    releaseOld(); await page.waitForLoadState("networkidle")
    assert.equal(await related().getByText(linked.title, { exact: true }).count(), 0)
    await addScope("Practical third scope")
    await related().getByRole("combobox", { name: "Search within", exact: true }).filter({ hasText: secondScope }).waitFor()
    assert.equal(await related().getByRole("article").count(), 0)
    const beforeReset = semantic.length
    await page.getByRole("button", { name: `Remove scope ${secondScope}`, exact: true }).click()
    await page.getByRole("button", { name: "Remove scope Practical third scope", exact: true }).click()
    await find().click(); await related().getByRole("article").waitFor()
    assert.deepEqual(semantic.at(-1).filters, { appliesTo: scope })
    assert.equal(semantic.length, beforeReset + 1)
    await page.screenshot({ path: "/private/tmp/decision-practical-lookup-mobile.png", animations: "disabled" })
    await page.getByRole("button", { name: "Discard draft", exact: true }).click()
    console.log("Practical multi-scope lookup passed: independent selector, debounced automatic local lookup, preview retention, reset and out-of-order rejection")

    await page.setViewportSize({ width: 1440, height: 1000 })
    const reviewBody = proposal => ({ proposal, appliesTo: scope, method: "LOCAL", coverage: { indexed: 2, total: 2, retrieved: 1, omittedSuccessors: 0, excerpted: false }, evidence: [{ decisionId: linked.id, decisionKey: linked.decisionKey, title: linked.title, status: "SUPERSEDED", appliesTo: [scope], role: "MATCH", inScope: true, currentIds: [current.id], replacements: [{ decisionId: current.id, decisionKey: current.decisionKey, reason: "Synthetic replacement" }], excerpts: [{ id: "stored-why", decisionId: linked.id, field: "why", label: "Why", text: "Stored rationale" }], excerpted: false }], analysis: { status: "NOT_REQUESTED", assessment: null, message: "Stored local evidence; no judgment.", findings: [] } })
    let reviewFailure = false
    await page.route("**/api/decisions/check-proposal", route => route.fulfill(reviewFailure ? { status: 503, json: { error: "Practical provider unavailable" } } : { json: reviewBody(route.request().postDataJSON().proposal) }))
    const pendingUrl = "/?tag=practical-ui&status=PENDING&sort=DEADLINE"
    await go(pendingUrl)
    await row(pending).getByRole("button", { name: "Record decision", exact: true }).click()
    assert.equal(await dialog().getByRole("button", { name: "Review this choice", exact: true }).isDisabled(), true)
    await dialog().getByLabel("What did you decide?").fill(" a ")
    assert.equal(await dialog().getByRole("button", { name: "Review this choice", exact: true }).isDisabled(), true)
    await dialog().getByLabel("What did you decide?").fill(" a b ")
    assert.equal(await dialog().getByRole("button", { name: "Review this choice", exact: true }).isDisabled(), true, "Whitespace does not count toward the three-character minimum")
    await dialog().getByLabel("What did you decide?").fill(input)
    await dialog().getByLabel("Why (optional)").fill(rationale)
    const beforeReviewWrites = writes.length, beforeReviewCalls = reviews.length
    await page.evaluate(() => { Storage.prototype.getItem = function () { throw new DOMException("Denied", "SecurityError") }; Storage.prototype.setItem = function () { throw new DOMException("Denied", "SecurityError") } })
    await dialog().getByRole("button", { name: "Review this choice", exact: true }).click()
    await page.waitForURL("**/#/check-proposal")
    assert.equal(await page.getByLabel("What are you proposing?").inputValue(), input)
    await page.getByRole("combobox", { name: "Applies To", exact: true }).filter({ hasText: scope }).waitFor()
    assert.equal(writes.length, beforeReviewWrites); assert.equal(reviews.length, beforeReviewCalls)
    await page.getByLabel("What are you proposing?").fill("Review edits must not replace completion")
    await page.goBack(); await assertCompletion()
    assert.deepEqual(params(), Object.fromEntries(new URLSearchParams(pendingUrl.split("?")[1])))
    await dialog().getByRole("button", { name: "Review this choice", exact: true }).click()
    await page.waitForURL("**/#/check-proposal")
    await page.reload({ waitUntil: "networkidle" })
    await page.getByLabel("What are you proposing?").fill("Review-only edit after reload")
    reviewFailure = true; expectedFailure = true
    await page.getByRole("button", { name: "Analyze with Gemini", exact: true }).click()
    await page.getByRole("alert").filter({ hasText: "Practical provider unavailable" }).waitFor()
    await page.route(`**/api/decisions/${pending.id}`, route => route.fulfill({ status: 503, json: { error: "Practical restore failure" } }))
    await page.getByRole("button", { name: "Back to completion", exact: true }).click()
    await page.getByRole("alert").filter({ hasText: "Could not reopen completion" }).waitFor()
    await page.reload({ waitUntil: "networkidle" })
    await page.getByRole("alert").filter({ hasText: "Could not reopen completion" }).waitFor()
    await page.unroute(`**/api/decisions/${pending.id}`)
    await page.getByRole("button", { name: "Retry completion", exact: true }).click(); await assertCompletion()
    reviewFailure = false; expectedFailure = false
    await dialog().getByRole("button", { name: "Review this choice", exact: true }).click()
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    await page.getByRole("button", { name: "Return to completion", exact: true }).waitFor()
    assert.equal(await page.getByRole("link", { name: "Record this choice", exact: true }).count(), 0)
    await page.getByRole("article", { name: linked.decisionKey, exact: true }).getByRole("link", { name: linked.title, exact: true }).click()
    await page.waitForURL(`**/#/decisions/${linked.id}`)
    await page.getByRole("button", { name: "Back to decisions", exact: true }).click()
    await page.waitForURL("**/#/check-proposal")
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    await page.getByRole("link", { name: "Compare before and after", exact: true }).first().click()
    await page.getByRole("heading", { name: "Compare decisions", exact: true, level: 1 }).waitFor()
    await page.getByRole("button", { name: "Back", exact: true }).click()
    await page.waitForURL("**/#/check-proposal")
    await page.getByRole("button", { name: "Back to completion", exact: true }).click(); await assertCompletion()
    assert.equal(writes.length, beforeReviewWrites)
    await page.screenshot({ path: "/private/tmp/decision-practical-completion-desktop.png", animations: "disabled" })
    expectedFailure = true
    await page.route(`**/api/decisions/${pending.id}/decide`, route => route.fulfill({ status: 503, json: { error: "Practical completion retry" } }))
    await dialog().getByRole("button", { name: "Record decision", exact: true }).click()
    await dialog().getByRole("alert").filter({ hasText: "Practical completion retry" }).waitFor(); await assertCompletion()
    await page.unroute(`**/api/decisions/${pending.id}/decide`)
    expectedFailure = false
    const completedResponse = page.waitForResponse(r => r.url().endsWith(`/${pending.id}/decide`) && r.request().method() === "POST")
    await dialog().getByRole("button", { name: "Record decision", exact: true }).click()
    const completed = await (await completedResponse).json()
    await dialog().waitFor({ state: "hidden" })
    await row(pending).waitFor({ state: "hidden" })
    assert.equal(completed.outcome, input.trim()); assert.equal(completed.title, pending.title)
    assert.equal(completed.why, rationale.trim()); assert.equal(completed.context, pending.context)
    assert.deepEqual(completed.appliesTo, pending.appliesTo); assert.deepEqual(completed.tags, pending.tags)
    assert.equal(completed.owner.id, pending.owner.id); assert.equal(completed.dueDate, pending.dueDate)
    assert.equal(completed.references[0].url, pending.references[0].url)
    await page.reload({ waitUntil: "networkidle" })
    assert.equal(await dialog().count(), 0, "Successful completion leaves no resurrecting state")

    // Kanban and detail use the same dialog. Include zero/multiple scope behavior,
    // cancellation, identity mismatch, and a concurrent completion outside the UI.
    for (const [surface, scopes] of [["kanban", []], ["detail", [scope, secondScope]], ["flat-concurrent", [scope]]]) {
      const question = await create({ title: `Practical ${surface} pending`, decisionState: "PENDING", appliesTo: scopes })
      await go(surface === "detail" ? `/decisions/${question.id}` : surface === "kanban" ? `${pendingUrl}&view=kanban` : pendingUrl)
      const source = surface === "detail" ? page : row(question)
      await source.getByRole("button", { name: "Record decision", exact: true }).click()
      await dialog().getByLabel("What did you decide?").fill(input)
      await dialog().getByLabel("Why (optional)").fill(rationale)
      await dialog().getByRole("button", { name: "Review this choice", exact: true }).click()
      await page.waitForURL("**/#/check-proposal")
      await page.getByRole("combobox", { name: "Applies To", exact: true }).filter({ hasText: scopes.length === 1 ? scope : "All scopes" }).waitFor()
      assert.equal(await page.getByRole("button", { name: "Analyze with Gemini", exact: true }).isDisabled(), scopes.length !== 1)
      if (surface !== "kanban") {
        const r = await page.request.post(`${api}/decisions/${question.id}/decide`, { data: { outcome: "Choice from another actor" } })
        assert.equal(r.ok(), true)
      }
      await page.getByRole("button", { name: "Back to completion", exact: true }).click(); await assertCompletion()
      if (surface !== "kanban") {
        expectedFailure = true
        await dialog().getByRole("button", { name: "Record decision", exact: true }).click()
        await dialog().getByRole("link", { name: "Open recorded decision to edit", exact: true }).waitFor(); await assertCompletion()
        assert.equal((await (await page.request.get(`${api}/decisions/${question.id}`)).json()).outcome, "Choice from another actor")
        expectedFailure = false
      }
      const beforeCancel = writes.length
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({ path: "/private/tmp/decision-practical-completion-mobile.png", animations: "disabled" })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await dialog().getByRole("button", { name: "Cancel", exact: true }).click()
      await page.reload({ waitUntil: "networkidle" })
      assert.equal(await dialog().count(), 0)
      await page.goBack()
      await page.reload({ waitUntil: "networkidle" })
      assert.equal(await dialog().count(), 0, "Dismissed snapshot is absent from the original history entry")
      assert.ok(!page.url().endsWith("/check-proposal"), "Dismissal drops forward review entries")
      assert.equal(writes.length, beforeCancel)
      await page.setViewportSize({ width: 1440, height: 1000 })
    }
    const identityQuestion = await create({ title: "Practical identity-bound question", decisionState: "PENDING" })
    for (const mismatch of ["user", "workspace", "record"]) {
      await page.unroute("**/api/metadata")
      await page.route("**/api/metadata", route => route.fulfill({ json: metadata }))
      await go(`/decisions/${identityQuestion.id}`)
      await page.getByRole("button", { name: "Record decision", exact: true }).click()
      await dialog().getByLabel("What did you decide?").fill(input)
      await dialog().getByRole("button", { name: "Review this choice", exact: true }).click()
      await page.waitForURL("**/#/check-proposal")
      if (mismatch === "record") await page.route(`**/api/decisions/${identityQuestion.id}`, route => route.fulfill({ json: unassigned }))
      else await page.route("**/api/metadata", route => route.fulfill({ json: mismatch === "user" ? { ...metadata, currentUser: { ...metadata.currentUser, id: "other-user" } } : { ...metadata, workspace: { ...metadata.workspace, id: "other-workspace" } } }))
      await page.getByRole("button", { name: "Back to completion", exact: true }).click()
      await page.getByRole("alert").filter({ hasText: "another signed-in context" }).waitFor()
      assert.equal(await dialog().count(), 0)
      await page.unroute(`**/api/decisions/${identityQuestion.id}`)
      assert.equal((await (await page.request.get(`${api}/decisions/${identityQuestion.id}`)).json()).decisionState, "PENDING")
    }
    assert.equal(await page.locator("vite-error-overlay").count(), 0)
    assert.deepEqual(errors, [])
    console.log("Practical completion review passed: all surfaces, raw input/history/reload/provider errors, no implicit writes, detours, explicit save/retry, identity isolation and concurrent conflict")
  } catch (error) {
    console.error("Practical failure:", page.url(), await page.locator("body").innerText())
    await page.screenshot({ path: "/private/tmp/decision-practical-failure.png", animations: "disabled" })
    throw error
  } finally {
    releaseSearch?.()
    await page.unrouteAll({ behavior: "ignoreErrors" })
    await context.close()
    for (const id of created) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  }
}

export async function verifyRefinedDiscoveryUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:5173" })
  const page = await context.newPage()
  const api = "http://localhost:3011/api", base = "http://localhost:5173/#"
  const created = [], errors = [], calls = [], writes = []
  let expectedFailure = false, detailReads = 0, hold = null, matches = [], failSearch = false
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error" && !expectedFailure) errors.push(message.text()) })
  page.on("request", request => {
    if (/\/api\/decisions\/[\da-f-]+$/.test(request.url()) && request.method() === "GET") detailReads++
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !request.url().endsWith("memory-search")) writes.push(request.url())
  })
  const create = async input => {
    const response = await page.request.post(`${api}/decisions`, { data: { title: "Refined discovery fixture", tags: ["refined-discovery"], ...input } })
    assert.equal(response.status(), 201)
    const decision = await response.json(); created.push(decision.id); return decision
  }
  const related = () => page.getByRole("region", { name: "Related decisions", exact: true })
  const find = () => related().getByRole("button", { name: "Find related decisions", exact: true })
  const primary = () => page.locator("#decision")
  const addScope = async value => {
    await page.getByRole("combobox", { name: "Applies To", exact: true }).fill(value)
    const existing = page.getByRole("option", { name: value, exact: true })
    if (await existing.count()) await existing.click()
    else await page.getByRole("option", { name: `Add “${value}”`, exact: true }).click()
  }
  const choose = async value => {
    await related().getByRole("combobox", { name: "Search within", exact: true }).click()
    await page.getByRole("option", { name: value || "All scopes", exact: true }).click()
  }
  const scopeLabel = value => related().getByRole("combobox", { name: "Search within", exact: true }).filter({ hasText: value || "All scopes" })
  const waitCards = count => page.waitForFunction(count => document.querySelectorAll('section[aria-label="Related decisions"] article').length === count, count)
  const a = "Refined scope A, exact", b = "Refined scope B", c = "Refined scope C"
  try {
    for (let i = 0; i < 5; i++) matches.push(await create({ title: `Refined choice ${i + 1}`, why: `Long stored rationale ${i + 1}`, appliesTo: [a] }))
    // Preserve the actual availability field used by the application.
    await page.route("**/api/metadata", async route => { const response = await route.fetch(); const data = await response.json(); await route.fulfill({ response, json: { ...data, features: { ...data.features, memorySearch: true } } }) })
    await page.route("**/api/decisions/memory-search", async route => {
      const request = route.request().postDataJSON(); calls.push(request)
      assert.equal(request.method, "LOCAL")
      const responseMatches = [...matches], pending = hold
      if (pending) { pending.started(); await pending.promise }
      await route.fulfill(failSearch ? { status: 503, json: { error: "Refined local failure" } } : { json: { method: "LOCAL", candidateCount: 5, totalCandidateCount: 8, truncated: true, matches: responseMatches.map(decision => ({ decisionId: decision.id, decision, score: 90 })) } })
    })
    await page.goto(`${base}/decisions/new`)
    await page.getByRole("heading", { name: "New Decision", exact: true }).waitFor()
    await addScope(a); await addScope(b); await choose(b)
    await primary().fill("Refined question")
    await waitCards(2)
    assert.deepEqual(calls.at(-1), { method: "LOCAL", query: "Refined question", filters: { appliesTo: b } })
    assert.equal(detailReads, 0, "Compact suggestions do not fetch full detail")
    assert.equal(await related().getByText("Long stored rationale", { exact: false }).count(), 0)
    await related().getByText(/Remaining records are waiting for local indexing/).waitFor()
    const beforeToggle = calls.length
    const expand = related().getByRole("button", { name: "Show all 5 related decisions", exact: true })
    assert.equal(await expand.getAttribute("aria-expanded"), "false")
    await expand.focus(); await page.keyboard.press("Enter"); await waitCards(5)
    assert.deepEqual(await related().getByRole("article").locator("p.font-medium").allTextContents(), matches.map(row => row.title))
    assert.equal(await related().getByRole("button", { name: "Show fewer", exact: true }).getAttribute("aria-expanded"), "true")
    assert.equal(calls.length, beforeToggle)
    await primary().fill("Refined edited question")
    assert.equal(await related().getByRole("article").count(), 0, "Previous query results clear immediately")
    await scopeLabel(b).waitFor(); await waitCards(5)
    assert.equal(calls.at(-1).filters.appliesTo, b)
    await addScope(c); await scopeLabel(b).waitFor(); await waitCards(5)
    await choose(""); await waitCards(5)
    await primary().fill("Refined all scopes question"); await scopeLabel("").waitFor(); await waitCards(5)
    assert.deepEqual(calls.at(-1).filters, {})
    await choose(b); await waitCards(5)
    const beforePreview = calls.length
    await related().getByRole("button", { name: `Preview ${matches[0].decisionKey}`, exact: true }).click()
    const preview = page.getByRole("dialog", { name: "Decision preview", exact: true })
    await preview.getByText(matches[0].why, { exact: true }).waitFor()
    await preview.getByRole("button", { name: "Copy link", exact: true }).click()
    await page.getByText("Decision link copied.", { exact: true }).waitFor()
    const link = `${base}/decisions/${matches[0].id}`
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link)
    await page.keyboard.press("Escape"); await preview.waitFor({ state: "hidden" }); await scopeLabel(b).waitFor()
    assert.equal(calls.length, beforePreview)
    await page.getByRole("button", { name: `Remove scope ${b}`, exact: true }).click()
    await scopeLabel("").waitFor(); await waitCards(5)
    await page.getByRole("button", { name: `Remove scope ${c}`, exact: true }).click()
    await waitCards(5); assert.deepEqual(calls.at(-1).filters, { appliesTo: a })
    await page.getByRole("button", { name: `Remove scope ${a}`, exact: true }).click()
    await waitCards(5); assert.deepEqual(calls.at(-1).filters, {})

    // Slow old replies cannot publish after the text changes; rapid typing debounces.
    let releaseOld, started
    const begun = new Promise(resolve => { started = resolve })
    hold = { promise: new Promise(resolve => { releaseOld = resolve }), started }
    await primary().fill("Refined old held query"); await begun
    matches = [matches[4]]; hold = null
    const beforeTyping = calls.length
    await primary().fill("Refined new")
    await primary().pressSequentially(" question", { delay: 30 })
    assert.equal(await related().getByRole("article").count(), 0)
    await waitCards(1)
    assert.equal(calls.length, beforeTyping + 1, "Typing produces one debounced lookup")
    assert.equal(calls.at(-1).query, "Refined new question")
    releaseOld(); await page.waitForTimeout(150)
    await waitCards(1)
    assert.equal(await related().getByRole("button", { name: "Show fewer", exact: true }).count(), 0)
    const beforeManual = calls.length
    await primary().fill("Refined manual before debounce")
    await find().click(); await waitCards(1); await page.waitForTimeout(850)
    assert.equal(calls.length, beforeManual + 1, "Manual lookup consumes the scheduled automatic lookup")
    assert.equal(await related().getByRole("button", { name: /Show all/ }).count(), 0)
    matches = []; await primary().fill("Refined zero matches")
    await related().getByText("No related decisions were found in the searched records.", { exact: true }).waitFor()
    assert.equal(await related().getByRole("button", { name: /Show all|Show fewer/ }).count(), 0)
    expectedFailure = true; failSearch = true
    await primary().fill("Refined failure query"); await related().getByRole("alert").waitFor()
    failSearch = false; expectedFailure = false
    matches = [await (await page.request.get(`${api}/decisions/${created[0]}`)).json(), await (await page.request.get(`${api}/decisions/${created[1]}`)).json()]
    await find().click(); await waitCards(2)
    assert.equal(await related().getByRole("button", { name: /Show all|Show fewer/ }).count(), 0)
    matches = await Promise.all(created.slice(0, 5).map(async id => (await page.request.get(`${api}/decisions/${id}`)).json()))
    await primary().fill("Refined expanded preference returns"); await waitCards(5)
    await related().getByRole("button", { name: "Show fewer", exact: true }).click(); await waitCards(2)
    await addScope(a); await addScope(b); await choose(b)
    await primary().fill("Refined collapsed preference remains"); await waitCards(2); await scopeLabel(b).waitFor()
    await page.getByRole("button", { name: "Already decided", exact: true }).click()
    await primary().fill("Refined final choice"); await waitCards(2); await scopeLabel("").waitFor()
    assert.deepEqual(calls.at(-1).filters, {}, "Creation mode resets the lookup scope")
    await related().evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - 76, behavior: "instant" }))
    await page.screenshot({ path: "/private/tmp/decision-refined-related-desktop.png", animations: "disabled" })
    await page.setViewportSize({ width: 390, height: 844 })
    await related().evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - 76, behavior: "instant" }))
    await page.screenshot({ path: "/private/tmp/decision-refined-related-mobile.png", animations: "disabled" })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await primary().inputValue(), "Refined final choice")
    assert.deepEqual(writes, [], "Lookup, expansion, preview and copying do not mutate or invoke cloud analysis")
    await choose(b); await waitCards(2)
    await related().getByRole("button", { name: "Show all 5 related decisions", exact: true }).click(); await waitCards(5)
    expectedFailure = true
    const failSave = route => route.request().method() === "POST" ? route.fulfill({ status: 503, json: { error: "Refined save failure" } }) : route.continue()
    await page.route("**/api/decisions", failSave)
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    await page.getByText("Refined save failure", { exact: true }).waitFor()
    await scopeLabel(b).waitFor(); await waitCards(5)
    assert.equal(await primary().inputValue(), "Refined final choice")
    await page.unroute("**/api/decisions", failSave)
    expectedFailure = false
    await page.getByRole("button", { name: "Discard draft", exact: true }).click()
    await page.goto(base)
    await page.getByRole("heading", { name: "Decision Library", exact: true }).waitFor()
    await page.goto(`${base}/decisions/new`); await primary().fill("Refined fresh visit")
    await waitCards(2)
    assert.equal(await related().getByRole("button", { name: "Show all 5 related decisions", exact: true }).getAttribute("aria-expanded"), "false")
    await page.getByRole("button", { name: "Discard draft", exact: true }).click()

    await page.goto(link)
    await page.getByRole("heading", { name: "Refined choice 1", exact: true, level: 1 }).waitFor()
    // Pending-only scope surfaces link to existing library; completion refreshes counts.
    const scope = "Refined pending, exact & scope"
    const question = await create({ title: "Refined outstanding question", decisionState: "PENDING", appliesTo: [scope] })
    await page.goto(`${base}/scopes`)
    const directoryLink = page.getByRole("link", { name: scope, exact: true })
    await directoryLink.waitFor()
    assert.ok(!(await directoryLink.locator("xpath=../..").innerText()).includes("Latest recorded"))
    await directoryLink.click()
    await page.getByText("No recorded choices yet", { exact: true }).waitFor()
    const pending = page.getByRole("link", { name: "Pending questions (1)", exact: true })
    assert.equal(await pending.getAttribute("href"), `#/?${new URLSearchParams({ appliesTo: scope, status: "PENDING" })}`)
    await pending.focus(); await page.keyboard.press("Enter")
    await page.getByRole("link", { name: question.title, exact: true }).waitFor()
    assert.equal(await page.locator(".decision-row").count(), 1)
    await page.request.post(`${api}/decisions/${question.id}/decide`, { data: { outcome: "Refined recorded answer" } })
    await page.goto(`${base}/scopes?${new URLSearchParams({ scope })}`)
    await page.getByRole("region", { name: "Active decisions", exact: true }).getByText("Refined recorded answer", { exact: true }).waitFor()
    assert.equal(await page.getByRole("link", { name: /^Pending questions/ }).count(), 0)
    await page.getByText("1 recorded in this scope", { exact: true }).waitFor()
    await page.screenshot({ path: "/private/tmp/decision-refined-scope-mobile.png", animations: "disabled" })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await page.title(), "Decision Memory")
    assert.equal(await page.locator("vite-error-overlay").count(), 0)
    assert.deepEqual(errors, [])
    console.log("Refined discovery passed: stable exact/all scope, debounce/manual dedup/stale responses, compact expansion/preference, preview/link, pending scope navigation/completion and mobile")
  } catch (error) {
    console.error("Refined discovery failure", page.url(), await page.locator("body").innerText())
    await page.screenshot({ path: "/private/tmp/decision-refined-failure.png", animations: "disabled" })
    throw error
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" }); await context.close()
    for (const id of created) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  }
}
