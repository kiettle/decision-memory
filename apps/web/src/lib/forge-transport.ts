import { invokeRemote } from "@forge/bridge"

type Method = "GET" | "POST" | "PUT"

export async function forgeRequest(
  path: string,
  method: Method,
  headers: Record<string, string>,
  body?: unknown
) {
  return invokeRemote({ path, method, headers, body })
}
