import { okAsync, type ResultAsync } from "neverthrow";

import { jobHandler } from "./adapters/job-handler.ts";
import { wakeLeaderLane } from "./domain/leader-wake.ts";
import { runTick } from "./domain/tick.ts";
import {
  LEADER_DOORBELL_QUEUE,
  LEADER_DOORBELL_QUEUE_OPTIONS,
  leaderTickOutbox,
  setupLeaders,
} from "./leaders/wiring.ts";
import type { AppCtx } from "./context.ts";
import type { ApiError } from "./domain/errors.ts";

/**
 * The worker half of the pre-cut process seam (ADR 0002 §3): pg-boss
 * registrations, tick scheduling, and the leader doorbell (ADR 0003 §6).
 * It shares only the db and observability handles with the server.
 * Splitting it out is a second entrypoint that calls `startWorker` alone —
 * not a refactor.
 *
 * What lands here next: the per-`(match, phase)` delayed resolution
 * singletons (ADR 0004 §3).
 */
export const HEARTBEAT_QUEUE = "worker.heartbeat";

/** The overworld tick queue (ADR 0004 §4): cron-fired, backfilled, eager. */
export const TICK_QUEUE = "tick";

/**
 * A real (if trivial) domain job function in the house shape — `fn(ctx)`
 * with a narrowed ctx (ADR 0002 §5): the registration below is the live
 * demonstration of the `jobHandler` adapter every future job follows.
 * `ctx.logger` is the per-job child the adapter derived.
 */
export function heartbeat(ctx: Pick<AppCtx, "logger">): ResultAsync<void, ApiError> {
  ctx.logger.info("worker heartbeat");
  return okAsync(undefined);
}

/**
 * `TICK_INTERVAL` (ms) → pg-boss cron. Cron resolves whole minutes in
 * 1..59, so the expression is only the metronome: a sub-minute interval
 * fires every minute and an hour-plus interval fires every 59 minutes —
 * either way the idempotent backfill in `recordDueTicks` writes exactly the
 * tick numbers that are due, so cadence correctness never depends on cron
 * resolution (ADR 0004 §4).
 */
export function tickCron(intervalMs: number): string {
  const minutes = Math.min(59, Math.max(1, Math.floor(intervalMs / 60_000)));
  return `*/${minutes} * * * *`;
}

export async function startWorker(
  ctx: Pick<AppCtx, "boss" | "db" | "logger" | "env">,
): Promise<void> {
  ctx.boss.on("error", (error: Error) => ctx.logger.error({ err: error }, "pg-boss error"));
  await ctx.boss.start();
  await ctx.boss.createQueue(HEARTBEAT_QUEUE);
  await ctx.boss.work(
    HEARTBEAT_QUEUE,
    jobHandler({ logger: ctx.logger }, (jobCtx) => heartbeat(jobCtx)),
  );
  // Leader wiring (issue #52): key-gated at this edge. Undefined means a
  // keyless boot — ticks still run, no inputs are appended, no doorbells
  // ring (setupLeaders already logged why, once).
  const wiring = await setupLeaders(ctx);
  await ctx.boss.createQueue(LEADER_DOORBELL_QUEUE, LEADER_DOORBELL_QUEUE_OPTIONS);
  if (wiring !== undefined) {
    await ctx.boss.work<{ laneId: string }>(
      LEADER_DOORBELL_QUEUE,
      jobHandler({ logger: ctx.logger, runtime: wiring.runtime }, (jobCtx, job) =>
        wakeLeaderLane(jobCtx, job.data)),
    );
  }
  const tickOutbox = wiring === undefined
    ? undefined
    : leaderTickOutbox({ boss: ctx.boss, wiring });
  await ctx.boss.createQueue(TICK_QUEUE);
  await ctx.boss.work(
    TICK_QUEUE,
    jobHandler({ db: ctx.db, env: ctx.env, logger: ctx.logger }, (jobCtx) =>
      runTick({ ...jobCtx, tickOutbox })),
  );
  await ctx.boss.schedule(TICK_QUEUE, tickCron(ctx.env.TICK_INTERVAL));
  // Eager boot catch-up (ADR 0004 §4): don't wait out the first cron window —
  // a restart after downtime backfills immediately. Harmless when nothing is
  // due; the write path is idempotent.
  await ctx.boss.send(TICK_QUEUE, {});
  ctx.logger.info({ tick_cron: tickCron(ctx.env.TICK_INTERVAL) }, "worker started");
}

export async function stopWorker(ctx: Pick<AppCtx, "boss">): Promise<void> {
  await ctx.boss.stop();
}
