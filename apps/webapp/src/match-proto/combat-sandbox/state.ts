/**
 * THROWAWAY SCAFFOLDING (#96): the battle state, and only the state.
 *
 * Split out of `sim.ts` so `behaviours.ts` can be typed against it without a
 * module cycle. `sim.ts` re-exports everything here — import from `sim.ts`.
 *
 * ## Everything is a plain number, and that is the point
 *
 * The lane this was ported from (PR #90) carried the PRNG as a closure on the
 * state (`random: () => number`). That made a battle **replay-only**: you
 * could re-run it from t=0, but you could not snapshot it, send it anywhere,
 * or resume it. Map #95 rules that a match advances in *slices* — the server
 * resolves a few seconds and the player decides at the boundary — so the
 * boundary state is the one thing that has to survive.
 *
 * `structuredClone(state)` and `JSON.parse(JSON.stringify(state))` therefore
 * both round-trip a battle exactly, and `advanceBattle` picks it back up
 * field-for-field identically. `sim.test.ts` asserts that. Keep it true: if
 * you add a field, add a number, not a function, a `Map` or a class.
 *
 * ## Time is an integer
 *
 * `step` is the clock. `t` is derived (`step * FIXED_STEP`) and is there for
 * readability only — nothing compares against it. Every deadline in the state
 * is a step index, because the two float comparisons this sim used to make
 * (`attackPhase >= 1`, margin 1.67e-15; `t >= retargetAt`, margin exactly 0)
 * were measured by #98's perturbation testing as its only real determinism
 * hazards. Integers do not have knife edges.
 */

import type { Archetype } from "./archetypes.ts";
import type { Side, Tier } from "./units.ts";

export type { Side } from "./units.ts";

export interface SimUnit {
  id: number;
  side: Side;
  tier: Tier;
  archetype: Archetype;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Acceleration, low-passed — the lean layer's input. */
  ax: number;
  az: number;
  speed: number;
  facing: number;
  angularVelocity: number;
  /** Aim point in world space. */
  aimX: number;
  aimZ: number;
  aimY: number;
  targetId: number;
  /**
   * -1 when not attacking, else 0..`ATTACK_STEPS`. The single source of truth
   * for the strike; the animator's 0..1 phase comes from `attackPhaseOf`.
   */
  attackStep: number;
  /** Steps remaining before another attack may start. */
  cooldownSteps: number;
  /** Step index of the last released attack, or -1. */
  firedAtStep: number;
  /** Step index of the last incoming hit, or -1. */
  hitAtStep: number;
  /**
   * This unit's own PRNG cursor, derived from `(seed, id)`. Per-unit streams
   * so one unit's draws cannot shift another's — see `mixSeed`.
   */
  randomState: number;

  // --- attrition (#101) ------------------------------------------------------
  //
  // These five are inert unless an attrition treatment is installed
  // (`attrition.ts`). With no treatment the fight is bit-identical to the one
  // this sandbox shipped with: nothing reads them.

  /**
   * Prototype stand-in only. A hit stamp costs 1; fodder start at 3, heroes at
   * 6. **This is not a damage model** — HP, damage formulas and lethality are
   * explicitly out of scope on map #95. It is the crudest rule that makes
   * bodies fall on a believable curve, and it is the same one #97's research
   * measured its death numbers against, so the two are comparable.
   */
  hp: number;
  /** Step the unit died on, or -1 while alive. The death clock. */
  deathStep: number;
  /**
   * Highest `hitAtStep` already converted into damage. Units act in id order,
   * so an attacker with a higher id stamps its victim *after* the victim's own
   * `act` ran; comparing against this instead of `state.step` makes damage
   * resolution independent of who moved first, which is the same reason the
   * steering pass is double-buffered.
   */
  damagedStep: number;
  /**
   * Formation slot this unit is assigned to, in world space. Only the
   * `ranks` treatment writes it; -0 elsewhere. Recomputed on retarget steps so
   * the block re-forms at the same cadence the targeting does.
   */
  slotX: number;
  slotZ: number;
}

export interface SimState {
  /** The clock. Integer, monotonic, the only thing deadlines compare against. */
  step: number;
  /** Derived: `step * FIXED_STEP`. Readability only — never compared. */
  t: number;
  units: SimUnit[];
  /**
   * PRNG cursor for battle-wide draws (layout jitter at creation). Per-unit
   * draws use the unit's own cursor.
   */
  randomState: number;
  /** Step index the next target re-acquisition is due at. */
  retargetAtStep: number;
}

/**
 * Note the two roster hooks are functions, so `BattleOptions` — unlike
 * `SimState` — does not survive `JSON.stringify`. A battle is still fully
 * reproducible from `(seed, options, steps)`, but a caller that has to ship a
 * battle *specification* over a wire should stay on the data-only fields and
 * agree the roster out of band.
 */
export interface BattleOptions {
  seed?: number;
  fodderPerSide?: number;
  heroesPerSide?: number;
  /** Half-separation of the two lines along the approach axis. */
  standoff?: number;
  /** Rank spacing along the line axis. */
  spacing?: number;
  /**
   * Which archetype a hero slot gets. Default: the bake-off's mixed roster.
   * Override to test a different hero mix (#102) without touching the layout.
   */
  heroArchetypeAt?: (side: Side, heroIndex: number) => Archetype;
  /**
   * Which archetype a fodder slot gets. `rank` is 0 (front) or 1 (back),
   * `index` counts fodder placed on that side so far. Default: melee in front,
   * ranged behind, one in three swapped so silhouettes interleave.
   */
  fodderArchetypeAt?: (rank: number, index: number) => Archetype;
}
