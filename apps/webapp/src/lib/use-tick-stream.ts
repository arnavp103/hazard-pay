import { tickStreamEnvelopeSchema, type TickStreamEnvelope } from "@hazard-pay/api/contract";
import { emitEvent } from "@hazard-pay/observability/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type TickStreamStatus = "connecting" | "live" | "reconnecting";

export interface TickStreamState {
  status: TickStreamStatus;
  /** Received tick envelopes, newest first, capped at KEEP_TICKS. */
  ticks: TickStreamEnvelope[];
}

const KEEP_TICKS = 4;

/**
 * Backoff for app-level `EventSource` re-instantiation (#107): exponential,
 * capped, no jitter needed at this scale (one browser tab, one connection).
 * Exported as a pure function so the schedule is testable without touching
 * timers or a real `EventSource`.
 */
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;

export function reconnectBackoffMs(attempt: number): number {
  return Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
}

/**
 * The client half of the match-tier transport seam (ADR 0004 §2): ONE hook
 * over a native `EventSource`.
 *
 * Reconnect and `Last-Event-ID` resume for a *transient* drop are the
 * browser's own machinery: per the WHATWG spec, a network hiccup sets
 * `readyState` back to `CONNECTING` and the UA retries the same connection
 * on its own schedule, resending the `Last-Event-ID` it already remembers —
 * untouched here. But a non-200 response or the wrong `Content-Type` "fails
 * the connection": `readyState` goes `CLOSED` and the UA never retries on
 * its own (a 502 mid-deploy, say). Left alone, that is a permanently dark
 * tab with a hopeful-looking "reconnecting" status (#107). This hook
 * detects the `CLOSED` case and re-instantiates the `EventSource` itself,
 * with backoff, so status can never get stuck. `EventSource` cannot carry
 * custom headers, so a re-instantiated connection cannot resend the exact
 * `Last-Event-ID` of the dead one — it connects fresh, which the route
 * already treats as "prime to the newest tick" (ADR 0004 §5), the same
 * outcome a manual page reload gets today. The resume-cursor contract
 * itself (`Last-Event-ID`) is unchanged.
 *
 * Each arriving tick also invalidates the `["overworld"]` query tier — a
 * tick boundary is exactly when polled overworld state goes stale — and
 * emits the `tick.received` domain event with the envelope's traceparent
 * (ADR 0005 §6), joining the browser's telemetry to the server's tick trace.
 *
 * Swapping the transport for WebSocket later means reimplementing this
 * hook, nothing above it.
 */
export function useTickStream(): TickStreamState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TickStreamState>({ status: "connecting", ticks: [] });

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | undefined;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function scheduleReconnect(): void {
      if (retryTimer !== undefined) {
        return;
      }
      const delay = reconnectBackoffMs(attempt);
      attempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        if (!cancelled) {
          connect();
        }
      }, delay);
    }

    function connect(): void {
      source?.close();
      const next = new EventSource("/ticks/stream");
      source = next;
      next.onopen = () => {
        attempt = 0;
        setState((prev) => ({ ...prev, status: "live" }));
      };
      next.onerror = () => {
        if (cancelled) {
          return;
        }
        setState((prev) => ({ ...prev, status: "reconnecting" }));
        // CONNECTING: the browser is already retrying this same connection
        // on its own schedule — leave it alone. CLOSED: the UA has
        // permanently given up (spec "fail the connection"); nothing else
        // drives recovery, so we must.
        if (next.readyState === EventSource.CLOSED) {
          scheduleReconnect();
        }
      };
      next.addEventListener("tick", (message: MessageEvent<string>) => {
        const envelope = parseEnvelope(message.data);
        if (envelope === undefined) {
          return;
        }
        emitEvent("tick.received", {
          tick_id: envelope.tick.id,
          tick_number: envelope.tick.tickNumber,
          tick_traceparent: envelope.traceparent,
        });
        setState((prev) => ({
          status: "live",
          ticks: [envelope, ...prev.ticks].slice(0, KEEP_TICKS),
        }));
        void queryClient.invalidateQueries({ queryKey: ["overworld"] });
      });
    }

    connect();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
      }
      source?.close();
    };
  }, [queryClient]);

  return state;
}

function parseEnvelope(data: string): TickStreamEnvelope | undefined {
  try {
    const parsed = tickStreamEnvelopeSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
