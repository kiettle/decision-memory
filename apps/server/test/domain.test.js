import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DomainError,
  requireDecisionTitle,
  slackIdempotencyKey,
  validateSupersession,
} from "../src/domain.js"
import { jiraIssueKey } from "../src/repository.js"
import {
  plainSlackText,
  selectCapturedMessages,
  shortcutSource,
  slackCaptureStats,
  slackFormBody,
  verifySlackSignature,
} from "../src/slack.js"
import crypto from "node:crypto"

describe("Decision rules", () => {
  it("accepts and trims the only required field", () => {
    assert.equal(requireDecisionTitle("  Use object storage  "), "Use object storage")
  })

  it("rejects an empty decision", () => {
    assert.throws(() => requireDecisionTitle("  "), DomainError)
  })

  it("allows active decisions in the same workspace to supersede", () => {
    assert.doesNotThrow(() =>
      validateSupersession({
        current: { id: "new", workspaceId: "workspace", status: "ACTIVE" },
        target: { id: "old", workspaceId: "workspace", status: "ACTIVE" },
        workspaceId: "workspace",
      }),
    )
  })

  it("rejects cross-workspace and self supersession", () => {
    assert.throws(
      () =>
        validateSupersession({
          current: { id: "new", workspaceId: "workspace", status: "ACTIVE" },
          target: { id: "old", workspaceId: "other", status: "ACTIVE" },
          workspaceId: "workspace",
        }),
      (error) => error.code === "CROSS_WORKSPACE_RELATION",
    )
    assert.throws(
      () =>
        validateSupersession({
          current: { id: "same", workspaceId: "workspace", status: "ACTIVE" },
          target: { id: "same", workspaceId: "workspace", status: "ACTIVE" },
          workspaceId: "workspace",
        }),
      (error) => error.code === "SELF_SUPERSESSION",
    )
  })
})

describe("Slack boundary", () => {
  it("derives a stable interaction key", () => {
    const first = {
      team: { id: "T1" },
      callback_id: "save_as_decision",
      trigger_id: "trigger-1",
    }
    const second = { ...first, trigger_id: "trigger-2" }
    assert.equal(slackIdempotencyKey(first), slackIdempotencyKey(first))
    assert.notEqual(slackIdempotencyKey(first), slackIdempotencyKey(second))
  })

  it("keeps a selected anchor even when it falls outside the context window", () => {
    const thread = Array.from({ length: 8 }, (_, index) => ({
      user: `U${index}`,
      ts: `${index}`,
      text: `Message ${index}`,
    }))
    const captured = selectCapturedMessages(thread, thread[7], 5)
    assert.equal(captured.length, 5)
    assert.deepEqual(
      captured.filter((message) => message.anchor).map((message) => message.timestamp),
      ["7"],
    )
  })

  it("caps a thread at 100 messages and keeps a long selected anchor", () => {
    const thread = Array.from({ length: 120 }, (_, index) => ({
      user: `U${index}`,
      ts: `${index}`,
      text: `Message ${index}`,
    }))
    const anchor = { user: "U-anchor", ts: "anchor", text: "a".repeat(5_000) }
    const captured = selectCapturedMessages(thread, anchor)
    assert.equal(captured.length, 100)
    assert.equal(captured.at(-1).timestamp, "anchor")
    assert.equal(captured.at(-1).text.length, 4_000)
    assert.equal(captured.filter((message) => message.anchor).length, 1)
  })

  it("resolves author names and reports capture truncation", () => {
    const replies = {
      has_more: true,
      messages: [
        { user: "U1", ts: "1", text: "Anchor", reply_count: 149 },
      ],
    }
    const captured = selectCapturedMessages(
      replies.messages,
      replies.messages[0],
      100,
      new Map([["U1", "Maya Chen"]]),
    )
    assert.equal(captured[0].author, "Maya Chen")
    assert.deepEqual(slackCaptureStats(replies, captured), {
      totalMessageCount: 150,
      capturedMessageCount: 1,
      captureTruncated: true,
    })
  })

  it("accepts a current signature and rejects a stale one", () => {
    const secret = "secret"
    const rawBody = "command=%2Fdecide&text=Use+GCS"
    const timestamp = "1000"
    const signature = `v0=${crypto
      .createHmac("sha256", secret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest("hex")}`
    assert.equal(
      verifySlackSignature({ rawBody, timestamp, signature, secret, now: 1_000_000 }),
      true,
    )
    assert.equal(
      verifySlackSignature({ rawBody, timestamp, signature, secret, now: 2_000_000 }),
      false,
    )
  })
})

describe("Slack Web API calls", () => {
  it("form-encodes arguments and JSON-encodes nested objects", () => {
    const body = slackFormBody({
      channel: "C1",
      limit: 100,
      view: { type: "modal" },
      skipped: undefined,
    })
    assert.equal(body.get("channel"), "C1")
    assert.equal(body.get("limit"), "100")
    assert.deepEqual(JSON.parse(body.get("view")), { type: "modal" })
    assert.equal(body.has("skipped"), false)
  })

  it("keeps the selected message when Slack refuses thread capture", async (t) => {
    const calls = []
    t.mock.method(globalThis, "fetch", async (url, init) => {
      calls.push({ url, init })
      return { json: async () => ({ ok: false, error: "not_in_channel" }) }
    })
    t.mock.method(console, "warn", () => {})
    const source = await shortcutSource(
      { slackBotToken: "xoxb-test" },
      {
        channel: { id: "C1", name: "migration" },
        message: { ts: "1.0", user: "U1", text: "Use GCS.", reply_count: 6 },
      },
    )
    assert.equal(calls.length, 3)
    assert.equal(calls[0].init.headers["content-type"], "application/x-www-form-urlencoded")
    assert.equal(source.permalink, null)
    assert.deepEqual(
      source.messages.map((message) => [message.text, message.anchor]),
      [["Use GCS.", true]],
    )
    assert.equal(source.totalMessageCount, null)
    assert.equal(source.captureStatus, "INCOMPLETE")
    assert.equal(source.captureTruncated, true)
  })
})

 it("follows thread pages and reports text truncation independently", async (t) => {
  const cursors = []
  t.mock.method(globalThis, "fetch", async (url, init) => ({ json: async () => {
    if (!url.endsWith("conversations.replies")) return { ok: true }
    cursors.push(init.body.get("cursor"))
    return cursors.length === 1
      ? { ok: true, messages: [{ ts: "1", text: "a".repeat(5000), reply_count: 2 }], has_more: true, response_metadata: { next_cursor: "page2" } }
      : { ok: true, messages: [{ ts: "2", text: "Final decision" }, { ts: "3", text: "Agree" }] }
  } }))
  const source = await shortcutSource({ slackBotToken: "fixture" }, { channel: { id: "C1", name: "migration" }, message: { ts: "3", thread_ts: "1", text: "Agree" } })
  assert.deepEqual(cursors, [null, "page2"])
  assert.equal(source.messages.length, 3)
  assert.equal(source.messages[0].text.length, 4000)
  assert.equal(source.totalMessageCount, 3)
  assert.equal(source.textTruncated, true)
  assert.equal(source.captureStatus, "CAPTURED")
  assert.equal(source.messages.at(-1).anchor, true)
})

describe("Readable captured Slack discussion", () => {
  it("turns Slack markup into readable text", () => {
    const names = new Map([["U1", "Maya Chen"]])
    assert.equal(
      plainSlackText("<@U1> and <@U9|alex> see <#C1|migration> <!here> <https://example.com/a|runbook> <https://example.com/b> a &lt; b &amp; c", names),
      "@Maya Chen and @alex see #migration @here runbook (https://example.com/a) https://example.com/b a < b & c",
    )
  })

  it("looks up only thread authors and mentions, and keeps IDs when lookup fails", async (t) => {
    const lookedUp = []
    t.mock.method(globalThis, "fetch", async (url, init) => ({ json: async () => {
      if (url.endsWith("conversations.replies")) {
        return { ok: true, messages: [
          { ts: "1", user: "U1", text: "Should backups stay in PostgreSQL?", reply_count: 1 },
          { ts: "2", user: "U2", text: "<@U1> let's use GCS" },
        ] }
      }
      if (url.endsWith("users.info")) {
        const user = init.body.get("user")
        lookedUp.push(user)
        return user === "U1"
          ? { ok: true, user: { profile: { display_name: "Maya Chen" } } }
          : { ok: false, error: "user_not_found" }
      }
      if (url.endsWith("users.list")) assert.fail("The whole workspace directory must not be read")
      return { ok: true, permalink: "https://example.slack.com/p2" }
    } }))
    const source = await shortcutSource(
      { slackBotToken: "fixture" },
      { channel: { id: "C1", name: "migration" }, message: { ts: "2", thread_ts: "1", user: "U2", text: "<@U1> let's use GCS" } },
    )
    assert.deepEqual(lookedUp.sort(), ["U1", "U2"])
    assert.deepEqual(source.messages.map((message) => message.author), ["Maya Chen", "U2"])
    assert.equal(source.messages[1].text, "@Maya Chen let's use GCS")
    assert.equal(source.anchorText, "@Maya Chen let's use GCS")
  })
})

describe("Related work labels", () => {
  it("uses the Jira issue key from a Jira URL", () => {
    assert.equal(jiraIssueKey("https://acme.atlassian.net/browse/mig-182?focus=1"), "MIG-182")
    assert.equal(jiraIssueKey("https://example.com/docs"), null)
  })
})
