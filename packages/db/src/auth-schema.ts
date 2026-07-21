import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * better-auth's core schema (research on #6, `docs/research/better-auth-drizzle-tanstack.md`
 * on `research/better-auth-drizzle-tanstack`), reproduced by hand to match what
 * `npx auth@latest generate` emits for the Drizzle adapter (`provider: "pg"`,
 * `camelCase: false` — snake_case columns). better-auth supplies `id` values
 * itself; these columns carry no DB-side default. `isAnonymous` is the one
 * schema addition from the anonymous plugin (CONTEXT.md: User — a player's
 * authentication identity, auth vocabulary only).
 *
 * Table/column shapes here are load-bearing for @better-auth/drizzle-adapter's
 * field mapping (packages/auth) — don't rename without checking that package.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  // better-auth/plugins/anonymous — https://www.better-auth.com/docs/plugins/anonymous#schema
  isAnonymous: boolean("is_anonymous"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    // Never returned by the better-auth API; optional because non-credential
    // providers (and the anonymous plugin) don't populate all of these.
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/**
 * Game identity, 1:1 on `user.id` (CONTEXT.md: Player — never "user"; game
 * concepts reference the player, never the user). better-auth never reads or
 * writes this table, so its CLI/migrations can't clobber it, and game FKs
 * point at `player.id` rather than `user.id` — auth churn (anonymous -> real
 * account linking, or a future auth swap) never cascades through game tables.
 *
 * Rows are created by `@hazard-pay/auth`'s `createAuth` via
 * `databaseHooks.user.create.after`, and re-pointed by `onLinkAccount` when an
 * anonymous user upgrades to a real account.
 */
export const player = pgTable("player", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
