import type { DbUnreachableError } from "../domain/errors.ts";

/** The one place a thrown pg/drizzle failure becomes a tagged domain error. */
export function toDbUnreachable(cause: unknown): DbUnreachableError {
  return {
    type: "db_unreachable",
    message: cause instanceof Error ? cause.message : String(cause),
  };
}
