# @hazard-pay/config

Shared ESLint + TypeScript presets. Consumed by package specifier
(`@hazard-pay/config/eslint`, `/eslint-node`, `/eslint-tailwind`,
`/tsconfig.json`) — never by relative path.

## Exports

- `./eslint` — base flat config: `@stylistic` formatting (two-space indent,
  double quotes, semicolons, 1tbs braces) + typescript-eslint.
- `./eslint-node` — base plus Node globals; for CLIs and servers.
- `./eslint-tailwind` — base plus better-tailwindcss; for UI packages.
- `./tsconfig.json` — strict base tsconfig every package extends.

## Rules

- Formatting decisions live here and only here — no Prettier anywhere in
  the repo.
- A preset change changes every package: run root `pnpm lint` and
  `pnpm type-check` before considering it done.
- New presets are new export entries in `package.json`, kept as thin
  extensions of the base config.
