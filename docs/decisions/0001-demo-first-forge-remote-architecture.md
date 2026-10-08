# 0001 Demo-First Forge Remote Architecture

Date: 2026-10-06

## Status

Accepted

## Context

Decision Memory is a three-week Buildathon project whose MVP must demonstrate
reliable Slack capture, durable decision context, and retrieval inside Jira.
The repository begins without an application implementation. The nearby
`agile-test` project demonstrates React Custom UI, Forge Remote, Express,
PostgreSQL, and Sequelize, but also contains legacy Connect migration and
production infrastructure that this demo does not need.

## Decision

Build a local-first Jira Forge app with:

- one Jira global page implemented as React 18 Custom UI with Vite;
- a Forge Remote endpoint backed by one Express application;
- Forge Invocation Token validation and Jira identity instead of a separate
  application login;
- PostgreSQL 16 in Docker with Sequelize and one idempotent local schema;
- `installationId` and Jira cloud context as the workspace isolation boundary;
- a development-only synthetic Jira identity for standalone local UI work;
- one Slack workspace configured by bot token and signing secret for the demo;
- optional Gemini-assisted extraction that always requires human confirmation;
- environment-specific secrets represented by empty local placeholders and a
  documented `.env.example`;
- Tailwind and shadcn/ui components, styled for a restrained Jira-compatible
  product interface.

Notification audiences such as leader, PM, and user are deferred until their
events and delivery channel are specified.

## Alternatives Considered

1. Copy the `agile-test` Connect-on-Forge stack, including its Connect
   descriptor and installation association. Rejected because it is migration
   machinery for an existing Connect app rather than the smallest new Forge
   application.
2. Use Forge-hosted functions and Forge SQL without Express or PostgreSQL.
   Rejected because the accepted implementation direction explicitly requires
   an Express backend and asks to follow the reference project's active
   PostgreSQL/Sequelize pattern.
3. Add Redis, Redux Saga, deployment configuration, or a provider framework.
   Rejected because they do not help prove the MVP loop and increase demo risk.

## Consequences

Positive:

- The implementation remains small enough for a competitive demo.
- Jira provides identity and installation context without a second login flow.
- The backend and data model resemble the proven reference architecture while
  avoiding its legacy and production-only complexity.
- The application can run and be tested locally before deployment work exists.

Tradeoffs:

- A public HTTPS tunnel is still required when exercising the real Forge or
  Slack integrations locally.
- Single-workspace Slack configuration is suitable for the demo, not a
  marketplace-ready installation experience.
- The local synthetic identity must be mechanically limited to development.
- Deployment, data residency, notification delivery, and production recovery
  remain intentionally unspecified.

## Follow-Up

- Confirm the visual concept before frontend implementation.
- Define notification events and channels before adding notifications.
- Revisit Slack OAuth and production deployment only when explicitly requested.
