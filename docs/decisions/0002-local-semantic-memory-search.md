# Local semantic memory search

Date: 2026-10-12

Status: Accepted by the product owner in this chat.

Amended on 2026-10-13 by [dual memory search](0003-dual-memory-search.md): retain
this local path and restore Gemini as an explicit optional web action.

## Decision

Replace external Gemini ranking for Search by memory with locally computed
multilingual embeddings and PostgreSQL/pgvector. Preserve the stored decision
and evidence as truth. Provide repeatable one-command local setup/startup and
require no paid services for the search feature.

## Reason

Sending decision cards to an external AI provider raises privacy concerns, and
the newest-200 candidate window misses older relevant choices. Cached embedding
inference avoids external search-content transfer; a vector index retrieves
from the workspace corpus without putting all decisions in an LLM prompt.

## Consequences

- The first setup needs internet; search inference works offline afterward.
- CPU, disk and RAM remain real resource requirements. Free cloud hosting and
  million-record performance are not established by local functionality.
- Derived embeddings need durable invalidation/backfill and deletion handling.
- Optional Gemini capture drafting remains separate from the search feature.
- The original MVP embedding deferral is superseded for this accepted scope.

Behavior and operation: [Local memory search](../product/memory-search.md).
