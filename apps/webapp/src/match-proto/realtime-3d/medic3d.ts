/**
 * THROWAWAY PROTOTYPE (#81): the modular low-poly field medic. One rig,
 * ~4.4 heads tall at 1.85 world units (≈64 screen px at combat zoom),
 * oversized hands/feet/injector, limbs ≥4 px on screen. Identity reads
 * from silhouette + big masses: hooded head, chest rig and backpack in
 * rust livery with a pale cross-equivalent plate, one cybernetic arm,
 * oversized injector tool. Teal emission stays scarce (visor slit,
 * forearm dot, pack signal, injector tip).
 *
 * Animation is deliberately stepped: poses are sampled on a quantized
 * clock (8–12 held poses/sec), with authored holds and a light
 * squash/stretch on the attack impact — motion on twos/threes, not
 * interpolated smoothness.
 */

import * as THREE from "three";

import { cel, flat, inkBox, inkCylinder } from "./cel.ts";

const COAT = "#485654";
const COAT_DARK = "#3e4a49";
const PANTS = "#3b3942";
const SHIN = "#34323a";
const BOOT = "#29252a";
const SKIN = "#a96e51";
const HOOD = "#3b2936";
const METAL = "#77777d";
const LIVERY = "#a6533f";
const PALE = "#cfc3b0";
const SIGNAL = "#2f9e96";
const SIGNAL_HOT = "#c5fff1";

export type MedicAnim = "attack" | "idle" | "turn";

interface Joints {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  shoulderL: THREE.Group;
  elbowL: THREE.Group;
  shoulderR: THREE.Group;
  elbowR: THREE.Group;
  hipL: THREE.Group;
  kneeL: THREE.Group;
  hipR: THREE.Group;
  kneeR: THREE.Group;
}

export interface MedicRig {
  root: THREE.Group;
  joints: Joints;
  tipMaterial: THREE.MeshBasicMaterial;
  tip: THREE.Group;
}

const SHELL = 0.022;

function leg(side: 1 | -1): { boot: THREE.Group; hip: THREE.Group; knee: THREE.Group } {
  const hip = new THREE.Group();
  hip.position.set(side * 0.13, 0.84, 0);

  const thigh = inkBox(0.17, 0.36, 0.19, cel(PANTS), SHELL);
  thigh.position.y = -0.2;
  hip.add(thigh);

  const knee = new THREE.Group();
  knee.position.y = -0.38;
  hip.add(knee);

  const shin = inkBox(0.15, 0.3, 0.16, cel(SHIN), SHELL);
  shin.position.y = -0.16;
  knee.add(shin);

  const boot = inkBox(0.24, 0.15, 0.42, cel(BOOT), SHELL);
  boot.position.set(0, -0.385, 0.09);
  knee.add(boot);

  return { boot, hip, knee };
}

function arm(side: 1 | -1, cyber: boolean): { elbow: THREE.Group; hand: THREE.Group; shoulder: THREE.Group } {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.31, 0.44, 0);

  const sleeve = inkBox(0.14, 0.3, 0.15, cel(COAT), SHELL);
  sleeve.position.y = -0.17;
  shoulder.add(sleeve);

  const elbow = new THREE.Group();
  elbow.position.y = -0.34;
  shoulder.add(elbow);

  const forearm = cyber
    ? inkBox(0.14, 0.27, 0.15, cel(METAL), SHELL)
    : inkBox(0.13, 0.26, 0.14, cel(COAT_DARK), SHELL);
  forearm.position.y = -0.15;
  elbow.add(forearm);

  if (cyber) {
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), flat(SIGNAL));
    dot.position.set(side * 0.02, -0.18, 0.085);
    elbow.add(dot);
  }

  const hand = new THREE.Group();
  hand.position.y = -0.33;
  elbow.add(hand);

  const fist = cyber
    ? inkBox(0.2, 0.16, 0.18, cel(METAL), SHELL)
    : inkBox(0.19, 0.15, 0.17, cel(SKIN), SHELL);
  fist.position.y = -0.06;
  hand.add(fist);

  return { elbow, hand, shoulder };
}

function headGroup(): THREE.Group {
  const head = new THREE.Group();
  head.position.set(0, 0.46, 0);

  const neck = inkBox(0.14, 0.1, 0.13, cel(SKIN), SHELL);
  neck.position.y = 0.02;
  head.add(neck);

  const hood = inkBox(0.36, 0.34, 0.34, cel(HOOD), SHELL);
  hood.position.set(0, 0.17, -0.02);
  head.add(hood);

  const face = inkBox(0.24, 0.18, 0.08, cel(SKIN), SHELL);
  face.position.set(0, 0.13, 0.15);
  head.add(face);

  // Brow shadow keeps the face in the hood's dark band; the visor slit is the only light.
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.09, 0.1), flat("#241a22"));
  brow.position.set(0, 0.205, 0.15);
  head.add(brow);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.02), flat(SIGNAL));
  visor.position.set(0, 0.16, 0.2);
  head.add(visor);

  return head;
}

function crossPlate(width: number, at: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const vertical = new THREE.Mesh(new THREE.BoxGeometry(width * 0.36, width * 1.1, 0.02), flat(PALE));
  const horizontal = new THREE.Mesh(new THREE.BoxGeometry(width, width * 0.36, 0.02), flat(PALE));
  group.add(vertical, horizontal);
  group.position.set(...at);
  return group;
}

function injector(): { tip: THREE.Group; tipMaterial: THREE.MeshBasicMaterial; tool: THREE.Group } {
  const tool = new THREE.Group();

  const body = inkCylinder(0.065, 0.4, cel(METAL), SHELL);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, -0.02, 0.16);
  tool.add(body);

  const tank = inkBox(0.1, 0.1, 0.14, cel(LIVERY), SHELL);
  tank.position.set(0, 0.07, 0.05);
  tool.add(tank);

  const grip = inkBox(0.06, 0.12, 0.07, cel(BOOT), SHELL);
  grip.position.set(0, -0.1, 0.02);
  tool.add(grip);

  const tipMaterial = new THREE.MeshBasicMaterial({ color: SIGNAL });
  const tip = new THREE.Group();
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.028, 0.12, 8), tipMaterial);
  needle.rotation.x = Math.PI / 2;
  tip.add(needle);
  tip.position.set(0, -0.02, 0.4);
  tool.add(tip);

  return { tip, tipMaterial, tool };
}

export function buildMedic(): MedicRig {
  const root = new THREE.Group();

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.9, 0);
  root.add(pelvis);

  const hem = inkBox(0.46, 0.26, 0.32, cel(COAT_DARK), SHELL);
  hem.position.y = 0.02;
  pelvis.add(hem);

  const holster = inkBox(0.12, 0.18, 0.1, cel("#2a2129"), SHELL);
  holster.position.set(0.26, -0.04, 0.06);
  pelvis.add(holster);

  const torso = new THREE.Group();
  torso.position.set(0, 0.12, 0);
  pelvis.add(torso);

  const chest = inkBox(0.5, 0.44, 0.34, cel(COAT), SHELL);
  chest.position.y = 0.28;
  torso.add(chest);

  // Rust chest rig with the pale cross-equivalent plate + a dark strap.
  const rig = inkBox(0.28, 0.26, 0.07, cel(LIVERY), SHELL);
  rig.position.set(0.06, 0.24, 0.19);
  torso.add(rig);
  torso.add(crossPlate(0.13, [0.06, 0.24, 0.24]));
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.02), flat("#2c2530"));
  strap.rotation.z = 0.55;
  strap.position.set(-0.02, 0.3, 0.185);
  torso.add(strap);

  // Field pack: the big medic mass on the back.
  const pack = inkBox(0.38, 0.44, 0.2, cel("#47414b"), SHELL);
  pack.position.set(0, 0.22, -0.27);
  torso.add(pack);
  const packPlate = inkBox(0.24, 0.28, 0.05, cel(LIVERY), SHELL);
  packPlate.position.set(-0.02, 0.22, -0.39);
  torso.add(packPlate);
  const packCross = crossPlate(0.12, [-0.02, 0.22, -0.425]);
  packCross.rotation.y = Math.PI;
  torso.add(packCross);
  const packSignal = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.03), flat(SIGNAL));
  packSignal.position.set(0.13, 0.38, -0.375);
  torso.add(packSignal);
  const aerial = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.03), flat("#1a1218"));
  aerial.position.set(0.15, 0.56, -0.3);
  torso.add(aerial);

  const head = headGroup();
  torso.add(head);

  const armL = arm(-1, true);
  const armR = arm(1, false);
  torso.add(armL.shoulder, armR.shoulder);

  // Rust shoulder pad on the cyber side only — deliberate asymmetry.
  const pad = inkBox(0.24, 0.11, 0.26, cel(LIVERY), SHELL);
  pad.position.set(-0.04, 0.06, 0);
  armL.shoulder.add(pad);

  const { tip, tipMaterial, tool } = injector();
  tool.position.set(0, -0.08, 0.04);
  armR.hand.add(tool);

  const legL = leg(-1);
  const legR = leg(1);
  root.add(legL.hip, legR.hip);

  const kneepad = inkBox(0.16, 0.12, 0.08, cel("#7d4136"), SHELL);
  kneepad.position.set(0, -0.04, 0.1);
  legR.knee.add(kneepad);

  return {
    joints: {
      elbowL: armL.elbow,
      elbowR: armR.elbow,
      head,
      hipL: legL.hip,
      hipR: legR.hip,
      kneeL: legL.knee,
      kneeR: legR.knee,
      pelvis,
      root,
      shoulderL: armL.shoulder,
      shoulderR: armR.shoulder,
      torso,
    },
    root,
    tip,
    tipMaterial,
  };
}

// --- Pose engine -----------------------------------------------------------

type JointName = keyof Joints;

type Rotations = Partial<Record<JointName, [number, number, number]>>;

interface Pose {
  rotations: Rotations;
  /** Root travel along the current facing (world units). */
  lunge: number;
  /** Extra facing yaw on top of the bind facing. */
  facing: number;
  /** Root vertical dip. */
  dip: number;
  /** Vertical squash: <1 squashes, >1 stretches; XZ compensates. */
  squash: number;
  /** Injector tip flash frames. */
  flash: boolean;
}

/** Grounded, weight-forward bind stance — not a toy T-pose. */
const BIND: Rotations = {
  elbowL: [-0.28, 0, 0],
  elbowR: [-0.55, 0, 0],
  head: [0.04, 0, 0],
  hipL: [0.1, 0, 0],
  hipR: [-0.08, 0.15, 0],
  kneeL: [-0.12, 0, 0],
  kneeR: [-0.06, 0, 0],
  shoulderL: [0.12, 0, 0.06],
  shoulderR: [-0.15, 0, -0.08],
  torso: [0.07, 0.1, 0],
};

/** Authored front is +Z: on screen that is the SW three-quarter facing, chest rig toward camera. */
const BASE_FACING = 0;

function emptyPose(): Pose {
  return { dip: 0, facing: 0, flash: false, lunge: 0, rotations: {}, squash: 1 };
}

/** Linear segment progress: 0 before `from`, 1 after `to`. */
function seg(t: number, from: number, to: number): number {
  if (t <= from) { return 0; }
  if (t >= to) { return 1; }
  return (t - from) / (to - from);
}

function idlePose(t: number): Pose {
  const pose = emptyPose();
  const loop = t % 2.4;
  const breath = Math.sin((loop / 2.4) * Math.PI * 2);
  pose.rotations.torso = [0.03 * breath, 0, 0];
  pose.rotations.shoulderL = [0, 0, 0.025 * breath];
  pose.rotations.shoulderR = [0, 0, -0.025 * breath];

  // A held look-around beat and one injector adjust per loop.
  const lookBeats: Array<[number, number, number]> = [[1.0, 1.55, 0.32], [1.55, 1.75, 0.1], [1.9, 2.15, -0.14]];
  const beat = lookBeats.find(([from, to]) => loop >= from && loop < to);
  const headYaw = beat === undefined ? 0 : beat[2];
  pose.rotations.head = [0.02 * breath, headYaw, 0];
  if (loop >= 1.5 && loop < 1.9) {
    pose.rotations.elbowR = [-0.16 * Math.sin(((loop - 1.5) / 0.4) * Math.PI), 0, 0];
  }
  return pose;
}

function attackPose(t: number): Pose {
  const pose = emptyPose();
  const loop = t % 1.8;

  const coil = seg(loop, 0.05, 0.3);
  const strike = seg(loop, 0.45, 0.55);
  const recover = seg(loop, 0.85, 1.3);

  if (loop < 0.45) {
    // Wind up, then HOLD the coil (0.30–0.45): anticipation reads as its own pose.
    pose.rotations.torso = [-0.06 * coil, 0.45 * coil, 0];
    pose.rotations.shoulderR = [0.65 * coil, 0, -0.12 * coil];
    pose.rotations.elbowR = [-0.65 * coil, 0, 0];
    pose.rotations.head = [0, -0.2 * coil, 0];
    pose.rotations.hipR = [-0.18 * coil, 0, 0];
    pose.lunge = -0.08 * coil;
    pose.squash = 1 + 0.025 * coil;
  } else if (loop < 0.85) {
    // One-step lunge into a squashed impact hold.
    pose.rotations.torso = [0.24 * strike, 0.45 - 0.85 * strike, 0];
    pose.rotations.shoulderR = [0.65 - 1.95 * strike, 0, 0];
    pose.rotations.elbowR = [-0.65 + 0.5 * strike, 0, 0];
    pose.rotations.head = [0.1 * strike, -0.2 + 0.28 * strike, 0];
    pose.rotations.hipL = [0.55 * strike, 0, 0];
    pose.rotations.kneeL = [-0.35 * strike, 0, 0];
    pose.rotations.hipR = [-0.5 * strike, 0, 0];
    pose.rotations.shoulderL = [0.35 * strike, 0, 0.15 * strike];
    pose.lunge = -0.08 + 0.36 * strike;
    pose.squash = loop < 0.55 ? 1.05 : (loop < 0.7 ? 0.94 : 0.97);
    pose.flash = loop >= 0.53 && loop < 0.72;
  } else {
    // Ease back to stance, then breathe.
    const back = 1 - recover;
    pose.rotations.torso = [0.24 * back, -0.4 * back, 0];
    pose.rotations.shoulderR = [-1.3 * back, 0, 0];
    pose.rotations.elbowR = [-0.15 * back, 0, 0];
    pose.rotations.hipL = [0.55 * back, 0, 0];
    pose.rotations.kneeL = [-0.35 * back, 0, 0];
    pose.rotations.hipR = [-0.5 * back, 0, 0];
    pose.lunge = 0.28 * back;
    pose.squash = 1;
  }
  return pose;
}

function turnPose(t: number): Pose {
  const pose = emptyPose();
  const loop = t % 2.8;
  const facing = Math.floor(loop / 0.35);
  const local = loop - facing * 0.35;

  pose.facing = -facing * (Math.PI / 4);
  if (local < 0.13) {
    // The step into the new facing: a two-sample dip and lean.
    pose.dip = 0.028;
    pose.rotations.torso = [0.06, -0.14, 0];
    pose.rotations.shoulderL = [0, 0, 0.08];
    pose.rotations.shoulderR = [0, 0, -0.08];
  }
  const breath = Math.sin((loop / 2.8) * Math.PI * 2);
  pose.rotations.head = [0.02 * breath, 0, 0];
  return pose;
}

/** Held poses per second — twos/threes, not smooth interpolation. */
const STEP_RATE: Record<MedicAnim, number> = { attack: 12, idle: 8, turn: 10 };

export function applyMedicPose(rig: MedicRig, anim: MedicAnim, tRaw: number): void {
  const rate = STEP_RATE[anim];
  const t = Math.floor(tRaw * rate) / rate;

  const pose = anim === "idle" ? idlePose(t) : (anim === "attack" ? attackPose(t) : turnPose(t));

  for (const name of Object.keys(BIND) as JointName[]) {
    const bind = BIND[name] ?? [0, 0, 0];
    const delta = pose.rotations[name] ?? [0, 0, 0];
    rig.joints[name].rotation.set(bind[0] + delta[0], bind[1] + delta[1], bind[2] + delta[2]);
  }

  const facing = BASE_FACING + pose.facing;
  const { root } = rig.joints;
  root.rotation.set(0, facing, 0);
  root.position.set(pose.lunge * Math.sin(facing), -pose.dip, pose.lunge * Math.cos(facing));
  const spread = 1 + (1 - pose.squash) * 0.7;
  root.scale.set(spread, pose.squash, spread);

  rig.tipMaterial.color.set(pose.flash ? SIGNAL_HOT : SIGNAL);
  rig.tip.scale.setScalar(pose.flash ? 1.7 : 1);
}
