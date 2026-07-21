# @hazard-pay/api

The Fastify backend (ADR 0002). One dev process boots both halves of a
pre-cut seam: `server.ts` (HTTP) and `worker.ts` (pg-boss). Splitting them
later is a second entrypoint, not a refactor.

## Run it

```bash
pnpm db:up                                   # dev Postgres on 5433
pnpm --filter @hazard-pay/db db:migrate      # once per schema change
pnpm --filter @hazard-pay/api dev            # tsx watch, port 3000 (PORT)
```

`dev` loads `src/telemetry.ts` via `--import` **before** the app graph — the
only file that may touch `@hazard-pay/observability/init`. Telemetry lands in
`var/telemetry/{api,webapp}*.jsonl` (see packages/observability/README.md for
the schema and canonical queries).

## The shape of every feature (ADR 0002)

**Functional core, imperative shell.** Domain functions live in `src/domain/`,
are plain functions taking a narrowed ctx first — `fn(ctx, args)` with
`Pick<AppCtx, ...>` — and return `ResultAsync<T, ApiError>` (Neverthrow,
tagged-union errors in `src/domain/errors.ts`). Nothing below an adapter
throws; a throw is a defect and lands in `setErrorHandler` (a net, never a
control path). No classes, no DI container.

Two edge adapters own ALL translation out of Result-land:

- `src/adapters/respond.ts` — Result → HTTP. The **single mapping table**
  from error tags to status codes; logs through the request's pino child.
  Adding an error variant without a table row is a type error.
- `src/adapters/job-handler.ts` — Result → throw, so pg-boss retry/DLQ works.
  Derives the per-job child logger.

Adding an endpoint = a contract entry (`src/contract/`), a domain function,
and one `os.<proc>.handler(...)` line in `server.ts`. Adding a job = a domain
function and one `boss.work(queue, jobHandler(...))` line in `worker.ts`.

## AppCtx

`AppCtx = { db, logger, boss, env }`, assembled exactly once in
`src/context.ts` at boot. Tests hand-roll a ctx (template-clone db, silent
logger) — nothing is mocked. The server half sees `Pick<AppCtx, "db" |
"logger" | "env">`; `boss` belongs to the worker half.

## The db import fence (ADR 0001)

Runtime imports of `@hazard-pay/db` are legal **only under `src/db/**`** —
enforced by a scoped `no-restricted-imports` override in `eslint.config.js`
(`import type` is fine anywhere). Queries and transaction boundaries live in
`src/db/`, exported as plain helpers; everything else touches the database
through `ctx.db` handed to those helpers. A helper moves to `packages/db`
only when another app really duplicates it.

## Contract seam (typed clients, no codegen)

`src/contract/` is the single source of truth for route shapes: zod schemas
via **oRPC** (`@orpc/contract`), chosen over ts-rest at scaffold time on
maintenance state (ts-rest stale since 2025-06; rationale in the file).
`server.ts` implements it with `implement(contract)` and serves it through
`OpenAPIHandler` (`@orpc/openapi/fastify`), so procedures are real REST paths
(`GET /health` is curl-able). Consumers import `@hazard-pay/api/contract`
(the package's only export) and get typed clients/TanStack Query hooks via
`@orpc/openapi-client` + `@orpc/tanstack-query` — pure type inference,
nothing generated. Do not export runtime modules to other packages; the
contract subpath is types + zod only.

## Logging (ADR 0002 §6, ADR 0005)

`createLogger("api")` at boot is the only pino constructed here, and it IS
Fastify's logger. Children are derived only at the edges: per-request in
`buildServer`'s `onRequest` hook (W3C `traceparent` honored, ids generated
otherwise), per-job in `jobHandler`. Domain code sees `ctx.logger` and never
binds its own trace fields. With the bootstrap loaded, instrumentation also
stamps span-accurate `trace_id`/`span_id` on every line.

## Routes outside the contract

- `GET /ticks/stream` (`src/routes/tick-stream.ts`) — the match-tier SSE
  transport, hello-world edition (ADR 0004 §2, §5). Frames are re-queries of
  the tick table after the connection's cursor; the shared LISTEN connection
  (`src/db/listen.ts`, one per server process, owned by `buildServer`) and a
  60s safety re-poll decide when to look; `Last-Event-ID` resumes. The
  `data:` envelope is `tickStreamEnvelopeSchema` from the contract — tick
  snapshot plus the ticking span's `traceparent` (ADR 0005 §6). Swapping to
  WebSocket later replaces this module and the webapp's `useTickStream`
  hook, nothing else. Like the other non-contract routes, the stream module
  IS its own edge: it consumes Results inline (log-and-keep-streaming has no
  meaningful HTTP translation), which is the sanctioned exception to
  "adapters own all translation".
- `POST /telemetry` (`src/routes/telemetry.ts`) — dev-only browser-telemetry
  ingest (ADR 0005 §6): `{ service, lines }`, `signal: "log" | "span"` per
  line. Not registered when `NODE_ENV === "production"` (the browser client
  treats 404 as a permanent disable). Lines are **re-redacted server-side**
  via `ingestTelemetryLines` from the observability package — client buffers
  are untrusted input.
- `/api/auth/*` (`src/routes/auth.ts`) — better-auth mounted from
  `@hazard-pay/auth`'s `createAuth(db, { baseURL: env.API_BASE_URL })`,
  translated fetch-Request ↔ Fastify. The dev-stub anonymous login is
  better-auth's own `POST /api/auth/sign-in/anonymous`; the player row
  appears via the package's database hooks. Keep auth out of the oRPC
  contract — better-auth owns its route surface and client.

## The tick (ADR 0004 §4)

`worker.ts` schedules a pg-boss cron on the `tick` queue from
`TICK_INTERVAL` (packages/env, 5m default) plus one eager catch-up send at
boot. The writer (`src/db/ticks.ts`) backfills every due tick number in ONE
transaction — idempotent on `tick_number`, so re-fires are no-ops — and the
transaction's `NOTIFY tick_recorded` (payload-less, delivered post-commit)
nudges the stream. Traced as `tick.run`, emits `tick.completed`. Cron is
only the metronome: cadence correctness lives in the backfill arithmetic,
never in cron resolution.

## What lands where next (don't repaint these seams)

- Match-phase delayed singletons (ADR 0004 §3): `worker.ts` registrations
  using `jobHandler`; match events fan out through the same
  LISTEN/SSE/table-cursor machinery the tick stream demonstrates.
- Worker isolation: new entrypoint calling `startWorker` only.

## Tests

`pnpm --filter @hazard-pay/api test` needs the dev Postgres (`pnpm db:up`).
Integration tests boot the real server on an ephemeral port against a
template-cloned database and use real `fetch` — health (round-trip and 503
mapping), telemetry ingest (asserts a secret-shaped key is stripped), and
the better-auth anonymous sign-in round-trip. The OTel bootstrap is never
loaded in tests.
