/**
 * THROWAWAY PROTOTYPE (#100): the two variants, as one switch.
 *
 * The whole ticket is "the same fight, twice". This module is the only place
 * that knows there are two of them, so the seed, the roster, the camera and
 * the aperture are shared by construction rather than by remembering to pass
 * the same numbers twice.
 *
 *   plaza  continuous space, archetype standoff, boid separation. Exactly what
 *          the #96 sandbox already does — `createSpaceBattle("plaza", …)` and
 *          `createBattle(…)` produce identical states, and
 *          `space.test.ts` asserts it.
 *   cover  the same opening layout, then `cover-model.ts`'s tile grid, prop
 *          footprints and sightlines on top of it.
 *
 * Nothing here rules on which one is right. See the ticket.
 */

import { createBattle, type SimState, type SimUnit } from "../sim.ts";
import type { BattleOptions } from "../state.ts";
import { clampUnitOutOfProps, isInsideFootprint } from "./cover-behaviours.ts";
import { cellIndexAt, GRID, walkable } from "./cover-model.ts";

export type SpaceMode = "cover" | "plaza";

export const SPACE_MODES: readonly SpaceMode[] = ["plaza", "cover"];

export function isSpaceMode(value: string | null): value is SpaceMode {
  return value === "cover" || value === "plaza";
}

/**
 * Open a battle in one of the two variants.
 *
 * The **opening layout is not re-authored for cover**. Both variants start
 * from the same two ranks at the same seeded jitter; variant B then applies
 * the footprint clamp once, so any unit whose starting slot fell inside a prop
 * steps out of it. That keeps the comparison about the model and not about a
 * hand-tuned deployment — and it is also an honest preview of what a real
 * roster would need, because a deployment step that can place a body inside a
 * crate is a bug the *placement* has to solve, not the sim.
 */
export function createSpaceBattle(space: SpaceMode, options: BattleOptions = {}): SimState {
  const state = createBattle({ ...options, coverMode: space === "cover" });
  if (space !== "cover") { return state; }
  for (const unit of state.units) { clampUnitOutOfProps(unit); }
  return state;
}

/** The tile a unit is standing on. Only meaningful in the cover variant. */
export function cellOfUnit(unit: SimUnit): { cx: number; cy: number } {
  return { cx: cellIndexAt(unit.x), cy: cellIndexAt(unit.z) };
}

/** Units standing on a tile no prop claims — the occupancy invariant. */
export function unitsOnWalkableTiles(state: SimState): number {
  let ok = 0;
  for (const unit of state.units) {
    const cell = cellOfUnit(unit);
    if (walkable(cell.cx, cell.cy)) { ok += 1; }
  }
  return ok;
}

/**
 * Units whose centre is inside a prop's footprint — the occupancy violation
 * lane 5 made unrepresentable by construction and a live sim has to enforce.
 * Should be 0 in the cover variant at every step, and is not in the plaza one.
 */
export function unitsInsideFootprints(state: SimState): number {
  let inside = 0;
  for (const unit of state.units) {
    if (isInsideFootprint(unit)) { inside += 1; }
  }
  return inside;
}

/** Units currently standing off the board entirely. */
export function unitsOffBoard(state: SimState): number {
  let off = 0;
  for (const unit of state.units) {
    const cell = cellOfUnit(unit);
    if (cell.cx < 0 || cell.cy < 0 || cell.cx >= GRID || cell.cy >= GRID) { off += 1; }
  }
  return off;
}
