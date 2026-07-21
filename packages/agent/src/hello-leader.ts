import { tick } from "@hazard-pay/db";
import { ResultAsync } from "neverthrow";
import { count } from "drizzle-orm";
import { z } from "zod";

import { defineLeader } from "./leader.ts";
import type { DefinedLeader, ToolExecutionCtx } from "./leader.ts";
import type { JsonValue } from "./envelope.ts";
import type { ToolError } from "./leader.ts";

/**
 * Walking-skeleton domain functions over the `tick` table (ADR 0003 §2: a
 * tool invokes a domain function in-process; the HTTP route and the leader
 * tool are two derivations of the same contract). Real leaders live in
 * `apps/api/src/leaders/` — this fixture exists so the runtime's proofs and
 * the live smoke have one honest leader to run.
 */

function readTickCount(ctx: ToolExecutionCtx): ResultAsync<JsonValue, ToolError> {
  return ResultAsync.fromPromise(
    ctx.tx.select({ total: count() }).from(tick),
    (cause): ToolError => ({ tag: "tick_read_failed", detail: String(cause) }),
  ).map(([row]) => ({ tickCount: row?.total ?? 0 }));
}

function recordTick(ctx: ToolExecutionCtx): ResultAsync<JsonValue, ToolError> {
  return ResultAsync.fromPromise(
    // Placeholder tick_number (ms epoch): this is the hello tool's scratch
    // game write, not the real tick writer — the worker's cron derives real
    // numbers as floor(time / TICK_INTERVAL) (ADR 0004 §4).
    ctx.tx.insert(tick).values({ tickNumber: Date.now() }).returning({ id: tick.id }),
    (cause): ToolError => ({ tag: "tick_write_failed", detail: String(cause) }),
  ).map(([row]) => ({ recorded: true, tickId: row?.id ?? null }));
}

/**
 * The hello leader: minimal persona, one read tool and one mutating tool.
 * `record_tick`'s insert commits in the same transaction as its
 * `tool_result` lane event — the mutating path is the proof of the
 * one-transaction rule (ADR 0003 §2).
 */
export function createHelloLeader(): DefinedLeader {
  return defineLeader({
    name: "hello",
    system:
      "You are the hello leader, a friendly overworld caretaker in Hazard Pay. "
      + "When asked for a status report: first call read_tick_count to see how "
      + "far the overworld has advanced, then call record_tick exactly once to "
      + "mark your visit, then answer with one short sentence that includes the "
      + "tick count. Do not call any other tools.",
    maxTurnsPerWake: 4,
    tools: {
      read_tick_count: {
        description: "Read how many overworld ticks have completed.",
        inputSchema: z.object({}),
        execute: (ctx) => readTickCount(ctx),
      },
      record_tick: {
        description: "Record one completed overworld tick.",
        inputSchema: z.object({}),
        execute: (ctx) => recordTick(ctx),
      },
    },
  });
}
