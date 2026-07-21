import type { Story } from "@ladle/react";

import { Button } from "../components/button.tsx";
import { ListRow, ListRowGroup } from "../components/list-row.tsx";
import { Panel } from "../components/panel.tsx";
import { StatReadout } from "../components/stat-readout.tsx";
import { StatusChip } from "../components/sticker.tsx";
import { TraceChip } from "../components/trace-chip.tsx";

export default {
  title: "Overview",
};

const payload = `{
  "tool": "scout_district",
  "district": "kowloon-interchange",
  "patrols": 2,
  "heat_delta": 4,
  "duration_ms": 1840
}`;

export const Overworld: Story = () => (
  <div className="hp-noise min-h-screen p-8">
    <div className="mx-auto flex max-w-5xl flex-col gap-7">
      <header className="flex items-end justify-between">
        <div>
          <div className="font-display text-4xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Hazard
            <span className="text-accent"> Pay</span>
          </div>
          <div className="mt-1 font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// district 7 · black channel
          </div>
        </div>
        <div className="flex items-center gap-4 font-data text-[10px] uppercase">
          <StatusChip tone="acid">link ok</StatusChip>
          <span className="text-ink-dim">
            next tick
            <span className="ml-2 font-bold text-ink tabular-nums">00:12:36</span>
          </span>
        </div>
      </header>

      <Panel title="Overworld" meta="tick 1,024">
        <div className="grid grid-cols-4 gap-6">
          <StatReadout label="Credits" value="12,480" unit="¤" delta={{ text: "+340", tone: "ok" }} />
          <StatReadout label="Heat" value="62" unit="%" meter={{ value: 62, tone: "warn", animated: true }} />
          <StatReadout label="Crew" value="4/6" meter={{ value: 66 }} />
          <StatReadout label="Integrity" value="87" unit="%" meter={{ value: 87 }} />
        </div>
      </Panel>

      <div className="grid grid-cols-[1.4fr_1fr] gap-7">
        <div className="flex flex-col gap-7">
          <Panel title="Active missions" meta="4 lanes" flush>
            <ListRowGroup>
              <ListRow status="running" index="01" title="Extract the courier — Neon Row" meta="lane LN-0F3A · wake 18 · VEX-7" trailing="18 wakes" />
              <ListRow status="blocked" index="02" title="Scout Kowloon interchange" meta="lane LN-1B77 · awaiting tick" trailing="held" />
              <ListRow status="running" index="03" title="Fence the prototype rig" meta="lane LN-2C05 · wake 4 · MOTH" trailing="4 wakes" />
              <ListRow status="closed" index="04" title="Bribe the customs AI" meta="lane LN-09E1 · closed at tick 1,019" trailing="t 1,019" />
            </ListRowGroup>
          </Panel>

          <Panel title="Lane trace — VEX-7" meta="wake 18">
            <div className="flex flex-col gap-2">
              <TraceChip seq="0139" kind="input" summary="tick 1,024 results · 3 domain events" />
              <TraceChip seq="0140" kind="model_turn" summary="planning extraction route (1.2k tok)" />
              <TraceChip seq="0141" kind="tool_result" summary="scout_district → 2 patrols, heat +4" payload={payload} defaultExpanded />
              <TraceChip seq="0142" kind="compaction" summary="folded 214 lane events → summary" />
            </div>
          </Panel>
        </div>

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
                <Button variant="danger">Abort mission</Button>
              </div>
            </div>
          </Panel>

          <Panel title="Comms" meta="2 unread">
            <p className="font-data text-[12px] leading-relaxed text-ink-dim">
              <span className="font-bold text-accent">VEX-7:</span>
              {" "}
              Route secured through the interchange. Holding for your move
              — the window closes at phase 08.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  </div>
);
