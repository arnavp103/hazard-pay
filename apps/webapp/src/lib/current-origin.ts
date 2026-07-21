/**
 * This page's own origin, browser-safe at module top level for the SPA
 * shell's prerender (apps/webapp/AGENTS.md gotcha: route modules evaluate
 * during prerender). Every client that talks to apps/api through the Vite
 * dev proxy — the typed oRPC client (`api.ts`) and the better-auth client
 * (`auth-client.ts`) — needs exactly this, so it lives in one place. The
 * `localhost:5173` placeholder never serves a request; prerender never
 * calls out over the network.
 */
export function currentOrigin(): string {
  return typeof window === "undefined" ? "http://localhost:5173" : window.location.origin;
}
