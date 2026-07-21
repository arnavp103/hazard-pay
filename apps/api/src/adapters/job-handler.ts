import type { Logger } from "@hazard-pay/observability";
import type { ResultAsync } from "neverthrow";
import type { Job } from "pg-boss";

import type { ApiError } from "../domain/errors.ts";

/**
 * The Result → throw edge adapter (ADR 0002 §4), mirror of `respond`: domain
 * job functions keep the house shape — `fn(ctx, args)` returning
 * `ResultAsync<void, ApiError>`, never throwing — and this wrapper converts
 * an `err` into the throw pg-boss needs for its retry/DLQ semantics. It is
 * also the only place a per-job pino child is derived (ADR 0002 §6): the
 * ctx handed onward carries the child as `logger`, so the domain function
 * still just sees `ctx.logger`. A throw from the domain function itself is
 * a defect and propagates as-is.
 */
export function jobHandler<C extends { logger: Logger }, TData extends object>(
  ctx: C,
  run: (ctx: C, job: Job<TData>) => ResultAsync<void, ApiError>,
): (jobs: Job<TData>[]) => Promise<void> {
  return async (jobs) => {
    for (const job of jobs) {
      const jobCtx = { ...ctx, logger: ctx.logger.child({ job_id: job.id, job_name: job.name }) };
      const result = await run(jobCtx, job);
      if (result.isErr()) {
        const error = result.error;
        jobCtx.logger.error({ error }, `job failed: ${error.type}`);
        throw new Error(`${job.name} failed: ${error.type}: ${error.message}`);
      }
    }
  };
}
