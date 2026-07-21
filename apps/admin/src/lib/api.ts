import { contract } from "@hazard-pay/api/contract";
import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import type { JsonifiedClient } from "@orpc/openapi-client";

/**
 * The typed api client (ADR 0002 §2): pure type inference over
 * `@hazard-pay/api/contract`, no codegen. Requests go same-origin through
 * the `/hp-api` dev proxy (vite.config.ts) to apps/api on port 3000 — the
 * api serves no CORS headers and admin is dev-only, so the proxy stays.
 *
 * The `typeof window` guard keeps this module evaluable during the SPA
 * shell prerender (admin AGENTS.md gotcha); no request is made at import
 * time, so the placeholder origin is never actually fetched.
 */
const origin = typeof window === "undefined" ? "http://localhost:3001" : window.location.origin;

const link = new OpenAPILink(contract, { url: `${origin}/hp-api` });

export const api: JsonifiedClient<ContractRouterClient<typeof contract>> = createORPCClient(link);
