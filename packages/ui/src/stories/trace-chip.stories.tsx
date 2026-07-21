import type { Story } from "@ladle/react";

import { JsonInspector } from "../components/json-inspector.tsx";
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

/**
 * The composed deep-dive: structured children (a JsonInspector) instead of
 * a raw payload string, plus the trailing author/timestamp meta — the shape
 * the admin trace viewer renders every lane event with.
 */
export const StructuredDeepDive: Story = () => (
  <div className="max-w-2xl p-8">
    <Panel title="Lane trace — MOTH" meta="mission · extract the courier">
      <div className="flex flex-col gap-2">
        <TraceChip
          seq="0007"
          kind="input"
          summary="parent lane briefing: extract the courier"
          trailing="lane 8c1f…1e55 · 00:02:11"
          payload="extract the courier from the interchange before tick 1,030"
        />
        <TraceChip
          seq="0008"
          kind="tool_result"
          summary="spawn_lane → mission spawned"
          trailing="loop · 00:02:09"
          defaultExpanded
        >
          <JsonInspector
            label="payload"
            defaultOpenDepth={2}
            value={{
              v: 1,
              kind: "tool_result",
              toolCallId: "call_9a41",
              toolName: "spawn_lane",
              output: { spawned: true, laneId: "8c1f4a02-77aa-4a2e-9a0b-2f6f4c9d1e55" },
              isError: false,
            }}
          />
        </TraceChip>
      </div>
    </Panel>
  </div>
);
