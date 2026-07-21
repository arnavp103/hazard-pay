import { type Db, player } from "@hazard-pay/db";
import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { DbUnreachableError, HandleTakenError } from "../domain/errors.ts";
import { toDbUnreachable } from "./unreachable.ts";

export type PlayerRow = typeof player.$inferSelect;

/**
 * The player row auto-created 1:1 with a better-auth user by
 * `@hazard-pay/auth`'s database hook. Today only the sign-in round-trip
 * test reads it (proving the hook ran inside this app); it is the query
 * the dev-login player flow (#19's webapp half) will serve from.
 */
export function findPlayerByUserId(
  db: Db,
  userId: string,
): ResultAsync<PlayerRow | undefined, DbUnreachableError> {
  return ResultAsync.fromPromise(
    db.select().from(player).where(eq(player.userId, userId)),
    toDbUnreachable,
  ).map((rows) => rows[0]);
}

/**
 * Postgres's unique-violation SQLSTATE (`23505`). drizzle-orm wraps the raw
 * `pg` error (which carries `.code` directly) in its own `DrizzleQueryError`,
 * so the SQLSTATE surfaces one level down, on `.cause.code` — checked here
 * without assuming which layer it lands on.
 */
function isUniqueViolation(cause: unknown): boolean {
  return sqlState(cause) === "23505" || sqlState((cause as { cause?: unknown } | null)?.cause) === "23505";
}

function sqlState(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

/**
 * The rename write (#50): `undefined` means no player row exists for this
 * user id (the caller maps that to `player_not_found` — a defensive edge,
 * since the auth hook guarantees the row exists for any session). A unique
 * violation on `player.handle` becomes `handle_taken` rather than the
 * generic `db_unreachable` translation.
 */
export function updatePlayerHandle(
  db: Db,
  userId: string,
  handle: string,
): ResultAsync<PlayerRow | undefined, DbUnreachableError | HandleTakenError> {
  return ResultAsync.fromPromise(
    db.update(player).set({ handle }).where(eq(player.userId, userId)).returning(),
    (cause): DbUnreachableError | HandleTakenError =>
      isUniqueViolation(cause)
        ? { type: "handle_taken", message: `handle "${handle}" is already taken` }
        : toDbUnreachable(cause),
  ).map((rows) => rows[0]);
}
