import type { Story } from "@ladle/react";

import { ListRow, ListRowGroup } from "../components/list-row.tsx";
import { Panel } from "../components/panel.tsx";

export default {
  title: "Components / List row",
};

export const Missions: Story = () => (
  <div className="max-w-2xl p-8">
    <Panel title="Active missions" meta="4 lanes" flush>
      <ListRowGroup>
        <ListRow status="running" index="01" title="Extract the courier — Neon Row" meta="lane LN-0F3A · wake 18 · VEX-7" trailing="18 wakes" />
        <ListRow status="blocked" index="02" title="Scout Kowloon interchange" meta="lane LN-1B77 · awaiting tick" trailing="held" />
        <ListRow status="running" index="03" title="Fence the prototype rig" meta="lane LN-2C05 · wake 4 · MOTH" trailing="4 wakes" />
        <ListRow status="closed" index="04" title="Bribe the customs AI" meta="lane LN-09E1 · closed at tick 1,019" trailing="t 1,019" />
      </ListRowGroup>
    </Panel>
  </div>
);
