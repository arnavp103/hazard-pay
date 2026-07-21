import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  Button,
  ListRow,
  ListRowGroup,
  Panel,
  StatReadout,
  StatusChip,
  TraceChip,
} from "@hazard-pay/ui";

import { DevLoginPanel } from "../dev-login/panel.tsx";
import { apiClient } from "../lib/api.ts";
import { useTickStream, type TickStreamStatus } from "../lib/use-tick-stream.ts";

export const Route = createFileRoute("/")({
  component: OverworldScreen,
});

/**
 * Tick state is real (#20): the tick counter, next-tick countdown, and the
 * Uplink feed come from apps/api — the counter/countdown over the overworld
 * polling tier, the feed over the live SSE uplink. The rest of the snapshot
 * (credits, heat, crew, missions) is still canned until those systems exist.
 */
interface CannedOverworldSnapshot {
  credits: { value: string; delta: string };
  heat: number;
  crew: { label: string; pct: number };
  integrity: number;
  missions: {
    id: string;
    status: "running" | "blocked" | "closed";
    index: string;
    title: string;
    meta: string;
    trailing: string;
  }[];
}

const cannedSnapshot: CannedOverworldSnapshot = {
  credits: { value: "12,480", delta: "+340" },
  heat: 62,
  crew: { label: "4/6", pct: 66 },
  integrity: 87,
  missions: [
    { id: "LN-0F3A", status: "running", index: "01", title: "Extract the courier — Neon Row", meta: "lane LN-0F3A · wake 18 · VEX-7", trailing: "18 wakes" },
    { id: "LN-1B77", status: "blocked", index: "02", title: "Scout Kowloon interchange", meta: "lane LN-1B77 · awaiting tick", trailing: "held" },
    { id: "LN-2C05", status: "running", index: "03", title: "Fence the prototype rig", meta: "lane LN-2C05 · wake 4 · MOTH", trailing: "4 wakes" },
  ],
};

function fetchCannedSnapshot(): Promise<CannedOverworldSnapshot> {
  return Promise.resolve(cannedSnapshot);
}

const STREAM_STATUS_LABEL: Record<TickStreamStatus, string> = {
  connecting: "linking…",
  live: "live",
  reconnecting: "relinking…",
};

function OverworldScreen() {
  const { data } = useQuery({
    queryKey: ["overworld", "snapshot"],
    queryFn: fetchCannedSnapshot,
    // Overworld surfaces poll (stale-while-revalidate); the interval is a
    // per-surface decision, set at the query site.
    refetchInterval: 30_000,
  });

  // The overworld polling tier, for real (ADR 0004 §4): TanStack Query
  // stale-while-revalidate against the typed contract route. The tick
  // stream's invalidation of ["overworld"] refreshes this between polls.
  const { data: overworldTick } = useQuery({
    queryKey: ["overworld", "tick"],
    queryFn: () => apiClient.overworldTick(),
    refetchInterval: 15_000,
  });

  const uplink = useTickStream();

  if (data === undefined) {
    return (
      <main className="grid min-h-screen place-items-center">
        <span className="hp-blink font-data text-xs tracking-[0.2em] text-ink-dim uppercase">
          establishing link…
        </span>
      </main>
    );
  }

  const latestTick = overworldTick?.latestTick ?? null;

  return (
    <main className="hp-noise min-h-screen p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-7">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
              Hazard
              <span className="text-accent"> Pay</span>
            </h1>
            <p className="mt-1 font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
              /// district 7 · black channel
            </p>
          </div>
          <div className="flex items-center gap-4 font-data text-[10px] uppercase">
            <DevLoginPanel />
            <StatusChip tone={overworldTick === undefined ? "warn" : "acid"} stamped>
              {overworldTick === undefined ? "link …" : "link ok"}
            </StatusChip>
            <span className="text-ink-dim">
              next tick
              <span className="ml-2 font-bold text-ink tabular-nums">
                <NextTickCountdown
                  tickNumber={latestTick?.tickNumber ?? null}
                  intervalMs={overworldTick?.intervalMs ?? null}
                />
              </span>
            </span>
          </div>
        </header>

        <Panel
          title="Overworld"
          meta={latestTick === null ? "tick —" : `tick ${latestTick.tickNumber.toLocaleString("en-US")}`}
        >
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <StatReadout label="Credits" value={data.credits.value} unit="¤" delta={{ text: data.credits.delta, tone: "ok" }} />
            <StatReadout label="Heat" value={String(data.heat)} unit="%" meter={{ value: data.heat, tone: "warn", animated: true }} />
            <StatReadout label="Crew" value={data.crew.label} meter={{ value: data.crew.pct }} />
            <StatReadout label="Integrity" value={String(data.integrity)} unit="%" meter={{ value: data.integrity }} />
          </div>
        </Panel>

        <div className="grid gap-7 md:grid-cols-[1.4fr_1fr]">
          <Panel title="Active missions" meta={`${data.missions.length} lanes`} flush>
            <ListRowGroup>
              {data.missions.map((m) => (
                <ListRow
                  key={m.id}
                  status={m.status}
                  index={m.index}
                  title={m.title}
                  meta={m.meta}
                  trailing={m.trailing}
                />
              ))}
            </ListRowGroup>
          </Panel>

          <div className="flex flex-col gap-7">
            <Panel title="Decision phase" meta="phase 07" tone="magenta">
              <div className="flex flex-col gap-4">
                <div className="flex items-end justify-between">
                  <StatReadout label="Window" value="00:19" meter={{ value: 38, tone: "danger" }} />
                  <span className="font-data text-[10px] text-ink-dim uppercase">2/3 moves in</span>
                </div>
                <div className="flex flex-col gap-3">
                  <Button variant="primary">Queue move</Button>
                  <Button>View lane</Button>
                </div>
              </div>
            </Panel>

            <Panel title="Uplink" meta={STREAM_STATUS_LABEL[uplink.status]}>
              <div className="flex flex-col gap-2">
                {uplink.ticks.length === 0
                  ? (
                      <p className="hp-blink font-data text-[10px] text-ink-dim uppercase">
                        awaiting next tick on the live uplink…
                      </p>
                    )
                  : (
                      uplink.ticks.map((envelope) => (
                        <TraceChip
                          key={envelope.tick.id}
                          seq={String(envelope.tick.tickNumber).slice(-4).padStart(4, "0")}
                          kind="input"
                          summary={`tick ${envelope.tick.tickNumber} → overworld advanced`}
                          payload={JSON.stringify(envelope, null, 2)}
                        />
                      ))
                    )}
                <p className="font-data text-[10px] leading-relaxed text-ink-dim uppercase">
                  tick counter, countdown and this feed are live from apps/api —
                  credits, heat, crew and missions are still canned
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Counts down to the next tick's wall-clock boundary. Tick numbers are
 * `floor(time / interval)` (ADR 0004 §4), so the next tick is due at
 * `(tickNumber + 1) * intervalMs` — not `completedAt + interval`, which
 * would drift by the cron's firing delay. A tick landing resets this
 * through the polling query and the stream's invalidation; an overdue tick
 * pins at 00:00 until the next one arrives.
 */
function NextTickCountdown({
  tickNumber,
  intervalMs,
}: {
  tickNumber: number | null;
  intervalMs: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  if (tickNumber === null || intervalMs === null) {
    return <>--:--</>;
  }
  const dueAt = (tickNumber + 1) * intervalMs;
  const remaining = Math.max(0, dueAt - now);
  const totalSeconds = Math.floor(remaining / 1_000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return <>{`${minutes}:${seconds}`}</>;
}
