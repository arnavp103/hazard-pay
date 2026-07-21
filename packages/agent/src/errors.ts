/**
 * Tagged-union error types for the agent runtime (ADR 0002 §4: domain
 * functions return `ResultAsync<T, E>`; nothing below an adapter throws — a
 * thrown exception is a defect).
 */
export type AgentError
  = | { tag: "LaneNotFound"; laneId: string }
    | { tag: "LaneClosed"; laneId: string }
  /** The guarded `open → waking` claim found no claimable row. */
    | { tag: "WakeClaimConflict"; laneId: string }
  /** The optimistic append guard (PK `(lane_id, seq)`) lost a race. */
    | { tag: "AppendConflict"; laneId: string; seq: number }
  /** A lane's stamped config hash no longer matches the leader in git. */
    | { tag: "ConfigDrift"; laneId: string; expected: string; actual: string }
    | { tag: "UnknownLeader"; leaderName: string }
    | { tag: "ForegroundLaneExists"; leaderName: string }
    | { tag: "ModelCallFailed"; laneId: string; cause: unknown }
  /** A persisted payload failed envelope validation on read. */
    | { tag: "EnvelopeInvalid"; laneId: string; seq: number; cause: unknown }
  /** Compaction is a reserved seam (ADR 0003 §4): folds refuse it today. */
    | { tag: "CompactionReserved"; laneId: string; seq: number }
  /** A recomputed request fingerprint diverged from the recorded one. */
    | { tag: "FingerprintMismatch"; laneId: string; seq: number; expected: string; actual: string }
    | { tag: "StoreFailed"; op: string; cause: unknown };

/** Wraps an unexpected driver/database failure. */
export function storeFailed(op: string): (cause: unknown) => AgentError {
  return (cause) => ({ tag: "StoreFailed", op, cause });
}
