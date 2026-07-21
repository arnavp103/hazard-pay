# @hazard-pay/auth

`createAuth(db, options)` — a small seam around better-auth's dev-stub
config. Research on issue #6 locked the design: better-auth's anonymous
plugin + a separate `player` table 1:1 on `user.id` (schema lives in
`@hazard-pay/db`, not here — ADR 0001). This package owns only the
`betterAuth()` instance and the wiring between the two.

## Why this package exists

`apps/api` doesn't exist yet (#15 scaffolds it). ADR 0001 keeps queries out
of `packages/db` ("queries live with their owners"), and the betterAuth
instance is more than a query — it's a stateful, third-party-shaped
factory object, not a plain `ctx`-first domain function (ADR 0002's "no
factory-closure service objects" targets our own services; better-auth's
shape is not ours to change). A dedicated package gives both `apps/api` and
`apps/webapp` one place to import it from, without either owning it.

## Exports

- `createAuth(db: Db, options?: CreateAuthOptions): Auth` — the configured
  better-auth instance. `apps/api` will call this once at boot with its real
  `db` and `baseURL`, then mount `auth.handler` on a Fastify route (#15).
  Nothing here assumes a running server or a request/response cycle.
- `defaultHandle`, `createPlayerForUser`, `relinkPlayer` — the player-table
  wiring, exported standalone so they're unit-testable without going through
  a full sign-in flow. `createAuth` wires them into
  `databaseHooks.user.create.after` and the anonymous plugin's
  `onLinkAccount`.

## Design notes

- **No TanStack-specific plugins.** The research (docs/research on
  `research/better-auth-drizzle-tanstack`) covered mounting better-auth
  inside a TanStack Start route (`tanstackStartCookies`, a catch-all
  `$.ts` route). ADR 0002 puts `apps/api` on Fastify, not TanStack Start —
  that mounting glue belongs to whichever app hosts the handler, and is
  explicitly #15's job, not this package's.
- **Anonymous only.** No `emailAndPassword`, no OAuth providers — the
  dev-stub scope from the wayfinder map. Adding a real auth method later is
  additive config in `createAuth`'s `betterAuth()` call; the anonymous
  plugin's `onLinkAccount` (wired to `relinkPlayer`) is what makes that
  upgrade not require a data migration.
- **`schema` is omitted from `drizzleAdapter`'s config.** `@hazard-pay/db`'s
  `createDb` already builds its Drizzle instance with the full schema
  (`db._.fullSchema`), which is the adapter's documented fallback when no
  `schema` override is given. Don't pass one unless a table needs aliasing.
- **`player.handle` starts as a placeholder** (`defaultHandle`, derived from
  the user id). Renaming it is a dev-login UI concern for #15, not this
  package's.
- **Secret**: `BETTER_AUTH_SECRET` (`@hazard-pay/env`) carries a checked-in
  dev default, consistent with every other env var in this repo — real auth
  hardening is out of scope for the current map.

## Tests

`pnpm --filter @hazard-pay/auth test` needs the dev Postgres
(`pnpm db:up`) — it reuses `@hazard-pay/db/testing`'s template-clone
helpers (same template database, same migrations) via its own
`globalSetup`. One test exercises the real `auth.api.signInAnonymous()`
call end-to-end and asserts the player row it should have triggered exists
— the strongest proof that the schema and the hook wiring agree.

**Known gap**: `relinkPlayer` is unit-tested directly, and the anonymous
plugin's `onLinkAccount` option is wired to it in `createAuth`, but no test
drives the full "anonymous user links to a real account" flow through
better-auth's own plugin machinery — that requires a real second auth
method (email/password or OAuth) live, which this package deliberately
doesn't enable. Whoever turns on the first real auth method should add that
end-to-end test at the same time.
