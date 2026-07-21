import { createLogger } from "@hazard-pay/observability";
import { createTestDatabase, ensureTemplateDatabase } from "@hazard-pay/db/testing";

import { createRuntime } from "../runtime.ts";
import { loadLaneEvents } from "../store.ts";
import { laneEventPayloadSchema } from "../envelope.ts";
import type { JsonValue } from "../envelope.ts";
import type { LaneSnapshot } from "../fold.ts";
import type { DefinedLeader } from "../leader.ts";
import type { WakeReport } from "../runtime.ts";
import type { LaneEventRow } from "../store.ts";
import type { LanguageModel } from "ai";

/**
 * The eval harness (issue #25): drives one leader through a scripted
 * sequence of turns on its own template-clone db, then hands back the
 * artifacts evals score against. Evalite has no first-class multi-turn
 * runner (#5's resolution) — this is the thin in-house harness that fills
 * that gap, shared by both the mock and live `.eval.ts` suites so neither
 * duplicates db-clone/runtime-boot plumbing.
 *
 * Vocabulary: CONTEXT.md avoids "session"/"thread"/"run" as synonyms for
 * "lane", so this module and its exports say "script"/"eval" instead.
 *
 * Per ADR 0003 §3, leaders are content-hashed precisely so traces are
 * comparable: `configHash` and the raw `events` log are the harness's
 * primary artifact, not a summary of them — scorers should read the log,
 * not just the folded end state, when they care about the trace shape.
 *
 * Not vitest: evalite drives `.eval.ts` files with its own runner, so (like
 * `scripts/live-smoke.ts`) this calls `ensureTemplateDatabase()` itself
 * immediately before cloning — the template is cross-worktree shared
 * state, never assumed current from an earlier check.
 */

/** One scripted turn: append this input, then wake the lane once. */
export interface ScriptedTurn {
  author: string;
  content: string;
  data?: JsonValue;
}

export interface EvalScript {
  leader: DefinedLeader;
  model: LanguageModel;
  /** Appended and woken in order — each entry is one appendInput + one wake. */
  turns: ScriptedTurn[];
  maxModelRetries?: number;
}

/** A tool call recorded by any model turn while the script ran, in log order. */
export interface RecordedToolCall {
  toolCallId: string;
  toolName: string;
  input: JsonValue;
}

export interface EvalResult {
  laneId: string;
  /** The lane's stamped config hash — ADR 0003 §3's cross-trace comparison key. */
  configHash: string;
  /** The folded end state after the last scripted wake. */
  snapshot: LaneSnapshot;
  /** The raw ordered lane_event log — the comparable trace artifact. */
  events: LaneEventRow[];
  /** Every tool call any model turn made while the script ran, across all wakes. */
  toolCalls: RecordedToolCall[];
  /** One wake report per scripted turn, in order. */
  wakeReports: WakeReport[];
  /** Text of the last assistant message, its text parts joined. */
  finalText: string;
}

function finalAssistantText(snapshot: LaneSnapshot): string {
  for (let index = snapshot.messages.length - 1; index >= 0; index -= 1) {
    const message = snapshot.messages[index];
    if (message?.role !== "assistant") {
      continue;
    }
    const content = message.content;
    if (typeof content === "string") {
      return content;
    }
    return content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  }
  return "";
}

/**
 * Runs a scripted turn sequence against a fresh template-clone db and tears
 * it down again — every eval script owns its own db, never shares one. Each
 * scripted turn is one `appendInput` followed by one `wake`, in the order
 * given. Unwraps `ResultAsync` failures as throws (evalite reports a thrown
 * task as a failed eval, same as an unhandled test exception).
 */
export async function runEvalScript(script: EvalScript): Promise<EvalResult> {
  await ensureTemplateDatabase();
  const tdb = await createTestDatabase();
  try {
    const logger = createLogger("agent-eval", { level: "silent" });
    const runtime = createRuntime({
      db: tdb.db,
      model: script.model,
      logger,
      leaders: [script.leader],
      maxModelRetries: script.maxModelRetries,
    });

    const created = (await runtime.createLane({ leader: script.leader.name }))._unsafeUnwrap();
    const wakeReports: WakeReport[] = [];
    for (const turn of script.turns) {
      (
        await runtime.appendInput({
          laneId: created.laneId,
          author: turn.author,
          content: turn.content,
          data: turn.data,
        })
      )._unsafeUnwrap();
      wakeReports.push((await runtime.wake({ laneId: created.laneId }))._unsafeUnwrap());
    }

    const snapshot = (await runtime.foldLane({ laneId: created.laneId }))._unsafeUnwrap();
    const events = (await loadLaneEvents(tdb.db, created.laneId))._unsafeUnwrap();

    const toolCalls: RecordedToolCall[] = [];
    for (const row of events) {
      const parsed = laneEventPayloadSchema.safeParse(row.payload);
      if (!parsed.success || parsed.data.kind !== "model_turn") {
        continue;
      }
      for (const part of parsed.data.content) {
        if (part.type === "tool-call") {
          toolCalls.push({ toolCallId: part.toolCallId, toolName: part.toolName, input: part.input });
        }
      }
    }

    return {
      laneId: created.laneId,
      configHash: created.configHash,
      snapshot,
      events,
      toolCalls,
      wakeReports,
      finalText: finalAssistantText(snapshot),
    };
  } finally {
    await tdb.drop();
  }
}
