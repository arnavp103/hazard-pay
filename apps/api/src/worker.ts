import type { Logger } from "@hazard-pay/observability";
import { okAsync, type ResultAsync } from "neverthrow";

import { jobHandler } from "./adapters/job-handler.ts";
import type { AppCtx } from "./context.ts";
import type { ApiError } from "./domain/errors.ts";

/**
 * The worker half of the pre-cut process seam (ADR 0002 §3): pg-boss
 * registrations and, later, tick scheduling. It shares only the db and
 * observability handles with the server. Splitting it out is a second
 * entrypoint that calls `startWorker` alone — not a refactor.
 *
 * What lands here next: the overworld tick cron (#20, ADR 0004 §4 — eager,
 * idempotent on `(entity_id, tick_number)`), the per-`(match, phase)`
 * delayed resolution singletons (ADR 0004 §3), and ADR 0003's doorbell/
 * outbox agent jobs.
 */
export const HEARTBEAT_QUEUE = "worker.heartbeat";

/**
 * A real (if trivial) domain job function: the queue registration below is
 * the live demonstration of the `jobHandler` adapter shape every future job
 * follows.
 */
export function heartbeat(log: Logger): ResultAsync<void, ApiError> {
  log.info("worker heartbeat");
  return okAsync(undefined);
}

export async function startWorker(ctx: Pick<AppCtx, "boss" | "logger">): Promise<void> {
  ctx.boss.on("error", (error: Error) => ctx.logger.error({ err: error }, "pg-boss error"));
  await ctx.boss.start();
  await ctx.boss.createQueue(HEARTBEAT_QUEUE);
  await ctx.boss.work(HEARTBEAT_QUEUE, jobHandler(ctx.logger, (log) => heartbeat(log)));
  ctx.logger.info("worker started");
}

export async function stopWorker(ctx: Pick<AppCtx, "boss">): Promise<void> {
  await ctx.boss.stop();
}
