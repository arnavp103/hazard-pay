import { initObservability } from "@hazard-pay/observability/browser";

let initialized = false;

/**
 * Browser telemetry (ADR 0005 §6): the facade `/browser` entry, flushing to
 * the api's dev-only `POST /telemetry` — same-origin through the Vite dev
 * proxy — and landing in `var/telemetry/webapp.jsonl` after server-side
 * redaction. Dev-only by construction: `enabled` follows the dev flag, and
 * the client also self-disables when the route 404s. Idempotent so the root
 * component can call it on every render without double timers.
 */
export function ensureBrowserTelemetry(): void {
  if (initialized || typeof window === "undefined") {
    return;
  }
  initialized = true;
  initObservability("webapp", { enabled: import.meta.env.DEV });
}
