/**
 * THROWAWAY PROTOTYPE (#89): the *authored* half of the hypothesis.
 *
 * #89 asks how minimal the authored base can get before motion quality
 * collapses, so the base is not a fixed asset — it is a ladder with four
 * rungs, selectable at runtime with `?base=`:
 *
 *   none    0 keys.  Nothing authored at all. The procedural locomotion
 *           layer (sinusoidal hips/knees/arms at the stride frequency) is
 *           the entire animation. This is the floaty control.
 *   stance  1 key.   A single held posture per clip. Buys silhouette and
 *           weight distribution, buys no timing.
 *   pair    2 keys.  The two contacts of a walk / the coil and the strike
 *           of an attack. Buys contact shape, buys no passing position.
 *   quad    4 keys.  Contact, passing, contact, passing — the classic
 *           minimal walk — and coil / strike / impact-hold / recover.
 *
 * Every rung above `none` is layered ON TOP of the same procedural stack,
 * never instead of it. The whole point is to measure the rung at which the
 * procedural layers stop being able to fake what an animator supplies.
 *
 * Key data below is deliberately tiny: 4 keys x 11 joints is the entire
 * authored content budget of this lane, for every unit in the battle.
 */

import type { Triple } from "./procedural.ts";

export type JointName
  = | "elbowL"
    | "elbowR"
    | "head"
    | "hipL"
    | "hipR"
    | "kneeL"
    | "kneeR"
    | "pelvis"
    | "shoulderL"
    | "shoulderR"
    | "torso";

export const JOINT_NAMES: readonly JointName[] = [
  "pelvis",
  "torso",
  "head",
  "shoulderL",
  "elbowL",
  "shoulderR",
  "elbowR",
  "hipL",
  "kneeL",
  "hipR",
  "kneeR",
];

export type BaseDensity = "none" | "pair" | "quad" | "stance";

export const BASE_DENSITIES: readonly BaseDensity[] = ["none", "stance", "pair", "quad"];

/** Authored keys per clip at each rung — the headline number of the finding. */
export const BASE_KEY_COUNT: Record<BaseDensity, number> = {
  none: 0,
  pair: 2,
  quad: 4,
  stance: 1,
};

/**
 * How each rung combines with the always-on procedural cycle. One key cannot
 * encode a loop, so `stance` may only bias posture; from two keys up the
 * authored cycle takes over the joints it names.
 */
export const AUTHORED_MODE: Record<BaseDensity, "additive" | "off" | "replace"> = {
  none: "off",
  pair: "replace",
  quad: "replace",
  stance: "additive",
};

export type ClipName = "attack" | "stand" | "walk";

export interface PoseKey {
  /** Normalised clip time, 0..1. Keys must be sorted. */
  t: number;
  rot?: Partial<Record<JointName, Triple>>;
  /** Root vertical offset; positive lowers the rig. */
  dip?: number;
  /** Root travel along the facing. */
  lunge?: number;
  /** Vertical squash; <1 squashes and XZ compensates. */
  squash?: number;
}

export interface Pose {
  rot: Partial<Record<JointName, Triple>>;
  dip: number;
  lunge: number;
  squash: number;
}

export interface Clip {
  duration: number;
  keys: PoseKey[];
}

export function emptyPose(): Pose {
  return { dip: 0, lunge: 0, rot: {}, squash: 1 };
}

// --- The authored content ---------------------------------------------------

const WALK_CONTACT_L: PoseKey = {
  dip: 0.012,
  rot: {
    elbowL: [-0.18, 0, 0],
    elbowR: [-0.5, 0, 0],
    hipL: [0.5, 0, 0.03],
    hipR: [-0.42, 0, -0.03],
    kneeL: [-0.09, 0, 0],
    kneeR: [-0.5, 0, 0],
    pelvis: [0, -0.09, 0],
    shoulderL: [-0.3, 0, 0],
    shoulderR: [0.34, 0, 0],
    torso: [0.06, 0.11, 0],
  },
  t: 0,
};

const WALK_PASS_R: PoseKey = {
  dip: 0.058,
  rot: {
    elbowL: [-0.34, 0, 0],
    elbowR: [-0.34, 0, 0],
    hipL: [0.16, 0, 0],
    hipR: [-0.04, 0, 0],
    kneeL: [-0.36, 0, 0],
    kneeR: [-0.62, 0, 0],
    pelvis: [0, 0, 0.035],
    shoulderL: [-0.08, 0, 0],
    shoulderR: [0.1, 0, 0],
    torso: [0.07, 0, 0],
  },
  t: 0.25,
};

const WALK_CONTACT_R: PoseKey = {
  dip: 0.012,
  rot: {
    elbowL: [-0.5, 0, 0],
    elbowR: [-0.18, 0, 0],
    hipL: [-0.42, 0, 0.03],
    hipR: [0.5, 0, -0.03],
    kneeL: [-0.5, 0, 0],
    kneeR: [-0.09, 0, 0],
    pelvis: [0, 0.09, 0],
    shoulderL: [0.34, 0, 0],
    shoulderR: [-0.3, 0, 0],
    torso: [0.06, -0.11, 0],
  },
  t: 0.5,
};

const WALK_PASS_L: PoseKey = {
  dip: 0.058,
  rot: {
    elbowL: [-0.34, 0, 0],
    elbowR: [-0.34, 0, 0],
    hipL: [-0.04, 0, 0],
    hipR: [0.16, 0, 0],
    kneeL: [-0.62, 0, 0],
    kneeR: [-0.36, 0, 0],
    pelvis: [0, 0, -0.035],
    shoulderL: [0.1, 0, 0],
    shoulderR: [-0.08, 0, 0],
    torso: [0.07, 0, 0],
  },
  t: 0.75,
};

/** The one held posture: weight forward, guard up, feet staggered. */
const WALK_STANCE: PoseKey = {
  dip: 0.03,
  rot: {
    elbowL: [-0.34, 0, 0],
    elbowR: [-0.34, 0, 0],
    hipL: [0.12, 0, 0.02],
    hipR: [-0.1, 0, -0.02],
    kneeL: [-0.24, 0, 0],
    kneeR: [-0.2, 0, 0],
    torso: [0.05, 0, 0],
  },
  t: 0,
};

const STAND_LOW: PoseKey = {
  dip: 0.03,
  rot: {
    elbowL: [-0.26, 0, 0],
    elbowR: [-0.42, 0, 0],
    head: [-0.01, 0, 0],
    hipL: [0.07, 0, 0.02],
    hipR: [-0.05, 0, -0.02],
    kneeL: [-0.15, 0, 0],
    kneeR: [-0.1, 0, 0],
    torso: [0.045, 0.05, 0.02],
  },
  t: 0,
};

const STAND_RISE: PoseKey = {
  dip: 0.004,
  rot: {
    elbowL: [-0.2, 0, 0],
    elbowR: [-0.36, 0, 0],
    head: [-0.045, 0, 0],
    hipL: [0.05, 0, 0],
    hipR: [-0.03, 0, 0],
    kneeL: [-0.1, 0, 0],
    kneeR: [-0.06, 0, 0],
    shoulderL: [-0.06, 0, 0.03],
    shoulderR: [-0.06, 0, -0.03],
    torso: [0.02, -0.02, -0.01],
  },
  t: 0.5,
};

const STAND_SHIFT_A: PoseKey = {
  dip: 0.018,
  rot: {
    elbowL: [-0.23, 0, 0],
    elbowR: [-0.4, 0, 0],
    hipL: [0.02, 0, 0.05],
    hipR: [-0.02, 0, -0.01],
    kneeL: [-0.2, 0, 0],
    kneeR: [-0.04, 0, 0],
    torso: [0.05, 0.09, 0.05],
  },
  t: 0.25,
};

const STAND_SHIFT_B: PoseKey = {
  dip: 0.018,
  rot: {
    elbowL: [-0.24, 0, 0],
    elbowR: [-0.4, 0, 0],
    hipL: [-0.01, 0, 0.01],
    hipR: [0.03, 0, -0.05],
    kneeL: [-0.05, 0, 0],
    kneeR: [-0.19, 0, 0],
    torso: [0.05, -0.06, -0.04],
  },
  t: 0.75,
};

const ATTACK_COIL: PoseKey = {
  dip: 0.05,
  lunge: -0.1,
  rot: {
    elbowR: [-0.72, 0, 0],
    head: [0, -0.16, 0],
    hipL: [-0.1, 0, 0],
    hipR: [-0.22, 0, 0],
    kneeR: [-0.3, 0, 0],
    shoulderL: [0.1, 0, 0.16],
    shoulderR: [0.7, 0, -0.14],
    torso: [-0.08, 0.5, 0],
  },
  squash: 1.03,
  t: 0.16,
};

const ATTACK_STRIKE: PoseKey = {
  dip: -0.02,
  lunge: 0.3,
  rot: {
    elbowR: [-0.12, 0, 0],
    head: [0.0, 0.06, 0],
    hipL: [0.6, 0, 0],
    hipR: [-0.5, 0, 0],
    kneeL: [-0.38, 0, 0],
    shoulderL: [0.42, 0, 0.2],
    shoulderR: [-1.24, 0, 0.06],
    torso: [0.2, -0.4, 0],
  },
  squash: 1.08,
  t: 0.34,
};

const ATTACK_IMPACT: PoseKey = {
  dip: 0.07,
  lunge: 0.24,
  rot: {
    elbowR: [-0.24, 0, 0],
    head: [0.04, 0.02, 0],
    hipL: [0.5, 0, 0],
    hipR: [-0.42, 0, 0],
    kneeL: [-0.44, 0, 0],
    shoulderL: [0.3, 0, 0.18],
    shoulderR: [-1.0, 0, 0.04],
    torso: [0.22, -0.3, 0],
  },
  squash: 0.86,
  t: 0.46,
};

const ATTACK_RECOVER: PoseKey = {
  dip: 0.02,
  lunge: 0.04,
  rot: {
    elbowR: [-0.46, 0, 0],
    hipL: [0.14, 0, 0],
    hipR: [-0.12, 0, 0],
    kneeL: [-0.2, 0, 0],
    shoulderR: [-0.2, 0, 0],
    torso: [0.1, -0.04, 0],
  },
  squash: 1,
  t: 0.82,
};

/**
 * Clip lengths are deliberately commensurate (4.0 / 2.0 / 1.0 seconds) so a
 * capture window of exactly one clip loops seamlessly. A GIF that does not
 * close its loop reads as a stutter and gets blamed on the animation.
 */
const CLIP_DURATION: Record<ClipName, number> = { attack: 1.2, stand: 4, walk: 1 };

const LADDER: Record<ClipName, Record<BaseDensity, PoseKey[]>> = {
  attack: {
    none: [],
    pair: [ATTACK_COIL, ATTACK_STRIKE],
    quad: [ATTACK_COIL, ATTACK_STRIKE, ATTACK_IMPACT, ATTACK_RECOVER],
    stance: [{ ...ATTACK_STRIKE, t: 0.34 }],
  },
  stand: {
    none: [],
    pair: [STAND_LOW, STAND_RISE],
    quad: [STAND_LOW, STAND_SHIFT_A, STAND_RISE, STAND_SHIFT_B],
    stance: [STAND_LOW],
  },
  walk: {
    none: [],
    pair: [WALK_CONTACT_L, WALK_CONTACT_R],
    quad: [WALK_CONTACT_L, WALK_PASS_R, WALK_CONTACT_R, WALK_PASS_L],
    stance: [WALK_STANCE],
  },
};

export function authoredClip(name: ClipName, density: BaseDensity): Clip {
  return { duration: CLIP_DURATION[name], keys: LADDER[name][density] };
}

/** Total authored keys across every clip at a rung — the content-cost number. */
export function authoredKeyTotal(density: BaseDensity): number {
  return (["attack", "stand", "walk"] as ClipName[])
    .reduce((sum, name) => sum + LADDER[name][density].length, 0);
}

function lerpTriple(from: Triple | undefined, to: Triple | undefined, mix: number): Triple {
  const a = from ?? [0, 0, 0];
  const b = to ?? [0, 0, 0];
  return [
    a[0] + (b[0] - a[0]) * mix,
    a[1] + (b[1] - a[1]) * mix,
    a[2] + (b[2] - a[2]) * mix,
  ];
}

/**
 * Samples a clip at normalised time `u` (any real; wraps). Linear, wrapping,
 * no easing — deliberately the cheapest possible interpolation, so the
 * comparison measures the key data and not a fancy interpolator.
 */
export function samplePose(clip: Clip, u: number, into: Pose = emptyPose()): Pose {
  into.rot = {};
  into.dip = 0;
  into.lunge = 0;
  into.squash = 1;
  const keys = clip.keys;
  if (keys.length === 0) { return into; }
  const first = keys[0];
  if (first === undefined) { return into; }
  if (keys.length === 1) {
    into.rot = { ...(first.rot ?? {}) };
    into.dip = first.dip ?? 0;
    into.lunge = first.lunge ?? 0;
    into.squash = first.squash ?? 1;
    return into;
  }

  const phase = ((u % 1) + 1) % 1;
  let index = keys.length - 1;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (key !== undefined && key.t > phase) {
      index = i - 1;
      break;
    }
  }
  if (index < 0) { index = keys.length - 1; }
  const from = keys[index];
  const to = keys[(index + 1) % keys.length];
  if (from === undefined || to === undefined) { return into; }

  const fromT = from.t;
  const toT = to.t > fromT ? to.t : to.t + 1;
  const here = phase >= fromT ? phase : phase + 1;
  const span = toT - fromT;
  const mix = span <= 0 ? 0 : (here - fromT) / span;

  const names = new Set<JointName>([
    ...Object.keys(from.rot ?? {}) as JointName[],
    ...Object.keys(to.rot ?? {}) as JointName[],
  ]);
  for (const name of names) {
    into.rot[name] = lerpTriple(from.rot?.[name], to.rot?.[name], mix);
  }
  into.dip = (from.dip ?? 0) + ((to.dip ?? 0) - (from.dip ?? 0)) * mix;
  into.lunge = (from.lunge ?? 0) + ((to.lunge ?? 0) - (from.lunge ?? 0)) * mix;
  into.squash = (from.squash ?? 1) + ((to.squash ?? 1) - (from.squash ?? 1)) * mix;
  return into;
}
