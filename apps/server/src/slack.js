import crypto from "node:crypto"
import express from "express"
import { headline } from "../../../shared/decision-deadlines.js"

import { slackIdempotencyKey } from "./domain.js"
import { looksLikeDecision, looksLikeQuestion } from "./nudges.js"
import { decisionInput, replacementReasonInput } from "./validation.js"
import { createSlackProposalHandler } from "./slack-proposal-review.js"

const FIVE_MINUTES_SECONDS = 60 * 5
const MAX_CAPTURED_MESSAGES = 100
const MAX_MESSAGE_CHARACTERS = 4_000

export function verifySlackSignature({ rawBody, timestamp, signature, secret, now = Date.now() }) {
  if (!rawBody || !timestamp || !signature || !secret) return false
  if (!Number.isFinite(Number(timestamp))) return false
  if (Math.abs(now / 1000 - Number(timestamp)) > FIVE_MINUTES_SECONDS) return false
  const base = `v0:${timestamp}:${rawBody}`
  const expected = `v0=${crypto.createHmac("sha256", secret).update(base).digest("hex")}`
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)
  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  )
}

function inputBlock(id, label, initialValue = "", multiline = false, optional = true) {
  return {
    type: "input",
    block_id: id,
    optional,
    label: { type: "plain_text", text: label },
    element: {
      type: "plain_text_input",
      action_id: "value",
      max_length: id === "title" ? 500 : id === "replacementReason" ? 2000 : 3000,
      multiline,
      ...(initialValue ? { initial_value: initialValue.slice(0, id === "title" ? 500 : 3000) } : {}),
    },
  }
}

// Stored titles and AI explanations go into mrkdwn, so Slack's control
// characters are escaped before they are shown.
const escapeMrkdwn = (value = "") =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const decisionLink = (appBaseUrl, decision) =>
  `<${appBaseUrl}/#/decisions/${decision.id}|${escapeMrkdwn(`${decision.decisionKey} · ${headline(decision)}`.slice(0, 150))}>`

const MAX_SIMILAR = 3
// Search by memory scores 0–100; weaker matches are noise in a Slack window.
const MIN_MATCH_SCORE = 60

// "Already decided?": stored Decisions that look like the one being saved.
async function similarDecisions(memorySearch, identity, text) {
  if (!memorySearch.enabled || !text || text.trim().length < 3) return []
  try {
    const { matches } = await memorySearch.search(identity, { query: text.slice(0, 500) })
    return matches
      .filter((match) => match.score >= MIN_MATCH_SCORE)
      .slice(0, MAX_SIMILAR)
      .map(({ decision }) => ({
        id: decision.id,
        decisionKey: decision.decisionKey,
        title: headline(decision).slice(0, 60),
        status: decision.status,
        why: decision.why?.slice(0, 180) || "",
        appliesTo: (decision.appliesTo ?? []).slice(0, 2).map((scope) => scope.slice(0, 80)),
      }))
  } catch {
    return []
  }
}

function similarBlocks(appBaseUrl, similar = [], values = {}) {
  if (!similar.length) return []
  const active = similar.filter((decision) => decision.status === "ACTIVE" && decision.decisionState !== "PENDING")
  const chosen = active.find((decision) => decision.id === selectedAt(values, "replaces"))
  const option = (decision) => ({
    text: { type: "plain_text", text: `${decision.decisionKey} · ${headline(decision)}`.slice(0, 75) },
    value: decision.id,
  })
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*Already decided?* Similar Decisions are on record:",
          ...similar.map((decision) => [
            `• ${decisionLink(appBaseUrl, decision)} (${decision.status === "ACTIVE" ? "Active" : "Superseded"})`,
            decision.appliesTo?.length ? `  Applies to: ${escapeMrkdwn(decision.appliesTo.join(", "))}` : "",
            decision.why ? `  Why: ${escapeMrkdwn(decision.why)}` : "",
          ].filter(Boolean).join("\n")),
        ].join("\n"),
      },
    },
    ...(active.length
      ? [{
          type: "input",
          block_id: "replaces",
          optional: true,
          label: { type: "plain_text", text: "Replaces an earlier Decision?" },
          hint: { type: "plain_text", text: "The chosen Decision will be marked as superseded by this one." },
          element: {
            type: "static_select",
            action_id: "value",
            placeholder: { type: "plain_text", text: "No, this is a new Decision" },
            options: active.map(option),
            ...(chosen ? { initial_option: option(chosen) } : {}),
          },
        }, inputBlock("replacementReason", "What changed? (if replacing a Decision)", valueAt(values, "replacementReason"), true)]
      : []),
  ]
}

// Draft notices use plain text because they include thread-derived content.
function aiDraftNotice(aiDraft) {
  if (!aiDraft) return []
  const text = aiDraft.outcome === "DECISION"
    ? [
        ...(aiDraft.otherPossibleDecisions.length
          ? [`Other possible decisions in this thread: ${aiDraft.otherPossibleDecisions.join("; ")}`]
          : []),
      ].join("\n")
    : [
        "AI found no clear final Decision in this thread. Write the Decision yourself.",
        ...(aiDraft.optionsConsidered.length
          ? [`Options discussed: ${aiDraft.optionsConsidered.join("; ")}`]
          : []),
      ].join("\n")
  return text ? [{ type: "section", text: { type: "plain_text", text: text.slice(0, 3_000) } }] : []
}

function captureModal({ title = "", source, metadata, values = {}, error, aiDraft, appBaseUrl }) {
  const sourceText = source?.anchorText
    ? `Captured from #${source.channelName ?? source.channelId}: “${source.anchorText.slice(0, 220)}”${source.capturedMessageCount ? ` · ${source.capturedMessageCount} messages` : ""}`
    : metadata.draftId ? "The captured source remains attached to this draft." : `No Slack message thread is attached. The channel${metadata.channelName ? ` (#${metadata.channelName})` : ""}, user, and submission time will be recorded.`
  // Values the person already typed win over the AI draft (for example after a failed save).
  const initial = (field, drafted = "") => valueAt(values, field) || drafted
  const options = initial("options", aiDraft?.optionsConsidered.join("\n"))
  return {
    type: "modal",
    callback_id: "decision_memory_save",
    private_metadata: JSON.stringify({ ...metadata, ...(metadata.similar ? {
      similar: metadata.similar.map(({ id, decisionKey, title, status }) => ({ id, decisionKey, title, status })),
    } : {}) }),
    title: { type: "plain_text", text: "Save as Decision" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      ...(error ? [{ type: "section", text: { type: "plain_text", text: error } }] : []),
      ...(source?.captureStatus === "INCOMPLETE" ? [{ type: "section", text: { type: "plain_text", text: "Thread capture was incomplete. Only the messages shown in the saved snapshot will be preserved. Add enough Decision, Why, and Context to understand it later." } }] : []),
      {
        type: "section",
        text: { type: "mrkdwn", text: sourceText },
      },
      ...aiDraftNotice(aiDraft),
      ...similarBlocks(appBaseUrl, metadata.similar, values),
      inputBlock("title", "Decision", title, true, false),
      inputBlock("why", "Why", initial("why", aiDraft?.why), true),
      inputBlock("context", "Context", initial("context", aiDraft?.context), true),
      inputBlock("appliesTo", "Applies To", initial("appliesTo", aiDraft?.appliesTo.join(", "))),
      ...(options ? [inputBlock("options", "Options Considered (one per line)", options, true)] : []),
      inputBlock("owner", "Owner", initial("owner", aiDraft?.owner)),
      inputBlock("tags", "Tags", initial("tags", aiDraft?.tags.join(", "))),
      inputBlock("relatedUrl", "Related Jira URL", valueAt(values, "relatedUrl")),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: source?.anchorText || metadata.draftId
              ? "The selected message and available thread context will be stored with this Decision."
              : "Only the invoking channel, user, and time will be stored as Slack context.",
          },
        ],
      },
    ],
  }
}

// Slack read methods such as conversations.replies accept only form-encoded
// arguments, so every call uses that format and JSON-encodes nested objects.
export function slackFormBody(args) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue
    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value))
  }
  return body
}

async function slackApi(config, method, args, signal) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.slackBotToken}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: slackFormBody(args),
    signal: signal ? globalThis.AbortSignal.any([signal, globalThis.AbortSignal.timeout(2_000)]) : globalThis.AbortSignal.timeout(2_000),
  })
  const result = await response.json()
  if (!result.ok) throw new Error(`Slack ${method} failed: ${result.error}`)
  return result
}

function authorFor(message, authorNames) {
  return (
    authorNames.get(message.user) ??
    message.user ??
    message.username ??
    message.bot_profile?.name ??
    "Slack user"
  )
}

const MAX_NAME_LOOKUPS = 25
const mentionedUserIds = (text = "") =>
  [...text.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g)].map((match) => match[1])

// Slack stores mentions, channels, and links as markup; keep the readable form
// so the saved discussion still makes sense without Slack.
export function plainSlackText(text = "", names = new Map()) {
  return text
    .replace(/<@([UW][A-Z0-9]+)(?:\|([^>]*))?>/g, (_, id, label) => `@${names.get(id) ?? label ?? id}`)
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<!(here|channel|everyone)(?:\|[^>]*)?>/g, "@$1")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

// Look up only the people in this thread, not the whole workspace directory.
async function threadUserNames(config, messages) {
  const ids = [...new Set(messages.flatMap((message) => [message.user, ...mentionedUserIds(message.text)]))]
    .filter(Boolean)
    .slice(0, MAX_NAME_LOOKUPS)
  const entries = await Promise.all(
    ids.map((id) =>
      slackApi(config, "users.info", { user: id })
        .then(({ user }) => [id, user.profile?.display_name || user.profile?.real_name || user.real_name || user.name])
        .catch(() => [id, null]),
    ),
  )
  return new Map(entries.filter(([, name]) => name))
}

const capturedText = (message, names) =>
  plainSlackText(message.text ?? "", names).slice(0, MAX_MESSAGE_CHARACTERS)

export function selectCapturedMessages(
  threadMessages,
  anchorMessage,
  limit = MAX_CAPTURED_MESSAGES,
  authorNames = new Map(),
) {
  const messages = (threadMessages ?? []).map((item) => ({
    author: authorFor(item, authorNames),
    timestamp: item.ts,
    text: capturedText(item, authorNames),
    anchor: item.ts === anchorMessage.ts,
  }))
  const anchorIndex = messages.findIndex((item) => item.anchor)
  if (anchorIndex === -1) {
    const anchor = {
      author: authorFor(anchorMessage, authorNames),
      timestamp: anchorMessage.ts,
      text: capturedText(anchorMessage, authorNames),
      anchor: true,
    }
    if (messages.length >= limit) return [...messages.slice(0, limit - 1), anchor]
    messages.push(anchor)
  }
  if (anchorIndex >= limit) {
    return [...messages.slice(0, limit - 1), messages[anchorIndex]]
  }
  return messages.slice(0, limit)
}

export function slackCaptureStats(replies, messages) {
  const knownReplyCount = Number(replies.messages?.[0]?.reply_count)
  const totalMessageCount = Number.isFinite(knownReplyCount)
    ? Math.max(messages.length, knownReplyCount + 1)
    : Math.max(messages.length, replies.messages?.length ?? 0)
  return {
    totalMessageCount,
    capturedMessageCount: messages.length,
    captureTruncated: Boolean(
      replies.has_more ||
        replies.response_metadata?.next_cursor ||
        totalMessageCount > messages.length,
    ),
  }
}

// Thread capture is best effort: if Slack refuses (for example, the bot is not
// in the channel), the selected message is still saved so the modal opens.
function warnAndFallBack(fallback) {
  return (error) => {
    console.warn("Slack thread capture degraded", error.message)
    return fallback
  }
}

// Pagination remains bounded to this selected thread and the approved cap.
async function threadReplies(config, channel, ts, anchor) {
  const signal = globalThis.AbortSignal.timeout(6_000)
  const messages = []
  const cursors = new Set()
  let cursor
  let page
  try {
    do {
      page = await slackApi(config, "conversations.replies", {
        channel, ts, limit: MAX_CAPTURED_MESSAGES - messages.length, cursor,
      }, signal)
      for (const message of page.messages ?? []) {
        if (!messages.some((item) => item.ts === message.ts)) messages.push(message)
      }
      cursor = page.response_metadata?.next_cursor
      if (!cursor || cursors.has(cursor) || !(page.messages?.length)) break
      cursors.add(cursor)
    } while (messages.length < MAX_CAPTURED_MESSAGES)
    return { ...page, messages }
  } catch {
    return { messages: messages.length ? messages : [anchor], captureFailed: true }
  }
}

export async function shortcutSource(config, payload) {
  const channelId = payload.channel?.id
  if (!channelId || !payload.message?.ts) return null
  const threadId = payload.message.thread_ts ?? payload.message.ts
  const [permalink, replies] = await Promise.all([
    slackApi(config, "chat.getPermalink", { channel: channelId, message_ts: payload.message.ts }).catch(
      warnAndFallBack({}),
    ),
    threadReplies(config, channelId, threadId, payload.message),
  ])
  // A "Save it?" button only carries the message timestamp; read its text from the thread.
  const message = payload.message.text === undefined
    ? (replies.messages ?? []).find((item) => item.ts === payload.message.ts) ?? payload.message
    : payload.message
  const authorNames = await threadUserNames(config, [message, ...(replies.messages ?? [])])
  const messages = selectCapturedMessages(replies.messages, message, MAX_CAPTURED_MESSAGES, authorNames)
  const stats = slackCaptureStats(replies, messages)
  const textTruncated = (message.text?.length ?? 0) > MAX_MESSAGE_CHARACTERS ||
    (replies.messages ?? []).some((item) => (item.text?.length ?? 0) > MAX_MESSAGE_CHARACTERS)
  return {
    provider: "SLACK",
    externalChannelId: channelId,
    externalThreadId: threadId,
    anchorExternalId: message.ts,
    anchorText: capturedText(message, authorNames),
    permalink: permalink.permalink ?? null,
    capturedAt: new Date().toISOString(),
    messages,
    channelId,
    channelName: payload.channel?.name,
    ...stats,
    totalMessageCount: replies.captureFailed ? null : stats.totalMessageCount,
    captureStatus: replies.captureFailed ? "INCOMPLETE" : "CAPTURED",
    textTruncated,
    captureTruncated: Boolean(replies.captureFailed || stats.captureTruncated || textTruncated),
  }
}

function parseInteraction(rawBody) {
  const params = new URLSearchParams(rawBody)
  const encodedPayload = params.get("payload")
  return encodedPayload ? JSON.parse(encodedPayload) : Object.fromEntries(params.entries())
}

const valueAt = (state, blockId) => state?.[blockId]?.value?.value?.trim() ?? ""
const selectedAt = (state, blockId) => state?.[blockId]?.value?.selected_option?.value ?? ""

function submissionInput(values) {
  const list = (field) => valueAt(values, field).split(",").map((item) => item.trim()).filter(Boolean)
  const url = valueAt(values, "relatedUrl")
  return {
    title: valueAt(values, "title"), why: valueAt(values, "why"),
    context: valueAt(values, "context"), appliesTo: list("appliesTo"),
    optionsConsidered: valueAt(values, "options").split("\n").map((item) => item.trim()).filter(Boolean),
    ownerName: valueAt(values, "owner"), tags: list("tags"),
    references: url ? [{ kind: "JIRA", url }] : [],
  }
}

function progressModal(title, text, markdown = false) {
  return {
    type: "modal", title: { type: "plain_text", text: title },
    close: { type: "plain_text", text: "Close" },
    blocks: [{ type: "section", text: { type: markdown ? "mrkdwn" : "plain_text", text } }],
  }
}

function identityForSlack(config, payload) {
  return {
    workspaceExternalKey: config.localWorkspaceId,
    cloudId: config.localCloudId,
    userExternalId: payload.user?.id ?? payload.user_id ?? "slack-user",
    userDisplayName: payload.user?.name ?? payload.user_name ?? "Slack user",
    source: "slack",
  }
}

// "Ask Decision Memory": answers a question privately in a Slack window, using
// the same grounded Search by memory as the web app. Nothing is posted to the
// channel.
function answerModal(appBaseUrl, question, matches) {
  const blocks = [
    { type: "section", text: { type: "plain_text", text: `You asked: “${question.slice(0, 280)}”` } },
  ]
  if (!matches.length) {
    blocks.push({
      type: "section",
      text: {
        type: "plain_text",
        text: "No stored Decision matches this. If the team has decided it, save it with Save as Decision.",
      },
    })
  }
  for (const { decision, explanation } of matches) {
    const details = [
      decision.status === "ACTIVE" ? "Active" : "Superseded",
      decision.appliesTo?.length ? `Applies to ${decision.appliesTo.join(", ")}` : null,
    ].filter(Boolean).join(" · ")
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*${decisionLink(appBaseUrl, decision)}*`,
            escapeMrkdwn(details),
            decision.why ? `*Why:* ${escapeMrkdwn(decision.why.slice(0, 400))}` : null,
            `_${escapeMrkdwn(explanation)}_`,
          ].filter(Boolean).join("\n").slice(0, 3_000),
        },
      },
    )
  }
  return {
    type: "modal",
    title: { type: "plain_text", text: "Decision Memory" },
    close: { type: "plain_text", text: "Close" },
    blocks,
  }
}

async function answerQuestion(config, memorySearch, payload, question) {
  const opened = await slackApi(config, "views.open", {
    trigger_id: payload.trigger_id,
    view: progressModal("Decision Memory", "Searching stored Decisions…"),
  })
  const library = `<${config.appBaseUrl}|Decision Library>`
  let view
  if (question.trim().length < 3) {
    view = progressModal("Decision Memory", "Ask a question after /why, for example: /why do we use PostgreSQL for the Migration Service?")
  } else if (!memorySearch.enabled) {
    view = progressModal("Decision Memory", `Asking needs Search by memory, which is not configured. Search the ${library} instead.`, true)
  } else {
    try {
      const { matches, truncated, candidateCount, totalCandidateCount } = await memorySearch.search(identityForSlack(config, payload), {
        query: question.trim().slice(0, 500),
      })
      view = answerModal(
        config.appBaseUrl,
        question.trim(),
        matches.filter((match) => match.score >= MIN_MATCH_SCORE),
      )
      if (truncated) view.blocks.unshift({ type: "section", text: { type: "plain_text",
        text: `Searched ${candidateCount} of ${totalCandidateCount} Decisions. The rest are waiting for local indexing. Retry shortly or use normal keyword search.` } })
    } catch {
      view = progressModal("Decision Memory", `Search is unavailable right now. Try again, or search the ${library}.`, true)
    }
  }
  await slackApi(config, "views.update", { view_id: opened.view.id, view })
}

// Supersedes the earlier Decision chosen in the form. Only Decisions the form
// offered are accepted, and a retried save that already applied it succeeds.
async function replaceEarlierDecision(repository, identity, decision, metadata, values) {
  const target = (metadata.similar ?? []).find(
    (similar) => similar.id === selectedAt(values, "replaces") && similar.status === "ACTIVE",
  )
  if (!target) return ""
  try {
    await repository.supersedeDecision(identity, decision.id, target.id, replacementReasonInput.parse(valueAt(values, "replacementReason")))
  } catch (error) {
    const current = await repository.getDecision(identity, decision.id).catch(() => null)
    if (!current?.lifecycle?.supersedes.some((item) => item.id === target.id)) {
      return ` ${escapeMrkdwn(target.decisionKey)} was not marked as replaced: ${escapeMrkdwn(error.message)}`
    }
  }
  return ` It replaces ${escapeMrkdwn(target.decisionKey)}, which is now superseded.`
}

// Save as Decision: opens a progress window first (Slack's trigger expires in
// three seconds), then captures the thread, drafts with AI, checks for similar
// Decisions, and shows the form.
async function openCapture(config, repository, services, payload, { title } = {}) {
  const { captureDrafter, memorySearch } = services
  const opened = await slackApi(config, "views.open", {
    trigger_id: payload.trigger_id,
    view: progressModal(
      "Capturing discussion…",
      captureDrafter.enabled
        ? "Preparing the selected message and thread context, drafting the Decision with AI, and checking for similar Decisions."
        : "Preparing the selected message and available thread context.",
    ),
  })
  let hash = opened.view.hash
  try {
    const source = await shortcutSource(config, payload)
    const identity = identityForSlack(config, payload)
    const draft = await repository.createSlackCaptureDraft(identity, {
      externalEventId: slackIdempotencyKey(payload),
      slackTeamId: payload.team?.id,
      slackUserId: payload.user?.id,
      source,
    })
    if (captureDrafter.enabled || memorySearch.enabled) {
      const waiting = progressModal("Optional AI assistance", "Your discussion is captured. Continue manually now, or wait for AI drafting and similar Decisions.")
      waiting.private_metadata = JSON.stringify({ draftId: draft.id, manualTitle: title || source?.anchorText?.slice(0, 500) || "" })
      waiting.blocks.push({ type: "actions", elements: [{ type: "button", action_id: "capture_continue_manually",
        text: { type: "plain_text", text: "Continue manually" } }] })
      const updated = await slackApi(config, "views.update", { view_id: opened.view.id, view: waiting })
      hash = updated.view?.hash
    }
    const aiDraft = await captureDrafter.draft(source?.messages)
    const similar = await similarDecisions(memorySearch, identity, aiDraft?.decision || source?.anchorText)
    if (aiDraft) await repository.setSlackCaptureDraftAi(identity, draft.id, {
      outcome: aiDraft.outcome, confidence: aiDraft.confidence, relevantMessageIds: aiDraft.relevantMessageIds,
    })
    // Slack rejects this update if Continue manually, Save, or another view
    // update has advanced the hash. Never overwrite the person's working form.
    await slackApi(config, "views.update", {
      view_id: opened.view.id,
      hash,
      view: captureModal({
        title: title || aiDraft?.decision || (source?.anchorText ?? ""),
        source,
        metadata: { draftId: draft.id, similar },
        aiDraft,
        error: captureDrafter.enabled && !aiDraft
          ? "AI drafting unavailable—please complete the fields manually."
          : undefined,
        appBaseUrl: config.appBaseUrl,
      }),
    })
  } catch (error) {
    if (error.message?.includes("hash_conflict") || error.message?.includes("invalid_hash") || error.message?.includes("not_found")) return
    await slackApi(config, "views.update", {
      view_id: opened.view.id,
      hash,
      view: progressModal("Capture unavailable", "Nothing was saved. Close this window and use Save as Decision again."),
    })
  }
}

// Nudges: the bot speaks up, privately, in channels it is invited to.
// An unasked interruption must be right, so recall needs a stronger match
// than Ask (MIN_MATCH_SCORE).
const RECALL_MIN_SCORE = 75
const SLACK_TS = /^\d+\.\d+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Updates or removes the private nudge through the response_url Slack signed into the click.
async function respond(responseUrl, body) {
  if (!/^https:\/\/hooks\.slack\.com\//.test(responseUrl ?? "")) return
  await fetch(responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: globalThis.AbortSignal.timeout(2_000),
  })
}

function decisionSummary(appBaseUrl, decision) {
  const details = [
    decision.status === "ACTIVE" ? "Active" : "Superseded",
    decision.appliesTo?.length ? `Applies to ${decision.appliesTo.join(", ")}` : null,
  ].filter(Boolean).join(" · ")
  return [
    `*${decisionLink(appBaseUrl, decision)}*`,
    escapeMrkdwn(details),
    decision.why ? `*Why:* ${escapeMrkdwn(decision.why.slice(0, 300))}` : null,
  ].filter(Boolean).join("\n")
}

function recallMessage(appBaseUrl, decision, threadTs) {
  return {
    text: `Already decided: ${decision.decisionKey} · ${headline(decision)}`.slice(0, 300),
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:bulb: *Already decided*\n${decisionSummary(appBaseUrl, decision)}`.slice(0, 3_000) } },
      { type: "context", elements: [{ type: "mrkdwn", text: "Only you can see this. Decision Memory matched your question to a stored Decision." }] },
      {
        type: "actions",
        elements: [
          { type: "button", action_id: "nudge_open", text: { type: "plain_text", text: "Open Decision" }, url: `${appBaseUrl}/#/decisions/${decision.id}` },
          { type: "button", action_id: "nudge_share", style: "primary", text: { type: "plain_text", text: "Share in thread" }, value: JSON.stringify({ decisionId: decision.id, threadTs }) },
          { type: "button", action_id: "nudge_dismiss", text: { type: "plain_text", text: "Not relevant" }, value: "dismiss" },
        ],
      },
    ],
  }
}

const SAVE_PROMPT = ":memo: Looks like this thread reached a decision. Save it so the team can find it later?"

// A private "Save as Decision" button. Slack opens forms only from a click or a
// slash command, so a nudge or a mention offers this button instead.
function captureMessage(ts, threadTs, { prompt = SAVE_PROMPT, title = "", preview = "" } = {}) {
  return {
    text: "Save this thread as a Decision?",
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: prompt } },
      ...(preview
        ? [{ type: "section", text: { type: "plain_text", text: `Selected message: “${preview.slice(0, 200)}”` } }]
        : []),
      { type: "context", elements: [{ type: "mrkdwn", text: "Only you can see this." }] },
      {
        type: "actions",
        elements: [
          { type: "button", action_id: "nudge_save", style: "primary", text: { type: "plain_text", text: "Save as Decision" }, value: JSON.stringify({ ts, threadTs, ...(title ? { title: title.slice(0, 500) } : {}) }) },
          { type: "button", action_id: "nudge_dismiss", text: { type: "plain_text", text: "Not now" }, value: "dismiss" },
        ],
      },
    ],
  }
}

const MENTION_COMMAND = /^(?:decide|decision|save|chốt|lưu)(?=$|[\s:,.!-])[\s:,.!-]*/iu
const byTimestamp = (ts) => BigInt(ts.replace(".", ""))

// "@Decision Memory decide [title]". In a thread, the selected message is the
// latest message before the mention, so the AI draft reads the discussion
// rather than the mention itself.
async function mentionCapture(config, event, text) {
  const command = MENTION_COMMAND.exec(text)
  const reply = { channel: event.channel, user: event.user, ...(event.thread_ts ? { thread_ts: event.thread_ts } : {}) }
  if (!command) {
    await slackApi(config, "chat.postEphemeral", {
      ...reply,
      text: "Mention me with “decide” in a thread to save it as a Decision, or ask with /why <question>.",
    })
    return
  }
  const title = text.slice(command[0].length).trim()
  const threadTs = event.thread_ts ?? event.ts
  let anchor = { ts: event.ts, text: "" }
  if (event.thread_ts && SLACK_TS.test(event.ts)) {
    const replies = await slackApi(config, "conversations.replies", { channel: event.channel, ts: threadTs, limit: MAX_CAPTURED_MESSAGES })
      .catch(warnAndFallBack({ messages: [] }))
    const earlier = (replies.messages ?? []).filter((message) =>
      SLACK_TS.test(message.ts ?? "") && byTimestamp(message.ts) < byTimestamp(event.ts) &&
      message.user && !message.bot_id && !message.subtype)
    anchor = earlier.at(-1) ?? anchor
  }
  await slackApi(config, "chat.postEphemeral", {
    ...reply,
    ...captureMessage(anchor.ts, threadTs, {
      prompt: event.thread_ts ? ":memo: Save this thread as a Decision?" : ":memo: Save this as a Decision?",
      title,
      preview: plainSlackText(anchor.text ?? ""),
    }),
  })
}

// Events carry only the Slack user ID; use the same name as other Slack entry points.
async function eventIdentity(config, userId) {
  const name = await slackApi(config, "users.info", { user: userId })
    .then(({ user }) => user.name)
    .catch(() => undefined)
  return identityForSlack(config, { user: { id: userId, name } })
}

async function recallNudge(config, repository, { memorySearch }, event, text, thread) {
  if (!memorySearch.enabled) return
  const identity = await eventIdentity(config, event.user)
  const [{ matches }, savedHere] = await Promise.all([
    memorySearch.search(identity, { query: text.slice(0, 500), filters: { status: "ACTIVE" } }),
    repository.decisionIdsForThread(identity, event.channel, thread.threadTs),
  ])
  const match = [...matches]
    .sort((a, b) => b.score - a.score)
    .find(({ score, decision }) =>
      score >= RECALL_MIN_SCORE && decision.decisionState !== "PENDING" && decision.status === "ACTIVE" && !savedHere.includes(decision.id))
  if (!match) return
  const claimed = await repository.claimSlackNudge(identity, {
    channelId: event.channel, threadTs: thread.threadTs, kind: "RECALL", decisionId: match.decision.id,
  })
  if (!claimed) return
  await slackApi(config, "chat.postEphemeral", {
    channel: event.channel,
    user: event.user,
    ...(thread.inThread ? { thread_ts: thread.threadTs } : {}),
    ...recallMessage(config.appBaseUrl, match.decision, thread.threadTs),
  })
}

async function captureNudge(config, repository, event, thread) {
  const identity = await eventIdentity(config, event.user)
  if ((await repository.decisionIdsForThread(identity, event.channel, thread.threadTs)).length) return
  const claimed = await repository.claimSlackNudge(identity, {
    channelId: event.channel, threadTs: thread.threadTs, kind: "CAPTURE",
  })
  if (!claimed) return
  await slackApi(config, "chat.postEphemeral", {
    channel: event.channel,
    user: event.user,
    thread_ts: thread.threadTs,
    ...captureMessage(event.ts, thread.threadTs),
  })
}

// Only people's new messages in channels count: not bots, edits, joins, or DMs.
export async function handleSlackEvent(config, repository, services, body) {
  const event = body.event
  if (body.type !== "event_callback" || !["message", "app_mention"].includes(event?.type)) return
  if (event.subtype || event.bot_id || !event.user || !event.text) return
  const text = plainSlackText(event.text.replace(/<@[UW][A-Z0-9]+(?:\|[^>]*)?>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
  if (event.type === "app_mention") {
    await mentionCapture(config, event, text)
    return
  }
  if (!["channel", "group"].includes(event.channel_type)) return
  // A mention also arrives as a message; the mention handler answers it.
  const botUserId = body.authorizations?.[0]?.user_id
  if (botUserId && event.text.includes(`<@${botUserId}`)) return
  const inThread = Boolean(event.thread_ts && event.thread_ts !== event.ts)
  const thread = { inThread, threadTs: event.thread_ts ?? event.ts }
  if (looksLikeQuestion(text)) {
    await recallNudge(config, repository, services, event, text, thread)
  } else if (inThread && looksLikeDecision(text)) {
    await captureNudge(config, repository, event, thread)
  }
}

function buttonValue(action) {
  try {
    return JSON.parse(action.value)
  } catch {
    return {}
  }
}

async function shareDecision(config, repository, payload, action, channelId) {
  const { decisionId, threadTs } = buttonValue(action)
  if (!UUID.test(decisionId ?? "") || !SLACK_TS.test(threadTs ?? "")) return
  const identity = identityForSlack(config, payload)
  const decision = await repository.getDecision(identity, decisionId)
  if (!decision || decision.decisionState === "PENDING") {
    await respond(payload.response_url, { replace_original: true, text: "That Decision is no longer available." })
    return
  }
  // A double click must not post twice.
  if (await repository.claimSlackNudge(identity, { channelId, threadTs, kind: "SHARE", decisionId })) {
    await slackApi(config, "chat.postMessage", {
      channel: channelId,
      thread_ts: threadTs,
      unfurl_links: false,
      text: `Already decided: ${decision.decisionKey} · ${headline(decision)}`.slice(0, 300),
      blocks: [{
        type: "section",
        text: { type: "mrkdwn", text: `<@${payload.user.id}> shared a Decision on record:\n${decisionSummary(config.appBaseUrl, decision)}`.slice(0, 3_000) },
      }],
    })
  }
  await respond(payload.response_url, { delete_original: true })
}

async function handleNudgeAction(config, repository, services, payload) {
  const action = payload.actions?.[0]
  const channelId = payload.channel?.id ?? payload.container?.channel_id
  if (!action || !channelId || !payload.user?.id) return
  if (action.action_id === "nudge_dismiss") {
    await respond(payload.response_url, { delete_original: true })
  } else if (action.action_id === "nudge_share") {
    await shareDecision(config, repository, payload, action, channelId)
  } else if (action.action_id === "nudge_save") {
    const { ts, threadTs, title } = buttonValue(action)
    if (!SLACK_TS.test(ts ?? "") || !SLACK_TS.test(threadTs ?? "")) return
    await openCapture(config, repository, services, {
      ...payload,
      channel: { id: channelId, name: payload.channel?.name },
      message: { ts, thread_ts: threadTs },
    }, { title: typeof title === "string" ? title.slice(0, 500) : "" })
    await respond(payload.response_url, { delete_original: true }).catch(() => {})
  }
}

async function handleSlackPayload(config, repository, services, payload) {
  const { memorySearch } = services
  if (config.slackTeamId) {
    const teamId = payload.team?.id ?? payload.team_id
    if (teamId !== config.slackTeamId) throw new Error("Slack workspace is not configured")
  }

  if (payload.type === "block_actions" && payload.actions?.[0]?.action_id === "capture_continue_manually") {
    const metadata = JSON.parse(payload.view?.private_metadata || "{}")
    const draft = await repository.getSlackCaptureDraft(identityForSlack(config, payload), metadata.draftId)
    if (!draft || draft.slackUserId !== payload.user?.id || draft.slackTeamId !== payload.team?.id) return
    await slackApi(config, "views.update", {
      view_id: payload.view.id, hash: payload.view.hash,
      view: captureModal({ title: metadata.manualTitle || draft.source.anchorText || "", source: draft.source,
        metadata: { draftId: draft.id, skipAi: true }, appBaseUrl: config.appBaseUrl }),
    })
    return
  }

  if (payload.type === "block_actions") {
    await handleNudgeAction(config, repository, services, payload)
    return
  }

  if (payload.command === "/why") {
    await answerQuestion(config, memorySearch, payload, payload.text ?? "")
    return
  }

  if (payload.type === "message_action" && payload.callback_id === "ask_decision_memory") {
    await answerQuestion(config, memorySearch, payload, plainSlackText(payload.message?.text ?? ""))
    return
  }

  if (payload.command === "/decide") {
    await slackApi(config, "views.open", {
      trigger_id: payload.trigger_id,
      view: captureModal({
        title: payload.text ?? "",
        appBaseUrl: config.appBaseUrl,
        metadata: {
          entryPoint: "command",
          teamId: payload.team_id,
          channelId: payload.channel_id,
          channelName: payload.channel_name,
          userId: payload.user_id,
          invokedAt: new Date().toISOString(),
          eventId: slackIdempotencyKey(payload),
        },
      }),
    })
    return
  }

  if (payload.type === "message_action" && payload.callback_id === "save_as_decision") {
    await openCapture(config, repository, services, payload)
    return
  }

  if (payload.type === "view_submission" && payload.view?.callback_id === "decision_memory_save") {
    const metadata = JSON.parse(payload.view.private_metadata || "{}")
    const values = payload.view.state?.values ?? {}
    const draft = metadata.draftId
      ? await repository.getSlackCaptureDraft(identityForSlack(config, payload), metadata.draftId)
      : null
    if (metadata.draftId && !draft) throw new Error("Slack capture draft is missing or expired")
    const source = draft
      ? {
          provider: draft.source.provider,
          externalChannelId: draft.source.externalChannelId,
          channelName: draft.source.channelName ?? null,
          externalThreadId: draft.source.externalThreadId,
          anchorExternalId: draft.source.anchorExternalId,
          anchorText: draft.source.anchorText,
          permalink: draft.source.permalink,
          capturedAt: draft.source.capturedAt,
          messages: draft.source.messages,
          sourceContext: {
            entryPoint: "shortcut",
            invokingUserId: draft.slackUserId,
            teamId: draft.slackTeamId,
            totalMessageCount: draft.source.totalMessageCount,
            capturedMessageCount: draft.source.capturedMessageCount,
            captureTruncated: draft.source.captureTruncated,
            captureStatus: draft.source.captureStatus,
            textTruncated: draft.source.textTruncated,
            ...(draft.source.aiDraft && !metadata.skipAi ? { aiDraft: draft.source.aiDraft } : {}),
          },
        }
      : {
          provider: "SLACK",
          externalChannelId: metadata.channelId,
          channelName: metadata.channelName ?? null,
          capturedAt: metadata.invokedAt,
          messages: [],
          sourceContext: {
            entryPoint: "command",
            invokingUserId: metadata.userId,
            teamId: metadata.teamId,
          },
        }
    const decision = await repository.createDecision(
      identityForSlack(config, payload),
      decisionInput.parse(submissionInput(values)),
      { idempotencyKey: draft?.externalEventId ?? metadata.eventId, source },
    )
    const replacedNote = await replaceEarlierDecision(repository, identityForSlack(config, payload), decision, metadata, values)
    const channelId = draft?.source.channelId ?? metadata.channelId
    const userId = draft?.slackUserId ?? metadata.userId ?? payload.user?.id
    if (channelId && userId) {
      void slackApi(config, "chat.postEphemeral", {
        channel: channelId,
        user: userId,
        text: `Saved ${decision.decisionKey}: ${config.appBaseUrl}/#/decisions/${decision.id}`,
      }).catch((error) => {
        console.error("Slack confirmation failed", error.message)
      })
    }
    await slackApi(config, "views.update", {
      view_id: payload.view.id,
      view: progressModal("Decision saved", `Saved ${decision.decisionKey}.${replacedNote} <${config.appBaseUrl}/#/decisions/${decision.id}|Open Decision Memory>`, true),
    })
    return decision
  }
}

export function createSlackRouter(config, repository, services) {
  const router = express.Router()
  const handleProposal = createSlackProposalHandler({ config, proposalReview: services.proposalReview, slackApi, identityForSlack, plainSlackText })
  router.post(
    "/interactions",
    express.raw({ type: "application/x-www-form-urlencoded", limit: "1mb" }),
    async (req, res) => {
      if (!config.slackSigningSecret || !config.slackBotToken || !config.slackTeamId) {
        res.status(503).send("Slack is not configured")
        return
      }
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : ""
      const valid = verifySlackSignature({
        rawBody,
        timestamp: req.get("x-slack-request-timestamp"),
        signature: req.get("x-slack-signature"),
        secret: config.slackSigningSecret,
      })
      if (!valid) {
        res.status(401).send("Invalid Slack signature")
        return
      }
      let payload
      try {
        payload = parseInteraction(rawBody)
      } catch {
        res.status(400).send("Invalid Slack payload")
        return
      }
      const teamId = payload.team?.id ?? payload.team_id
      if (teamId !== config.slackTeamId) {
        res.status(403).send("Slack workspace is not configured")
        return
      }
      if (payload.callback_id === "check_proposed_decision" || payload.view?.callback_id === "decision_memory_review") {
        res.status(200).send("")
        void handleProposal(payload).catch(() => { console.error("Slack proposal review could not update its private view.") })
        return
      }
      if (payload.type === "view_submission") {
        if (payload.view?.callback_id !== "decision_memory_save") {
          res.status(400).send("Unknown submission")
          return
        }
        const reason = replacementReasonInput.safeParse(valueAt(payload.view.state?.values, "replacementReason"))
        if (!reason.success) {
          res.json({ response_action: "errors", errors: { replacementReason: reason.error.issues[0].message } })
          return
        }
        const parsed = decisionInput.safeParse(submissionInput(payload.view.state?.values))
        if (!parsed.success) {
          const fields = { references: "relatedUrl", ownerName: "owner" }
          const errors = {}
          for (const issue of parsed.error.issues) {
            const field = fields[issue.path[0]] ?? issue.path[0]
            errors[field] ??= issue.message
          }
          res.json({ response_action: "errors", errors })
          return
        }
        res.json({ response_action: "update", view: progressModal("Saving Decision…", "Your Decision is being saved. This window will update with the result.") })
        void handleSlackPayload(config, repository, services, payload).catch(async () => {
          // Keep the original values and idempotency key for a safe retry, even
          // when persistence succeeded but delivery of the success view failed.
          try {
            const metadata = JSON.parse(payload.view.private_metadata || "{}")
            const values = payload.view.state?.values ?? {}
            await slackApi(config, "views.update", {
              view_id: payload.view.id,
              view: captureModal({
                title: valueAt(values, "title"), values, metadata, appBaseUrl: config.appBaseUrl,
                error: "Save could not be confirmed. Your entries are preserved. Retry Save; it will not create a duplicate.",
              }),
            })
          } catch {
            console.error("Slack save result could not be delivered; retry the original submission.")
          }
        })
        return
      }

      res.status(200).send("")
      void handleSlackPayload(config, repository, services, payload).catch((error) => {
        console.error("Slack interaction failed", error.message)
      })
    },
  )

  // Slack Events API: new messages in channels the bot is in (for nudges).
  router.post(
    "/events",
    express.raw({ type: "application/json", limit: "1mb" }),
    (req, res) => {
      if (!config.slackSigningSecret || !config.slackBotToken || !config.slackTeamId) {
        res.status(503).send("Slack is not configured")
        return
      }
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : ""
      const valid = verifySlackSignature({
        rawBody,
        timestamp: req.get("x-slack-request-timestamp"),
        signature: req.get("x-slack-signature"),
        secret: config.slackSigningSecret,
      })
      if (!valid) {
        res.status(401).send("Invalid Slack signature")
        return
      }
      let body
      try {
        body = JSON.parse(rawBody)
      } catch {
        res.status(400).send("Invalid Slack payload")
        return
      }
      if (body.type === "url_verification") {
        res.json({ challenge: String(body.challenge ?? "") })
        return
      }
      if (body.team_id !== config.slackTeamId) {
        res.status(403).send("Slack workspace is not configured")
        return
      }
      // Slack expects an answer within three seconds, so work continues afterwards.
      res.status(200).send("")
      // A retry means the first delivery already arrived; nudges are best effort.
      if (req.get("x-slack-retry-num")) return
      void handleSlackEvent(config, repository, services, body).catch((error) => {
        console.error("Slack nudge failed", error.message)
      })
    },
  )
  return router
}
