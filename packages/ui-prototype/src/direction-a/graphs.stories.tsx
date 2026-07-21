import type { Story } from "@ladle/react";

import { Panel } from "./panel.tsx";
import { CreditsChart, HeatSparkline, LaneTimeline } from "./graphs.tsx";

export default {
  title: "Direction A / Terminal HUD",
};

export const Graphs: Story = () => (
  <div className="hp-a hpa-grid-bg min-h-screen bg-shell p-8 font-data text-ink antialiased">
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Panel title="Ledger — credits" meta="64 ticks">
        <CreditsChart />
      </Panel>
      <div className="grid grid-cols-[1fr_1.6fr] gap-5">
        <Panel title="Pressure" meta="Live" live>
          <HeatSparkline />
        </Panel>
        <Panel title="Lane activity" meta="4 lanes">
          <LaneTimeline />
        </Panel>
      </div>
    </div>
  </div>
);
