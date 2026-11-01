import assert from "node:assert/strict"

export async function verifyUnreadRefreshUi({ browser }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
  let releaseOld
  const waiting = new Promise(resolve => { releaseOld = resolve })
  let calls = 0
  try {
    await page.route("**/api/notifications", async route => {
      const call = ++calls
      if (call === 2) await waiting
      const unread = call === 1 || call === 2 ? 1 : call === 4 ? 2 : 0
      await route.fulfill({ json: { items: Array.from({ length: unread }, (_, index) => ({ id: `synthetic-unread-${index}`, read: false })), asOf: new Date().toISOString() } })
    })
    await page.goto("http://localhost:5173/#/recent")
    const nav = page.getByRole("navigation", { name: "Primary navigation", exact: true })
    await nav.getByLabel("1 unread changes", { exact: true }).waitFor()
    const started = page.waitForRequest(request => request.url().endsWith("/api/notifications"))
    await page.evaluate(() => window.dispatchEvent(new Event("memory-changes")))
    await started
    const newer = page.waitForResponse(response => response.url().endsWith("/api/notifications"))
    await page.evaluate(() => window.dispatchEvent(new Event("memory-changes")))
    await newer
    await nav.getByLabel("1 unread changes", { exact: true }).waitFor({ state: "hidden" })
    const older = page.waitForResponse(response => response.url().endsWith("/api/notifications"))
    releaseOld()
    await older
    // Let response.json(), React state updates and rendering finish before
    // asserting absence. The old response must actually reach the component.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(await nav.getByLabel("1 unread changes", { exact: true }).count(), 0,
      "An older notification response must not restore a stale unread badge after a newer refresh. Preserve AppShell's latest-refresh guard (owner-authorized repair, 2026-10-29).")
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    await nav.getByLabel("2 unread changes", { exact: true }).waitFor()
    await page.evaluate(() => window.dispatchEvent(new Event("memory-changes")))
    await nav.getByLabel("2 unread changes", { exact: true }).waitFor({ state: "hidden" })
    assert.deepEqual(errors, [])
    console.log("Unread refresh UI passed: older responses ignored after newer reads; subsequent focus and change refreshes still update the badge")
  } finally {
    releaseOld()
    await context.close()
  }
}

export async function verifyProjectMemoryUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const base = "http://localhost:5173/#", api = "http://localhost:3011/api"
  const scope = "Project memory UI synthetic scope"
  const ids = []
  const errors = []
  const expectedFailures = ["503", "Failed to load resource"]
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error" && !expectedFailures.some(text => message.text().includes(text))) errors.push(message.text()) })
  const post = async (path, data) => {
    const response = await page.request.post(api + path, { data }); assert.ok(response.ok(), await response.text()); return response.json()
  }
  const put = async (path, data) => {
    const response = await page.request.put(api + path, { data }); assert.ok(response.ok(), await response.text()); return response.json()
  }
  const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  try {
    const meta = await (await page.request.get(api + "/metadata")).json()
    const old = await post("/decisions", { title: "UI Atlas exports use local disk", appliesTo: [scope], ownerId: meta.currentUser.id })
    ids.push(old.id)
    // The browser uses the normal capture form, with integrations unavailable.
    await page.route("**/api/decisions/memory-search", route => route.fulfill({ json: { matches: [], candidateCount: 0 } }))
    await page.goto(`${base}/scopes?${new URLSearchParams({ scope })}`)
    await page.getByRole("button", { name: "New decision in this scope", exact: true }).click()
    await page.getByText("Paste meeting notes or discussion", { exact: true }).click()
    const excerpt = "Keep Atlas exports in object storage.\nReason: workers restart.\nQuestion: Who reviews retention?"
    await page.getByLabel("Notes origin (your label)").fill("Synthetic Atlas meeting")
    await page.getByLabel("Pasted notes", { exact: true }).fill(excerpt)
    await page.getByRole("button", { name: "Review candidate 1", exact: true }).click()
    assert.equal(await page.getByLabel(/What did you decide/).inputValue(), "Keep Atlas exports in object storage.")
    await page.getByLabel("Why? (optional)", { exact: true }).fill("Workers restart; durable exports survive.")
    await page.getByRole("combobox").filter({ hasText: "Unassigned" }).click()
    await page.getByRole("option", { name: meta.currentUser.displayName, exact: true }).click()
    await page.getByText("More details", { exact: true }).click()
    await page.getByLabel("Owner contact context (optional)").fill("Ask during synthetic Atlas planning.")
    let failSave = true
    await page.route("**/api/decisions", route => route.request().method() === "POST" && failSave
      ? route.fulfill({ status: 503, json: { error: "Synthetic failed save; draft retained." } }) : route.continue())
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    await page.getByText("Synthetic failed save; draft retained.", { exact: true }).waitFor()
    assert.equal(await page.getByLabel("Pasted notes", { exact: true }).inputValue(), excerpt)
    await page.reload()
    await page.getByRole("button", { name: "Restore draft", exact: true }).click()
    await page.getByText("Paste meeting notes or discussion", { exact: true }).click()
    assert.equal(await page.getByLabel("Pasted notes", { exact: true }).inputValue(), excerpt)
    assert.equal(await page.getByLabel(/What did you decide/).inputValue(), "Keep Atlas exports in object storage.")
    failSave = false
    const savedResponse = page.waitForResponse(response => response.url().endsWith("/api/decisions") && response.request().method() === "POST" && response.ok())
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    const saved = await (await savedResponse).json(); ids.push(saved.id)
    await page.getByRole("heading", { name: saved.outcome, exact: true }).waitFor()
    assert.equal(saved.sources[0].anchorText, excerpt)
    assert.equal(saved.sources[0].provider, "PASTED_NOTES")
    await page.getByText(/Supplied excerpt preserved as pasted notes/).waitFor()
    await page.getByRole("button", { name: "Follow decision", exact: true }).click()
    await page.getByRole("button", { name: "Unfollow decision", exact: true }).waitFor()
    await page.getByRole("button", { name: "Mark important for project brief", exact: true }).click()
    await page.getByRole("button", { name: "Remove from project brief", exact: true }).waitFor()
    await post(`/decisions/${saved.id}/supersede`, { targetId: old.id, replacementReason: "Workers restart; local disk is temporary." })
    await page.goto(`${base}/?${new URLSearchParams({ q: "UI Atlas exports use local disk", appliesTo: scope })}`)
    await page.getByText("Current answer candidates and evidence", { exact: true }).click()
    const answer = page.locator("details").filter({ has: page.getByText("Current answer candidates and evidence", { exact: true }) })
    await answer.getByText("Historical choice", { exact: true }).waitFor()
    await answer.getByText("Current recorded choice", { exact: true }).waitFor()
    await answer.getByRole("link", { name: `${saved.decisionKey} · ${saved.outcome}`, exact: true }).first().waitFor()
    await page.screenshot({ path: "/private/tmp/project-memory-answer-desktop.png", fullPage: true })
    await page.goto(`${base}/scopes?${new URLSearchParams({ scope })}`)
    const brief = page.getByRole("region", { name: "Project brief", exact: true })
    await brief.getByRole("link", { name: `${saved.decisionKey} · ${saved.outcome}`, exact: true }).waitFor()
    await brief.getByText(/Workers restart; durable exports survive/).waitFor()
    await brief.getByText(/Ask during synthetic Atlas planning/).waitFor()
    await brief.getByText(/Workers restart; local disk is temporary/).waitFor()
    await page.getByRole("button", { name: "Follow scope", exact: true }).click()
    await page.getByRole("button", { name: "Unfollow scope", exact: true }).waitFor()
    const questionText = "Who reviews Atlas retention before cleanup?"
    await page.goto(`${base}/?${new URLSearchParams({ q: questionText, appliesTo: scope })}`)
    await page.getByRole("button", { name: "Record unanswered question", exact: true }).click()
    assert.equal(await page.getByLabel(/What needs to be decided/).inputValue(), questionText)
    await page.getByRole("combobox").filter({ hasText: "Unassigned" }).click()
    await page.getByRole("option", { name: meta.currentUser.displayName, exact: true }).click()
    const questionResponse = page.waitForResponse(response => response.url().endsWith("/api/decisions") && response.request().method() === "POST" && response.ok())
    await page.getByRole("button", { name: "Save Decision", exact: true }).click()
    const question = await (await questionResponse).json(); ids.push(question.id)
    assert.deepEqual(question.appliesTo, [scope]); assert.equal(question.owner.id, meta.currentUser.id)
    await page.getByRole("heading", { name: questionText, exact: true }).waitFor()
    await page.getByRole("button", { name: "Follow decision", exact: true }).click()
    await page.getByRole("button", { name: "Unfollow decision", exact: true }).waitFor()
    await page.goto(`${base}/scopes?${new URLSearchParams({ scope })}`)
    await brief.getByRole("link", { name: `${question.decisionKey} · ${questionText}`, exact: true }).waitFor()
    await page.screenshot({ path: "/private/tmp/project-memory-brief-desktop.png", fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 }); await fits()
    await page.screenshot({ path: "/private/tmp/project-memory-brief-mobile.png", fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await put(`/decisions/${question.id}`, { title: questionText, decisionState: "PENDING", appliesTo: [scope], ownerId: meta.currentUser.id, references: [{ kind: "URL", url: "https://example.com/synthetic-retention", label: "Review agreement" }] })
    await page.goto(`${base}/decisions/${question.id}`)
    await page.getByRole("button", { name: "Record decision", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Record decision", exact: true })
    await dialog.getByLabel("What did you decide?").fill("Atlas support reviews retention before cleanup")
    await dialog.getByLabel(/Why/).fill("Support owns the recovery window.")
    await dialog.getByRole("button", { name: "Record decision", exact: true }).click()
    await page.getByRole("heading", { name: "Atlas support reviews retention before cleanup", exact: true }).waitFor()
    await page.getByRole("link", { name: "Review agreement", exact: true }).waitFor()
    await page.goto(`${base}/changes`)
    await page.getByText("Question answered", { exact: true }).waitFor()
    await page.getByText(/Support owns the recovery window/).waitFor()
    await page.getByRole("button", { name: "Mark displayed changes read", exact: true }).click()
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('[data-slot="badge"]')).some(el => el.textContent === "Unread"))
    await page.screenshot({ path: "/private/tmp/project-memory-changes-desktop.png", fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 }); await fits()
    await page.screenshot({ path: "/private/tmp/project-memory-changes-mobile.png", fullPage: true })
    // Unfollow all through explicit controls; subsequent changes cannot reappear.
    while (await page.getByRole("button", { name: "Unfollow", exact: true }).count()) {
      const count = await page.getByRole("button", { name: "Unfollow", exact: true }).count()
      await page.getByRole("button", { name: "Unfollow", exact: true }).first().click()
      await page.waitForFunction(n => Array.from(document.querySelectorAll('button')).filter(el => el.textContent === "Unfollow").length < n, count)
    }
    await post(`/decisions/${question.id}/decide`, { outcome: "Atlas support reviews retention before cleanup", why: "Support owns the recovery window." })
    await page.getByRole("button", { name: "Refresh changes", exact: true }).click()
    await page.getByText(/No changes since you started following/).waitFor()
    await fits(); assert.deepEqual(errors, [])
    assert.equal(await page.title(), "Decision Memory")
    assert.equal(await page.locator("vite-error-overlay").count(), 0)
    console.log("Project memory browser QA passed: scoped current evidence, pasted-source review/draft/save recovery, owner brief and open questions, owned completion, explicit follows/read/unfollow and desktop/mobile")
  } finally {
    for (const id of ids) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
    await models.sequelize.query("DELETE FROM memory_follows WHERE workspace_id=:workspaceId AND (target=:scope OR target IN (:ids))", { replacements: { workspaceId: workspace.id, scope, ids: ids.length ? ids : ["none"] } })
    await context.close()
  }
}
