/**
 * THROWAWAY PROTOTYPE (#89): one parametric figure builder for both tiers.
 *
 * There is no per-unit authored mesh anywhere in this lane. `buildUnit`
 * takes a spec (tier, archetype, faction) and emits the rig, so a 40-unit
 * battle costs exactly as much authoring as a single unit does.
 *
 * Tier separation obeys the cofounder's ruling: **slight size boost plus
 * higher detail density, and nothing else.** Hero units are 1.25x tall and
 * carry roughly three times the primitive count; there is no rim light, no
 * banner, no glow ring and no ground decal anywhere in this file, because
 * marking was explicitly deferred.
 *
 * Proportions follow the #81 rig so the lanes stay comparable: ~4.4 heads,
 * hero 1.85 world units (~61 px at the shared 0.82 combat zoom), fodder
 * 1.48 units (~49 px). Every mass a bone owns is batched into one draw
 * call by `FlatBatch`.
 */

import * as THREE from "three";

import { box, cone, facet, FlatBatch, taper, wedge } from "./flat.ts";

export type Tier = "fodder" | "hero";
export type Archetype = "medic" | "melee" | "ranged";
export type Faction = "crew" | "opfor";

export const HERO_HEIGHT = 1.85;
export const FODDER_HEIGHT = 1.48;
/** The cofounder's "slight" boost — 1.25x, inside the 1.2-1.3x ruling. */
export const TIER_SCALE = HERO_HEIGHT / FODDER_HEIGHT;

export interface UnitSpec {
  tier: Tier;
  archetype: Archetype;
  faction: Faction;
}

interface Palette {
  coat: string;
  coatDark: string;
  livery: string;
  liveryDark: string;
  pale: string;
  skin: string;
  boot: string;
  metal: string;
  signal: string;
}

/**
 * Two faction registers, separated by hue AND value so a grayscale crowd
 * still reads as two armies. Neither uses the UI's magenta or chartreuse.
 */
const PALETTES: Record<Faction, Palette> = {
  crew: {
    boot: "#2a2530",
    coat: "#4b4653",
    coatDark: "#3a3642",
    livery: "#d4783f",
    liveryDark: "#8f4a2a",
    metal: "#9aa0ac",
    pale: "#e2d5bd",
    signal: "#5fd8c4",
    skin: "#b2745a",
  },
  opfor: {
    boot: "#211f28",
    coat: "#3d434f",
    coatDark: "#2e333d",
    livery: "#2f6b93",
    liveryDark: "#1f4a68",
    metal: "#878d9a",
    pale: "#b9c0ca",
    signal: "#e0a24a",
    skin: "#8f6650",
  },
};

export interface UnitJoints {
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

export interface UnitRig {
  spec: UnitSpec;
  root: THREE.Group;
  joints: UnitJoints;
  handL: THREE.Group;
  handR: THREE.Group;
  /** Grip socket on the weapon that the support hand IK-tracks. */
  foregrip: THREE.Object3D;
  /** Muzzle / needle tip — anchor for the attack accent. */
  muzzle: THREE.Object3D;
  /** Scarce emission accent, scaled on fire/flash. Absent on plain fodder. */
  accent?: THREE.Mesh;
  height: number;
  /** Shoulder position in root space, for the aim solver. */
  shoulderHeight: number;
  limb: { upper: number; lower: number; leg: number };
  cost: { meshes: number; triangles: number };
}

interface BoneBatch {
  bone: THREE.Group;
  batch: FlatBatch;
}

function attach(batches: BoneBatch[], bone: THREE.Group): FlatBatch {
  const batch = new FlatBatch();
  batches.push({ batch, bone });
  return batch;
}

// --- Weapons ---------------------------------------------------------------

interface WeaponBuild {
  foregripAt: [number, number, number];
  muzzleAt: [number, number, number];
  accent?: { size: number; at: [number, number, number] };
}

function buildInjector(batch: FlatBatch, palette: Palette, s: number, detailed: boolean): WeaponBuild {
  batch.add(taper(0.045 * s, 0.055 * s, 0.42 * s, 6), palette.metal, {
    at: [0, -0.02 * s, 0.15 * s],
    rot: [Math.PI / 2, 0, 0],
  });
  batch.add(box(0.11 * s, 0.11 * s, 0.15 * s), palette.livery, { at: [0, 0.07 * s, 0.04 * s] });
  batch.add(box(0.06 * s, 0.13 * s, 0.07 * s), palette.boot, { at: [0, -0.11 * s, 0.01 * s] });
  if (detailed) {
    batch.add(box(0.13 * s, 0.03 * s, 0.05 * s), palette.pale, { at: [0, 0.13 * s, 0.04 * s] });
    batch.add(taper(0.03 * s, 0.05 * s, 0.07 * s, 6), palette.coatDark, {
      at: [0, -0.02 * s, -0.08 * s],
      rot: [Math.PI / 2, 0, 0],
    });
  }
  return {
    accent: { at: [0, -0.02 * s, 0.4 * s], size: 0.05 * s },
    foregripAt: [0, 0.02 * s, -0.05 * s],
    muzzleAt: [0, -0.02 * s, 0.4 * s],
  };
}

function buildBlade(batch: FlatBatch, palette: Palette, s: number, detailed: boolean): WeaponBuild {
  const reach = detailed ? 0.95 : 0.6;
  batch.add(taper(0.028 * s, 0.032 * s, reach * s, 5), palette.coatDark, {
    at: [0, 0, reach * 0.32 * s],
    rot: [Math.PI / 2, 0, 0],
  });
  batch.add(wedge(0.075 * s, 0.34 * s), palette.metal, {
    at: [0, 0.01 * s, (reach * 0.32 + 0.26) * s],
    rot: [Math.PI / 2, 0, Math.PI / 2],
  });
  batch.add(box(0.16 * s, 0.05 * s, 0.05 * s), palette.livery, { at: [0, 0, reach * 0.06 * s] });
  if (detailed) {
    batch.add(facet(0.07 * s), palette.liveryDark, { at: [0, 0, -0.22 * s] });
    batch.add(box(0.05 * s, 0.05 * s, 0.18 * s), palette.pale, { at: [0, 0.02 * s, reach * 0.2 * s] });
  }
  return {
    foregripAt: [0, 0, reach * 0.16 * s],
    muzzleAt: [0, 0.01 * s, (reach * 0.32 + 0.42) * s],
  };
}

function buildCarbine(batch: FlatBatch, palette: Palette, s: number, detailed: boolean): WeaponBuild {
  batch.add(box(0.09 * s, 0.13 * s, 0.34 * s), palette.coatDark, { at: [0, 0.01 * s, 0.06 * s] });
  batch.add(taper(0.028 * s, 0.036 * s, 0.34 * s, 6), palette.metal, {
    at: [0, 0.04 * s, 0.36 * s],
    rot: [Math.PI / 2, 0, 0],
  });
  batch.add(box(0.07 * s, 0.09 * s, 0.14 * s), palette.livery, { at: [0, -0.02 * s, -0.14 * s] });
  if (detailed) {
    batch.add(box(0.06 * s, 0.16 * s, 0.09 * s), palette.boot, { at: [0, -0.11 * s, -0.02 * s] });
    batch.add(facet(0.075 * s), palette.liveryDark, { at: [0, 0.11 * s, -0.05 * s] });
    batch.add(box(0.04 * s, 0.04 * s, 0.12 * s), palette.pale, { at: [0, 0.11 * s, 0.16 * s] });
  }
  return {
    accent: { at: [0, 0.04 * s, 0.55 * s], size: 0.055 * s },
    foregripAt: [0, 0.02 * s, 0.26 * s],
    muzzleAt: [0, 0.04 * s, 0.55 * s],
  };
}

// --- Body ------------------------------------------------------------------

function buildHead(
  batch: FlatBatch,
  palette: Palette,
  spec: UnitSpec,
  s: number,
  detailed: boolean,
): void {
  const h = 0.227 * s;
  batch.add(box(0.15 * s, 0.06 * s, 0.13 * s), palette.skin, { at: [0, 0.01 * s, 0] });
  batch.add(taper(0.115 * s, 0.135 * s, h * 0.86, 6), palette.skin, { at: [0, h * 0.5, 0] });

  if (spec.archetype === "medic") {
    // Hood: a faceted cone, the medic's silhouette signature.
    batch.add(cone(0.185 * s, 0.28 * s, 6), palette.coatDark, { at: [0, h * 0.72, -0.012 * s] });
    batch.add(box(0.2 * s, 0.04 * s, 0.1 * s), palette.coatDark, { at: [0, h * 0.62, 0.1 * s] });
  } else if (spec.archetype === "melee") {
    batch.add(taper(0.11 * s, 0.145 * s, 0.16 * s, 6), palette.metal, { at: [0, h * 0.72, 0] });
    batch.add(box(0.18 * s, 0.045 * s, 0.06 * s), palette.livery, { at: [0, h * 0.62, 0.1 * s] });
  } else {
    batch.add(box(0.21 * s, 0.15 * s, 0.2 * s), palette.metal, { at: [0, h * 0.72, -0.01 * s] });
    batch.add(box(0.17 * s, 0.05 * s, 0.04 * s), palette.boot, { at: [0, h * 0.68, 0.1 * s] });
  }

  if (detailed) {
    batch.add(box(0.06 * s, 0.04 * s, 0.05 * s), palette.livery, { at: [0.09 * s, h * 0.75, 0.05 * s] });
    batch.add(box(0.16 * s, 0.035 * s, 0.03 * s), palette.pale, { at: [0, h * 0.42, 0.095 * s] });
  }
}

function buildTorso(
  batch: FlatBatch,
  palette: Palette,
  spec: UnitSpec,
  s: number,
  detailed: boolean,
): void {
  // Chest: a tapered hex prism, shoulders wider than waist.
  batch.add(taper(0.215 * s, 0.165 * s, 0.32 * s, 6), palette.coat, { at: [0, 0.17 * s, 0] });
  // Livery band — the identity colour, always present at both tiers.
  batch.add(taper(0.2 * s, 0.185 * s, 0.075 * s, 6), palette.livery, { at: [0, 0.245 * s, 0] });

  if (spec.archetype === "ranged") {
    batch.add(box(0.19 * s, 0.16 * s, 0.09 * s), palette.coatDark, { at: [0, 0.14 * s, -0.15 * s] });
  }

  if (!detailed) { return; }

  // Hero detail density: pack, plate, webbing, pouches, aerial.
  batch.add(taper(0.15 * s, 0.19 * s, 0.4 * s, 6), palette.coatDark, { at: [0, 0.2 * s, -0.24 * s] });
  batch.add(facet(0.11 * s), palette.liveryDark, { at: [0, 0.33 * s, -0.26 * s] });
  batch.add(box(0.03 * s, 0.32 * s, 0.03 * s), palette.boot, { at: [0.12 * s, 0.52 * s, -0.24 * s] });
  batch.add(box(0.2 * s, 0.2 * s, 0.05 * s), palette.pale, { at: [0.02 * s, 0.22 * s, 0.19 * s] });
  batch.add(box(0.055 * s, 0.16 * s, 0.03 * s), palette.livery, { at: [0.02 * s, 0.22 * s, 0.215 * s] });
  batch.add(box(0.15 * s, 0.055 * s, 0.03 * s), palette.livery, { at: [0.02 * s, 0.22 * s, 0.215 * s] });
  batch.add(box(0.46 * s, 0.05 * s, 0.03 * s), palette.boot, {
    at: [-0.02 * s, 0.27 * s, 0.185 * s],
    rot: [0, 0, 0.5],
  });
  batch.add(box(0.1 * s, 0.09 * s, 0.06 * s), palette.coatDark, { at: [-0.17 * s, 0.06 * s, 0.15 * s] });
  batch.add(box(0.08 * s, 0.08 * s, 0.06 * s), palette.liveryDark, { at: [0.17 * s, 0.05 * s, 0.14 * s] });
}

function buildArm(
  batches: BoneBatch[],
  joints: UnitJoints,
  palette: Palette,
  s: number,
  side: 1 | -1,
  detailed: boolean,
  cyber: boolean,
): { shoulder: THREE.Group; elbow: THREE.Group; hand: THREE.Group } {
  const upper = 0.19 * s;
  const lower = 0.17 * s;

  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.165 * s, 0.28 * s, 0);
  // ZYX so the IK's Z swing composes OUTSIDE the X bend — see solveArmIk.
  shoulder.rotation.order = "ZYX";
  const shoulderBatch = attach(batches, shoulder);
  shoulderBatch.add(taper(0.062 * s, 0.052 * s, upper, 5), palette.coat, { at: [0, -upper / 2, 0] });
  if (detailed) {
    shoulderBatch.add(wedge(0.115 * s, 0.19 * s), side === -1 ? palette.livery : palette.coatDark, {
      at: [side * 0.02 * s, 0.02 * s, 0],
      rot: [Math.PI / 2, 0, Math.PI / 2],
    });
  }

  const elbow = new THREE.Group();
  elbow.position.y = -upper;
  shoulder.add(elbow);
  const elbowBatch = attach(batches, elbow);
  elbowBatch.add(
    taper(0.055 * s, 0.048 * s, lower, 5),
    cyber ? palette.metal : palette.coatDark,
    { at: [0, -lower / 2, 0] },
  );
  elbowBatch.add(facet(0.062 * s), cyber ? palette.metal : palette.skin, { at: [0, -lower - 0.035 * s, 0] });
  if (detailed) {
    elbowBatch.add(box(0.075 * s, 0.045 * s, 0.075 * s), palette.pale, { at: [0, -0.045 * s, 0] });
  }

  const hand = new THREE.Group();
  hand.position.y = -lower - 0.035 * s;
  elbow.add(hand);

  joints[side === -1 ? "shoulderL" : "shoulderR"] = shoulder;
  joints[side === -1 ? "elbowL" : "elbowR"] = elbow;
  return { elbow, hand, shoulder };
}

function buildLeg(
  batches: BoneBatch[],
  joints: UnitJoints,
  palette: Palette,
  s: number,
  side: 1 | -1,
  detailed: boolean,
): void {
  const thigh = 0.22 * s;
  const shin = 0.2 * s;

  const hip = new THREE.Group();
  hip.position.set(side * 0.085 * s, 0.5 * s, 0);
  const hipBatch = attach(batches, hip);
  hipBatch.add(taper(0.075 * s, 0.062 * s, thigh, 5), palette.coat, { at: [0, -thigh / 2, 0] });

  const knee = new THREE.Group();
  knee.position.y = -thigh;
  hip.add(knee);
  const kneeBatch = attach(batches, knee);
  kneeBatch.add(taper(0.058 * s, 0.05 * s, shin, 5), palette.coatDark, { at: [0, -shin / 2, 0] });
  kneeBatch.add(box(0.115 * s, 0.07 * s, 0.2 * s), palette.boot, { at: [0, -shin - 0.028 * s, 0.038 * s] });
  if (detailed) {
    kneeBatch.add(box(0.095 * s, 0.06 * s, 0.05 * s), palette.liveryDark, { at: [0, -0.02 * s, 0.045 * s] });
    kneeBatch.add(box(0.115 * s, 0.045 * s, 0.06 * s), palette.metal, { at: [0, -shin - 0.04 * s, 0.115 * s] });
  }

  joints[side === -1 ? "hipL" : "hipR"] = hip;
  joints[side === -1 ? "kneeL" : "kneeR"] = knee;
}

export function buildUnit(spec: UnitSpec): UnitRig {
  const palette = PALETTES[spec.faction];
  const detailed = spec.tier === "hero";
  const height = detailed ? HERO_HEIGHT : FODDER_HEIGHT;
  const s = height;

  const root = new THREE.Group();
  const batches: BoneBatch[] = [];

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.5 * s, 0);
  root.add(pelvis);
  const pelvisBatch = attach(batches, pelvis);
  pelvisBatch.add(taper(0.175 * s, 0.145 * s, 0.14 * s, 6), palette.coatDark, { at: [0, 0.02 * s, 0] });

  const torso = new THREE.Group();
  torso.position.set(0, 0.07 * s, 0);
  pelvis.add(torso);
  const torsoBatch = attach(batches, torso);
  buildTorso(torsoBatch, palette, spec, s, detailed);

  const head = new THREE.Group();
  head.position.set(0, 0.3 * s, 0);
  torso.add(head);
  const headBatch = attach(batches, head);
  buildHead(headBatch, palette, spec, s, detailed);

  const joints = { head, pelvis, root, torso } as unknown as UnitJoints;
  const left = buildArm(batches, joints, palette, s, -1, detailed, spec.archetype === "medic");
  const right = buildArm(batches, joints, palette, s, 1, detailed, false);
  torso.add(left.shoulder, right.shoulder);
  buildLeg(batches, joints, palette, s, -1, detailed);
  buildLeg(batches, joints, palette, s, 1, detailed);
  root.add(joints.hipL, joints.hipR);

  // Weapon lives under the right hand; the left hand IK-tracks its foregrip.
  const weapon = new THREE.Group();
  weapon.position.set(0, -0.06 * s, 0.03 * s);
  right.hand.add(weapon);
  const weaponBatch = attach(batches, weapon);
  const build = spec.archetype === "medic"
    ? buildInjector(weaponBatch, palette, s, detailed)
    : (spec.archetype === "melee"
        ? buildBlade(weaponBatch, palette, s, detailed)
        : buildCarbine(weaponBatch, palette, s, detailed));

  const foregrip = new THREE.Object3D();
  foregrip.position.set(...build.foregripAt);
  weapon.add(foregrip);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(...build.muzzleAt);
  weapon.add(muzzle);

  // The <=5% emission budget: heroes only, one accent, on the weapon tip.
  let accent: THREE.Mesh | undefined;
  if (detailed && build.accent !== undefined) {
    const accentBatch = new FlatBatch();
    accentBatch.addEmit(facet(build.accent.size), palette.signal);
    const baked = accentBatch.bake();
    const mesh = baked[0];
    if (mesh !== undefined) {
      mesh.position.set(...build.accent.at);
      weapon.add(mesh);
      accent = mesh;
    }
  }

  let meshes = accent === undefined ? 0 : 1;
  let triangles = 0;
  for (const { batch, bone } of batches) {
    if (batch.isEmpty) { continue; }
    triangles += batch.triangles;
    for (const mesh of batch.bake()) {
      mesh.frustumCulled = false;
      bone.add(mesh);
      meshes += 1;
    }
  }

  return {
    cost: { meshes, triangles },
    foregrip,
    handL: left.hand,
    handR: right.hand,
    height,
    joints,
    limb: { leg: 0.42 * s, lower: 0.17 * s, upper: 0.19 * s },
    muzzle,
    root,
    shoulderHeight: 0.85 * s,
    spec,
    ...(accent === undefined ? {} : { accent }),
  };
}
