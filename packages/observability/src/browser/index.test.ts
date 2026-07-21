import { errAsync, okAsync } from "neverthrow";
import { afterEach, describe, expect, it, vi } from "vitest";

import { REDACTED } from "../redact.ts";
import {
  createLogger,
  currentTraceparent,
  emitEvent,
  initObservability,
  resetBrowserObservabilityForTests,
  withSpan,
} from "./index.ts";

interface Payload {
  service: string;
  lines: Record<string, unknown>[];
}

function fetchSpy(status = 204) {
  return vi.fn(
    async (_input: string | URL | Request, _init?: RequestInit) => new Response(null, { status }),
  );
}

function sentPayloads(spy: ReturnType<typeof fetchSpy>): Payload[] {
  return spy.mock.calls.map(([, init]) => JSON.parse(init?.body as string) as Payload);
}

function init(spy: ReturnType<typeof fetchSpy>) {
  return initObservability("webapp", {
    fetchFn: spy as unknown as typeof fetch,
    consoleMirror: false,
    flushIntervalMs: 60_000,
  });
}

afterEach(() => {
  resetBrowserObservabilityForTests();
});

describe("browser entry", () => {
  it("buffers log lines and flushes them to the ingest route", async () => {
    const spy = fetchSpy();
    const handle = init(spy);
    createLogger("match").info({ matchId: "m1" }, "render started");
    await handle.flush();
    expect(spy).toHaveBeenCalledWith("/telemetry", expect.objectContaining({ method: "POST" }));
    const [payload] = sentPayloads(spy);
    expect(payload?.service).toBe("webapp");
    expect(payload?.lines[0]).toMatchObject({
      signal: "log",
      level: 30,
      scope: "match",
      msg: "render started",
      matchId: "m1",
    });
  });

  it("redacts secret-shaped keys client-side before buffering", async () => {
    const spy = fetchSpy();
    const handle = init(spy);
    createLogger().info({ sessionToken: "s3cret" }, "authed");
    emitEvent("player.authenticated", { password: "hunter2" });
    await handle.flush();
    const body = JSON.stringify(sentPayloads(spy));
    expect(body).not.toContain("s3cret");
    expect(body).not.toContain("hunter2");
    expect(body).toContain(REDACTED);
  });

  it("emits domain events as log lines with an event field", async () => {
    const spy = fetchSpy();
    const handle = init(spy);
    emitEvent("match.completed", { matchId: "m1" });
    await handle.flush();
    const [payload] = sentPayloads(spy);
    expect(payload?.lines[0]).toMatchObject({
      signal: "log",
      event: "match.completed",
      matchId: "m1",
    });
  });

  it("records spans with W3C ids, status, and parent linkage", async () => {
    const spy = fetchSpy();
    const handle = init(spy);
    let innerTraceparent: string | undefined;
    await withSpan("load-match", (outer) =>
      withSpan("fetch-state", () => {
        innerTraceparent = currentTraceparent();
        return okAsync(1);
      }).map((value) => {
        expect(outer.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
        return value;
      }));
    await handle.flush();
    const [payload] = sentPayloads(spy);
    const spans = payload?.lines.filter((line) => line.signal === "span") ?? [];
    expect(spans).toHaveLength(2);
    const inner = spans[0];
    const outer = spans[1];
    expect(inner?.trace_id).toBe(outer?.trace_id);
    expect(inner?.parent_span_id).toBe(outer?.span_id);
    expect(innerTraceparent).toBe(`00-${String(inner?.trace_id)}-${String(inner?.span_id)}-01`);
    expect(outer?.status).toBe("ok");
    expect(typeof outer?.duration_ms).toBe("number");
  });

  it("marks err results as error spans without throwing", async () => {
    const spy = fetchSpy();
    const handle = init(spy);
    const result = await withSpan("submit-move", () => errAsync({ type: "WindowClosed" }));
    expect(result.isErr()).toBe(true);
    await handle.flush();
    const [payload] = sentPayloads(spy);
    expect(payload?.lines[0]).toMatchObject({
      signal: "span",
      status: "error",
      status_message: "WindowClosed",
    });
  });

  it("requeues lines when the flush fails", async () => {
    const failing = vi.fn(async () => new Response(null, { status: 500 }));
    const handle = initObservability("webapp", {
      fetchFn: failing as unknown as typeof fetch,
      consoleMirror: false,
      flushIntervalMs: 60_000,
    });
    createLogger().info("kept");
    await handle.flush();
    expect(failing).toHaveBeenCalledTimes(1);

    // Re-init keeps the buffer; the requeued line goes out on the next flush.
    const spy = fetchSpy();
    const handle2 = init(spy);
    await handle2.flush();
    const [payload] = sentPayloads(spy);
    expect(payload?.lines).toHaveLength(1);
    expect(payload?.lines[0]).toMatchObject({ msg: "kept" });
  });

  it("drops the oldest lines beyond maxBufferedLines", async () => {
    const spy = fetchSpy();
    const handle = initObservability("webapp", {
      fetchFn: spy as unknown as typeof fetch,
      consoleMirror: false,
      flushIntervalMs: 60_000,
      maxBufferedLines: 3,
    });
    const logger = createLogger();
    for (let index = 0; index < 6; index += 1) {
      logger.info({ index }, "line");
    }
    await handle.flush();
    const [payload] = sentPayloads(spy);
    expect(payload?.lines).toHaveLength(3);
    expect(payload?.lines[0]).toMatchObject({ index: 3 });
  });

  it("stays inert when enabled is false (production pages)", async () => {
    const spy = fetchSpy();
    const handle = initObservability("webapp", {
      fetchFn: spy as unknown as typeof fetch,
      consoleMirror: false,
      flushIntervalMs: 60_000,
      enabled: false,
    });
    createLogger().info("dropped");
    await handle.flush();
    expect(spy).not.toHaveBeenCalled();
  });

  it("disables itself for good when the ingest route answers 404", async () => {
    const spy = fetchSpy(404);
    const handle = init(spy);
    createLogger().info("first");
    await handle.flush();
    expect(spy).toHaveBeenCalledTimes(1);
    createLogger().info("after-404");
    await handle.flush();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("flushes once more on shutdown and stops afterwards", async () => {
    const spy = fetchSpy();
    const handle = init(spy);
    createLogger().info("last words");
    await handle.shutdown();
    expect(sentPayloads(spy)[0]?.lines[0]).toMatchObject({ msg: "last words" });
  });
});
