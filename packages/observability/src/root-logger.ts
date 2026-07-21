import type { Logger } from "pino";

/**
 * The process's root logger (ADR 0002 §6: root at boot, children at the
 * edges). The first `createLogger` call registers it; `emitEvent`'s default
 * JSONL subscriber writes through it so domain events land in the same
 * `<service>.jsonl` as execution logs.
 */
let rootLogger: Logger | undefined;

export function registerRootLogger(logger: Logger): void {
  rootLogger ??= logger;
}

export function getRootLogger(): Logger | undefined {
  return rootLogger;
}

/** Test seam only — not exported from the facade. */
export function resetRootLoggerForTests(): void {
  rootLogger = undefined;
}
