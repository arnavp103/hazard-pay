import { lane, laneEvent, leaderConfig } from "@hazard-pay/db";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { ResultAsync, errAsync, okAsync } from "neverthrow";

import { storeFailed } from "./errors.ts";
import type { AgentError } from "./errors.ts";
import type { JsonValue, LaneEventPayload } from "./envelope.ts";
import type { DbLike, LaneEventRow, LaneRow } from "@hazard-pay/db";

/**
 * Store functions for the lane event log (issue #23: schemas live in
 * `packages/db`, store functions live here). All writes are appends or
 * guarded updates; nothing here ever mutates a lane event.
 */

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (code === "23505") {
    return true;
  }
  return isUniqueViolation((error as { cause?: unknown }).cause);
}

/** Stores a leader config once per content hash; re-inserting is a no-op. */
export function ensureLeaderConfig(
  db: DbLike,
  args: { hash: string; config: JsonValue },
): ResultAsync<void, AgentError> {
  return ResultAsync.fromPromise(
    db
      .insert(leaderConfig)
      .values({ hash: args.hash, config: args.config })
      .onConflictDoNothing({ target: leaderConfig.hash }),
    storeFailed("ensureLeaderConfig"),
  ).map(() => undefined);
}

export function insertLane(
  db: DbLike,
  args: {
    kind: "foreground" | "mission";
    leaderName: string;
    configHash: string;
    parentLaneId?: string;
  },
): ResultAsync<LaneRow, AgentError> {
  return ResultAsync.fromPromise(
    db
      .insert(lane)
      .values({
        kind: args.kind,
        leaderName: args.leaderName,
        configHash: args.configHash,
        parentLaneId: args.parentLaneId,
      })
      .returning(),
    (cause) =>
      isUniqueViolation(cause)
        ? ({ tag: "ForegroundLaneExists", leaderName: args.leaderName } satisfies AgentError)
        : storeFailed("insertLane")(cause),
  ).andThen(([row]) =>
    row === undefined
      ? errAsync<LaneRow, AgentError>(storeFailed("insertLane")("no row returned"))
      : okAsync(row));
}

/**
 * A leader's single foreground lane, if it exists (ADR 0003 §4: exactly one
 * per leader, enforced by the partial unique index). `null` means the host
 * has not created it yet.
 */
export function findForegroundLane(
  db: DbLike,
  leaderName: string,
): ResultAsync<LaneRow | null, AgentError> {
  return ResultAsync.fromPromise(
    db
      .select()
      .from(lane)
      .where(and(eq(lane.leaderName, leaderName), eq(lane.kind, "foreground"))),
    storeFailed("findForegroundLane"),
  ).map(([row]) => row ?? null);
}

/**
 * Re-stamps a lane's `config_hash` after its leader's config changed in git
 * (issue #52): the stamp names the config the lane runs under NOW; each
 * `model_turn` carries the hash it actually ran with, so history stays
 * verifiable across restamps.
 */
export function restampLaneConfig(
  db: DbLike,
  args: { laneId: string; configHash: string },
): ResultAsync<void, AgentError> {
  return ResultAsync.fromPromise(
    db.update(lane).set({ configHash: args.configHash }).where(eq(lane.id, args.laneId)),
    storeFailed("restampLaneConfig"),
  ).map(() => undefined);
}

export function loadLane(db: DbLike, laneId: string): ResultAsync<LaneRow, AgentError> {
  return ResultAsync.fromPromise(
    db.select().from(lane).where(eq(lane.id, laneId)),
    storeFailed("loadLane"),
  ).andThen(([row]) =>
    row === undefined
      ? errAsync<LaneRow, AgentError>({ tag: "LaneNotFound", laneId })
      : okAsync(row));
}

/** The whole log, ordered by seq — the input of every fold. */
export function loadLaneEvents(
  db: DbLike,
  laneId: string,
): ResultAsync<LaneEventRow[], AgentError> {
  return ResultAsync.fromPromise(
    db.select().from(laneEvent).where(eq(laneEvent.laneId, laneId)).orderBy(asc(laneEvent.seq)),
    storeFailed("loadLaneEvents"),
  );
}

/**
 * The optimistic append (ADR 0003 §4): the caller names the seq it derived
 * from its fold; a concurrent appender that got there first makes this an
 * `AppendConflict` via the `(lane_id, seq)` primary key — never a silent
 * overwrite, never a gap.
 */
export function appendLaneEvent(
  db: DbLike,
  args: {
    laneId: string;
    seq: number;
    author: string;
    type: "input" | "model_turn" | "tool_result" | "compaction";
    payload: LaneEventPayload;
  },
): ResultAsync<void, AgentError> {
  return ResultAsync.fromPromise(
    db.insert(laneEvent).values(args),
    (cause) =>
      isUniqueViolation(cause)
        ? ({ tag: "AppendConflict", laneId: args.laneId, seq: args.seq } satisfies AgentError)
        : storeFailed("appendLaneEvent")(cause),
  ).map(() => undefined);
}

/** `coalesce(max(seq), 0) + 1` — the next seq for an external append. */
export function nextSeq(db: DbLike, laneId: string): ResultAsync<number, AgentError> {
  return ResultAsync.fromPromise(
    db
      .select({ last: sql<number>`coalesce(max(${laneEvent.seq}), 0)` })
      .from(laneEvent)
      .where(eq(laneEvent.laneId, laneId)),
    storeFailed("nextSeq"),
  ).map(([row]) => Number(row?.last ?? 0) + 1);
}

/**
 * The guarded wake claim (ADR 0003 §6): `open → waking`, stamping `woke_at`.
 * A `waking` row whose claim is older than `staleAfterMs` is reclaimable —
 * that is the crash-recovery path (redelivered doorbell finds the corpse).
 */
export function claimWake(
  db: DbLike,
  args: { laneId: string; staleAfterMs: number; claimedAt: Date },
): ResultAsync<LaneRow, AgentError> {
  const staleSeconds = args.staleAfterMs / 1000;
  return ResultAsync.fromPromise(
    db
      .update(lane)
      // The claimant's own timestamp (not now()): it doubles as the claim
      // token that releaseWake is guarded on.
      .set({ status: "waking", wokeAt: args.claimedAt })
      .where(
        and(
          eq(lane.id, args.laneId),
          or(
            eq(lane.status, "open"),
            and(
              eq(lane.status, "waking"),
              sql`${lane.wokeAt} < now() - make_interval(secs => ${staleSeconds})`,
            ),
          ),
        ),
      )
      .returning(),
    storeFailed("claimWake"),
  ).andThen(([row]) =>
    row === undefined
      ? errAsync<LaneRow, AgentError>({ tag: "WakeClaimConflict", laneId: args.laneId })
      : okAsync(row));
}

/**
 * Releases a wake claim back to `open` at quiescence — but only the claim
 * identified by `claimedAt`. If a stale claim was reclaimed by another wake
 * while this one limped along, `woke_at` no longer matches and this release
 * is a no-op: a slow claimant can never free the reclaimer's claim.
 */
export function releaseWake(
  db: DbLike,
  args: { laneId: string; claimedAt: Date },
): ResultAsync<void, AgentError> {
  return ResultAsync.fromPromise(
    db
      .update(lane)
      .set({ status: "open", wokeAt: null })
      .where(
        and(
          eq(lane.id, args.laneId),
          eq(lane.status, "waking"),
          eq(lane.wokeAt, args.claimedAt),
        ),
      ),
    storeFailed("releaseWake"),
  ).map(() => undefined);
}

/** Terminal: cancelled or completed missions. */
export function closeLane(db: DbLike, laneId: string): ResultAsync<void, AgentError> {
  return ResultAsync.fromPromise(
    db.update(lane).set({ status: "closed", wokeAt: null }).where(eq(lane.id, laneId)),
    storeFailed("closeLane"),
  ).map(() => undefined);
}
