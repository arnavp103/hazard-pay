import type { Story } from "@ladle/react";

import { HazardMeter } from "../components/hazard-meter.tsx";

export default {
  title: "Components / Hazard meter",
};

export const Tones: Story = () => (
  <div className="flex max-w-md flex-col gap-8 p-8">
    <div className="flex flex-col gap-2">
      <span className="font-data text-[10px] text-ink-dim uppercase">acid — steady resource</span>
      <HazardMeter label="Crew" value={66} />
    </div>
    <div className="flex flex-col gap-2">
      <span className="font-data text-[10px] text-ink-dim uppercase">warn — hazard stripes</span>
      <HazardMeter label="Heat" value={62} tone="warn" />
    </div>
    <div className="flex flex-col gap-2">
      <span className="font-data text-[10px] text-ink-dim uppercase">warn, animated — live reading</span>
      <HazardMeter label="Heat" value={78} tone="warn" animated />
    </div>
    <div className="flex flex-col gap-2">
      <span className="font-data text-[10px] text-ink-dim uppercase">danger — decision window</span>
      <HazardMeter label="Window" value={38} tone="danger" />
    </div>
  </div>
);
