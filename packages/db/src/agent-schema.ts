import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Agent-runtime tables (ADR 0003). The append-only lane event log IS the
 * checkpoint layer — there are no separate step-checkpoint tables. Store
 * functions and payload envelope types live in `@hazard-pay/agent`; this
 * package owns only the row shapes and their invariants.
 *
 * Vocabulary (CONTEXT.md): a *lane* is one thread of a leader's context — an
 * append-only log of *lane events* (inputs, model turns, tool results,
 * compactions). A *leader config* is the declarative definition of a leader.
 */

/**
 * Full leader config JSON stored once per content hash (ADR 0003 §3). Git is
 * the source of truth; this table exists so any historical lane can name the
 * exact config it ran under, enabling cross-model/cross-prompt trace
 * comparison. Rows are immutable: same hash, same config, forever.
 */
export const leaderConfig = pgTable("leader_config", {
  /** sha-256 over the canonical JSON of the config's hashable projection. */
  hash: text("hash").primaryKey(),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One thread of a leader's context (ADR 0003 §4). A leader owns exactly one
 * long-lived `foreground` lane (partial unique index below) plus bounded
 * `mission` lanes spawned for specific goals, linked via `parent_lane_id`.
 *
 * `status` is the wake claim: the loop claims by guarded update
 * (`open → waking`, stamping `woke_at`), releases back to `open` at
 * quiescence, and recovery reclaims a stale `waking` row. `closed` is
 * terminal (missions done / cancelled).
 *
 * `forked_from_*` is the RESERVED forking seam (ADR 0003 §4): schema only,
 * never written by the runtime today. A future fork stamps the source lane
 * and the seq the fork replayed through.
 */
export const lane = pgTable(
  "lane",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: ["foreground", "mission"] }).notNull(),
    /** The leader's name from its config — denormalized for the lane index. */
    leaderName: text("leader_name").notNull(),
    configHash: text("config_hash")
      .notNull()
      .references(() => leaderConfig.hash),
    parentLaneId: uuid("parent_lane_id").references((): AnyPgColumn => lane.id),
    status: text("status", { enum: ["open", "waking", "closed"] }).notNull().default("open"),
    /** Set on wake claim; a stale value is what makes a dead claim reclaimable. */
    wokeAt: timestamp("woke_at", { withTimezone: true }),
    // Reserved forking seam — see the table doc comment.
    forkedFromLaneId: uuid("forked_from_lane_id"),
    forkedFromSeq: bigint("forked_from_seq", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lane_parent_lane_id_idx").on(table.parentLaneId),
    uniqueIndex("lane_one_foreground_per_leader_idx")
      .on(table.leaderName)
      .where(sql`${table.kind} = 'foreground'`),
  ],
);

/**
 * The append-only lane event log (ADR 0003 §4). Row shape follows the
 * framework-survey recommendation — (lane, seq, author, type, payload JSONB,
 * occurred_at) — with the composite PK `(lane_id, seq)` as the optimistic
 * append guard: two writers computing the same next seq race, one loses with
 * a unique violation, and the log stays gapless and totally ordered.
 *
 * `payload` is a small versioned envelope owned by `@hazard-pay/agent`
 * (never provider-raw JSON); `type` discriminates it. `compaction` is
 * RESERVED (ADR 0003 §4): the type exists so folds can later start from a
 * recorded summarization, but the runtime never emits it today.
 *
 * The log doubles as the lane's inbox: external writers append `input`
 * events only; the lane's own loop is the sole author of `model_turn` and
 * `tool_result` events. `author` records who appended — `loop` for the
 * lane's own wake loop, a lane id for `send_message` from another lane, or a
 * host-defined source (e.g. `tick`, `player:<id>`).
 */
export const laneEvent = pgTable(
  "lane_event",
  {
    laneId: uuid("lane_id")
      .notNull()
      .references(() => lane.id),
    /** 1-based, gapless per lane; the next seq is the fold's lastSeq + 1. */
    seq: bigint("seq", { mode: "number" }).notNull(),
    author: text("author").notNull(),
    type: text("type", {
      enum: ["input", "model_turn", "tool_result", "compaction"],
    }).notNull(),
    payload: jsonb("payload").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.laneId, table.seq] })],
);

/**
 * Inferred row shapes for the two tables read across packages —
 * `@hazard-pay/agent` (store, fold) and `apps/api` (trace-viewer queries)
 * import these rather than re-deriving them. Other tables' row types stay
 * with their single owner until a second consumer is real (ADR 0001).
 */
export type LaneRow = typeof lane.$inferSelect;
export type LaneEventRow = typeof laneEvent.$inferSelect;
