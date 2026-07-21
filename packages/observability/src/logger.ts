import env from "@hazard-pay/env";
import pino from "pino";
import type { DestinationStream, LevelWithSilent, Logger } from "pino";

import { telemetryFile } from "./paths.ts";
import { pinoRedactPaths, REDACTED, redactDeep } from "./redact.ts";
import { registerRootLogger } from "./root-logger.ts";

export interface CreateLoggerOptions {
  /** Defaults to `LOG_LEVEL` from `@hazard-pay/env`. */
  level?: LevelWithSilent;
  /** Redirect output away from `var/telemetry/` (tests). */
  telemetryDir?: string;
  /** Full stream override (tests); wins over `telemetryDir`. */
  destination?: DestinationStream;
  /** Mirror raw JSONL to stdout. Defaults to `NODE_ENV === "development"`. */
  mirrorToStdout?: boolean;
}

/**
 * The only place in the repo a pino instance is constructed (ADR 0002 §6,
 * #22). Lines land in `var/telemetry/<service>.jsonl`; every line passes the
 * shared redaction chokepoint twice — `redactDeep` on merge objects and
 * bindings, pino `redact` paths on the serialized HTTP shapes.
 *
 * Call it once per process at boot; the first instance becomes the root
 * logger that `emitEvent` writes through. Derive request/job-scoped children
 * at the edges with `logger.child(...)` — never construct another root.
 */
export function createLogger(service: string, options: CreateLoggerOptions = {}): Logger {
  const logger = pino(
    {
      level: options.level ?? env.LOG_LEVEL,
      base: { service },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: { paths: pinoRedactPaths, censor: REDACTED },
      formatters: {
        log: (record) => redactDeep(record),
        bindings: (bindings) => redactDeep(bindings),
      },
    },
    options.destination ?? buildDestination(service, options),
  );
  registerRootLogger(logger);
  return logger;
}

function buildDestination(service: string, options: CreateLoggerOptions): DestinationStream {
  const file = pino.destination({
    dest: telemetryFile(service, "logs", options.telemetryDir),
    sync: true,
  });
  const mirror = options.mirrorToStdout ?? env.NODE_ENV === "development";
  if (!mirror) {
    return file;
  }
  return pino.multistream([
    { stream: file, level: "trace" },
    { stream: process.stdout, level: "trace" },
  ]);
}
