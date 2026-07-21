import type { ResultAsync } from "neverthrow";

import type { HealthReport } from "../contract/index.ts";
import type { AppCtx } from "../context.ts";
import { pingDb } from "../db/index.ts";
import type { ApiError } from "./errors.ts";

/**
 * Functional-core health check (ADR 0002 §4): proves a real db round-trip
 * (#15) and returns a Result — the `respond` adapter owns the translation
 * to HTTP.
 */
export function checkHealth(ctx: Pick<AppCtx, "db">): ResultAsync<HealthReport, ApiError> {
  return pingDb(ctx.db).map(() => ({
    status: "ok" as const,
    database: "reachable" as const,
  }));
}
