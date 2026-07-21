import { type Db, lane, laneEvent } from "@hazard-pay/db";
import { asc, count, desc, eq, gt, and, max } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { DbUnreachableError } from "../domain/errors.ts";
import { toDbUnreachable } from "./unreachable.ts";

export type LaneRow = typeof lane.$inferSelect;
export type LaneEventRow = typeof laneEvent.$inferSelect;

/** One `(lane, type)` aggregate over the lane event log. */
export interface LaneEventTally {
  laneId: string;
  type: LaneEventRow["type"];
  total: number;
  lastAt: Date | null;
}

/**
 * Read queries for the admin trace viewer (#24) — strictly read-only over
 * the agent runtime's tables; the runtime in `@hazard-pay/agent` is the only
 * writer. Capped at 500 lanes: the lane index is a dev surface, and a cap
 * beats an unbounded scan until real filtering lands.
 */
export function listLaneRows(db: Db): ResultAsync<LaneRow[], DbUnreachableError> {
  return ResultAsync.fromPromise(
    db.select().from(lane).orderBy(desc(lane.createdAt), desc(lane.id)).limit(500),
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
