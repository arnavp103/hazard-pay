# AGENTS.md

Hazard Pay — a pnpm + Turborepo monorepo for an online multiplayer
auto-battler with offline progression. `apps/` holds deployable surfaces;
`packages/` holds shared libraries consumed across apps.

## Setup

- Install: `pnpm install` (pnpm is required — `preinstall` rejects npm and yarn)
- Node: >= 22 (see `engines` in the root `package.json`)

## Commands (run from repo root)

- Typecheck: `pnpm type-check`  ← run this before considering work done
- Lint: `pnpm lint` (zero warnings tolerated) / autofix: `pnpm lint:fix`
- Test all: `pnpm test`
- One package: `pnpm --filter @hazard-pay/<name> <script>`
- Dev (all apps): `pnpm dev`
- Dependency version drift: `pnpm syncpack:lint` / `pnpm syncpack:fix`

Turborepo caches these — prefer the root scripts over `cd`-ing into a
package, so the dependency graph is respected. Packages export raw
TypeScript from `src/` and run through `tsx`; there is no build step.

## Layout

- `apps/cli` — cac-based dev CLI (`./apps/cli/bin/hazard-pay --help`)
- `packages/config` — shared ESLint + tsconfig presets
- `packages/env` — t3-env schema, default export

Each package has its own AGENTS.md documenting that module's specific
conventions — **read the nearest AGENTS.md before editing**. Per-package
AGENTS.md files must stay under 200 lines.

## Conventions

- **No Prettier.** `@stylistic/eslint-plugin` owns formatting via the shared
  ESLint config. Run `pnpm lint:fix` rather than hand-formatting; ESLint is
  the only tool permitted to rewrite a file.
- **No root `tsconfig.json`.** Packages extend
  `@hazard-pay/config/tsconfig.json` by package specifier, not relative path.
- Internal deps use `workspace:*` (enforced by syncpack). Cross-package
  imports use the `@hazard-pay/*` package name — never a relative path that
  crosses a package boundary.
- Intra-package imports carry the `.ts` extension so they resolve the same
  under `tsx` and `tsc`.
- Cross-package changes: update the owning package first, then consumers.

## Commits

Conventional commits with a **mandatory scope**: `type(scope): subject`
(e.g. `feat(cli): add status command`). Valid scopes are the directory names
under `apps/` and `packages/` plus `repo`, `ci`, `deps`, and `infra`, read at
commitlint load time — adding a package adds its scope automatically.
The `commit-msg` hook runs commitlint in strict mode; `pre-commit` runs
`syncpack fix` then `lint-staged`.

## Adding a package

1. `apps/<name>/` or `packages/<name>/` with `package.json`, `tsconfig.json`,
   `eslint.config.js` (re-exporting a `@hazard-pay/config` preset), and an
   `AGENTS.md`.
2. Scripts: `type-check`, `lint`, `lint:fix`, `clean` at minimum.
3. `pnpm install` to link it.

## Boundaries — do not touch without being asked

- `pnpm-lock.yaml`, `.env*`
- CI config under `.github/`

## Verifying a change

Before declaring done: `pnpm type-check && pnpm lint && pnpm test` must pass.

## Agent skills

- **Issue tracker**: GitHub Issues for `arnavp103/hazard-pay` via the `gh`
  CLI. See `docs/agents/issue-tracker.md`.
- **Triage labels**: default vocabulary (`needs-triage`, `needs-info`,
  `ready-for-agent`, `ready-for-human`, `wontfix`). See
  `docs/agents/triage-labels.md`.
- **Domain docs**: `CONTEXT.md` at the repo root plus `docs/adr/`. See
  `docs/agents/domain.md`.
