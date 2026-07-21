import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { lane } from "./agent-schema.ts";

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

/**
 * A short in-world note a leader records in the overworld — the walking
 * skeleton's honest leader game write (issue #52). Leader mutating tools
 * write THIS table, never `tick`: ticks belong exclusively to the worker's
 * cron writer (ADR 0004 §4), while a note is a domain fact a leader chose
 * to record, committed in the same transaction as its `tool_result` lane
 * event (ADR 0003 §2). `lane_id` links each note to the lane whose wake
 * produced it, so trace tooling can walk note → lane → transcript.
 */
export const leaderNote = pgTable(
  "leader_note",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    laneId: uuid("lane_id")
      .notNull()
      .references(() => lane.id),
    /** Denormalized from the lane's leader — the note index reads one table. */
    leaderName: text("leader_name").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("leader_note_lane_id_idx").on(table.laneId)],
);
