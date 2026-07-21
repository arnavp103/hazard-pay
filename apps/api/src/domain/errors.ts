/**
 * The tagged-union error vocabulary for this app's functional core
 * (ADR 0002 §4). Domain functions return `ResultAsync<T, ApiError>`; nothing
 * below an edge adapter throws — a thrown exception is a defect, caught only
 * by Fastify's `setErrorHandler` net. Grow the union per feature; every new
 * variant needs a row in the `respond` adapter's mapping table.
 */
export interface DbUnreachableError {
  type: "db_unreachable";
  message: string;
}

/** No active better-auth session on the request (#50: session-authenticated player routes). */
export interface UnauthenticatedError {
  type: "unauthenticated";
  message: string;
}

/** A session's user has no 1:1 player row — should not happen (the auth hook guarantees it), kept as a defensive edge. */
export interface PlayerNotFoundError {
  type: "player_not_found";
  message: string;
}

/** A rename targeted a handle another player already holds (`player.handle` is unique). */
export interface HandleTakenError {
  type: "handle_taken";
  message: string;
}

export interface LaneNotFoundError {
  type: "lane_not_found";
  message: string;
}

/**
 * A leader wake that failed for real (issue #52) — NOT the benign
 * `WakeClaimConflict` skip, which the wake domain function absorbs. Surfaced
 * so the doorbell job handler throws and pg-boss retries/dead-letters.
 */
export interface LeaderWakeFailedError {
  type: "leader_wake_failed";
  message: string;
}

export type ApiError
  = | DbUnreachableError
    | UnauthenticatedError
    | PlayerNotFoundError
    | HandleTakenError
    | LaneNotFoundError
    | LeaderWakeFailedError;
