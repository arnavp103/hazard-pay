import type { Story } from "@ladle/react";

import { Panel } from "./panel.tsx";
import { CreditsChart, HeatSparkline, LaneTimeline } from "./graphs.tsx";

export default {
  title: "Direction B / Street-Tech",
};

export const Graphs: Story = () => (
  <div className="hp-b hpb-noise min-h-screen bg-shell p-8 font-data text-ink antialiased">
    <div className="mx-auto flex max-w-3xl flex-col gap-7">
      <Panel title="Ledger — credits" meta="64 ticks">
        <CreditsChart />
      </Panel>
      <div className="grid grid-cols-[1fr_1.6fr] gap-7">
        <Panel title="Pressure" meta="live" tone="magenta">
          <HeatSparkline />
        </Panel>
        <Panel title="Lane activity" meta="4 lanes">
          <LaneTimeline />
        </Panel>
      </div>
    </div>
  </div>
);
