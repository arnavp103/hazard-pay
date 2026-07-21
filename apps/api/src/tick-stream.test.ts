import { createTestDatabase } from "@hazard-pay/db/testing";
import env from "@hazard-pay/env";
import { createLogger } from "@hazard-pay/observability";
import { expect, test } from "vitest";

import { recordDueTicks } from "./db/index.ts";
import { buildServer } from "./server.ts";

/**
 * Honest integration tests for the match-tier transport (ADR 0004 §5): a
 * real server, a template-cloned database, a real LISTEN connection, and a
 * real streaming fetch — the NOTIFY → nudge → re-query → SSE frame path,
 * not a simulation of it.
 */
const MINUTE = 60_000;

interface StreamServer {
  baseUrl: string;
  db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  close: () => Promise<void>;
}

async function startStreamServer(): Promise<StreamServer> {
  const testDb = await createTestDatabase();
  const logger = createLogger("api-test", { level: "silent", mirrorToStdout: false });
  const app = await buildServer(
    { db: testDb.db, logger, env },
    { listenConnectionString: testDb.connectionString },
  );
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("server did not bind a port");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    db: testDb.db,
    close: async () => {
      await app.close();
      await testDb.drop();
    },
  };
}

interface SseEvent {
  id?: string;
  event?: string;
  data: string;
}

interface SseClient {
  next: (timeoutMs?: number) => Promise<SseEvent>;
  close: () => void;
}

/** A minimal EventSource stand-in over fetch, enough to read tick frames. */
async function connectStream(
  baseUrl: string,
  headers: Record<string, string> = {},
): Promise<SseClient> {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/ticks/stream`, { headers, signal: controller.signal });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  if (response.body === null) {
    throw new Error("stream response has no body");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const queue: SseEvent[] = [];
  const waiters: ((event: SseEvent) => void)[] = [];
  let buffer = "";
  void (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = parseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        if (frame === undefined) {
          continue;
        }
        const waiter = waiters.shift();
        if (waiter === undefined) {
          queue.push(frame);
        } else {
          waiter(frame);
        }
      }
    }
  })().catch(() => undefined);
  return {
    next: (timeoutMs = 5_000) =>
      new Promise<SseEvent>((resolve, reject) => {
        const queued = queue.shift();
        if (queued !== undefined) {
          resolve(queued);
          return;
        }
        const timer = setTimeout(
          () => reject(new Error("timed out waiting for an SSE event")),
          timeoutMs,
        );
        waiters.push((event) => {
          clearTimeout(timer);
          resolve(event);
        });
      }),
    close: () => controller.abort(),
  };
}

/** Comment-only frames (`:connected`, `:hb`) parse to undefined. */
function parseFrame(raw: string): SseEvent | undefined {
  const event: SseEvent = { data: "" };
  let sawData = false;
  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) {
      continue;
    }
    const separator = line.indexOf(": ");
    if (separator === -1) {
      continue;
    }
    const field = line.slice(0, separator);
    const value = line.slice(separator + 2);
    if (field === "id") {
      event.id = value;
    } else if (field === "event") {
      event.event = value;
    } else if (field === "data") {
      event.data = sawData ? `${event.data}\n${value}` : value;
      sawData = true;
    }
  }
  return sawData ? event : undefined;
}

test("a recorded tick reaches a connected SSE client through NOTIFY", async () => {
  const server = await startStreamServer();
  const stream = await connectStream(server.baseUrl);
  try {
    const recorded = await recordDueTicks(server.db, { now: new Date(), intervalMs: MINUTE });
    const row = recorded._unsafeUnwrap()[0];
    if (row === undefined) {
      throw new Error("no tick recorded");
    }

    const received = await stream.next();
    expect(received.event).toBe("tick");
    expect(received.id).toBe(String(row.id));
    expect(JSON.parse(received.data)).toEqual({
      tick: {
        id: row.id,
        tickNumber: row.tickNumber,
        completedAt: row.completedAt.toISOString(),
      },
      traceparent: null,
    });
  } finally {
    stream.close();
    await server.close();
  }
});

test("Last-Event-ID resumes exactly after the cursor", async () => {
  const server = await startStreamServer();
  let stream: SseClient | undefined;
  try {
    const t0 = new Date("2026-07-21T12:00:30Z");
    const first = (await recordDueTicks(server.db, { now: t0, intervalMs: MINUTE }))
      ._unsafeUnwrap();
    const rest = (
      await recordDueTicks(server.db, {
        now: new Date(t0.getTime() + 2 * MINUTE),
        intervalMs: MINUTE,
      })
    )._unsafeUnwrap();
    expect(rest).toHaveLength(2);

    stream = await connectStream(server.baseUrl, {
      "last-event-id": String(first[0]?.id),
    });
    const replayedIds = [(await stream.next()).id, (await stream.next()).id];
    expect(replayedIds).toEqual(rest.map((row) => String(row.id)));
  } finally {
    stream?.close();
    await server.close();
  }
});

test("a fresh connection is primed with the newest tick only", async () => {
  const server = await startStreamServer();
  let stream: SseClient | undefined;
  try {
    const t0 = new Date("2026-07-21T12:00:30Z");
    await recordDueTicks(server.db, { now: t0, intervalMs: MINUTE });
    const latest = (
      await recordDueTicks(server.db, {
        now: new Date(t0.getTime() + 2 * MINUTE),
        intervalMs: MINUTE,
      })
    )._unsafeUnwrap();

    stream = await connectStream(server.baseUrl);
    const primed = await stream.next();
    expect(primed.id).toBe(String(latest.at(-1)?.id));
  } finally {
    stream?.close();
    await server.close();
  }
});

test("GET /overworld/tick serves the latest tick and the interval", async () => {
  const server = await startStreamServer();
  try {
    const empty = await fetch(`${server.baseUrl}/overworld/tick`);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ latestTick: null, intervalMs: env.TICK_INTERVAL });

    const recorded = await recordDueTicks(server.db, { now: new Date(), intervalMs: MINUTE });
    const row = recorded._unsafeUnwrap()[0];

    const response = await fetch(`${server.baseUrl}/overworld/tick`);
    expect(await response.json()).toEqual({
      latestTick: {
        id: row?.id,
        tickNumber: row?.tickNumber,
        completedAt: row?.completedAt.toISOString(),
      },
      intervalMs: env.TICK_INTERVAL,
    });
  } finally {
    await server.close();
  }
});
