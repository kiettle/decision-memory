import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { once } from "node:events"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { config } from "../apps/server/src/config.js"
import { createDatabase } from "../apps/server/src/models.js"
import { createIntegrationSettings, integrationFields } from "../apps/server/src/integration-settings.js"
import { createApp, createRuntime } from "../apps/server/src/app.js"

if (config.nodeEnv !== "development" || !["localhost", "127.0.0.1"].includes(new URL(config.databaseUrl).hostname)) {
  throw new Error("Settings verification requires the local development database.")
}
const base = createDatabase(config.databaseUrl, false)
const schema = `settings_proof_${randomBytes(8).toString("hex")}`
const directory = await mkdtemp(join(tmpdir(), "decision-settings-proof-"))
const keyPath = join(directory, "settings.key")
const models = { ...base, ConfigurationScope: base.ConfigurationScope.schema(schema), ConfigurationValue: base.ConfigurationValue.schema(schema) }
const bootstrap = { ...config,
  slackBotToken: "xoxb-synthetic-initial", slackSigningSecret: "a".repeat(32), slackTeamId: "TSYNTHETIC",
  geminiApiKey: "synthetic-initial-gemini", jiraBaseUrl: "https://synthetic.atlassian.net", jiraEmail: "synthetic@example.com", jiraApiToken: "synthetic-initial-jira",
}
let server
async function cleanup() {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections() })
  await base.sequelize.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
  await base.sequelize.close()
  await rm(directory, { recursive: true, force: true })
}
try {
  await base.sequelize.authenticate()
  const sql = await readFile(new URL("../db/integration-settings.sql", import.meta.url), "utf8")
  await base.sequelize.transaction(async transaction => {
    await base.sequelize.query(`CREATE SCHEMA "${schema}"`, { transaction })
    await base.sequelize.query(`SET LOCAL search_path TO "${schema}"`, { transaction })
    await base.sequelize.query(sql, { transaction })
    await base.sequelize.query(sql, { transaction })
  })
  const makeStore = (overrides = {}) => createIntegrationSettings({ models, keyPath, bootstrap, buildRuntime: value => value, ...overrides })
  let settings = await makeStore()
  assert.equal(settings.read().revision, 1)
  assert.ok(Object.values(settings.read().integrations).every(value => value.configured))
  assert.ok(!JSON.stringify(settings.read()).includes("synthetic-initial-gemini"))
  for (const row of await models.ConfigurationValue.findAll()) {
    if (integrationFields[row.key].secret) {
      assert.match(row.value, /^v1:/)
      assert.ok(!row.value.includes("synthetic-initial"))
    }
  }
  // Two editors race from the same revision: precisely one transaction wins.
  const results = await Promise.allSettled([
    settings.save("gemini", { revision: 1, changes: { GEMINI_API_KEY: "synthetic-updated-one" } }),
    settings.save("gemini", { revision: 1, changes: { GEMINI_API_KEY: "synthetic-updated-two" } }),
  ])
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
  assert.equal(results.find(result => result.status === "rejected").reason.code, "SETTINGS_CONFLICT")
  assert.equal(settings.read().revision, 2)
  const persisted = settings.getRuntime().geminiApiKey
  settings = await makeStore({ bootstrap: { ...bootstrap, geminiApiKey: "environment-must-not-overwrite" } })
  assert.equal(settings.getRuntime().geminiApiKey, persisted)
  await settings.save("gemini", { revision: 2, changes: { GEMINI_API_KEY: null } })
  settings = await makeStore()
  assert.equal(settings.getRuntime().geminiApiKey, undefined)
  assert.equal(settings.read().integrations.gemini.configured, false)
  // Candidate construction failure must roll back values and the revision.
  settings = await makeStore({ buildRuntime: value => {
    if (value.geminiApiKey === "constructor-failure") throw new Error("Synthetic construction failure")
    return value
  } })
  await assert.rejects(settings.save("gemini", { revision: 3, changes: { GEMINI_API_KEY: "constructor-failure" } }), /Synthetic construction failure/)
  assert.equal(settings.read().revision, 3)
  assert.equal((await makeStore()).getRuntime().geminiApiKey, undefined)
  assert.equal(await models.ConfigurationValue.count({ where: { key: "GEMINI_API_KEY" } }), 0)
  await settings.save("jira", { revision: 3, changes: { JIRA_EMAIL: null, JIRA_BASE_URL: "https://changed.atlassian.net/" } })
  settings = await makeStore()
  assert.equal(settings.read().integrations.jira.configured, false)
  assert.equal(settings.getRuntime().jiraBaseUrl, "https://changed.atlassian.net")
  assert.equal(settings.getRuntime().jiraEmail, undefined)
  const originalKey = await readFile(keyPath)
  await rm(keyPath)
  await assert.rejects(makeStore(), /Restore the original/)
  await writeFile(keyPath, `${randomBytes(32).toString("hex")}\n`, { mode: 0o600 })
  await assert.rejects(makeStore(), /Restore the original/)
  await writeFile(keyPath, originalKey)
  assert.equal((await makeStore()).read().revision, 4)
  // Empty initialization is durable, too: future env entries cannot revive it.
  await models.ConfigurationValue.destroy({ where: {} })
  await models.ConfigurationScope.destroy({ where: {} })
  const emptyBootstrap = { ...bootstrap, ...Object.fromEntries(Object.values(integrationFields).map(field => [field.property, undefined])) }
  settings = await makeStore({ bootstrap: emptyBootstrap })
  assert.ok(Object.values(settings.read().integrations).every(value => !value.configured))
  assert.equal((await makeStore()).getRuntime().slackBotToken, undefined)
  console.log("Settings database proof passed: idempotent schema, encrypted import, persistence, conflicts, clear, rollback, missing/wrong key recovery, empty import.")
  if (process.argv.includes("--serve")) {
    const repository = { metadata: async () => ({ workspace: { id: "fixture", name: "Settings verification" }, currentUser: { id: "fixture", displayName: "Synthetic user" }, users: [], ownerNames: [], tags: [], channels: [], appliesTo: [] }) }
    settings = await makeStore({ bootstrap: { ...emptyBootstrap, webOrigin: "http://localhost:5183" },
      buildRuntime: value => createRuntime({ config: value, repository, memorySearch: { enabled: false } }),
    })
    server = createApp({ config: { ...emptyBootstrap, webOrigin: "http://localhost:5183" }, repository, settings }).listen(0, "127.0.0.1")
    await once(server, "listening")
    console.log(JSON.stringify({ ready: true, url: `http://127.0.0.1:${server.address().port}` }))
    await new Promise(resolve => { process.once("SIGTERM", resolve); process.once("SIGINT", resolve) })
  }
} finally { await cleanup() }
