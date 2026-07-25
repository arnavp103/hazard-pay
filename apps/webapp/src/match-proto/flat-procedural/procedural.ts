/**
 * THROWAWAY PROTOTYPE (#89): the procedural animation layers.
 *
 * Everything here is a pure function of state, so it is testable in node
 * with no renderer (see procedural.test.ts) and deterministic for capture.
 * The lane's hypothesis is that these layers carry the motion and a very
 * small authored base only has to supply the parts code is bad at (weight,
 * intent, contact timing). The layer list is the one #89 asks for:
 *
 *   1. per-unit timing/phase offsets      -> unitJitter
 *   2. stride matched to movement speed   -> strideOf
 *   3. torso and head aim at target       -> aimAt
 *   4. weapon-hand IK                     -> solveArmIk
 *   5. lean on accelerate / turn          -> leanOf
 *   6. recoil and impact reaction         -> Spring
 *
 * Angles are radians. Rig convention: a limb's bind direction is -Y, the
 * elbow/knee bends about local X, and yaw is about Y with +Z as front.
 */

export type Triple = [number, number, number];

export const TAU = Math.PI * 2;

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : (value > high ? high : value);
}

/** Frame-rate independent exponential approach; `lambda` is 1/e per second. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** Shortest signed angular difference, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) { delta -= TAU; }
  if (delta <= -Math.PI) { delta += TAU; }
  return delta;
}

/** Deterministic 0..1 hash — the seed of every per-unit desynchronisation. */
export function hash01(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Seeded PRNG so a whole battle replays identically for capture. */
export function makeRandom(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface UnitJitter {
  /** Clip phase offset in seconds — kills the synchronised-toys read. */
  phase: number;
  /** Playback rate multiplier, ~0.9..1.1. */
  rate: number;
  /** Amplitude multiplier, ~0.85..1.15 — some units move bigger than others. */
  amplitude: number;
  /** Small per-unit posture bias so a formation is not a row of clones. */
  postureBias: number;
}

/**
 * Per-unit desynchronisation. Three independent hashes, because reusing one
 * hash makes rate and amplitude correlate and the crowd re-synchronises into
 * visible bands.
 */
export function unitJitter(id: number): UnitJitter {
  return {
    amplitude: 0.85 + hash01(id * 2654435761 + 17) * 0.3,
    phase: hash01(id) * 4,
    postureBias: (hash01(id * 40503 + 991) - 0.5) * 0.16,
    rate: 0.9 + hash01(id * 2246822519 + 7) * 0.2,
  };
}

export interface Stride {
  /** Steps per second. Zero when standing. */
  frequency: number;
  /** Hip swing amplitude in radians. */
  swing: number;
  /** Vertical bob amplitude in world units. */
  bob: number;
  /** 0..1 blend from the standing clip to the locomotion clip. */
  blend: number;
}

/**
 * Stride matched to movement speed, not to a fixed clip rate. A walk cycle
 * covers two leg lengths of ground per stride, so frequency ~ speed / (2L);
 * amplitude grows with speed and then saturates so a sprint does not do the
 * splits. Below `SPEED_FLOOR` the unit is standing and locomotion blends out.
 */
const SPEED_FLOOR = 0.08;

export function strideOf(speed: number, legLength: number): Stride {
  if (speed <= SPEED_FLOOR) {
    return { blend: 0, bob: 0, frequency: 0, swing: 0 };
  }
  const stride = Math.max(legLength * 2, 0.2);
  const frequency = clamp(speed / stride, 0.35, 3.4);
  const drive = clamp(speed / 1.8, 0, 1.35);
  return {
    blend: clamp((speed - SPEED_FLOOR) / 0.35, 0, 1),
    bob: 0.018 + 0.042 * drive,
    frequency,
    swing: 0.28 + 0.46 * Math.min(drive, 1),
  };
}

export interface AimLimits {
  /** Max torso yaw away from the facing. */
  torso: number;
  /** Max head yaw away from the torso. */
  head: number;
  /** Max head pitch, positive looks down. */
  pitch: number;
}

export const DEFAULT_AIM: AimLimits = { head: 0.62, pitch: 0.4, torso: 0.5 };

export interface Aim {
  torsoYaw: number;
  headYaw: number;
  headPitch: number;
  /** Residual the body could not cover — what the feet would have to turn. */
  residual: number;
}

/**
 * Torso + head aim at a target. The split is deliberately head-led (the head
 * takes its share first, the torso follows) because the reverse reads as a
 * turret. Whatever neither can cover is returned as `residual` so the caller
 * can decide to turn the feet.
 */
export function aimAt(
  facing: number,
  fromX: number,
  fromZ: number,
  fromY: number,
  toX: number,
  toZ: number,
  toY: number,
  limits: AimLimits = DEFAULT_AIM,
): Aim {
  const wanted = Math.atan2(toX - fromX, toZ - fromZ);
  const offset = angleDelta(facing, wanted);
  const headYaw = clamp(offset, -limits.head, limits.head);
  const torsoYaw = clamp(offset - headYaw, -limits.torso, limits.torso);
  const flat = Math.hypot(toX - fromX, toZ - fromZ);
  const pitch = clamp(-Math.atan2(toY - fromY, Math.max(flat, 0.05)), -limits.pitch, limits.pitch);
  return {
    headPitch: pitch,
    headYaw,
    residual: offset - headYaw - torsoYaw,
    torsoYaw,
  };
}

export interface ArmSolution {
  shoulder: Triple;
  elbow: Triple;
}

/**
 * Analytic two-bone IK for the weapon hand.
 *
 * `target` is the hand position relative to the shoulder joint, in the
 * shoulder's parent frame. Bind direction is -Y and the elbow bends about
 * local X only, so the chain is planar once a Z swing brings the target into
 * the shoulder's YZ plane. That requires the swing to be the OUTERMOST
 * rotation, which is why the shoulder joints are built with euler order
 * `ZYX` (see figure.ts) — under three's default `XYZ` the Z swing composes
 * innermost, the elbow bend leaves the plane, and the hand misses the target
 * by centimetres. Law of cosines then supplies the elbow interior angle and
 * the upper arm's offset from the shoulder-to-hand line.
 */
export function solveArmIk(
  targetX: number,
  targetY: number,
  targetZ: number,
  upper: number,
  lower: number,
): ArmSolution {
  const raw = Math.hypot(targetX, targetY, targetZ);
  if (raw < 1e-5) {
    return { elbow: [0, 0, 0], shoulder: [0, 0, 0] };
  }
  const reach = clamp(raw, Math.abs(upper - lower) + 0.02, upper + lower - 0.002);
  const scale = reach / raw;
  const x = targetX * scale;
  const y = targetY * scale;
  const z = targetZ * scale;

  // Z swing that brings the target into the shoulder's YZ bend plane, chosen
  // so the arm hangs down the plane rather than flipping over the shoulder.
  const psi = Math.atan2(x, -y);
  const planar = Math.hypot(x, y);
  const handAngle = Math.atan2(-z, planar);

  const alpha = Math.acos(clamp(
    (upper * upper + reach * reach - lower * lower) / (2 * upper * reach),
    -1,
    1,
  ));
  const interior = Math.acos(clamp(
    (upper * upper + lower * lower - reach * reach) / (2 * upper * lower),
    -1,
    1,
  ));

  return {
    elbow: [-(Math.PI - interior), 0, 0],
    shoulder: [handAngle + alpha, 0, psi],
  };
}

/**
 * Forward kinematics of the same `ZYX` chain — the IK test's oracle, and used
 * by nothing else. A bone at plane angle `a` points along
 * R_z(psi) . R_x(a) . (0,-1,0).
 */
export function armEndEffector(
  solution: ArmSolution,
  upper: number,
  lower: number,
): Triple {
  const [theta, , psi] = solution.shoulder;
  const bend = solution.elbow[0];
  const sinPsi = Math.sin(psi);
  const cosPsi = Math.cos(psi);
  const segment = (angle: number, length: number): Triple => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [c * sinPsi * length, -c * cosPsi * length, -s * length];
  };
  const a = segment(theta, upper);
  const b = segment(theta + bend, lower);
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export interface Lean {
  /** Forward/back pitch: positive leans into the direction of travel. */
  pitch: number;
  /** Bank into a turn: positive rolls toward the inside of the arc. */
  roll: number;
}

export const LEAN_LIMIT = 0.26;

/**
 * Lean from acceleration and angular velocity. Acceleration is projected onto
 * the facing so a unit leans into a start and back out of a stop; angular
 * velocity banks it into a turn like a runner cutting a corner.
 */
export function leanOf(
  accelX: number,
  accelZ: number,
  angularVelocity: number,
  facing: number,
  gain = 0.09,
): Lean {
  const forwardX = Math.sin(facing);
  const forwardZ = Math.cos(facing);
  const rightX = Math.cos(facing);
  const rightZ = -Math.sin(facing);
  const along = accelX * forwardX + accelZ * forwardZ;
  const across = accelX * rightX + accelZ * rightZ;
  return {
    pitch: clamp(along * gain, -LEAN_LIMIT, LEAN_LIMIT),
    roll: clamp(across * gain * 0.7 + angularVelocity * 0.16, -LEAN_LIMIT, LEAN_LIMIT),
  };
}

/**
 * Critically-ish damped spring. Recoil and impact reactions are kicks into
 * velocity, so a hit produces a real overshoot-and-settle instead of a
 * scripted curve that has to be re-authored per weapon.
 */
export class Spring {
  value = 0;
  velocity = 0;

  constructor(
    private readonly stiffness: number,
    private readonly damping: number,
  ) {}

  kick(impulse: number): void {
    this.velocity += impulse;
  }

  step(dt: number, target = 0): number {
    // Sub-step so a long frame cannot make a stiff spring explode.
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      const accel = (target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.velocity = 0;
  }
}
