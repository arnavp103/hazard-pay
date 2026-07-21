import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { currentOrigin } from "./current-origin.ts";

/**
 * The dev-login client seam (#50): better-auth's React client, wired to the
 * anonymous plugin only — packages/auth's dev-stub scope, no email/OAuth
 * (packages/auth/AGENTS.md). Same-origin through the Vite dev proxy (#20's
 * ratified decision, apps/webapp/AGENTS.md), so `baseURL` is just this
 * page's own origin — better-auth appends its own `/api/auth` base path.
 */
export const authClient = createAuthClient({
  baseURL: currentOrigin(),
  plugins: [anonymousClient()],
});

export const useSession = authClient.useSession;
