import assert from "node:assert/strict"
import { it } from "node:test"
import { analyticsWindow } from "../src/analytics-records.js"

it("uses inclusive UTC calendar periods across leap dates and timezone offsets", () => {
  const window = analyticsWindow(7, new Date("2024-03-01T00:30:00+07:00"))
  assert.deepEqual(window, {
    start: "2024-02-23T00:00:00.000Z", end: "2024-03-01T00:00:00.000Z",
    from: "2024-02-23", through: "2024-02-29", days: 7,
  })
  assert.equal(analyticsWindow(90, new Date("2026-01-01")).days, 90)
  for (const value of [0, 1, 31, 10000, "30"]) assert.throws(() => analyticsWindow(value), /7, 30 or 90/)
})

it("buckets page opens into fixed 30-minute UTC windows and hashes viewers one way", async () => {
  const { viewBucket, viewerKey } = await import("../src/analytics-records.js")
  assert.equal(viewBucket(new Date("2026-10-29T12:29:59.999Z")), "2026-10-29T12:00:00.000Z")
  assert.equal(viewBucket(new Date("2026-10-29T12:30:00.000Z")), "2026-10-29T12:30:00.000Z")
  assert.equal(viewBucket(new Date("2026-10-29T08:45:00+07:00")), "2026-10-29T01:30:00.000Z")
  const key = viewerKey("workspace", "user", "session")
  assert.match(key, /^[0-9a-f]{64}$/)
  assert.notEqual(key, viewerKey("other-workspace", "user", "session"))
  assert.equal(key.includes("session"), false)
})
