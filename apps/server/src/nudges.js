// Cheap phrase checks that decide whether a Slack message deserves a nudge.
// They run on every message in channels the bot is in, so they never call AI;
// only a message that passes goes any further.

// Slack clients often send curly apostrophes ("let’s"), so they are straightened.
const normalize = (text = "") =>
  text.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim()

const anyOf = (phrases) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${phrases.join("|")})(?=$|[^\\p{L}\\p{N}])`, "u")
const startsWithAnyOf = (phrases) => new RegExp(`^(?:${phrases.join("|")})(?=$|[^\\p{L}\\p{N}])`, "u")

const QUESTION_PHRASES = [
  "why", "should we", "shall we", "do we", "did we", "are we", "were we", "can we",
  "could we", "what did we", "what do we", "what's our", "what is our", "which",
  "how do we", "how did we", "is it ok to", "any reason", "remind me",
  "tại sao", "vì sao", "sao mình", "sao team", "có nên", "nên dùng", "nên chọn",
  "mình có", "team có", "hồi trước", "trước đây", "đã chốt", "chốt chưa",
  "dùng gì", "chọn gì", "như thế nào", "thế nào", "ra sao",
]
const questionAnywhere = anyOf(QUESTION_PHRASES)
const questionAtStart = startsWithAnyOf(QUESTION_PHRASES)

// A question about something the team may already have decided: it either
// opens with a question phrase, or contains one and a question mark.
export function looksLikeQuestion(text) {
  const value = normalize(text)
  if (value.length < 15 || value.length > 500) return false
  return questionAtStart.test(value) || (value.includes("?") && questionAnywhere.test(value))
}

const DECISION_PHRASES = [
  "let's go with", "lets go with", "let's use", "we'll go with", "we will go with",
  "going with", "agreed", "decided", "decision:", "final decision", "we'll use",
  "we will use", "settled on",
  "chốt", "thống nhất", "quyết định", "đồng ý", "vậy làm", "làm theo",
]
const decisionPhrase = anyOf(DECISION_PHRASES)
const NEGATION = anyOf([
  "not", "no", "never", "haven't", "hasn't", "didn't", "isn't", "not yet",
  "chưa", "không", "ko",
].map((word) => `${word} (?:yet )?(?:${DECISION_PHRASES.join("|")})`))

// A thread reply that sounds like the team settled something. Questions and
// negations ("not agreed", "chưa chốt") do not count.
export function looksLikeDecision(text) {
  const value = normalize(text)
  if (value.length < 5 || value.length > 1_000 || value.includes("?")) return false
  return decisionPhrase.test(value) && !NEGATION.test(value)
}
