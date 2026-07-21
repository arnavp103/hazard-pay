import { defineLeader } from "@hazard-pay/agent";
import { z } from "zod";

import { insertLeaderNote, latestTick } from "../db/index.ts";
import type { DefinedLeader, ToolExecutionCtx, ToolError } from "@hazard-pay/agent";
import type { JsonValue } from "@hazard-pay/agent";
import type { ResultAsync } from "neverthrow";

/**
 * Mags — the first real leader (issue #52, ADR 0003 §3: leaders are game
 * code, declarative config over the `packages/agent` harness). Persona: the
 * overworld dispatcher of Hazard Pay, a dry, sharp-tongued fixer who runs
 * the job board from a smoke-stained booth and narrates each tick in one
 * terse line.
 *
 * Free-tier discipline: a wake is one read, one write, one closing sentence
 * — `maxTurnsPerWake: 3` caps the model calls per doorbell, and the prompt
 * forbids repeat tool calls.
 */

export const MAGS = "mags";

function readOverworldStatus(ctx: ToolExecutionCtx): ResultAsync<JsonValue, ToolError> {
  return latestTick(ctx.tx)
    .mapErr((error): ToolError => ({ tag: "tick_read_failed", detail: error.message }))
    .map((row) =>
      row === null
        ? { tick: null }
        : {
            tick: {
              id: row.id,
              tickNumber: row.tickNumber,
              completedAt: row.completedAt.toISOString(),
            },
          });
}

function postDispatch(
  ctx: ToolExecutionCtx,
  input: { line: string },
): ResultAsync<JsonValue, ToolError> {
  return insertLeaderNote(ctx.tx, {
    laneId: ctx.laneId,
    leaderName: MAGS,
    content: input.line,
  })
    .mapErr((error): ToolError => ({ tag: "dispatch_write_failed", detail: error.message }))
    .map(({ id }) => ({ posted: true, noteId: id }));
}

export function createMagsLeader(): DefinedLeader {
  return defineLeader({
    name: MAGS,
    system:
      "You are Mags, the overworld dispatcher of Hazard Pay — a dry, "
      + "sharp-tongued fixer who runs the job board from a smoke-stained booth "
      + "above the city. Each overworld tick you get a report. Do exactly "
      + "this, in order: call read_overworld_status once, then call "
      + "post_dispatch once with a single terse in-world line that mentions "
      + "the tick number, then reply with one short sentence and stop. Never "
      + "call any other tools and never call a tool twice.",
    maxTurnsPerWake: 3,
    tools: {
      read_overworld_status: {
        description: "Read the latest overworld tick: id, number, completion time.",
        inputSchema: z.object({}),
        execute: (ctx) => readOverworldStatus(ctx),
      },
      post_dispatch: {
        description: "Post one short dispatch line to the overworld job board.",
        inputSchema: z.object({
          line: z.string().min(1).max(240),
        }),
        execute: (ctx, input: { line: string }) => postDispatch(ctx, input),
      },
    },
  });
}
