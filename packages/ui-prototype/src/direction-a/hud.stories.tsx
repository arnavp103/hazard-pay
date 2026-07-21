import type { Story } from "@ladle/react";

import { useHudSim } from "../lib/use-hud-sim.ts";
import { Button } from "./button.tsx";
import { ListRow, ListRowGroup } from "./list-row.tsx";
import { Panel } from "./panel.tsx";
import { StatReadout } from "./stat-readout.tsx";

export default {
  title: "Direction A / Terminal HUD",
};

/**
 * HUD core: the center stays empty — that void is where the PixiJS match
 * canvas mounts (#26). Chrome docks to corners and edges, live-updating.
 */
export const HudCore: Story = () => {
  const sim = useHudSim();
  return (
    <div className="hp-a hpa-grid-bg relative h-screen w-full overflow-hidden bg-shell font-data text-ink antialiased">
      {/* Match canvas void */}
      <div className="hpa-corners absolute inset-x-[360px] inset-y-24 flex items-center justify-center">
        <span className="text-[10px] tracking-[0.3em] text-ink-dim/40 uppercase">
          Match viewport · PixiJS canvas
        </span>
      </div>

      {/* Top edge strip */}
      <div className="absolute inset-x-0 top-0 flex h-12 items-center justify-between border-b border-line bg-panel/80 px-5 backdrop-blur-sm">
        <span className="font-display text-sm font-semibold tracking-[0.3em] text-ink uppercase">
          Hazard Pay
        </span>
        <span className="font-display text-[11px] font-semibold tracking-[0.24em] text-ink uppercase">
          Match 7A — Decision phase 07
        </span>
        <span className="flex items-center gap-4 text-[10px] tracking-[0.16em] uppercase">
          <span className="flex items-center gap-1.5 text-accent">
            <span className="hp-blink size-1.5 bg-accent" />
            Link stable
          </span>
          <span className="text-ink-dim">
            Tick 1,024
          </span>
        </span>
      </div>

      {/* Top-left: resources */}
      <Panel className="absolute top-16 left-4 w-[320px] bg-panel/85 backdrop-blur-sm" title="Resources" meta={`t+${sim.t}s`}>
        <div className="grid grid-cols-2 gap-4">
          <StatReadout label="Credits" value={sim.credits.toLocaleString("en-US")} unit="¤" delta={{ text: `+${sim.creditsDelta}`, tone: "ok" }} />
          <StatReadout label="Heat" value={String(sim.heat)} unit="%" meter={{ value: sim.heat, tone: "warn" }} />
        </div>
      </Panel>

      {/* Top-right: comms */}
      <Panel className="absolute top-16 right-4 w-[330px] bg-panel/85 backdrop-blur-sm" title="Comms" meta={`${sim.messages.length} msg`} live>
        <div className="flex flex-col gap-2.5">
          {sim.messages.map((m, i) => (
            <p key={i} className="hp-anim-slide-in text-[11px] leading-relaxed text-ink-dim">
              <span className="text-accent">
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
      <Panel className="absolute bottom-4 left-4 w-[340px] bg-panel/85 backdrop-blur-sm" title="Active missions" meta="3 lanes" flush>
        <ListRowGroup>
          <ListRow status="running" id="LN-0F3A" title="Extract the courier" trailing={`wk ${18 + Math.floor(sim.t / 8)}`} />
          <ListRow status="blocked" id="LN-1B77" title="Scout the interchange" trailing="held" />
          <ListRow status="running" id="LN-2C05" title="Fence the rig" trailing="wk 4" />
        </ListRowGroup>
      </Panel>

      {/* Bottom-right: move queue */}
      <Panel className="absolute right-4 bottom-4 w-[330px] bg-panel/85 backdrop-blur-sm" title="Move queue" meta={`${sim.movesIn}/3 in`} live>
        <div className="flex items-end gap-5">
          <StatReadout label="Window" value={sim.window} meter={{ value: (19 - (sim.t % 20)) * 5.3, tone: "danger" }} />
          <div className="flex flex-1 flex-col gap-2">
            <Button variant="primary" size="sm">Queue move</Button>
            <Button size="sm">View lane</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
};
