import { createTestDatabase } from "@hazard-pay/db/testing";
import { lane } from "@hazard-pay/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { ENVELOPE_VERSION } from "./envelope.ts";
import {
  appendLaneEvent,
  claimWake,
  ensureLeaderConfig,
  insertLane,
  loadLaneEvents,
  nextSeq,
  releaseWake,
} from "./store.ts";
import type { LaneEventPayload } from "./envelope.ts";
import type { TestDatabase } from "@hazard-pay/db/testing";

let tdb: TestDatabase;

beforeAll(async () => {
  tdb = await createTestDatabase();
});

afterAll(async () => {
  await tdb.drop();
});

async function makeLane(kind: "foreground" | "mission" = "mission"): Promise<string> {
  await ensureLeaderConfig(tdb.db, { hash: "h1", config: { v: 1 } });
  const row = await insertLane(tdb.db, {
    kind,
    leaderName: `leader-${Math.random().toString(36).slice(2)}`,
    configHash: "h1",
  });
  return row._unsafeUnwrap().id;
}

const inputPayload = {
  v: ENVELOPE_VERSION,
  kind: "input",
  content: "x",
} as const satisfies LaneEventPayload;

describe("lane event append guard", () => {
  test("appends are gapless and the PK rejects a duplicate seq", async () => {
    const laneId = await makeLane();

    const first = await appendLaneEvent(tdb.db, {
      laneId,
      seq: 1,
      author: "test",
      type: "input",
      payload: inputPayload,
    });
    expect(first.isOk()).toBe(true);

    const duplicate = await appendLaneEvent(tdb.db, {
      laneId,
      seq: 1,
      author: "test",
      type: "input",
      payload: inputPayload,
    });
    expect(duplicate._unsafeUnwrapErr()).toEqual({ tag: "AppendConflict", laneId, seq: 1 });

    expect((await nextSeq(tdb.db, laneId))._unsafeUnwrap()).toBe(2);
    const rows = (await loadLaneEvents(tdb.db, laneId))._unsafeUnwrap();
    expect(rows.map((row) => row.seq)).toEqual([1]);
  });

  test("one foreground lane per leader is enforced", async () => {
    await ensureLeaderConfig(tdb.db, { hash: "h1", config: { v: 1 } });
    const first = await insertLane(tdb.db, {
      kind: "foreground",
      leaderName: "highlander",
      configHash: "h1",
    });
    expect(first.isOk()).toBe(true);

    const second = await insertLane(tdb.db, {
      kind: "foreground",
      leaderName: "highlander",
      configHash: "h1",
    });
    expect(second._unsafeUnwrapErr().tag).toBe("ForegroundLaneExists");
  });
});

describe("wake claim", () => {
  test("open claims, concurrent claim conflicts, release reopens", async () => {
    const laneId = await makeLane();
    const claimedAt = new Date();

    const claimed = await claimWake(tdb.db, { laneId, staleAfterMs: 60_000, claimedAt });
    expect(claimed._unsafeUnwrap().status).toBe("waking");

    const contested = await claimWake(tdb.db, {
      laneId,
      staleAfterMs: 60_000,
      claimedAt: new Date(),
    });
    expect(contested._unsafeUnwrapErr()).toEqual({ tag: "WakeClaimConflict", laneId });

    await releaseWake(tdb.db, { laneId, claimedAt });
    const reclaimed = await claimWake(tdb.db, {
      laneId,
      staleAfterMs: 60_000,
      claimedAt: new Date(),
    });
    expect(reclaimed.isOk()).toBe(true);
  });

  test("release is guarded by the claim token: a stale claimant cannot free a new claim", async () => {
    const laneId = await makeLane();
    const oldClaim = new Date(Date.now() - 10 * 60 * 1000);
    await claimWake(tdb.db, { laneId, staleAfterMs: 60_000, claimedAt: oldClaim });

    // A second wake reclaims the stale claim with its own token.
    const newClaim = new Date();
    const reclaimed = await claimWake(tdb.db, {
      laneId,
      staleAfterMs: 1000,
      claimedAt: newClaim,
    });
    expect(reclaimed.isOk()).toBe(true);

    // The original (dead-slow) claimant's release must be a no-op.
    await releaseWake(tdb.db, { laneId, claimedAt: oldClaim });
    const [row] = await tdb.db.select().from(lane).where(eq(lane.id, laneId));
    expect(row?.status).toBe("waking");

    // The rightful claimant's release works.
    await releaseWake(tdb.db, { laneId, claimedAt: newClaim });
    const [reopened] = await tdb.db.select().from(lane).where(eq(lane.id, laneId));
    expect(reopened?.status).toBe("open");
  });

  test("a stale waking claim is reclaimable (crash recovery)", async () => {
    const laneId = await makeLane();
    await tdb.db
      .update(lane)
      .set({ status: "waking", wokeAt: sql`now() - interval '10 minutes'` })
      .where(eq(lane.id, laneId));

    const fresh = await claimWake(tdb.db, {
      laneId,
      staleAfterMs: 60 * 60 * 1000,
      claimedAt: new Date(),
    });
    expect(fresh._unsafeUnwrapErr().tag).toBe("WakeClaimConflict");

    const reclaimed = await claimWake(tdb.db, {
      laneId,
      staleAfterMs: 1000,
      claimedAt: new Date(),
    });
    expect(reclaimed._unsafeUnwrap().status).toBe("waking");
  });
});
