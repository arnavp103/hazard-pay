import { ORPCError } from "@orpc/server";
import type { Logger } from "@hazard-pay/observability";
import type { ResultAsync } from "neverthrow";

import type { ApiError } from "../domain/errors.ts";

/**
 * The Result → HTTP edge adapter (ADR 0002 §4). Route handlers are one-liners:
 * `respond(context.log, domainFn(ctx, args))`. This is the single mapping
 * table from tagged domain errors to HTTP — no status codes anywhere else —
 * and failures log through the request's pino child before translation.
 * `ORPCError` here is the sanctioned edge translation, not domain control
 * flow; anything else that throws below Fastify's `setErrorHandler` is a
 * defect.
 */
const HTTP_ERROR_FOR: Record<ApiError["type"], { code: string; status: number }> = {
  db_unreachable: { code: "SERVICE_UNAVAILABLE", status: 503 },
  lane_not_found: { code: "NOT_FOUND", status: 404 },
};

export function respond<T>(log: Logger, result: ResultAsync<T, ApiError>): Promise<T> {
  return result.match(
    (value) => value,
    (error) => {
      const mapped = HTTP_ERROR_FOR[error.type];
      log.warn({ error }, `request failed: ${error.type}`);
      throw new ORPCError(mapped.code, { status: mapped.status, message: error.message });
    },
  );
}
