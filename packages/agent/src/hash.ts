import { createHash } from "node:crypto";

import type { JsonValue } from "./envelope.ts";

/**
 * Deterministic JSON serialization: object keys sorted recursively, arrays
 * in order. Content hashes (leader configs, request fingerprints) must not
 * depend on insertion order.
 */
export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] as JsonValue)}`);
  return `{${entries.join(",")}}`;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function contentHash(value: JsonValue): string {
  return sha256Hex(canonicalJson(value));
}
