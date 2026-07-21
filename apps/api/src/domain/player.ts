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
 * resolves `null` on a missing session, but it still queries the db to
 * validate a present session token, so a rejection here is a real failure
 * mode (the db being unreachable) and is mapped through the same
 * `db_unreachable` tag every other domain function uses, rather than
 * bypassing the `respond` table via an assumed-safe promise.
 */
export function requireSessionUserId(
  ctx: { auth: Auth; headers: Headers },
): ResultAsync<string, ApiError> {
  return ResultAsync.fromPromise(
    ctx.auth.api.getSession({ headers: ctx.headers }),
    (cause): ApiError => ({
      type: "db_unreachable",
      message: cause instanceof Error ? cause.message : String(cause),
    }),
  ).andThen((session) =>
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
