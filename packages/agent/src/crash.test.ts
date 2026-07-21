import { createLogger } from "@hazard-pay/observability";
import { createTestDatabase } from "@hazard-pay/db/testing";
import { lane, laneEvent, leaderNote } from "@hazard-pay/db";
import { ResultAsync } from "neverthrow";
import { asc, count, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { z } from "zod";

import { createRuntime } from "./runtime.ts";
import { defineLeader } from "./leader.ts";
import { scriptedModel, textTurn, toolCallTurn } from "./testing/mock-model.ts";
import type { TestDatabase } from "@hazard-pay/db/testing";

let tdb: TestDatabase;
const logger = createLogger("agent-test", { level: "silent" });

beforeAll(async () => {
  tdb = await createTestDatabase();
});

afterAll(async () => {
  await tdb.drop();
});

async function noteCount(): Promise<number> {
  const [row] = await tdb.db.select({ total: count() }).from(leaderNote);
  return row?.total ?? 0;
}

describe("kill mid-wake", () => {
  test("log and world converge: a defect mid-tool commits neither, recovery discharges exactly once", async () => {
    // A tool that dies (defect, not err) on its first execution — after its
    // game write, before its tool_result — and succeeds on the second.
    let executions = 0;
    const flaky = defineLeader({
      name: "flaky",
      system: "test",
      maxTurnsPerWake: 4,
      tools: {
        record_once: {
          description: "records a note, crashing the first time",
          inputSchema: z.object({}),
          execute: (ctx) =>
            // fromSafePromise: a rejection here is a defect (the simulated
            // crash), not a recoverable tool error.
            ResultAsync.fromSafePromise(
              (async () => {
                executions += 1;
                await ctx.tx.insert(leaderNote).values({
                  laneId: ctx.laneId,
                  leaderName: "flaky",
                  content: "recorded exactly once",
                });
                if (executions === 1) {
                  throw new Error("simulated crash between game write and tool_result");
                }
                return { recorded: true };
              })(),
            ),
        },
      },
    });

    const before = await noteCount();

    // Wake 1: the model asks for the tool; the tool crashes mid-transaction.
    const model1 = scriptedModel([
      toolCallTurn([{ toolCallId: "c1", toolName: "record_once", input: {} }]),
    ]);
    const runtime1 = createRuntime({ db: tdb.db, model: model1, logger, leaders: [flaky] });
    const { laneId } = (await runtime1.createLane({ leader: "flaky" }))._unsafeUnwrap();
    await runtime1.appendInput({ laneId, author: "test", content: "record it" });

    const crashed = await runtime1.wake({ laneId });
    expect(crashed.isErr()).toBe(true);

    // The one-transaction invariant held: the model_turn (with its tool
    // call) committed, but neither the game write nor the tool_result did.
    const rowsAfterCrash = await tdb.db
      .select()
      .from(laneEvent)
      .where(eq(laneEvent.laneId, laneId))
      .orderBy(asc(laneEvent.seq));
    expect(rowsAfterCrash.map((row) => row.type)).toEqual(["input", "model_turn"]);
    expect(await noteCount()).toBe(before);

    // Wake 2: resume folds the log, finds the unresolved obligation, and
    // discharges it — the write and the tool_result commit together, once.
    const model2 = scriptedModel([textTurn("recorded after recovery")]);
    const runtime2 = createRuntime({ db: tdb.db, model: model2, logger, leaders: [flaky] });
    const report = (await runtime2.wake({ laneId }))._unsafeUnwrap();

    expect(report.toolExecutions).toBe(1);
    expect(report.quiescent).toBe(true);
    expect(await noteCount()).toBe(before + 1);
    expect(executions).toBe(2);

    const rows = await tdb.db
      .select()
      .from(laneEvent)
      .where(eq(laneEvent.laneId, laneId))
      .orderBy(asc(laneEvent.seq));
    expect(rows.map((row) => row.type)).toEqual([
      "input",
      "model_turn",
      "tool_result",
      "model_turn",
    ]);

    // The recovered log still replays deterministically.
    const verified = (await runtime2.verifyFingerprints({ laneId }))._unsafeUnwrap();
    expect(verified.verified).toBe(2);
  });

  test("a dead process's stale claim is reclaimed by the next wake", async () => {
    const idle = defineLeader({ name: "idle", system: "test", maxTurnsPerWake: 2, tools: {} });
    const model = scriptedModel([textTurn("hello again")]);
    const runtime = createRuntime({
      db: tdb.db,
      model,
      logger,
      leaders: [idle],
      reclaimStaleWakeAfterMs: 1000,
    });
    const { laneId } = (await runtime.createLane({ leader: "idle" }))._unsafeUnwrap();
    await runtime.appendInput({ laneId, author: "test", content: "hi" });

    // Simulate a crashed wake: claim held by a process that died minutes ago.
    await tdb.db
      .update(lane)
      .set({ status: "waking", wokeAt: sql`now() - interval '10 minutes'` })
      .where(eq(lane.id, laneId));

    const report = (await runtime.wake({ laneId }))._unsafeUnwrap();
    expect(report.turns).toBe(1);
    expect(report.quiescent).toBe(true);
  });
});
