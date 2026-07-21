import { ingestTelemetryLines } from "@hazard-pay/observability";
import { z } from "zod";

import type { AppCtx } from "../context.ts";
import type { ApiServer } from "../server.ts";

const ingestBodySchema = z.object({
  service: z.string(),
  lines: z.array(z.record(z.string(), z.unknown())),
});

export interface TelemetryRouteOptions {
  /** Redirect output away from `var/telemetry/` (tests). */
  telemetryDir?: string;
}

/**
 * Dev-only browser telemetry ingest (ADR 0005 §6): the wire contract the
 * `@hazard-pay/observability/browser` entry flushes to — `{ service, lines }`
 * with a `signal: "log" | "span"` discriminator per line. Deliberately NOT
 * part of the typed contract in `src/contract/`: the caller is a raw
 * fetch/sendBeacon buffer, and in production the route must not exist at all
 * (the browser client treats a 404 as a permanent disable).
 *
 * Lines arrive redacted by the client, but the client buffer is untrusted
 * input (#22): `ingestTelemetryLines` re-redacts every line server-side
 * through the observability package's shared chokepoint before disk.
 */
export function registerTelemetryRoute(
  app: ApiServer,
  ctx: Pick<AppCtx, "env">,
  options: TelemetryRouteOptions = {},
): void {
  if (ctx.env.NODE_ENV === "production") {
    return;
  }
  app.post("/telemetry", async (request, reply) => {
    const parsed = ingestBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid telemetry payload" });
    }
    const result = ingestTelemetryLines(parsed.data.service, parsed.data.lines, {
      telemetryDir: options.telemetryDir,
    });
    return result.match(
      (report) => {
        request.log.debug(report, "telemetry ingested");
        return reply.status(204).send();
      },
      (error) => {
        request.log.warn({ error }, "telemetry ingest rejected");
        return reply.status(400).send({ error: error.message });
      },
    );
  });
}
