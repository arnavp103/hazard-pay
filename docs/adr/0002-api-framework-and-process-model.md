# ADR 0002: apps/api framework and process model

- **Status**: accepted
- **Date**: 2026-07-19
- **Decided in**: [hazard-pay#7](https://github.com/arnavp103/hazard-pay/issues/7) (wayfinder map [#1](https://github.com/arnavp103/hazard-pay/issues/1)) — full discussion and rationale live on the ticket.

## Context

`apps/api` needs an HTTP framework, a process topology for the pg-boss tick
loop (ADR 0001 put the queue and game state in the same Postgres), and concrete
patterns for the house style: Neverthrow throughout, functional services with
no classes, observability first-class (pino JSONL per the agent-readable
observability research).

## Decision

1. **Fastify.** Its logger *is* pino, so `packages/observability` hands it a
   configured instance and framework, domain, and worker logs share one
   redacted JSONL stream. Node-first fits the `tsx` no-build setup, and the
   first-party WebSocket plugin keeps the match-transport decision (#9) open.
2. **Type-safe clients are contract-first with no codegen.** Route contracts
   are defined once in zod; the server implements the contract and
   `apps/webapp`/`apps/admin` get typed TanStack Query hooks by type inference
   alone. No OpenAPI client generation — no generated files in a no-build
   repo. The library (ts-rest vs oRPC) is verified against maintenance state
   when the scaffold ticket (#15) wires it; the pattern is what is locked.
3. **One process in dev, seam pre-cut.** `apps/api` is two composable modules
   — `server.ts` (Fastify) and `worker.ts` (pg-boss registrations + tick
   scheduling) — booted together by the default entrypoint and sharing only
   the db and observability handles. Splitting into two processes later is a
   second entrypoint, not a refactor.
4. **Functional core, imperative shell.** Domain functions return
   `ResultAsync<T, E>` with tagged-union error types; nothing below an adapter
   throws — a thrown exception is a defect. Two edge adapters own all
   translation: `respond` (Result → HTTP status/body via a single mapping
   table, logging through the request's pino child) and `jobHandler` (Result →
   throw, preserving pg-boss retry/DLQ semantics). Fastify's `setErrorHandler`
   is a defect net, never a control path.
5. **Services are plain functions taking `ctx` first**: `fn(ctx, args)` with
   `AppCtx = { db, logger, boss, env }` assembled once at boot; features
   narrow with `Pick`. No DI container, no factory-closure service objects.
   Only feature modules touch `ctx.db` (ADR 0001's import fence); adapters
   only call domain functions.
6. **Logging: root at boot, children at the edges.** `createLogger` in
   `packages/observability` is the only constructor of pino instances and owns
   secrets redaction (#22). Route and job adapters are the only code deriving
   scoped child loggers (request/job ids + W3C traceparent bindings); domain
   code only ever sees `ctx.logger`.

## Consequences

- Adding an endpoint or job is: domain function returning `ResultAsync`, plus
  one adapter line. Status-code mapping and retry semantics stay in one file
  each.
- Every dependency of a function is visible in its signature; tests build a
  hand-rolled ctx (template-clone test db, silent logger) with nothing mocked.
- Type changes flow source-to-source across the workspace (contract → client
  hooks, Drizzle inference → domain code) with no build or codegen step.
- If tick load or long-lived agent runs demand isolation, #9/#11 split
  `worker.ts` behind its own entrypoint without touching domain code.
