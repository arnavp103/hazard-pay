import { createAppCtx } from "./context.ts";
import { buildServer } from "./server.ts";
import { startWorker, stopWorker } from "./worker.ts";

/**
 * The default entrypoint (ADR 0002 §3): one dev process boots both halves
 * of the pre-cut seam — the Fastify server and the pg-boss worker — over a
 * single `AppCtx`. Run it through the observability bootstrap:
 *
 *   tsx watch --import ./src/telemetry.ts src/index.ts   (pnpm dev)
 *
 * When tick load or agent runs demand isolation, a second entrypoint boots
 * `startWorker` alone; this file never grows logic of its own.
 */
const { ctx, close } = createAppCtx();
const app = await buildServer(ctx);
await app.listen({ port: ctx.env.PORT, host: "127.0.0.1" });
await startWorker(ctx);
ctx.logger.info({ port: ctx.env.PORT }, "api listening");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void (async () => {
      ctx.logger.info({ signal }, "shutting down");
      await app.close();
      await stopWorker(ctx);
      await close();
      process.exit(0);
    })();
  });
}
