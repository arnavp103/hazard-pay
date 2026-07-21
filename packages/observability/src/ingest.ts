import { appendFileSync } from "node:fs";

import { err, ok, type Result } from "neverthrow";

import { telemetryFile } from "./paths.ts";
import { redactDeep } from "./redact.ts";

/**
 * Server-side ingest for browser telemetry (ADR 0005 §6, §7). The api's
 * dev-only `POST /telemetry` route validates the wire contract
 * (`{ service, lines }`, `signal: "log" | "span"` per line) and hands the
 * lines here; this module is the only place they touch disk, so they pass
 * the same redaction chokepoint as every native emission path — the client
 * buffer redacts too, but it is untrusted input and is re-redacted here.
 *
 * Each line is routed by its `signal` discriminator (then stripped of it),
 * stamped with the ingest `service` (server-authoritative — a client-supplied
 * `service` field inside a line is overwritten), and appended to
 * `var/telemetry/<service>.jsonl` or `<service>.spans.jsonl`.
 */

export interface IngestTelemetryOptions {
  /** Redirect output away from `var/telemetry/` (tests). */
  telemetryDir?: string;
}

export interface IngestTelemetryReport {
  logs: number;
  spans: number;
  /** Lines without a valid `signal` discriminator, silently not written. */
  dropped: number;
}

export interface InvalidServiceError {
  type: "invalid_service";
  message: string;
}

/**
 * The service names a file on disk, so it must never be able to traverse
 * paths: lowercase alphanumerics and hyphens only, like `webapp`.
 */
const SERVICE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export function ingestTelemetryLines(
  service: string,
  lines: readonly Record<string, unknown>[],
  options: IngestTelemetryOptions = {},
): Result<IngestTelemetryReport, InvalidServiceError> {
  if (!SERVICE_NAME_PATTERN.test(service)) {
    return err({
      type: "invalid_service",
      message: "service must match ^[a-z][a-z0-9-]{0,63}$",
    });
  }
  const logs: string[] = [];
  const spans: string[] = [];
  let dropped = 0;
  for (const line of lines) {
    const { signal, ...rest } = line;
    if (signal !== "log" && signal !== "span") {
      dropped += 1;
      continue;
    }
    const redacted = redactDeep({ ...rest, service });
    const target = signal === "log" ? logs : spans;
    target.push(`${JSON.stringify(redacted)}\n`);
  }
  if (logs.length > 0) {
    appendFileSync(telemetryFile(service, "logs", options.telemetryDir), logs.join(""));
  }
  if (spans.length > 0) {
    appendFileSync(telemetryFile(service, "spans", options.telemetryDir), spans.join(""));
  }
  return ok({ logs: logs.length, spans: spans.length, dropped });
}
