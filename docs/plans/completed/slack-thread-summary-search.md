# Execution Plan: Explicit Slack thread summary search

Date: 2026-10-18

## Status

Completed

## Outcome

An optional **Summarize thread & search** action rewrites an incomplete Slack
question with relevant thread context, then searches locally at the accepted
90/100 cutoff. Default local search and earlier form simplifications remain.

## Context And Authority

- Owner explicitly approved this Gemini action and its bounded thread transfer
  in this chat on 2026-10-18.
- `docs/product/slack-capture.md` owns Slack interaction deadlines, thread bounds,
  private results and the current 60/90 relevance rules.
- `docs/product/memory-search.md` owns local retrieval and explicit Gemini use.
- Existing AI capture bounds are 60 messages and 1,500 characters per message.

## Approach

1. Add a bounded, validated query rewriter using the configured Gemini model.
2. Expose it only behind a disclosed Slack button; preserve original results on
   failure and show the question actually searched on success.
3. Prove explicit invocation, thread scope, failure recovery and strict filtering.
4. Evaluate synthetic versions of the reported examples with Gemini and the real
   local database/model. Retain the feature only if this adds useful precision.

## Risks And Recovery

- AI can omit or invent context: constrain it to source message IDs, display its
  question and retain the local workflow. This is not a relevance guarantee.
- Bound calls using the existing eight-second provider timeout pattern; use
  Slack view hashes to avoid duplicate requests or overwriting a newer view.
- No decision/draft writes, Slack posts, new model or dependency. Recover by
  removing the optional action/service without resetting any user changes.

## Progress

- [x] Compared local concatenation and focused queries; concatenation regresses
  precision or fails the strict cutoff for the Vietnamese example.
- [x] Owner approved explicit Gemini action rather than automatic transfer.
- [x] Implement and validate the action and service.
- [x] Evaluate live synthetic examples and record limitations.
- [x] Update product truth and complete the plan after validation.

## Validation

- `npm test`: 135/135 passed, including explicit invocation, strict filtering,
  bounded/validated summaries, timeout, restoration, disabled configuration,
  wrong-user rejection and stale-view suppression.
- `npm run lint --workspace server` and `git diff --check`: passed.
- Live configured Gemini plus real local model/database, synthetic excerpts:
  [V1](../../presentation/evidence/slack-thread-summary-v1.json) was 4/5 exact;
  [V2](../../presentation/evidence/slack-thread-summary-v2.json) was 4/7 exact.
  Same-language output sometimes omitted scope or scored below the accepted 90
  cutoff despite finding the right record. These failed runs are retained.
- [V3](../../presentation/evidence/slack-thread-summary-v3.json) normalizes the
  search question to English while preserving original proper names. Exact
  displayed result sets improved from 3/7 for the baseline to 6/7; the correct
  record ranked first in all six answerable examples. The insufficient-context
  case abstained. The final summarizer SHA-256 matches the evaluated source.
- The reported Vietnamese migration case changed from four displayed records to
  only DM-111. A Vietnamese backup-comparison case still displayed DM-104 plus
  the irrelevant DM-111, whose retrieval score was 92. The V3 evaluation exits
  nonzero for that extra result; it is not a perfect pass or a relevance guarantee.
- This is a small development evaluation against the existing synthetic local
  demo database, not an independent benchmark or live installed Slack rehearsal.
  Slack delivery was checked with signed HTTP fixtures and mocked outbound calls.

## Decisions

- 2026-10-18: Keep the feature explicit and optional: measured precision improved,
  default local behavior is preserved and failures retain the previous results.
- 2026-10-18: Preserve the owner's 90/100 cutoff. Record the remaining false
  match rather than changing the threshold or hiding all but the top record to
  make the evaluation appear perfect.

## Result

Implemented the disclosed **Summarize thread & search** button near the top of
Ask results, a separate bounded Gemini query-rewrite service and local retrieval.
The rewritten English question and original selection are visible. The action
does not write decisions/drafts or post to Slack. Original search remains
available by reopening Ask, and failures restore its previous results.

Known risk: even a score above 90 can be irrelevant; the AI rewrite and local
retrieval remain approximate. Earlier failures and the remaining V3 false match
are preserved in the evaluation reports. No new dependency, model, app-manifest,
database schema, tunnel or credential change was required.
