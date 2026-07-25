/**
 * THROWAWAY PROTOTYPE (#89): where the authored base and the procedural
 * layers actually meet.
 *
 * ## The blend rule (this is the experiment)
 *
 * A procedural cycle generator always runs: sinusoidal hips/knees/arms at
 * the speed-matched stride frequency, plus a breath when planted. What the
 * authored rung changes is how much of that the authored keys take over:
 *
 *   none    procedural cycle only. No authored data exists.
 *   stance  procedural cycle + one static authored posture, added. A single
 *           key cannot encode a loop, so it can only bias posture.
 *   pair    authored cycle REPLACES the procedural cycle on every joint the
 *           keys name; unnamed joints keep the procedural cycle.
 *   quad    same rule, four keys.
 *
 * Every other layer — phase offset, aim, IK, lean, recoil, impact — is
 * procedural at all four rungs and stacks additively on top. So the ladder
 * isolates exactly one variable: *does the loop come from keys or from a
 * sine?*
 *
 * ## Layer order
 *
 * bind -> cycle (authored or procedural) -> attack -> aim -> lean ->
 * reactions -> root placement -> weapon IK.
 *
 * IK runs last because it is a constraint, not a pose: whatever the layers
 * above did to the weapon arm, the support hand still has to end up on the
 * foregrip.
 */

import * as THREE from "three";

import {
  AUTHORED_MODE,
  authoredClip,
  type BaseDensity,
  type Clip,
  emptyPose,
  type JointName,
  JOINT_NAMES,
  type Pose,
  samplePose,
} from "./authored.ts";
import type { Archetype, UnitRig } from "./figure.ts";
import {
  aimAt,
  clamp,
  damp,
  leanOf,
  solveArmIk,
  Spring,
  strideOf,
  TAU,
  type Triple,
  unitJitter,
  type UnitJitter,
} from "./procedural.ts";
import { RELEASE_AT, type SimUnit } from "./sim.ts";

export interface LayerFlags {
  /** Per-unit phase/rate/amplitude offsets. */
  phase: boolean;
  /** Speed-matched stride. Off pins the cycle to a fixed rate. */
  stride: boolean;
  /** Torso + head aim at the target. */
  aim: boolean;
  /** Two-bone weapon-hand IK. */
  ik: boolean;
  /** Lean on accelerate / turn. */
  lean: boolean;
  /** Recoil on fire, flinch on incoming hit. */
  react: boolean;
}

export const ALL_LAYERS: LayerFlags = {
  aim: true,
  ik: true,
  lean: true,
  phase: true,
  react: true,
  stride: true,
};

export const NO_LAYERS: LayerFlags = {
  aim: false,
  ik: false,
  lean: false,
  phase: false,
  react: false,
  stride: false,
};

const BIND: Record<JointName, Triple> = {
  elbowL: [-0.3, 0, 0],
  elbowR: [-0.44, 0, 0],
  head: [0.02, 0, 0],
  hipL: [0.06, 0, 0.03],
  hipR: [-0.05, 0, -0.03],
  kneeL: [-0.12, 0, 0],
  kneeR: [-0.09, 0, 0],
  pelvis: [0, 0, 0],
  shoulderL: [0.06, 0, 0.09],
  shoulderR: [0.06, 0, -0.09],
  torso: [0.05, 0, 0],
};

/**
 * Per-archetype posture, added to BIND. Each one puts the weapon forearm
 * roughly where the weapon should point, because the weapon is rigged in
 * line with the forearm — the arm pose *is* the weapon aim.
 */
const ARCHETYPE_BIND: Record<Archetype, Partial<Record<JointName, Triple>>> = {
  medic: {
    elbowL: [-0.5, 0, 0],
    elbowR: [-0.58, 0, 0],
    shoulderL: [0.02, 0, 0.12],
    shoulderR: [-0.42, 0, -0.14],
  },
  melee: {
    elbowL: [-0.45, 0, 0],
    elbowR: [-0.5, 0, 0],
    shoulderL: [0.05, 0, 0.14],
    shoulderR: [-0.3, 0, -0.18],
  },
  ranged: {
    elbowL: [-0.7, 0, 0],
    elbowR: [-0.66, 0, 0],
    shoulderL: [-0.22, 0, 0.4],
    shoulderR: [-0.35, 0, -0.35],
  },
};

const CYCLE_JOINTS: readonly JointName[] = [
  "hipL",
  "hipR",
  "kneeL",
  "kneeR",
  "shoulderL",
  "shoulderR",
  "pelvis",
  "torso",
  "head",
];

const ZERO: Triple = [0, 0, 0];
const HAND_TARGET = new THREE.Vector3();
const STRIKE_TARGET = new THREE.Vector3();

export interface AnimatorOptions {
  density: BaseDensity;
  layers?: LayerFlags;
}

export class UnitAnimator {
  private readonly jitter: UnitJitter;
  private readonly stand: Clip;
  private readonly walk: Clip;
  private readonly attackClip: Clip;
  private readonly layers: LayerFlags;
  private readonly authoredMode: "additive" | "off" | "replace";
  private readonly standPose: Pose = emptyPose();
  private readonly walkPose: Pose = emptyPose();
  private readonly attackPose: Pose = emptyPose();
  private readonly deltas = new Map<JointName, Triple>();
  private readonly touched = new Set<JointName>();

  private strideClock = 0;
  private aimTorso = 0;
  private aimHead = 0;
  private aimPitch = 0;
  private leanPitch = 0;
  private leanRoll = 0;
  private readonly recoil = new Spring(190, 17);
  private readonly flinch = new Spring(120, 12);
  private lastFiredAt = -1;
  private lastHitAt = -1;
  private accent = 0;

  constructor(
    private readonly rig: UnitRig,
    unitId: number,
    options: AnimatorOptions,
  ) {
    this.jitter = unitJitter(unitId);
    this.layers = options.layers ?? ALL_LAYERS;
    this.authoredMode = AUTHORED_MODE[options.density];
    this.stand = authoredClip("stand", options.density);
    this.walk = authoredClip("walk", options.density);
    this.attackClip = authoredClip("attack", options.density);
    if (!this.layers.phase) {
      this.jitter.phase = 0;
      this.jitter.rate = 1;
      this.jitter.amplitude = 1;
      this.jitter.postureBias = 0;
    }
  }

  update(unit: SimUnit, t: number, dt: number): void {
    const rig = this.rig;
    const jitter = this.jitter;
    const stride = strideOf(unit.speed, rig.limb.leg);
    const frequency = this.layers.stride
      ? stride.frequency
      : (stride.blend > 0 ? 1.35 : 0);
    this.strideClock = (this.strideClock + frequency * dt * jitter.rate + 1) % 1;

    this.deltas.clear();
    this.touched.clear();
    const phaseT = t * jitter.rate + jitter.phase;
    const blend = stride.blend;

    // --- 1. cycle: procedural sinusoid first ---
    if (blend > 0) { this.proceduralWalk(stride.swing * jitter.amplitude * blend); }
    this.proceduralIdle(phaseT, 1 - blend);

    // --- 2. the authored rung takes over what it can ---
    let dip = 0;
    let lunge = 0;
    let squash = 1;
    if (this.authoredMode !== "off") {
      const stand = samplePose(this.stand, phaseT / this.stand.duration, this.standPose);
      const walk = samplePose(this.walk, this.strideClock, this.walkPose);
      const replace = this.authoredMode === "replace";
      for (const name of JOINT_NAMES) {
        const a = stand.rot[name];
        const b = walk.rot[name];
        if (a === undefined && b === undefined) { continue; }
        if (replace && this.touched.has(name)) { this.deltas.delete(name); }
        addTriple(this.deltas, name, [
          (a?.[0] ?? 0) * (1 - blend) + (b?.[0] ?? 0) * blend,
          (a?.[1] ?? 0) * (1 - blend) + (b?.[1] ?? 0) * blend,
          (a?.[2] ?? 0) * (1 - blend) + (b?.[2] ?? 0) * blend,
        ]);
      }
      dip += stand.dip * (1 - blend) + walk.dip * blend;
    }
    // Procedural vertical bob always runs — it is what sells ground contact.
    dip += stride.bob * (0.5 - 0.5 * Math.cos(this.strideClock * TAU * 2));

    // --- 3. attack: authored clip, or a procedural envelope at rung `none` ---
    const attacking = unit.attackPhase >= 0;
    if (attacking) {
      const phase = clamp(unit.attackPhase, 0, 1);
      if (this.authoredMode === "off") {
        const hit = Math.sin(clamp((phase - 0.12) / 0.4, 0, 1) * Math.PI);
        const coil = Math.sin(clamp(phase / 0.34, 0, 1) * Math.PI);
        addTriple(this.deltas, "shoulderR", [0.7 * coil - 1.7 * hit, 0, 0]);
        addTriple(this.deltas, "elbowR", [0.3 * hit, 0, 0]);
        addTriple(this.deltas, "torso", [0.2 * hit, 0.4 * coil - 0.7 * hit, 0]);
        lunge += 0.3 * hit;
      } else {
        const pose = samplePose(this.attackClip, phase, this.attackPose);
        const window = Math.min(1, Math.min(phase, 1 - phase) / 0.12);
        for (const name of JOINT_NAMES) {
          const rot = pose.rot[name];
          if (rot === undefined) { continue; }
          addTriple(this.deltas, name, [rot[0] * window, rot[1] * window, rot[2] * window]);
        }
        dip += pose.dip * window;
        lunge += pose.lunge * window;
        squash = 1 + (pose.squash - 1) * window;
      }
    }

    // --- 4. aim ---
    if (this.layers.aim) {
      const aim = aimAt(
        unit.facing,
        unit.x,
        unit.z,
        rig.shoulderHeight,
        unit.aimX,
        unit.aimZ,
        unit.aimY,
      );
      const lambda = attacking ? 16 : 7;
      this.aimTorso = damp(this.aimTorso, aim.torsoYaw, lambda, dt);
      this.aimHead = damp(this.aimHead, aim.headYaw, lambda * 1.4, dt);
      this.aimPitch = damp(this.aimPitch, aim.headPitch, lambda, dt);
      addTriple(this.deltas, "torso", [0, this.aimTorso, 0]);
      addTriple(this.deltas, "head", [this.aimPitch, this.aimHead, 0]);
    }

    // --- 5. lean ---
    if (this.layers.lean) {
      const lean = leanOf(unit.ax, unit.az, unit.angularVelocity, unit.facing);
      this.leanPitch = damp(this.leanPitch, lean.pitch, 9, dt);
      this.leanRoll = damp(this.leanRoll, lean.roll, 9, dt);
      addTriple(this.deltas, "pelvis", [this.leanPitch * 0.55, 0, this.leanRoll * 0.55]);
      addTriple(this.deltas, "torso", [this.leanPitch * 0.45, 0, this.leanRoll * 0.45]);
      addTriple(this.deltas, "head", [-this.leanPitch * 0.5, 0, -this.leanRoll * 0.4]);
    }

    // --- 6. reactions: recoil on release, flinch on incoming hit ---
    if (unit.firedAt > this.lastFiredAt) {
      this.lastFiredAt = unit.firedAt;
      this.accent = 1;
      if (this.layers.react) {
        this.recoil.kick(rig.spec.archetype === "ranged" ? 9 : 6.5);
      }
    }
    if (this.layers.react) {
      if (unit.hitAt > this.lastHitAt) {
        this.lastHitAt = unit.hitAt;
        this.flinch.kick(5.4 * (jitter.postureBias >= 0 ? 1 : -1));
      }
      const recoil = this.recoil.step(dt);
      const flinch = this.flinch.step(dt);
      addTriple(this.deltas, "shoulderR", [recoil * 0.5, 0, 0]);
      addTriple(this.deltas, "elbowR", [-recoil * 0.34, 0, 0]);
      addTriple(this.deltas, "torso", [-recoil * 0.18 - flinch * 0.3, 0, flinch * 0.42]);
      addTriple(this.deltas, "head", [flinch * 0.2, 0, flinch * 0.3]);
      addTriple(this.deltas, "pelvis", [0, 0, flinch * 0.16]);
      lunge -= recoil * 0.05;
    }
    this.accent = Math.max(0, this.accent - dt * 5.5);

    // --- 7. write the pose ---
    const posture = ARCHETYPE_BIND[rig.spec.archetype];
    for (const name of JOINT_NAMES) {
      const bind = BIND[name];
      const stance = posture[name] ?? ZERO;
      const delta = this.deltas.get(name) ?? ZERO;
      const bias = name === "torso" ? jitter.postureBias : 0;
      rig.joints[name].rotation.set(
        bind[0] + stance[0] + delta[0] + bias * 0.4,
        bind[1] + stance[1] + delta[1],
        bind[2] + stance[2] + delta[2] + bias,
      );
    }

    const facing = unit.facing;
    rig.root.position.set(
      unit.x + Math.sin(facing) * lunge,
      -dip,
      unit.z + Math.cos(facing) * lunge,
    );
    rig.root.rotation.set(0, facing, 0);
    const spread = 1 + (1 - squash) * 0.6;
    rig.root.scale.set(spread, squash, spread);

    if (rig.accent !== undefined) {
      const fire = attacking && unit.attackPhase >= RELEASE_AT - 0.06 ? 1 : 0;
      rig.accent.scale.setScalar(1 + this.accent * 2.2 + fire * 0.6);
    }

    // --- 8. IK last: a constraint, not a pose ---
    if (this.layers.ik) { this.applyIk(unit, attacking); }
  }

  /**
   * Two-bone IK on both arms. The weapon hand adapts its reach to the real
   * distance to the target during a melee strike, and the support hand is
   * pinned to the weapon's foregrip afterwards, so the grip survives
   * whatever recoil, lean and aim did to the arms above.
   */
  private applyIk(unit: SimUnit, attacking: boolean): void {
    const rig = this.rig;
    const maxReach = rig.limb.upper + rig.limb.lower;

    if (attacking && rig.spec.archetype !== "ranged") {
      const phase = clamp(unit.attackPhase, 0, 1);
      const window = Math.sin(clamp((phase - 0.16) / 0.42, 0, 1) * Math.PI);
      if (window > 0.02) {
        const distance = Math.hypot(unit.aimX - unit.x, unit.aimZ - unit.z);
        const reach = clamp(distance - 0.4, 0.16, maxReach);
        STRIKE_TARGET.set(0.09 * rig.height, -0.1 * rig.height + reach * 0.2, reach * 0.9);
        this.solveInto("R", STRIKE_TARGET, window);
      }
    }

    // Support-hand grip: two-handed weapons only. Forcing it on a one-handed
    // injector or blade just drags the off arm across the chest.
    if (rig.spec.archetype !== "ranged") { return; }
    rig.root.updateWorldMatrix(true, true);
    rig.foregrip.getWorldPosition(HAND_TARGET);
    rig.joints.torso.worldToLocal(HAND_TARGET);
    HAND_TARGET.sub(rig.joints.shoulderL.position);
    // Out-of-reach grips blend out instead of leaving the arm stretched
    // short of a socket it can never touch.
    const distance = HAND_TARGET.length();
    const weight = clamp((maxReach * 1.15 - distance) / (maxReach * 0.17), 0, 1);
    if (weight > 0.02) { this.solveInto("L", HAND_TARGET, weight); }
  }

  private solveInto(side: "L" | "R", target: THREE.Vector3, weight: number): void {
    const rig = this.rig;
    const solution = solveArmIk(target.x, target.y, target.z, rig.limb.upper, rig.limb.lower);
    const shoulder = side === "L" ? rig.joints.shoulderL : rig.joints.shoulderR;
    const elbow = side === "L" ? rig.joints.elbowL : rig.joints.elbowR;
    const mix = clamp(weight, 0, 1);
    shoulder.rotation.set(
      shoulder.rotation.x + (solution.shoulder[0] - shoulder.rotation.x) * mix,
      shoulder.rotation.y + (solution.shoulder[1] - shoulder.rotation.y) * mix,
      shoulder.rotation.z + (solution.shoulder[2] - shoulder.rotation.z) * mix,
    );
    elbow.rotation.set(
      elbow.rotation.x + (solution.elbow[0] - elbow.rotation.x) * mix,
      elbow.rotation.y + (solution.elbow[1] - elbow.rotation.y) * mix,
      elbow.rotation.z + (solution.elbow[2] - elbow.rotation.z) * mix,
    );
  }

  /** Procedural walk cycle — the whole locomotion at rung `none`. */
  private proceduralWalk(swing: number): void {
    const p = this.strideClock * TAU;
    const sin = Math.sin(p);
    const cos = Math.cos(p);
    addTriple(this.deltas, "hipL", [sin * swing, 0, 0]);
    addTriple(this.deltas, "hipR", [-sin * swing, 0, 0]);
    addTriple(this.deltas, "kneeL", [-(0.42 + 0.38 * Math.sin(p - 1.15)) * swing, 0, 0]);
    addTriple(this.deltas, "kneeR", [-(0.42 + 0.38 * Math.sin(p + Math.PI - 1.15)) * swing, 0, 0]);
    addTriple(this.deltas, "shoulderL", [-sin * swing * 0.62, 0, 0]);
    addTriple(this.deltas, "shoulderR", [sin * swing * 0.62, 0, 0]);
    addTriple(this.deltas, "pelvis", [0, -cos * swing * 0.22, 0]);
    addTriple(this.deltas, "torso", [swing * 0.16, cos * swing * 0.2, 0]);
    for (const name of CYCLE_JOINTS) { this.touched.add(name); }
  }

  /** Procedural breath / weight shift — the whole idle at rung `none`. */
  private proceduralIdle(t: number, weight: number): void {
    if (weight <= 0) { return; }
    const breath = Math.sin((t / 2) * TAU) * weight * this.jitter.amplitude;
    const shift = Math.sin((t / 4) * TAU) * weight * this.jitter.amplitude;
    addTriple(this.deltas, "torso", [0.045 * breath, 0.035 * shift, 0.05 * shift]);
    addTriple(this.deltas, "head", [0.025 * breath, 0.06 * shift, 0.03 * shift]);
    addTriple(this.deltas, "shoulderL", [-0.05 * breath, 0, 0.03 * shift]);
    addTriple(this.deltas, "shoulderR", [-0.05 * breath, 0, -0.03 * shift]);
    addTriple(this.deltas, "hipL", [0, 0, 0.02 * shift]);
    addTriple(this.deltas, "hipR", [0, 0, 0.02 * shift]);
    for (const name of CYCLE_JOINTS) { this.touched.add(name); }
  }
}

function addTriple(into: Map<JointName, Triple>, name: JointName, delta: Triple): void {
  const current = into.get(name);
  if (current === undefined) {
    into.set(name, [delta[0], delta[1], delta[2]]);
    return;
  }
  current[0] += delta[0];
  current[1] += delta[1];
  current[2] += delta[2];
}
