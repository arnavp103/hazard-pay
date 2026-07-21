import { randomUUID } from "node:crypto";

import { type Db, player } from "@hazard-pay/db";
import env from "@hazard-pay/env";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { anonymous, type AnonymousOptions } from "better-auth/plugins";
import { eq } from "drizzle-orm";

export interface CreateAuthOptions {
  /**
   * Public origin better-auth uses for cookies/redirects. apps/api supplies
   * its real value at boot (#15); dev-stub work here never needs to resolve
   * a request, so this defaults to a placeholder.
   */
  baseURL?: string;
  /** Overrides for the anonymous plugin beyond this factory's dev-stub defaults. */
  anonymous?: Pick<AnonymousOptions, "generateName" | "disableDeleteAnonymousUser">;
}

/**
 * Default handle assigned to a freshly created player. Deliberately plain —
 * the dev login flow (#15) is where a player renames it; this factory only
 * guarantees the row exists and satisfies `player.handle`'s uniqueness.
 */
export function defaultHandle(userId: string): string {
  return `player-${userId.slice(0, 8)}`;
}

/**
 * Creates the player row 1:1 with a newly created better-auth user. Wired
 * into `databaseHooks.user.create.after` below — every user, anonymous or
 * real, gets exactly one player row.
 */
export async function createPlayerForUser(db: Db, createdUser: { id: string }): Promise<void> {
  await db.insert(player).values({
    id: randomUUID(),
    userId: createdUser.id,
    handle: defaultHandle(createdUser.id),
  });
}

/**
 * Re-points `player.userId` when an anonymous user links to a real account.
 * Wired into the anonymous plugin's `onLinkAccount` below — this is the
 * mechanism that makes the upgrade from dev-stub to real auth purely
 * additive (research on #6): the player row survives, only its owning user
 * changes.
 */
export async function relinkPlayer(
  db: Db,
  params: { anonymousUserId: string; newUserId: string },
): Promise<void> {
  await db
    .update(player)
    .set({ userId: params.newUserId })
    .where(eq(player.userId, params.anonymousUserId));
}

/**
 * Configures the shared better-auth instance: anonymous sign-in only (no
 * email/password, no OAuth — CONTEXT.md's dev-stub scope), plus the player
 * table wiring from the research on #6.
 *
 * This is a small seam, not a running server: apps/api mounts
 * `auth.handler` on its Fastify routes once it exists (#15) and supplies the
 * real `baseURL`. Nothing here depends on apps/api or a request/response
 * cycle.
 */
export function createAuth(db: Db, options: CreateAuthOptions = {}) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    baseURL: options.baseURL,
    secret: env.BETTER_AUTH_SECRET,
    plugins: [
      anonymous({
        generateRandomEmail: () => `${randomUUID()}@stub.hazard-pay.dev`,
        generateName: options.anonymous?.generateName,
        disableDeleteAnonymousUser: options.anonymous?.disableDeleteAnonymousUser,
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await relinkPlayer(db, {
            anonymousUserId: anonymousUser.user.id,
            newUserId: newUser.user.id,
          });
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            await createPlayerForUser(db, createdUser);
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
