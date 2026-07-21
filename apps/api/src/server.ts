import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { Logger } from "@hazard-pay/observability";
import { OpenAPIHandler } from "@orpc/openapi/fastify";
import { implement } from "@orpc/server";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type RawServerDefault,
} from "fastify";

import { respond } from "./adapters/respond.ts";
import { contract } from "./contract/index.ts";
import type { AppCtx } from "./context.ts";
import { checkHealth } from "./domain/health.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerTelemetryRoute } from "./routes/telemetry.ts";

/**
 * The server half of the pre-cut process seam (ADR 0002 §3): everything
 * HTTP. It shares only the db and observability handles with the worker —
 * `boss` is deliberately absent from its ctx. ADR 0004's additions land
 * here later without reshaping anything: the SSE match stream is one more
 * route module beside `routes/`, and the shared LISTEN connection is a
 * `buildServer` concern.
 */
export type ServerCtx = Pick<AppCtx, "db" | "logger" | "env">;

/**
 * Per-request implementer context for contract procedures: the narrowed app
 * ctx plus the request's pino child (`log`) — the only logger route
 * handlers may use (ADR 0002 §6).
 */
export interface RequestCtx extends Pick<AppCtx, "db" | "env"> {
  log: Logger;
}

/**
 * The Fastify instance parameterized over the boot pino logger — Fastify's
 * logger IS our root logger (ADR 0002 §1), so `request.log` children stay
 * pino-typed all the way into the adapters.
 */
export type ApiServer = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse<IncomingMessage>,
  Logger
>;

const os = implement(contract).$context<RequestCtx>();

/**
 * The contract implementation (ADR 0002 §2, §4): each procedure is a domain
 * function call wrapped by the `respond` adapter — adapters only call
 * domain functions, and adding an endpoint is a contract entry, a domain
 * function, and this one line.
 */
export const router = os.router({
  health: os.health.handler(({ context }) => respond(context.log, checkHealth({ db: context.db }))),
});

export interface BuildServerOptions {
  /** Redirect ingested telemetry away from `var/telemetry/` (tests). */
  telemetryDir?: string;
}

export async function buildServer(
  ctx: ServerCtx,
  options: BuildServerOptions = {},
): Promise<ApiServer> {
  // Fastify's logger IS the boot pino instance (ADR 0002 §1, §6) — no second
  // logging pipeline; framework lines share the redacted JSONL stream.
  const app = Fastify({ loggerInstance: ctx.logger });

  // Root at boot, children at the edges (ADR 0002 §6): every request gets a
  // pino child bound to W3C trace context — the incoming `traceparent`'s
  // trace id when present, fresh ids otherwise. With the OTel bootstrap
  // loaded (dev), instrumentation-pino stamps span-accurate ids as well;
  // these bindings keep request lines traceable when it is not (tests).
  app.addHook("onRequest", (request, _reply, done) => {
    request.log = request.log.child(traceBindings(request.headers.traceparent));
    done();
  });

  // A thrown exception below an adapter is a defect, not a control path
  // (ADR 0002 §4): log it against the request's child and return an opaque
  // 500 — mapped statuses only ever come from the `respond` table.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.statusCode !== undefined && error.statusCode < 500) {
      // Framework-origin client errors (body-parse failures, oversized
      // payloads): Fastify raises these before any handler runs, so they are
      // never a domain result sneaking past the `respond` table — pass them
      // through with their own status.
      return reply.send(error);
    }
    request.log.error({ err: error }, "unhandled defect");
    return reply.status(500).send({ error: "internal server error" });
  });

  registerTelemetryRoute(app, ctx, { telemetryDir: options.telemetryDir });
  registerAuthRoutes(app, ctx);

  const contractHandler = new OpenAPIHandler(router);
  app.all("/*", async (request, reply) => {
    const { matched } = await contractHandler.handle(request, reply, {
      context: { db: ctx.db, env: ctx.env, log: request.log },
    });
    if (!matched) {
      return reply.status(404).send({ error: "not found" });
    }
  });

  return app;
}

const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

function traceBindings(
  header: string | string[] | undefined,
): { trace_id: string; span_id: string } {
  const value = Array.isArray(header) ? header[0] : header;
  const match = value === undefined ? null : TRACEPARENT_PATTERN.exec(value);
  return {
    trace_id: match?.[1] ?? randomBytes(16).toString("hex"),
    span_id: randomBytes(8).toString("hex"),
  };
}
