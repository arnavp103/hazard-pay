import { scriptedModel, textTurn, toolCallTurn } from "@hazard-pay/agent/testing";
import { createTestDatabase } from "@hazard-pay/db/testing";
import env from "@hazard-pay/env";
import { createLogger } from "@hazard-pay/observability";
import { sql } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { expect, test } from "vitest";

import { wakeLeaderLane } from "../domain/leader-wake.ts";
import { runTick } from "../domain/tick.ts";
import { MAGS } from "./index.ts";
import {
  LEADER_DOORBELL_QUEUE,
  LEADER_DOORBELL_QUEUE_OPTIONS,
  leaderTickOutbox,
  setupLeaders,
  wireLeaderRuntime,
} from "./wiring.ts";
import type { TickRow } from "../db/index.ts";

/**
 * Honest integration tests for the leader wiring (issue #52): a
 * template-cloned Postgres, the real pg-boss, the real runtime — only the
 * model is the scripted mock (ADR 0003 consequences: CI runs the whole
 * spine on a stub model, no API key anywhere near the tests).
 */

const logger = createLogger("api-test", { level: "silent", mirrorToStdout: false });

test("keyless boot degrades gracefully: no runtime, no lanes, ticks unaffected", async () => {
  const testDb = await createTestDatabase();
  try {
    const wiring = await setupLeaders({
      db: testDb.db,
      logger,
      env: { ...env, GEMINI_API_KEY: undefined },
    });
    expect(wiring).toBeUndefined();

    // The tick spine keeps ticking with no outbox wired.
    const ticked = await runTick({ db: testDb.db, env, logger });
    expect(ticked.isOk()).toBe(true);
    expect(await testDb.db.query.tick.findMany()).toHaveLength(1);
    expect(await testDb.db.query.laneEvent.findMany()).toHaveLength(0);
  } finally {
    await testDb.drop();
  }
});

test("keyed boot wires the runtime and ensures mags' foreground lane, idempotently", async () => {
  const testDb = await createTestDatabase();
  try {
    // A syntactically-present key is enough: constructing the provider makes
    // no network call, and the mockless wiring path never wakes anything.
    const ctx = { db: testDb.db, logger, env: { ...env, GEMINI_API_KEY: "test-key" } };
    const wiring = await setupLeaders(ctx);
    expect(wiring).toBeDefined();
    expect([...(wiring?.foregroundLanes.keys() ?? [])]).toEqual([MAGS]);

    const lanes = await testDb.db.query.lane.findMany();
    expect(lanes).toHaveLength(1);
    expect(lanes[0]?.leaderName).toBe(MAGS);
    expect(lanes[0]?.kind).toBe("foreground");

    // Second boot reuses the same lane.
    const again = await setupLeaders(ctx);
    expect(again?.foregroundLanes.get(MAGS)).toBe(wiring?.foregroundLanes.get(MAGS));
    expect(await testDb.db.query.lane.findMany()).toHaveLength(1);
  } finally {
    await testDb.drop();
  }
});

test("the tick outbox commits input + doorbell atomically with the tick, singleton per lane", async () => {
  const testDb = await createTestDatabase();
  const boss = new PgBoss(testDb.connectionString);
  boss.on("error", () => undefined);
  try {
    await boss.start();
    await boss.createQueue(LEADER_DOORBELL_QUEUE, LEADER_DOORBELL_QUEUE_OPTIONS);

    const wiring = await wireLeaderRuntime({ db: testDb.db, logger }, scriptedModel([]));
    const laneId = wiring.foregroundLanes.get(MAGS);
    expect(laneId).toBeDefined();

    const ticked = await runTick({
      db: testDb.db,
      env,
      logger,
      tickOutbox: leaderTickOutbox({ boss, wiring }),
    });
    expect(ticked.isOk()).toBe(true);

    // The tick row, the lane input, and the queued doorbell all landed.
    const ticks = await testDb.db.query.tick.findMany();
    expect(ticks).toHaveLength(1);
    const inputs = await testDb.db.query.laneEvent.findMany();
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.laneId).toBe(laneId);
    expect(inputs[0]?.author).toBe("tick");
    expect(JSON.stringify(inputs[0]?.payload)).toContain(
      `Overworld tick ${ticks[0]?.tickNumber ?? -1} completed`,
    );
    const jobs = await testDb.db.execute(
      sql`select singleton_key, state, data from pgboss.job where name = ${LEADER_DOORBELL_QUEUE}`,
    );
    expect(jobs.rows).toHaveLength(1);
    expect(jobs.rows[0]?.singleton_key).toBe(laneId);
    expect(jobs.rows[0]?.data).toEqual({ laneId });

    // A second doorbell for the same lane while one is queued is a no-op
    // (`short` policy + singletonKey: one queued wake per lane), while the
    // input still lands — the queued wake will batch both.
    const fakeTick: TickRow = {
      id: 999,
      tickNumber: 999_999,
      completedAt: new Date(),
      traceparent: null,
    };
    await testDb.db.transaction(async (tx) => {
      await leaderTickOutbox({ boss, wiring })(tx, [fakeTick]);
    });
    const jobsAfter = await testDb.db.execute(
      sql`select id from pgboss.job where name = ${LEADER_DOORBELL_QUEUE}`,
    );
    expect(jobsAfter.rows).toHaveLength(1);
    expect(await testDb.db.query.laneEvent.findMany()).toHaveLength(2);
  } finally {
    await boss.stop();
    await testDb.drop();
  }
});

test("a failing outbox aborts the whole tick: no tick row, no lane input", async () => {
  const testDb = await createTestDatabase();
  try {
    const wiring = await wireLeaderRuntime({ db: testDb.db, logger }, scriptedModel([]));
    const laneId = wiring.foregroundLanes.get(MAGS) ?? "";

    const ticked = await runTick({
      db: testDb.db,
      env,
      logger,
      tickOutbox: async (tx) => {
        // Append succeeds inside the transaction, then the enqueue "fails":
        // the outbox contract says everything must vanish together.
        (
          await wiring.runtime.appendInput({ laneId, author: "tick", content: "doomed", tx })
        )._unsafeUnwrap();
        throw new Error("simulated doorbell enqueue failure");
      },
    });
    expect(ticked.isErr()).toBe(true);
    expect(await testDb.db.query.tick.findMany()).toHaveLength(0);
    expect(await testDb.db.query.laneEvent.findMany()).toHaveLength(0);
  } finally {
    await testDb.drop();
  }
});

test("a doorbell wakes mags: tools run, the dispatch note lands, the log converges", async () => {
  const testDb = await createTestDatabase();
  try {
    const line = "Tick 42 on the board — grid holds, pay your tabs.";
    const model = scriptedModel([
      toolCallTurn([{ toolCallId: "c1", toolName: "read_overworld_status", input: {} }]),
      toolCallTurn([{ toolCallId: "c2", toolName: "post_dispatch", input: { line } }]),
      textTurn("Board's updated. Move along."),
    ]);
    const wiring = await wireLeaderRuntime({ db: testDb.db, logger }, model);
    const laneId = wiring.foregroundLanes.get(MAGS) ?? "";

    (await runTick({ db: testDb.db, env, logger }))._unsafeUnwrap();
    (
      await wiring.runtime.appendInput({ laneId, author: "tick", content: "Overworld tick completed." })
    )._unsafeUnwrap();

    const woke = await wakeLeaderLane({ logger, runtime: wiring.runtime }, { laneId });
    expect(woke.isOk()).toBe(true);

    const notes = await testDb.db.query.leaderNote.findMany();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.leaderName).toBe(MAGS);
    expect(notes[0]?.laneId).toBe(laneId);
    expect(notes[0]?.content).toBe(line);

    const events = await testDb.db.query.laneEvent.findMany({
      orderBy: (table, { asc }) => [asc(table.seq)],
    });
    expect(events.map((row) => row.type)).toEqual([
      "input",
      "model_turn",
      "tool_result",
      "model_turn",
      "tool_result",
      "model_turn",
    ]);

    const verified = await wiring.runtime.verifyFingerprints({ laneId });
    expect(verified.isOk() && verified.value.verified).toBe(3);
  } finally {
    await testDb.drop();
  }
});

test("a doorbell for a lane already waking is a benign skip, not a failure", async () => {
  const testDb = await createTestDatabase();
  try {
    const model = scriptedModel([]);
    const wiring = await wireLeaderRuntime({ db: testDb.db, logger }, model);
    const laneId = wiring.foregroundLanes.get(MAGS) ?? "";
    (
      await wiring.runtime.appendInput({ laneId, author: "tick", content: "pending" })
    )._unsafeUnwrap();

    // Another worker's wake holds a fresh claim.
    await testDb.db.execute(
      sql`update lane set status = 'waking', woke_at = now() where id = ${laneId}`,
    );

    const woke = await wakeLeaderLane({ logger, runtime: wiring.runtime }, { laneId });
    expect(woke.isOk()).toBe(true);
    // The skip never touched the model.
    expect(model.doGenerateCalls).toHaveLength(0);
  } finally {
    await testDb.drop();
  }
});
