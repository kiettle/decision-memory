# Product Docs

This directory contains current consumer-product behavior derived from real
accepted intent. Harness deliberately ships no fake product domains.

When a user provides a product specification, derive smaller living documents
here instead of keeping one growing specification as the operating manual. Name
files after actual product domains, such as `overview.md`, `billing.md`,
`permissions.md`, or `api-conventions.md`.

## Current Product Contract

- [Proposal review](proposal-review.md): local proposal checking, explicit scoped
  Gemini assessment, exact citations, current replacements and private Slack review.

- [Decision deadlines](decision-deadlines.md): pending capture, recorded outcomes,
  optional deadlines, safe shortcut writes, and Flat/Kanban views.

- [Decision understanding](decision-understanding.md): replacement reasons,
  comparisons, and scope overviews.

- [Memory search](memory-search.md): local vector retrieval and optional Gemini
  ranking, filtered candidate limits, durable indexing, setup and recovery.

- [Slack Capture](slack-capture.md): message shortcut and `/decide` command
  behavior, shared confirmation, durable context, and safety boundaries.
- [Jira creation](jira-creation.md): retry identity, partial-success recovery, and
  ambiguous external outcomes.

## Update Rule

When behavior changes:

1. Update the affected product document when the expected behavior changed.
2. Update the active execution plan when complex work uses one.
3. Add a lasting decision only when future work must inherit a consequential
   product, architecture, data, security, compatibility, or validation choice.
4. Add or update executable proof that exercises the behavior.

Bounded changes do not require a parallel lifecycle record.
