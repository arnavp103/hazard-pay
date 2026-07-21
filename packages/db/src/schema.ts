import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One scheduled advancement of the overworld (CONTEXT.md: Tick).
 *
 * - `id` is the monotone sequence the match-tier transport resumes from
 *   (ADR 0004 §5: SSE `Last-Event-ID` cursors read this table — the table is
 *   the truth, NOTIFY is only a nudge).
 * - `tickNumber` is the idempotency key (ADR 0004 §4): derived from wall
 *   clock / `TICK_INTERVAL`, unique, so cron re-fires and backfill re-runs
 *   insert nothing twice. Global for the walking skeleton — what a tick
 *   ticks over is deliberately unnamed until the domain grows.
 * - `traceparent` carries the ticking transaction's W3C trace context into
 *   the transport envelope (ADR 0005 §6): notifications carry no payload and
 *   fan-out reads come from this table, so the trace rides the row.
 */
export const tick = pgTable("tick", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  tickNumber: bigint("tick_number", { mode: "number" }).notNull().unique(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  traceparent: text("traceparent"),
});
