import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  Button,
  ListRow,
  ListRowGroup,
  Panel,
  StatReadout,
  StatusChip,
} from "@hazard-pay/ui";

export const Route = createFileRoute("/")({
  component: AdminScreen,
});

/**
 * Placeholder admin snapshot. There is no api yet (apps/api lands
 * separately) — this local queryFn exists to exercise the real data path
 * this console will use once it does: TanStack Query stale-while-revalidate,
 * keyed per surface, resolved asynchronously. Same pattern as
 * apps/webapp's overworld hello screen.
 */
interface AdminSnapshot {
  tick: number;
  leaders: {
    id: string;
    name: string;
    model: string;
    foregroundWakes: number;
  }[];
  lanes: {
    id: string;
    status: "running" | "blocked" | "closed";
    index: string;
    title: string;
    meta: string;
    trailing: string;
  }[];
}

const snapshot: AdminSnapshot = {
  tick: 1024,
  leaders: [
    { id: "VEX-7", name: "Vex", model: "claude-sonnet", foregroundWakes: 214 },
    { id: "MOTH", name: "Moth", model: "claude-sonnet", foregroundWakes: 88 },
    { id: "KESTREL", name: "Kestrel", model: "claude-haiku", foregroundWakes: 341 },
  ],
  lanes: [
    { id: "LN-0F3A", status: "running", index: "01", title: "VEX-7 — foreground lane", meta: "wake 214 · last input 00:02:11 ago", trailing: "214 wakes" },
    { id: "LN-1B77", status: "blocked", index: "02", title: "MOTH — extract the courier (mission)", meta: "lane LN-1B77 · awaiting tick", trailing: "held" },
    { id: "LN-2C05", status: "running", index: "03", title: "KESTREL — foreground lane", meta: "wake 341 · last input 00:00:42 ago", trailing: "341 wakes" },
    { id: "LN-3A19", status: "closed", index: "04", title: "MOTH — fence the prototype rig (mission)", meta: "lane LN-3A19 · closed at wake 6", trailing: "6 wakes" },
  ],
};

function fetchAdminSnapshot(): Promise<AdminSnapshot> {
  return Promise.resolve(snapshot);
}

function AdminScreen() {
  const { data } = useQuery({
    queryKey: ["admin", "snapshot"],
    queryFn: fetchAdminSnapshot,
    // Dev console — the same stale-while-revalidate defaults apply, but
    // there's no live tick to chase yet, so no per-surface refetchInterval.
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
    // hp-noise still applies here — hp-dense (on the body, __root.tsx) only
    // turns the grain intensity down, it doesn't remove the texture.
    <main className="hp-noise min-h-screen p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-7">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
              Hazard
              <span className="text-accent"> Pay</span>
              <span className="ml-3 text-ink-dim">/ Admin</span>
            </h1>
            <p className="mt-1 font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
              /// dev console · humans + agents
            </p>
          </div>
          <div className="flex items-center gap-4 font-data text-[10px] uppercase">
            <StatusChip tone="neutral" stamped>no api</StatusChip>
            <span className="text-ink-dim">
              tick
              <span className="ml-2 font-bold text-ink tabular-nums">{data.tick.toLocaleString("en-US")}</span>
            </span>
          </div>
        </header>

        <Panel title="Leaders" meta={`${data.leaders.length} configured`}>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {data.leaders.map((leader) => (
              <StatReadout
                key={leader.id}
                label={leader.name}
                value={String(leader.foregroundWakes)}
                unit="wakes"
                meter={{ value: Math.min(leader.foregroundWakes, 400), max: 400 }}
              />
            ))}
          </div>
        </Panel>

        <div className="grid gap-7 md:grid-cols-[1.4fr_1fr]">
          <Panel title="Lanes" meta={`${data.lanes.length} lanes`} flush>
            <ListRowGroup>
              {data.lanes.map((lane) => (
                <ListRow
                  key={lane.id}
                  status={lane.status}
                  index={lane.index}
                  title={lane.title}
                  meta={lane.meta}
                  trailing={lane.trailing}
                />
              ))}
            </ListRowGroup>
          </Panel>

          <Panel title="Lane trace" meta="#24" tone="magenta">
            <div className="flex flex-col gap-3">
              <p className="font-data text-[10px] leading-relaxed text-ink-dim uppercase">
                canned snapshot above — real lane/leader data lands with
                apps/api. the full lane-event log viewer is a later ticket
                (#24), once the agent event store shape exists. this
                scaffold only leaves the seam — the button below is inert
                on purpose.
              </p>
              <Button variant="ghost" size="sm" disabled title="Lands with #24">
                Open lane trace
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
