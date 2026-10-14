import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

import { setupLocal } from "./setup-local.mjs"

// Check fixed local ports before setup so we never interrupt another app.
async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once("error", () => reject(new Error(`Port ${port} is in use. Stop the existing app, then rerun npm run dev.`)))
    probe.listen(port, "127.0.0.1", () => probe.close(resolve))
  })
}

try {
  for (const port of [3011, 3012, 5173]) await assertPortAvailable(port)
  await setupLocal()
  const webRequire = createRequire(new URL("../apps/web/package.json", import.meta.url))
  const viteCli = join(dirname(webRequire.resolve("vite/package.json")), "bin/vite.js")
  const children = [
    spawn(process.execPath, ["--watch", "apps/server/src/index.js"], { stdio: "inherit" }),
    spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", "5173", "--strictPort"], { cwd: "apps/web", stdio: "inherit" }),
  ]
  let stopping = false
  function stop(code = 0) {
    if (stopping) return
    stopping = true
    process.exitCode = code
    for (const child of children) child.kill("SIGTERM")
  }
  process.on("SIGINT", () => stop())
  process.on("SIGTERM", () => stop())
  for (const child of children) {
    child.on("error", (error) => { console.error(error.message); stop(1) })
    child.on("exit", (code) => { if (!stopping) stop(code || 1) })
  }
  console.log("Open http://localhost:5173 — local memory search is ready. Ctrl+C stops the app; database data is preserved.")
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
