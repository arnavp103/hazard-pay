import type { Story } from "@ladle/react";

import { JsonInspector, type JsonLike } from "../components/json-inspector.tsx";
import { Panel } from "../components/panel.tsx";

export default {
  title: "Components / Json inspector",
};

const modelTurnPayload: JsonLike = {
  v: 1,
  kind: "model_turn",
  fingerprint: "9f2c11ab04d17e5a0b6633dd8c4f19c2a7e05b8890f1d2c3a4b5e6f708192a3b",
  model: { provider: "google", modelId: "gemini-2.5-flash" },
  content: [
    { type: "reasoning", text: "Two patrols near the interchange — reroute through the loading docks." },
    { type: "text", text: "Rerouting the courier through the docks; heat stays manageable." },
    {
      type: "tool-call",
      toolCallId: "call_7f31",
      toolName: "scout_district",
      input: { district: "kowloon-interchange", depth: 2 },
    },
  ],
  finishReason: "tool-calls",
  usage: { inputTokens: 1187, outputTokens: 164, totalTokens: 1351 },
};

export const ModelTurnPayload: Story = () => (
  <div className="max-w-2xl p-8">
    <Panel title="Deep-dive — model turn" meta="lane LN-0F3A · seq 0140">
      <JsonInspector value={modelTurnPayload} label="payload" defaultOpenDepth={2} />
    </Panel>
  </div>
);

export const CollapsedByDefault: Story = () => (
  <div className="max-w-2xl p-8">
    <Panel title="Deep-dive — tool result" meta="collapsed to previews">
      <JsonInspector
        value={{
          v: 1,
          kind: "tool_result",
          toolName: "spawn_lane",
          output: { spawned: true, laneId: "8c1f4a02-77aa-4a2e-9a0b-2f6f4c9d1e55" },
          isError: false,
        }}
        label="payload"
        defaultOpenDepth={0}
      />
    </Panel>
  </div>
);
