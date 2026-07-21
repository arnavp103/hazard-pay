import type { Story } from "@ladle/react";

import { useHudSim } from "../lib/use-hud-sim.ts";
import { Button } from "./button.tsx";
import { ListRow, ListRowGroup } from "./list-row.tsx";
import { Panel } from "./panel.tsx";
import { StatReadout } from "./stat-readout.tsx";

export default {
  title: "Direction C / Corpo Ledger",
};

/**
 * HUD core: the center stays empty — that void is where the PixiJS match
 * canvas mounts (#26). Chrome docks to corners and edges, live-updating.
 */
export const HudCore: Story = () => {
  const sim = useHudSim();
  return (
    <div className="hp-c hpc-vignette-bg relative h-screen w-full overflow-hidden bg-shell font-data text-ink antialiased">
      {/* Match canvas void */}
      <div className="absolute inset-x-[390px] inset-y-28 rounded-xl border border-line/60">
        <div className="flex h-full items-center justify-center">
          <span className="font-data text-[9px] tracking-[0.34em] text-ink-dim/40 uppercase">
            Match viewport · PixiJS canvas
          </span>
        </div>
      </div>

      {/* Top edge strip */}
      <div className="hpc-sheen absolute inset-x-0 top-0 flex h-13 items-center justify-between border-b border-line bg-panel/80 px-6 backdrop-blur-md">
        <span className="font-display text-lg font-medium text-ink">
          Hazard
          <span className="text-accent"> Pay</span>
        </span>
        <span className="font-display text-[13px] font-medium text-ink">
          Match 7A
          <span className="mx-2 text-ink-dim/60">·</span>
          <span className="text-accent">Decision phase 07</span>
        </span>
        <span className="flex items-center gap-5 font-data text-[9px] tracking-[0.24em] uppercase">
          <span className="hp-blink flex items-center gap-1.5 text-accent">
            <span className="text-[7px]">◆</span>
            Link
          </span>
          <span className="text-ink-dim">Tick 1,024</span>
        </span>
      </div>

      {/* Top-left: resources */}
      <Panel className="absolute top-17 left-5 w-[330px]" title="Resources" meta={`t+${sim.t}s`}>
        <div className="grid grid-cols-2 gap-5">
          <StatReadout label="Credits" value={sim.credits.toLocaleString("en-US")} unit="¤" delta={{ text: `+${sim.creditsDelta}`, tone: "ok" }} />
          <StatReadout label="Heat" value={String(sim.heat)} unit="%" meter={{ value: sim.heat, tone: "warn" }} />
        </div>
      </Panel>

      {/* Top-right: comms */}
      <Panel className="absolute top-17 right-5 w-[340px]" title="Comms" meta={`${sim.messages.length} msg`} live>
        <div className="flex flex-col gap-3">
          {sim.messages.map((m, i) => (
            <p key={i} className="hp-anim-slide-in font-data text-[11px] leading-relaxed font-light text-ink-dim">
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
      <Panel className="absolute bottom-5 left-5 w-[350px]" title="Active missions" meta="3 lanes" flush>
        <ListRowGroup>
          <ListRow status="running" id="LN-0F3A" title="Extract the courier" trailing={`wk ${18 + Math.floor(sim.t / 8)}`} />
          <ListRow status="blocked" id="LN-1B77" title="Scout the interchange" trailing="held" />
          <ListRow status="running" id="LN-2C05" title="Fence the rig" trailing="wk 4" />
        </ListRowGroup>
      </Panel>

      {/* Bottom-right: move queue */}
      <Panel className="absolute right-5 bottom-5 w-[340px]" title="Move queue" meta={`${sim.movesIn}/3 in`} live>
        <div className="flex items-end gap-6">
          <StatReadout label="Window" value={sim.window} meter={{ value: (19 - (sim.t % 20)) * 5.3, tone: "danger" }} />
          <div className="flex flex-1 flex-col gap-2.5">
            <Button variant="primary" size="sm">Queue move</Button>
            <Button size="sm">View lane</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
};
