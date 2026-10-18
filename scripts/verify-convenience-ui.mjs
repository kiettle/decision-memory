import assert from "node:assert/strict"

export async function verifyConvenienceUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = [], created = [], calls = []
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)")) errors.push(message.text())
  })
  page.on("request", request => {
    if (request.method() === "POST" && /memory-search|check-proposal/.test(request.url())) calls.push(request.postDataJSON())
  })
  const base = "http://localhost:5173/#"
  const api = "http://localhost:3011/api"
  const scope = "UX proof, migration"
  const chips = () => page.locator('[data-slot="combobox-chip"]')
  const scopeInput = () => page.getByRole("combobox", { name: "Applies To", exact: true })
  const queryParams = () => new URLSearchParams(page.url().split("?")[1] ?? "")
  async function record(input) {
    const response = await page.request.post(`${api}/decisions`, { data: { title: "UX proof choice", decisionState: "DECIDED", outcome: "UX proof choice", appliesTo: [scope], ...input } })
    assert.equal(response.ok(), true)
    const saved = await response.json(); created.push(saved.id); return saved
  }
  async function save() {
    const response = page.waitForResponse(r => /\/api\/decisions(?:\/[^/?]+)?$/.test(r.url()) && ["POST", "PUT"].includes(r.request().method()))
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    const result = await response
    assert.equal(result.ok(), true)
    const saved = await result.json()
    if (!created.includes(saved.id)) created.push(saved.id)
    await page.getByRole("heading", { name: saved.outcome ?? saved.title, exact: true }).waitFor()
    return saved
  }
  async function chooseScope(name, add = false) {
    await scopeInput().fill(name)
    await page.getByRole("option", { name: add ? `Add “${name}”` : name, exact: true }).click()
    await page.keyboard.press("Escape")
    await page.locator('[data-slot="combobox-content"]').waitFor({ state: "detached" })
  }
  async function selectFilter(label, search, option) {
    const detailed = label !== "Applies To"
    if (detailed) await page.getByRole("button", { name: /^More filters/ }).click()
    await page.getByRole("combobox", { name: label, exact: true }).click()
    await page.getByRole("combobox", { name: `Search ${label.toLowerCase()}`, exact: true }).fill(search)
    await page.getByRole("option", { name: option, exact: true }).click()
    await page.locator('[data-slot="combobox-content"]').waitFor({ state: "detached" })
    if (detailed) {
      await page.getByRole("button", { name: "Close", exact: true }).click()
      await page.getByRole("dialog", { name: "More filters", exact: true }).waitFor({ state: "detached" })
    }
  }
  try {
    const source = await record({ why: "Synthetic scope-navigation fixture" })
    const countBeforeCancel = await models.Decision.count({ where: { workspaceId: workspace.id } })
    const scopeUrl = `${base}/scopes?${new URLSearchParams({ scope })}`
    await page.goto(scopeUrl)
    await page.getByRole("button", { name: "New decision in this scope", exact: true }).click()
    const question = page.getByLabel("What needs to be decided?")
    await question.waitFor()
    await page.waitForFunction(() => document.activeElement?.id === "decision")
    assert.deepEqual(await chips().allTextContents(), [scope])
    assert.equal(await page.locator("details").getAttribute("open"), null)
    assert.equal(await chips().first().isVisible(), true, "Scope is visible outside More details")
    await page.getByRole("button", { name: "Cancel", exact: true }).click()
    assert.equal(page.url(), scopeUrl)
    assert.equal(await models.Decision.count({ where: { workspaceId: workspace.id } }), countBeforeCancel)

    await page.route("**/api/metadata", route => route.fulfill({ status: 503, json: { error: "Unavailable for verification" } }))
    await page.getByRole("button", { name: "New decision in this scope", exact: true }).click()
    await page.getByRole("heading", { name: "Could not load Decision form" }).waitFor()
    await page.unroute("**/api/metadata")
    await page.getByRole("button", { name: "Try again", exact: true }).click()
    await question.waitFor()
    assert.deepEqual(await chips().allTextContents(), [scope], "Form retry retains prefilled scope")
    await question.fill("UX proof pending question")
    const savedPending = await save()
    assert.equal(savedPending.decisionState, "PENDING")
    assert.deepEqual(savedPending.appliesTo, [scope])
    await page.getByText("Back to decisions", { exact: true }).click()
    assert.equal(page.url(), scopeUrl)

    await page.route("**/api/metadata", route => route.fulfill({ status: 503, json: { error: "Unavailable for verification" } }))
    await page.getByRole("button", { name: "Check a proposal in this scope", exact: true }).click()
    const proposal = page.getByLabel("What are you proposing?")
    await proposal.waitFor()
    assert.equal(await proposal.inputValue(), "")
    assert.equal(await proposal.evaluate(el => el === document.activeElement), true)
    assert.equal(await scopeInput().innerText(), scope)
    await proposal.fill("UX proof: revise migration storage")
    await page.getByRole("button", { name: "Retry scopes", exact: true }).waitFor()
    await page.unroute("**/api/metadata")
    await page.getByRole("button", { name: "Retry scopes", exact: true }).click()
    await page.getByRole("button", { name: "Retry scopes", exact: true }).waitFor({ state: "detached" })
    assert.equal(await scopeInput().innerText(), scope)
    assert.equal(await proposal.inputValue(), "UX proof: revise migration storage")
    assert.equal(calls.length, 0, "Scope-prefilled actions do not request retrieval or AI")
    await page.getByRole("link", { name: "Back to scope", exact: true }).click()
    assert.equal(page.url(), scopeUrl)
    await page.goBack()
    assert.equal(await proposal.inputValue(), "UX proof: revise migration storage")

    // Local checking plus cancellation preserves the nested proposal origin.
    await page.getByRole("button", { name: "Check locally", exact: true }).click()
    await page.getByRole("link", { name: "Record this choice", exact: true }).waitFor()
    await page.getByRole("link", { name: "Record this choice", exact: true }).click()
    await page.getByLabel("What did you decide?").waitFor()
    assert.deepEqual(await chips().allTextContents(), [scope])
    await page.getByRole("button", { name: "Cancel", exact: true }).click()
    assert.equal(await proposal.inputValue(), "UX proof: revise migration storage")
    assert.equal(await scopeInput().innerText(), scope)
    await page.getByRole("link", { name: "Back to scope", exact: true }).click()
    assert.equal(page.url(), scopeUrl)

    console.log("Scope navigation and cancellation passed")
    // Selection, deliberate creation, comma preservation, keyboard and validation.
    await page.goto(`${base}/decisions/new`)
    await question.fill("UX proof multiple scopes")
    await chooseScope(scope)
    await chooseScope("New scope, with commas", true)
    await scopeInput().fill("New scope, with commas")
    assert.equal(await page.getByRole("option", { name: 'Add “New scope, with commas”', exact: true }).count(), 0)
    await scopeInput().fill("x".repeat(201))
    await page.getByText("Use 200 characters or fewer for a scope.").waitFor()
    assert.equal(await page.getByRole("option", { name: /^Add / }).count(), 0)
    await scopeInput().fill("Keyboard scope")
    await scopeInput().press("ArrowDown"); await scopeInput().press("Enter")
    await page.getByRole("button", { name: "Remove scope Keyboard scope", exact: true }).waitFor()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Remove scope Keyboard scope", exact: true }).click()
    assert.deepEqual(await chips().allTextContents(), [scope, "New scope, with commas"])
    await question.click()
    await page.locator('[data-slot="combobox-content"]').waitFor({ state: "detached" })
    await page.screenshot({ path: "/private/tmp/decision-memory-scopes-form-desktop.png", fullPage: true })
    const savedMulti = await save()
    assert.deepEqual(savedMulti.appliesTo, [scope, "New scope, with commas"])
    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await scopeInput().waitFor()
    assert.deepEqual(await chips().allTextContents(), savedMulti.appliesTo)
    const edited = await save()
    assert.deepEqual(edited.appliesTo, savedMulti.appliesTo, "Editing never splits comma-containing scopes")

    const thirty = Array.from({ length: 30 }, (_, i) => `UX limit ${i}`)
    const limitRecord = await record({ appliesTo: thirty })
    await page.goto(`${base}/decisions/${limitRecord.id}/edit`)
    await scopeInput().fill("One more scope")
    assert.equal(await page.getByRole("option", { name: 'Add “One more scope”', exact: true }).getAttribute("aria-disabled"), "true")
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Remove scope UX limit 0", exact: true }).click()
    const longScope = "UX long " + "a".repeat(192)
    await chooseScope(longScope, true)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(200)
    const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => `${el.tagName}.${el.className}`).slice(0, 6) }))
    assert.equal(overflow.scrollWidth <= overflow.width, true, JSON.stringify(overflow))
    const limitSaved = await save()
    assert.equal(limitSaved.appliesTo.length, 30)
    assert.ok(limitSaved.appliesTo.includes(longScope))

    console.log("Scope selection, edit preservation and limits passed")
    // Exact quick-filter mappings preserve the existing URL context.
    await page.setViewportSize({ width: 1440, height: 1000 })
    const other = { q: "migration", appliesTo: scope, tag: "storage", channel: "platform-decisions", ownerId: "name:Someone", dateRange: "30", view: "kanban", sort: "DEADLINE" }
    await page.goto(`${base}/?${new URLSearchParams({ ...other, status: "ACTIVE" })}`)
    const quick = page.getByRole("group", { name: "Quick filters", exact: true })
    await quick.waitFor()
    assert.equal(await quick.getByRole("button", { name: "Current choices", exact: true }).getAttribute("aria-pressed"), "true")
    const beforeQuick = calls.length
    for (const [label, status, deadline] of [["Overdue", "PENDING", "OVERDUE"], ["Due soon", "PENDING", "DUE_SOON"], ["Pending", "PENDING", null], ["Current choices", "DECIDED", null]]) {
      await quick.getByRole("button", { name: label, exact: true }).click()
      const params = queryParams()
      assert.equal(params.get("status"), status); assert.equal(params.get("deadline"), deadline)
      for (const [key, value] of Object.entries(other)) assert.equal(params.get(key), value, `${label} preserves ${key}`)
      await quick.getByRole("button", { name: label, exact: true }).click()
      assert.equal(queryParams().get("status"), status, "Clicking selected shortcut does not clear it")
    }
    assert.equal(calls.length, beforeQuick)
    await page.reload()
    await page.getByRole("button", { name: "Remove Applies To filter", exact: true }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Remove Applies To filter", exact: true }).innerText(), `Applies To: ${scope}`)
    await page.getByRole("button", { name: "Remove Tag filter", exact: true }).click()
    assert.equal(queryParams().get("tag"), null)
    assert.equal(queryParams().get("appliesTo"), scope)
    await page.getByRole("button", { name: "Clear filters", exact: true }).filter({ visible: true }).click()
    assert.deepEqual(Object.fromEntries(queryParams()), { q: "migration", view: "kanban", sort: "DEADLINE" })

    console.log("Quick-filter URL mappings and chip removal passed")
    // Searchable filter controls, mobile sheet, long-value chips and empty options.
    await page.goto(`${base}/`)
    await selectFilter("Applies To", "UX proof,", scope)
    await selectFilter("Owner", "Maya", "Maya Chen")
    await selectFilter("Tag", "stor", "storage")
    await selectFilter("Channel", "platform", "#platform-decisions")
    await page.getByRole("combobox", { name: "Applies To", exact: true }).click()
    const searchScopes = page.getByRole("combobox", { name: "Search applies to", exact: true })
    await searchScopes.fill("no-such-scope-xyz")
    await page.getByText("No matching options.", { exact: true }).waitFor()
    await page.keyboard.press("Escape")
    await page.locator('[data-slot="combobox-content"]').waitFor({ state: "detached" })
    await page.screenshot({ path: "/private/tmp/decision-memory-filters-desktop.png", fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await selectFilter("Applies To", "UX long", longScope)
    await page.getByRole("button", { name: /^More filters/ }).click()
    await page.getByRole("combobox", { name: "Owner", exact: true }).waitFor()
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await page.getByRole("dialog", { name: "More filters", exact: true }).waitFor({ state: "detached" })
    await page.getByRole("button", { name: "Remove Applies To filter", exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: "/private/tmp/decision-memory-filters-mobile-long-scope.png", fullPage: true })
    await page.getByRole("button", { name: "Remove Applies To filter", exact: true }).click()
    assert.equal(queryParams().get("appliesTo"), null)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: "/private/tmp/decision-memory-filters-mobile.png", fullPage: true })
    await page.goto(`${base}/recent?${new URLSearchParams({ appliesTo: scope })}`)
    await page.getByRole("heading", { name: "Recent Decisions" }).waitFor()
    assert.equal(await page.getByRole("group", { name: "Quick filters" }).count(), 0)
    assert.equal(await page.getByRole("button", { name: "Assigned to me", exact: true }).count(), 0)
    await page.getByRole("button", { name: "Remove Applies To filter", exact: true }).waitFor()

    // Metadata failure and retry keep bookmarked values visible.
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.route("**/api/metadata", route => route.fulfill({ status: 503, json: { error: "Unavailable for verification" } }))
    await page.goto(`${base}/?${new URLSearchParams({ appliesTo: scope })}`)
    await page.getByRole("button", { name: "Retry filter options" }).waitFor()
    assert.match(await page.getByRole("button", { name: "Remove Applies To filter", exact: true }).innerText(), /UX proof, migration/)
    await page.unroute("**/api/metadata")
    await page.getByRole("button", { name: "Retry filter options" }).click()
    await page.getByRole("combobox", { name: "Applies To", exact: true }).click()
    await page.getByRole("option", { name: "Atlas migration", exact: true }).waitFor()
    await page.keyboard.press("Escape")
    assert.equal(queryParams().get("appliesTo"), scope)

    // A filter edit invalidates a pending memory response without a provider retry.
    let release, started
    const held = new Promise(resolve => { release = resolve })
    const begun = new Promise(resolve => { started = resolve })
    await page.route("**/api/metadata", async route => {
      const response = await route.fetch(), data = await response.json()
      await route.fulfill({ json: { ...data, features: { ...data.features, memorySearch: true } } })
    })
    await page.route("**/api/decisions/memory-search", async route => {
      started(); await held
      await route.fulfill({ json: { method: "LOCAL", candidateCount: 1, totalCandidateCount: 1, matches: [{ decisionId: source.id, score: 95, explanation: "STALE UX RESULT", decision: source }] } })
    })
    await page.goto(`${base}/?q=migration`)
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click(); await begun
    await quick.getByRole("button", { name: "Overdue", exact: true }).click()
    release()
    await page.waitForTimeout(250)
    assert.equal(await page.getByText("STALE UX RESULT", { exact: true }).count(), 0)
    assert.equal(await page.getByRole("button", { name: "Find by meaning", exact: true }).isDisabled(), true)
    assert.equal(await page.locator("vite-error-overlay").count(), 0)
    assert.deepEqual(errors, [])
    console.log("Convenience UI passed: exact multi-scope editing, limits, keyboard, scoped actions/returns, quick filters/chips, searchable mobile filters, metadata retry and stale-response rejection")
  } catch (error) {
    await page.screenshot({ path: "/private/tmp/decision-memory-convenience-failure.png", fullPage: true })
    console.error("Convenience failure URL:", page.url())
    throw error
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" })
    await context.close()
    for (const id of created) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  }
}

export async function verifyEverydayConvenienceUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "UTC" })
  const page = await context.newPage()
  const base = "http://localhost:5173/#"
  const api = "http://localhost:3011/api"
  const created = [], calls = [], mutations = [], errors = []
  let expectedError = false
  page.on("pageerror", e => errors.push(e.message))
  page.on("console", m => { if (m.type() === "error" && !expectedError) errors.push(m.text()) })
  page.on("request", r => {
    if (r.url().endsWith("/memory-search")) calls.push(r.postDataJSON())
    else if (["POST", "PUT"].includes(r.method()) && r.url().includes("/api/decisions")) mutations.push(r.url())
  })
  const meta = await (await page.request.get(`${api}/metadata`)).json()
  const draftKey = `decision-memory:v1:${encodeURIComponent(meta.workspace.id)}:${encodeURIComponent(meta.currentUser.id)}:form-draft:new`
  const primary = () => page.locator("#decision")
  const assigned = () => page.getByRole("button", { name: "Assigned to me", exact: true })
  const related = () => page.getByRole("region", { name: "Related decisions", exact: true })
  const findRelated = () => related().getByRole("button", { name: "Find related decisions", exact: true })
  const params = () => Object.fromEntries(new URLSearchParams(page.url().split("?")[1] ?? ""))
  const go = async path => {
    await page.goto(`${base}${path}`)
    // Hash-only setup navigation can otherwise expose the previous rows before
    // the existing keyword debounce runs. Start each fixture scenario fresh.
    await page.reload({ waitUntil: "networkidle" })
    await page.getByRole("heading", { name: path.startsWith("/decisions/new") ? "New Decision" : "Decision Library", exact: true }).waitFor()
  }
  const more = async () => {
    await page.getByRole("button", { name: /^More filters/ }).click()
    return page.getByRole("dialog", { name: "More filters", exact: true })
  }
  const close = async () => {
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await page.getByRole("dialog", { name: "More filters", exact: true }).waitFor({ state: "hidden" })
  }
  const setScope = async name => {
    await page.getByRole("combobox", { name: "Applies To", exact: true }).fill(name)
    await page.getByRole("option", { name: `Add “${name}”`, exact: true }).click()
    await page.keyboard.press("Escape")
  }
  const record = async input => {
    const r = await page.request.post(`${api}/decisions`, { data: input })
    assert.equal(r.status(), 201)
    const saved = await r.json(); created.push(saved.id); return saved
  }
  let responseBody, failSearch = false
  const searchResponse = () => ({ method: "LOCAL", candidateCount: 1, totalCandidateCount: 3, truncated: true, matches: [{ decisionId: responseBody.id, decision: responseBody, score: 90, explanation: "Stored choice", matchedConcepts: [] }] })
  try {
    await page.clock.install({ time: new Date("2026-10-16T12:00:00Z") })
    const scope = "Everyday scope, exact"
    const pending = await record({ title: "Everyday pending storage question", decisionState: "PENDING", dueDate: "2026-10-15", ownerId: meta.currentUser.id, appliesTo: [scope], tags: ["everyday-proof"], why: "Original reason", context: "Preserve this context", optionsConsidered: ["A", "B"], references: [{ kind: "URL", label: "Evidence", url: "https://example.com/preserved" }] })
    await record({ title: "Everyday second deadline question", decisionState: "PENDING", dueDate: "2026-10-20", ownerId: meta.currentUser.id, appliesTo: [scope], tags: ["everyday-proof"] })
    responseBody = await record({ title: "Everyday stored choice", why: "Stored reason only", appliesTo: [scope] })
    await page.route("**/api/metadata", route => route.fulfill({ json: { ...meta, features: { ...meta.features, memorySearch: true, geminiMemorySearch: true } } }))
    await page.route("**/api/decisions/memory-search", async route => {
      await route.fulfill(failSearch ? { status: 503, json: { error: "Synthetic local search unavailable" } } : { json: searchResponse() })
    })

    // Search options is a keyboard-accessible disclosure, never a request.
    await go("/?q=Everyday")
    assert.equal(await page.title(), "Decision Memory")
    await page.getByRole("link", { name: pending.title, exact: true }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Search with Gemini", exact: true }).isVisible(), false)
    const options = page.locator("summary").filter({ hasText: "Search options" })
    const helpTop = async () => (await page.locator("#meaning-search-help").boundingBox()).y
    const helpBefore = await helpTop()
    await options.focus(); await page.keyboard.press("Enter")
    await page.getByText(/Gemini sends your query and excerpts from up to the newest 200/).waitFor()
    assert.equal(await helpTop(), helpBefore, "Search options opens as an overlay without pushing the page down")
    await page.keyboard.press("Escape")
    assert.equal(await page.getByRole("button", { name: "Search with Gemini", exact: true }).isVisible(), false, "Escape closes Search options")
    await options.focus(); await page.keyboard.press("Enter")
    await page.getByText(/Gemini sends your query and excerpts from up to the newest 200/).waitFor()
    assert.equal(calls.length, 0)
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click()
    await page.getByText("Local semantic match", { exact: true }).first().waitFor()
    assert.deepEqual(calls[0].method, "LOCAL")
    assert.equal(calls.length, 1, "One click makes one explicit local request")
    await page.getByRole("button", { name: "Back to keyword results", exact: true }).click()
    await page.getByRole("link", { name: pending.title, exact: true }).waitFor()
    failSearch = true; expectedError = true
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click()
    await page.getByText("Synthetic local search unavailable", { exact: true }).waitFor()
    assert.equal(params().q, "Everyday")
    await page.getByRole("link", { name: pending.title, exact: true }).waitFor()
    failSearch = false; expectedError = false

    console.log("Everyday search controls passed")
    // Owner URL is the sole source of shortcut state, all other values survive.
    const inputs = { q: "Everyday", appliesTo: scope, tag: "everyday-proof", channel: "platform-decisions", dateRange: "30", sort: "DEADLINE", view: "kanban", ownerId: "name:Recorded Person" }
    await go(`/?${new URLSearchParams(inputs)}`)
    assert.equal(await page.getByRole("combobox", { name: "Owner", exact: true }).count(), 0)
    for (const [label, deadline] of [["Pending", undefined], ["Overdue", "OVERDUE"], ["Due soon", "DUE_SOON"]]) {
      await page.getByRole("group", { name: "Quick filters", exact: true }).getByRole("button", { name: label, exact: true }).click()
      await page.getByRole("group", { name: "Quick filters", exact: true }).getByRole("button", { name: label, exact: true, pressed: true }).waitFor()
      const before = params()
      await assigned().click()
      assert.deepEqual(params(), { ...before, ownerId: meta.currentUser.id })
      assert.equal(params().deadline, deadline)
      await page.getByRole("button", { name: "Assigned to me", exact: true, pressed: true }).waitFor()
      await assigned().click()
      const { ownerId, ...others } = before
      assert.deepEqual(params(), others, "Turning off clears owner instead of restoring previous owner")
    }
    let sheet = await more()
    await sheet.getByRole("combobox", { name: "Owner", exact: true }).click()
    await page.getByRole("option", { name: meta.currentUser.displayName, exact: true }).click()
    await close()
    await page.getByRole("button", { name: "Assigned to me", exact: true, pressed: true }).waitFor()
    sheet = await more()
    await sheet.getByRole("combobox", { name: "Owner", exact: true }).click()
    const otherUser = meta.users.find(user => user.id !== meta.currentUser.id)
    await page.getByRole("option", { name: otherUser.displayName, exact: true }).click()
    await close()
    await page.getByRole("button", { name: "Assigned to me", exact: true, pressed: false }).waitFor()
    await assigned().click()
    await page.getByRole("button", { name: "Assigned to me", exact: true, pressed: true }).waitFor()
    assert.equal(await page.getByRole("button", { name: "More filters (6)", exact: true }).count(), 1, "Scope is excluded from More filters count")
    await page.getByRole("button", { name: "Remove Owner filter", exact: true }).click()
    await page.getByRole("button", { name: "Assigned to me", exact: true, pressed: false }).waitFor()
    sheet = await more()
    for (const label of ["Channel", "Owner", "Tag", "Status", "Deadline", "Created date"]) await sheet.getByRole("combobox", { name: label, exact: true }).waitFor()
    await page.screenshot({ path: "/private/tmp/decision-everyday-filters-desktop.png", fullPage: false, animations: "disabled" })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await sheet.evaluate(el => el.getBoundingClientRect().height <= innerHeight), true)
    await page.screenshot({ path: "/private/tmp/decision-everyday-filters-mobile.png", fullPage: false, animations: "disabled" })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await sheet.getByRole("combobox", { name: "Status", exact: true }).click()
    await page.getByRole("option", { name: "Superseded", exact: true }).waitFor()
    await page.keyboard.press("Escape"); await close()
    await page.getByRole("button", { name: "Clear filters", exact: true }).click()
    assert.deepEqual(params(), { q: "Everyday", sort: "DEADLINE", view: "kanban" })
    await page.getByRole("button", { name: "Assigned to me", exact: true, pressed: false }).waitFor()
    const beforeSaved = calls.length
    await assigned().click()
    await page.getByRole("button", { name: "Save view", exact: true }).click()
    const saveView = page.getByRole("dialog", { name: "Save library view", exact: true })
    await saveView.getByLabel("View name").fill("Everyday assigned")
    await saveView.getByRole("button", { name: "Save view", exact: true }).click()
    await saveView.waitFor({ state: "hidden" })
    await assigned().click()
    await page.getByRole("combobox", { name: "Saved views", exact: true }).click()
    await page.getByRole("option", { name: "Everyday assigned", exact: true }).click()
    await page.getByRole("button", { name: "Assigned to me", exact: true, pressed: true }).waitFor()
    await page.goBack()
    await page.getByRole("button", { name: "Assigned to me", exact: true, pressed: false }).waitFor()
    assert.equal(calls.length, beforeSaved, "Filter and saved view changes never invoke AI")

    await page.getByRole("combobox", { name: "Saved views", exact: true }).click()
    await page.getByRole("option", { name: "Everyday assigned", exact: true }).click()
    let releaseBack, startedBack
    const backBegun = new Promise(resolve => { startedBack = resolve })
    const backHeld = new Promise(resolve => { releaseBack = resolve })
    await page.route("**/api/decisions/memory-search", async route => { startedBack(); await backHeld; await route.fulfill({ json: searchResponse() }) })
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click(); await backBegun
    await page.goBack()
    await page.getByRole("button", { name: "Assigned to me", exact: true, pressed: false }).waitFor()
    releaseBack()
    await page.waitForLoadState("networkidle")
    assert.equal(await page.getByText("Local semantic match", { exact: true }).count(), 0, "URL Back invalidates an in-flight response for other filters")
    assert.equal(await page.getByRole("button", { name: "Find by meaning", exact: true }).isEnabled(), true)
    await page.unroute("**/api/decisions/memory-search")
    await page.route("**/api/decisions/memory-search", route => route.fulfill({ json: searchResponse() }))
    console.log("Everyday filter/assignment controls passed")
    // Flat rows expose independent links/actions; cancellation and failures preserve state.
    const flatQuery = { q: "Everyday", tag: "everyday-proof", appliesTo: scope, ownerId: meta.currentUser.id, status: "PENDING", sort: "DEADLINE", deadline: "OVERDUE" }
    await go(`/?${new URLSearchParams(flatQuery)}`)
    const row = () => page.locator(".decision-row").filter({ has: page.getByRole("link", { name: pending.title, exact: true }) })
    await row().waitFor()
    assert.equal(await page.locator("a button, button a, a a").count(), 0)
    await row().getByRole("link", { name: pending.title, exact: true }).focus()
    await page.keyboard.press("Tab")
    await page.keyboard.press("Shift+Tab")
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none"), true)
    await page.keyboard.press("Tab")
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Filter Tag to everyday-proof")
    await page.keyboard.press("Tab")
    assert.equal(await page.evaluate(() => document.activeElement.textContent), "Record decision")
    await page.keyboard.press("Enter")
    let dialog = page.getByRole("dialog")
    await dialog.getByLabel("What did you decide?").fill("Cancelled choice")
    const beforeCancel = mutations.length
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await row().getByRole("button", { name: "Edit deadline", exact: true }).click()
    await dialog.getByLabel("Decide by").fill("2026-10-21")
    await page.keyboard.press("Escape")
    assert.equal(mutations.length, beforeCancel)
    assert.deepEqual(params(), flatQuery)
    await row().getByRole("button", { name: "Edit deadline", exact: true }).click()
    expectedError = true
    await page.route(`**/api/decisions/${pending.id}/deadline`, route => route.fulfill({ status: 503, json: { error: "Deadline retry proof" } }))
    await dialog.getByLabel("Decide by").fill("2026-10-21")
    await dialog.getByRole("button", { name: "Save deadline", exact: true }).click()
    await dialog.getByText("Deadline retry proof", { exact: true }).waitFor()
    assert.equal(await dialog.getByLabel("Decide by").inputValue(), "2026-10-21")
    await page.unroute(`**/api/decisions/${pending.id}/deadline`)
    await dialog.getByRole("button", { name: "Save deadline", exact: true }).click()
    await dialog.waitFor({ state: "hidden" }); expectedError = false
    await row().waitFor({ state: "detached" })
    assert.deepEqual(params(), flatQuery, "Deadline mutation preserves the Overdue filter")
    await page.getByRole("button", { name: "Remove Deadline filter", exact: true }).click()
    delete flatQuery.deadline
    await row().locator('.decision-deadline.is-soon time[datetime="2026-10-21"]').waitFor()
    await page.locator(".decision-row").first().getByRole("link", { name: "Everyday second deadline question", exact: true }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: "/private/tmp/decision-everyday-flat-mobile.png", fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await row().getByRole("button", { name: "Edit deadline", exact: true }).click()
    await dialog.getByRole("button", { name: "Clear date", exact: true }).click()
    await dialog.getByRole("button", { name: "Save deadline", exact: true }).click()
    await dialog.waitFor({ state: "hidden" })
    await row().getByText("No deadline", { exact: true }).waitFor()
    await row().getByRole("button", { name: "Record decision", exact: true }).click()
    await dialog.getByLabel("What did you decide?").fill("Everyday completed choice")
    await dialog.getByLabel("Why (optional)").fill("Recorded from Flat")
    expectedError = true
    await page.route(`**/api/decisions/${pending.id}/decide`, route => route.fulfill({ status: 503, json: { error: "Outcome retry proof" } }))
    await dialog.getByRole("button", { name: "Record decision", exact: true }).click()
    await dialog.getByText("Outcome retry proof", { exact: true }).waitFor()
    assert.equal(await dialog.getByLabel("What did you decide?").inputValue(), "Everyday completed choice")
    assert.equal(await dialog.getByLabel("Why (optional)").inputValue(), "Recorded from Flat")
    await page.unroute(`**/api/decisions/${pending.id}/decide`)
    let releaseSave, saveStarted
    const savingBegun = new Promise(resolve => { saveStarted = resolve })
    const heldSave = new Promise(resolve => { releaseSave = resolve })
    await page.route(`**/api/decisions/${pending.id}/decide`, async route => { saveStarted(); await heldSave; await route.continue() })
    const beforeOutcome = mutations.length
    await dialog.getByRole("button", { name: "Record decision", exact: true }).click(); await savingBegun
    assert.equal(await dialog.getByRole("button", { name: "Saving…", exact: true }).isDisabled(), true)
    await dialog.locator("form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
    assert.equal(mutations.length, beforeOutcome + 1)
    releaseSave()
    await dialog.waitFor({ state: "hidden" }); expectedError = false
    await row().waitFor({ state: "detached" })
    assert.deepEqual(params(), flatQuery)
    const saved = await (await page.request.get(`${api}/decisions/${pending.id}`)).json()
    assert.equal(saved.title, pending.title)
    assert.equal(saved.context, pending.context)
    assert.deepEqual(saved.appliesTo, pending.appliesTo)
    assert.deepEqual(saved.tags, pending.tags)
    assert.deepEqual(saved.optionsConsidered, pending.optionsConsidered)
    assert.equal(saved.owner.id, meta.currentUser.id)
    assert.equal(saved.references[0].url, "https://example.com/preserved")
    await page.getByRole("button", { name: "Remove Status filter", exact: true }).click()
    const doneRow = page.locator(".decision-row").filter({ has: page.getByRole("link", { name: "Everyday completed choice", exact: true }) })
    await doneRow.getByText("Decided", { exact: true }).waitFor()
    assert.equal(await doneRow.getByRole("button", { name: /^Preview DM-/ }).count(), 1)
    assert.equal(await doneRow.getByRole("button", { name: /^(Record decision|Set deadline|Edit deadline)$/ }).count(), 0, "Completed rows have no pending mutation actions")
    assert.equal(await doneRow.getByRole("button", { name: /^Filter / }).count(), 3, "Completed row keeps actionable tag, owner and scope")
    await doneRow.getByRole("button", { name: `Preview ${saved.decisionKey}`, exact: true }).waitFor()
    await page.screenshot({ path: "/private/tmp/decision-everyday-library-desktop.png", fullPage: true })

    console.log("Everyday Flat actions passed")
    // Local related lookup runs by itself once typing pauses, independent of creation mode and saving.
    await go("/decisions/new")
    const beforeLookupWrites = mutations.length
    assert.equal(await findRelated().isDisabled(), true)
    await primary().fill("Everyday unfinished question")
    await page.getByText("More details", { exact: true }).click()
    await page.getByLabel("Tags", { exact: true }).fill("unsaved, raw tag ")
    await page.getByLabel("Options Considered", { exact: true }).fill("First unsaved\nSecond unsaved ")
    await setScope("Lookup scope, exact")
    await page.getByRole("button", { name: "Already decided", exact: true }).click()
    await primary().fill("Everyday unfinished final choice")
    await related().getByText(responseBody.outcome || responseBody.title, { exact: true }).waitFor()
    assert.deepEqual(calls.at(-1), { query: "Everyday unfinished final choice", method: "LOCAL", filters: { appliesTo: "Lookup scope, exact" } })
    await related().getByText(/Remaining records are waiting for local indexing/).waitFor()
    await related().getByText("Current choice", { exact: true }).waitFor()
    assert.equal(mutations.length, beforeLookupWrites)
    await page.waitForTimeout(900)
    const afterLookup = calls.length
    // Preview fetches fresh stored detail without navigating or touching the draft.
    const previewButton = () => related().getByRole("button", { name: `Preview ${responseBody.decisionKey}`, exact: true })
    const preview = () => page.getByRole("dialog", { name: "Decision preview", exact: true })
    const previewUrl = `${api}/decisions/${responseBody.id}`
    const longWhy = "Full stored rationale with the original reasoning. ".repeat(15) + "Final rationale sentence."
    const previewRecord = { ...responseBody, why: longWhy, references: [{ id: "preview-link", kind: "URL", label: "Supporting evidence", url: "https://example.com/evidence" }], sources: [{ id: "preview-source", provider: "SLACK", capturedAt: new Date().toISOString(), messages: [], permalink: "https://example.slack.com/archives/demo/p123", channelName: "preview-evidence", sourceContext: { captureStatus: "INCOMPLETE" } }] }
    let previewMode = "ready", previewReads = 0, releasePreview
    await page.route(previewUrl, async route => {
      previewReads++
      const mode = previewMode
      if (mode === "hold") await new Promise(resolve => { releasePreview = resolve })
      await route.fulfill(mode === "fail" ? { status: 503, json: { error: "Synthetic preview failure" } } : { json: { ...previewRecord, ...(mode === "hold" ? { why: "Outdated preview response" } : {}) } })
    })
    const draftBeforePreview = await page.evaluate(key => localStorage.getItem(key), draftKey)
    const formUrl = page.url()
    assert.equal(previewReads, 0, "Related results alone do not fetch full detail")
    await previewButton().click()
    await preview().getByText(longWhy, { exact: true }).waitFor()
    assert.equal(page.url(), formUrl)
    assert.equal(await preview().getByRole("link", { name: "Supporting evidence" }).getAttribute("href"), "https://example.com/evidence")
    await preview().getByText("Only part of this discussion was captured.").waitFor()
    await page.screenshot({ path: "/private/tmp/decision-preview-desktop.png", animations: "disabled" })
    await page.keyboard.press("Escape")
    await preview().waitFor({ state: "hidden" })
    assert.equal(await previewButton().evaluate(el => el === document.activeElement), true, "Close restores focus to the preview trigger")
    assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), draftBeforePreview)
    assert.equal(await primary().inputValue(), "Everyday unfinished final choice")
    assert.equal(await page.getByLabel("Tags", { exact: true }).inputValue(), "unsaved, raw tag ")
    assert.equal(await page.getByRole("button", { name: "Restore draft", exact: true }).count(), 0)
    assert.equal(calls.length, afterLookup, "Preview and close never repeat the lookup")
    assert.equal(mutations.length, beforeLookupWrites)

    expectedError = true; previewMode = "fail"
    await previewButton().click()
    await preview().getByRole("alert").waitFor()
    previewMode = "ready"
    await preview().getByRole("button", { name: "Retry preview" }).click()
    await preview().getByText(longWhy, { exact: true }).waitFor()
    await preview().getByRole("button", { name: "Back to draft" }).click()
    await preview().waitFor({ state: "hidden" })
    expectedError = false

    previewMode = "hold"
    await previewButton().click()
    await preview().getByText("Loading decision…").waitFor()
    await page.waitForTimeout(100)
    await preview().getByRole("button", { name: "Back to draft" }).click()
    await preview().waitFor({ state: "hidden" })
    previewMode = "ready"
    await previewButton().click()
    await preview().getByText(longWhy, { exact: true }).waitFor()
    releasePreview()
    await page.waitForTimeout(150)
    assert.equal(await preview().getByText("Outdated preview response").count(), 0, "Closed preview cannot publish a late response")
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    // Finish the sheet's finite entrance transition before measuring its fit.
    await page.screenshot({ path: "/private/tmp/decision-preview-mobile.png", animations: "disabled" })
    const previewBox = await preview().boundingBox()
    assert.ok(previewBox.x >= 0 && previewBox.x + previewBox.width <= 391, "Settled preview fits the mobile viewport")
    await preview().getByRole("button", { name: "Open full decision", exact: true }).click()
    await page.waitForURL(`${base}/decisions/${responseBody.id}`)
    await page.getByRole("heading", { name: responseBody.title, exact: true, level: 1 }).waitFor()
    await page.unroute(previewUrl)
    await page.goBack()
    await page.getByRole("button", { name: "Restore draft", exact: true }).click()
    assert.equal(await primary().inputValue(), "Everyday unfinished final choice")
    assert.deepEqual(await page.locator('[data-slot="combobox-chip"]').allTextContents(), ["Lookup scope, exact"])
    await page.getByText("More details", { exact: true }).click()
    assert.equal(await page.getByLabel("Tags", { exact: true }).inputValue(), "unsaved, raw tag ")
    assert.equal(await page.getByLabel("Options Considered", { exact: true }).inputValue(), "First unsaved\nSecond unsaved ")
    // Results are never persisted; the restored draft gets one fresh local lookup.
    await related().getByText(responseBody.outcome || responseBody.title, { exact: true }).waitFor()
    assert.equal(calls.length, afterLookup + 1, "Restoring runs exactly one new local lookup")
    const draft = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey)
    assert.deepEqual(Object.keys(draft).sort(), ["baseUpdatedAt", "form", "listText"])
    await page.getByRole("button", { name: "Pending decision", exact: true }).click()
    await findRelated().click()
    await related().getByText(responseBody.outcome || responseBody.title, { exact: true }).waitFor()
    assert.equal(calls.at(-1).query, "Everyday unfinished question")
    assert.equal(calls.at(-1).filters.decisionState, undefined)
    await setScope("Second lookup scope")
    assert.equal(await related().getByRole("link").count(), 0)
    await related().getByText("Search scope: Lookup scope, exact (exact scope).", { exact: true }).waitFor()
    responseBody = { ...responseBody, status: "SUPERSEDED" }
    await findRelated().click()
    await related().getByText("Superseded", { exact: true }).waitFor()
    assert.deepEqual(calls.at(-1).filters, { appliesTo: "Lookup scope, exact" })
    await page.getByRole("button", { name: "Remove scope Lookup scope, exact", exact: true }).click()
    await page.getByRole("button", { name: "Remove scope Second lookup scope", exact: true }).click()
    await related().getByText("Search scope: all scopes (none selected).", { exact: true }).waitFor()
    await page.route("**/api/decisions/memory-search", route => route.fulfill({ json: { method: "LOCAL", candidateCount: 2, totalCandidateCount: 2, matches: [] } }))
    await findRelated().click()
    await related().getByText(/No related decisions were found in the searched records/).waitFor()
    assert.deepEqual(calls.at(-1).filters, {})
    await page.unroute("**/api/decisions/memory-search")
    expectedError = true
    await page.route("**/api/decisions/memory-search", route => route.fulfill({ status: 503, json: { error: "Synthetic error" } }))
    await findRelated().click()
    await related().getByRole("alert").waitFor()
    assert.equal(await primary().inputValue(), "Everyday unfinished question")
    assert.equal(await page.getByRole("button", { name: "Save Decision", exact: true }).isEnabled(), true)
    expectedError = false
    await page.unroute("**/api/decisions/memory-search")

    // Hold responses across text/scope/mode changes; only the new keyed instance may publish.
    const held = []
    let heldStarted
    await page.route("**/api/decisions/memory-search", async route => {
      const response = searchResponse()
      await new Promise(resolve => { held.push(resolve); heldStarted?.() })
      await route.fulfill({ json: response })
    })
    for (const change of [async () => primary().fill("Changed related question"), async () => setScope("Stale scope, exact"), async () => page.getByRole("button", { name: "Already decided", exact: true }).click()]) {
      const start = calls.length
      const begun = new Promise(resolve => { heldStarted = resolve })
      await findRelated().click()
      await begun
      await change()
      held.shift()()
      await page.waitForLoadState("networkidle")
      assert.equal(await related().getByRole("link").count(), 0)
      assert.equal(calls.length, start + 1)
    }
    const olderBody = responseBody
    let begun = new Promise(resolve => { heldStarted = resolve })
    await findRelated().click(); await begun
    await primary().fill("Newer related search input")
    responseBody = saved
    begun = new Promise(resolve => { heldStarted = resolve })
    await findRelated().click(); await begun
    held.pop()()
    await related().getByText(saved.outcome, { exact: true }).waitFor()
    held.shift()()
    await page.waitForLoadState("networkidle")
    assert.equal(await related().getByText(olderBody.title, { exact: true }).count(), 0, "Older response cannot replace newer results")
    responseBody = olderBody
    await page.getByRole("button", { name: "Remove scope Stale scope, exact", exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.unroute("**/api/decisions/memory-search")
    await page.route("**/api/decisions/memory-search", route => route.fulfill({ json: searchResponse() }))
    await findRelated().click()
    await related().getByText("Superseded", { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.keyboard.press("Escape")
    await related().evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - 76, behavior: "instant" }))
    await page.screenshot({ path: "/private/tmp/decision-everyday-related-mobile.png", fullPage: false, animations: "disabled" })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await related().evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - 76, behavior: "instant" }))
    await page.screenshot({ path: "/private/tmp/decision-everyday-related-desktop.png", fullPage: false, animations: "disabled" })
    await page.unroute("**/api/decisions/memory-search")
    await page.route("**/api/decisions/memory-search", async route => { await new Promise(resolve => { held.push(resolve); heldStarted?.() }); await route.fulfill({ json: searchResponse() }) })
    const begunSaveSearch = new Promise(resolve => { heldStarted = resolve })
    await findRelated().click()
    await begunSaveSearch
    const beforeSaveCalls = calls.length
    const saveResponse = page.waitForResponse(r => r.url() === `${api}/decisions` && r.request().method() === "POST")
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    const newRecord = await (await saveResponse).json(); created.push(newRecord.id)
    await page.getByRole("heading", { name: newRecord.outcome, exact: true }).waitFor()
    held.shift()()
    await page.waitForLoadState("networkidle")
    assert.equal(calls.length, beforeSaveCalls)
    assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), null)
    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await primary().waitFor()
    assert.equal(await page.getByRole("region", { name: "Related decisions", exact: true }).count(), 0)
    assert.ok(calls.every(call => call.method === "LOCAL"), "This proof makes no cloud request")

    // Availability and missing identity have visible explanations, preserving other controls.
    await page.unroute("**/api/metadata")
    await page.route("**/api/metadata", route => route.fulfill({ json: { ...meta, currentUser: null, features: { ...meta.features, memorySearch: false, geminiMemorySearch: false } } }))
    await go("/?q=Everyday&ownerId=name%3AUnknown")
    await page.getByText(/Assigned to me is unavailable because/).waitFor()
    assert.equal(await assigned().isDisabled(), true)
    assert.equal(params().ownerId, "name:Unknown")
    await more(); await close()
    await page.unroute("**/api/metadata")
    await page.route("**/api/metadata", route => route.fulfill({ json: { ...meta, features: { ...meta.features, memorySearch: false, geminiMemorySearch: false } } }))
    await go("/decisions/new")
    await primary().fill("Still save when unavailable")
    assert.equal(await findRelated().isDisabled(), true)
    await related().getByText(/Local search is unavailable. You can still save normally/).waitFor()
    assert.equal(await page.getByRole("button", { name: "Save Decision", exact: true }).isEnabled(), true)
    assert.equal(await page.locator("vite-error-overlay").count(), 0)
    assert.deepEqual(errors, [])
    console.log("Everyday convenience UI passed: explicit local/options, filters/assignment/saved views, Flat cancel/failure/refresh/actions, related scope/mode/coverage/stale/draft/save/availability; no cloud or lookup writes")
  } catch (error) {
    console.error("Everyday UI failure:", page.url())
    await page.screenshot({ path: "/private/tmp/decision-everyday-failure.png", fullPage: true })
    throw error
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" })
    await context.close()
    for (const id of created) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  }
}

export async function verifyShortcutUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "America/New_York" })
  const page = await context.newPage(), created = [], errors = [], calls = [], mutations = []
  let expectedFailure = false, holdMeaning = null, scopeMode = "real", scopeReads = 0
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error" && !expectedFailure) errors.push(message.text()) })
  page.on("request", request => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && !request.url().endsWith("memory-search")) mutations.push(request.url()) })
  const api = "http://localhost:3011/api", base = "http://localhost:5173/#"
  const metadata = await (await page.request.get(`${api}/metadata`)).json()
  const seed = await (await page.request.get(`${api}/decisions/33333333-3333-4333-8333-333333333301`)).json()
  const create = async input => {
    const response = await page.request.post(`${api}/decisions`, { data: { tags: ["shortcuts-ui"], ...input } })
    assert.equal(response.status(), 201); const record = await response.json(); created.push(record.id); return record
  }
  const query = () => new URLSearchParams(page.url().split("?")[1] ?? "")
  const goQuery = async search => { await page.goto(`${base}/?${search}`); await page.getByRole("textbox", { name: "Search decisions", exact: true }).waitFor() }
  const savedRegion = () => page.getByRole("region", { name: "Saved library views", exact: true })
  const reset = () => savedRegion().getByRole("button", { name: "Reset to saved view", exact: true })
  const row = record => page.locator(".decision-row").filter({ has: page.getByRole("link", { name: record.title, exact: true }) })
  try {
    await page.route("**/api/metadata", async route => { const response = await route.fetch(); const data = await response.json(); await route.fulfill({ response, json: { ...data, features: { ...data.features, memorySearch: true, geminiMemorySearch: true } } }) })
    await page.route("**/api/decisions/memory-search", async route => {
      calls.push(route.request().postDataJSON()); const held = holdMeaning
      if (held) { held.started(); await held.promise }
      await route.fulfill({ json: { method: calls.at(-1).method, candidateCount: 1, totalCandidateCount: 1, matches: [{ decisionId: seed.id, decision: seed, score: 90, explanation: "Shortcut semantic fixture", matchedConcepts: [] }] } })
    })
    const savedSearch = new URLSearchParams({ q: "DM-9999", channel: "platform-decisions", ownerId: metadata.currentUser.id, tag: "migration", status: "PENDING", appliesTo: "Atlas migration", dateRange: "30", deadline: "OVERDUE", view: "kanban", sort: "DEADLINE" }).toString()
    const views = [{ id: "shortcuts-saved", name: "Saved pending work", search: savedSearch }, { id: "shortcuts-other", name: "Other view", search: "q=DM-104" }]
    const storageKey = `decision-memory:v1:${encodeURIComponent(metadata.workspace.id)}:${encodeURIComponent(metadata.currentUser.id)}:library-views`
    await page.addInitScript(({storageKey,views}) => localStorage.setItem(storageKey, JSON.stringify(views)), { storageKey, views })
    await goQuery(savedSearch)
    await savedRegion().getByRole("combobox", { name: "Saved views", exact: true }).filter({ hasText: views[0].name }).waitFor()
    assert.equal(await reset().count(), 0)
    await goQuery("q=DM-8888")
    await reset().waitFor()
    let release, start
    const started = new Promise(resolve => { start = resolve })
    holdMeaning = { promise: new Promise(resolve => { release = resolve }), started: start }
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click(); await started
    await page.evaluate(() => { window.shortcutSetItem = Storage.prototype.setItem; window.shortcutStorageWrites = 0; Storage.prototype.setItem = () => { window.shortcutStorageWrites++; throw new DOMException("Denied", "SecurityError") } })
    await reset().focus(); await page.keyboard.press("Enter")
    await page.waitForURL(url => url.hash.split("?")[1] === savedSearch)
    assert.deepEqual(query().toString(), savedSearch)
    await reset().waitFor({ state: "hidden" })
    assert.equal(await reset().count(), 0)
    assert.equal(await savedRegion().getByText("Unsaved changes", { exact: false }).count(), 0)
    release(); holdMeaning = null; await page.waitForTimeout(250)
    assert.equal(await page.getByText("Shortcut semantic fixture", { exact: true }).count(), 0)
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey), views)
    assert.equal(await page.evaluate(() => window.shortcutStorageWrites), 0)
    await page.evaluate(() => { Storage.prototype.setItem = window.shortcutSetItem })
    await goQuery("q=DM-8887")
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click()
    await page.getByText("Local semantic match", { exact: true }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    await savedRegion().scrollIntoViewIfNeeded()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.screenshot({ path: "/private/tmp/decision-shortcuts-reset-mobile.png", animations: "disabled" })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await reset().click()
    await page.getByRole("heading", { name: "No matching decision under these filters.", exact: true }).waitFor()
    assert.equal(await page.getByText("Local semantic match", { exact: true }).count(), 0)
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey), views)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await goQuery("q=DM-104")
    await page.getByRole("link", { name: seed.outcome || seed.title, exact: true }).waitFor()
    for (const key of ["DM-9999", "dm-9999", "  dM-9999  "]) {
      const before = calls.length
      await goQuery(new URLSearchParams({ q: key }).toString())
      await page.getByRole("heading", { name: "No matching decision under these filters.", exact: true }).waitFor()
      await page.waitForTimeout(850)
      assert.equal(calls.length, before, "Identifier-only empty keyword results never auto-search")
      assert.equal(await page.getByRole("button", { name: "Clear filters and keep this key", exact: true }).count(), 0)
    }
    const beforeMixed = calls.length
    await goQuery("q=DM-9999+storage")
    await page.getByText("Local semantic match", { exact: true }).waitFor()
    assert.equal(calls.length, beforeMixed + 1); assert.equal(calls.at(-1).method, "LOCAL")
    await page.getByRole("button", { name: "Back to keyword results", exact: true }).click()
    await page.waitForTimeout(850); assert.equal(calls.length, beforeMixed + 1)
    await goQuery("q=DM-9999")
    await page.getByRole("heading", { name: "No matching decision under these filters.", exact: true }).waitFor()
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click()
    await page.getByText("Local semantic match", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Back to keyword results", exact: true }).click()
    await page.locator("summary").filter({ hasText: "Search options" }).click()
    const beforeOptions = calls.length
    await page.getByText(/Google/).first().waitFor(); assert.equal(calls.length, beforeOptions)
    await page.getByRole("button", { name: "Search with Gemini", exact: true }).click()
    await page.getByText("Shortcut semantic fixture", { exact: true }).waitFor()
    assert.equal(calls.at(-1).method, "GEMINI")
    await goQuery("q=DM-104&tag=missing-shortcuts-tag&view=kanban&sort=DEADLINE")
    await page.getByRole("heading", { name: "No matching decision under these filters.", exact: true }).waitFor()
    await page.getByRole("button", { name: "Clear filters and keep this key", exact: true }).click()
    await page.getByRole("link", { name: seed.outcome || seed.title, exact: true }).waitFor()
    assert.deepEqual(Object.fromEntries(query()), { q: "DM-104", view: "kanban", sort: "DEADLINE" })
    let releaseLate, beginLate
    const lateStarted = new Promise(resolve => { beginLate = resolve })
    holdMeaning = { promise: new Promise(resolve => { releaseLate = resolve }), started: beginLate }
    await goQuery("q=ordinary+missing+shortcut+question"); await lateStarted
    await goQuery("q=DM-9999")
    await page.getByRole("heading", { name: "No matching decision under these filters.", exact: true }).waitFor()
    releaseLate(); holdMeaning = null; await page.waitForTimeout(250)
    assert.equal(await page.getByText("Local semantic match", { exact: true }).count(), 0)
    console.log("Shortcut saved reset/key search passed: full configuration, blocked storage, stale/cache invalidation, identifier/natural/mixed/manual local/Gemini and recovery")

    const scopeA = "Shortcut scope A, exact & pending", scopeB = "Shortcut scope B only", scopeC = "Shortcut scope C recorded"
    const pending = await create({ title: "Shortcut pending question", decisionState: "PENDING", appliesTo: [scopeA] })
    await create({ title: "Shortcut pending-only question", decisionState: "PENDING", appliesTo: [scopeB] })
    const decided = await create({ title: "Shortcut recorded choice", appliesTo: [scopeA, scopeC], dueDate: "2026-12-20" })
    await page.route("**/api/scopes", async route => { scopeReads++; await (scopeMode === "empty" ? route.fulfill({ json: [] }) : scopeMode === "fail" ? route.fulfill({ status: 503, json: { error: "Shortcut scope failure" } }) : route.continue()) })
    await page.goto(`${base}/scopes`)
    const names = page.getByRole("textbox", { name: "Find a scope", exact: true })
    await page.getByRole("link", { name: scopeA, exact: true }).waitFor()
    const readCount = scopeReads
    await names.fill("SHORTCUT SCOPE")
    const toggle = page.getByRole("button", { name: "With pending questions", exact: true })
    await toggle.focus(); await page.keyboard.press("Enter")
    assert.equal(await toggle.getAttribute("aria-pressed"), "true")
    assert.equal(await page.getByRole("link", { name: scopeC, exact: true }).count(), 0)
    await page.getByRole("link", { name: scopeB, exact: true }).waitFor()
    const direct = page.getByRole("link", { name: `Pending questions (1) in ${scopeA}`, exact: true })
    assert.equal(await direct.getAttribute("href"), `#/?${new URLSearchParams({ appliesTo: scopeA, status: "PENDING" })}`)
    assert.equal(await page.locator("a a, a button").count(), 0)
    await names.fill("SHORTCUT SCOPE C")
    await page.getByText("No scopes with pending questions match these controls", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Show scopes without pending questions", exact: true }).click()
    assert.equal(await names.inputValue(), "SHORTCUT SCOPE C")
    await page.getByRole("link", { name: scopeC, exact: true }).waitFor()
    await toggle.click()
    await page.getByRole("button", { name: "Clear scope name search", exact: true }).click()
    assert.equal(await toggle.getAttribute("aria-pressed"), "true")
    await names.fill("Shortcut scope")
    assert.equal(scopeReads, readCount, "Directory filtering uses the already-loaded counts")
    await page.screenshot({ path: "/private/tmp/decision-shortcuts-scopes-desktop.png", animations: "disabled" })
    await direct.focus(); await page.keyboard.press("Enter")
    await row(pending).waitFor(); assert.deepEqual(Object.fromEntries(query()), { appliesTo: scopeA, status: "PENDING" })
    await page.goto(`${base}/scopes`); await page.getByRole("link", { name: scopeA, exact: true }).click()
    await page.getByRole("heading", { name: scopeA, exact: true, level: 1 }).waitFor()
    scopeMode = "empty"; await page.goto(`${base}/scopes`)
    await page.getByText("No scopes recorded yet", { exact: true }).waitFor()
    scopeMode = "fail"; expectedFailure = true; await page.reload()
    await page.getByText("Could not load scopes", { exact: true }).waitFor()
    scopeMode = "real"; await page.getByRole("button", { name: "Try again", exact: true }).click()
    await page.getByRole("link", { name: scopeA, exact: true }).waitFor(); expectedFailure = false
    await names.fill("not-present-shortcut-scope")
    await page.getByText("No scopes match your search", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Clear scope name search", exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 }); await names.fill("Shortcut scope"); await toggle.click()
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: "/private/tmp/decision-shortcuts-scopes-mobile.png", animations: "disabled" })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    console.log("Shortcut scopes passed: pending/name combination, separate exact links, ordering, no extra requests and recoverable empty/failure states")

    await page.clock.install({ time: new Date("2026-12-31T23:58:00-05:00") })
    await page.goto(`${base}/decisions/new`)
    await page.locator("#decision").fill("Hi")
    await page.getByText("More details", { exact: true }).click()
    await page.getByLabel("Context", { exact: true }).fill("Shortcut context stays")
    await page.getByLabel("Tags", { exact: true }).fill("raw, tags ")
    const date = page.locator("#due-date"), choices = page.getByRole("group", { name: "Quick deadline choices", exact: true })
    const beforeChoices = mutations.length
    for (const [label, expected] of [["Today", "2026-12-31"], ["Tomorrow", "2027-01-01"], ["In 7 days", "2027-01-07"]]) {
      const button = choices.getByRole("button", { name: label, exact: true })
      assert.equal(await button.getAttribute("type"), "button")
      await button.focus(); await page.keyboard.press("Enter")
      assert.equal(await date.inputValue(), expected)
      assert.equal(await page.locator("#decision").inputValue(), "Hi")
      assert.equal(await page.getByLabel("Context", { exact: true }).inputValue(), "Shortcut context stays")
      assert.equal(await page.getByLabel("Tags", { exact: true }).inputValue(), "raw, tags ")
    }
    await page.clock.setSystemTime(new Date("2027-01-01T00:01:00-05:00"))
    await choices.getByRole("button", { name: "Today", exact: true }).click(); assert.equal(await date.inputValue(), "2027-01-01")
    await date.fill("2020-01-01"); assert.equal(await date.inputValue(), "2020-01-01")
    assert.equal(mutations.length, beforeChoices)
    await choices.scrollIntoViewIfNeeded()
    await page.screenshot({ path: "/private/tmp/decision-shortcuts-capture-mobile.png", animations: "disabled" })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.getByRole("button", { name: "Discard draft", exact: true }).click()
    await page.goto(`${base}/?tag=shortcuts-ui&status=PENDING`)
    await row(pending).getByRole("button", { name: "Set deadline", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Edit deadline", exact: true }), dialogDate = dialog.getByLabel("Decide by", { exact: true })
    await dialog.getByRole("button", { name: "Tomorrow", exact: true }).click(); assert.equal(await dialogDate.inputValue(), "2027-01-02")
    await dialog.getByRole("button", { name: "Clear date", exact: true }).click(); assert.equal(await dialogDate.inputValue(), "")
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); assert.equal(mutations.length, beforeChoices)
    assert.equal((await (await page.request.get(`${api}/decisions/${pending.id}`)).json()).dueDate, null)
    await row(pending).getByRole("button", { name: "Set deadline", exact: true }).click()
    await dialog.getByRole("button", { name: "In 7 days", exact: true }).click()
    let finishSave, startSave
    const saveStarted = new Promise(resolve => { startSave = resolve }), saveHeld = new Promise(resolve => { finishSave = resolve })
    expectedFailure = true
    await page.route(`**/api/decisions/${pending.id}/deadline`, async route => { startSave(); await saveHeld; await route.fulfill({ status: 503, json: { error: "Shortcut deadline failure" } }) })
    await dialog.getByRole("button", { name: "Save deadline", exact: true }).click(); await saveStarted
    for (const label of ["Today", "Tomorrow", "In 7 days"]) assert.equal(await dialog.getByRole("button", { name: label, exact: true }).isDisabled(), true)
    finishSave(); await dialog.getByRole("alert").waitFor(); assert.equal(await dialogDate.inputValue(), "2027-01-08")
    await page.unroute(`**/api/decisions/${pending.id}/deadline`); expectedFailure = false
    const [saved] = await Promise.all([page.waitForResponse(r => r.url().endsWith(`/${pending.id}/deadline`) && r.request().method() === "PUT"), dialog.getByRole("button", { name: "Save deadline", exact: true }).click()])
    const updated = await saved.json(); assert.equal(updated.dueDate, "2027-01-08"); assert.equal(updated.title, pending.title); assert.deepEqual(updated.appliesTo, pending.appliesTo)
    await dialog.waitFor({ state: "hidden" })
    await row(pending).getByRole("button", { name: "Edit deadline", exact: true }).click()
    await page.screenshot({ path: "/private/tmp/decision-shortcuts-deadline-mobile.png", animations: "disabled" })
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await page.goto(`${base}/decisions/${decided.id}/edit`)
    await page.getByLabel("Original deadline (optional)", { exact: true }).waitFor()
    assert.equal(await page.getByRole("group", { name: "Quick deadline choices", exact: true }).count(), 0)
    assert.equal(await page.locator("vite-error-overlay").count(), 0); assert.deepEqual(errors, [])
    console.log("Shortcut deadlines passed: calendar rollover/midnight, keyboard, no implicit writes, cancel/clear/failure/disabled/save and historical-edit exclusion")
  } catch (error) {
    console.error("Shortcut UI failure", page.url(), await page.locator("body").innerText())
    await page.screenshot({ path: "/private/tmp/decision-shortcuts-failure.png", animations: "disabled" }); throw error
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" }); await context.close()
    for (const id of created) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  }
}
