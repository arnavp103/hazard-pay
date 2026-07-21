import { contract } from "@hazard-pay/api/contract";
import { currentTraceparent } from "@hazard-pay/observability/browser";
import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";

import { currentOrigin } from "./current-origin.ts";

/**
 * The typed api client (ADR 0002 §2): pure type inference over
 * `@hazard-pay/api/contract` — no codegen. Calls hit real REST paths
 * (`GET /overworld/tick`) on this page's own origin; the Vite dev proxy
 * (vite.config.ts) forwards them to apps/api, so no base URL is configured
 * anywhere in client code.
 *
 * `traceparent` rides every fetch (ADR 0005 §6): when a browser span is
 * active its context propagates to the api's per-request logger; outside a
 * span the header is simply absent.
 */
const link = new OpenAPILink(contract, {
  url: currentOrigin(),
  headers: () => {
    const traceparent = currentTraceparent();
    return traceparent === undefined ? {} : { traceparent };
  },
});

export const apiClient: ContractRouterClient<typeof contract> = createORPCClient(link);
