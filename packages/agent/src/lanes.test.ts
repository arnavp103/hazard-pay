import { createLogger } from "@hazard-pay/observability";
import { createTestDatabase } from "@hazard-pay/db/testing";
import { lane, laneEvent } from "@hazard-pay/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createRuntime } from "./runtime.ts";
import { defineLeader } from "./leader.ts";
import { inputPayloadSchema, toolResultPayloadSchema } from "./envelope.ts";
import { scriptedModel, textTurn, toolCallTurn } from "./testing/mock-model.ts";
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

const boss = defineLeader({ name: "boss", system: "you lead", maxTurnsPerWake: 4, tools: {} });
const scout = defineLeader({ name: "scout", system: "you scout", maxTurnsPerWake: 4, tools: {} });

function makeRuntime(model: LanguageModel): ReturnType<typeof createRuntime> {
  return createRuntime({ db: tdb.db, model, logger, leaders: [boss, scout] });
}

describe("octopus lanes", () => {
  test("spawn-and-report: spawn returns a receipt, the mission reports via send_message", async () => {
    // Phase 1 — the boss spawns a scout mission.
    const bossModel = scriptedModel([
      toolCallTurn([
        {
          toolCallId: "c1",
          toolName: "spawn_lane",
          input: { leader: "scout", input: "count the things" },
        },
      ]),
      textTurn("scout dispatched"),
    ]);
    const runtime1 = makeRuntime(bossModel);
    const { laneId: bossLaneId } = (await runtime1.createLane({ leader: "boss" }))
      ._unsafeUnwrap();
    await runtime1.appendInput({ laneId: bossLaneId, author: "tick", content: "send a scout" });

    const report = (await runtime1.wake({ laneId: bossLaneId }))._unsafeUnwrap();
    expect(report.spawnedLaneIds).toHaveLength(1);
    const missionLaneId = report.spawnedLaneIds[0] ?? "";

    // The mission lane exists, linked to its parent, briefed by it.
    const [missionRow] = await tdb.db.select().from(lane).where(eq(lane.id, missionLaneId));
    expect(missionRow?.kind).toBe("mission");
    expect(missionRow?.parentLaneId).toBe(bossLaneId);
    expect(missionRow?.leaderName).toBe("scout");

    const missionEvents = await tdb.db
      .select()
      .from(laneEvent)
      .where(eq(laneEvent.laneId, missionLaneId))
      .orderBy(asc(laneEvent.seq));
    expect(missionEvents).toHaveLength(1);
    const briefing = inputPayloadSchema.parse(missionEvents[0]?.payload);
    expect(briefing.content).toBe("count the things");
    expect(missionEvents[0]?.author).toBe(bossLaneId);

    // The receipt was recorded on the boss's log — spawn is never awaited.
    const bossEvents = await tdb.db
      .select()
      .from(laneEvent)
      .where(eq(laneEvent.laneId, bossLaneId))
      .orderBy(asc(laneEvent.seq));
    const receipt = bossEvents.find((row) => row.type === "tool_result");
    expect(toolResultPayloadSchema.parse(receipt?.payload).output).toEqual({
      spawned: true,
      laneId: missionLaneId,
    });

    // Phase 2 — the scout wakes and reports back to its parent.
    const scoutModel = scriptedModel([
      toolCallTurn([
        {
          toolCallId: "c2",
          toolName: "send_message",
          input: { laneId: bossLaneId, content: "found 3 things" },
        },
      ]),
      textTurn("report sent"),
    ]);
    const runtime2 = makeRuntime(scoutModel);
    const scoutReport = (await runtime2.wake({ laneId: missionLaneId }))._unsafeUnwrap();
    expect(scoutReport.messagedLaneIds).toEqual([bossLaneId]);

    const bossInputs = (
      await tdb.db
        .select()
        .from(laneEvent)
        .where(eq(laneEvent.laneId, bossLaneId))
        .orderBy(asc(laneEvent.seq))
    ).filter((row) => row.type === "input");
    const reportInput = bossInputs.at(-1);
    expect(reportInput?.author).toBe(missionLaneId);
    expect(inputPayloadSchema.parse(reportInput?.payload).content).toBe("found 3 things");

    // Phase 3 — the boss cancels the mission; the lane closes for good.
    const cancelModel = scriptedModel([
      toolCallTurn([
        { toolCallId: "c3", toolName: "cancel_lane", input: { laneId: missionLaneId } },
      ]),
      textTurn("mission over"),
    ]);
    const runtime3 = makeRuntime(cancelModel);
    (await runtime3.wake({ laneId: bossLaneId }))._unsafeUnwrap();

    const [closedRow] = await tdb.db.select().from(lane).where(eq(lane.id, missionLaneId));
    expect(closedRow?.status).toBe("closed");

    const deadWake = (await runtime3.wake({ laneId: missionLaneId }))._unsafeUnwrapErr();
    expect(deadWake.tag).toBe("LaneClosed");
  });

  test("only one foreground lane per leader", async () => {
    const runtime = makeRuntime(scriptedModel([]));
    (await runtime.createLane({ leader: "scout" }))._unsafeUnwrap();
    const second = await runtime.createLane({ leader: "scout" });
    expect(second._unsafeUnwrapErr().tag).toBe("ForegroundLaneExists");
  });

  test("unknown leaders are rejected at lane creation", async () => {
    const runtime = makeRuntime(scriptedModel([]));
    const result = await runtime.createLane({ leader: "nobody" });
    expect(result._unsafeUnwrapErr()).toEqual({ tag: "UnknownLeader", leaderName: "nobody" });
  });
});
