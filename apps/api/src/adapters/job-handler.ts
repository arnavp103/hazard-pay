import type { Logger } from "@hazard-pay/observability";
import type { ResultAsync } from "neverthrow";
import type { Job } from "pg-boss";

import type { ApiError } from "../domain/errors.ts";

/**
 * The Result → throw edge adapter (ADR 0002 §4), mirror of `respond`: domain
 * job functions return `ResultAsync<void, ApiError>` and never throw; this
 * wrapper derives the per-job pino child (ADR 0002 §6) and converts an `err`
 * into the throw pg-boss needs for its retry/DLQ semantics. A throw from the
 * domain function itself is a defect and propagates as-is.
 */
export function jobHandler<TData extends object>(
  logger: Logger,
  run: (log: Logger, job: Job<TData>) => ResultAsync<void, ApiError>,
): (jobs: Job<TData>[]) => Promise<void> {
  return async (jobs) => {
    for (const job of jobs) {
      const log = logger.child({ job_id: job.id, job_name: job.name });
      const result = await run(log, job);
      if (result.isErr()) {
        const error = result.error;
        log.error({ error }, `job failed: ${error.type}`);
        throw new Error(`${job.name} failed: ${error.type}: ${error.message}`);
      }
    }
  };
}
