import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { ExportResultCode } from "@opentelemetry/core";
import type { ExportResult } from "@opentelemetry/core";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { describe, expect, it } from "vitest";

import { REDACTED } from "../redact.ts";
import { createJsonlSpanExporter, flattenSpan } from "./jsonl-span-exporter.ts";

const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const SPAN_ID = "b7ad6b7169203331";
const PARENT_SPAN_ID = "00f067aa0ba902b7";

function fakeSpan(overrides: Partial<Record<string, unknown>> = {}): ReadableSpan {
  return {
    name: "pg.query",
    kind: SpanKind.CLIENT,
    spanContext: () => ({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 1 }),
    parentSpanContext: { traceId: TRACE_ID, spanId: PARENT_SPAN_ID, traceFlags: 1 },
    startTime: [1752000000, 0],
    endTime: [1752000000, 5_000_000],
    duration: [0, 5_000_000],
    status: { code: SpanStatusCode.UNSET },
    attributes: { "db.system": "postgresql" },
    events: [],
    links: [],
    resource: { attributes: {} },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    ended: true,
    ...overrides,
  } as unknown as ReadableSpan;
}

describe("flattenSpan", () => {
  it("flattens a span to one grep-friendly object with OTel field names", () => {
    const flat = flattenSpan(fakeSpan(), "api");
    expect(flat).toMatchObject({
      name: "pg.query",
      service: "api",
      trace_id: TRACE_ID,
      span_id: SPAN_ID,
      parent_span_id: PARENT_SPAN_ID,
      kind: "client",
      status: "unset",
      duration_ms: 5,
      attrs: { "db.system": "postgresql" },
    });
    expect(flat.time).toBe(new Date(1752000000000).toISOString());
  });

  it("maps error status and message", () => {
    const flat = flattenSpan(
      fakeSpan({ status: { code: SpanStatusCode.ERROR, message: "MatchNotFound" } }),
      "api",
    );
    expect(flat.status).toBe("error");
    expect(flat.status_message).toBe("MatchNotFound");
  });
});

describe("createJsonlSpanExporter", () => {
  it("appends flattened JSONL to <dir>/<service>.spans.jsonl", () => {
    const dir = mkdtempSync(join(tmpdir(), "hazard-pay-obs-"));
    const exporter = createJsonlSpanExporter({ service: "api", telemetryDir: dir });
    const results: ExportResult[] = [];
    exporter.export([fakeSpan(), fakeSpan({ name: "GET" })], (result) => results.push(result));
    expect(results[0]?.code).toBe(ExportResultCode.SUCCESS);
    const lines = readFileSync(join(dir, "api.spans.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const parsed = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
    expect(parsed.trace_id).toBe(TRACE_ID);
  });

  it("redacts secret-shaped attribute keys (the span sink, #22)", () => {
    const dir = mkdtempSync(join(tmpdir(), "hazard-pay-obs-"));
    const exporter = createJsonlSpanExporter({ service: "api", telemetryDir: dir });
    const span = fakeSpan({
      attributes: {
        "db.system": "postgresql",
        "password": "hunter2",
        "http.request.header.authorization": "Bearer abc",
      },
    });
    exporter.export([span], () => undefined);
    const raw = readFileSync(join(dir, "api.spans.jsonl"), "utf8");
    expect(raw).not.toContain("hunter2");
    expect(raw).not.toContain("Bearer abc");
    const parsed = JSON.parse(raw.trim()) as { attrs: Record<string, unknown> };
    expect(parsed.attrs.password).toBe(REDACTED);
    expect(parsed.attrs["http.request.header.authorization"]).toBe(REDACTED);
    expect(parsed.attrs["db.system"]).toBe("postgresql");
  });
});
