import { bigint, pgTable, timestamp } from "drizzle-orm/pg-core";

/**
 * One scheduled advancement of the overworld (CONTEXT.md: Tick).
 * Walking-skeleton table: the hello-world tick loop records a row per
 * completed tick; the round-trip test writes and reads one.
 */
export const tick = pgTable("tick", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});
