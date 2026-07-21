import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * The dev-login player surface (#50): fetch the session's own player and
 * rename its handle. Kept in its own file (contract additions in separate
 * route groups per file, per #24 running concurrently) — `index.ts` only
 * spreads `playerContract` into the flat procedure map.
 *
 * Both routes are session-authenticated through better-auth's cookie
 * (`auth.api.getSession`, called from `server.ts` with the request's
 * headers) rather than a contract-level input — there is no bearer token in
 * this dev-stub scope, only the cookie the browser already carries.
 */
export const handleSchema = z
  .string()
  .trim()
  .min(3, "handle must be at least 3 characters")
  .max(24, "handle must be at most 24 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "handle may only contain letters, numbers, hyphens, and underscores",
  );

/** A player (CONTEXT.md: Player, Handle) as it crosses the wire. */
export const playerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  handle: z.string(),
  createdAt: z.iso.datetime(),
});

export type Player = z.infer<typeof playerSchema>;

export const renamePlayerInputSchema = z.object({
  handle: handleSchema,
});

export type RenamePlayerInput = z.infer<typeof renamePlayerInputSchema>;

const AUTH_ERRORS = {
  SERVICE_UNAVAILABLE: { status: 503 },
  UNAUTHORIZED: { status: 401 },
  NOT_FOUND: { status: 404 },
} as const;

export const playerContract = {
  playerMe: oc
    .route({ method: "GET", path: "/player/me" })
    .errors(AUTH_ERRORS)
    .output(playerSchema),
  renamePlayer: oc
    .route({ method: "POST", path: "/player/rename" })
    .input(renamePlayerInputSchema)
    .errors({ ...AUTH_ERRORS, CONFLICT: { status: 409 } })
    .output(playerSchema),
};
