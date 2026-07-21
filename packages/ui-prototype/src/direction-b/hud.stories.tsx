import type { Story } from "@ladle/react";

import { useHudSim } from "../lib/use-hud-sim.ts";
import { Button } from "./button.tsx";
import { ListRow, ListRowGroup } from "./list-row.tsx";
import { Panel } from "./panel.tsx";
import { StatReadout } from "./stat-readout.tsx";

export default {
  title: "Direction B / Street-Tech",
};

/**
 * HUD core: the center stays empty — that void is where the PixiJS match
 * canvas mounts (#26). Chrome docks to corners and edges, live-updating.
 */
export const HudCore: Story = () => {
  const sim = useHudSim();
  return (
    <div className="hp-b hpb-noise relative h-screen w-full overflow-hidden bg-shell font-data text-ink antialiased">
      {/* Match canvas void */}
      <div className="absolute inset-x-[380px] inset-y-28 flex items-center justify-center border-2 border-dashed border-line/70">
        <span className="hpb-clip -rotate-2 bg-panel-2 px-2 py-0.5 font-data text-[10px] tracking-[0.1em] text-ink-dim/70 uppercase">
          match viewport · pixijs canvas
        </span>
      </div>

      {/* Top edge strip */}
      <div className="absolute inset-x-0 top-0 flex h-14 items-center justify-between border-b-2 border-line bg-panel/90 px-5">
        <span className="font-display text-2xl font-extrabold tracking-[0.06em] text-ink uppercase">
          Hazard
          <span className="text-accent"> Pay</span>
        </span>
        <span className="hpb-clip -rotate-1 bg-accent px-2.5 py-0.5 font-display text-sm font-bold tracking-[0.1em] text-shell uppercase">
          Match 7A — Decision 07
        </span>
        <span className="flex items-center gap-4 text-[10px] uppercase">
          <span className="hpb-clip hp-blink bg-accent-2 px-2 py-0.5 font-bold text-shell">link ok</span>
          <span className="text-ink-dim">tick 1,024</span>
        </span>
      </div>

      {/* Top-left: resources */}
      <Panel className="absolute top-[72px] left-4 w-[340px]" title="Resources" meta={`t+${sim.t}s`}>
        <div className="grid grid-cols-2 gap-5">
          <StatReadout label="Credits" value={sim.credits.toLocaleString("en-US")} unit="¤" delta={{ text: `+${sim.creditsDelta}`, tone: "ok" }} />
          <StatReadout label="Heat" value={String(sim.heat)} unit="%" meter={{ value: sim.heat, tone: "warn" }} />
        </div>
      </Panel>

      {/* Top-right: comms */}
      <Panel className="absolute top-[72px] right-4 w-[340px]" title="Comms" meta={`${sim.messages.length} msg`} tone="magenta">
        <div className="flex flex-col gap-3">
          {sim.messages.map((m, i) => (
            <p key={i} className="hp-anim-stamp text-[11px] leading-relaxed text-ink-dim">
              <span className="font-bold text-accent">
                {m.from}
                :
              </span>
              {" "}
              {m.text}
            </p>
          ))}
        </div>
      </Panel>

      {/* Bottom-left: missions */}
      <Panel className="absolute bottom-4 left-4 w-[360px]" title="Missions" meta="3 lanes" flush>
        <ListRowGroup>
          <ListRow status="running" index="01" title="Extract the courier" trailing={`${18 + Math.floor(sim.t / 8)} wakes`} />
          <ListRow status="blocked" index="02" title="Scout the interchange" trailing="held" />
          <ListRow status="running" index="03" title="Fence the rig" trailing="4 wakes" />
        </ListRowGroup>
      </Panel>

      {/* Bottom-right: move queue */}
      <Panel className="absolute right-4 bottom-4 w-[340px]" title="Move queue" meta={`${sim.movesIn}/3 in`} tone="magenta">
        <div className="flex items-end gap-5">
          <StatReadout label="Window" value={sim.window} meter={{ value: (19 - (sim.t % 20)) * 5.3, tone: "warn" }} />
          <div className="flex flex-1 flex-col gap-3">
            <Button variant="primary" size="sm">Queue move</Button>
            <Button size="sm">View lane</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
};
