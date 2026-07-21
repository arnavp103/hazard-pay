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

/**
 * A leader wake that failed for real (issue #52) — NOT the benign
 * `WakeClaimConflict` skip, which the wake domain function absorbs. Surfaced
 * so the doorbell job handler throws and pg-boss retries/dead-letters.
 */
export interface LeaderWakeFailedError {
  type: "leader_wake_failed";
  message: string;
}

export type ApiError = DbUnreachableError | LeaderWakeFailedError;
