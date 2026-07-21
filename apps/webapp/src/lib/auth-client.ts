import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The dev-login client seam (#50): better-auth's React client, wired to the
 * anonymous plugin only — packages/auth's dev-stub scope, no email/OAuth
 * (packages/auth/AGENTS.md). Same-origin through the Vite dev proxy (#20's
 * ratified decision, apps/webapp/AGENTS.md), so `baseURL` is just this
 * page's own origin — better-auth appends its own `/api/auth` base path.
 * Mirrors `src/lib/api.ts`'s window-origin guard: the placeholder never
 * serves a request, it only keeps this module's top level browser-safe for
 * the SPA shell's prerender.
 */
const origin = typeof window === "undefined" ? "http://localhost:5173" : window.location.origin;

export const authClient = createAuthClient({
  baseURL: origin,
  plugins: [anonymousClient()],
});

export const useSession = authClient.useSession;
