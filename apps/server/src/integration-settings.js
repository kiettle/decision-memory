import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto"
import { mkdir, open, readFile, stat } from "node:fs/promises"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

import { DomainError } from "./domain.js"

export const integrationFields = {
  SLACK_BOT_TOKEN: { property: "slackBotToken", secret: true, provider: "slack" },
  SLACK_SIGNING_SECRET: { property: "slackSigningSecret", secret: true, provider: "slack" },
  SLACK_TEAM_ID: { property: "slackTeamId", provider: "slack" },
  GEMINI_API_KEY: { property: "geminiApiKey", secret: true, provider: "gemini" },
  JIRA_BASE_URL: { property: "jiraBaseUrl", provider: "jira" },
  JIRA_EMAIL: { property: "jiraEmail", provider: "jira" },
  JIRA_API_TOKEN: { property: "jiraApiToken", secret: true, provider: "jira" },
}
export const integrationProviders = ["slack", "gemini", "jira"]
const defaultKeyPath = fileURLToPath(new URL("../../../.local/settings.key", import.meta.url))
const recoveryMessage = "Cannot decrypt integration settings. Restore the original .local/settings.key with its database backup; do not replace the key."

export async function loadSettingsKey(keyPath, hasSecrets) {
  try {
    const contents = await readFile(keyPath, "utf8")
    if (!/^[a-f0-9]{64}\n?$/.test(contents) || ((await stat(keyPath)).mode & 0o077)) {
      throw new Error("Settings key must contain 32 bytes as hex and have owner-only permissions (chmod 600).")
    }
    return Buffer.from(contents.trim(), "hex")
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    if (hasSecrets) throw new Error(recoveryMessage, { cause: error })
    await mkdir(dirname(keyPath), { recursive: true })
    try {
      const file = await open(keyPath, "wx", 0o600)
      try { await file.writeFile(`${randomBytes(32).toString("hex")}\n`); await file.sync() }
      finally { await file.close() }
    } catch (writeError) {
      if (writeError.code !== "EEXIST") throw writeError
    }
    return loadSettingsKey(keyPath, hasSecrets)
  }
}

export function createSettingsCodec(key) {
  return {
    encode(name, value) {
      if (!integrationFields[name].secret) return value
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, iv)
      cipher.setAAD(Buffer.from(`global:${name}:v1`))
      const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
      return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":")
    },
    decode(name, value) {
      if (!integrationFields[name].secret) return value
      try {
        const [version, iv, tag, ciphertext, extra] = value.split(":")
        if (version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined) throw new Error()
        const nonce = Buffer.from(iv, "base64"), authTag = Buffer.from(tag, "base64")
        if (nonce.length !== 12 || authTag.length !== 16) throw new Error()
        const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 })
        decipher.setAAD(Buffer.from(`global:${name}:v1`))
        decipher.setAuthTag(authTag)
        return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8")
      } catch { throw new Error(recoveryMessage) }
    },
  }
}

const saveInput = z.object({
  revision: z.number().int().nonnegative(),
  changes: z.partialRecord(z.enum(Object.keys(integrationFields)), z.string().trim().min(1).max(4096).nullable()),
}).strict()

export function validateSettingsChange(provider, input) {
  if (!integrationProviders.includes(provider)) throw new DomainError("Integration not found.", 404, "SETTINGS_PROVIDER_INVALID")
  const parsed = saveInput.safeParse(input)
  if (!parsed.success) throw new DomainError("Choose supported fields and enter non-empty values, or use Clear.", 400, "SETTINGS_INVALID")
  const { changes } = parsed.data
  const fields = Object.keys(changes)
  if (!fields.length || fields.some(name => integrationFields[name].provider !== provider)) {
    throw new DomainError("Only fields for this integration can be changed.", 400, "SETTINGS_INVALID")
  }
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) continue
    let valid = !/\s/.test(value)
    if (name === "SLACK_BOT_TOKEN") valid = /^xoxb-[a-zA-Z0-9-]+$/.test(value)
    if (name === "SLACK_SIGNING_SECRET") valid = /^[a-fA-F0-9]{32}$/.test(value)
    if (name === "SLACK_TEAM_ID") valid = /^T[A-Z0-9]+$/.test(value)
    if (name === "JIRA_EMAIL") valid = z.email().safeParse(value).success
    if (name === "JIRA_BASE_URL") {
      try {
        const url = new URL(value)
        valid = url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/"
        if (valid) changes[name] = url.origin
      } catch { valid = false }
    }
    if (!valid) throw new DomainError(`Enter a valid ${name}.`, 400, "SETTINGS_INVALID")
  }
  return parsed.data
}

function publicSettings(revision, values) {
  return {
    revision,
    integrations: Object.fromEntries(integrationProviders.map(provider => {
      const fields = Object.fromEntries(Object.entries(integrationFields)
        .filter(([, field]) => field.provider === provider)
        .map(([name, field]) => [name, {
          configured: Boolean(values[name]),
          ...(!field.secret ? { value: values[name] ?? "" } : {}),
        }]))
      return [provider, { configured: Object.values(fields).every(field => field.configured), fields }]
    })),
  }
}

// All SQL transactions are local and short. Provider calls never run here.
export async function createIntegrationSettings({ models, bootstrap, buildRuntime, keyPath = defaultKeyPath }) {
  const { sequelize, ConfigurationScope: Scope, ConfigurationValue: Value } = models
  const secretNames = Object.keys(integrationFields).filter(name => integrationFields[name].secret)
  const key = await loadSettingsKey(keyPath, await Value.count({ where: { key: secretNames } }) > 0)
  const codec = createSettingsCodec(key)
  let current

  function decodeRows(rows) {
    return Object.fromEntries(rows.map(row => [row.key, codec.decode(row.key, row.value)]))
  }
  function makeSnapshot(revision, values) {
    const overrides = Object.fromEntries(Object.entries(integrationFields).map(([name, field]) => [field.property, values[name] || undefined]))
    return { revision, values, runtime: buildRuntime(Object.freeze({ ...bootstrap, ...overrides })) }
  }

  await sequelize.transaction(async transaction => {
    await Scope.findOrCreate({ where: { id: "global" }, defaults: { revision: 0 }, transaction })
    const scope = await Scope.findByPk("global", { transaction, lock: transaction.LOCK.UPDATE })
    if (!scope.initializedAt) {
      for (const [name, field] of Object.entries(integrationFields)) {
        const value = bootstrap[field.property]?.trim()
        if (value) await Value.upsert({ scopeId: "global", key: name, value: codec.encode(name, value) }, { transaction })
      }
      await scope.update({ initializedAt: new Date(), revision: 1 }, { transaction })
    }
    const values = decodeRows(await Value.findAll({ where: { scopeId: "global" }, transaction }))
    current = makeSnapshot(scope.revision, values)
  })

  return {
    getRuntime: () => current.runtime,
    read: () => publicSettings(current.revision, current.values),
    async save(provider, input) {
      const { revision, changes } = validateSettingsChange(provider, input)
      // The locked revision serializes writes. Publication below is monotonic,
      // so an earlier commit cannot replace a newer runtime snapshot.
      let candidate
      await sequelize.transaction(async transaction => {
        const scope = await Scope.findByPk("global", { transaction, lock: transaction.LOCK.UPDATE })
        if (scope.revision !== revision) throw new DomainError("Settings changed in another window. Reload settings before saving again.", 409, "SETTINGS_CONFLICT")
        const values = decodeRows(await Value.findAll({ where: { scopeId: "global" }, transaction }))
        for (const [name, value] of Object.entries(changes)) {
          if (value === null) {
            delete values[name]
            await Value.destroy({ where: { scopeId: "global", key: name }, transaction })
          } else {
            values[name] = value
            await Value.upsert({ scopeId: "global", key: name, value: codec.encode(name, value) }, { transaction })
          }
        }
        candidate = makeSnapshot(revision + 1, values)
        await scope.update({ revision: candidate.revision }, { transaction })
      })
      if (candidate.revision > current.revision) current = candidate
      return publicSettings(candidate.revision, candidate.values)
    },
  }
}
