import { tick, type Db } from "@hazard-pay/db";
import { asc, desc, gt, max, sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { DbLike, DbTx } from "@hazard-pay/db";
import type { DbUnreachableError } from "../domain/errors.ts";
import { toDbUnreachable } from "./unreachable.ts";

/** One recorded tick, as the rest of the app talks about it. */
export type TickRow = typeof tick.$inferSelect;

/**
 * The NOTIFY channel the ticking transaction nudges (ADR 0004 §5).
 * Notifications never carry payloads — subscribers re-query the table from
 * their own cursor; a nudge can only say "look again".
 */
export const TICK_CHANNEL = "tick_recorded";

/**
 * Never write more than this many backfill rows in one run — a wildly
 * shrunken `TICK_INTERVAL` must not turn one cron firing into an unbounded
 * insert. Older missed numbers are skipped, not queued: state being current
 * is what matters (ADR 0004 §4), not replaying history.
 */
const MAX_TICKS_PER_RUN = 1000;

/**
 * The outbox hook (ADR 0003 §6, issue #52): runs INSIDE the ticking
 * transaction, after the rows are inserted, only when at least one tick was
 * recorded. Whatever it writes — leader lane inputs, pg-boss doorbell jobs —
 * commits atomically with the tick rows; a throw aborts the whole tick.
 */
export type TickOutbox = (tx: DbTx, recorded: TickRow[]) => Promise<void>;

export interface RecordDueTicksArgs {
  now: Date;
  intervalMs: number;
  /** The ticking span's W3C context, stored on each row (ADR 0005 §6). */
  traceparent?: string | undefined;
  outbox?: TickOutbox | undefined;
}

/**
 * The tick writer (ADR 0004 §4): one transaction that backfills every due
 * tick number up to `floor(now / interval)` and nudges `TICK_CHANNEL`.
 * Idempotent on `tick_number` — cron re-fires, boot catch-ups, and
 * concurrent runs insert nothing twice (unique constraint +
 * `onConflictDoNothing`). Postgres delivers the NOTIFY only on commit, so
 * subscribers can never observe the nudge before the rows.
 */
export function recordDueTicks(
  db: Db,
  args: RecordDueTicksArgs,
): ResultAsync<TickRow[], DbUnreachableError> {
  return ResultAsync.fromPromise(
    db.transaction(async (tx) => {
      const currentNumber = Math.floor(args.now.getTime() / args.intervalMs);
      const [row] = await tx.select({ latest: max(tick.tickNumber) }).from(tick);
      const latest = row?.latest ?? null;
      const firstDue = latest === null
        ? currentNumber
        : Math.max(latest + 1, currentNumber - MAX_TICKS_PER_RUN + 1);
      if (firstDue > currentNumber) {
        return [];
      }
      const values = [];
      for (let tickNumber = firstDue; tickNumber <= currentNumber; tickNumber += 1) {
        values.push({
          tickNumber,
          completedAt: args.now,
          traceparent: args.traceparent ?? null,
        });
      }
      const inserted = await tx.insert(tick).values(values).onConflictDoNothing().returning();
      if (inserted.length > 0) {
        await tx.execute(sql`select pg_notify(${TICK_CHANNEL}, '')`);
        if (args.outbox !== undefined) {
          await args.outbox(tx, inserted);
        }
      }
      return inserted;
    }),
    toDbUnreachable,
  );
}

/**
 * The overworld polling read (ADR 0004 §4): the single latest tick.
 * `DbLike`: leader tools call this with their open tool transaction.
 */
export function latestTick(db: DbLike): ResultAsync<TickRow | null, DbUnreachableError> {
  return ResultAsync.fromPromise(
    db.select().from(tick).orderBy(desc(tick.id)).limit(1),
    toDbUnreachable,
  ).map((rows) => rows[0] ?? null);
}

/**
 * The fan-out read (ADR 0004 §5): every tick after a subscriber's cursor,
 * oldest first — connect, resume, and live-tail are all this one query.
 */
export function ticksAfter(db: Db, afterId: number): ResultAsync<TickRow[], DbUnreachableError> {
  return ResultAsync.fromPromise(
    db.select().from(tick).where(gt(tick.id, afterId)).orderBy(asc(tick.id)).limit(500),
    toDbUnreachable,
  );
}
