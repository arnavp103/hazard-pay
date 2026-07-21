import { appendFileSync } from "node:fs";

import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { ExportResultCode, hrTimeToMilliseconds } from "@opentelemetry/core";
import type { ExportResult } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

import { telemetryFile } from "../paths.ts";
import { redactDeep } from "../redact.ts";

const SPAN_KIND_NAMES: Record<SpanKind, string> = {
  [SpanKind.INTERNAL]: "internal",
  [SpanKind.SERVER]: "server",
  [SpanKind.CLIENT]: "client",
  [SpanKind.PRODUCER]: "producer",
  [SpanKind.CONSUMER]: "consumer",
};

const STATUS_NAMES: Record<SpanStatusCode, string> = {
  [SpanStatusCode.UNSET]: "unset",
  [SpanStatusCode.OK]: "ok",
  [SpanStatusCode.ERROR]: "error",
};

export interface FlatSpan {
  time: string;
  name: string;
  service: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  kind: string;
  status: string;
  status_message?: string;
  duration_ms: number;
  attrs?: Record<string, unknown>;
  events?: { time: string; name: string; attrs?: Record<string, unknown> }[];
}

export interface JsonlSpanExporterOptions {
  service: string;
  /** Redirect output away from `var/telemetry/` (tests). */
  telemetryDir?: string;
}

/**
 * The custom flattened-JSONL SpanExporter (ADR 0005 §1, §5): one flat JSON
 * span per line in `var/telemetry/<service>.spans.jsonl`. Flat rather than
 * OTLP's nested `resourceSpans[].scopeSpans[].spans[]` + attribute arrays,
 * which are hostile to grep/jq. Attributes pass the shared redaction
 * chokepoint before disk — a stray `setAttribute("password", ...)` dies here
 * exactly as it would at the logger (#22).
 */
export function createJsonlSpanExporter(options: JsonlSpanExporterOptions): SpanExporter {
  const file = telemetryFile(options.service, "spans", options.telemetryDir);
  return {
    export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
      try {
        const lines = spans
          .map((span) => `${JSON.stringify(flattenSpan(span, options.service))}\n`)
          .join("");
        appendFileSync(file, lines);
        resultCallback({ code: ExportResultCode.SUCCESS });
      } catch (error) {
        resultCallback({
          code: ExportResultCode.FAILED,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    },
    shutdown(): Promise<void> {
      return Promise.resolve();
    },
    forceFlush(): Promise<void> {
      return Promise.resolve();
    },
  };
}

export function flattenSpan(span: ReadableSpan, service: string): FlatSpan {
  const context = span.spanContext();
  const attrs = Object.keys(span.attributes).length > 0
    ? redactDeep({ ...span.attributes })
    : undefined;
  const events = span.events.length > 0
    ? span.events.map((event) => ({
        time: new Date(hrTimeToMilliseconds(event.time)).toISOString(),
        name: event.name,
        attrs: event.attributes && Object.keys(event.attributes).length > 0
          ? redactDeep({ ...event.attributes })
          : undefined,
      }))
    : undefined;
  return {
    time: new Date(hrTimeToMilliseconds(span.startTime)).toISOString(),
    name: span.name,
    service,
    trace_id: context.traceId,
    span_id: context.spanId,
    parent_span_id: span.parentSpanContext?.spanId,
    kind: SPAN_KIND_NAMES[span.kind],
    status: STATUS_NAMES[span.status.code],
    status_message: span.status.message,
    duration_ms: roundMs(hrTimeToMilliseconds(span.duration)),
    attrs,
    events,
  };
}

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}
