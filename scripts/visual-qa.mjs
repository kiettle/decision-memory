import assert from "node:assert/strict"
import { chromium } from "playwright-core"

import { config } from "../apps/server/src/config.js"
import { createDatabase } from "../apps/server/src/models.js"
import { verifyDeadlineUi } from "./verify-deadline-ui.mjs"
import { verifyProposalUi } from "./verify-proposal-ui.mjs"

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
})

const consoleErrors = []
const pageErrors = []
const understandingFixtureIds = []
const formFixtureTitle = "Prefer boring architecture for the competitive demo"
const models = createDatabase(config.databaseUrl, false)
// The fixture is removed before and after the run so the demo dataset stays clean.
const workspace = await models.Workspace.findOne({ where: { externalKey: config.localWorkspaceId } })
assert.ok(workspace, "Seed the isolated UI database before running verification")
const removeFormFixture = () =>
  models.Decision.destroy({ where: { workspaceId: workspace.id, title: formFixtureTitle } })
await removeFormFixture()
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } })
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text())
})
page.on("pageerror", (error) => pageErrors.push(error.message))

try {
  const memoryDecisionResponse = await page.request.get(
    "http://localhost:3011/api/decisions/33333333-3333-4333-8333-333333333301",
  )
  const memoryDecision = await memoryDecisionResponse.json()
  await page.route("**/api/metadata", async (route) => {
    const response = await route.fetch()
    const metadata = await response.json()
    await route.fulfill({
      response,
      json: { ...metadata, features: { ...metadata.features, memorySearch: true, jira: true } },
    })
  })
  // Jira Cloud is mocked; the dialog, the request it sends, and the result are real.
  const jiraRequests = []
  await page.route("**/api/jira/projects", (route) =>
    route.fulfill({ json: [{ key: "MIG", name: "Migration" }] }))
  await page.route("**/api/jira/projects/MIG/issue-types", (route) =>
    route.fulfill({ json: [{ id: "10002", name: "Story" }, { id: "10001", name: "Task" }] }))
  await page.route("**/api/decisions/*/jira-issue", async (route) => {
    jiraRequests.push(route.request().postDataJSON())
    const url = "https://example.atlassian.net/browse/MIG-183"
    await route.fulfill({
      status: 201,
      json: {
        issue: { key: "MIG-183", url },
        decision: { ...memoryDecision, references: [...memoryDecision.references, { id: "jira-new", kind: "JIRA", label: "MIG-183", url }] },
      },
    })
  })
  let memoryCalls = 0
  await page.route("**/api/decisions/memory-search", async (route) => {
    memoryCalls++
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        candidateCount: 9,
        matches: [
          {
            decisionId: memoryDecision.id,
            score: 96,
            explanation: "This Decision moved large migration rollback files away from the database host.",
            matchedConcepts: ["migration files", "timeouts", "rollback"],
            decision: memoryDecision,
          },
        ],
      },
    })
  })

  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" })
  await page.getByRole("heading", { name: "Decision Library" }).waitFor()
  assert.match(await page.locator("body").innerText(), /Use object storage for migration backup files/)
  await page.screenshot({ path: "/private/tmp/decision-memory-library-desktop.png", fullPage: true })

  // The full table must fit before switching away from stacked list rows.
  for (const width of [1280, 1366, 1440, 1536]) {
    await page.setViewportSize({ width, height: 1024 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Library must fit ${width}px`)
    assert.equal(await page.locator(".decision-row").first().evaluate((row) =>
      Array.from(row.children).every((cell) => cell.getBoundingClientRect().right <= innerWidth)
    ), true, `Every library column/action must remain visible at ${width}px`)
    assert.equal(await page.locator(".decision-list-header").isVisible(), width === 1536)
    if (width === 1280) await page.screenshot({ path: "/private/tmp/decision-memory-library-laptop-fixed.png" })
  }

  const search = page.getByRole("textbox", { name: "Search decisions" })
  await search.fill("Maya Chen")
  await page.waitForTimeout(350)
  assert.equal((await page.locator(".decision-row").count()) >= 2, true)

  await search.fill("Hồi trước mình xử lý file migration lớn hay timeout như thế nào?")
  await page.waitForTimeout(350)
  assert.equal(await page.locator(".decision-row").count(), 0)
  await page.getByRole("button", { name: "Search by memory" }).click()
  await page.getByText("Local semantic match", { exact: true }).first().waitFor()
  assert.match(
    await page.locator("body").innerText(),
    /moved large migration rollback files away from the database host/,
  )
  await page.screenshot({ path: "/private/tmp/decision-memory-search-desktop.png", fullPage: true })

  await page.getByText("Use object storage for migration backup files", { exact: true }).click()
  await page.getByRole("heading", { name: "Use object storage for migration backup files" }).waitFor()
  await page.goBack()
  await page.getByText("Local semantic match", { exact: true }).first().waitFor()
  assert.equal(memoryCalls, 1, "Returning to memory results must not rerun semantic search")
  assert.match(await search.inputValue(), /Hồi trước/)

  // Recent has its own state; browser Back still restores the library search.
  await page.getByRole("link", { name: "Recent", exact: true }).click()
  await page.getByRole("heading", { name: "Recent Decisions", exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll(".decision-row").length === 5)
  assert.equal(await search.inputValue(), "")
  assert.equal(await page.getByText("Local semantic match", { exact: true }).count(), 0)
  await page.screenshot({ path: "/private/tmp/decision-memory-recent-fixed.png" })
  await page.goBack()
  await page.getByText("Local semantic match", { exact: true }).first().waitFor()
  assert.equal(memoryCalls, 1, "Back restores cached library memory results without another search")
  assert.match(await search.inputValue(), /Hồi trước/)

  await search.fill("migration storage")
  await page.waitForTimeout(350)
  assert.match(await page.locator("body").innerText(), /Use object storage for migration backup files/)

  await search.fill("")
  await page.waitForTimeout(350)
  assert.match(await page.locator("body").innerText(), /DM-102 · Superseded by DM-104/)
  // The Slack channel is filled in automatically and shown on the library row.
  assert.match(await page.locator("body").innerText(), /#platform-decisions/)

  // Matches each word: DM-104, DM-110, and DM-105 (options + storage tag).
  await search.fill("object storage")
  await page.waitForTimeout(350)
  assert.equal(await page.locator(".decision-row").count(), 3)
  await page.getByText("Use object storage for migration backup files", { exact: true }).click()
  await page.getByRole("heading", { name: "Relevant Discussion" }).waitFor()
  const detailText = await page.locator("body").innerText()
  assert.match(detailText, /Discussed in #platform-decisions/)
  assert.match(detailText, /Slack · #platform-decisions/)
  assert.match(await page.locator("body").innerText(), /Lifecycle/)
  assert.equal(await page.locator(".source-message").count(), 5)
  await page.getByRole("button", { name: "View captured discussion (7)" }).click()
  await page.getByRole("heading", { name: "Captured Slack discussion" }).waitFor()
  assert.equal(await page.locator('[role="dialog"] .source-message').count(), 7)
  await page.waitForTimeout(200)
  await page.screenshot({ path: "/private/tmp/decision-memory-detail-desktop.png" })
  await page.keyboard.press("Escape")

  // Create Jira issue: the single project is chosen, "Task" is preferred, and
  // the summary is the Decision; the new key appears under Related Work.
  await page.getByRole("button", { name: "Create Jira issue" }).click()
  await page.getByRole("heading", { name: "Create a Jira issue" }).waitFor()
  await page.getByText("Task", { exact: true }).waitFor()
  assert.equal(await page.getByLabel("Summary").inputValue(), "Use object storage for migration backup files")
  await page.getByRole("button", { name: "Create issue" }).click()
  await page.getByText("Created MIG-183.").waitFor()
  assert.match(jiraRequests[0].requestId, /^[0-9a-f-]{36}$/)
  assert.deepEqual(jiraRequests.map(({ requestId, ...input }) => { assert.ok(requestId); return input }), [{ projectKey: "MIG", issueTypeId: "10001", summary: "Use object storage for migration backup files" }])
  await page.getByRole("link", { name: "MIG-183" }).waitFor()

  await page.getByRole("link", { name: "Decisions", exact: true }).click()
  await page.getByText("New Decision", { exact: true }).click()
  await page.getByRole("heading", { name: "New Decision" }).waitFor()
  await page.getByRole("button", { name: "Already decided", exact: true }).click()
  await page.getByLabel(/What (did you decide|needs to be decided)\?/).fill(formFixtureTitle)
  await page.getByText("More details", { exact: true }).click()
  await page.getByLabel("Why").fill("A single service and database keep the demo easy to understand and rehearse.")
  await page.getByLabel("Context").fill("The team is optimizing for a reliable live demonstration before deployment work.")
  await page.screenshot({ path: "/private/tmp/decision-memory-new-desktop.png", fullPage: true })
  // Type key by key: list fields must keep spaces, commas, and new lines.
  await page.getByLabel("Applies To").pressSequentially("Migration Service, Billing")
  await page.getByLabel("Tags").pressSequentially("architecture, demo prep")
  await page.getByLabel("Options Considered").pressSequentially("Microservices\nSingle service")
  assert.equal(await page.getByLabel("Applies To").inputValue(), "Migration Service, Billing")
  assert.equal(await page.getByLabel("Options Considered").inputValue(), "Microservices\nSingle service")
  await page.getByRole("button", { name: "Add link" }).click()
  await page.getByRole("textbox", { name: "Related link 1 label" }).fill("Demo architecture notes")
  await page.getByRole("textbox", { name: "Related link 1 URL" }).fill("https://example.com/demo-architecture")
  await page.getByRole("button", { name: "Save Decision" }).click()
  await page.getByRole("heading", { name: formFixtureTitle }).waitFor()
  assert.match(page.url(), /#\/decisions\//)
  const createdText = await page.locator("body").innerText()
  for (const expected of ["Migration Service", "Billing", "architecture, demo prep", "Microservices", "Single service"]) {
    assert.match(createdText, new RegExp(expected))
  }

  await page.getByText("Edit", { exact: true }).click()
  await page.getByRole("heading", { name: "Edit Decision" }).waitFor()
  assert.equal(await page.getByLabel("Applies To").inputValue(), "Migration Service, Billing")
  await page.getByRole("textbox", { name: "Related link 1 label" }).fill("Updated demo architecture notes")
  await page.getByRole("textbox", { name: "Related link 1 URL" }).fill("https://example.com/demo-architecture-updated")
  await page.getByRole("button", { name: "Save Decision" }).click()
  await page.getByText("Updated demo architecture notes", { exact: true }).waitFor()
  await page.screenshot({ path: "/private/tmp/decision-memory-detail-edited-desktop.png", fullPage: true })

  await page.goto(
    "http://localhost:5173/#/decisions/33333333-3333-4333-8333-333333333303",
    { waitUntil: "networkidle" },
  )
  await page.getByRole("heading", { name: "Store migration exports on the database host" }).waitFor()
  assert.equal(await page.getByRole("button", { name: "Supersede" }).count(), 0)
  // A replaced Decision says so at the top and links to the current one.
  await page.getByText("This Decision was replaced", { exact: false }).click()
  await page.getByRole("heading", { name: "Use object storage for migration backup files" }).waitFor()
  assert.equal(await page.getByText("This Decision was replaced", { exact: false }).count(), 0)
  await page.getByText("Back to decisions", { exact: true }).click()
  await page.getByRole("heading", { name: "Decision Library" }).waitFor()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" })
  await page.getByRole("heading", { name: "Decision Library" }).waitFor()
  await page.screenshot({ path: "/private/tmp/decision-memory-library-mobile.png", fullPage: true })
  assert.equal(await page.locator(".desktop-sidebar").isVisible(), false)
  assert.equal(await page.locator(".mobile-header").isVisible(), true)

  // All existing routes are reachable through the mobile navigation sheet.
  const navigationTrigger = page.getByRole("button", { name: "Open navigation", exact: true })
  await navigationTrigger.click()
  const navigationDialog = page.getByRole("dialog", { name: "Navigation", exact: true })
  await navigationDialog.waitFor()
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" })
  assert.equal(await mobileNavigation.getByRole("link").count(), 5)
  await page.waitForTimeout(200)
  await page.screenshot({ path: "/private/tmp/decision-memory-mobile-navigation-fixed.png" })
  await mobileNavigation.getByRole("link", { name: "Recent", exact: true }).click()
  await navigationDialog.waitFor({ state: "hidden" })
  await page.getByRole("heading", { name: "Recent Decisions", exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll(".decision-row").length === 5)
  await navigationTrigger.click()
  await mobileNavigation.getByRole("link", { name: "Settings", exact: true }).click()
  await navigationDialog.waitFor({ state: "hidden" })
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor()
  await navigationTrigger.click()
  assert.equal(await mobileNavigation.getByRole("link", { name: "Settings", exact: true }).getAttribute("aria-current"), "page")
  await page.keyboard.press("Escape")
  await navigationDialog.waitFor({ state: "hidden" })
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Open navigation")
  await page.keyboard.press("Enter")
  await navigationDialog.waitFor()
  await mobileNavigation.getByRole("link", { name: "Decisions", exact: true }).click()
  await navigationDialog.waitFor({ state: "hidden" })
  await page.getByRole("heading", { name: "Decision Library", exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)

  await page.goto(
    "http://localhost:5173/#/decisions/33333333-3333-4333-8333-333333333301",
    { waitUntil: "networkidle" },
  )
  await page.getByRole("button", { name: "View captured discussion (7)" }).click()
  await page.getByRole("heading", { name: "Captured Slack discussion" }).waitFor()
  await page.waitForTimeout(200)
  await page.screenshot({ path: "/private/tmp/decision-memory-discussion-mobile.png" })

  // P0: a failed lifecycle destination must never display the previous record.
  const failurePage = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const oldId = "33333333-3333-4333-8333-333333333303"
  await failurePage.goto("http://localhost:5173/#/decisions/33333333-3333-4333-8333-333333333301")
  await failurePage.getByRole("heading", { name: "Use object storage for migration backup files", exact: true }).waitFor()
  await failurePage.route(`**/api/decisions/${oldId}`, (route) => route.fulfill({ status: 503, json: { error: "Temporary detail failure" } }))
  await failurePage.getByRole("link", { name: /Supersedes DM-102/ }).click()
  await failurePage.getByRole("heading", { name: "Could not load Decision" }).waitFor()
  assert.equal(await failurePage.getByRole("heading", { name: "Use object storage for migration backup files", exact: true }).count(), 0)
  assert.equal(await failurePage.locator('a[href$="/edit"]').count(), 0)
  await failurePage.screenshot({ path: "/private/tmp/decision-memory-p0-detail-error.png" })
  await failurePage.unroute(`**/api/decisions/${oldId}`)
  await failurePage.getByRole("button", { name: "Try again" }).click()
  await failurePage.getByRole("heading", { name: "Store migration exports on the database host", exact: true }).waitFor()
  await failurePage.reload()
  await failurePage.getByRole("heading", { name: "Store migration exports on the database host", exact: true }).waitFor()
  // An edit load failure cannot expose an empty saveable form.
  await failurePage.route(`**/api/decisions/${oldId}`, (route) => route.fulfill({ status: 503, json: { error: "Temporary form failure" } }))
  await failurePage.evaluate((id) => { location.hash = `#/decisions/${id}/edit` }, oldId)
  await failurePage.getByRole("heading", { name: "Could not load Decision form" }).waitFor()
  assert.equal(await failurePage.getByRole("button", { name: "Save Decision" }).count(), 0)
  await failurePage.unroute(`**/api/decisions/${oldId}`)
  await failurePage.getByRole("button", { name: "Try again" }).click()
  await failurePage.getByRole("heading", { name: "Edit Decision", exact: true }).waitFor()
  assert.equal(await failurePage.getByLabel(/What (did you decide|needs to be decided)\?/).inputValue(), "Store migration exports on the database host")
  await failurePage.evaluate(() => { location.hash = "#/decisions/new" })
  await failurePage.getByRole("heading", { name: "New Decision", exact: true }).waitFor()
  assert.equal(await failurePage.getByLabel(/What (did you decide|needs to be decided)\?/).inputValue(), "")

  // An old AI response cannot replace the newer keyword query.
  await failurePage.route("**/api/metadata", async (route) => {
    const response = await route.fetch()
    const metadata = await response.json()
    await route.fulfill({ response, json: { ...metadata, features: { memorySearch: true } } })
  })
  let completeMemory
  const pendingMemory = new Promise((resolve) => { completeMemory = resolve })
  let memoryStarted
  const memoryRequestStarted = new Promise((resolve) => { memoryStarted = resolve })
  await failurePage.route("**/api/decisions/memory-search", async (route) => {
    memoryStarted()
    await pendingMemory
    await route.fulfill({ json: { candidateCount: 9, matches: [{ decisionId: memoryDecision.id, score: 90, explanation: "STALE MEMORY RESULT", matchedConcepts: [], decision: memoryDecision }] } })
  })
  await failurePage.goto("http://localhost:5173/")
  const memorySearch = failurePage.getByRole("textbox", { name: "Search decisions" })
  await memorySearch.fill("migration")
  await failurePage.getByRole("button", { name: "Search by memory" }).click()
  await memoryRequestStarted
  await memorySearch.fill("billing")
  const completed = failurePage.waitForResponse("**/api/decisions/memory-search")
  completeMemory()
  await completed
  await failurePage.getByText("Keep billing orchestration in the existing service", { exact: true }).waitFor()
  assert.equal(await failurePage.getByText("STALE MEMORY RESULT", { exact: true }).count(), 0)
  await memorySearch.fill(formFixtureTitle)
  // The fixture is already visible in the unfiltered list; wait for the
  // debounced search to narrow the rows before reading them.
  await failurePage.waitForFunction(() => document.querySelectorAll(".decision-row").length === 1)
  await failurePage.getByText(formFixtureTitle, { exact: true }).waitFor()
  assert.match(await failurePage.locator(".decision-row").innerText(), /Migration Service · Billing/)
  await failurePage.screenshot({ path: "/private/tmp/decision-memory-p1-library-scopes.png" })
  await failurePage.close()

  // Metadata failures must be disclosed and recover without a page reload.
  const settingsFailurePage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  let metadataUnavailable = true
  await settingsFailurePage.route("**/api/metadata", (route) => metadataUnavailable
    ? route.fulfill({ status: 503, json: { error: "Temporary connection status failure" } })
    : route.continue())
  await settingsFailurePage.goto("http://localhost:5173/#/settings")
  await settingsFailurePage.getByText("Could not load connections", { exact: true }).waitFor()
  assert.equal(await settingsFailurePage.getByText("Checking…", { exact: true }).count(), 0)
  const failedRetry = settingsFailurePage.waitForResponse("**/api/metadata")
  await settingsFailurePage.getByRole("button", { name: "Try again", exact: true }).click()
  await failedRetry
  await settingsFailurePage.getByText("Could not load connections", { exact: true }).waitFor()
  await settingsFailurePage.screenshot({ path: "/private/tmp/decision-memory-settings-error-fixed.png" })
  metadataUnavailable = false
  await settingsFailurePage.getByRole("button", { name: "Try again", exact: true }).click()
  await settingsFailurePage.locator("main").getByText("Acme Engineering", { exact: true }).waitFor()
  assert.equal(await settingsFailurePage.getByText("Could not load connections", { exact: true }).count(), 0)
  assert.equal(await settingsFailurePage.getByText("Checking…", { exact: true }).count(), 0)
  await settingsFailurePage.screenshot({ path: "/private/tmp/decision-memory-settings-recovered.png" })
  await settingsFailurePage.close()

  // A memory request completing after navigation cannot redirect Recent.
  const navigationRacePage = await browser.newPage({ viewport: { width: 1536, height: 1024 } })
  let releaseMemory
  const delayedMemory = new Promise((resolve) => { releaseMemory = resolve })
  let startMemory
  const memoryStartedForNavigation = new Promise((resolve) => { startMemory = resolve })
  await navigationRacePage.route("**/api/metadata", async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({ response, json: { ...data, features: { ...data.features, memorySearch: true } } })
  })
  await navigationRacePage.route("**/api/decisions/memory-search", async (route) => {
    startMemory()
    await delayedMemory
    await route.fulfill({ json: { candidateCount: 9, matches: [{ decisionId: memoryDecision.id, decision: memoryDecision, score: 90, explanation: "OLD NAVIGATION RESULT", matchedConcepts: [] }] } })
  })
  await navigationRacePage.goto("http://localhost:5173/")
  await navigationRacePage.getByRole("textbox", { name: "Search decisions" }).fill("migration")
  await navigationRacePage.getByRole("button", { name: "Search by memory", exact: true }).click()
  await memoryStartedForNavigation
  await navigationRacePage.getByRole("link", { name: "Recent", exact: true }).click()
  await navigationRacePage.getByRole("heading", { name: "Recent Decisions", exact: true }).waitFor()
  await navigationRacePage.waitForFunction(() => document.querySelectorAll(".decision-row").length === 5)
  const staleNavigationResponse = navigationRacePage.waitForResponse("**/api/decisions/memory-search")
  releaseMemory()
  await staleNavigationResponse
  await navigationRacePage.waitForLoadState("networkidle")
  assert.match(navigationRacePage.url(), /#\/recent$/)
  assert.equal(await navigationRacePage.getByText("OLD NAVIGATION RESULT", { exact: true }).count(), 0)
  assert.equal(await navigationRacePage.locator(".decision-row").count(), 5)
  await navigationRacePage.close()
  console.log("Demo readiness regressions passed: laptop layouts, Recent state/history/races, mobile navigation/focus, Settings failure/retry")

  // Explicit Gemini action shares the filters, identifies its bounded coverage,
  // restores cached results, and leaves local search usable after a failure.
  const geminiPage = await browser.newPage({ viewport: { width: 1536, height: 1024 } })
  const geminiPageErrors = []
  const geminiConsoleErrors = []
  geminiPage.on("pageerror", (error) => geminiPageErrors.push(error.message))
  geminiPage.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && !/Failed to load resource.*503/.test(message.text())) geminiConsoleErrors.push(message.text())
  })
  await geminiPage.route("**/api/metadata", async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({ response, json: { ...data, features: { ...data.features, memorySearch: true, geminiMemorySearch: true } } })
  })
  const geminiCalls = []
  let geminiFailure = false
  await geminiPage.route("**/api/decisions/memory-search", async (route) => {
    const input = route.request().postDataJSON()
    geminiCalls.push(input)
    if (input.method === "GEMINI" && geminiFailure) {
      await route.fulfill({ status: 503, json: { error: "Gemini is rate limited. Local search is still available." } })
      return
    }
    await route.fulfill({ json: { method: input.method, candidateCount: input.method === "GEMINI" ? 200 : 9,
      totalCandidateCount: input.method === "GEMINI" ? 245 : 9, truncated: input.method === "GEMINI",
      matches: [{ decisionId: memoryDecision.id, score: 90, explanation: "Verified stored migration choice", matchedConcepts: ["migration"], decision: memoryDecision }] } })
  })
  const geminiFilters = { channel: "platform-decisions", ownerId: "22222222-2222-4222-8222-222222222222", tag: "storage", status: "ACTIVE", appliesTo: "Atlas migration", dateRange: "90" }
  await geminiPage.goto(`http://localhost:5173/#/?${new URLSearchParams({ q: "migration", ...geminiFilters })}`)
  assert.equal(geminiCalls.length, 0, "Typing/loading never sends content to Gemini")
  await geminiPage.getByRole("button", { name: "Search with Gemini", exact: true }).click()
  await geminiPage.getByText("Gemini AI match", { exact: true }).first().waitFor()
  assert.deepEqual(geminiCalls[0], { query: "migration", method: "GEMINI", filters: { ...geminiFilters, decisionState: "DECIDED", asOf: geminiCalls[0].filters.asOf, sort: "NEWEST" } })
  await geminiPage.getByText(/Gemini searched the newest 200 of 245/).waitFor()
  assert.match(await geminiPage.locator("body").innerText(), /Older matching decisions were not included/)
  assert.equal(await geminiPage.getByText(/waiting for local indexing/).count(), 0)
  await geminiPage.screenshot({ path: "/private/tmp/decision-memory-gemini-desktop.png" })
  await geminiPage.getByText(memoryDecision.title, { exact: true }).click()
  await geminiPage.getByRole("heading", { name: memoryDecision.title, exact: true }).waitFor()
  await geminiPage.getByText("Back to decisions", { exact: true }).click()
  await geminiPage.getByText("Gemini AI match", { exact: true }).first().waitFor()
  assert.equal(geminiCalls.length, 1, "Returning to Gemini results reuses the cached response")
  await geminiPage.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(button => button.textContent.includes("Search with Gemini") && !button.disabled))
  await geminiPage.setViewportSize({ width: 390, height: 844 })
  assert.equal(await geminiPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await geminiPage.screenshot({ path: "/private/tmp/decision-memory-gemini-mobile.png" })
  geminiFailure = true
  await geminiPage.getByRole("button", { name: "Search with Gemini", exact: true }).click()
  await geminiPage.getByText("Gemini is rate limited. Local search is still available.", { exact: true }).waitFor()
  await geminiPage.getByText(memoryDecision.title, { exact: true }).click()
  await geminiPage.getByRole("heading", { name: memoryDecision.title, exact: true }).waitFor()
  await geminiPage.getByText("Back to decisions", { exact: true }).click()
  await geminiPage.getByRole("heading", { name: "Decision Library", exact: true }).waitFor()
  assert.equal(await geminiPage.getByText("Gemini AI match", { exact: true }).count(), 0, "Failed re-search cannot restore an older cached AI result")
  await geminiPage.getByRole("button", { name: "Search by memory", exact: true }).click()
  await geminiPage.getByText("Local semantic match", { exact: true }).first().waitFor()
  assert.equal(geminiCalls.at(-1).method, "LOCAL")
  assert.deepEqual(geminiCalls.at(-1).filters, { ...geminiFilters, decisionState: "DECIDED", asOf: geminiCalls[0].filters.asOf, sort: "NEWEST" })
  await geminiPage.getByRole("button", { name: "Back to normal results", exact: true }).click()
  let finishGemini
  const heldGemini = new Promise((resolve) => { finishGemini = resolve })
  let geminiStarted
  const startedGemini = new Promise((resolve) => { geminiStarted = resolve })
  await geminiPage.route("**/api/decisions/memory-search", async (route) => {
    geminiStarted()
    await heldGemini
    await route.fulfill({ json: { method: "GEMINI", candidateCount: 1, matches: [{ decisionId: memoryDecision.id, score: 90, explanation: "STALE GEMINI RESULT", matchedConcepts: [], decision: memoryDecision }] } })
  })
  await geminiPage.getByRole("button", { name: "Search with Gemini", exact: true }).click()
  await startedGemini
  await geminiPage.getByRole("textbox", { name: "Search decisions" }).fill("billing")
  const completedGemini = geminiPage.waitForResponse("**/api/decisions/memory-search")
  finishGemini()
  await completedGemini
  await geminiPage.waitForLoadState("networkidle")
  assert.equal(await geminiPage.getByText("STALE GEMINI RESULT", { exact: true }).count(), 0)
  assert.deepEqual(geminiPageErrors, [])
  assert.deepEqual(geminiConsoleErrors, [])
  await geminiPage.close()
  console.log("Dual memory search QA passed: explicit provider choice, all filters, Gemini cap, cached return, mobile layout, rate-limit fallback and stale response")

  const reviewPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const reviewErrors = []
  reviewPage.on("pageerror", (error) => reviewErrors.push(error.message))
  await reviewPage.goto("http://localhost:5173/#/?q=billing&status=ACTIVE")
  await reviewPage.getByText("Keep billing orchestration in the existing service", { exact: true }).waitFor()
  await reviewPage.getByText("Keep billing orchestration in the existing service", { exact: true }).click()
  await reviewPage.getByRole("heading", { name: "Keep billing orchestration in the existing service" }).waitFor()
  await reviewPage.getByText("Back to decisions", { exact: true }).click()
  await reviewPage.getByRole("heading", { name: "Decision Library" }).waitFor()
  assert.equal(await reviewPage.getByRole("textbox", { name: "Search decisions" }).inputValue(), "billing")
  assert.match(reviewPage.url(), /status=ACTIVE/)
  await reviewPage.reload()
  assert.equal(await reviewPage.getByRole("textbox", { name: "Search decisions" }).inputValue(), "billing")

  await reviewPage.route("**/api/metadata", async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({ json: { ...data, features: { ...data.features, memorySearch: true, jira: true } } })
  })
  await reviewPage.route("**/api/decisions/memory-search", (route) => route.fulfill({ json: { candidateCount: 200, totalCandidateCount: 245, truncated: true, matches: [] } }))
  await reviewPage.reload()
  await reviewPage.getByRole("button", { name: "Search by memory" }).click()
  await reviewPage.getByText(/Searched 200 of 245/).waitFor()
  assert.match(await reviewPage.locator("body").innerText(), /waiting for local indexing/)
  await reviewPage.screenshot({ path: "/private/tmp/decision-memory-review-coverage.png" })

  // Render an A -> B -> C chain using the API's immediate/current distinction.
  const currentId = "33333333-3333-4333-8333-333333333302"
  await reviewPage.route(`**/api/decisions/${oldId}`, async (route) => {
    const response = await route.fetch()
    const detail = await response.json()
    await route.fulfill({ json: { ...detail, lifecycle: { ...detail.lifecycle,
      supersededBy: [{ id: memoryDecision.id, decisionKey: "DM-104", title: memoryDecision.title, status: "SUPERSEDED" }],
      current: [{ id: currentId, decisionKey: "DM-103", title: "Keep billing orchestration in the existing service", status: "ACTIVE" }] } } })
  })
  await reviewPage.goto(`http://localhost:5173/#/decisions/${oldId}`)
  await reviewPage.getByText(/Current active Decision:/).waitFor()
  assert.match(await reviewPage.getByText(/This Decision was replaced by/).innerText(), /DM-104/)
  assert.match(await reviewPage.getByText(/Current active Decision:/).innerText(), /DM-103/)
  await reviewPage.screenshot({ path: "/private/tmp/decision-memory-review-lifecycle-fixed.png" })

  // A partial Jira success preserves the operation and known link over reload.
  await reviewPage.route("**/api/jira/projects", (route) => route.fulfill({ json: [{ key: "MIG", name: "Migration" }] }))
  await reviewPage.route("**/api/jira/projects/MIG/issue-types", (route) => route.fulfill({ json: [{ id: "10001", name: "Task" }] }))
  const retryRequests = []
  await reviewPage.route("**/api/decisions/*/jira-issue", async (route) => {
    retryRequests.push(route.request().postDataJSON())
    const issue = { key: "MIG-999", url: "https://example.atlassian.net/browse/MIG-999" }
    await route.fulfill(retryRequests.length === 1
      ? { status: 503, json: { error: "Issue created; retry linking.", code: "JIRA_LINK_PENDING", issue } }
      : { status: 201, json: { issue, decision: memoryDecision } })
  })
  await reviewPage.goto(`http://localhost:5173/#/decisions/${memoryDecision.id}`)
  await reviewPage.getByRole("button", { name: "Create Jira issue" }).click()
  await reviewPage.getByText("Task", { exact: true }).waitFor()
  await reviewPage.getByRole("button", { name: "Create issue", exact: true }).click()
  await reviewPage.getByRole("link", { name: "Open created issue MIG-999" }).waitFor()
  await reviewPage.reload()
  await reviewPage.getByRole("button", { name: "Create Jira issue" }).click()
  await reviewPage.getByRole("link", { name: "Open created issue MIG-999" }).waitFor()
  await reviewPage.waitForTimeout(250) // let the dialog entrance transition finish for visual proof
  await reviewPage.screenshot({ path: "/private/tmp/decision-memory-review-jira-recovery.png" })
  await reviewPage.getByRole("button", { name: "Retry linking" }).click()
  await reviewPage.getByText("Created MIG-999.").waitFor()
  assert.deepEqual(retryRequests[1], retryRequests[0], "Retry after reload must reuse the original request ID and fields")
  assert.deepEqual(reviewErrors, [])
  await reviewPage.close()

  // New user-value loop: compare existing evidence, record why a replacement
  // happened, then understand current guidance from its scope overview.
  const understand = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const understandingErrors = []
  const understandingConsole = []
  understand.on("pageerror", (error) => understandingErrors.push(error.message))
  understand.on("console", (message) => { if (message.type() === "error") understandingConsole.push(message.text()) })
  await understand.goto("http://localhost:5173/")
  await understand.getByRole("button", { name: "Compare decisions", exact: true }).click()
  await understand.getByRole("combobox", { name: "First Decision" }).click()
  await understand.getByRole("option", { name: /DM-102 · Store migration exports/ }).click()
  await understand.getByRole("combobox", { name: "Second Decision" }).click()
  await understand.getByRole("option", { name: /DM-104 · Use object storage/ }).click()
  await understand.getByRole("button", { name: "Open comparison" }).click()
  await understand.getByRole("heading", { name: "Compare decisions", exact: true }).waitFor()
  await understand.getByRole("article", { name: "First Decision" }).waitFor()
  assert.match(await understand.getByRole("article", { name: "Second Decision" }).innerText(), /saved evidence|captured source/)
  await understand.screenshot({ path: "/private/tmp/decision-memory-comparison-desktop.png", fullPage: true })

  async function record(input) {
    const response = await understand.request.post("http://localhost:3011/api/decisions", { data: input })
    assert.equal(response.status(), 201)
    const decision = await response.json()
    understandingFixtureIds.push(decision.id)
    return decision
  }
  const scope = "Demo Migration Service"
  const earlier = await record({ title: "Keep migration backups on local disk", why: "Early exports are small and quick to restore.", context: "A prototype with a small number of customers.", appliesTo: [scope], optionsConsidered: ["Local disk", "Object storage"], tags: ["migration"] })
  const newer = await record({ title: "Move migration backups to object storage", why: "Large exports need durable storage without database-host pressure.", context: "Customer migration exports can exceed local disk capacity.", appliesTo: [scope], optionsConsidered: ["Object storage", "Larger database host"], tags: ["migration", "storage"] })
  const reason = "Exports now exceed local disk capacity; rollback must survive a database-host failure."
  await understand.goto(`http://localhost:5173/#/decisions/${newer.id}`)
  await understand.getByRole("button", { name: "Supersede", exact: true }).click()
  await understand.getByRole("combobox", { name: "Earlier Decision" }).click()
  await understand.getByRole("option", { name: new RegExp(earlier.decisionKey + " · Keep migration backups") }).click()
  assert.match(await understand.getByRole("region", { name: "Earlier choice" }).innerText(), /Early exports are small/)
  assert.match(await understand.getByRole("region", { name: "Replacing choice" }).innerText(), /Large exports need durable/)
  await understand.getByLabel("What changed?", { exact: true }).fill(reason)
  await understand.getByRole("button", { name: "Confirm supersession" }).click()
  await understand.getByRole("heading", { name: "Why did this change?" }).waitFor()
  await understand.getByRole("region", { name: "Decision evolution" }).getByText(reason, { exact: true }).waitFor()
  await understand.reload()
  await understand.getByRole("region", { name: "Decision evolution" }).getByText(reason, { exact: true }).waitFor()
  const olderResponse = await understand.request.get(`http://localhost:3011/api/decisions/${earlier.id}`)
  const older = await olderResponse.json()
  assert.equal(older.status, "SUPERSEDED")
  assert.equal(older.lifecycle.supersededBy[0].replacementReason, reason)
  await understand.getByRole("button", { name: "Compare before and after" }).click()
  await understand.getByRole("article", { name: "First Decision" }).waitFor()
  await understand.getByRole("region", { name: "Reason for replacement" }).getByText(reason, { exact: true }).waitFor()
  assert.match(await understand.getByRole("article", { name: "First Decision" }).innerText(), /Early exports are small/)
  assert.match(await understand.getByRole("article", { name: "Second Decision" }).innerText(), /Large exports need durable/)
  await understand.screenshot({ path: "/private/tmp/decision-memory-evolution-desktop.png", fullPage: true })

  await understand.getByRole("link", { name: "Scopes", exact: true }).click()
  await understand.getByRole("textbox", { name: "Find a scope" }).fill(scope)
  await understand.getByRole("link", { name: new RegExp(scope + ".*1 active") }).click()
  await understand.getByRole("heading", { name: scope, exact: true }).waitFor()
  const current = understand.getByRole("region", { name: "Active decisions" })
  assert.equal(await current.getByRole("heading", { name: earlier.title }).count(), 0)
  await current.getByRole("heading", { name: newer.title }).waitFor()
  await understand.getByRole("region", { name: "Recent replacements" }).getByText(new RegExp("Exports now exceed local disk capacity")).waitFor()
  await understand.screenshot({ path: "/private/tmp/decision-memory-scope-desktop.png", fullPage: true })
  await understand.setViewportSize({ width: 390, height: 844 })
  await understand.screenshot({ path: "/private/tmp/decision-memory-scope-mobile.png", fullPage: true })
  assert.equal(await understand.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Scope overview must fit mobile width")
  await understand.getByRole("button", { name: "Compare before and after" }).click()
  await understand.getByRole("article", { name: "Second Decision" }).waitFor()
  assert.equal(await understand.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Comparison must fit mobile width")
  await understand.screenshot({ path: "/private/tmp/decision-memory-comparison-mobile.png", fullPage: true })
  assert.deepEqual(understandingErrors, [])
  assert.deepEqual(understandingConsole, [])

  // Failed destination loads clear the previous pair/scope; retry restores it.
  await understand.route(`**/api/decisions/${earlier.id}`, (route) => route.fulfill({ status: 503, json: { error: "Temporary comparison failure" } }))
  await understand.reload()
  await understand.getByText("Could not load comparison", { exact: true }).waitFor()
  assert.equal(await understand.getByRole("article", { name: "First Decision" }).count(), 0)
  await understand.unroute(`**/api/decisions/${earlier.id}`)
  await understand.getByRole("button", { name: "Try again" }).click()
  await understand.getByRole("article", { name: "First Decision" }).waitFor()
  await understand.goto(`http://localhost:5173/#/compare?left=${earlier.id}&right=${earlier.id}`)
  await understand.getByText("Choose two different Decisions", { exact: true }).waitFor()
  await understand.route("**/api/scopes/overview?*", (route) => route.fulfill({ status: 503, json: { error: "Temporary scope failure" } }))
  await understand.goto(`http://localhost:5173/#/scopes?${new URLSearchParams({ scope })}`)
  await understand.getByText("Could not load scope overview", { exact: true }).waitFor()
  assert.equal(await understand.getByRole("region", { name: "Active decisions" }).count(), 0)
  await understand.unroute("**/api/scopes/overview?*")
  await understand.getByRole("button", { name: "Try again" }).click()
  await understand.getByRole("region", { name: "Active decisions" }).waitFor()
  assert.deepEqual(understandingErrors, [])
  await understand.close()
  console.log("Decision understanding QA passed: comparison, human replacement reason, scope overview, mobile layout, and failure recovery")

  await verifyDeadlineUi({ browser, models, workspace })
  await verifyProposalUi({ browser, models, workspace })
  assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(" | ")}`)
  assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(" | ")}`)
  console.log("UI QA passed with Playwright/Chrome fallback: independent keyword and memory search, collapsed/expanded evidence, create/edit, desktop and mobile screenshots")
} finally {
  await browser.close()
  await removeFormFixture()
  for (const id of understandingFixtureIds) await models.Decision.destroy({ where: { id, workspaceId: workspace.id } })
  await models.sequelize.close()
}
