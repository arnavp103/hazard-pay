import { describe, expect, test } from "vitest";

import { ENVELOPE_VERSION } from "./envelope.ts";
import { foldLaneEvents, hasPendingWork } from "./fold.ts";
import { requestFingerprint, verifyLaneFingerprints } from "./fingerprint.ts";
import type { LaneEventPayload } from "./envelope.ts";
import type { LaneEventRow } from "./store.ts";

const LANE = "00000000-0000-0000-0000-000000000001";

function row(
  seq: number,
  type: LaneEventRow["type"],
  payload: LaneEventPayload,
  author = "test",
): LaneEventRow {
  return { laneId: LANE, seq, author, type, payload, occurredAt: new Date(0) };
}

function input(seq: number, content: string, author = "tick"): LaneEventRow {
  return row(seq, "input", { v: ENVELOPE_VERSION, kind: "input", content }, author);
}

type ModelTurnContent = Extract<LaneEventPayload, { kind: "model_turn" }>["content"];

function modelTurn(seq: number, content: ModelTurnContent, fingerprint = "fp"): LaneEventRow {
  return row(seq, "model_turn", {
    v: ENVELOPE_VERSION,
    kind: "model_turn",
    fingerprint,
    model: { provider: "mock", modelId: "mock-model" },
    content,
    finishReason: "stop",
    usage: {},
  }, "loop");
}

function toolResult(seq: number, toolCallId: string, toolName: string): LaneEventRow {
  return row(seq, "tool_result", {
    v: ENVELOPE_VERSION,
    kind: "tool_result",
    toolCallId,
    toolName,
    output: { ok: true },
    isError: false,
  }, "loop");
}

describe("foldLaneEvents", () => {
  test("folds inputs, model turns, and tool results into messages in order", () => {
    const rows = [
      input(1, "hello"),
      modelTurn(2, [
        { type: "text", text: "thinking about it" },
        { type: "tool-call", toolCallId: "c1", toolName: "read_tick_count", input: {} },
      ]),
      toolResult(3, "c1", "read_tick_count"),
    ];
    const snapshot = foldLaneEvents(LANE, rows)._unsafeUnwrap();

    expect(snapshot.lastSeq).toBe(3);
    expect(snapshot.modelTurnCount).toBe(1);
    expect(snapshot.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
    ]);
    expect(snapshot.messages[0]?.content).toBe("[from tick] hello");
    // The tool result is unseen by the model, so the lane is not quiescent.
    expect(snapshot.openObligations).toEqual([]);
    expect(snapshot.eventsSinceLastModelTurn).toBe(1);
    expect(hasPendingWork(snapshot)).toBe(true);
  });

  test("replay determinism: the same log folds to the same state", () => {
    const rows = [
      input(1, "one"),
      modelTurn(2, [{ type: "tool-call", toolCallId: "c1", toolName: "t", input: { a: 1 } }]),
      toolResult(3, "c1", "t"),
      modelTurn(4, [{ type: "text", text: "done" }]),
    ];
    const first = foldLaneEvents(LANE, rows)._unsafeUnwrap();
    const second = foldLaneEvents(LANE, rows)._unsafeUnwrap();

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(second.eventsSinceLastModelTurn).toBe(0);
    expect(hasPendingWork(second)).toBe(false);
  });

  test("tracks unresolved obligations as a set", () => {
    const rows = [
      input(1, "go"),
      modelTurn(2, [
        { type: "tool-call", toolCallId: "c1", toolName: "a", input: {} },
        { type: "tool-call", toolCallId: "c2", toolName: "b", input: {} },
      ]),
      toolResult(3, "c2", "b"),
    ];
    const snapshot = foldLaneEvents(LANE, rows)._unsafeUnwrap();

    expect(snapshot.openObligations).toEqual([{ toolCallId: "c1", toolName: "a", input: {} }]);
  });

  test("reasoning parts are recorded but not folded into messages", () => {
    const rows = [
      input(1, "hi"),
      modelTurn(2, [
        { type: "reasoning", text: "let me think" },
        { type: "text", text: "hello" },
      ]),
    ];
    const snapshot = foldLaneEvents(LANE, rows)._unsafeUnwrap();
    expect(JSON.stringify(snapshot.messages)).not.toContain("let me think");
    expect(JSON.stringify(snapshot.messages)).toContain("hello");
  });

  test("compaction is a reserved seam: folds refuse it", () => {
    const rows = [
      row(1, "compaction", { v: ENVELOPE_VERSION, kind: "compaction", summary: "s" }, "loop"),
    ];
    const error = foldLaneEvents(LANE, rows)._unsafeUnwrapErr();
    expect(error.tag).toBe("CompactionReserved");
  });

  test("unknown envelope versions fail loudly", () => {
    const rows = [
      { ...input(1, "x"), payload: { v: 99, kind: "input", content: "x" } },
    ];
    const error = foldLaneEvents(LANE, rows)._unsafeUnwrapErr();
    expect(error.tag).toBe("EnvelopeInvalid");
  });
});

describe("verifyLaneFingerprints", () => {
  const configHash = "config-hash";

  function fingerprintedLog(): LaneEventRow[] {
    const first = [input(1, "hello")];
    const beforeTurn = foldLaneEvents(LANE, first)._unsafeUnwrap();
    const fingerprint = requestFingerprint({
      configHash,
      provider: "mock",
      modelId: "mock-model",
      messages: beforeTurn.messages,
    });
    return [...first, modelTurn(2, [{ type: "text", text: "hi" }], fingerprint)];
  }

  test("recomputed fingerprints match the recorded ones", () => {
    const result = verifyLaneFingerprints(LANE, configHash, fingerprintedLog());
    expect(result._unsafeUnwrap()).toEqual({ verified: 1 });
  });

  test("a diverging fold surfaces as a mismatch", () => {
    const rows = fingerprintedLog();
    rows[0] = input(1, "tampered");
    const error = verifyLaneFingerprints(LANE, configHash, rows)._unsafeUnwrapErr();
    expect(error.tag).toBe("FingerprintMismatch");
  });
});
