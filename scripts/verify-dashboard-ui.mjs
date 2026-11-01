import assert from "node:assert/strict"

// Team memory dashboard: the question and gap blocks lead, drill-downs and the
// search-gap loop work, collection can be switched, and the phone layout fits.
export async function verifyDashboardUi({ browser, models, workspace }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const api = "http://localhost:3011/api", base = "http://localhost:5173/#"
  const scope = "Dashboard UI synthetic scope", gapQuery = "synthetic dashboard gap", feedbackQuery = "synthetic unhelpful dashboard search"
  const ids = [], errors = []
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
  const create = async data => {
    const response = await page.request.post(`${api}/decisions`, { data })
    assert.equal(response.status(), 201)
    const result = await response.json(); ids.push(result.id); return result
  }
  const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  const meta = await (await page.request.get(`${api}/metadata`)).json()
  const initialTracking = Boolean(meta.features.usageTracking)
  try {
    const question = await create({ title: "Dashboard question: who signs off the synthetic retention window?", decisionState: "PENDING", appliesTo: [scope], ownerId: meta.currentUser.id, dueDate: "2020-01-01" })
    const choice = await create({ title: "Dashboard choice", outcome: "Keep synthetic dashboard exports in object storage", appliesTo: [scope], ownerId: meta.currentUser.id })
    assert.equal((await page.request.put(`${api}/dashboard/tracking`, { data: { enabled: true } })).status(), 200)

    // A full page open is recorded once; the dashboard counts it.
    const viewed = page.waitForResponse(response => response.url().endsWith("/api/usage/views") && response.status() === 202)
    await page.goto(`${base}/decisions/${choice.id}`)
    assert.equal((await (await viewed).json()).recorded, true)
    assert.equal((await page.request.post(`${api}/usage/searches`, { data: { query: gapQuery, scope, method: "KEYWORD", outcome: "NO_RESULTS", resultCount: 0 } })).status(), 202)

    await page.goto(`${base}/dashboard?${new URLSearchParams({ appliesTo: scope, days: "30" })}`)
    await page.getByRole("heading", { name: "Team memory", level: 1 }).waitFor()
    await page.getByText("1 question is past due; 1 search found nothing in the last 30 days.", { exact: true }).waitFor()
    const owners = page.getByRole("region", { name: "Questions waiting on an owner" })
    const gaps = page.getByRole("region", { name: "Searches that found nothing" })
    // Both leading blocks start on the first laptop screen.
    for (const block of [owners, gaps]) assert.ok((await block.boundingBox()).y < 300)
    await owners.getByRole("link", { name: question.title, exact: true }).waitFor()
    await page.getByRole("region", { name: "Most consulted decisions" }).getByText("1 open", { exact: true }).waitFor()

    await owners.getByRole("button", { name: "1 past due", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: `${meta.currentUser.displayName}: past due` })
    await sheet.getByText(question.title, { exact: true }).click()
    await page.getByRole("heading", { name: question.title, level: 1 }).waitFor()
    await page.goBack()

    await gaps.getByText(`“${gapQuery}”`, { exact: true }).waitFor()
    await gaps.getByRole("button", { name: "Record as question", exact: true }).click()
    assert.equal(await page.getByLabel(/What needs to be decided\?/).inputValue(), gapQuery)
    await page.goBack()
    await gaps.getByRole("button", { name: `Remove search “${gapQuery}”`, exact: true }).click()
    await gaps.getByText("Every recorded search in this period found something.", { exact: true }).waitFor()

    // Explicit "not what I needed" feedback becomes a gap.
    await page.goto(`${base}/?${new URLSearchParams({ q: feedbackQuery, appliesTo: scope })}`)
    await page.getByRole("button", { name: "Not what I needed", exact: true }).click()
    await page.getByText("Noted for the team Dashboard", { exact: true }).waitFor()
    await page.goto(`${base}/dashboard?${new URLSearchParams({ appliesTo: scope, days: "30" })}`)
    await gaps.getByText("1 search · 1 not helpful", { exact: false }).waitFor()

    await page.getByRole("button", { name: "Turn off collection", exact: true }).click()
    await page.getByText(/Usage collection is off\./).first().waitFor()
    assert.equal((await (await page.request.get(`${api}/metadata`)).json()).features.usageTracking, false)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("heading", { name: "Team memory", level: 1 }).waitFor()
    await fits()
    assert.deepEqual(errors, [])
    console.log("Dashboard UI passed: leading question/gap blocks, finding line, drill-down to record, gap to pre-filled question, removal, feedback, collection switch, phone fit")
  } finally {
    await context.close()
    await models.sequelize.query("DELETE FROM search_events WHERE workspace_id = :workspaceId AND query IN (:queries)",
      { replacements: { workspaceId: workspace.id, queries: [gapQuery, feedbackQuery] } })
    await models.sequelize.query("UPDATE workspaces SET usage_tracking_enabled = :enabled WHERE id = :workspaceId",
      { replacements: { enabled: initialTracking, workspaceId: workspace.id } })
    for (const id of ids) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  }
}
