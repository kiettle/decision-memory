import { mkdir, open } from "node:fs/promises"

import { run } from "./setup-local.mjs"

// Restores the synthetic demo workspace so every recording starts from the same
// records. A backup is written first; the saved integration settings and any
// other workspace are kept. Browser-local saved views and drafts are not touched.
const args = process.argv.slice(2)
const database = args.includes("--database") ? args[args.indexOf("--database") + 1] : "decision_memory"
if (!/^[a-z0-9_]+$/.test(database ?? "")) throw new Error("Use a plain database name, for example --database decision_memory.")
if (!args.includes("--yes")) {
  console.log(`This replaces every record in the demo workspace of "${database}" with the synthetic seed.
A backup is saved under .local/backups first. Integration settings are kept.
Run again with --yes to continue: npm run demo:reset -- --yes`)
  process.exit(1)
}

const psql = (...options) => run("docker", ["compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-q",
  "-U", "decision_memory", "-d", database, ...options], { capture: true })

try { await run("docker", ["info"], { capture: true }) } catch {
  throw new Error("Start Docker Desktop or OrbStack, then rerun npm run demo:reset.")
}
await run("docker", ["compose", "up", "-d", "--wait", "postgres"], { capture: true })

await mkdir(".local/backups", { recursive: true })
const backupPath = `.local/backups/demo-reset-${database}-${Date.now()}.dump`
const backup = await open(backupPath, "wx", 0o600)
try {
  await run("docker", ["compose", "exec", "-T", "postgres", "pg_dump", "-U", "decision_memory", "-d", database, "-Fc"], { stdout: backup.fd })
} finally {
  await backup.close()
}
console.log(`Backup saved to ${backupPath}`)

await psql("-f", "/app/db/schema.sql")
// One transaction: if the seed fails, the existing records stay as they were.
await psql("--single-transaction", "-c", "DELETE FROM workspaces WHERE external_key = 'demo-workspace'", "-f", "/app/db/seed.sql")
const summary = await psql("-At", "-c", `SELECT count(*) FILTER (WHERE decision_state = 'DECIDED') || ' choices, ' ||
  count(*) FILTER (WHERE decision_state = 'PENDING') || ' open questions' FROM decisions d
  JOIN workspaces w ON w.id = d.workspace_id AND w.external_key = 'demo-workspace'`)
console.log(`Demo workspace restored: ${summary}.`)

await run(process.execPath, ["scripts/index-local-search.mjs"], {
  env: { ...process.env, DATABASE_URL: `postgresql://decision_memory:decision_memory@localhost:5434/${database}` },
})
console.log(`To undo: docker compose exec -T postgres pg_restore -U decision_memory -d ${database} --clean --if-exists < ${backupPath}`)
console.log("Saved views and unsent drafts live in the browser; clear site data for localhost:5173 to remove them too.")
