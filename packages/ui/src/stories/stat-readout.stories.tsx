import type { Story } from "@ladle/react";

import { StatReadout } from "../components/stat-readout.tsx";

export default {
  title: "Components / Stat readout",
};

export const Readouts: Story = () => (
  <div className="grid max-w-3xl grid-cols-2 gap-10 p-8">
    <StatReadout label="Credits" value="12,480" unit="¤" delta={{ text: "+340", tone: "ok" }} />
    <StatReadout label="Heat" value="62" unit="%" meter={{ value: 62, tone: "warn", animated: true }} />
    <StatReadout label="Crew" value="4/6" meter={{ value: 66 }} />
    <StatReadout label="Integrity" value="87" unit="%" delta={{ text: "-3", tone: "bad" }} meter={{ value: 87 }} />
    <StatReadout label="Window" value="00:19" meter={{ value: 38, tone: "danger" }} />
    <StatReadout label="Wakes" value="18" />
  </div>
);
