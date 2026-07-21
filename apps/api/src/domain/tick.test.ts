import { createTestDatabase } from "@hazard-pay/db/testing";
import env from "@hazard-pay/env";
import { createLogger } from "@hazard-pay/observability";
import pg from "pg";
import { expect, test } from "vitest";

import { recordDueTicks, TICK_CHANNEL } from "../db/index.ts";
import { runTick } from "./tick.ts";

/**
 * Honest integration tests for the tick writer (ADR 0004 §4, §5): a
 * template-cloned Postgres, the real transaction, a real LISTEN connection —
 * nothing mocked.
 */
const MINUTE = 60_000;

test("recordDueTicks is idempotent and backfills exactly the due numbers", async () => {
  const testDb = await createTestDatabase();
  try {
    const t0 = new Date("2026-07-21T12:00:30Z");

    // First run on an empty table records only the current tick — history
    // before the world existed is not backfilled.
    const first = await recordDueTicks(testDb.db, { now: t0, intervalMs: MINUTE });
    expect(first.isOk() && first.value.map((row) => row.tickNumber)).toEqual([
      Math.floor(t0.getTime() / MINUTE),
    ]);

    // Same instant again: nothing due, nothing written.
    const again = await recordDueTicks(testDb.db, { now: t0, intervalMs: MINUTE });
    expect(again.isOk() && again.value).toEqual([]);

    // Three intervals later: the two missed numbers and the current one, in
    // order, consecutively — the backfill (ADR 0004 §4).
    const later = new Date(t0.getTime() + 3 * MINUTE);
    const caughtUp = await recordDueTicks(testDb.db, { now: later, intervalMs: MINUTE });
    const base = Math.floor(t0.getTime() / MINUTE);
    expect(caughtUp.isOk() && caughtUp.value.map((row) => row.tickNumber)).toEqual([
      base + 1,
      base + 2,
      base + 3,
    ]);
  } finally {
    await testDb.drop();
  }
});

test("the ticking transaction nudges TICK_CHANNEL on commit", async () => {
  const testDb = await createTestDatabase();
  const listener = new pg.Client({ connectionString: testDb.connectionString });
  try {
    await listener.connect();
    const nudged = new Promise<string>((resolve) => {
      listener.on("notification", (message) => resolve(message.channel));
    });
    await listener.query(`listen ${TICK_CHANNEL}`);

    const result = await recordDueTicks(testDb.db, { now: new Date(), intervalMs: MINUTE });
    expect(result.isOk()).toBe(true);
    expect(await nudged).toBe(TICK_CHANNEL);
  } finally {
    await listener.end();
    await testDb.drop();
  }
});

test("runTick records a tick through the job-shaped domain function", async () => {
  const testDb = await createTestDatabase();
  try {
    const ctx = {
      db: testDb.db,
      env,
      logger: createLogger("api-test", { level: "silent", mirrorToStdout: false }),
    };
    const result = await runTick(ctx);
    expect(result.isOk()).toBe(true);

    // A second run inside the same interval window is a no-op — the unique
    // tick_number makes cron re-fires safe.
    const rerun = await runTick(ctx);
    expect(rerun.isOk()).toBe(true);

    const rows = await testDb.db.query.tick.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tickNumber).toBe(Math.floor(Date.now() / env.TICK_INTERVAL));
  } finally {
    await testDb.drop();
  }
});
