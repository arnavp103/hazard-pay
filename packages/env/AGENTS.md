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
