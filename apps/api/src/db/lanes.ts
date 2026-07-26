import { type Db, lane, laneEvent, type LaneEventRow, type LaneRow } from "@hazard-pay/db";
import { asc, count, desc, eq, exists, gt, and, max, sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { LaneListFilter } from "../contract/index.ts";
import type { DbUnreachableError } from "../domain/errors.ts";
import { toDbUnreachable } from "./unreachable.ts";

/** One `(lane, type)` aggregate over the lane event log. */
export interface LaneEventTally {
  laneId: string;
  type: LaneEventRow["type"];
  total: number;
  lastAt: Date | null;
}

/** One lane's most recent model turn — the source of `LaneSummary.model` (#58). */
export interface LaneModelRow {
  laneId: string;
  modelId: string;
}

/**
 * Read queries for the admin trace viewer (#24) — strictly read-only over
 * the agent runtime's tables; the runtime in `@hazard-pay/agent` is the only
 * writer. Capped at 500 lanes: the lane index is a dev surface, and a cap
 * beats an unbounded scan.
 *
 * `filter` (#58) is applied before the cap and the order-by, so a narrow
 * filter surfaces older matching lanes the unfiltered index would have
 * dropped. Every field is optional and independent (AND'd together) — the
 * lane index's row order and shape are unchanged when `filter` is absent.
 */
export function listLaneRows(
  db: Db,
  filter?: LaneListFilter,
): ResultAsync<LaneRow[], DbUnreachableError> {
  const conditions = laneFilterConditions(db, filter);
  const query = db.select().from(lane);
  return ResultAsync.fromPromise(
    (conditions === undefined ? query : query.where(conditions))
      .orderBy(desc(lane.createdAt), desc(lane.id))
      .limit(500),
    toDbUnreachable,
  );
}

/**
 * `model` (#58) has no column to filter on — no leader config or lane row
 * stamps a model identity (ADR 0003 §3's config hash covers name/system
 * prompt/toolset only; the model is injected into `createRuntime`
 * independently, so a lane could in principle span more than one model
 * across its wakes). It resolves the same way as the summary's derived
 * `model` field: an EXISTS check against the lane's `model_turn` lane
 * events, scoped by `lane_event_model_turn_idx`.
 */
function laneFilterConditions(db: Db, filter: LaneListFilter | undefined) {
  if (filter === undefined) {
    return undefined;
  }
  const conditions = [];
  if (filter.leader !== undefined) {
    conditions.push(eq(lane.leaderName, filter.leader));
  }
  if (filter.kind !== undefined) {
    conditions.push(eq(lane.kind, filter.kind));
  }
  if (filter.status !== undefined) {
    conditions.push(eq(lane.status, filter.status));
  }
  if (filter.configHash !== undefined) {
    conditions.push(eq(lane.configHash, filter.configHash));
  }
  if (filter.model !== undefined) {
    const modelId = filter.model;
    conditions.push(exists(
      db.select({ one: sql`1` }).from(laneEvent).where(and(
        eq(laneEvent.laneId, lane.id),
        eq(laneEvent.type, "model_turn"),
        sql`${laneEvent.payload} #>> '{model,modelId}' = ${modelId}`,
      )),
    ));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * The modelId of each lane's most recent model turn (#58) — the source of
 * `LaneSummary.model`. `DISTINCT ON (lane_id) ... ORDER BY seq DESC` scoped
 * to `model_turn` rows, matching `lane_event_model_turn_idx`. Omits lanes
 * with no model turns yet rather than returning a null row for them —
 * callers treat "absent" as null (see `domain/lanes.ts`).
 */
export function listLatestModelPerLane(
  db: Db,
  laneId?: string,
): ResultAsync<LaneModelRow[], DbUnreachableError> {
  const typeCondition = eq(laneEvent.type, "model_turn");
  return ResultAsync.fromPromise(
    db
      .selectDistinctOn([laneEvent.laneId], {
        laneId: laneEvent.laneId,
        modelId: sql<string>`${laneEvent.payload} #>> '{model,modelId}'`,
      })
      .from(laneEvent)
      .where(laneId === undefined ? typeCondition : and(typeCondition, eq(laneEvent.laneId, laneId)))
      .orderBy(laneEvent.laneId, desc(laneEvent.seq)),
    toDbUnreachable,
  );
}

export function findLaneById(
  db: Db,
  laneId: string,
): ResultAsync<LaneRow | undefined, DbUnreachableError> {
  return ResultAsync.fromPromise(
    db.select().from(lane).where(eq(lane.id, laneId)),
    toDbUnreachable,
  ).map((rows) => rows[0]);
}

/** Tallies for every lane, or one lane when `laneId` is given. */
export function tallyLaneEvents(
  db: Db,
  laneId?: string,
): ResultAsync<LaneEventTally[], DbUnreachableError> {
  const base = db
    .select({
      laneId: laneEvent.laneId,
      type: laneEvent.type,
      total: count(),
      lastAt: max(laneEvent.occurredAt),
    })
    .from(laneEvent)
    .groupBy(laneEvent.laneId, laneEvent.type);
  return ResultAsync.fromPromise(
    laneId === undefined ? base : base.where(eq(laneEvent.laneId, laneId)),
    toDbUnreachable,
  );
}

/**
 * One transcript page: ascending seq strictly after the cursor. The caller
 * passes `limit + 1` to detect `hasMore` without a second count query.
 */
export function listLaneEventsAfter(
  db: Db,
  args: { laneId: string; after: number; limit: number },
): ResultAsync<LaneEventRow[], DbUnreachableError> {
  return ResultAsync.fromPromise(
    db
      .select()
      .from(laneEvent)
      .where(and(eq(laneEvent.laneId, args.laneId), gt(laneEvent.seq, args.after)))
      .orderBy(asc(laneEvent.seq))
      .limit(args.limit),
    toDbUnreachable,
  );
}
