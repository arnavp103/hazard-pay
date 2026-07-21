/**
 * The single redaction chokepoint (#22). Every emission path — logger lines,
 * span attributes, domain-event attributes, browser ingest — passes through
 * this module before reaching disk. Both sinks (the pino logger factory and
 * the JSONL span exporter) import from here; nothing else in the repo may
 * implement redaction. The module is isomorphic: no Node imports, so the
 * `/browser` entry shares it for client-side defense in depth.
 */

export const REDACTED = "[REDACTED]";

/**
 * Key-name pattern for secret-shaped keys. Substring match, case-insensitive:
 * over-redaction is the safe failure mode for dev telemetry, so `authToken`,
 * `dbPassword`, `x-api-key`, and `stripeSecretKey` all match.
 */
const SECRET_KEY_PATTERN
  = /password|passwd|secret|token|api[-_]?key|authorization|cookie|session[-_]?id|credential|private[-_]?key/i;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

/**
 * pino `redact` paths for the known HTTP shapes produced by fastify's req/res
 * serializers. These are enforced at serialization time, covering objects
 * (like child-logger bindings) that bypass the deep pattern pass. The deep
 * pass (`redactDeep`) remains the authoritative pattern-based net.
 */
export const pinoRedactPaths: string[] = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers[\"set-cookie\"]",
  "headers.authorization",
  "headers.cookie",
];

/**
 * Deep, pattern-based redaction: returns a copy of `value` in which every
 * property whose key matches the secret pattern — at any depth, in objects or
 * arrays — is replaced with `[REDACTED]`. Non-plain objects (Error, Date,
 * class instances) pass through untouched; circular references collapse to
 * "[Circular]".
 */
export function redactDeep<T>(value: T): T {
  return redactValue(value, new WeakSet()) as T;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, seen));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = isSecretKey(key) ? REDACTED : redactValue(entry, seen);
  }
  return out;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
