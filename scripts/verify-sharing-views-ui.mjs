import assert from "node:assert/strict"

export async function verifySharingViewsUi({ browser }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:5173" })
  const page = await context.newPage()
  const errors = [], writes = []
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
  page.on("request", request => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url()) })
  const api = "http://localhost:3011/api"
  const base = "http://localhost:5173/#"
  const metadata = await (await page.request.get(`${api}/metadata`)).json()
  const key = `decision-memory:v1:${encodeURIComponent(metadata.workspace.id)}:${encodeURIComponent(metadata.currentUser.id)}:library-views`
  const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  const views = page.getByRole("region", { name: "Saved library views", exact: true })
  const selected = name => views.getByRole("combobox", { name: "Saved views", exact: true }).filter({ hasText: name })
  const apply = async name => {
    await views.getByRole("combobox", { name: "Saved views", exact: true }).click()
    await page.getByRole("option", { name, exact: true }).click()
  }
  const query = () => new URLSearchParams(page.url().split("?")[1] ?? "")
  const changeQuery = async value => {
    await page.getByRole("textbox", { name: "Search decisions", exact: true }).fill(value)
    await page.waitForURL(url => new URLSearchParams(url.hash.split("?")[1] ?? "").get("q") === value)
  }
  const save = async (name, button = "Save as new") => {
    await views.getByRole("button", { name: button, exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Save library view", exact: true })
    await dialog.getByLabel("View name").fill(name)
    await dialog.getByRole("button", { name: "Save view", exact: true }).click()
    return dialog
  }
  try {
    await page.goto(`${base}/?q=migration&view=kanban&sort=DEADLINE`)
    await (await save("Migration", "Save view")).waitFor({ state: "hidden" })
    const original = (await stored())[0]
    await changeQuery("archive")
    await selected("Migration").waitFor()
    await views.getByText("Unsaved changes", { exact: false }).waitFor()
    assert.deepEqual(await stored(), [original], "Editing filters must not silently overwrite a view")

    await views.getByRole("button", { name: "Rename saved view Migration", exact: true }).click()
    const rename = page.getByRole("dialog", { name: "Rename library view", exact: true })
    await rename.getByLabel("View name").fill("  My migration  ")
    await rename.getByRole("button", { name: "Rename view", exact: true }).click()
    await rename.waitFor({ state: "hidden" })
    const renamed = { ...original, name: "My migration" }
    assert.deepEqual(await stored(), [renamed], "Rename preserves ID and saved filters")
    assert.equal(query().get("q"), "archive", "Rename preserves unsaved filters")
    await selected("My migration").waitFor()

    // Denied storage keeps both saved data and current inputs, then retry works.
    await page.evaluate(() => {
      window.originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = () => { throw new DOMException("Denied", "SecurityError") }
    })
    await views.getByRole("button", { name: "Update view", exact: true }).click()
    await views.getByRole("alert").filter({ hasText: "Could not save" }).waitFor()
    assert.deepEqual(await stored(), [renamed])
    assert.equal(query().get("q"), "archive")
    await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem })
    await views.getByRole("button", { name: "Update view", exact: true }).click()
    await views.getByRole("button", { name: "Update view", exact: true }).waitFor({ state: "hidden" })
    const updated = (await stored())[0]
    assert.equal(updated.id, original.id)
    assert.equal(updated.search, "q=archive&view=kanban&sort=DEADLINE")
    await page.reload()
    await selected("My migration").waitFor()

    await changeQuery("storage")
    await (await save("Storage")).waitFor({ state: "hidden" })
    await selected("Storage").waitFor()
    const pair = await stored()
    assert.equal(pair.length, 2)
    assert.deepEqual(pair[0], updated, "Save as new preserves the original")
    assert.notEqual(pair[0].id, pair[1].id)

    await views.getByRole("button", { name: "Rename saved view Storage", exact: true }).click()
    await rename.getByLabel("View name").fill("my MIGRATION")
    await rename.getByRole("button", { name: "Rename view", exact: true }).click()
    await rename.getByRole("alert").filter({ hasText: "already exists" }).waitFor()
    await rename.getByRole("button", { name: "Cancel", exact: true }).click()
    assert.deepEqual(await stored(), pair)
    await changeQuery("archive")
    await views.getByRole("button", { name: "Update view", exact: true }).click()
    await views.getByRole("alert").filter({ hasText: "already saved" }).waitFor()
    assert.deepEqual(await stored(), pair, "Duplicate configuration cannot overwrite either view")
    await apply("My migration")
    await changeQuery("mobile")
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: "/private/tmp/decision-saved-views-mobile.png", fullPage: true, animations: "disabled" })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await apply("Storage")
    assert.equal(query().get("q"), "storage")
    await page.reload()
    await selected("Storage").waitFor()
    assert.deepEqual(await stored(), pair)

    // Real browser clipboard, stored content, and both lifecycle labels.
    const id = "33333333-3333-4333-8333-333333333301"
    const originalDecision = await (await page.request.get(`${api}/decisions/${id}`)).json()
    let decision = {
      ...originalDecision, decisionKey: "DM-COPY", title: "Which archive?",
      outcome: "Use object storage", decisionState: "DECIDED", status: "ACTIVE",
      why: "Durable storage.\nKeep the existing retention policy.", appliesTo: ["Atlas", "Exports"],
      sources: [{ id: "copy-source", provider: "SLACK", channelName: "archive", permalink: "https://example.com/source", capturedAt: originalDecision.createdAt, messages: [] }],
      references: [{ id: "copy-ref", kind: "LINK", label: "Design note", url: "https://example.com/design" }],
      lifecycle: { current: [], supersedes: [], supersededBy: [] },
    }
    await page.route(`**/api/decisions/${id}`, route => route.fulfill({ json: decision }))
    await page.goto(`${base}/decisions/${id}`)
    await page.getByRole("button", { name: "Copy summary", exact: true }).click()
    await page.getByText("Decision summary copied.", { exact: true }).waitFor()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    const beforeLinkUrl = page.url()
    await page.getByRole("button", { name: "Copy link", exact: true }).click()
    await page.getByText("Decision link copied.", { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${base}/decisions/${id}`)
    assert.equal(page.url(), beforeLinkUrl)
    const urls = await page.evaluate(async () => {
      const { decisionUrl } = await import("/src/lib/decision-links.ts")
      return [
        decisionUrl("record", "https://memory.example/team/app/?filter=secret#/decisions/new?raw=draft"),
        decisionUrl("record", "https://memory.example/team/app/index.html?filter=secret#/check-proposal"),
        decisionUrl("a/b", "https://memory.example/team/app/#/"),
      ]
    })
    assert.deepEqual(urls, ["https://memory.example/team/app/#/decisions/record", "https://memory.example/team/app/index.html#/decisions/record", "https://memory.example/team/app/#/decisions/a%2Fb"])
    assert.equal(copied, "DM-COPY · Decided — current\nDecision: Use object storage\nWhy: Durable storage.\nKeep the existing retention policy.\nApplies To: Atlas; Exports\nDecision URL: http://localhost:5173/#/decisions/33333333-3333-4333-8333-333333333301\n\nSources:\n- archive: https://example.com/source\n\nRelated links:\n- Design note: https://example.com/design")
    assert.equal(copied.split("\n").find(line => line.startsWith("Decision URL:")), `Decision URL: ${base}/decisions/${id}`)
    await page.screenshot({ path: "/private/tmp/decision-summary-mobile.png", fullPage: true, animations: "disabled" })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)

    decision = { ...decision, decisionState: "PENDING", outcome: null, why: null, sources: [], references: [], appliesTo: [] }
    await page.reload()
    await page.getByRole("button", { name: "Copy summary", exact: true }).click()
    await page.getByText("Decision summary copied.", { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "DM-COPY · Pending — not yet decided\nQuestion: Which archive?\nWhy: No rationale recorded.\nApplies To: No scope recorded.\nDecision URL: http://localhost:5173/#/decisions/33333333-3333-4333-8333-333333333301")

    decision = { ...decision, decisionState: "DECIDED", outcome: "Use local storage", status: "SUPERSEDED", lifecycle: { supersedes: [], supersededBy: [], current: [{ id: "current", decisionKey: "DM-NEW", title: "Use object storage", status: "ACTIVE" }, { id: "second-current", decisionKey: "DM-SECOND", title: "Second current choice", status: "ACTIVE" }] } }
    await page.reload()
    await page.getByRole("button", { name: "Copy summary", exact: true }).click()
    await page.getByText("Decision summary copied.", { exact: true }).waitFor()
    const historical = await page.evaluate(() => navigator.clipboard.readText())
    assert.match(historical, /^DM-COPY · Superseded — historical choice\nDecision: Use local storage/)
    assert.match(historical, /Current decisions:\n- DM-NEW: http:\/\/localhost:5173\/#\/decisions\/current/)

    assert.match(historical, /- DM-SECOND: http:\/\/localhost:5173\/#\/decisions\/second-current/)
    assert.ok(!historical.includes("undefined"))

    // Clipboard rejection and missing API both offer the exact text for manual copy.
    for (const unavailable of [false, true]) {
      await page.reload()
      await page.getByRole("button", { name: "Copy summary", exact: true }).waitFor()
      await page.evaluate(unavailable => {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: unavailable ? undefined : { writeText: () => Promise.reject(new Error("Denied")) } })
      }, unavailable)
      await page.getByRole("button", { name: "Copy summary", exact: true }).click()
      const fallback = page.getByRole("dialog", { name: "Copy decision summary", exact: true })
      const text = fallback.getByRole("textbox", { name: "Decision summary", exact: true })
      await fallback.waitFor()
      assert.equal(await text.inputValue(), historical)
      assert.equal(await text.getAttribute("readonly"), "")
      assert.equal(await page.getByText("Decision summary copied.", { exact: true }).count(), 0)
      await text.focus()
      assert.equal(await text.evaluate(el => el.selectionEnd - el.selectionStart), historical.length)
      await fallback.getByRole("button", { name: "Done", exact: true }).click()
      await page.getByRole("button", { name: "Copy link", exact: true }).click()
      const linkFallback = page.getByRole("dialog", { name: "Copy decision link", exact: true })
      const linkText = linkFallback.getByRole("textbox", { name: "Decision link", exact: true })
      assert.equal(await linkText.inputValue(), `${base}/decisions/${id}`)
      await linkText.focus()
      assert.equal(await linkText.evaluate(el => el.selectionEnd - el.selectionStart), `${base}/decisions/${id}`.length)
      assert.equal(await page.getByText("Decision link copied.", { exact: true }).count(), 0)
      if (!unavailable) await page.screenshot({ path: "/private/tmp/decision-refined-copy-link-mobile.png", animations: "disabled" })
      await linkFallback.getByRole("button", { name: "Done", exact: true }).click()
    }
    decision = { ...decision, lifecycle: { current: [], supersedes: [], supersededBy: [{ id: "intermediate", decisionKey: "DM-INTERMEDIATE", status: "SUPERSEDED" }] } }
    await page.reload()
    await page.getByRole("button", { name: "Copy summary", exact: true }).click()
    await page.getByText("Decision summary copied.", { exact: true }).waitFor()
    const intermediate = await page.evaluate(() => navigator.clipboard.readText())
    assert.match(intermediate, /Replaced by: DM-INTERMEDIATE/)
    assert.ok(!intermediate.includes("Current decisions:"), "Immediate history is never labeled current")
    decision = { ...decision, lifecycle: undefined, supersededBy: [] }
    await page.reload()
    await page.getByRole("button", { name: "Copy summary", exact: true }).click()
    await page.getByText("Decision summary copied.", { exact: true }).waitFor()
    const missing = await page.evaluate(() => navigator.clipboard.readText())
    assert.ok(!missing.includes("Current decisions:") && !missing.includes("Replaced by:"))
    assert.deepEqual(writes, [], "Copying and managing views trigger neither server writes nor AI")
    assert.deepEqual(errors, [])
    console.log("Sharing and saved-view QA passed: real clipboard, pending/history/manual fallback, rename/update/save-new, duplicate/storage failure, reload and mobile")
  } finally {
    await context.close()
  }
}
