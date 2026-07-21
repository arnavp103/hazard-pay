import { type Db, player } from "@hazard-pay/db";
import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { DbUnreachableError } from "../domain/errors.ts";
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
