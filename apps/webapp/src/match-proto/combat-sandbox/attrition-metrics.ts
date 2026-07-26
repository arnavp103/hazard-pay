/**
 * THROWAWAY SCAFFOLDING (#101): what a treatment does to the fight, in numbers.
 *
 * The gallery is the deliverable and the human makes the call — but three of
 * #101's questions have a measurable half, and a picture of a thinning crowd is
 * much easier to read next to the curve that produced it:
 *
 *   - **does a fight need a visible arc?** → `alive` over time, and the steps
 *     at which each side crosses half and quarter strength.
 *   - **readability as it thins** → bodies on screen, the crowd's screen
 *     bounding box in pixels, and the median nearest-neighbour gap in pixels.
 *     Marking and formation were tuned at 40 bodies and 23 px of separation
 *     (#97 measured both); this says what those become at 12.
 *   - **do corpses help or hurt?** → `bodies` versus `alive`, i.e. the share of
 *     the silhouettes on screen that are dead.
 *
 * Plus the two couplings #97 measured, recomputed here against *this* death
 * rule so the gallery quotes its own fight rather than another one:
 * mid-swing target flips, and unit-frames spent aimed at something dead.
 *
 * Everything runs in Node with no renderer. Screen space is computed from the
 * same dimetric basis and zoom `scene.ts` uses, restated here so this module
 * has no dependency on Three.
 */

import {
  type AttritionTreatment,
  installAttrition,
  isDead,
} from "./attrition.ts";
import {
  type BattleOptions,
  createBattle,
  FIXED_STEP,
  type SimState,
  type SimUnit,
  stepBattle,
  stepsFor,
} from "./sim.ts";

/** `scene.ts`: `PX_PER_UNIT` at the crowd zoom. */
const PX_PER_UNIT = 40;
const CROWD_ZOOM = 0.55;
const PX = PX_PER_UNIT * CROWD_ZOOM;
/** Screen-right unit vector of the fixed 2:1 dimetric camera, in world space. */
const RIGHT_X = Math.SQRT1_2;
const RIGHT_Z = -Math.SQRT1_2;
/** Screen-up, evaluated on the ground plane (y = 0), where it is the flat 2:1 squash. */
const UP_XZ = -0.35355;

function screenX(unit: SimUnit): number {
  return (unit.x * RIGHT_X + unit.z * RIGHT_Z) * PX;
}

function screenY(unit: SimUnit): number {
  return (unit.x + unit.z) * UP_XZ * PX;
}

export interface AttritionSample {
  step: number;
  t: number;
  /** Units still standing. */
  alive: number;
  /** Silhouettes on screen: the living plus whatever corpses still linger. */
  bodies: number;
  aliveBySide: [number, number];
  /** Crowd bounding box, in screen pixels at the crowd zoom. */
  boxWidth: number;
  boxHeight: number;
  /** Median nearest-neighbour gap between living units, in screen pixels. */
  medianGap: number;
}

export interface AttritionReport {
  treatment: string;
  commit: boolean;
  seed: number | undefined;
  seconds: number;
  samples: AttritionSample[];
  /** Step of the first death, or -1 if nothing died. */
  firstDeathStep: number;
  /** First step a side fell to half / a quarter of its starting strength, or -1. */
  halfStrengthStep: number;
  quarterStrengthStep: number;
  /** Units standing at the end, per side. */
  survivors: [number, number];
  attacks: number;
  /** Attacks that wound up at one enemy and released on another. #97: 1.8 % → 12.4 %. */
  midSwingFlips: number;
  /** Living unit-frames whose target was dead or already spliced. #97: 5.3 % → 13.7 %. */
  aimedAtDeadFrames: number;
  livingUnitFrames: number;
  /** Target changes per living unit per second. #97: 0.07 → 0.24. */
  targetChurnPerUnitSecond: number;
}

export interface MeasureOptions extends BattleOptions {
  /** Seconds to simulate. */
  seconds?: number;
  /** Sample cadence, in seconds. */
  every?: number;
  /** Install the commitment rule alongside the treatment. Default true. */
  commit?: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) { return 0; }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const low = sorted[middle - 1] ?? 0;
  const high = sorted[middle] ?? 0;
  return sorted.length % 2 === 0 ? (low + high) / 2 : high;
}

function sampleAt(state: SimState): AttritionSample {
  const living = state.units.filter((unit) => !isDead(unit));
  const aliveBySide: [number, number] = [0, 0];
  for (const unit of living) { aliveBySide[unit.side] += 1; }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const unit of state.units) {
    const sx = screenX(unit);
    const sy = screenY(unit);
    minX = Math.min(minX, sx);
    maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy);
    maxY = Math.max(maxY, sy);
  }
  const gaps: number[] = [];
  for (const unit of living) {
    let nearest = Infinity;
    for (const other of living) {
      if (other.id === unit.id) { continue; }
      nearest = Math.min(nearest, Math.hypot(screenX(unit) - screenX(other), screenY(unit) - screenY(other)));
    }
    if (Number.isFinite(nearest)) { gaps.push(nearest); }
  }
  return {
    alive: living.length,
    aliveBySide,
    bodies: state.units.length,
    boxHeight: Number.isFinite(minY) ? Number((maxY - minY).toFixed(1)) : 0,
    boxWidth: Number.isFinite(minX) ? Number((maxX - minX).toFixed(1)) : 0,
    medianGap: Number(median(gaps).toFixed(1)),
    step: state.step,
    t: Number((state.step * FIXED_STEP).toFixed(3)),
  };
}

/**
 * Run one battle under one treatment and measure it.
 *
 * Installs the treatment for the duration and restores the registries after,
 * so two calls in a row do not contaminate each other — the same discipline
 * `extension-points.test.ts` uses.
 */
export function measureAttrition(
  treatment: AttritionTreatment,
  options: MeasureOptions = {},
): AttritionReport {
  const { commit = true, every = 1, seconds = 24, ...battleOptions } = options;
  const restore = installAttrition(treatment, { commit });
  try {
    const state = createBattle(battleOptions);
    const startingPerSide = state.units.length / 2;
    const totalSteps = stepsFor(seconds);
    const sampleEvery = Math.max(1, stepsFor(every));
    const samples: AttritionSample[] = [sampleAt(state)];

    let firstDeathStep = -1;
    let halfStrengthStep = -1;
    let quarterStrengthStep = -1;
    let attacks = 0;
    let midSwingFlips = 0;
    let aimedAtDeadFrames = 0;
    let livingUnitFrames = 0;
    let targetChanges = 0;
    // Per-unit carry: the target a swing was launched at, and the last target
    // seen, both keyed by id so a spliced unit simply stops contributing.
    const swingTarget = new Map<number, number>();
    const lastTarget = new Map<number, number>();
    // Who was standing at the end of the previous step. A death has to be
    // detected as "was standing, no longer is" rather than as `deathStep >= 0`,
    // because the `removed` and `ranks` treatments splice the body out on the
    // same step and there is nothing left to read a flag off.
    let standing = new Set<number>(state.units.map((unit) => unit.id));

    for (let i = 0; i < totalSteps; i += 1) {
      const before = new Map<number, number>();
      for (const unit of state.units) { before.set(unit.id, unit.attackStep); }

      stepBattle(state);

      const byId = new Map<number, SimUnit>();
      for (const unit of state.units) { byId.set(unit.id, unit); }
      const nowStanding = new Set<number>();
      for (const unit of state.units) {
        if (!isDead(unit)) { nowStanding.add(unit.id); }
      }
      if (firstDeathStep < 0) {
        for (const id of standing) {
          if (nowStanding.has(id)) { continue; }
          firstDeathStep = state.step;
          break;
        }
      }
      standing = nowStanding;

      for (const unit of state.units) {
        if (isDead(unit)) { continue; }
        livingUnitFrames += 1;

        // Aimed at something dead: the target died, or was spliced out from
        // under the aim point and is now a ghost.
        if (unit.targetId >= 0) {
          const target = byId.get(unit.targetId);
          if (target === undefined || isDead(target)) { aimedAtDeadFrames += 1; }
        }

        const previous = lastTarget.get(unit.id);
        if (previous !== undefined && previous !== unit.targetId && unit.targetId >= 0) {
          targetChanges += 1;
        }
        lastTarget.set(unit.id, unit.targetId);

        // A swing starts the step `attackStep` goes from -1 to >= 0, and lands
        // the step it is released. Compare the target at each end.
        const wasAttacking = (before.get(unit.id) ?? -1) >= 0;
        if (!wasAttacking && unit.attackStep >= 0) {
          swingTarget.set(unit.id, unit.targetId);
        }
        if (unit.firedAtStep === state.step) {
          attacks += 1;
          const launched = swingTarget.get(unit.id);
          if (launched !== undefined && launched !== unit.targetId) { midSwingFlips += 1; }
        }
      }

      // Casualty milestones are read on the worse-off side: the question is
      // whether a *fight* has an arc, and a side collapsing is the arc.
      const perSide: [number, number] = [0, 0];
      for (const unit of state.units) {
        if (!isDead(unit)) { perSide[unit.side] += 1; }
      }
      const worst = Math.min(perSide[0], perSide[1]);
      if (halfStrengthStep < 0 && worst <= startingPerSide / 2) { halfStrengthStep = state.step; }
      if (quarterStrengthStep < 0 && worst <= startingPerSide / 4) {
        quarterStrengthStep = state.step;
      }

      if (state.step % sampleEvery === 0) { samples.push(sampleAt(state)); }
    }

    const final: [number, number] = [0, 0];
    for (const unit of state.units) {
      if (!isDead(unit)) { final[unit.side] += 1; }
    }

    return {
      aimedAtDeadFrames,
      attacks,
      commit,
      firstDeathStep,
      halfStrengthStep,
      livingUnitFrames,
      midSwingFlips,
      quarterStrengthStep,
      samples,
      seconds,
      seed: battleOptions.seed,
      survivors: final,
      targetChurnPerUnitSecond: livingUnitFrames === 0
        ? 0
        : Number((targetChanges / (livingUnitFrames * FIXED_STEP)).toFixed(3)),
      treatment: treatment.name,
    };
  } finally {
    restore();
  }
}

/** Percent, to one decimal, guarding the empty denominator. */
export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1));
}
