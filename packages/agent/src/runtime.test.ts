import { createLogger } from "@hazard-pay/observability";
import { createTestDatabase } from "@hazard-pay/db/testing";
import { lane, laneEvent, tick } from "@hazard-pay/db";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { asc, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { z } from "zod";

import { createHelloLeader } from "./hello-leader.ts";
import { createRuntime } from "./runtime.ts";
import { defineLeader } from "./leader.ts";
import { toolResultPayloadSchema } from "./envelope.ts";
import { scriptedModel, textTurn, toolCallTurn } from "./testing/mock-model.ts";
import type { DefinedLeader } from "./leader.ts";
import type { TestDatabase } from "@hazard-pay/db/testing";
import type { LanguageModel } from "ai";

let tdb: TestDatabase;
const logger = createLogger("agent-test", { level: "silent" });

beforeAll(async () => {
  tdb = await createTestDatabase();
});

afterAll(async () => {
  await tdb.drop();
});

function makeRuntime(model: LanguageModel, leaders: DefinedLeader[]) {
  return createRuntime({ db: tdb.db, model, logger, leaders });
}

async function tickCount(): Promise<number> {
  const [row] = await tdb.db.select({ total: count() }).from(tick);
  return row?.total ?? 0;
}

describe("wake", () => {
  test("batches all pending inputs into one model turn", async () => {
    const model = scriptedModel([textTurn("noted")]);
    const leader = createHelloLeader();
    const runtime = makeRuntime(model, [leader]);

    const { laneId } = (await runtime.createLane({ leader: "hello" }))._unsafeUnwrap();
    await runtime.appendInput({ laneId, author: "tick", content: "tick 1 completed" });
    await runtime.appendInput({ laneId, author: "player:p1", content: "any news?" });

    const report = (await runtime.wake({ laneId }))._unsafeUnwrap();

    expect(report.turns).toBe(1);
    expect(report.quiescent).toBe(true);
    expect(model.doGenerateCalls).toHaveLength(1);
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("tick 1 completed");
    expect(prompt).toContain("any news?");
  });

  test("a wake with nothing pending is quiescent without a model call", async () => {
    const model = scriptedModel([]);
    const runtime = makeRuntime(model, [createHelloLeader()]);
    const { laneId } = (await runtime.createLane({ leader: "hello", kind: "mission" }))
      ._unsafeUnwrap();

    const report = (await runtime.wake({ laneId }))._unsafeUnwrap();

    expect(report.turns).toBe(0);
    expect(report.quiescent).toBe(true);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  test("hello leader: tools run in one transaction each, log converges, fingerprints verify", async () => {
    const before = await tickCount();
    const model = scriptedModel([
      toolCallTurn([{ toolCallId: "c1", toolName: "read_tick_count", input: {} }]),
      toolCallTurn([{ toolCallId: "c2", toolName: "record_tick", input: {} }]),
      textTurn("All quiet: 0 ticks so far, visit recorded."),
    ]);
    const runtime = makeRuntime(model, [createHelloLeader()]);
    // Mission kind: the one foreground hello lane already exists in this db.
    const { laneId } = (await runtime.createLane({ leader: "hello", kind: "mission" }))
      ._unsafeUnwrap();
    await runtime.appendInput({ laneId, author: "tick", content: "status report please" });

    const report = (await runtime.wake({ laneId }))._unsafeUnwrap();

    expect(report.turns).toBe(3);
    expect(report.toolExecutions).toBe(2);
    expect(report.quiescent).toBe(true);

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
      "tool_result",
      "model_turn",
    ]);

    // The mutating tool committed its game write with its tool_result.
    expect(await tickCount()).toBe(before + 1);

    const snapshot = (await runtime.foldLane({ laneId }))._unsafeUnwrap();
    expect(snapshot.openObligations).toEqual([]);

    // Replay determinism: the fold of the persisted log is stable.
    const again = (await runtime.foldLane({ laneId }))._unsafeUnwrap();
    expect(JSON.stringify(again)).toBe(JSON.stringify(snapshot));

    const verified = (await runtime.verifyFingerprints({ laneId }))._unsafeUnwrap();
    expect(verified.verified).toBe(3);
  });

  test("a tool err() rolls back its game write but records the failure", async () => {
    const leader = defineLeader({
      name: "rollback",
      system: "test",
      maxTurnsPerWake: 4,
      tools: {
        write_then_fail: {
          description: "writes a tick then fails",
          inputSchema: z.object({}),
          execute: (ctx) =>
            ResultAsync.fromPromise(
              ctx.tx.insert(tick).values({}),
              () => ({ tag: "insert_failed" }),
            ).andThen(() => errAsync({ tag: "deliberate_failure" })),
        },
      },
    });
    const before = await tickCount();
    const model = scriptedModel([
      toolCallTurn([{ toolCallId: "c1", toolName: "write_then_fail", input: {} }]),
      textTurn("that failed, moving on"),
    ]);
    const runtime = makeRuntime(model, [leader]);
    const { laneId } = (await runtime.createLane({ leader: "rollback", kind: "mission" }))
      ._unsafeUnwrap();
    await runtime.appendInput({ laneId, author: "test", content: "go" });

    const report = (await runtime.wake({ laneId }))._unsafeUnwrap();
    expect(report.quiescent).toBe(true);

    // The savepoint rolled the write back...
    expect(await tickCount()).toBe(before);

    // ...but the failure is a recorded lane event the model saw.
    const rows = await tdb.db
      .select()
      .from(laneEvent)
      .where(eq(laneEvent.laneId, laneId))
      .orderBy(asc(laneEvent.seq));
    const results = rows.filter((row) => row.type === "tool_result");
    expect(results).toHaveLength(1);
    const payload = toolResultPayloadSchema.parse(results[0]?.payload);
    expect(payload.isError).toBe(true);
    expect(payload.output).toEqual({ tag: "deliberate_failure" });
  });

  test("maxTurnsPerWake bounds a wake short of quiescence", async () => {
    const leader = defineLeader({
      name: "bounded",
      system: "test",
      maxTurnsPerWake: 1,
      tools: {
        noop: {
          description: "does nothing",
          inputSchema: z.object({}),
          execute: () => okAsync({ ok: true }),
        },
      },
    });
    const model = scriptedModel([
      toolCallTurn([{ toolCallId: "c1", toolName: "noop", input: {} }]),
    ]);
    const runtime = makeRuntime(model, [leader]);
    const { laneId } = (await runtime.createLane({ leader: "bounded", kind: "mission" }))
      ._unsafeUnwrap();
    await runtime.appendInput({ laneId, author: "test", content: "go" });

    const report = (await runtime.wake({ laneId }))._unsafeUnwrap();

    // One turn, its obligation discharged, then the budget stops the wake
    // with the tool result still unseen by the model.
    expect(report.turns).toBe(1);
    expect(report.toolExecutions).toBe(1);
    expect(report.quiescent).toBe(false);
  });

  test("a failed model call releases the wake claim", async () => {
    const model = scriptedModel([]);
    const runtime = makeRuntime(model, [createHelloLeader()]);
    const { laneId } = (await runtime.createLane({ leader: "hello", kind: "mission" }))
      ._unsafeUnwrap();
    await runtime.appendInput({ laneId, author: "test", content: "go" });

    // Empty script: the mock has no result for the call and throws.
    const error = (await runtime.wake({ laneId }))._unsafeUnwrapErr();
    expect(error.tag).toBe("ModelCallFailed");

    const [row] = await tdb.db.select().from(lane).where(eq(lane.id, laneId));
    expect(row?.status).toBe("open");
  });
});
