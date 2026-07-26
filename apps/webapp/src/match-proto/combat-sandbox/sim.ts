/**
 * THROWAWAY SCAFFOLDING (#96): the deterministic battle, and the slice API
 * the prototypes on map #95 are built on.
 *
 * This is the sandbox's front door. Import battle state, stepping and slicing
 * from here; `state.ts` and `behaviours.ts` are its internals and are
 * re-exported below so nobody has to know that.
 *
 * ## The entry points
 *
 *   createBattle(options)          a fresh battle at step 0
 *   stepBattle(state)              exactly one fixed step. No `dt` argument —
 *                                  an arbitrary timestep is a drift source.
 *   advanceBattle(state, steps)    resume an existing battle by N steps
 *   battleAt(seconds, options)     ← **the important one**. Deterministic
 *                                  time-indexed state: the same (seed,
 *                                  options, seconds) is the same battle, every
 *                                  time, on any machine.
 *   sliceBattle(state, steps)      a bounded, resumable window — `[from, to]`
 *                                  plus the state at `to`, optionally with
 *                                  every frame recorded for scrubbing.
 *
 * ## Why slices, and what `battleAt` does and does not cost
 *
 * Map #95 rules that a match advances in slices: the server resolves a few
 * seconds of continuous battle, the player steers at the boundary, repeat.
 *
 * `battleAt(seconds)` is *time-indexed*, so by definition it replays from the
 * seed — it is the right call to open a match or to shoot a still at a known
 * moment, and it costs O(seconds). It is **not** the way to advance a match.
 * For that, keep the state and resume:
 *
 *     let slice = sliceBattle(createBattle(), stepsFor(5));
 *     // ... store slice.end, ship it, come back to it ...
 *     slice = sliceBattle(slice.end, stepsFor(5));
 *
 * That is what the serialisable state buys: total cost is linear in simulated
 * time and independent of how many slices you cut it into, instead of
 * quadratic in the slice count. The identity that makes it safe is
 *
 *     battleAt(a + b)  ===  advanceBattle(battleAt(a), stepsFor(b))
 *
 * and `sim.test.ts` asserts it field-by-field, including across a JSON
 * round-trip of the intermediate state. It is the property the whole slice
 * model rests on, so it is checked rather than assumed.
 *
 * ## Determinism, honestly
 *
 * Deterministic for a given `(seed, options, steps)`. Nothing reads a clock or
 * `Math.random`. Time is an integer step count and every deadline compares
 * step indices, so the two knife-edge float comparisons #98's perturbation
 * testing found in the ported lane (`attackPhase >= 1` at 1.67e-15 margin,
 * `t >= retargetAt` at exactly 0) no longer exist. Units are visited in
 * ascending id order, and steering is double-buffered — every unit steers off
 * the same start-of-step positions — so the result does not depend on array
 * order either.
 *
 * `battleAt` takes seconds for ergonomics and rounds to whole steps via
 * `stepsFor`. Prefer step counts anywhere a boundary has to line up exactly.
 *
 * ## What this is not
 *
 * A capture rig, not gameplay. Nothing dies (that is #101), there are no
 * projectiles, no HP and no damage — a hit is a reaction stamp. Nothing here
 * is an art-direction commitment. See `README.md`.
 */

import type { Archetype } from "./archetypes.ts";
import {
  type Behaviour,
  type BehaviourContext,
  behavioursFor,
  contextFor,
  FIXED_STEP,
  RETARGET_STEPS,
} from "./behaviours.ts";
import { clamp, mixSeed, nextRandom, seedRandom } from "./procedural.ts";
import type { BattleOptions, SimState, SimUnit } from "./state.ts";
import type { Side, Tier } from "./units.ts";

export type { BattleOptions, SimState, SimUnit } from "./state.ts";
export type { Side } from "./units.ts";
export {
  ATTACK_STEPS,
  attackPhaseOf,
  type Behaviour,
  type BehaviourContext,
  type BehaviourPhase,
  BEHAVIOURS,
  FIXED_STEP,
  RELEASE_AT,
  RELEASE_STEP,
  RETARGET_STEPS,
  SEPARATION_RADIUS,
} from "./behaviours.ts";
export { factionOf } from "./units.ts";

/** Ground axis the lines advance along: screen-vertical under the 2:1 camera. */
const APPROACH_X = Math.SQRT1_2;
const APPROACH_Z = Math.SQRT1_2;
/** Ground axis the ranks spread along: screen-horizontal, uncompressed. */
const RANK_X = Math.SQRT1_2;
const RANK_Z = -Math.SQRT1_2;

const DEFAULT_SEED = 20890724;
/** Mixed into every per-unit stream so it cannot collide with the battle's. */
const UNIT_STREAM = 0x5ca1ab1e;

/** The bake-off's mixed hero roster: one medic + one melee vs melee + ranged. */
function defaultHeroArchetype(side: Side, heroIndex: number): Archetype {
  if (side === 0) { return heroIndex === 0 ? "medic" : "melee"; }
  return heroIndex === 0 ? "melee" : "ranged";
}

/** Melee in front, ranged behind, one in three swapped so silhouettes mix. */
function defaultFodderArchetype(rank: number, index: number): Archetype {
  if (rank === 0) { return index % 3 === 2 ? "ranged" : "melee"; }
  return index % 3 === 2 ? "melee" : "ranged";
}

function makeUnit(
  id: number,
  side: Side,
  tier: Tier,
  archetype: Archetype,
  x: number,
  z: number,
  facing: number,
  seed: number,
): SimUnit {
  const unit: SimUnit = {
    aimY: 1,
    aimX: x + Math.sin(facing) * 4,
    aimZ: z + Math.cos(facing) * 4,
    angularVelocity: 0,
    archetype,
    attackStep: -1,
    ax: 0,
    az: 0,
    cooldownSteps: 0,
    facing,
    firedAtStep: -1,
    hitAtStep: -1,
    id,
    randomState: mixSeed(seed, id, UNIT_STREAM),
    side,
    speed: 0,
    targetId: -1,
    tier,
    vx: 0,
    vz: 0,
    x,
    z,
  };
  // Staggered opening cooldown, drawn from the unit's OWN stream so adding a
  // draw for one unit cannot shift another unit's opening beat.
  unit.cooldownSteps = Math.round((nextRandom(unit) * 1.4) / FIXED_STEP);
  return unit;
}

/**
 * Two facing lines, ranks spread along the screen-horizontal so a crowd still
 * reads as two armies rather than two clumps. Heroes take fixed slots in the
 * front rank, off-centre, so "can you pick the hero out of a crowd" stays a
 * real test and not a centred-subject giveaway.
 *
 * Defaults field 40 bodies — 18 fodder + 2 heroes a side — the scale every
 * bake-off lane converged on (#69, and #95's working assumptions).
 */
export function createBattle(options: BattleOptions = {}): SimState {
  const seed = options.seed ?? DEFAULT_SEED;
  const fodderPerSide = options.fodderPerSide ?? 18;
  const heroesPerSide = options.heroesPerSide ?? 2;
  const standoff = options.standoff ?? 6.4;
  const spacing = options.spacing ?? 1.42;
  const heroArchetypeAt = options.heroArchetypeAt ?? defaultHeroArchetype;
  const fodderArchetypeAt = options.fodderArchetypeAt ?? defaultFodderArchetype;

  const state: SimState = {
    randomState: seedRandom(seed),
    retargetAtStep: 0,
    step: 0,
    t: 0,
    units: [],
  };
  let id = 0;

  for (const side of [0, 1] as Side[]) {
    const sign = side === 0 ? 1 : -1;
    const total = fodderPerSide + heroesPerSide;
    const perRank = Math.ceil(total / 2);
    const heroSlots = new Set<number>();
    for (let h = 0; h < heroesPerSide; h += 1) {
      heroSlots.add(Math.floor((perRank * (h + 1)) / (heroesPerSide + 1)) + (side === 0 ? 0 : 1));
    }
    let fodderPlaced = 0;
    let heroesPlaced = 0;
    for (let i = 0; i < total; i += 1) {
      const rank = i < perRank ? 0 : 1;
      const slot = i < perRank ? i : i - perRank;
      const count = rank === 0 ? perRank : total - perRank;
      const offset = (slot - (count - 1) / 2) * spacing + (nextRandom(state) - 0.5) * 0.34;
      const depth = standoff * sign + sign * rank * 1.55 + (nextRandom(state) - 0.5) * 0.3;
      const x = APPROACH_X * depth + RANK_X * offset;
      const z = APPROACH_Z * depth + RANK_Z * offset;
      const facing = Math.atan2(-APPROACH_X * sign, -APPROACH_Z * sign);

      const isHero = rank === 0 && heroSlots.has(slot) && heroesPlaced < heroesPerSide;
      if (isHero) {
        const archetype = heroArchetypeAt(side, heroesPlaced);
        heroesPlaced += 1;
        state.units.push(makeUnit(id, side, "hero", archetype, x, z, facing, seed));
      } else {
        const archetype = fodderArchetypeAt(rank, fodderPlaced);
        fodderPlaced += 1;
        state.units.push(makeUnit(id, side, "fodder", archetype, x, z, facing, seed));
      }
      id += 1;
    }
  }

  return state;
}

export interface SoloUnitSpec {
  archetype?: Archetype;
  tier?: Tier;
  side?: Side;
  x?: number;
  z?: number;
  facing?: number;
}

/**
 * One unit outside a battle — what the scene's scripted `hero` and `lineup`
 * views drive, and what a rig test poses.
 *
 * It exists so `SimUnit` is built in exactly one place: adding a field is then
 * one edit in `state.ts` plus one in `makeUnit`, and every caller inherits it.
 * A hand-written `SimUnit` literal elsewhere is a latent bug.
 */
export function soloUnit(id: number, spec: SoloUnitSpec = {}): SimUnit {
  const unit = makeUnit(
    id,
    spec.side ?? 0,
    spec.tier ?? "hero",
    spec.archetype ?? "medic",
    spec.x ?? 0,
    spec.z ?? 0,
    spec.facing ?? 0,
    id,
  );
  // No battle means no cooldown pressure; the scripted clips set the beat.
  unit.cooldownSteps = 0;
  return unit;
}

/**
 * The integrator. Deliberately NOT a behaviour: accelerate toward the desired
 * velocity, cap at the archetype's max speed, move, then turn to face travel
 * (or the aim point when planted). Anything that wants to change how a unit
 * moves changes `ctx.desiredVx/desiredVz` from a `steer` behaviour instead.
 */
function integrate(unit: SimUnit, ctx: BehaviourContext): void {
  const dt = FIXED_STEP;
  const maxSpeed = ctx.profile.maxSpeed;
  const accelX = (ctx.desiredVx - unit.vx) * 6;
  const accelZ = (ctx.desiredVz - unit.vz) * 6;
  // Low-passed acceleration; the lean layer wants intent, not integrator noise.
  unit.ax += (accelX - unit.ax) * Math.min(1, dt * 9);
  unit.az += (accelZ - unit.az) * Math.min(1, dt * 9);

  unit.vx += accelX * dt;
  unit.vz += accelZ * dt;
  const speed = Math.hypot(unit.vx, unit.vz);
  if (speed > maxSpeed) {
    unit.vx = (unit.vx / speed) * maxSpeed;
    unit.vz = (unit.vz / speed) * maxSpeed;
  }
  unit.speed = Math.hypot(unit.vx, unit.vz);
  unit.x += unit.vx * dt;
  unit.z += unit.vz * dt;

  // Facing: travel direction while moving, aim direction while planted.
  const wanted = unit.speed > 0.25
    ? Math.atan2(unit.vx, unit.vz)
    : Math.atan2(unit.aimX - unit.x, unit.aimZ - unit.z);
  let delta = (wanted - unit.facing) % (Math.PI * 2);
  if (delta > Math.PI) { delta -= Math.PI * 2; }
  if (delta <= -Math.PI) { delta += Math.PI * 2; }
  const turn = clamp(delta * 5.5, -3.4, 3.4);
  unit.angularVelocity += (turn - unit.angularVelocity) * Math.min(1, dt * 12);
  unit.facing += unit.angularVelocity * dt;
}

function run(behaviours: Behaviour[], unit: SimUnit, ctx: BehaviourContext): void {
  for (const behaviour of behaviours) { behaviour.step(unit, ctx); }
}

/**
 * Exactly one fixed step.
 *
 * There is no `dt` parameter on purpose: a variable timestep makes the slice
 * boundary its own drift source, and this sim exists to be reproduced frame
 * for frame. If you need to catch up to a wall clock, call this in a loop.
 */
export function stepBattle(state: SimState): void {
  state.step += 1;
  // Derived from the integer, not accumulated — the float cannot drift.
  state.t = state.step * FIXED_STEP;

  // Ascending id, not array position, so removing a unit later (#101) cannot
  // reorder anyone else's turn.
  const order = [...state.units].sort((a, b) => a.id - b.id);
  const byId = new Map<number, SimUnit>();
  for (const unit of order) { byId.set(unit.id, unit); }

  if (state.step >= state.retargetAtStep) {
    const acquire = behavioursFor("acquire");
    for (const unit of order) { run(acquire, unit, contextFor(unit, state, order, byId)); }
    state.retargetAtStep = state.step + RETARGET_STEPS;
  }

  // Pass 1 — steer. Nothing has moved yet, so every unit reads the same
  // start-of-step positions. This is the double buffering.
  const steer = behavioursFor("steer");
  const contexts: BehaviourContext[] = [];
  for (const unit of order) {
    const ctx = contextFor(unit, state, order, byId);
    run(steer, unit, ctx);
    contexts.push(ctx);
  }

  // Pass 2 — integrate, all at once.
  for (let i = 0; i < order.length; i += 1) {
    const unit = order[i];
    const ctx = contexts[i];
    if (unit === undefined || ctx === undefined) { continue; }
    integrate(unit, ctx);
  }

  // Pass 3 — act, on post-move positions.
  const act = behavioursFor("act");
  for (let i = 0; i < order.length; i += 1) {
    const unit = order[i];
    const ctx = contexts[i];
    if (unit === undefined || ctx === undefined) { continue; }
    run(act, unit, ctx);
  }
}

/** Whole fixed steps in `seconds`. The seconds-to-steps door. */
export function stepsFor(seconds: number): number {
  return Math.max(0, Math.round(seconds / FIXED_STEP));
}

/** Seconds a step count represents. The inverse of `stepsFor`. */
export function secondsFor(steps: number): number {
  return steps * FIXED_STEP;
}

/**
 * Resume an existing battle by `steps` fixed steps. Mutates and returns it, so
 * a slice boundary costs only the new steps and never a replay.
 */
export function advanceBattle(state: SimState, steps: number): SimState {
  const count = Math.max(0, Math.round(steps));
  for (let i = 0; i < count; i += 1) { stepBattle(state); }
  return state;
}

/**
 * Deterministic time-indexed battle state — the first-class entry point.
 *
 * A pure function of `(seconds, options)`: replays a fresh battle from step 0.
 * Use it to open a match or to shoot a still at a known moment. To *continue*
 * a match, keep the state and use `advanceBattle` / `sliceBattle` instead —
 * `battleAt` is O(seconds) by construction and always will be.
 */
export function battleAt(seconds: number, options: BattleOptions = {}): SimState {
  return advanceBattle(createBattle(options), stepsFor(seconds));
}

/** Deep copy. The state is plain data, so this is the whole implementation. */
export function cloneBattle(state: SimState): SimState {
  return { ...state, units: state.units.map((unit) => ({ ...unit })) };
}

/**
 * A bounded window of the fight — what one slice resolution produces.
 *
 * `end` is a live, resumable state: pass it straight to the next
 * `sliceBattle` call. `frames` is empty unless `record` is set; when it is,
 * `frames[i]` holds the units after step `fromStep + i + 1`, which is what a
 * scrubbable slice-boundary UI wants.
 */
export interface BattleSlice {
  /** Step index the window opens at. */
  fromStep: number;
  /** Step index the window closes at. */
  toStep: number;
  /** Seconds, derived — for labelling, not for deciding. */
  from: number;
  to: number;
  steps: number;
  end: SimState;
  frames: SimUnit[][];
}

export interface SliceOptions {
  /** Snapshot the units after every step. Costs ~1 object per unit per step. */
  record?: boolean;
  /** Slice from a copy, leaving `state` untouched. Default: mutate in place. */
  copy?: boolean;
}

/**
 * Simulate one slice forward from `state`.
 *
 * ```ts
 * let slice = sliceBattle(createBattle(), stepsFor(5), { record: true });
 * // ... the player decides at the boundary ...
 * slice = sliceBattle(slice.end, stepsFor(5), { record: true });
 * ```
 *
 * `steps` is an integer step count, not seconds, so consecutive slices tile
 * the timeline exactly. Use `stepsFor(seconds)` at the call site if that is
 * how you think about it.
 */
export function sliceBattle(
  state: SimState,
  steps: number,
  options: SliceOptions = {},
): BattleSlice {
  const end = options.copy === true ? cloneBattle(state) : state;
  const fromStep = end.step;
  const count = Math.max(0, Math.round(steps));
  const frames: SimUnit[][] = [];
  for (let i = 0; i < count; i += 1) {
    stepBattle(end);
    if (options.record === true) { frames.push(end.units.map((unit) => ({ ...unit }))); }
  }
  return {
    end,
    frames,
    from: secondsFor(fromStep),
    fromStep,
    steps: count,
    to: secondsFor(end.step),
    toStep: end.step,
  };
}
