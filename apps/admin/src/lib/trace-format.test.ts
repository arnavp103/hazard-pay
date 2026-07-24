import { describe, expect, test } from "vitest";

import {
  formatSeq,
  formatTokens,
  laneTitle,
  shortHash,
  shortId,
  summarizeLaneEvent,
} from "./trace-format.ts";
import type { LaneEventRecord, LaneSummary } from "@hazard-pay/api/contract";

function record(payload: LaneEventRecord["payload"]): LaneEventRecord {
  return {
    seq: 1,
    author: "loop",
    type: payload.kind,
    payload,
    occurredAt: "2026-07-24T12:34:56.000Z",
  };
}

function laneSummary(kind: LaneSummary["kind"]): LaneSummary {
  return {
    id: "0f0e0d0c-0b0a-4908-8706-050403020100",
    kind,
    leaderName: "mags",
    configHash: "deadbeefdeadbeefdeadbeef",
    status: "open",
    parentLaneId: null,
    createdAt: "2026-07-24T00:00:00.000Z",
    wokeAt: null,
    lastEventAt: null,
    eventCounts: { input: 0, modelTurn: 0, toolResult: 0, compaction: 0, total: 0 },
  };
}

describe("summarizeLaneEvent", () => {
  test("input: whitespace collapses to one line", () => {
    const summary = summarizeLaneEvent(
      record({ v: 1, kind: "input", content: "  tick 7\n  all quiet  " }),
    );
    expect(summary).toBe("tick 7 all quiet");
  });

  test("input: long content truncates to 96 with an ellipsis", () => {
    const summary = summarizeLaneEvent(
      record({ v: 1, kind: "input", content: "x".repeat(200) }),
    );
    expect(summary).toHaveLength(96);
    expect(summary.endsWith("…")).toBe(true);
  });

  test("model_turn: text part wins, with token count", () => {
    const summary = summarizeLaneEvent(
      record({
        v: 1,
        kind: "model_turn",
        fingerprint: "fp",
        model: { provider: "mock", modelId: "scripted" },
        content: [{ type: "text", text: "All quiet on the overworld." }],
        finishReason: "stop",
        usage: { totalTokens: 1234 },
      }),
    );
    expect(summary).toBe("All quiet on the overworld. (1.2k tok)");
  });

  test("model_turn: tool calls listed when there is no text part", () => {
    const summary = summarizeLaneEvent(
      record({
        v: 1,
        kind: "model_turn",
        fingerprint: "fp",
        model: { provider: "mock", modelId: "scripted" },
        content: [
          { type: "tool-call", toolCallId: "c1", toolName: "spawn_lane", input: {} },
        ],
        finishReason: "tool-calls",
        usage: {},
      }),
    );
    expect(summary).toBe("tool-call → spawn_lane (? tok)");
  });

  test("model_turn: falls back to the finish reason", () => {
    const summary = summarizeLaneEvent(
      record({
        v: 1,
        kind: "model_turn",
        fingerprint: "fp",
        model: { provider: "mock", modelId: "scripted" },
        content: [],
        finishReason: "stop",
        usage: { totalTokens: 42 },
      }),
    );
    expect(summary).toBe("stop (42 tok)");
  });

  test("tool_result: name and outcome", () => {
    const ok = record({
      v: 1,
      kind: "tool_result",
      toolCallId: "c1",
      toolName: "spawn_lane",
      output: { spawned: true, laneId: "L1" },
      isError: false,
    });
    const failed = record({
      v: 1,
      kind: "tool_result",
      toolCallId: "c2",
      toolName: "post_dispatch",
      output: { tag: "dispatch_write_failed" },
      isError: true,
    });
    expect(summarizeLaneEvent(ok)).toBe("spawn_lane → ok");
    expect(summarizeLaneEvent(failed)).toBe("post_dispatch → error");
  });

  test("compaction: shows the summary", () => {
    const summary = summarizeLaneEvent(
      record({ v: 1, kind: "compaction", summary: "three wakes squished" }),
    );
    expect(summary).toBe("three wakes squished");
  });
});

describe("formatters", () => {
  test("formatTokens boundaries", () => {
    expect(formatTokens(undefined)).toBe("? tok");
    expect(formatTokens(999)).toBe("999 tok");
    expect(formatTokens(1000)).toBe("1.0k tok");
  });

  test("laneTitle names the lane kind in domain words", () => {
    expect(laneTitle(laneSummary("foreground"))).toBe("mags — foreground lane");
    expect(laneTitle(laneSummary("mission"))).toBe("mags — mission");
  });

  test("short forms", () => {
    expect(shortHash("deadbeefdeadbeefdeadbeef")).toBe("deadbeefdead");
    expect(shortId("0f0e0d0c-0b0a-4908-8706-050403020100")).toBe("0f0e0d0c");
    expect(formatSeq(7)).toBe("0007");
  });
});
