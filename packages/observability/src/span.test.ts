import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { errAsync, okAsync } from "neverthrow";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { withSpan } from "./span.ts";

// An in-memory tracer provider — real spans, no NodeSDK, no bootstrap, no
// auto-instrumentation. Tests never load the OTel bootstrap (ADR 0005 §6).
const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});

beforeAll(() => {
  trace.setGlobalTracerProvider(provider);
});

afterAll(() => {
  trace.disable();
});

beforeEach(() => {
  exporter.reset();
});

describe("withSpan", () => {
  it("passes an ok result through and marks the span OK", async () => {
    const result = await withSpan("resolve-phase", () => okAsync(42));
    expect(result._unsafeUnwrap()).toBe(42);
    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe("resolve-phase");
    expect(span?.status.code).toBe(SpanStatusCode.OK);
  });

  it("passes an err result through without throwing and marks the span ERROR", async () => {
    const result = await withSpan("resolve-phase", () =>
      errAsync({ type: "MatchNotFound", matchId: "m1" }));
    expect(result._unsafeUnwrapErr()).toEqual({ type: "MatchNotFound", matchId: "m1" });
    const [span] = exporter.getFinishedSpans();
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.status.message).toBe("MatchNotFound");
  });

  it("records a thrown exception as a defect and rethrows", async () => {
    const defect = new Error("boom");
    await expect(
      withSpan("resolve-phase", () => {
        throw defect;
      }),
    ).rejects.toThrow("boom");
    const [span] = exporter.getFinishedSpans();
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.events.some((event) => event.name === "exception")).toBe(true);
  });

  it("attaches attributes and exposes the span to fn", async () => {
    await withSpan(
      "resolve-phase",
      (span) => {
        span.setAttribute("phase", 3);
        return okAsync(null);
      },
      { matchId: "m1" },
    );
    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes).toMatchObject({ matchId: "m1", phase: 3 });
  });
});
