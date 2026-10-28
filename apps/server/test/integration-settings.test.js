import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { it } from "node:test"

import { createSettingsCodec, loadSettingsKey, validateSettingsChange } from "../src/integration-settings.js"

it("settings encryption authenticates ciphertext, field identity and key; public values stay readable", () => {
  const codec = createSettingsCodec(randomBytes(32))
  const encoded = codec.encode("GEMINI_API_KEY", "synthetic-sensitive-key")
  assert.ok(!encoded.includes("synthetic-sensitive-key"))
  assert.notEqual(encoded, codec.encode("GEMINI_API_KEY", "synthetic-sensitive-key"))
  assert.equal(codec.decode("GEMINI_API_KEY", encoded), "synthetic-sensitive-key")
  assert.equal(codec.decode("SLACK_TEAM_ID", codec.encode("SLACK_TEAM_ID", "TDEMO")), "TDEMO")
  for (const decode of [
    () => codec.decode("JIRA_API_TOKEN", encoded),
    () => createSettingsCodec(randomBytes(32)).decode("GEMINI_API_KEY", encoded),
    () => codec.decode("GEMINI_API_KEY", encoded.replace("v1:", "v2:")),
    () => codec.decode("GEMINI_API_KEY", encoded.slice(0, -5) + "aaaaa"),
  ]) assert.throws(decode, /Restore the original .local\/settings.key/)
})

it("settings key is persistent, private, and never regenerated over encrypted data", async t => {
  const directory = await mkdtemp(join(tmpdir(), "decision-settings-key-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, "settings.key")
  await assert.rejects(loadSettingsKey(path, true), /Restore the original/)
  const key = await loadSettingsKey(path, false)
  assert.equal(key.length, 32)
  assert.equal((await stat(path)).mode & 0o777, 0o600)
  assert.deepEqual(await loadSettingsKey(path, true), key)
  assert.match(await readFile(path, "utf8"), /^[a-f0-9]{64}\n$/)
  await chmod(path, 0o644)
  await assert.rejects(loadSettingsKey(path, true), /owner-only permissions/)
  await chmod(path, 0o600)
  await writeFile(path, "bad key")
  await assert.rejects(loadSettingsKey(path, false), /32 bytes/)
})

it("settings changes allow only the selected provider, validate values, and distinguish clearing from omission", () => {
  const input = validateSettingsChange("jira", { revision: 1, changes: { JIRA_BASE_URL: " https://example.atlassian.net/ ", JIRA_API_TOKEN: null } })
  assert.deepEqual(input, { revision: 1, changes: { JIRA_BASE_URL: "https://example.atlassian.net", JIRA_API_TOKEN: null } })
  assert.deepEqual(validateSettingsChange("slack", { revision: 2, changes: { SLACK_TEAM_ID: "TDEMO" } }).changes, { SLACK_TEAM_ID: "TDEMO" })
  for (const [provider, changes] of [
    ["other", { GEMINI_API_KEY: "key" }], ["slack", { GEMINI_API_KEY: "key" }],
    ["gemini", { DATABASE_URL: "not-allowed" }], ["gemini", {}],
    ["gemini", { GEMINI_API_KEY: "" }], ["gemini", { GEMINI_API_KEY: "hidden secret" }],
    ["slack", { SLACK_SIGNING_SECRET: "bad" }], ["slack", { SLACK_TEAM_ID: "other" }],
    ["slack", { SLACK_BOT_TOKEN: "xoxp-wrong-type" }], ["jira", { JIRA_EMAIL: "bad" }],
    ["jira", { JIRA_BASE_URL: "http://example.com" }], ["jira", { JIRA_BASE_URL: "https://user:secret@example.com" }],
    ["jira", { JIRA_BASE_URL: "https://example.com/private?token=secret" }],
  ]) {
    assert.throws(() => validateSettingsChange(provider, { revision: 1, changes }), error => {
      assert.ok(!error.message.includes("hidden secret"))
      return [400, 404].includes(error.status)
    })
  }
  assert.throws(() => validateSettingsChange("gemini", { revision: -1, changes: { GEMINI_API_KEY: "key" } }), /supported fields/)
})
