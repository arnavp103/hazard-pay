import { createMagsLeader } from "./mags.ts";
import type { DefinedLeader } from "@hazard-pay/agent";

/**
 * The leader registry (ADR 0003 §3): git is the source of truth; every
 * leader this app runs is constructed here and registered with the runtime
 * at the worker edge. One real leader is enough for the walking skeleton —
 * adding another is one file plus one line here.
 */
export function createLeaders(): DefinedLeader[] {
  return [createMagsLeader()];
}

export { createMagsLeader, MAGS } from "./mags.ts";
