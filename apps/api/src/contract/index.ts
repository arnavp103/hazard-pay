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

export const contract = {
  health: oc
    .route({ method: "GET", path: "/health" })
    .errors({ SERVICE_UNAVAILABLE: { status: 503 } })
    .output(healthReportSchema),
};

export type ApiContract = typeof contract;
