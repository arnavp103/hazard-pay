/**
 * The tagged-union error vocabulary for this app's functional core
 * (ADR 0002 §4). Domain functions return `ResultAsync<T, ApiError>`; nothing
 * below an edge adapter throws — a thrown exception is a defect, caught only
 * by Fastify's `setErrorHandler` net. Grow the union per feature; every new
 * variant needs a row in the `respond` adapter's mapping table.
 */
export interface DbUnreachableError {
  type: "db_unreachable";
  message: string;
}

export type ApiError = DbUnreachableError;
