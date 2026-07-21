import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createRuntime } from "@hazard-pay/agent";
import { fromDrizzle } from "pg-boss";
import { sql } from "drizzle-orm";

import { createLeaders } from "./index.ts";
import type { AppCtx } from "../context.ts";
import type { TickOutbox } from "../db/index.ts";
import type { Runtime } from "@hazard-pay/agent";
import type { LanguageModel } from "ai";
import type { PgBoss } from "pg-boss";

/**
 * The worker-edge leader wiring (issue #52, ADR 0003 §6). This module is
 * where the two seams meet that `packages/agent` deliberately never
 * crosses: the Gemini provider is constructed HERE from `ctx.env` (the
 * runtime only ever sees a model instance), and pg-boss stays HERE (agents
 * never touch the queue).
 */

/** Doorbell queue: jobs carry `{ laneId }` only (ADR 0003 §6). */
export const LEADER_DOORBELL_QUEUE = "leader.doorbell";

/**
 * `short` policy + per-lane `singletonKey`: at most ONE queued doorbell per
 * lane, while a lane whose wake is already active can still have its next
 * doorbell queued — exactly "one queued wake per lane". Combined with the
 * runtime's guarded `open → waking` claim, this is the wake-pileup guard.
 */
export const LEADER_DOORBELL_QUEUE_OPTIONS = { policy: "short" as const };

/** The dev/default model (issue #23 amendment): free-tier, sparing calls. */
export const GEMINI_MODEL = "gemini-2.5-flash";

export interface LeaderWiring {
  runtime: Runtime;
  /** leader name → foreground lane id, ensured at boot. */
  foregroundLanes: Map<string, string>;
}

/**
 * Builds the runtime over an injected model and ensures every registered
 * leader's foreground lane exists. Boot code on the imperative shell: an
 * ensure failure here is a boot defect and throws (same contract as the
 * pg-boss awaits around it in `startWorker`).
 */
export async function wireLeaderRuntime(
  ctx: Pick<AppCtx, "db" | "logger">,
  model: LanguageModel,
): Promise<LeaderWiring> {
  const leaders = createLeaders();
  const runtime = createRuntime({
    db: ctx.db,
    model,
    logger: ctx.logger,
    leaders,
    maxModelRetries: 3,
  });
  const foregroundLanes = new Map<string, string>();
  for (const leader of leaders) {
    const ensured = await runtime.ensureForegroundLane({ leader: leader.name });
    if (ensured.isErr()) {
      throw new Error(`ensureForegroundLane(${leader.name}) failed: ${ensured.error.tag}`);
    }
    foregroundLanes.set(leader.name, ensured.value.laneId);
  }
  return { runtime, foregroundLanes };
}

/**
 * The key-gated edge (issue #52): with `GEMINI_API_KEY` present the worker
 * gets real leader wakes; without it the worker boots fine and leader
 * wiring degrades gracefully — one clear log line, no doorbells, no model.
 * CI and keyless dev stay green. The key's presence is checked via the env
 * schema only; its value goes straight into the provider, never a log.
 */
export async function setupLeaders(
  ctx: Pick<AppCtx, "db" | "logger" | "env">,
): Promise<LeaderWiring | undefined> {
  if (ctx.env.GEMINI_API_KEY === undefined) {
    ctx.logger.warn("leader wakes disabled: no GEMINI_API_KEY");
    return undefined;
  }
  const google = createGoogleGenerativeAI({ apiKey: ctx.env.GEMINI_API_KEY });
  return wireLeaderRuntime(ctx, google(GEMINI_MODEL));
}

/**
 * The outbox half of the doorbell (ADR 0003 §6: "inputs are enqueued
 * transactionally with their cause"): runs inside the ticking transaction —
 * append one input to each leader's foreground lane and enqueue that lane's
 * doorbell job through the SAME transaction (`fromDrizzle`), so tick row,
 * lane input, and queued wake commit or vanish together. Atomicity over
 * availability: a failure here aborts the tick, and pg-boss redelivers the
 * tick job.
 */
export function leaderTickOutbox(deps: { boss: PgBoss; wiring: LeaderWiring }): TickOutbox {
  return async (tx, recorded) => {
    // A backfill batch collapses to its latest tick deliberately: state
    // being current is what matters (ADR 0004 §4 — older missed ticks are
    // skipped, not replayed), and one input per doorbell is the free-tier
    // discipline. The input's payload names the tick it reports.
    const latest = recorded.at(-1);
    if (latest === undefined) {
      return;
    }
    for (const [leaderName, laneId] of deps.wiring.foregroundLanes) {
      const appended = await deps.wiring.runtime.appendInput({
        laneId,
        author: "tick",
        content: `Overworld tick ${latest.tickNumber} completed at ${latest.completedAt.toISOString()}.`,
        data: { tickId: latest.id, tickNumber: latest.tickNumber },
        tx,
      });
      if (appended.isErr()) {
        // Abort the ticking transaction (the outbox contract): an input
        // that cannot commit with its cause must not commit at all.
        throw new Error(
          `tick outbox: appendInput failed for leader "${leaderName}": ${appended.error.tag}`,
        );
      }
      await deps.boss.send(
        LEADER_DOORBELL_QUEUE,
        { laneId },
        { singletonKey: laneId, db: fromDrizzle(tx, sql) },
      );
    }
  };
}
