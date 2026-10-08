import assert from "node:assert/strict"
import { chromium } from "playwright-core"

import { config } from "../apps/server/src/config.js"
import { createDatabase } from "../apps/server/src/models.js"

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
})

const consoleErrors = []
const pageErrors = []
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
  await page.route("**/api/decisions/memory-search", async (route) => {
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

  const search = page.getByRole("textbox", { name: "Search decisions" })
  await search.fill("Maya Chen")
  await page.waitForTimeout(350)
  assert.equal((await page.locator(".decision-row").count()) >= 2, true)

  await search.fill("Hồi trước mình xử lý file migration lớn hay timeout như thế nào?")
  await page.waitForTimeout(350)
  assert.equal(await page.locator(".decision-row").count(), 0)
  await page.getByRole("button", { name: "Search by memory" }).click()
  await page.getByText("AI-assisted match", { exact: true }).first().waitFor()
  assert.match(
    await page.locator("body").innerText(),
    /moved large migration rollback files away from the database host/,
  )
  await page.screenshot({ path: "/private/tmp/decision-memory-search-desktop.png", fullPage: true })

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
  assert.deepEqual(jiraRequests, [{ projectKey: "MIG", issueTypeId: "10001", summary: "Use object storage for migration backup files" }])
  await page.getByRole("link", { name: "MIG-183" }).waitFor()

  await page.getByRole("link", { name: "Decisions", exact: true }).click()
  await page.getByText("New Decision", { exact: true }).click()
  await page.getByRole("heading", { name: "New Decision" }).waitFor()
  await page.getByLabel("Decision *").fill(formFixtureTitle)
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
  assert.equal(await failurePage.getByLabel("Decision *").inputValue(), "Store migration exports on the database host")
  await failurePage.evaluate(() => { location.hash = "#/decisions/new" })
  await failurePage.getByRole("heading", { name: "New Decision", exact: true }).waitFor()
  assert.equal(await failurePage.getByLabel("Decision *").inputValue(), "")

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

  assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(" | ")}`)
  assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(" | ")}`)
  console.log("UI QA passed with Playwright/Chrome fallback: independent keyword and memory search, collapsed/expanded evidence, create/edit, desktop and mobile screenshots")
} finally {
  await browser.close()
  await removeFormFixture()
  await models.sequelize.close()
}
