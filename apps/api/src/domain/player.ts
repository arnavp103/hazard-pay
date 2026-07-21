import type { Auth } from "@hazard-pay/auth";
import { errAsync, okAsync, ResultAsync } from "neverthrow";

import type { Player } from "../contract/index.ts";
import type { AppCtx } from "../context.ts";
import { findPlayerByUserId, updatePlayerHandle, type PlayerRow } from "../db/index.ts";
import type { ApiError } from "./errors.ts";

/**
 * The dev-login player surface's functional core (#50). Both procedures
 * start the same way — resolve the request's better-auth session to a user
 * id — then read or write that user's 1:1 player row. `auth.api.getSession`
 * itself never throws on a missing session (it resolves `null`); nothing
 * here needs a try/catch.
 */
export function requireSessionUserId(
  auth: Auth,
  headers: Headers,
): ResultAsync<string, ApiError> {
  return ResultAsync.fromSafePromise(auth.api.getSession({ headers })).andThen((session) =>
    session === null
      ? errAsync({ type: "unauthenticated" as const, message: "no active session" })
      : okAsync(session.user.id));
}

export function getCurrentPlayer(
  ctx: Pick<AppCtx, "db">,
  userId: string,
): ResultAsync<Player, ApiError> {
  return findPlayerByUserId(ctx.db, userId).andThen((row) => toPlayerResult(row, userId));
}

export function renamePlayerHandle(
  ctx: Pick<AppCtx, "db">,
  userId: string,
  handle: string,
): ResultAsync<Player, ApiError> {
  return updatePlayerHandle(ctx.db, userId, handle).andThen((row) => toPlayerResult(row, userId));
}

function toPlayerResult(
  row: PlayerRow | undefined,
  userId: string,
): ResultAsync<Player, ApiError> {
  return row === undefined
    ? errAsync({ type: "player_not_found" as const, message: `no player for user ${userId}` })
    : okAsync(toPlayerDto(row));
}

function toPlayerDto(row: PlayerRow): Player {
  return {
    id: row.id,
    userId: row.userId,
    handle: row.handle,
    createdAt: row.createdAt.toISOString(),
  };
}
