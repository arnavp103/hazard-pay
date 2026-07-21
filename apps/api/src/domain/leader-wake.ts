import { errAsync, okAsync } from "neverthrow";

import type { ResultAsync } from "neverthrow";
import type { Runtime } from "@hazard-pay/agent";
import type { Logger } from "@hazard-pay/observability";
import type { ApiError } from "./errors.ts";

/**
 * The doorbell job's domain function (issue #52, ADR 0003 §6): one wake of
 * one lane, in the house job shape — `fn(ctx, args)` returning
 * `ResultAsync<void, ApiError>` so the `jobHandler` adapter owns the throw.
 *
 * `WakeClaimConflict` is absorbed as a benign skip: the lane is already
 * waking, and that wake's fold loop keeps batching newly-appended inputs
 * until quiescence — anything it misses at the wire is covered by the next
 * tick's doorbell (`short`-policy singleton queue = one queued wake per
 * lane, so skipped doorbells never pile up). Every other error is a real
 * failure: surface it so pg-boss retries and, eventually, dead-letters.
 */
export function wakeLeaderLane(
  ctx: { logger: Logger; runtime: Runtime },
  args: { laneId: string },
): ResultAsync<void, ApiError> {
  return ctx.runtime
    .wake({ laneId: args.laneId })
    .map((report) => {
      ctx.logger.info(
        {
          lane_id: report.laneId,
          turns: report.turns,
          tool_executions: report.toolExecutions,
          quiescent: report.quiescent,
          final_seq: report.finalSeq,
        },
        "leader lane woke",
      );
    })
    .orElse((error) => {
      if (error.tag === "WakeClaimConflict") {
        ctx.logger.info({ lane_id: args.laneId }, "lane already waking, doorbell skipped");
        return okAsync<void, ApiError>(undefined);
      }
      return errAsync<void, ApiError>({
        type: "leader_wake_failed",
        message: `wake(${args.laneId}) failed: ${error.tag}`,
      });
    });
}
