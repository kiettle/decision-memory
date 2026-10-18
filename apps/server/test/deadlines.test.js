import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { it } from "node:test"
import { calendarDay, deadlineBucket, deadlineLabel, deadlineDate, compareDecisions } from "../../../shared/decision-deadlines.js"
import { decisionInput, deadlineInput, decideInput } from "../src/validation.js"
import { validateSupersession } from "../src/domain.js"

it("uses calendar boundaries including leap dates and historical completion", () => {
  const pending = { decisionState: "PENDING" }
  for (const [dueDate, bucket, label] of [
    ["2026-10-13", "OVERDUE", "1 day overdue"],
    ["2026-10-14", "DUE_SOON", "Due today"],
    ["2026-10-21", "DUE_SOON", "Due in 7 days"],
    ["2026-10-22", "UPCOMING", "Due in 8 days"],
    [null, "UNSCHEDULED", "No deadline"],
  ]) {
    assert.equal(deadlineBucket({ ...pending, dueDate }, "2026-10-14"), bucket)
    assert.equal(deadlineLabel({ ...pending, dueDate }, "2026-10-14"), label)
  }
  assert.equal(calendarDay("2024-03-01") - calendarDay("2024-02-29"), 1)
  assert.equal(deadlineLabel({ ...pending, dueDate: "2026-03-09" }, "2026-03-08"), "Due in 1 day")
  assert.equal(deadlineBucket({ decisionState: "DECIDED", dueDate: "2020-01-01" }, "2026-10-14"), "DECIDED")
  assert.equal(deadlineLabel({ decisionState: "DECIDED", dueDate: "2020-01-01" }, "2026-10-14"), "Original deadline")
  assert.match(deadlineDate("2026-10-14"), /Oct 14, 2026/)
})

it("validates real dates and prevents shortcuts from accepting unrelated edits", () => {
  for (const value of ["2026-02-29", "2026-13-01", "0000-01-01", "2026-2-03", "2026-10-14T00:00:00Z", "bad"]) {
    assert.equal(deadlineInput.safeParse({ dueDate: value }).success, false)
  }
  assert.equal(deadlineInput.safeParse({ dueDate: "2024-02-29" }).success, true)
  assert.equal(deadlineInput.safeParse({ dueDate: null }).success, true)
  assert.equal(deadlineInput.safeParse({ dueDate: null, references: [] }).success, false)
  assert.equal(decideInput.safeParse({ outcome: " ", why: "Reason" }).success, false)
  assert.equal(decideInput.safeParse({ outcome: "Use object storage", tags: [] }).success, false)
  assert.equal(decisionInput.safeParse({ title: "Question", decisionState: "PENDING", dueDate: null }).success, true)
})

it("uses each viewer's date and avoids DST elapsed-hour arithmetic", () => {
  const moduleUrl = new URL("../../../shared/decision-deadlines.js", import.meta.url).href
  const check = (tz, instant) => execFileSync(process.execPath, ["--input-type=module", "-e", `import {localCalendarDate} from ${JSON.stringify(moduleUrl)}; process.stdout.write(localCalendarDate(new Date(${JSON.stringify(instant)})))`], { env: { ...process.env, TZ: tz }, encoding: "utf8" })
  assert.equal(check("America/Los_Angeles", "2026-10-14T00:30:00Z"), "2026-10-13")
  assert.equal(check("Asia/Ho_Chi_Minh", "2026-10-14T00:30:00Z"), "2026-10-14")
  assert.equal(check("America/New_York", "2026-03-08T07:30:00Z"), "2026-03-08")
})

it("orders pending deadlines before undated questions and completed choices", () => {
  const base = { title: "Topic", createdAt: "2026-10-01T00:00:00Z" }
  const rows = [
    { ...base, id: "done", decisionState: "DECIDED", dueDate: "2020-01-01" },
    { ...base, id: "undated", decisionState: "PENDING" },
    { ...base, id: "later", decisionState: "PENDING", dueDate: "2026-10-22" },
    { ...base, id: "early", decisionState: "PENDING", dueDate: "2026-10-13" },
  ]
  assert.deepEqual(rows.sort((a, b) => compareDecisions(a, b, "DEADLINE")).map((row) => row.id), ["early", "later", "undated", "done"])
})

it("allows recorded supersession and rejects pending participants with the accepted diagnostic", () => {
  const current = { id: "new", workspaceId: "w", status: "ACTIVE", decisionState: "DECIDED" }
  const target = { ...current, id: "old" }
  assert.doesNotThrow(() => validateSupersession({ current, target, workspaceId: "w" }))
  for (const pair of [{ current: { ...current, decisionState: "PENDING" }, target }, { current, target: { ...target, decisionState: "PENDING" } }]) {
    assert.throws(() => validateSupersession({ ...pair, workspaceId: "w" }), (error) => error.code === "PENDING_SUPERSESSION" && /Record both final choices/.test(error.message))
  }
})

it("deadline shortcuts add viewer-local calendar days across boundaries and DST", () => {
  const moduleUrl = new URL("../../../shared/decision-deadlines.js", import.meta.url).href
  const check = (tz, instant) => JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `import {localCalendarDateAfter} from ${JSON.stringify(moduleUrl)}; const now=new Date(${JSON.stringify(instant)}); process.stdout.write(JSON.stringify([0,1,7].map(days=>localCalendarDateAfter(days,now))))`], { env: { ...process.env, TZ: tz }, encoding: "utf8" }))
  assert.deepEqual(check("UTC", "2024-02-28T23:30:00Z"), ["2024-02-28", "2024-02-29", "2024-03-06"])
  assert.deepEqual(check("UTC", "2026-12-31T23:59:00Z"), ["2026-12-31", "2027-01-01", "2027-01-07"])
  assert.deepEqual(check("America/New_York", "2026-03-07T17:00:00Z"), ["2026-03-07", "2026-03-08", "2026-03-14"])
  assert.deepEqual(check("America/New_York", "2026-10-31T16:00:00Z"), ["2026-10-31", "2026-11-01", "2026-11-07"])
  assert.deepEqual(check("America/Los_Angeles", "2026-10-18T00:30:00Z"), ["2026-10-17", "2026-10-18", "2026-10-24"])
  assert.deepEqual(check("Asia/Ho_Chi_Minh", "2026-10-18T00:30:00Z"), ["2026-10-18", "2026-10-19", "2026-10-25"])
})
