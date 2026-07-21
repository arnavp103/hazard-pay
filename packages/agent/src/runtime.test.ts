import { createLogger } from "@hazard-pay/observability";
import { createTestDatabase } from "@hazard-pay/db/testing";
import { lane, laneEvent, leaderNote } from "@hazard-pay/db";
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

async function noteCount(): Promise<number> {
  const [row] = await tdb.db.select({ total: count() }).from(leaderNote);
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
    const before = await noteCount();
    const model = scriptedModel([
      toolCallTurn([{ toolCallId: "c1", toolName: "read_tick_count", input: {} }]),
      toolCallTurn([{ toolCallId: "c2", toolName: "record_visit", input: {} }]),
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
    expect(await noteCount()).toBe(before + 1);

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
          description: "writes a note then fails",
          inputSchema: z.object({}),
          execute: (ctx) =>
            ResultAsync.fromPromise(
              ctx.tx.insert(leaderNote).values({
                laneId: ctx.laneId,
                leaderName: "rollback",
                content: "this write must roll back",
              }),
              () => ({ tag: "insert_failed" }),
            ).andThen(() => errAsync({ tag: "deliberate_failure" })),
        },
      },
    });
    const before = await noteCount();
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
    expect(await noteCount()).toBe(before);

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

describe("ensureForegroundLane", () => {
  test("creates once, returns the same lane after, and a config edit restamps without breaking verification", async () => {
    const v1 = defineLeader({ name: "boot", system: "v1", maxTurnsPerWake: 2, tools: {} });
    const runtime = makeRuntime(scriptedModel([textTurn("hello")]), [v1]);

    const first = (await runtime.ensureForegroundLane({ leader: "boot" }))._unsafeUnwrap();
    expect(first.created).toBe(true);
    const again = (await runtime.ensureForegroundLane({ leader: "boot" }))._unsafeUnwrap();
    expect(again).toEqual({ laneId: first.laneId, configHash: v1.configHash, created: false });

    // One model turn under v1: its fingerprint records v1's hash.
    await runtime.appendInput({ laneId: first.laneId, author: "test", content: "hi" });
    (await runtime.wake({ laneId: first.laneId }))._unsafeUnwrap();

    // The config changes in git: ensure restamps the lane...
    const v2 = defineLeader({ name: "boot", system: "v2", maxTurnsPerWake: 2, tools: {} });
    expect(v2.configHash).not.toBe(v1.configHash);
    const runtime2 = makeRuntime(scriptedModel([textTurn("hello again")]), [v2]);
    const restamped = (await runtime2.ensureForegroundLane({ leader: "boot" }))._unsafeUnwrap();
    expect(restamped.laneId).toBe(first.laneId);
    expect(restamped.configHash).toBe(v2.configHash);

    // ...wakes proceed under v2 without ConfigDrift...
    await runtime2.appendInput({ laneId: first.laneId, author: "test", content: "again" });
    (await runtime2.wake({ laneId: first.laneId }))._unsafeUnwrap();

    // ...and the mixed-config log still verifies end to end: each
    // model_turn carries the config hash it actually ran under.
    const verified = (await runtime2.verifyFingerprints({ laneId: first.laneId }))
      ._unsafeUnwrap();
    expect(verified.verified).toBe(2);
  });
});

describe("appendInput in a caller transaction (the outbox seam)", () => {
  test("the input commits with the caller's write and vanishes with the caller's rollback", async () => {
    const idle = defineLeader({ name: "outbox", system: "test", maxTurnsPerWake: 2, tools: {} });
    const runtime = makeRuntime(scriptedModel([]), [idle]);
    const { laneId } = (await runtime.ensureForegroundLane({ leader: "outbox" }))
      ._unsafeUnwrap();

    // Commit path: the append rides the caller's open transaction.
    await tdb.db.transaction(async (tx) => {
      (
        await runtime.appendInput({ laneId, author: "tick", content: "tick 7 completed", tx })
      )._unsafeUnwrap();
    });

    // Rollback path: the caller aborts after a successful append; the input
    // must vanish with the transaction (atomic with its cause, or not at all).
    await expect(
      tdb.db.transaction(async (tx) => {
        (
          await runtime.appendInput({ laneId, author: "tick", content: "doomed", tx })
        )._unsafeUnwrap();
        throw new Error("abort the outbox transaction");
      }),
    ).rejects.toThrow("abort the outbox transaction");

    const rows = await tdb.db
      .select()
      .from(laneEvent)
      .where(eq(laneEvent.laneId, laneId))
      .orderBy(asc(laneEvent.seq));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.author).toBe("tick");
  });
});
