import assert from "node:assert/strict"

export async function verifyDeadlineUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, timezoneId: "UTC" })
  const page = await context.newPage()
  const createdIds = []
  const pageErrors = []
  const consoleErrors = []
  let expectedFailure = false
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("console", (message) => { if (message.type() === "error" && !expectedFailure) consoleErrors.push(message.text()) })
  const base = "http://localhost:3011/api"
  const library = "http://localhost:5173/#/?tag=deadline-ui-proof"
  const create = async (input) => {
    const response = await page.request.post(`${base}/decisions`, { data: { ...input, tags: ["deadline-ui-proof"] } })
    assert.equal(response.status(), 201)
    const record = await response.json()
    createdIds.push(record.id)
    return record
  }
  try {
    await page.clock.install({ time: new Date("2026-10-14T12:00:00Z") })
    const pending = []
    for (const [name, dueDate] of [["Overdue question", "2026-10-13"], ["Today question", "2026-10-14"], ["Three-day question", "2026-10-17"], ["Seven-day question", "2026-10-21"], ["Upcoming question", "2026-10-22"], ["Undated question", null]]) {
      pending.push(await create({ title: name, decisionState: "PENDING", dueDate, appliesTo: ["Deadline-only questions"],
        references: [{ kind: "URL", label: "Preserved board link", url: "https://example.com/preserved-board-link" }] }))
    }
    const decided = []
    for (let index = 0; index < 12; index++) decided.push(await create({ title: `Recorded board choice ${index}` }))
    await page.goto(library, { waitUntil: "networkidle" })
    assert.equal(await page.title(), "Decision Memory")
    await page.getByRole("heading", { name: "Decision Library", exact: true }).waitFor()
    assert.equal(await page.locator(".decision-row").count(), 18)
    assert.equal(await page.locator("vite-error-overlay").count(), 0)
    await page.getByRole("combobox", { name: "Sort", exact: true }).click()
    await page.getByRole("option", { name: "Earliest deadline first", exact: true }).click()
    await page.locator(".decision-row").first().getByText("Overdue question", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Kanban", exact: true }).click()
    const board = page.getByRole("region", { name: "Decision Kanban board" })
    await board.waitFor()
    assert.equal(await page.getByRole("combobox", { name: "Sort", exact: true }).count(), 0)
    for (const [name, count] of [["Overdue", 1], ["Due soon", 3], ["Upcoming", 1], ["No deadline", 1], ["Decided", 12]]) {
      const counter = board.getByRole("region", { name: `${name} decisions`, exact: true }).getByLabel(`${count} ${name.toLowerCase()} decisions`)
      await counter.waitFor()
      assert.equal(await counter.count(), 1)
    }
    const done = board.getByRole("region", { name: "Decided decisions", exact: true })
    assert.equal(await done.locator(".board-card").count(), 10)
    await done.getByRole("button", { name: "Show more" }).click()
    assert.equal(await done.locator(".board-card").count(), 12)
    // Keyboard users can reach a card action, open it, and cancel with Escape.
    await board.focus()
    await page.keyboard.press("Tab")
    assert.equal(await board.getByRole("link", { name: "Overdue question", exact: true }).evaluate((element) => element === document.activeElement), true)
    await page.keyboard.press("Tab")
    assert.match(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), /^Filter Owner to /)
    await page.keyboard.press("Tab")
    await page.keyboard.press("Enter")
    await page.getByRole("dialog").waitFor()
    await page.keyboard.press("Escape")
    await page.getByRole("dialog").waitFor({ state: "hidden" })
    assert.equal((await (await page.request.get(`${base}/decisions/${pending[0].id}`)).json()).decisionState, "PENDING")
    await board.evaluate((element) => { element.scrollLeft = 0 })
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: "/private/tmp/decision-memory-kanban-desktop.png", fullPage: false })
    // All five columns fit common laptop widths; narrower screens scroll inside the board.
    for (const [width, boardOverflows] of [[1280, null], [1366, false], [1536, false], [390, true]]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Page fits ${width}px; board overflow is contained`)
      if (boardOverflows !== null) assert.equal(await board.evaluate((element) => element.scrollWidth > element.clientWidth), boardOverflows, `Board overflow at ${width}px`)
    }
    await page.screenshot({ path: "/private/tmp/decision-memory-kanban-mobile.png", fullPage: false })
    await board.scrollIntoViewIfNeeded()
    await page.screenshot({ path: "/private/tmp/decision-memory-kanban-mobile-board.png", fullPage: false })
    await page.setViewportSize({ width: 1536, height: 1024 })

    const card = board.locator(".board-card").filter({ has: page.getByRole("link", { name: "Overdue question", exact: true }) })
    await card.getByRole("button", { name: "Edit deadline" }).click()
    let dialog = page.getByRole("dialog")
    await dialog.getByLabel("Decide by").fill("2026-10-17")
    expectedFailure = true
    await page.route(`**/api/decisions/${pending[0].id}/deadline`, (route) => route.fulfill({ status: 503, json: { error: "Temporary deadline failure" } }))
    await dialog.getByRole("button", { name: "Save deadline" }).click()
    await dialog.getByText("Temporary deadline failure", { exact: true }).waitFor()
    assert.equal(await dialog.getByLabel("Decide by").inputValue(), "2026-10-17")
    await page.unroute(`**/api/decisions/${pending[0].id}/deadline`)
    await dialog.getByRole("button", { name: "Save deadline" }).click()
    await dialog.waitFor({ state: "hidden" })
    expectedFailure = false
    await board.getByRole("region", { name: "Due soon decisions", exact: true }).getByRole("link", { name: "Overdue question", exact: true }).waitFor()
    assert.equal((await (await page.request.get(`${base}/decisions/${pending[0].id}`)).json()).references[0].url, "https://example.com/preserved-board-link")

    const completeCard = board.locator(".board-card").filter({ has: page.getByRole("link", { name: "Three-day question", exact: true }) })
    await completeCard.getByRole("button", { name: "Record decision" }).click()
    dialog = page.getByRole("dialog")
    assert.equal(await dialog.locator("[required]").count(), 1)
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    assert.equal((await (await page.request.get(`${base}/decisions/${pending[2].id}`)).json()).decisionState, "PENDING")
    await completeCard.getByRole("button", { name: "Record decision" }).click()
    await dialog.getByLabel("What did you decide?").fill("Choose object storage for this deadline question")
    expectedFailure = true
    await page.route(`**/api/decisions/${pending[2].id}/decide`, (route) => route.fulfill({ status: 503, json: { error: "Temporary completion failure" } }))
    await dialog.getByRole("button", { name: "Record decision", exact: true }).click()
    await dialog.getByText("Temporary completion failure", { exact: true }).waitFor()
    assert.equal(await dialog.getByLabel("What did you decide?").inputValue(), "Choose object storage for this deadline question")
    await page.screenshot({ path: "/private/tmp/decision-memory-completion-retry.png" })
    await page.unroute(`**/api/decisions/${pending[2].id}/decide`)
    await dialog.getByRole("button", { name: "Record decision", exact: true }).click()
    await dialog.waitFor({ state: "hidden" })
    expectedFailure = false
    await done.getByRole("link", { name: "Choose object storage for this deadline question", exact: true }).waitFor()
    const saved = await (await page.request.get(`${base}/decisions/${pending[2].id}`)).json()
    assert.equal(saved.title, "Three-day question")
    assert.equal(saved.references[0].url, "https://example.com/preserved-board-link")
    await done.getByRole("link", { name: saved.outcome, exact: true }).click()
    await page.getByRole("heading", { name: "Original question", exact: true }).waitFor()
    assert.match(await page.locator("body").innerText(), /Three-day question/)
    assert.equal(await page.getByText(/days overdue/).count(), 0)
    // The title is the choice and the deadline is historical: no duplicate section or deadline action.
    assert.equal(await page.getByRole("heading", { name: "Decision", exact: true }).count(), 0)
    assert.equal(await page.getByRole("button", { name: /^(Set|Edit) deadline$/ }).count(), 0)
    assert.equal(await page.getByRole("button", { name: "Record decision", exact: true }).count(), 0)
    await page.getByText("Back to decisions", { exact: true }).click()
    await board.waitFor()
    assert.match(page.url(), /view=kanban/)
    assert.match(page.url(), /tag=deadline-ui-proof/)
    assert.match(page.url(), /sort=DEADLINE/)
    await board.getByRole("link", { name: "Undated question", exact: true }).click()
    assert.equal(await page.getByRole("button", { name: "Supersede", exact: true }).count(), 0)
    await page.getByRole("button", { name: "Set deadline", exact: true }).waitFor()
    await page.getByRole("link", { name: "Deadline-only questions", exact: true }).click()
    await page.getByRole("heading", { name: "Decision Library", exact: true }).waitFor()
    assert.match(page.url(), /status=PENDING/)
    assert.match(page.url(), /appliesTo=/)
    await page.getByRole("link", { name: /Undated question/ }).waitFor()
    await page.goto(library + "&sort=DEADLINE&view=kanban")
    await page.reload()
    await board.waitFor()
    await page.getByRole("button", { name: "Flat", exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll(".decision-row").length === 18)
    assert.equal(await page.getByRole("combobox", { name: "Sort", exact: true }).innerText(), "Earliest deadline first")

    // Actual web capture: one question, optional deadline, no optional metadata.
    await page.getByText("New Decision", { exact: true }).click()
    await page.getByLabel(/What needs to be decided\?/).fill("Minimal pending capture question")
    assert.equal(await page.locator("form [required]").count(), 1)
    assert.equal(await page.getByLabel("Context").isVisible(), false)
    await page.getByLabel("Decide by (optional)").fill("2026-10-17")
    await page.screenshot({ path: "/private/tmp/decision-memory-pending-form.png", fullPage: false })
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    await page.getByRole("heading", { name: "Minimal pending capture question", exact: true }).waitFor()
    createdIds.push(page.url().split("/decisions/")[1].split(/[?#/]/)[0])
    await page.getByText("Back to decisions", { exact: true }).click()
    assert.match(page.url(), /tag=deadline-ui-proof/)
    await page.getByText("New Decision", { exact: true }).click()
    await page.getByRole("button", { name: "Already decided", exact: true }).click()
    await page.getByLabel(/What did you decide\?/).fill("Minimal already-decided choice")
    assert.equal(await page.locator("form [required]").count(), 1)
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    await page.getByRole("heading", { name: "Minimal already-decided choice", exact: true }).waitFor()
    createdIds.push(page.url().split("/decisions/")[1].split(/[?#/]/)[0])
    assert.equal(await page.getByRole("heading", { name: "Original question", exact: true }).count(), 0)
    await page.getByText("Edit", { exact: true }).click()
    await page.getByLabel(/What did you decide\?/).fill("Updated minimal recorded choice")
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    await page.getByRole("heading", { name: "Updated minimal recorded choice", exact: true }).waitFor()
    assert.equal(await page.getByRole("heading", { name: "Original question", exact: true }).count(), 0)

    // View switching preserves ranked results and never reruns the provider.
    let memoryCalls = 0
    await page.route("**/api/metadata", async (route) => {
      const response = await route.fetch()
      const metadata = await response.json()
      await route.fulfill({ json: { ...metadata, features: { ...metadata.features, memorySearch: true } } })
    })
    await page.route("**/api/decisions/memory-search", async (route) => {
      memoryCalls++
      await route.fulfill({ json: { method: "LOCAL", matches: [{ decisionId: decided[0].id, decision: decided[0], score: 95, explanation: "Recorded board memory", matchedConcepts: [] }], candidateCount: 12 } })
    })
    await page.goto(library)
    await page.getByRole("textbox", { name: "Search decisions" }).fill("Remember this choice")
    await page.getByRole("button", { name: "Find by meaning", exact: true }).click()
    await page.getByText("Recorded board memory", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Kanban", exact: true }).click()
    await board.getByRole("link", { name: decided[0].title, exact: true }).click()
    await page.getByText("Back to decisions", { exact: true }).click()
    await board.getByText(/Recorded board memory/).waitFor()
    assert.equal(memoryCalls, 1)
    await page.getByRole("button", { name: /^More filters/ }).click()
    await page.getByRole("combobox", { name: "Status", exact: true }).click()
    await page.getByRole("option", { name: "Pending", exact: true }).click()
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await page.getByRole("dialog", { name: "More filters", exact: true }).waitFor({ state: "hidden" })
    await page.locator("#meaning-search-help").filter({ hasText: "Use keyword search for pending questions and deadline filters" }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Find by meaning", exact: true }).isDisabled(), true)
    await page.locator("summary").filter({ hasText: "Search options" }).click()
    assert.equal(await page.getByRole("button", { name: "Search with Gemini", exact: true }).isDisabled(), true)
    assert.equal(await page.getByRole("combobox", { name: "Status", exact: true }).count(), 0)

    // Midnight updates urgency and the server reference date without reloading.
    await page.goto(library + "&view=kanban")
    await board.getByRole("link", { name: "Today question", exact: true }).waitFor()
    await page.clock.fastForward(12 * 60 * 60 * 1000)
    await board.getByRole("region", { name: "Overdue decisions", exact: true }).getByRole("link", { name: "Today question", exact: true }).waitFor()

    await page.clock.setSystemTime(new Date("2026-10-16T12:00:00Z"))
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    await board.getByRole("region", { name: "Overdue decisions", exact: true }).getByText("2 days overdue", { exact: true }).waitFor()

    for (const [timezoneId, label] of [["Asia/Ho_Chi_Minh", "Due today"], ["America/Los_Angeles", "Due in 1 day"]]) {
      const viewer = await browser.newContext({ timezoneId })
      try {
        const tab = await viewer.newPage()
        await tab.clock.install({ time: new Date("2026-10-14T00:30:00Z") })
        await tab.goto(`http://localhost:5173/#/decisions/${pending[1].id}`)
        await tab.getByText(label, { exact: true }).waitFor()
      } finally { await viewer.close() }
    }
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(consoleErrors, [])
    console.log("Deadline UI passed: single-field captures, board counts/show-more, mobile containment, safe retry/cancel, question preservation, filters/navigation/cached memory, midnight and viewer calendars")
  } finally {
    await context.close()
    for (const id of createdIds) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  }
}
