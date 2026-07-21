import { emitEvent, traceparentOf, withSpan } from "@hazard-pay/observability";
import type { ResultAsync } from "neverthrow";

import type { AppCtx } from "../context.ts";
import { latestTick, recordDueTicks, type TickRow } from "../db/index.ts";
import type { ApiError } from "./errors.ts";

/**
 * One overworld tick (ADR 0004 §4): record every due tick number in one
 * transaction — eager, idempotent, backfilled — and let the transaction's
 * NOTIFY nudge the fan-out. Traced as `tick.run`; each recorded tick is a
 * domain fact (`tick.completed`), and the span's traceparent is stored on
 * the rows so the trace follows the tick through transport to render
 * (ADR 0005 §6).
 */
export function runTick(ctx: Pick<AppCtx, "db" | "logger" | "env">): ResultAsync<void, ApiError> {
  return withSpan("tick.run", (span) =>
    recordDueTicks(ctx.db, {
      now: new Date(),
      intervalMs: ctx.env.TICK_INTERVAL,
      traceparent: traceparentOf(span),
    }).map((recorded) => {
      span.setAttribute("tick.recorded_count", recorded.length);
      for (const row of recorded) {
        emitEvent("tick.completed", { tick_id: row.id, tick_number: row.tickNumber });
      }
      if (recorded.length === 0) {
        ctx.logger.debug("tick already current");
      } else {
        ctx.logger.info(
          { recorded: recorded.length, tick_number: recorded.at(-1)?.tickNumber },
          "tick recorded",
        );
      }
    }));
}

/** The overworld snapshot read for the contract route: latest tick or null. */
export function getLatestTick(
  ctx: Pick<AppCtx, "db">,
): ResultAsync<TickRow | null, ApiError> {
  return latestTick(ctx.db);
}
