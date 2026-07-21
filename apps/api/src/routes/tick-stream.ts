import type { TickStreamEnvelope } from "../contract/index.ts";
import type { AppCtx } from "../context.ts";
import type { TickListener } from "../db/listen.ts";
import { latestTick, ticksAfter, type TickRow } from "../db/index.ts";
import type { ApiServer } from "../server.ts";

/**
 * The match-tier transport, hello-world edition (ADR 0004 §2, §5): a one-way
 * SSE stream of tick events. The table is the truth — every frame comes from
 * re-querying the tick table after this connection's cursor; the shared
 * LISTEN nudge and the safety re-poll only decide *when* to look. Connect,
 * reconnect (`EventSource` sends `Last-Event-ID`), and live-tail are all the
 * same query, so there is nothing to resume beyond a cursor.
 *
 * This module is the thin server half of the transport seam — swappable for
 * WebSocket later without touching contract routes.
 */
const SAFETY_REPOLL_MS = 60_000;

export function registerTickStreamRoute(
  app: ApiServer,
  ctx: Pick<AppCtx, "db">,
  listener: TickListener,
): void {
  app.get("/ticks/stream", async (request, reply) => {
    // A fresh EventSource has no Last-Event-ID header; start it one before
    // the newest tick so the display populates immediately. A reconnecting
    // one resumes exactly after what it saw.
    const resumeFrom = parseLastEventId(request.headers["last-event-id"]);
    let cursor: number;
    if (resumeFrom === undefined) {
      const newest = await latestTick(ctx.db);
      cursor = newest.match(
        (row) => (row === null ? 0 : row.id - 1),
        () => 0,
      );
    } else {
      cursor = resumeFrom;
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
      // Tell buffering reverse proxies (nginx) to pass frames through.
      "x-accel-buffering": "no",
    });
    reply.raw.write(":connected\n\n");

    // One pump at a time per connection; a nudge landing mid-pump queues
    // exactly one follow-up pass, so no tick between query and write is lost.
    let pumping = false;
    let nudgedWhilePumping = false;
    const pump = async (): Promise<void> => {
      if (pumping) {
        nudgedWhilePumping = true;
        return;
      }
      pumping = true;
      try {
        do {
          nudgedWhilePumping = false;
          const result = await ticksAfter(ctx.db, cursor);
          if (result.isErr()) {
            // Transient db failure: keep the stream open — the next nudge or
            // safety re-poll retries from the same cursor.
            request.log.warn({ error: result.error }, "tick stream re-query failed");
            break;
          }
          for (const row of result.value) {
            reply.raw.write(frame(row));
            cursor = row.id;
          }
        } while (nudgedWhilePumping);
      } finally {
        pumping = false;
      }
    };

    const unsubscribe = listener.subscribe(() => void pump());
    const repoll = setInterval(() => {
      // Comment frame doubles as a keep-alive through idle proxies.
      reply.raw.write(":hb\n\n");
      void pump();
    }, SAFETY_REPOLL_MS);

    request.raw.on("close", () => {
      clearInterval(repoll);
      unsubscribe();
      reply.raw.end();
    });

    await pump();
  });
}

function frame(row: TickRow): string {
  // The transport message envelope (ADR 0005 §6): the tick snapshot plus the
  // ticking span's traceparent, so one trace spans tick → transport → render.
  const envelope: TickStreamEnvelope = {
    tick: {
      id: row.id,
      tickNumber: row.tickNumber,
      completedAt: row.completedAt.toISOString(),
    },
    traceparent: row.traceparent,
  };
  return `id: ${row.id}\nevent: tick\ndata: ${JSON.stringify(envelope)}\n\n`;
}

function parseLastEventId(header: string | string[] | undefined): number | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined || !/^\d+$/.test(value)) {
    return undefined;
  }
  return Number(value);
}
