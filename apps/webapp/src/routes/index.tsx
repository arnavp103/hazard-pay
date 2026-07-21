import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  Button,
  ListRow,
  ListRowGroup,
  Panel,
  StatReadout,
  StatusChip,
  TraceChip,
} from "@hazard-pay/ui";

export const Route = createFileRoute("/")({
  component: OverworldScreen,
});

/**
 * Placeholder overworld snapshot. There is no api yet (apps/api lands
 * separately) — this local queryFn exists to exercise the real data path
 * the overworld will use: TanStack Query stale-while-revalidate, keyed
 * per surface, resolved asynchronously.
 */
interface OverworldSnapshot {
  tick: number;
  nextTickIn: string;
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

const snapshot: OverworldSnapshot = {
  tick: 1024,
  nextTickIn: "00:12:36",
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

function fetchOverworldSnapshot(): Promise<OverworldSnapshot> {
  return Promise.resolve(snapshot);
}

function OverworldScreen() {
  const { data } = useQuery({
    queryKey: ["overworld", "snapshot"],
    queryFn: fetchOverworldSnapshot,
  });

  if (data === undefined) {
    return (
      <main className="grid min-h-screen place-items-center">
        <span className="hp-blink font-data text-xs tracking-[0.2em] text-ink-dim uppercase">
          establishing link…
        </span>
      </main>
    );
  }

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
            <StatusChip tone="acid" stamped>link ok</StatusChip>
            <span className="text-ink-dim">
              next tick
              <span className="ml-2 font-bold text-ink tabular-nums">{data.nextTickIn}</span>
            </span>
          </div>
        </header>

        <Panel title="Overworld" meta={`tick ${data.tick.toLocaleString("en-US")}`}>
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

            <Panel title="Uplink" meta="placeholder">
              <div className="flex flex-col gap-2">
                <TraceChip seq="0141" kind="tool_result" summary="scout_district → 2 patrols, heat +4" />
                <p className="font-data text-[10px] leading-relaxed text-ink-dim uppercase">
                  canned snapshot — real overworld polling lands with apps/api
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
