# @hazard-pay/cli

cac-based dev CLI. Runs from source, no build: `./apps/cli/bin/hazard-pay`
(the bin is a thin `tsx` launcher for `src/index.ts`).

## Structure

- `bin/hazard-pay` — executable entry; keep it a launcher, no logic.
- `src/index.ts` — cac program: command registration and dispatch.
- `src/worktree.ts` — `worktree new <branch>` / `worktree clean` for the
  agent-worktree workflow. New worktrees go under `.worktrees/`; clean also
  sweeps the legacy `.claude/worktrees/`.
- `src/output.ts` — end-of-command summary/reminder helper; commands route
  their closing checklist through it so reminders can grow per-command.

## Conventions

- Register new commands in `src/index.ts`; move a command's implementation
  into its own `src/<command>.ts` module once it outgrows a few lines.
- cac matches only the first positional as the command name — model
  subcommands as a `<action>` positional (see `worktree`).
- Read configuration through `@hazard-pay/env` (default export) — never
  `process.env` directly. Never print secret env values; the `env` command
  redacts key-like variables.
- This is a dev tool: it may assume a repo checkout and local dev services,
  and should fail fast with a clear message when they're missing.
- Tests are `node:test` files run via `node --import tsx --test`
  (`pnpm --filter @hazard-pay/cli test`); keep them pure — no real
  worktrees or network.
