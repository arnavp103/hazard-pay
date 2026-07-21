import { laneEventPayloadSchema } from "@hazard-pay/agent/envelope";
import { oc } from "@orpc/contract";
import { z } from "zod";

import { playerContract } from "./player.ts";

export {
  handleSchema,
  playerSchema,
  renamePlayerInputSchema,
  type Player,
  type RenamePlayerInput,
} from "./player.ts";

/**
 * The contract-first typed-client seam (ADR 0002 §2): route contracts are
 * defined once here in zod; `src/server.ts` implements them and
 * `apps/webapp` imports `@hazard-pay/api/contract` to build typed TanStack
 * Query hooks (`@orpc/tanstack-query`) by pure type inference — no codegen,
 * no generated files.
 *
 * Library choice (the verification ADR 0002 deferred to #15): **oRPC** over
 * ts-rest. Checked 2026-07-21 — ts-rest's last publish was 2025-06-02
 * (v3.52.1, 13 months stale); oRPC published 1.14.8 on 2026-07-16 with
 * first-party Fastify adapters and a TanStack Query integration. The
 * OpenAPI-style handler keeps these procedures on real REST paths, so
 * `GET /health` stays curl-able and ADR 0004's SSE match stream can live
 * beside them.
 */
export const healthReportSchema = z.object({
  status: z.literal("ok"),
  database: z.literal("reachable"),
});

export type HealthReport = z.infer<typeof healthReportSchema>;

/**
 * Lane read surface (#24): the admin trace viewer's index + transcript
 * routes, read-only over the agent runtime's tables. Payloads are the
 * versioned envelope re-used from `@hazard-pay/agent/envelope` (browser-safe
 * zod, no runtime imports) — the contract refuses shapes the envelope
 * doesn't know rather than passing provider-raw JSON through.
 */
export const laneEventTypeSchema = z.enum([
  "input",
  "model_turn",
  "tool_result",
  "compaction",
]);

/** Per-type lane-event tallies for one lane. Turns ≠ wakes: a wake batches. */
export const laneEventCountsSchema = z.object({
  input: z.number().int(),
  modelTurn: z.number().int(),
  toolResult: z.number().int(),
  compaction: z.number().int(),
  total: z.number().int(),
});

export const laneSummarySchema = z.object({
  id: z.uuid(),
  kind: z.enum(["foreground", "mission"]),
  leaderName: z.string(),
  configHash: z.string(),
  status: z.enum(["open", "waking", "closed"]),
  parentLaneId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  /** Last wake-claim stamp, not a wake counter. */
  wokeAt: z.iso.datetime().nullable(),
  lastEventAt: z.iso.datetime().nullable(),
  eventCounts: laneEventCountsSchema,
});

export const laneEventRecordSchema = z.object({
  /** 1-based, gapless per lane — the client's `after` cursor. */
  seq: z.number().int(),
  author: z.string(),
  type: laneEventTypeSchema,
  payload: laneEventPayloadSchema,
  occurredAt: z.iso.datetime(),
});

/** Page cap for the transcript route — a lane log can grow without bound. */
export const LANE_EVENTS_MAX_LIMIT = 500;
export const LANE_EVENTS_DEFAULT_LIMIT = 200;

export const laneTracePageSchema = z.object({
  lane: laneSummarySchema,
  /** Ascending seq (newest last); poll with `after = last seen seq`. */
  events: z.array(laneEventRecordSchema),
  hasMore: z.boolean(),
});

export type LaneSummary = z.infer<typeof laneSummarySchema>;
export type LaneEventRecord = z.infer<typeof laneEventRecordSchema>;
export type LaneTracePage = z.infer<typeof laneTracePageSchema>;

/**
 * One recorded overworld tick as it crosses the wire — the polling route's
 * payload and the SSE stream's inner object. `id` is the transport sequence
 * (SSE event id / `Last-Event-ID`); `tickNumber` is the domain counter.
 */
export const tickSnapshotSchema = z.object({
  id: z.number().int(),
  tickNumber: z.number().int(),
  completedAt: z.iso.datetime(),
});

export type TickSnapshot = z.infer<typeof tickSnapshotSchema>;

export const overworldTickSchema = z.object({
  latestTick: tickSnapshotSchema.nullable(),
  /** `TICK_INTERVAL` — lets the client render a next-tick countdown. */
  intervalMs: z.number().int().positive(),
});

export type OverworldTick = z.infer<typeof overworldTickSchema>;

/**
 * The SSE `data:` payload of a `tick` event on `GET /ticks/stream`. The
 * stream is deliberately NOT an oRPC procedure (ADR 0004 §2: the match wire
 * is a one-way stream beside the contract routes), but its envelope schema
 * lives here so both ends share one shape. `traceparent` is the ticking
 * span's W3C context (ADR 0005 §6) — one trace spans tick → transport →
 * render.
 */
export const tickStreamEnvelopeSchema = z.object({
  tick: tickSnapshotSchema,
  traceparent: z.string().nullable(),
});

export type TickStreamEnvelope = z.infer<typeof tickStreamEnvelopeSchema>;

export const contract = {
  health: oc
    .route({ method: "GET", path: "/health" })
    .errors({ SERVICE_UNAVAILABLE: { status: 503 } })
    .output(healthReportSchema),
  lanes: {
    list: oc
      .route({ method: "GET", path: "/lanes" })
      .errors({ SERVICE_UNAVAILABLE: { status: 503 } })
      .output(z.object({ lanes: z.array(laneSummarySchema) })),
    events: oc
      .route({ method: "GET", path: "/lanes/{laneId}/events" })
      .input(z.object({
        laneId: z.uuid(),
        // Coerced: OpenAPI query params arrive as strings.
        after: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(LANE_EVENTS_MAX_LIMIT)
          .default(LANE_EVENTS_DEFAULT_LIMIT),
      }))
      .errors({
        SERVICE_UNAVAILABLE: { status: 503 },
        NOT_FOUND: { status: 404 },
      })
      .output(laneTracePageSchema),
  },
  overworldTick: oc
    .route({ method: "GET", path: "/overworld/tick" })
    .errors({ SERVICE_UNAVAILABLE: { status: 503 } })
    .output(overworldTickSchema),
  ...playerContract,
};

export type ApiContract = typeof contract;
