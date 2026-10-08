import type { Decision } from "@/types"

// Where a Decision was discussed, filled in automatically by Slack capture.
export function slackChannels(decision: Decision) {
  return [
    ...new Set(
      (decision.sources ?? [])
        .map((source) => source.channelName)
        .filter((name): name is string => Boolean(name))
        .map((name) => `#${name}`)
    ),
  ]
}
