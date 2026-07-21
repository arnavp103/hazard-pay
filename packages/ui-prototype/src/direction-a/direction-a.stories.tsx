import type { Story } from "@ladle/react";
import type { ReactNode } from "react";

import { Button } from "./button.tsx";
import { ListRow, ListRowGroup } from "./list-row.tsx";
import { Panel } from "./panel.tsx";
import { StatReadout } from "./stat-readout.tsx";
import { TraceChip } from "./trace-chip.tsx";

export default {
  title: "Direction A / Terminal HUD",
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="hp-a hpa-grid-bg min-h-screen bg-shell p-8 font-data text-ink antialiased">
      {children}
    </div>
  );
}

const payload = `{
  "tool": "scout_district",
  "district": "kowloon-interchange",
  "patrols": 2,
  "heat_delta": 4,
  "duration_ms": 1840
}`;

export const Overview: Story = () => (
  <Frame>
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex items-end justify-between border-b border-line-2 pb-3">
        <div>
          <div className="font-display text-lg font-semibold tracking-[0.32em] text-ink uppercase">
            Hazard Pay
          </div>
          <div className="text-[10px] tracking-[0.2em] text-ink-dim uppercase">
            Operations console · District 7
          </div>
        </div>
        <div className="flex items-center gap-5 text-[10px] tracking-[0.16em] uppercase">
          <span className="text-accent">● Link stable</span>
          <span className="text-ink-dim">
            Next tick
            <span className="ml-2 text-ink tabular-nums">00:12:36</span>
          </span>
        </div>
      </header>

      <Panel title="Overworld" meta="Tick 1,024">
        <div className="grid grid-cols-4 divide-x divide-line">
          <StatReadout className="pr-5" label="Credits" value="12,480" unit="¤" delta={{ text: "+340", tone: "ok" }} />
          <StatReadout className="px-5" label="Heat" value="62" unit="%" meter={{ value: 62, tone: "warn" }} />
          <StatReadout className="px-5" label="Crew" value="4/6" meter={{ value: 66 }} />
          <StatReadout className="pl-5" label="Integrity" value="87" unit="%" meter={{ value: 87 }} />
        </div>
      </Panel>

      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <div className="flex flex-col gap-5">
          <Panel title="Active missions" meta="4 lanes" live flush>
            <ListRowGroup>
              <ListRow status="running" id="LN-0F3A" title="Extract the courier — Neon Row" meta="wake 18 · VEX-7" trailing="▸" />
              <ListRow status="blocked" id="LN-1B77" title="Scout Kowloon interchange" meta="awaiting tick" trailing="▸" />
              <ListRow status="running" id="LN-2C05" title="Fence the prototype rig" meta="wake 4 · MOTH" trailing="▸" />
              <ListRow status="closed" id="LN-09E1" title="Bribe the customs AI" meta="closed at tick 1,019" trailing="—" />
            </ListRowGroup>
          </Panel>

          <Panel title="Lane trace — VEX-7 foreground" meta="Wake 18">
            <div className="flex flex-col gap-1.5">
              <TraceChip seq="0139" kind="input" summary="tick 1,024 results · 3 domain events" />
              <TraceChip seq="0140" kind="model_turn" summary="planning extraction route (1.2k tok)" />
              <TraceChip seq="0141" kind="tool_result" summary="scout_district → 2 patrols, heat +4" payload={payload} defaultExpanded />
              <TraceChip seq="0142" kind="compaction" summary="folded 214 lane events → summary" />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Match — Decision phase" meta="Phase 07" live>
            <div className="flex flex-col gap-4">
              <div className="flex items-end justify-between">
                <StatReadout label="Window" value="00:19" meter={{ value: 38, tone: "danger" }} />
                <span className="text-[10px] tracking-[0.16em] text-ink-dim uppercase">
                  2/3 moves in
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="primary">Queue move</Button>
                <Button>View lane</Button>
                <Button variant="danger">Abort mission</Button>
              </div>
            </div>
          </Panel>

          <Panel title="Comms" meta="2 unread">
            <p className="text-[12px] leading-relaxed text-ink-dim">
              <span className="text-accent">VEX-7:</span>
              {" "}
              Route secured through the interchange. Holding for your move
              — the window closes at phase 08.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  </Frame>
);

export const Buttons: Story = () => (
  <Frame>
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="primary">Queue move</Button>
        <Button>View lane</Button>
        <Button variant="danger">Abort mission</Button>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm">Deploy leader</Button>
        <Button size="sm">Inspect</Button>
        <Button variant="danger" size="sm">Abort</Button>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled>Queue move</Button>
        <Button disabled>View lane</Button>
      </div>
    </div>
  </Frame>
);

export const Panels: Story = () => (
  <Frame>
    <div className="grid max-w-3xl grid-cols-2 gap-5">
      <Panel title="District feed" meta="Idle">
        <p className="text-[12px] leading-relaxed text-ink-dim">
          Quiet panel. Corner brackets stay steel; the accent is reserved
          for live surfaces and data.
        </p>
      </Panel>
      <Panel title="Match — Decision phase" meta="00:19" live>
        <p className="text-[12px] leading-relaxed text-ink-dim">
          Live panel. Phosphor corners and title glyph mark surfaces that
          are currently advancing.
        </p>
      </Panel>
    </div>
  </Frame>
);

export const StatReadouts: Story = () => (
  <Frame>
    <div className="grid max-w-3xl grid-cols-4 gap-8">
      <StatReadout label="Credits" value="12,480" unit="¤" delta={{ text: "+340", tone: "ok" }} />
      <StatReadout label="Heat" value="62" unit="%" meter={{ value: 62, tone: "warn" }} />
      <StatReadout label="Integrity" value="87" unit="%" meter={{ value: 87 }} />
      <StatReadout label="Window" value="00:19" delta={{ text: "-12s", tone: "bad" }} meter={{ value: 38, tone: "danger" }} />
    </div>
  </Frame>
);

export const ListRows: Story = () => (
  <Frame>
    <Panel className="max-w-2xl" title="Active missions" meta="4 lanes" flush>
      <ListRowGroup>
        <ListRow status="running" id="LN-0F3A" title="Extract the courier — Neon Row" meta="wake 18 · VEX-7" trailing="▸" />
        <ListRow status="blocked" id="LN-1B77" title="Scout Kowloon interchange" meta="awaiting tick" trailing="▸" />
        <ListRow status="running" id="LN-2C05" title="Fence the prototype rig" meta="wake 4 · MOTH" trailing="▸" />
        <ListRow status="closed" id="LN-09E1" title="Bribe the customs AI" meta="closed at tick 1,019" trailing="—" />
      </ListRowGroup>
    </Panel>
  </Frame>
);

export const TraceChips: Story = () => (
  <Frame>
    <div className="flex max-w-xl flex-col gap-1.5">
      <TraceChip seq="0139" kind="input" summary="tick 1,024 results · 3 domain events" />
      <TraceChip seq="0140" kind="model_turn" summary="planning extraction route (1.2k tok)" />
      <TraceChip seq="0141" kind="tool_result" summary="scout_district → 2 patrols, heat +4" payload={payload} defaultExpanded />
      <TraceChip seq="0142" kind="compaction" summary="folded 214 lane events → summary" />
    </div>
  </Frame>
);
