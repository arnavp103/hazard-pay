/**
 * A short, safe, human-readable description of a Neverthrow `err()` value for
 * span status messages. Tagged-union errors (ADR 0002 §4) surface their tag;
 * anything else degrades to a generic label rather than risking secrets in a
 * free-form serialization. Isomorphic — shared by the Node and browser
 * `withSpan` implementations.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === "object" && error !== null) {
    const candidate = error as Record<string, unknown>;
    for (const key of ["type", "tag", "_tag", "kind", "code"]) {
      const value = candidate[key];
      if (typeof value === "string") {
        return value;
      }
    }
  }
  if (typeof error === "string") {
    return error;
  }
  return "error";
}
