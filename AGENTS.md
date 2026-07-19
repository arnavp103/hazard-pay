# AGENTS.md

## Commands

Run from the repo root; turbo fans out to every workspace package.

| Command | What it does |
| --- | --- |
| `pnpm install` | Install. pnpm only — `preinstall` rejects npm and yarn. |
| `pnpm lint` | ESLint, zero warnings tolerated. |
| `pnpm lint:fix` | ESLint with `--fix`. |
| `pnpm type-check` | `tsc --noEmit` per package. |
| `pnpm test` | Tests per package. |
| `pnpm syncpack:lint` | Check dependency version drift across packages. |
| `pnpm syncpack:fix` | Fix that drift. |

Run a single package with `pnpm --filter @hazard-pay/<name> <script>`.

The CLI runs from source: `./apps/cli/bin/hazard-pay --help`.

## Layout

```
apps/cli          @hazard-pay/cli     cac-based CLI, entry src/index.ts
packages/config   @hazard-pay/config  shared ESLint + tsconfig
packages/env      @hazard-pay/env     t3-env schema, default export
```

Packages export raw TypeScript from `src/` and run through `tsx`. There is no
build step, so there is no build output to keep in sync.

## Conventions

- **No Prettier.** `@stylistic/eslint-plugin` owns formatting via the shared
  ESLint config: two-space indent, double quotes, semicolons, 1tbs braces.
  ESLint is the only tool permitted to rewrite a file.
- **No root `tsconfig.json`.** The base lives in `packages/config/tsconfig.json`
  and packages extend it by package specifier, not relative path.
- **Internal deps use `workspace:*`**, enforced by syncpack.
- **Intra-package imports carry the `.ts` extension** so they resolve the same
  under `tsx` and `tsc`.
- **Env vars are optional at boot.** Everything in `packages/env` carries a
  default, so lint, test, and type-check run with no `.env` present. A variable
  that cannot be defaulted is boot-required by deliberate choice.

## Commits

Conventional commits with a **mandatory scope**: `type(scope): subject`.

Valid scopes are read from the directory names under `apps/` and `packages/` at
commitlint load time, plus `repo`, `ci`, `deps`, and `infra`. Adding a package
adds its scope automatically — do not edit `commitlint.config.js` for that.

```
feat(cli): add status command
chore(repo): bump turbo
```

The `commit-msg` hook runs commitlint in strict mode and will reject anything
non-conforming. `pre-commit` runs `syncpack fix` then `lint-staged`.

## Adding a package

1. `apps/<name>/` or `packages/<name>/` with `package.json`, `tsconfig.json`,
   `eslint.config.js`.
2. `eslint.config.js` re-exports one of `@hazard-pay/config/eslint`,
   `/eslint-node`, or `/eslint-tailwind`.
3. `tsconfig.json` extends `@hazard-pay/config/tsconfig.json`.
4. Scripts: `type-check`, `lint`, `lint:fix`, `clean` at minimum.
5. `pnpm install` to link it.
