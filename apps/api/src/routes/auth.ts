import { type Auth, createAuth } from "@hazard-pay/auth";

import { toFetchHeaders } from "../adapters/fetch-headers.ts";
import type { AppCtx } from "../context.ts";
import type { ApiServer } from "../server.ts";

/**
 * Mounts better-auth (#19): `createAuth` from `@hazard-pay/auth` with the
 * real `baseURL` from env, its fetch-shaped `auth.handler` translated onto a
 * Fastify catch-all. The dev-stub anonymous login is served by the handler
 * itself — `POST /api/auth/sign-in/anonymous` — and the player row appears
 * via the package's `databaseHooks` wiring; nothing auth-shaped lives in
 * this app beyond this translation layer.
 *
 * Deliberately outside the typed contract: better-auth owns its own route
 * surface and client SDK; wrapping it in oRPC procedures would duplicate
 * both.
 */
export function registerAuthRoutes(
  app: ApiServer,
  ctx: Pick<AppCtx, "db" | "env">,
): Auth {
  const auth = createAuth(ctx.db, { baseURL: ctx.env.API_BASE_URL });
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    handler: async (request, reply) => {
      const response = await auth.handler(toFetchRequest(request, ctx.env.API_BASE_URL));
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== "set-cookie") {
          void reply.header(key, value);
        }
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) {
        void reply.header("set-cookie", cookies);
      }
      return reply.send(response.body === null ? null : await response.text());
    },
  });
  return auth;
}

function toFetchRequest(
  request: { url: string; method: string; headers: Record<string, string | string[] | undefined>; body: unknown },
  baseURL: string,
): Request {
  return new Request(new URL(request.url, baseURL), {
    method: request.method,
    headers: toFetchHeaders(request.headers),
    body: request.body === undefined || request.body === null
      ? undefined
      : JSON.stringify(request.body),
  });
}
