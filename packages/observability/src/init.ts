export interface InitObservabilityOptions {
  /** Redirect output away from `var/telemetry/` (tests, scripts). */
  telemetryDir?: string;
}

export interface ObservabilityHandle {
  shutdown: () => Promise<void>;
}

/**
 * OTel NodeSDK bootstrap, intended for `node --import` (ADR 0005 §1, §6): a
 * per-app `telemetry.ts` calls `await initObservability("<service>")` at
 * top level, before the app module graph loads, so auto-instrumentation can
 * patch modules on first require.
 *
 * The SDK and instrumentations are loaded dynamically here — importing the
 * facade never pulls in `sdk-node`, so tests and scripts that skip the
 * bootstrap pay nothing and spans become no-ops.
 *
 * Curated instrumentations (ADR 0005 §1): fastify, http, undici, pg, pino.
 * `enhancedDatabaseReporting` stays off permanently and no HTTP headers are
 * captured (#22): query parameter values and header values never enter spans.
 */
export async function initObservability(
  service: string,
  options: InitObservabilityOptions = {},
): Promise<ObservabilityHandle> {
  // The repo runs ESM (tsx, no build step), where require-in-the-middle never
  // sees module loads — instrumentations that monkey-patch (pino, pg, http)
  // need OTel's import-in-the-middle loader hook registered before the app's
  // module graph loads. Registering here, from inside the `node --import`
  // bootstrap, spares every app from knowing the hook exists.
  const { register } = await import("node:module");
  register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);

  const [
    { NodeSDK },
    { resourceFromAttributes },
    { ATTR_SERVICE_NAME },
    { SimpleSpanProcessor },
    { HttpInstrumentation },
    { UndiciInstrumentation },
    { PgInstrumentation },
    { PinoInstrumentation },
    { FastifyOtelInstrumentation },
    { createJsonlSpanExporter },
  ] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/resources"),
    import("@opentelemetry/semantic-conventions"),
    import("@opentelemetry/sdk-trace-base"),
    import("@opentelemetry/instrumentation-http"),
    import("@opentelemetry/instrumentation-undici"),
    import("@opentelemetry/instrumentation-pg"),
    import("@opentelemetry/instrumentation-pino"),
    import("@fastify/otel"),
    import("./otel/jsonl-span-exporter.ts"),
  ]);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: service }),
    // SimpleSpanProcessor over batching: spans are on disk the moment they
    // end, so an agent can grep a trace right after the request. Revisit if
    // per-span sync appends ever show up in profiles.
    spanProcessors: [
      new SimpleSpanProcessor(
        createJsonlSpanExporter({ service, telemetryDir: options.telemetryDir }),
      ),
    ],
    instrumentations: [
      new HttpInstrumentation(),
      new UndiciInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
      new PinoInstrumentation(),
      new FastifyOtelInstrumentation({ registerOnInitialization: true }),
    ],
  });
  sdk.start();
  return { shutdown: () => sdk.shutdown() };
}
