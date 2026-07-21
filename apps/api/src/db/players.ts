import { type Db, player } from "@hazard-pay/db";
import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { DbUnreachableError } from "../domain/errors.ts";

export type PlayerRow = typeof player.$inferSelect;

/**
 * The player row auto-created 1:1 with a better-auth user by
 * `@hazard-pay/auth`'s database hook. The dev-login flow reads it after an
 * anonymous sign-in.
 */
export function findPlayerByUserId(
  db: Db,
  userId: string,
): ResultAsync<PlayerRow | undefined, DbUnreachableError> {
  return ResultAsync.fromPromise(
    db.select().from(player).where(eq(player.userId, userId)),
    (cause): DbUnreachableError => ({
      type: "db_unreachable",
      message: cause instanceof Error ? cause.message : String(cause),
    }),
  ).map((rows) => rows[0]);
}
