import { oc } from "@orpc/contract";
import { z } from "zod";

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
  overworldTick: oc
    .route({ method: "GET", path: "/overworld/tick" })
    .errors({ SERVICE_UNAVAILABLE: { status: 503 } })
    .output(overworldTickSchema),
};

export type ApiContract = typeof contract;
