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

  // --- #100 battlefield space: only read when `SimState.coverMode` is 1 ----
  /** Chosen cover tile as `cy * GRID + cx`, or -1 for none. */
  coverCell: number;
  /**
   * Round 3: the next tile on this unit's covered approach, as `cy * GRID + cx`,
   * or -1 for none. A waypoint descended from the shared cost field, re-picked
   * on retarget steps — the field itself is scratch, this is the only part of it
   * that has to survive a slice boundary.
   */
  approachCell: number;
  /**
   * Round 3 metric: steps spent **closing** with a clear line to the enemy.
   *
   * Counted only while the target is out of reach, which is the correction that
   * makes the number mean anything. A body in contact is at 1.1 units and
   * `sightBetween` cannot occlude a line that short, so counting every step
   * would make "exposed" a synonym for "fighting" and a covered approach could
   * never move it. What a covered approach buys is cheaper *travel*; this is
   * the denominator that measures travel.
   */
  exposedSteps: number;
  /** Steps spent with a target out of reach — the approach itself. */
  approachSteps: number;

  // --- #100 round 3: the directional-cover ruling -------------------------
  /**
   * Stance: 0 open, 1 ducked, 2 peeking. See `directional-cover.ts`.
   *
   * The renderer reads this to lower the silhouette, which is the ruling's own
   * justification for the model — a ducked body and a peeking body differ in
   * *height*, and height is the channel that survives 22-48 px.
   */
  coverState: number;
  /** Steps spent ducked. */
  duckedSteps: number;
  /** Steps spent peeking — exposure this unit bought in order to shoot. */
  peekSteps: number;
  /** Shots this unit landed by coming in outside its target's protected arc. */
  flankedShots: number;
  /** 0..1 of this unit's target hidden from it by a prop, this step. */
  sightOcclusion: number;
  /** Attacks this unit has held or spoiled because the line was covered. */
  suppressedShots: number;
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
  /**
   * #100 battlefield space. 1 runs the tiles-and-cover behaviours, 0 runs the
   * open plaza. A number rather than a boolean because everything on this
   * interface is a number, and it lives on the state rather than in a module
   * flag so `battleAt(t, options)` stays a pure function and a slice boundary
   * still round-trips through JSON with its board model intact.
   */
  coverMode: number;
  /**
   * #100 round 2: which prop density the cover board is built at — an index
   * into `battlefield-space/cover-model.ts`'s `COVER_DENSITIES`
   * (`0 dense | 1 spread | 2 sparse`). An index rather than the string for the
   * same reason `coverMode` is a number: this interface is plain numbers so a
   * slice boundary survives JSON. 0 is round 1's board, so an existing caller
   * that only sets `coverMode` gets round 1's fight unchanged.
   */
  coverDensity: number;
  /**
   * #100 round 3: 1 lets melee route over the shared cost field — the covered
   * approach — and 0 reproduces rounds 1 and 2, where melee's cover appetite
   * was zeroed and only shooters used cover.
   *
   * It exists as a switch rather than as a rewrite because the ticket's whole
   * question is *what changes when melee uses cover*, and that is only
   * answerable by running the same fight both ways. Ignored when `coverMode`
   * is 0 — there is nothing to route around in the plaza.
   */
  approachMode: number;
  /**
   * #100 round 4: how much floor the fight is on — an index into
   * `battlefield-space/cover-model.ts`'s `BOARD_SIZES`
   * (`0 compact | 1 broad | 2 vast`).
   *
   * Unlike `coverDensity` this is read in the **plaza** as well, because the
   * plaza's army spreads with it even though there is no board to grow. 0 is
   * rounds 1-3's board, so an existing caller that never sets it gets its old
   * fight back bit-for-bit.
   */
  boardSize: number;
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
  /**
   * #100: run the tiles-and-cover behaviours. Default off, so every existing
   * caller keeps the open-plaza fight it already had, unchanged.
   */
  coverMode?: boolean;
  /**
   * #100 round 2: prop density, as an index into `COVER_DENSITIES`. Default 0
   * (dense) — round 1's board. Passed as an index rather than the union so
   * this file stays free of a `battlefield-space` import; `space.ts` owns the
   * string-to-index mapping.
   */
  coverDensity?: number;
  /**
   * #100 round 3: melee's covered approach. Default **on** when `coverMode` is
   * set — round 3's position is that both archetypes want cover — and set
   * `false` to get rounds 1 and 2 back for the A/B.
   */
  approachMode?: boolean;
  /**
   * #100 round 4: board size, as an index into `BOARD_SIZES`. Default 0
   * (compact) — rounds 1-3's 20x20 board. An index for the same reason
   * `coverDensity` is one; `space.ts` owns the string-to-index mapping and the
   * deployment that goes with it.
   */
  boardSize?: number;
}
