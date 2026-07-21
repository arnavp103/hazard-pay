import type { Story } from "@ladle/react";

import { Panel } from "../components/panel.tsx";
import { TraceChip } from "../components/trace-chip.tsx";

export default {
  title: "Components / Trace chip",
};

const payload = `{
  "tool": "scout_district",
  "district": "kowloon-interchange",
  "patrols": 2,
  "heat_delta": 4,
  "duration_ms": 1840
}`;

export const LaneTrace: Story = () => (
  <div className="max-w-2xl p-8">
    <Panel title="Lane trace — VEX-7" meta="wake 18">
      <div className="flex flex-col gap-2">
        <TraceChip seq="0139" kind="input" summary="tick 1,024 results · 3 domain events" />
        <TraceChip seq="0140" kind="model_turn" summary="planning extraction route (1.2k tok)" />
        <TraceChip seq="0141" kind="tool_result" summary="scout_district → 2 patrols, heat +4" payload={payload} defaultExpanded />
        <TraceChip seq="0142" kind="compaction" summary="folded 214 lane events → summary" />
      </div>
    </Panel>
  </div>
);
