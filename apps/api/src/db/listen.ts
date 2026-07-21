import type { Logger } from "@hazard-pay/observability";
import pg from "pg";

import { TICK_CHANNEL } from "./ticks.ts";

/**
 * The shared LISTEN nudge (ADR 0004 §5): ONE dedicated Postgres connection
 * per server process, fanned out in-memory to every subscribed SSE
 * connection. A nudge carries no data — subscribers re-query the tick table
 * from their own cursor, so a dropped notification (connection blip,
 * reconnect window) can only delay delivery until the 60s safety re-poll,
 * never lose it. That guarantee is why reconnection here is deliberately
 * dumb: log, wait, dial again.
 */
export interface TickListener {
  /** Attempt the initial connection. Failure schedules a retry, not a boot abort. */
  start: () => Promise<void>;
  /** Register a nudge callback; returns its unsubscribe. */
  subscribe: (onNudge: () => void) => () => void;
  close: () => Promise<void>;
}

const RECONNECT_DELAY_MS = 5_000;

export function createTickListener(connectionString: string, logger: Logger): TickListener {
  const subscribers = new Set<() => void>();
  let client: pg.Client | undefined;
  let retryTimer: NodeJS.Timeout | undefined;
  let closed = false;

  function scheduleReconnect(): void {
    client = undefined;
    if (closed || retryTimer !== undefined) {
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void connect();
    }, RECONNECT_DELAY_MS);
  }

  async function connect(): Promise<void> {
    if (closed) {
      return;
    }
    const next = new pg.Client({ connectionString });
    next.on("notification", () => {
      for (const notify of subscribers) {
        notify();
      }
    });
    next.on("error", (error: Error) => {
      logger.warn({ err: error }, "tick listener connection lost; reconnecting");
      void next.end().catch(() => undefined);
      scheduleReconnect();
    });
    try {
      await next.connect();
      // LISTEN takes no bind parameters; TICK_CHANNEL is our own constant.
      await next.query(`listen ${TICK_CHANNEL}`);
      client = next;
      logger.info({ channel: TICK_CHANNEL }, "tick listener connected");
    } catch (error) {
      logger.warn({ err: error }, "tick listener connect failed; retrying");
      void next.end().catch(() => undefined);
      scheduleReconnect();
    }
  }

  return {
    start: () => connect(),
    subscribe: (onNudge) => {
      subscribers.add(onNudge);
      return () => subscribers.delete(onNudge);
    },
    close: async () => {
      closed = true;
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      const current = client;
      client = undefined;
      await current?.end().catch(() => undefined);
    },
  };
}
