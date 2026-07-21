# @hazard-pay/db

Drizzle schema, migrations, `createDb` client factory, and test helpers for
Postgres. Thin by design (ADR 0001): **queries and transaction boundaries
live with their owners** — `apps/api` keeps its queries in `src/db/**`. A
query helper graduates into this package only when duplication is real, not
predicted.

## Exports

- `@hazard-pay/db` — table definitions (`tick`, better-auth tables, agent
  tables), `createDb(connectionString)` returning `{ db, close }`, and the
  `Db`/`DbHandle` types. Plain functions, no classes; callers own the pool
  lifecycle via `close()`.
- `@hazard-pay/db/testing` — `createTestDatabase()` and
  `ensureTemplateDatabase()` for template-clone tests.

## Agent tables (`src/agent-schema.ts`, ADR 0003)

- `lane` — one thread of a leader's context. `kind` is
  `foreground | mission`; one foreground lane per leader (partial unique
  index). `status` (`open | waking | closed`) + `woke_at` form the wake
  claim. `forked_from_lane_id`/`forked_from_seq` are the RESERVED forking
  seam — schema only, never written today.
- `lane_event` — the append-only lane event log, and the checkpoint layer
  (the log IS the resume state; replay folds it). Row shape:
  `(lane_id, seq, author, type, payload jsonb, occurred_at)` with
  `PRIMARY KEY (lane_id, seq)` as the optimistic append guard. `type` in
  (`input`, `model_turn`, `tool_result`, `compaction` — reserved).
  `payload` is a versioned envelope owned by `@hazard-pay/agent`; store
  functions and the fold live there, not here.
- `leader_config` — full config JSON stored once per content hash; lanes
  stamp `config_hash` for cross-model/cross-prompt trace comparison.

## Dev Postgres

- The root `docker-compose.yml` is the single source of truth for the
  Postgres major (currently `postgres:18`; keep `.github/workflows/ci.yml`
  on the same major). `pnpm db:up` / `pnpm db:down` from the repo root.
- The connection string is `DATABASE_URL` from `@hazard-pay/env`. Its
  default matches compose — **host port 5433** (chosen to dodge other local
  Postgres installs; inside the container it is still 5432) — so no `.env`
  is needed locally.
- CI provides its own service container and sets `DATABASE_URL` explicitly
  (port 5432 on the runner). Anything touching the database must read
  `DATABASE_URL`, never a hardcoded string.

## Migrations

- Edit `src/schema.ts`, then `pnpm --filter @hazard-pay/db db:generate` to
  emit SQL into `migrations/`. Commit the generated files; migrations are
  append-only and never edited after they land.
- `pnpm --filter @hazard-pay/db db:migrate` applies them to `DATABASE_URL`.
  Tests migrate their own template database — `db:migrate` is only for
  poking the dev database by hand.

## Tests (template cloning)

- vitest `globalSetup` migrates a `hazard_pay_template` database once per
  schema state: the migrations hash is stored as the database comment, so an
  unchanged schema skips migration entirely.
- `createTestDatabase()` clones the template
  (`CREATE DATABASE … TEMPLATE …`, ~50-200 ms) into a unique
  `hazard_pay_test_*` database and returns `{ db, connectionString, drop }`.
  Always call `drop()` in `finally`; a leaked database is a debuggable
  corpse, and `drop` uses `WITH (FORCE)` so corpses never block reruns.
- Tests hit whatever `DATABASE_URL` points at — compose locally, the CI
  service container in CI. No testcontainers, no PGlite.
- **The template database is shared, cross-worktree mutable state.** A test
  run in another worktree (on a different migration set) can rebuild
  `hazard_pay_template` under you mid-session. Any non-vitest consumer
  (smokes, scripts) must call `ensureTemplateDatabase()` immediately before
  each clone rather than assuming an earlier check still holds.
- With Postgres down, the suite fails loudly and names the fix
  (`docker compose up -d`).

## Boundaries

- No queue tables here — pg-boss lives inside `apps/api` (ADR 0003 §2).
  The lane event log is not a checkpoint table: per ADR 0003 §4 the log
  itself is the checkpoint layer, and no separate step-checkpoint tables
  may be added.
- Intra-package imports carry the `.ts` extension.
