# Offer local vector and optional Gemini memory search

Date: 2026-10-13

Status: Accepted by the owner in this chat.

## Decision

Keep local vector memory search and restore the former Gemini ranking as an
explicit additional web action. Apply all workspace/metadata filters before
sending the newest 200 matching compact decision cards to Gemini. Display the
chosen method, coverage and AI uncertainty. The owner accepts imperfect rankings
and omissions when many decisions match.

This amends decision 0002's replacement of Gemini and its prohibition on external
memory inference for the explicit Gemini action only. Local search and Slack
recall/nudges retain their offline behavior. Original stored decisions/evidence
remain authoritative; AI results cannot introduce new record IDs.

## Consequences

- Gemini needs credentials and network access, and sends query/candidate excerpts
  to Google after explicit selection. Narrow filters reduce that candidate input.
- The 200-decision cap is application policy for Gemini, not a pgvector limit or
  a claim about Gemini's platform limits. Local search has no newest-200 cap.
- Generated explanations and scores are approximate. Coverage and exclusions are
  visible; provider failures leave the other search actions available.

Contract and proof: [Memory search](../product/memory-search.md).
