/**
 * The telemetry facade (ADR 0005 §2): `@hazard-pay/observability` is the only
 * telemetry import anywhere — apps never import pino or `@opentelemetry/*`
 * directly, so SDK churn stays inside this package.
 *
 * Surface: `initObservability(service)` (OTel bootstrap for `node --import`,
 * exported from `@hazard-pay/observability/init` — see below), `createLogger`
 * (the only pino constructor, redacting), `withSpan` (Neverthrow-aware),
 * `emitEvent` (domain events). Browser code imports the same verbs from
 * `@hazard-pay/observability/browser`.
 *
 * `initObservability` deliberately lives on its own subpath rather than here:
 * this entry imports pino, and any module the bootstrap file loads before the
 * ESM loader hook registers escapes instrumentation. Importing the bootstrap
 * from `/init` keeps that mistake unrepresentable.
 */
export { createLogger } from "./logger.ts";
export type { CreateLoggerOptions } from "./logger.ts";
export { emitEvent } from "./events.ts";
export type { DomainEventAttributes } from "./events.ts";
export { withSpan } from "./span.ts";
export { ingestTelemetryLines } from "./ingest.ts";
export type {
  IngestTelemetryOptions,
  IngestTelemetryReport,
  InvalidServiceError,
} from "./ingest.ts";
export type { InitObservabilityOptions, ObservabilityHandle } from "./init.ts";

// Types apps need to talk about telemetry handles without importing the
// underlying libraries.
export type { Logger } from "pino";
export type { Attributes, Span } from "@opentelemetry/api";
