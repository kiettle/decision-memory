import type { Metadata } from "@/types"

export function browserStorageKey(metadata: Metadata, resource: string) {
  return `decision-memory:v1:${encodeURIComponent(metadata.workspace.id)}:${encodeURIComponent(metadata.currentUser.id)}:${resource}`
}

export function readBrowserValue<T>(
  key: string,
  valid: (value: unknown) => value is T
) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return { value: null, error: "" }
    const value: unknown = JSON.parse(raw)
    if (!valid(value)) throw new Error("Invalid browser data")
    return { value, error: "" }
  } catch {
    return {
      value: null,
      error:
        "Could not read browser storage. It may be unavailable or contain damaged data.",
    }
  }
}

export function writeBrowserValue(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
