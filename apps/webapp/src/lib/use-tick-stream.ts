import { tickStreamEnvelopeSchema, type TickStreamEnvelope } from "@hazard-pay/api/contract";
import { emitEvent } from "@hazard-pay/observability/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type TickStreamStatus = "connecting" | "live" | "reconnecting";

export interface TickStreamState {
  status: TickStreamStatus;
  /** Newest first, capped at KEEP_EVENTS. */
  events: TickStreamEnvelope[];
}

const KEEP_EVENTS = 4;

/**
 * The client half of the match-tier transport seam (ADR 0004 §2): ONE hook
 * over a native `EventSource` — reconnect and `Last-Event-ID` resume are the
 * browser's own machinery, not ours. Swapping the transport for WebSocket
 * later means reimplementing this hook, nothing above it.
 *
 * Each tick event also invalidates the `["overworld"]` query tier — a tick
 * boundary is exactly when polled overworld state goes stale — and emits
 * `tick.received` with the envelope's traceparent (ADR 0005 §6), joining the
 * browser's telemetry to the server's tick trace.
 */
export function useTickStream(): TickStreamState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TickStreamState>({ status: "connecting", events: [] });

  useEffect(() => {
    const source = new EventSource("/ticks/stream");
    source.onopen = () => setState((prev) => ({ ...prev, status: "live" }));
    source.onerror = () => setState((prev) => ({ ...prev, status: "reconnecting" }));
    source.addEventListener("tick", (message: MessageEvent<string>) => {
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
        events: [envelope, ...prev.events].slice(0, KEEP_EVENTS),
      }));
      void queryClient.invalidateQueries({ queryKey: ["overworld"] });
    });
    return () => source.close();
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
