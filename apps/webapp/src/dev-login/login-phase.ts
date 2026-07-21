/**
 * The dev-login surface's rendering phase (#50) — pure, Node-tested, so the
 * branching that decides "jack in" vs. the handle chip vs. a loading state
 * lives outside JSX where it is trivially testable (match-proto's "keep
 * renderable state in pure modules" pattern).
 */
export type LoginPhase = "checking-session" | "signed-out" | "loading-player" | "signed-in";

export function describeLoginPhase(args: {
  sessionPending: boolean;
  hasSession: boolean;
  hasPlayer: boolean;
}): LoginPhase {
  if (args.sessionPending) {
    return "checking-session";
  }
  if (!args.hasSession) {
    return "signed-out";
  }
  if (!args.hasPlayer) {
    return "loading-player";
  }
  return "signed-in";
}
