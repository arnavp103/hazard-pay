/**
 * THROWAWAY SCAFFOLDING (#96).
 *
 * # EXTENSION POINT 3 of 3 — add a new combat behaviour
 *
 * `stepBattle` used to be one 90-line function. It is now a fixed integrator
 * with a **behaviour pipeline** either side of it, so a prototype can add unit
 * AI without editing the integrator or re-deriving anyone else's arithmetic.
 *
 * One step runs three passes over the units, in ascending id order:
 *
 *   1. `acquire` behaviours — only on a retarget step (every
 *      `RETARGET_STEPS`). Decide who this unit is fighting.
 *      Built-in: `nearestEnemy`.
 *   2. `steer` behaviours — contribute to `ctx.desiredVx/desiredVz`, the
 *      velocity this unit *wants*. Built-ins: `seekStandoff`, `separate`.
 *      **Nothing has moved yet in this pass**, so every unit steers off the
 *      same start-of-step positions. That double buffering is what removes
 *      the Gauss-Seidel order bias the ported lane had.
 *   3. **the integrator** (in `sim.ts`, not overridable): accelerate toward
 *      the desired velocity, clamp to `profile.maxSpeed`, move, turn. Then
 *      `act` behaviours run on the post-move positions: attacks, hit
 *      registration, cooldowns. Built-in: `attackCycle`.
 *
 * **To add one**: write a `Behaviour`, push it into `BEHAVIOURS` at the phase
 * you want. Order inside a phase is the order in the array, so a later `steer`
 * behaviour sees the earlier ones' contribution.
 *
 * ## Determinism rules for a new behaviour
 *
 *   - draw randomness only via `nextRandom(unit)` — the unit's own stream —
 *     or `nextRandom(state)` for battle-wide draws. Never `Math.random()`.
 *   - compare **step indices**, never accumulated seconds. `ctx.state.step` is
 *     an integer; `state.t` is derived and is for reading, not deciding.
 *   - do not iterate a `Set`/`Map` whose insertion order depends on anything
 *     but unit id, and do not read wall-clock time.
 *   - keep all mutation on `SimUnit` fields, which are plain numbers, so the
 *     state stays snapshot-and-resume-able (see `state.ts`).
 *
 * ## Worked example: death (#101)
 *
 *   1. add `deathStep: number` to `SimUnit` (-1 while alive);
 *   2. add an `act` behaviour that sets it — probably off `hitAtStep`;
 *   3. add a `steer` behaviour, first in the phase, that returns early for a
 *      corpse so it stops seeking;
 *   4. add a matching `AnimationState` in `animation-states.ts` that
 *      suppresses `["aim", "cycle", "ik", "lean"]`.
 *
 * Removing a dead unit from `state.units` entirely is also safe: the sim
 * iterates by id and the renderer keys rigs by id, so nothing indexes units
 * positionally.
 */

import { type CombatProfile, profileOf } from "./archetypes.ts";
import { clamp, nextRandom } from "./procedural.ts";
import type { SimState, SimUnit } from "./state.ts";

/** The one true step, in seconds. Everything else counts steps. */
export const FIXED_STEP = 1 / 60;

/** Steps one attack clip runs for (1.2 s). */
export const ATTACK_STEPS = 72;
/**
 * Step of the attack clip at which damage releases — the first step whose
 * normalised phase reaches `RELEASE_AT`.
 */
export const RELEASE_AT = 0.42;
export const RELEASE_STEP = Math.ceil(RELEASE_AT * ATTACK_STEPS);
/** Below this separation, units push each other apart. */
export const SEPARATION_RADIUS = 1.05;
/** Steps between target re-acquisitions (0.45 s). */
export const RETARGET_STEPS = 27;

/** The animator's 0..1 clip phase, derived from the integer attack step. */
export function attackPhaseOf(unit: SimUnit): number {
  return unit.attackStep < 0 ? -1 : unit.attackStep / ATTACK_STEPS;
}

export type BehaviourPhase = "acquire" | "act" | "steer";

export interface BehaviourContext {
  state: SimState;
  /**
   * Every unit, in ascending id order. **Iterate this, not `state.units`** —
   * it is what makes a step independent of array order, right down to the
   * order floating-point sums accumulate in.
   */
  order: readonly SimUnit[];
  /** Every unit by id. */
  byId: Map<number, SimUnit>;
  /** This unit's combat numbers, from the archetype registry. */
  profile: CombatProfile;
  /** The unit's current target, or undefined if it has none. */
  target: SimUnit | undefined;
  /** Fixed step, seconds. Constant — present so the arithmetic reads right. */
  dt: number;
  /** Velocity this unit wants, accumulated by the `steer` phase. */
  desiredVx: number;
  desiredVz: number;
}

export interface Behaviour {
  readonly name: string;
  readonly phase: BehaviourPhase;
  /** One line. It is here so the pipeline reads as a list of intentions. */
  readonly doc: string;
  step: (unit: SimUnit, ctx: BehaviourContext) => void;
}

/** Closest enemy wins; ties break to the lower id. */
export const nearestEnemy: Behaviour = {
  doc: "target the closest enemy",
  name: "nearestEnemy",
  phase: "acquire",
  step(unit, ctx) {
    let best = -1;
    let bestDistance = Infinity;
    for (const other of ctx.order) {
      if (other.side === unit.side) { continue; }
      const distance = (other.x - unit.x) ** 2 + (other.z - unit.z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = other.id;
      }
    }
    unit.targetId = best;
  },
};

/**
 * Close to the archetype's standoff and hold there — a rifleman parks at 4.7
 * units, a swordsman at 0.9. Also publishes the aim point, because what a unit
 * looks at is a combat decision and not an animation one.
 */
export const seekStandoff: Behaviour = {
  doc: "approach the target to the archetype's standoff, then hold",
  name: "seekStandoff",
  phase: "steer",
  step(unit, ctx) {
    const target = ctx.target;
    if (target === undefined) { return; }
    const dx = target.x - unit.x;
    const dz = target.z - unit.z;
    const distance = Math.hypot(dx, dz) || 1e-4;
    const gap = distance - ctx.profile.standoff;
    const drive = clamp(gap * 1.6, -0.8, 1);
    ctx.desiredVx += (dx / distance) * drive * ctx.profile.maxSpeed;
    ctx.desiredVz += (dz / distance) * drive * ctx.profile.maxSpeed;
    unit.aimX = target.x;
    unit.aimZ = target.z;
    unit.aimY = target.tier === "hero" ? 1.25 : 1.0;
  },
};

/**
 * Boid separation: the cheapest crowd-liveliness layer there is. Without it
 * the ranks interpenetrate and the mass reads as a decal, not bodies.
 */
export const separate: Behaviour = {
  doc: "push apart from anyone inside SEPARATION_RADIUS",
  name: "separate",
  phase: "steer",
  step(unit, ctx) {
    for (const other of ctx.order) {
      if (other.id === unit.id) { continue; }
      const dx = unit.x - other.x;
      const dz = unit.z - other.z;
      const distance = Math.hypot(dx, dz);
      if (distance > SEPARATION_RADIUS || distance < 1e-4) { continue; }
      const push = (1 - distance / SEPARATION_RADIUS) * 2.4;
      ctx.desiredVx += (dx / distance) * push;
      ctx.desiredVz += (dz / distance) * push;
    }
  },
};

/**
 * The attack clip: start it when the target is in reach and the cooldown has
 * run out, release damage partway through, then roll a jittered cooldown so a
 * whole rank does not fire on the same step.
 *
 * "Damage" here is a reaction stamp (`hitAtStep`) and nothing else — no HP, no
 * lethality. Those are out of scope on map #95.
 */
export const attackCycle: Behaviour = {
  doc: "run the attack clip, release at RELEASE_STEP, stamp the target",
  name: "attackCycle",
  phase: "act",
  step(unit, ctx) {
    const { profile, state, target } = ctx;
    if (unit.attackStep >= 0) {
      unit.attackStep += 1;
      if (unit.attackStep === RELEASE_STEP) {
        unit.firedAtStep = state.step;
        if (target !== undefined) { target.hitAtStep = state.step; }
      }
      if (unit.attackStep >= ATTACK_STEPS) {
        unit.attackStep = -1;
        unit.cooldownSteps = Math.round(
          profile.cooldown * (0.75 + nextRandom(unit) * 0.5) / FIXED_STEP,
        );
      }
      return;
    }
    unit.cooldownSteps -= 1;
    const distance = target === undefined
      ? Infinity
      : Math.hypot(target.x - unit.x, target.z - unit.z);
    if (unit.cooldownSteps <= 0 && distance <= profile.attackRange) {
      unit.attackStep = 0;
    }
  },
};

/**
 * The live pipeline. **Add a behaviour here.**
 *
 * It is a mutable array on purpose: a prototype can `BEHAVIOURS.push(...)`,
 * `splice` one out to ablate it, or reorder the steer phase, without forking
 * the sandbox. Do it once at module scope, not per frame — a battle that
 * changes its own pipeline mid-run is not reproducible from `(seed, options)`.
 */
export const BEHAVIOURS: Behaviour[] = [
  nearestEnemy,
  seekStandoff,
  separate,
  attackCycle,
];

export function behavioursFor(phase: BehaviourPhase): Behaviour[] {
  return BEHAVIOURS.filter((behaviour) => behaviour.phase === phase);
}

/** Builds the per-unit context the pipeline and the integrator share. */
export function contextFor(
  unit: SimUnit,
  state: SimState,
  order: readonly SimUnit[],
  byId: Map<number, SimUnit>,
): BehaviourContext {
  return {
    byId,
    desiredVx: 0,
    desiredVz: 0,
    dt: FIXED_STEP,
    order,
    profile: profileOf(unit.archetype, unit.tier),
    state,
    target: unit.targetId < 0 ? undefined : byId.get(unit.targetId),
  };
}
