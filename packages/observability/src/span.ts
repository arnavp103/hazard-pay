import { isSpanContextValid, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Attributes, Span } from "@opentelemetry/api";
import { ResultAsync } from "neverthrow";

import { describeError } from "./error-description.ts";

const TRACER_NAME = "@hazard-pay/observability";

/**
 * Run `fn` inside an active span, Neverthrow-aware (ADR 0005 §2): an `err()`
 * result marks the span status ERROR — with the error's tag as the status
 * message — without a throw, and passes through unchanged. A thrown exception
 * is a defect (ADR 0002 §4): it is recorded on the span and rethrown.
 *
 * Without the OTel SDK initialized (tests, scripts) the tracer is a no-op and
 * `withSpan` is pure pass-through — tests never load the bootstrap.
 */
/**
 * The W3C `traceparent` for a span, for propagation beyond process
 * boundaries the SDK cannot cross by itself — fetch headers and the
 * match-transport message envelope (ADR 0005 §6). Returns `undefined` when
 * the span context is invalid (no-op tracer: tests, un-bootstrapped
 * scripts), so callers can store "no trace" honestly instead of a
 * zero-filled header.
 */
export function traceparentOf(span: Span): string | undefined {
  const context = span.spanContext();
  if (!isSpanContextValid(context)) {
    return undefined;
  }
  const flags = context.traceFlags.toString(16).padStart(2, "0");
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}

export function withSpan<T, E>(
  name: string,
  fn: (span: Span) => ResultAsync<T, E>,
  attributes?: Attributes,
): ResultAsync<T, E> {
  const tracer = trace.getTracer(TRACER_NAME);
  return new ResultAsync(
    tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const result = await fn(span);
        if (result.isErr()) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: describeError(result.error) });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        return result;
      } catch (defect) {
        span.recordException(defect instanceof Error ? defect : new Error(String(defect)));
        span.setStatus({ code: SpanStatusCode.ERROR, message: "defect" });
        throw defect;
      } finally {
        span.end();
      }
    }),
  );
}
