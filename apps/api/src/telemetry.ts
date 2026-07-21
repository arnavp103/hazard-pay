/**
 * The only file that starts the OTel SDK (ADR 0005 §1, §6). Load it via
 * `--import` so the ESM loader hook registers before the app's module graph:
 *
 *   tsx watch --import ./src/telemetry.ts src/index.ts
 *
 * NOTE: import from `/init`, not the package root — the root entry loads
 * pino, and anything imported before the loader hook registers escapes
 * instrumentation (#28). Tests never load this file.
 */
import { initObservability } from "@hazard-pay/observability/init";

await initObservability("api");
