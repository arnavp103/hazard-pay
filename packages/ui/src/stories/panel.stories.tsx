import type { Story } from "@ladle/react";

import { Panel } from "../components/panel.tsx";
import { StatReadout } from "../components/stat-readout.tsx";

export default {
  title: "Components / Panel",
};

export const Tones: Story = () => (
  <div className="grid max-w-3xl grid-cols-2 gap-8 p-8">
    <Panel title="Overworld" meta="tick 1,024">
      <p className="font-data text-xs leading-relaxed text-ink-dim">
        Acid sticker for standard surfaces. Body copy runs in the data face;
        the sticker title is taped on at a slight rotation.
      </p>
    </Panel>
    <Panel title="Decision phase" meta="phase 07" tone="magenta">
      <p className="font-data text-xs leading-relaxed text-ink-dim">
        Magenta sticker marks live/urgent surfaces — a decision window that
        is currently open, a match in progress.
      </p>
    </Panel>
  </div>
);

export const DenseScope: Story = () => (
  <div className="grid max-w-3xl grid-cols-2 gap-8 p-8">
    <Panel title="Default" meta="grain 0.07">
      <StatReadout label="Heat" value="62" unit="%" meter={{ value: 62, tone: "warn" }} />
    </Panel>
    <div className="hp-dense">
      <Panel title="Dense scope" meta="grain 0.03">
        <StatReadout label="Heat" value="62" unit="%" meter={{ value: 62, tone: "warn" }} />
      </Panel>
    </div>
  </div>
);
