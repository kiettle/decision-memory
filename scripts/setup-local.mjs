import { spawn } from "node:child_process"
import { constants } from "node:fs"
import { access, copyFile, mkdir, open, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const root = fileURLToPath(new URL("../", import.meta.url))
process.chdir(root)

export function run(command, args, { capture = false, stdout, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: ["ignore", stdout ?? (capture ? "pipe" : "inherit"), capture ? "pipe" : "inherit"],
    })
    let result = ""
    if (capture) child.stdout?.on("data", (chunk) => { result += chunk })
    child.on("error", reject)
    child.on("exit", (code) => code === 0 ? resolve(result.trim()) : reject(new Error(`${command} ${args.join(" ")} failed (${code}).`)))
  })
}

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

function dependencyExists(workspace, name) {
  try {
    createRequire(new URL(`../apps/${workspace}/package.json`, import.meta.url)).resolve(name)
    return true
  } catch { return false }
}

export async function setupLocal() {
  if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Install Node.js 22 or newer, then rerun npm run dev.")
  await mkdir(".local/backups", { recursive: true })
  const lockHash = createHash("sha256").update(await readFile("package-lock.json")).digest("hex")
  const installedHash = await readFile(".local/dependencies.sha256", "utf8").catch(() => "")
  if (installedHash !== lockHash || !dependencyExists("server", "@huggingface/tokenizers") || !dependencyExists("server", "onnxruntime-web") || !dependencyExists("web", "vite")) {
    await run("npm", ["install"], { env: { ...process.env, ONNXRUNTIME_NODE_INSTALL_CUDA: "skip" } })
    await writeFile(".local/dependencies.sha256", createHash("sha256").update(await readFile("package-lock.json")).digest("hex"))
  }
  if (!await exists(".env")) await copyFile(".env.example", ".env", constants.COPYFILE_EXCL)

  const { config } = await import("../apps/server/src/config.js")
  const databaseUrl = new URL(config.databaseUrl)
  if (!config.localDemoMode || !["localhost", "127.0.0.1"].includes(databaseUrl.hostname) ||
      databaseUrl.port !== "5434" || databaseUrl.pathname !== "/decision_memory") {
    throw new Error("Local startup requires the development database at localhost:5434/decision_memory. Unset NODE_ENV/DATABASE_URL overrides before npm run dev.")
  }

  try { await run("docker", ["info"], { capture: true }) } catch {
    throw new Error("Start Docker Desktop or OrbStack, then rerun npm run dev.")
  }
  const previous = await run("docker", ["compose", "ps", "-q", "postgres"], { capture: true })
  // Back up before replacing an existing container with the pgvector image.
  if (previous) {
    const image = await run("docker", ["inspect", "--format", "{{.Config.Image}}", previous], { capture: true })
    if (!image.startsWith("pgvector/pgvector:")) {
      const path = `.local/backups/postgres-before-pgvector-${Date.now()}.dump`
      const backup = await open(path, "wx", 0o600)
      try { await run("docker", ["compose", "exec", "-T", "postgres", "pg_dump", "-U", "decision_memory", "-d", "decision_memory", "-Fc"], { stdout: backup.fd }) }
      finally { await backup.close() }
      console.log(`Database backup saved to ${path}`)
    }
  }
  await run("docker", ["compose", "up", "-d", "--wait", "postgres"])
  await run("docker", ["compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "decision_memory", "-d", "decision_memory", "-f", "/app/db/schema.sql"], { capture: true })
  const count = await run("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "decision_memory", "-d", "decision_memory", "-Atc", "SELECT count(*) FROM decisions"], { capture: true })
  if (count === "0") {
    await run("docker", ["compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "decision_memory", "-d", "decision_memory", "-f", "/app/db/seed.sql"], { capture: true })
    console.log("Loaded synthetic demo decisions into the empty database.")
  } else {
    console.log(`Preserved ${count} existing decisions; demo seed skipped.`)
  }
  await run(process.execPath, ["scripts/prepare-local-model.mjs"])
  await run(process.execPath, ["scripts/index-local-search.mjs"])
  console.log("Local setup complete. Start the app with npm run dev.")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupLocal().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
