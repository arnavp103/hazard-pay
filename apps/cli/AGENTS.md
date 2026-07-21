# @hazard-pay/cli

cac-based dev CLI. Runs from source, no build: `./apps/cli/bin/hazard-pay`
(the bin is a thin `tsx` launcher for `src/index.ts`).

## Structure

- `bin/hazard-pay` — executable entry; keep it a launcher, no logic.
- `src/index.ts` — cac program: command registration and dispatch.

## Conventions

- Register new commands in `src/index.ts`; move a command's implementation
  into its own `src/<command>.ts` module once it outgrows a few lines.
- Read configuration through `@hazard-pay/env` (default export) — never
  `process.env` directly.
- This is a dev tool: it may assume a repo checkout and local dev services,
  and should fail fast with a clear message when they're missing.
