import type { LaneEventPayload } from "@hazard-pay/agent/envelope";
import type { LaneEventRow, LaneRow } from "@hazard-pay/db";
import { errAsync, type ResultAsync } from "neverthrow";

import type { LaneEventRecord, LaneSummary, LaneTracePage } from "../contract/index.ts";
import type { AppCtx } from "../context.ts";
import {
  findLaneById,
  listLaneEventsAfter,
  listLaneRows,
  tallyLaneEvents,
  type LaneEventTally,
} from "../db/index.ts";
import type { ApiError } from "./errors.ts";

/**
 * Read-only lane queries for the admin trace viewer (#24). No mutation
 * surface here on purpose — the runtime in `@hazard-pay/agent` is the only
 * writer of lanes and lane events (ADR 0003 §4).
 */
export function listLanes(
  ctx: Pick<AppCtx, "db">,
): ResultAsync<{ lanes: LaneSummary[] }, ApiError> {
  return listLaneRows(ctx.db)
    .andThen((rows) => tallyLaneEvents(ctx.db).map((tallies) => ({ rows, tallies })))
    .map(({ rows, tallies }) => ({
      lanes: rows.map((row) => toLaneSummary(row, tallies)),
    }));
}

export function getLaneTrace(
  ctx: Pick<AppCtx, "db">,
  args: { laneId: string; after: number; limit: number },
): ResultAsync<LaneTracePage, ApiError> {
  return findLaneById(ctx.db, args.laneId).andThen((row) => {
    if (row === undefined) {
      return errAsync<LaneTracePage, ApiError>({
        type: "lane_not_found",
        message: `no lane ${args.laneId}`,
      });
    }
    return tallyLaneEvents(ctx.db, row.id).andThen((tallies) =>
      // limit + 1: one extra row answers `hasMore` without a count query.
      listLaneEventsAfter(ctx.db, { laneId: row.id, after: args.after, limit: args.limit + 1 })
        .map((events) => ({
          lane: toLaneSummary(row, tallies),
          events: events.slice(0, args.limit).map(toLaneEventRecord),
          hasMore: events.length > args.limit,
        })));
  });
}

function toLaneSummary(row: LaneRow, tallies: LaneEventTally[]): LaneSummary {
  const mine = tallies.filter((tally) => tally.laneId === row.id);
  const totalOf = (type: LaneEventTally["type"]): number =>
    mine.find((tally) => tally.type === type)?.total ?? 0;
  const lastEventAt = mine.reduce<Date | null>(
    (latest, tally) =>
      tally.lastAt !== null && (latest === null || tally.lastAt > latest) ? tally.lastAt : latest,
    null,
  );
  return {
    id: row.id,
    kind: row.kind,
    leaderName: row.leaderName,
    configHash: row.configHash,
    status: row.status,
    parentLaneId: row.parentLaneId,
    createdAt: row.createdAt.toISOString(),
    wokeAt: row.wokeAt?.toISOString() ?? null,
    lastEventAt: lastEventAt?.toISOString() ?? null,
    eventCounts: {
      input: totalOf("input"),
      modelTurn: totalOf("model_turn"),
      toolResult: totalOf("tool_result"),
      compaction: totalOf("compaction"),
      total: mine.reduce((sum, tally) => sum + tally.total, 0),
    },
  };
}

function toLaneEventRecord(row: LaneEventRow): LaneEventRecord {
  return {
    seq: row.seq,
    author: row.author,
    type: row.type,
    // jsonb comes back untyped; the contract's output validation is the
    // loud refusal the envelope demands for unknown shapes (ADR 0003 §4).
    payload: row.payload as LaneEventPayload,
    occurredAt: row.occurredAt.toISOString(),
  };
}
