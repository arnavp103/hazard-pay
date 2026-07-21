import { Result, err, ok } from "neverthrow";

import { canonicalJson } from "./hash.ts";
import { laneEventPayloadSchema } from "./envelope.ts";
import type { AgentError } from "./errors.ts";
import type { JsonValue } from "./envelope.ts";
import type { LaneEventRow } from "./store.ts";
import type { AssistantModelMessage, ModelMessage } from "ai";

/** A model-requested tool call that has no recorded `tool_result` yet. */
export interface Obligation {
  toolCallId: string;
  toolName: string;
  input: JsonValue;
}

/**
 * A lane's state, derived from its log and nothing else (CONTEXT.md: Fold).
 * `messages` is exactly what the next model call sends; obligations are the
 * set-based unresolved tool calls that resume must discharge (ADR 0003 §4 —
 * set-based, so it survives parallel tool calls).
 */
export interface LaneSnapshot {
  laneId: string;
  lastSeq: number;
  modelTurnCount: number;
  messages: ModelMessage[];
  openObligations: Obligation[];
  /**
   * Inputs + tool results appended after the last model turn — the events
   * the model has not seen yet. Zero (with no open obligations) is
   * quiescence: the last model turn already answered everything.
   */
  eventsSinceLastModelTurn: number;
  /** finishReason of the last model turn, if any. */
  lastFinishReason?: string;
}

export function emptySnapshot(laneId: string): LaneSnapshot {
  return {
    laneId,
    lastSeq: 0,
    modelTurnCount: 0,
    messages: [],
    openObligations: [],
    eventsSinceLastModelTurn: 0,
  };
}

/**
 * Applies one lane event to a snapshot (pure — no clock, no randomness, no
 * environment; ADR 0003 §5). Exposed separately from `foldLaneEvents` so
 * fingerprint verification can observe the snapshot between events.
 */
export function applyLaneEvent(
  snapshot: LaneSnapshot,
  row: LaneEventRow,
): Result<LaneSnapshot, AgentError> {
  const parsed = laneEventPayloadSchema.safeParse(row.payload);
  if (!parsed.success) {
    return err({
      tag: "EnvelopeInvalid",
      laneId: row.laneId,
      seq: row.seq,
      cause: parsed.error,
    });
  }
  const payload = parsed.data;
  const next: LaneSnapshot = {
    ...snapshot,
    lastSeq: row.seq,
    messages: [...snapshot.messages],
    openObligations: [...snapshot.openObligations],
  };
  switch (payload.kind) {
    case "input": {
      const data = payload.data === undefined ? "" : `\n${canonicalJson(payload.data)}`;
      next.messages.push({ role: "user", content: `[from ${row.author}] ${payload.content}${data}` });
      next.eventsSinceLastModelTurn = snapshot.eventsSinceLastModelTurn + 1;
      return ok(next);
    }
    case "model_turn": {
      const content: AssistantModelMessage["content"] = [];
      for (const part of payload.content) {
        if (part.type === "text") {
          content.push({ type: "text", text: part.text });
        } else if (part.type === "tool-call") {
          content.push({
            type: "tool-call",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          });
          next.openObligations.push({
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          });
        }
        // Reasoning parts stay in the log for spectating but are not folded
        // back into the next request.
      }
      next.messages.push({
        role: "assistant",
        content: content.length > 0 ? content : [{ type: "text", text: "" }],
      });
      next.modelTurnCount = snapshot.modelTurnCount + 1;
      next.eventsSinceLastModelTurn = 0;
      next.lastFinishReason = payload.finishReason;
      return ok(next);
    }
    case "tool_result": {
      next.messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            output: payload.isError
              ? { type: "error-json", value: payload.output }
              : { type: "json", value: payload.output },
          },
        ],
      });
      next.openObligations = next.openObligations.filter(
        (obligation) => obligation.toolCallId !== payload.toolCallId,
      );
      next.eventsSinceLastModelTurn = snapshot.eventsSinceLastModelTurn + 1;
      return ok(next);
    }
    case "compaction": {
      // RESERVED seam (ADR 0003 §4): when implemented, the fold will START
      // from the latest compaction instead of seq 1. Until then, refuse.
      return err({ tag: "CompactionReserved", laneId: row.laneId, seq: row.seq });
    }
  }
}

/** Derives a lane's state from its full ordered log (CONTEXT.md: Fold). */
export function foldLaneEvents(
  laneId: string,
  rows: LaneEventRow[],
): Result<LaneSnapshot, AgentError> {
  return rows.reduce<Result<LaneSnapshot, AgentError>>(
    (acc, row) => acc.andThen((snapshot) => applyLaneEvent(snapshot, row)),
    ok(emptySnapshot(laneId)),
  );
}

/**
 * Is there anything left for a wake to do? Quiescence = no unseen inputs, no
 * open obligations (ADR 0003 §6: run to quiescence under `maxTurnsPerWake`).
 */
export function hasPendingWork(snapshot: LaneSnapshot): boolean {
  return snapshot.eventsSinceLastModelTurn > 0 || snapshot.openObligations.length > 0;
}
