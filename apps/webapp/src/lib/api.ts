import { contract } from "@hazard-pay/api/contract";
import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";

/**
 * The typed api client (ADR 0002 §2): pure type inference over
 * `@hazard-pay/api/contract` — no codegen. Calls hit real REST paths
 * (`GET /overworld/tick`) on this page's own origin; the Vite dev proxy
 * (vite.config.ts) forwards them to apps/api, so no base URL is configured
 * anywhere in client code. The window guard keeps the module top level
 * browser-safe for SPA shell prerender — the placeholder origin never
 * serves a request.
 */
const origin = typeof window === "undefined" ? "http://localhost:5173" : window.location.origin;

const link = new OpenAPILink(contract, { url: origin });

export const apiClient: ContractRouterClient<typeof contract> = createORPCClient(link);
