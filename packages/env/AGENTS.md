# @hazard-pay/env

t3-env (zod) schema for environment variables. Default export; consumers do
`import env from "@hazard-pay/env"` and never read `process.env` directly.

## Rules

- **Every variable carries a default**, so lint, test, and type-check run
  with no `.env` present. A variable added without a default is boot-required
  by deliberate choice — say so in the PR.
- Add variables to the `server` block in `src/index.ts` with a zod schema;
  empty strings are treated as undefined.
- `SKIP_ENV_VALIDATION=1` is the escape hatch for container builds and CI
  steps that never read env.

## Root .env loader

`loadEnv()` (in `src/load-env.ts`, called before validation and re-exported)
loads `<checkout root>/.env` via Node's native `process.loadEnvFile`. The
checkout root is the parent of `git rev-parse --git-common-dir`, so linked
worktrees under `.claude/worktrees/` share the main checkout's `.env` with no
copying; without git it falls back to an upward search for
`pnpm-workspace.yaml`. Already-set `process.env` variables win over file
values (Node's semantics). Never log, print, or assert on real `.env` values —
tests use temp dirs with fake `.env` files only.
