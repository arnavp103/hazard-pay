/**
 * THROWAWAY PROTOTYPE (#100): the variants, as one switch.
 *
 * The ticket started as "the same fight, twice". Round 2 reopened it with two
 * variables that were never varied, so it is now the same fight across a small
 * grid — and this module is the only place that knows the grid exists, so the
 * seed, the layout, the camera and the aperture stay shared by construction
 * rather than by remembering to pass the same numbers every time.
 *
 *   space    plaza | cover      continuous space, or tiles and sightlines
 *   density  dense | spread | sparse   how much cover, round 2's variable 1
 *   roster   mixed | ranged | split    who is fighting, round 2's variable 2
 *
 * `plaza` ignores both of the others: there is no board to thin and, since
 * `createSpaceBattle("plaza")` must stay bit-identical to `createBattle()`,
 * nothing may touch it. `space.test.ts` asserts that.
 *
 * Nothing here rules on any of it. See the ticket.
 */

import type { Archetype } from "../archetypes.ts";
import { createBattle, type SimState, type SimUnit } from "../sim.ts";
import type { BattleOptions } from "../state.ts";
import { clampUnitOutOfProps, isInsideFootprint } from "./cover-behaviours.ts";
import {
  boardFor,
  cellIndexAt,
  type CoverBoard,
  type CoverDensity,
  densityAt,
  densityIndex,
  GRID,
  walkable,
} from "./cover-model.ts";

export type SpaceMode = "cover" | "plaza";

export const SPACE_MODES: readonly SpaceMode[] = ["plaza", "cover"];

export function isSpaceMode(value: string | null): value is SpaceMode {
  return value === "cover" || value === "plaza";
}

/**
 * Round 2's second variable: which archetypes are on the field.
 *
 * Cover matters far more to a shooter than to a swordsman — a melee unit
 * blocked by a crate is a pathfinding failure, a shooter behind one is the
 * whole point — and round 1 measured only the mixed roster, where two thirds of
 * the bodies are melee and the ranged story is buried.
 *
 *   mixed   the bake-off roster. Round 1's fight, unchanged.
 *   ranged  every body a shooter. The composition cover is *for*.
 *   split   side 0 all shooters, side 1 all swords — ranged vs melee across
 *           cover, which is the asymmetry an auto-battler actually has to
 *           make legible.
 */
export type RosterMode = "mixed" | "ranged" | "split";

export const ROSTER_MODES: readonly RosterMode[] = ["mixed", "ranged", "split"];

export function isRosterMode(value: string | null): value is RosterMode {
  return value === "mixed" || value === "ranged" || value === "split";
}

export interface SpaceOptions extends BattleOptions {
  /** Prop density. Ignored in the plaza. Default `dense` — round 1's board. */
  density?: CoverDensity;
  /** Composition. Default `mixed` — round 1's roster. */
  roster?: RosterMode;
}

/**
 * The archetype a unit gets under a roster mode, or `undefined` to keep the
 * one `createBattle` already gave it.
 *
 * Applied **after** `createBattle` rather than through its `fodderArchetypeAt`
 * hook, for a reason worth stating: the hook does not receive `side`, and
 * `split` needs it. Rewriting afterwards is also provably layout-preserving —
 * the opening jitter is drawn from the battle stream and the opening cooldown
 * from the unit's own, neither of which reads the archetype — so all three
 * rosters start from bodies in identical positions and only the profiles
 * differ. `space.test.ts` asserts exactly that.
 */
function archetypeUnder(roster: RosterMode, unit: SimUnit): Archetype | undefined {
  if (roster === "mixed") { return undefined; }
  if (roster === "ranged") { return "ranged"; }
  return unit.side === 0 ? "ranged" : "melee";
}

/**
 * Open a battle in one of the variants.
 *
 * The **opening layout is not re-authored** for any of them. Every variant
 * starts from the same two ranks at the same seeded jitter; the cover variants
 * then apply the footprint clamp once, so any unit whose starting slot fell
 * inside a prop steps out of it. That keeps the comparison about the model and
 * not about a hand-tuned deployment — and it is also an honest preview of what
 * a real roster would need, because a deployment step that can place a body
 * inside a crate is a bug the *placement* has to solve, not the sim.
 */
export function createSpaceBattle(space: SpaceMode, options: SpaceOptions = {}): SimState {
  const { density = "dense", roster = "mixed", ...battleOptions } = options;
  const state = createBattle({
    ...battleOptions,
    coverDensity: densityIndex(density),
    coverMode: space === "cover",
  });
  if (roster !== "mixed") {
    for (const unit of state.units) {
      const archetype = archetypeUnder(roster, unit);
      if (archetype !== undefined) { unit.archetype = archetype; }
    }
  }
  if (space !== "cover") { return state; }
  const board = boardFor(density);
  for (const unit of state.units) { clampUnitOutOfProps(board, unit); }
  return state;
}

/** The board a battle is being fought on. `plaza` has none — hence undefined. */
export function boardOfBattle(state: SimState): CoverBoard | undefined {
  return state.coverMode === 1 ? boardFor(densityAt(state.coverDensity)) : undefined;
}

/** The tile a unit is standing on. Only meaningful in the cover variant. */
export function cellOfUnit(unit: SimUnit): { cx: number; cy: number } {
  return { cx: cellIndexAt(unit.x), cy: cellIndexAt(unit.z) };
}

/** Units standing on a tile no prop claims — the occupancy invariant. */
export function unitsOnWalkableTiles(board: CoverBoard, state: SimState): number {
  let ok = 0;
  for (const unit of state.units) {
    const cell = cellOfUnit(unit);
    if (walkable(board, cell.cx, cell.cy)) { ok += 1; }
  }
  return ok;
}

/**
 * Units whose centre is inside a prop's footprint — the occupancy violation
 * lane 5 made unrepresentable by construction and a live sim has to enforce.
 * Should be 0 in the cover variant at every step, and is not in the plaza one.
 */
export function unitsInsideFootprints(board: CoverBoard, state: SimState): number {
  let inside = 0;
  for (const unit of state.units) {
    if (isInsideFootprint(board, unit)) { inside += 1; }
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
