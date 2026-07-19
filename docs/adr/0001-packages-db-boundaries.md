# ADR 0001: packages/db boundaries, dev Postgres, and test strategy

- **Status**: accepted
- **Date**: 2026-07-19
- **Decided in**: [hazard-pay#8](https://github.com/arnavp103/hazard-pay/issues/8) (wayfinder map [#1](https://github.com/arnavp103/hazard-pay/issues/1)) — full discussion and rationale live on the ticket.

## Context

The walking skeleton needs a home for database concerns (Postgres + Drizzle), a way to run Postgres in dev, and a test strategy — before `packages/db`, `apps/api`, and CI are scaffolded.

## Decision

1. **`packages/db` is a thin library**: Drizzle table definitions (game tables, better-auth tables + separate `player` table, later the agent event log and job/checkpoint tables), migrations, a `createDb` client factory, and test helpers. **Queries live with their owners** — `apps/api` keeps its queries and transaction boundaries in `src/db/**`, enforced by a scoped `@typescript-eslint/no-restricted-imports` override (runtime imports of `@hazard-pay/db` only from `src/db/**`; `allowTypeImports: true`). `apps/admin` (dev-only) may import the client directly; its breakage from schema churn is accepted by policy.
2. **Dev infra is a single root `docker-compose.yml`** — pinned Postgres, named volume, port from `packages/env` defaults. No `packages/docker`. The compose file is the single source of truth for Postgres version and extensions.
3. **Tests use the shared instance + template databases** — tests connect to `DATABASE_URL` (compose locally, service container in CI); a globalSetup migrates a template database once, and each vitest worker clones it (`CREATE DATABASE … TEMPLATE …`) and drops it after. No testcontainers; no PGlite for anything touching queue/tick code. A cold `pnpm test` without Postgres must fail with a message naming the fix (`docker compose up -d`).

## Consequences

- Adding an api feature never requires touching `packages/db` unless the schema changes.
- Shared query helpers move into `packages/db` only when duplication is real, not predicted.
- Product analytics is not a db concern (no analytics tables in the game schema); its future seam is `packages/observability`'s emission API.
- Escape hatch if multi-worktree test contention appears: per-worktree compose project names, or testcontainers — neither changes the package design.
