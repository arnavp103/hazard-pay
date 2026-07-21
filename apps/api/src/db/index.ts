/**
 * The only place `@hazard-pay/db` may be imported at runtime (ADR 0001 §1,
 * enforced by the scoped `no-restricted-imports` override in
 * eslint.config.js). Queries and transaction boundaries live in this
 * directory; the rest of the app sees the database as `ctx.db` plus the
 * helpers re-exported here. A helper graduates into `packages/db` only when
 * another app actually duplicates it.
 */
export { createDb } from "@hazard-pay/db";
export { insertLeaderNote } from "./leader-notes.ts";
export { pingDb } from "./ping.ts";
export { findPlayerByUserId, type PlayerRow, updatePlayerHandle } from "./players.ts";
export {
  findLaneById,
  listLaneEventsAfter,
  listLaneRows,
  tallyLaneEvents,
} from "./lanes.ts";
export type { LaneEventRow, LaneEventTally, LaneRow } from "./lanes.ts";
export {
  latestTick,
  recordDueTicks,
  TICK_CHANNEL,
  ticksAfter,
  type TickOutbox,
  type TickRow,
} from "./ticks.ts";
