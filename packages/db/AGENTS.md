# @hazard-pay/db

Drizzle schema, migrations, `createDb` client factory, and test helpers for
Postgres. Thin by design (ADR 0001): **queries and transaction boundaries
live with their owners** — `apps/api` keeps its queries in `src/db/**`. A
query helper graduates into this package only when duplication is real, not
predicted.

## Exports

- `@hazard-pay/db` — table definitions (`tick`), `createDb(connectionString)`
  returning `{ db, close }`, and the `Db`/`DbHandle` types. Plain functions,
  no classes; callers own the pool lifecycle via `close()`.
- `@hazard-pay/db/testing` — `createTestDatabase()` and
  `ensureTemplateDatabase()` for template-clone tests.

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
- With Postgres down, the suite fails loudly and names the fix
  (`docker compose up -d`).

## Boundaries

- No queue or checkpoint tables here — durable-execution work is future
  scope, not part of this scaffold.
- Intra-package imports carry the `.ts` extension.
