import assert from "node:assert/strict"

export async function verifyResponsiveUi({ browser }) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = []
  const base = "http://localhost:5173/#"
  const earlier = "33333333-3333-4333-8333-333333333303"
  const current = "33333333-3333-4333-8333-333333333301"
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
  const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "The page must not scroll sideways")
  try {
    for (const width of [390, 768, 1024, 1440]) {
      const height = width === 390 ? 844 : width === 768 ? 1024 : 900
      await page.setViewportSize({ width, height })
      await page.goto(`${base}/`)
      await page.locator(".decision-row").first().waitFor()
      await fits()
      const first = await page.locator(".decision-row").first().boundingBox()
      assert.ok(first.y <= height * 0.6, `Results should begin in the top 60% at ${width}px`)
      assert.equal(await page.locator(".desktop-sidebar").isVisible(), width >= 1024)
      if (width < 1024) {
        const navigation = page.getByRole("button", { name: "Open navigation", exact: true })
        await navigation.click()
        await page.getByRole("dialog", { name: "Navigation", exact: true }).waitFor()
        await page.keyboard.press("Escape")
        await page.getByRole("dialog", { name: "Navigation", exact: true }).waitFor({ state: "hidden" })
        assert.equal(await navigation.evaluate(el => document.activeElement === el), true, "Navigation restores focus")
        await page.getByRole("button", { name: "Show saved views", exact: true }).click()
        await page.getByRole("region", { name: "Saved library views", exact: true }).getByRole("combobox", { name: "Saved views", exact: true }).waitFor()
        await page.getByRole("button", { name: "Show saved views", exact: true }).click()
      }
      const shortcuts = page.getByRole("group", { name: "Quick filters", exact: true })
      const shortcutFrame = await shortcuts.boundingBox()
      for (const label of ["Current choices", "Pending", "Overdue", "Due soon"]) {
        const box = await shortcuts.getByRole("button", { name: label, exact: true }).boundingBox()
        assert.ok(box.x >= shortcutFrame.x && box.x + box.width <= shortcutFrame.x + shortcutFrame.width + 1, `${label} stays visible at ${width}px`)
        if (width === 390) assert.ok(box.height >= 44, "Phone shortcut targets remain touchable")
      }
      await page.screenshot({ path: `/private/tmp/ui-library-after-${width}.png` })

      await page.goto(`${base}/?view=kanban`)
      const board = page.getByRole("region", { name: "Decision Kanban board", exact: true })
      await board.waitFor()
      const beforeJump = page.url()
      const jump = page.getByRole("button", { name: /^Jump to Decided \(/ })
      await jump.focus()
      await page.keyboard.press("Enter")
      const lane = page.getByRole("region", { name: "Decided decisions", exact: true })
      assert.equal(await lane.evaluate(el => document.activeElement === el), true, "Lane jumps move keyboard focus")
      const laneBox = await lane.boundingBox(), boardBox = await board.boundingBox()
      assert.ok(laneBox.x >= boardBox.x - 1 && laneBox.x + laneBox.width <= boardBox.x + boardBox.width + 1, "The populated lane comes into view")
      assert.equal(page.url(), beforeJump, "A lane jump must not change routing or filters")
      assert.equal(await board.locator(":scope > section").count(), 5, "All five lane groups remain")
      await fits()
      await page.screenshot({ path: `/private/tmp/ui-board-after-${width}.png` })

      await page.goto(`${base}/decisions/${current}`)
      const rationale = page.getByRole("region", { name: "Decision rationale", exact: true })
      await rationale.waitFor()
      const why = await rationale.boundingBox()
      assert.ok(why.y + why.height <= height, `The seeded rationale fits the initial ${width}px screen`)
      if (width < 1024) {
        assert.equal(await page.getByRole("button", { name: "Copy summary", exact: true }).isVisible(), false)
        await page.getByRole("button", { name: "More actions", exact: true }).click()
      }
      await page.getByRole("button", { name: "Compare decisions", exact: true }).click()
      await page.getByRole("dialog", { name: "Compare two Decisions", exact: true }).waitFor()
      await page.keyboard.press("Escape")
      await page.getByRole("dialog", { name: "Compare two Decisions", exact: true }).waitFor({ state: "hidden" })
      assert.equal(await page.getByRole("button", { name: "Compare decisions", exact: true }).evaluate(el => document.activeElement === el), true)
      if (width < 1024) await page.getByRole("button", { name: "More actions", exact: true }).click()
      await page.screenshot({ path: `/private/tmp/ui-detail-after-${width}.png` })
      await page.getByRole("button", { name: "Read saved evidence", exact: true }).click()
      assert.equal(await page.locator("#decision-discussion").evaluate(el => document.activeElement === el), true)
      await fits()

      await page.goto(`${base}/decisions/${earlier}`)
      const historicalNotice = page.getByRole("link").filter({ hasText: "This Decision was replaced by" })
      await historicalNotice.waitFor()
      const noticeBox = await historicalNotice.boundingBox()
      const historicalWhy = await page.getByRole("region", { name: "Decision rationale", exact: true }).boundingBox()
      assert.ok(noticeBox.y < historicalWhy.y, "Historical choices must disclose their replacement before the rationale")

      await page.goto(`${base}/compare?left=${earlier}&right=${current}`)
      for (const label of ["Decision", "Original question", "Why", "Context", "Applies To", "Options Considered"]) {
        const section = page.getByRole("region", { name: `${label} comparison`, exact: true })
        await section.waitFor()
        const firstValue = await section.getByRole("group", { name: `First Decision ${label}`, exact: true }).boundingBox()
        const secondValue = await section.getByRole("group", { name: `Second Decision ${label}`, exact: true }).boundingBox()
        if (width < 768) assert.ok(secondValue.y >= firstValue.y + firstValue.height && secondValue.y <= firstValue.y + firstValue.height + 24, "Phone values are adjacent within each field")
        else assert.ok(Math.abs(firstValue.y - secondValue.y) < 1, "Desktop/tablet values share a field baseline")
      }
      await fits()
      await page.screenshot({ path: `/private/tmp/ui-comparison-after-${width}.png`, fullPage: true })
    }
    assert.deepEqual(errors, [])
    console.log("Responsive UI proof passed: content-first layouts, navigation/focus, saved-view disclosure, lane jumps, rationale/evidence, and paired comparison at 390/768/1024/1440px")
  } finally {
    await context.close()
  }
}
