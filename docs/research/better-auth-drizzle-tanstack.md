# better-auth + Drizzle + TanStack Start

Research notes for the dev-stub login plan: pick/create a player, real session, no
email/OAuth — built on better-auth's schemas so real auth drops in later without a
migration. Facts below are sourced from the better-auth docs (better-auth.com) and
the better-auth repo, verified against version 1.6.23 / `main` as of 2026-07-19.

## 1. Core schema better-auth expects

Four tables: `user`, `session`, `account`, `verification`. All use **string (text)
primary keys** by default; on Postgres, better-auth defers to the DB to generate
UUIDs by default, and `advanced.database.generateId` can force `"uuid"`, `"serial"`,
a custom function, or `false` (DB-generated).
Source: <https://www.better-auth.com/docs/concepts/database> (Core Schema, ID
Generation); field definitions cross-checked against
<https://github.com/better-auth/better-auth/blob/main/packages/core/src/db/get-tables.ts>.

Drizzle sketches (Postgres, snake_case column names as the CLI generates them):

```ts
// user — https://www.better-auth.com/docs/concepts/database#user
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),                       // optional
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// session — https://www.better-auth.com/docs/concepts/database#session
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull()
    .references(() => user.id, { onDelete: "cascade" }), // indexed
  token: text("token").notNull().unique(),    // "The unique session token"
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),              // optional
  userAgent: text("user_agent"),              // optional
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// account — https://www.better-auth.com/docs/concepts/database#account
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull()
    .references(() => user.id, { onDelete: "cascade" }), // indexed
  accountId: text("account_id").notNull(),    // provider's user id; = userId for credential accounts
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),          // optional; never returned by the API
  refreshToken: text("refresh_token"),        // optional; never returned
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),                 // email/password auth only; never returned
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// verification — https://www.better-auth.com/docs/concepts/database#verification
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),   // indexed
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
```

Sensitive `account` fields (`password`, tokens) are stripped from every API
response by better-auth's output parsing
(<https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/db/schema.ts>).

Table and column names are remappable without changing app-side types via
`user.modelName` / `user.fields` etc. in the `betterAuth()` config — "Type
inference in your code will still use the original field names."
Source: <https://www.better-auth.com/docs/concepts/database#custom-table-names>.

Extra columns go through `user.additionalFields` (also supported on `session` and
`account`), with `type`, `required`, `defaultValue`, `input` (can API callers set
it, default true), and `returned` (is it in responses, default true).
Source: <https://www.better-auth.com/docs/concepts/database#extending-core-schema>.

## 2. Drizzle adapter facts

- The adapter is a **separate package**, `@better-auth/drizzle-adapter` — not a
  `better-auth/adapters/drizzle` subpath.
  Source: <https://www.better-auth.com/docs/adapters/drizzle>.

  ```ts
  import { betterAuth } from "better-auth";
  import { drizzleAdapter } from "@better-auth/drizzle-adapter";
  import { db } from "./database.ts";

  export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
  });
  ```

- Config options (from
  <https://github.com/better-auth/better-auth/blob/main/packages/drizzle-adapter/src/drizzle-adapter.ts>):
  `provider: "pg" | "mysql" | "sqlite"` (required), `schema` (your Drizzle schema
  exports; falls back to `db._.fullSchema` if omitted), `usePlural` (table exports
  named `users`/`sessions`), `camelCase` (default false — snake_case columns, which
  is what the CLI generates), `debugLogs`, `transaction`.
- Model → export mapping: the adapter looks up `schema[model]`, so a differently
  named export is aliased like
  `schema: { ...schema, user: schema.users }`.
  Source: <https://www.better-auth.com/docs/adapters/drizzle#modifying-table-names>.
- Column renames are just the Drizzle column string:
  `email: varchar("email_address", ...)` works as-is.
  Source: <https://www.better-auth.com/docs/adapters/drizzle#modifying-field-names>.
- Experimental native joins (`experimental: { joins: true }` in `betterAuth()`)
  require Drizzle `relations()` in the schema; the CLI emits them since 1.4.
  Source: <https://www.better-auth.com/docs/adapters/drizzle#joins-experimental>.

### Schema generation CLI

- Invocation in current docs is `npx auth@latest generate` / `migrate` / `init` /
  `secret` / `info`. Source: <https://www.better-auth.com/docs/concepts/cli>.
- `generate` emits an ORM-native schema — for Drizzle, a `schema.ts` (project root
  by default; `--output` overrides). Config discovery: looks for `auth.ts` in
  `./`, `./utils`, `./lib`, and each of those under `src/`; `--config` overrides;
  `--yes` skips the prompt.
  Source: <https://www.better-auth.com/docs/concepts/cli#generate>.
- `migrate` (and programmatic `getMigrations` from `better-auth/db/migration`)
  **only work with the built-in Kysely adapter**. With Drizzle, the flow is:
  `npx auth@latest generate` → `npx drizzle-kit generate` → `npx drizzle-kit migrate`.
  Sources: <https://www.better-auth.com/docs/concepts/cli#migrate>,
  <https://www.better-auth.com/docs/adapters/drizzle#schema-generation--migration>,
  <https://www.better-auth.com/docs/concepts/database#programmatic-migrations>.

Practical implication for `packages/db`: run `generate` once, move the emitted
tables into our own Drizzle schema files, and own them from then on — drizzle-kit
drives migrations, and the adapter just needs the exports passed via `schema`.

## 3. TanStack Start integration points

Docs page: <https://www.better-auth.com/docs/integrations/tanstack>.

**Handler mount** — a catch-all API route at `src/routes/api/auth/$.ts` using
`createFileRoute` with `server.handlers` (not `createServerFileRoute`):

```ts
import { auth } from "@/lib/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => auth.handler(request),
      POST: async ({ request }: { request: Request }) => auth.handler(request),
    },
  },
});
```

Source: <https://www.better-auth.com/docs/integrations/tanstack#mount-the-handler>.

**Cookie handling** — when calling `auth.api.*` server-side, Set-Cookie must be
propagated; better-auth ships a `tanstackStartCookies` plugin for this, imported
from `better-auth/tanstack-start`, and it must be the **last** plugin in the array.
Source: <https://www.better-auth.com/docs/integrations/tanstack#usage-tips>.

```ts
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  plugins: [tanstackStartCookies()], // keep last
});
```

**Server-side session** — via `createServerFn` + `getRequestHeaders`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  return auth.api.getSession({ headers });
});
```

Route protection is `beforeLoad` throwing `redirect({ to: "/login" })`, optionally
behind a pathless `_protected.tsx` layout route.
Source: <https://www.better-auth.com/docs/integrations/tanstack#protecting-resources>.

**Client** — the docs recommend the client SDK over server actions:
`createAuthClient` from `better-auth/react` gives `authClient.useSession()`,
`signIn.*`, `signOut()` hooks/methods.
Sources: <https://www.better-auth.com/docs/integrations/tanstack#usage-tips>,
<https://www.better-auth.com/docs/concepts/client>.

## 4. Dev-stub options

### Option A — anonymous plugin (recommended)

<https://www.better-auth.com/docs/plugins/anonymous> — purpose-built for
"authenticated experience without email/password/OAuth/PII":

- Server: `anonymous()` from `better-auth/plugins`. Options: `emailDomainName`
  (synthetic email, default `temp@{id}.com`), `generateRandomEmail`,
  `generateName` (display name for the anonymous user),
  `onLinkAccount({ anonymousUser, newUser })`, `disableDeleteAnonymousUser`.
- Client: `anonymousClient()` from `better-auth/client/plugins`; then
  `await authClient.signIn.anonymous()` mints a real user + real session cookie.
- Schema delta: exactly one optional field on `user` —
  `isAnonymous: boolean`.
  Source: <https://www.better-auth.com/docs/plugins/anonymous#schema>.
- Upgrade path is first-class: when an anonymous user later does `signIn`/`signUp`
  with a real method, `onLinkAccount` fires and the anonymous user is deleted by
  default (set `disableDeleteAnonymousUser` or migrate data in the hook).

### Option B — email/password with fake credentials

Email/password is opt-in (`emailAndPassword: { enabled: true }`; disabled when
omitted — <https://www.better-auth.com/docs/authentication/email-password>). A
stub could `signUp.email` with `player-name@dev.local` and a constant password.
Works, but writes throwaway `password` hashes into `account` rows and enables a
real credential endpoint we'd have to strip later. The username plugin
(<https://www.better-auth.com/docs/plugins/username>) still requires
email/password enabled, so it doesn't avoid this.

### Option C — programmatic session minting

There is **no documented public "create session for arbitrary user" API**. The
closest are the admin plugin's `createUser` (still requires email + password) and
`impersonateUser` (requires an existing admin session; 1-hour default TTL).
Source: <https://www.better-auth.com/docs/plugins/admin#impersonate-user>. Not a fit.

## 5. Relating a custom `player` table to `user`

Keep game identity out of the auth tables: better-auth's `additionalFields` is for
fields that belong to the user record itself; for related records, the documented
extension point is database hooks — e.g. `databaseHooks.user.create.after` ("perform
additional actions, like creating a stripe customer").
Source: <https://www.better-auth.com/docs/concepts/database#database-hooks>.

```ts
// packages/db — owned by us, never touched by better-auth
export const player = pgTable("player", {
  id: text("id").primaryKey(),               // our own id; game FKs point here
  userId: text("user_id").notNull().unique() // 1:1 with auth identity
    .references(() => user.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Why a separate table rather than `additionalFields`:

- All game FKs reference `player.id`, so auth churn (anonymous → real account
  linking, or a future auth swap) never cascades through game tables.
- `user` deletion cascades stop at `player` only if we want them to; we control
  the FK semantics.
- better-auth never reads or writes `player`, so its CLI/migrations can't clobber it.

Creation is wired with `databaseHooks.user.create.after` (create the `player` row
whenever better-auth creates a `user`), and during anonymous→real linking,
`onLinkAccount({ anonymousUser, newUser })` re-points `player.userId` from the
anonymous user to the new user before the anonymous row is auto-deleted.
Sources: <https://www.better-auth.com/docs/concepts/database#database-hooks>,
<https://www.better-auth.com/docs/plugins/anonymous#account-linking>.

## 6. Recommended stub design

1. **Schema (packages/db):** the four core tables exactly as generated by
   `npx auth@latest generate` (plus the anonymous plugin's `user.isAnonymous`
   boolean), and our own `player` table 1:1 on `user.id` as above. Migrations via
   drizzle-kit, like every other table we own.
2. **Auth instance:** `betterAuth({ database: drizzleAdapter(db, { provider: "pg",
   schema }), plugins: [anonymous({ generateName, onLinkAccount }),
   tanstackStartCookies()] })` — no `emailAndPassword`, no OAuth. Cookie plugin last.
3. **Wiring:** catch-all `src/routes/api/auth/$.ts` handler; `createAuthClient`
   from `better-auth/react` with `anonymousClient()`; session checks via
   `createServerFn` + `auth.api.getSession({ headers: getRequestHeaders() })` in
   `beforeLoad`.
4. **Dev login flow:** the login page lists existing players (query `player` join
   `user`); "new player" calls `authClient.signIn.anonymous()` then names the
   player row created by the `user.create.after` hook. "Pick existing player" in
   dev can simply sign in anonymously and re-point that player's `userId` — or,
   simpler and stateless, treat each browser as one player and skip picking.
5. **Upgrade path:** dropping in real auth later is additive only — enable
   `emailAndPassword` or a social provider in config, keep `anonymous()` so
   existing dev users link via `onLinkAccount` (which migrates `player.userId`),
   then remove the plugin once no anonymous rows remain. No table shape changes:
   the only stub-specific column, `isAnonymous`, is optional and harmless to keep.

Trade-off note: the anonymous plugin writes a synthetic email per user
(`temp@{id}.com`-style). That's cosmetic; `generateRandomEmail` can make these
recognizably dev-only (e.g. `{id}@stub.hazard-pay.dev`).

## Corrections to common assumptions

- Drizzle adapter lives at `@better-auth/drizzle-adapter`, not
  `better-auth/adapters/drizzle`.
- CLI is `npx auth@latest ...` in current docs, not `npx @better-auth/cli ...`.
- TanStack cookie plugin is `tanstackStartCookies` from
  `better-auth/tanstack-start`, not `reactStartCookies` from
  `better-auth/react-start`.
- Handler mounting uses `createFileRoute(...).server.handlers`, not
  `createServerFileRoute`.
- `migrate` / `getMigrations` are Kysely-only; Drizzle uses `generate` + drizzle-kit.
