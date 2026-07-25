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
 * Readability at ~50-60 px follows the flat register's own logic: each unit
 * is four or five large colour masses with a clear value order — a
 * livery-coloured head (the brightest large mass and the fastest facing
 * cue), a dark coat body, near-black legs, a pale kit accent, and one
 * metal weapon. Detail is what heroes get *inside* those masses, never
 * extra masses that muddy the silhouette.
 *
 * Proportions follow the #81 rig so the lanes stay comparable: ~4.4 heads,
 * hero 1.85 world units (~61 px at the shared 0.82 combat zoom), fodder
 * 1.48 units (~49 px).
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
 * Two faction registers separated by temperature, not just hue: the crew is
 * a warm rust identity on a violet-grey body, the opfor a cold pale-blue
 * identity on a near-black body. Neither uses the UI's magenta or
 * chartreuse, and the identity colour sits on the head so a crowd sorts
 * into two armies at a glance.
 */
const PALETTES: Record<Faction, Palette> = {
  crew: {
    boot: "#2a2436",
    coat: "#565068",
    coatDark: "#413b52",
    livery: "#d9773a",
    liveryDark: "#9c4b28",
    metal: "#8f96a3",
    pale: "#e8dcc2",
    signal: "#66e0c8",
    skin: "#c08462",
  },
  opfor: {
    boot: "#1e2028",
    coat: "#3d414e",
    coatDark: "#2d3039",
    livery: "#7ea6c6",
    liveryDark: "#4d7391",
    metal: "#7c828f",
    pale: "#cdd6e0",
    signal: "#e8a94e",
    skin: "#9a6f57",
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
  /**
   * Grip socket the support hand IK-tracks. Only two-handed weapons use it;
   * a medic's injector and a short blade are held one-handed, so those
   * archetypes leave the off hand to the layered pose.
   */
  foregrip: THREE.Object3D;
  /** Muzzle / needle tip — anchor for the attack accent. */
  muzzle: THREE.Object3D;
  /** Scarce emission accent, scaled on fire/flash. Absent on plain fodder. */
  accent?: THREE.Mesh;
  height: number;
  /** Shoulder height in root space, for the aim solver. */
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
  batch.add(taper(0.042 * s, 0.052 * s, 0.3 * s, 6), palette.metal, {
    at: [0, -0.01 * s, 0.13 * s],
    rot: [Math.PI / 2, 0, 0],
  });
  batch.add(box(0.11 * s, 0.12 * s, 0.15 * s), palette.livery, { at: [0, 0.07 * s, 0.04 * s] });
  batch.add(box(0.07 * s, 0.14 * s, 0.08 * s), palette.boot, { at: [0, -0.1 * s, 0.01 * s] });
  if (detailed) {
    batch.add(box(0.13 * s, 0.03 * s, 0.05 * s), palette.pale, { at: [0, 0.14 * s, 0.04 * s] });
    batch.add(taper(0.03 * s, 0.05 * s, 0.08 * s, 6), palette.coatDark, {
      at: [0, -0.01 * s, -0.08 * s],
      rot: [Math.PI / 2, 0, 0],
    });
  }
  return {
    accent: { at: [0, -0.01 * s, 0.3 * s], size: 0.045 * s },
    foregripAt: [0, 0.005 * s, 0.06 * s],
    muzzleAt: [0, -0.01 * s, 0.3 * s],
  };
}

function buildBlade(batch: FlatBatch, palette: Palette, s: number, detailed: boolean): WeaponBuild {
  const haft = detailed ? 0.5 : 0.34;
  batch.add(taper(0.026 * s, 0.03 * s, haft * s, 5), palette.coatDark, {
    at: [0, 0, haft * 0.3 * s],
    rot: [Math.PI / 2, 0, 0],
  });
  batch.add(wedge(0.055 * s, 0.2 * s), palette.metal, {
    at: [0, 0.01 * s, (haft * 0.3 + 0.2) * s],
    rot: [Math.PI / 2, 0.5, 0],
  });
  batch.add(box(0.15 * s, 0.05 * s, 0.05 * s), palette.livery, { at: [0, 0, haft * 0.06 * s] });
  if (detailed) {
    batch.add(facet(0.065 * s), palette.liveryDark, { at: [0, 0, -0.18 * s] });
    batch.add(box(0.05 * s, 0.04 * s, 0.16 * s), palette.pale, { at: [0, 0.02 * s, haft * 0.2 * s] });
  }
  return {
    foregripAt: [0, 0, haft * 0.16 * s],
    muzzleAt: [0, 0.01 * s, (haft * 0.3 + 0.4) * s],
  };
}

function buildCarbine(batch: FlatBatch, palette: Palette, s: number, detailed: boolean): WeaponBuild {
  batch.add(box(0.085 * s, 0.13 * s, 0.28 * s), palette.coatDark, { at: [0, 0.01 * s, 0.06 * s] });
  batch.add(taper(0.026 * s, 0.034 * s, 0.24 * s, 6), palette.metal, {
    at: [0, 0.04 * s, 0.3 * s],
    rot: [Math.PI / 2, 0, 0],
  });
  batch.add(box(0.07 * s, 0.1 * s, 0.13 * s), palette.livery, { at: [0, -0.02 * s, -0.12 * s] });
  if (detailed) {
    batch.add(box(0.06 * s, 0.15 * s, 0.09 * s), palette.boot, { at: [0, -0.11 * s, 0.0] });
    batch.add(facet(0.07 * s), palette.liveryDark, { at: [0, 0.11 * s, -0.04 * s] });
    batch.add(box(0.04 * s, 0.04 * s, 0.12 * s), palette.pale, { at: [0, 0.11 * s, 0.16 * s] });
  }
  return {
    accent: { at: [0, 0.04 * s, 0.43 * s], size: 0.05 * s },
    foregripAt: [0, 0, -0.015 * s],
    muzzleAt: [0, 0.04 * s, 0.43 * s],
  };
}

// --- Body ------------------------------------------------------------------

/**
 * The head is the identity mass: livery-coloured, larger than anatomical,
 * with a near-black face void under the brim. At combat zoom it is the only
 * part that reliably tells you which way a unit faces.
 */
function buildHead(
  batch: FlatBatch,
  palette: Palette,
  spec: UnitSpec,
  s: number,
  detailed: boolean,
): void {
  // The whole head mass lives inside +-0.13s of the joint, so the rig really
  // is ~4 heads tall and `height` really is the silhouette height.
  batch.add(box(0.095 * s, 0.07 * s, 0.085 * s), palette.coatDark, { at: [0, -0.1 * s, 0] });

  if (spec.archetype === "medic") {
    // Peaked hood — the hero medic's silhouette signature.
    batch.add(cone(0.152 * s, 0.28 * s, 6), palette.livery, { at: [0, 0.028 * s, -0.008 * s] });
    batch.add(box(0.2 * s, 0.038 * s, 0.095 * s), palette.liveryDark, {
      at: [0, -0.052 * s, 0.08 * s],
    });
  } else if (spec.archetype === "melee") {
    // Faceted kettle helm.
    batch.add(taper(0.095 * s, 0.138 * s, 0.175 * s, 6), palette.livery, { at: [0, 0.012 * s, 0] });
    batch.add(cone(0.088 * s, 0.1 * s, 6), palette.livery, { at: [0, 0.14 * s, 0] });
    batch.add(box(0.19 * s, 0.032 * s, 0.085 * s), palette.liveryDark, {
      at: [0, -0.06 * s, 0.072 * s],
    });
  } else {
    // Slab visor helm — reads as a different unit type at silhouette scale.
    batch.add(box(0.2 * s, 0.175 * s, 0.175 * s), palette.livery, { at: [0, 0.025 * s, -0.006 * s] });
    batch.add(box(0.17 * s, 0.05 * s, 0.045 * s), palette.liveryDark, {
      at: [0, -0.005 * s, 0.086 * s],
    });
  }

  // Face void: the darkest note on the whole unit, so the head reads as a
  // head rather than a coloured block, and the facing is unambiguous.
  batch.add(box(0.115 * s, 0.052 * s, 0.04 * s), palette.boot, { at: [0, -0.01 * s, 0.082 * s] });

  if (detailed) {
    batch.add(box(0.05 * s, 0.045 * s, 0.05 * s), palette.metal, {
      at: [0.078 * s, 0.03 * s, 0.02 * s],
    });
    batch.addEmit(box(0.06 * s, 0.019 * s, 0.02 * s), palette.signal, {
      at: [0.014 * s, -0.008 * s, 0.098 * s],
    });
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
  batch.add(taper(0.185 * s, 0.145 * s, 0.32 * s, 6), palette.coat, { at: [0, 0.17 * s, 0] });

  if (spec.archetype === "ranged") {
    // Back canister — the ranged fodder's silhouette tell.
    batch.add(taper(0.07 * s, 0.085 * s, 0.26 * s, 6), palette.coatDark, {
      at: [0, 0.18 * s, -0.15 * s],
    });
  } else if (spec.archetype === "melee") {
    batch.add(box(0.21 * s, 0.085 * s, 0.05 * s), palette.pale, { at: [0, 0.2 * s, 0.14 * s] });
  }

  if (!detailed) { return; }

  // Hero detail density: field pack, cross plate, webbing, pouches, aerial.
  batch.add(taper(0.11 * s, 0.14 * s, 0.26 * s, 6), palette.coatDark, { at: [0, 0.16 * s, -0.19 * s] });
  batch.add(box(0.125 * s, 0.11 * s, 0.05 * s), palette.liveryDark, { at: [0, 0.18 * s, -0.3 * s] });
  if (spec.archetype === "medic") {
    // The cross is medic iconography — only Mara Voss wears it.
    batch.add(box(0.155 * s, 0.155 * s, 0.05 * s), palette.pale, { at: [0.015 * s, 0.255 * s, 0.15 * s] });
    batch.add(box(0.042 * s, 0.12 * s, 0.03 * s), palette.livery, { at: [0.015 * s, 0.255 * s, 0.176 * s] });
    batch.add(box(0.11 * s, 0.042 * s, 0.03 * s), palette.livery, { at: [0.015 * s, 0.255 * s, 0.176 * s] });
  } else {
    batch.add(box(0.16 * s, 0.06 * s, 0.05 * s), palette.pale, { at: [0.01 * s, 0.26 * s, 0.15 * s] });
    batch.add(box(0.1 * s, 0.075 * s, 0.045 * s), palette.liveryDark, { at: [0.01 * s, 0.17 * s, 0.15 * s] });
  }
  batch.add(box(0.38 * s, 0.04 * s, 0.03 * s), palette.boot, {
    at: [-0.035 * s, 0.29 * s, 0.152 * s],
    rot: [0, 0, 0.52],
  });
  batch.add(box(0.08 * s, 0.08 * s, 0.055 * s), palette.coatDark, { at: [-0.15 * s, 0.06 * s, 0.115 * s] });
  batch.add(box(0.07 * s, 0.07 * s, 0.055 * s), palette.liveryDark, { at: [0.15 * s, 0.05 * s, 0.105 * s] });
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
  const upper = 0.21 * s;
  const lower = 0.19 * s;

  // Shoulder joints sit well inside the chest silhouette. A wider yoke looks
  // fine standing but puts the weapon's foregrip permanently outside the
  // support arm's reach, and the IK then reads as a permanent stretch.
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.125 * s, 0.28 * s, 0);
  // ZYX so the IK's Z swing composes OUTSIDE the X bend — see solveArmIk.
  shoulder.rotation.order = "ZYX";
  const shoulderBatch = attach(batches, shoulder);
  shoulderBatch.add(taper(0.06 * s, 0.05 * s, upper, 5), palette.coat, { at: [0, -upper / 2, 0] });
  if (detailed && side === -1) {
    // A single asymmetric pauldron: hero detail density that reads as one
    // decisive shape rather than more small parts.
    shoulderBatch.add(wedge(0.1 * s, 0.18 * s), palette.liveryDark, {
      at: [-0.055 * s, -0.015 * s, 0],
      rot: [0, 0, Math.PI / 2],
    });
  } else if (detailed) {
    shoulderBatch.add(box(0.11 * s, 0.06 * s, 0.14 * s), palette.coatDark, {
      at: [0.02 * s, 0.03 * s, 0],
    });
  }

  const elbow = new THREE.Group();
  elbow.position.y = -upper;
  shoulder.add(elbow);
  const elbowBatch = attach(batches, elbow);
  elbowBatch.add(
    taper(0.052 * s, 0.046 * s, lower, 5),
    cyber ? palette.metal : palette.coatDark,
    { at: [0, -lower / 2, 0] },
  );
  elbowBatch.add(facet(0.058 * s), cyber ? palette.metal : palette.skin, {
    at: [0, -lower - 0.03 * s, 0],
  });
  if (detailed && !cyber) {
    elbowBatch.add(box(0.07 * s, 0.04 * s, 0.07 * s), palette.pale, { at: [0, -0.04 * s, 0] });
  }

  const hand = new THREE.Group();
  hand.position.y = -lower - 0.03 * s;
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
  hipBatch.add(taper(0.073 * s, 0.06 * s, thigh, 5), palette.coatDark, { at: [0, -thigh / 2, 0] });

  const knee = new THREE.Group();
  knee.position.y = -thigh;
  hip.add(knee);
  const kneeBatch = attach(batches, knee);
  kneeBatch.add(taper(0.056 * s, 0.048 * s, shin, 5), palette.boot, { at: [0, -shin / 2, 0] });
  kneeBatch.add(box(0.115 * s, 0.07 * s, 0.2 * s), palette.boot, { at: [0, -shin - 0.028 * s, 0.038 * s] });
  if (detailed) {
    kneeBatch.add(box(0.09 * s, 0.055 * s, 0.05 * s), palette.liveryDark, { at: [0, -0.02 * s, 0.042 * s] });
    kneeBatch.add(box(0.115 * s, 0.04 * s, 0.055 * s), palette.metal, { at: [0, -shin - 0.042 * s, 0.115 * s] });
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
  pelvisBatch.add(taper(0.15 * s, 0.125 * s, 0.13 * s, 6), palette.coatDark, { at: [0, 0.02 * s, 0] });
  if (detailed) {
    pelvisBatch.add(box(0.3 * s, 0.05 * s, 0.21 * s), palette.boot, { at: [0, 0.07 * s, 0] });
  }

  const torso = new THREE.Group();
  torso.position.set(0, 0.07 * s, 0);
  pelvis.add(torso);
  const torsoBatch = attach(batches, torso);
  buildTorso(torsoBatch, palette, spec, s, detailed);

  const head = new THREE.Group();
  head.position.set(0, 0.275 * s, 0);
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
  // The tool is held in line with the forearm: rotating the weapon +Z onto
  // the bone axis means the arm pose alone aims it, with no second aim rig.
  const weapon = new THREE.Group();
  weapon.position.set(0, -0.05 * s, 0.03 * s);
  weapon.rotation.x = Math.PI / 2 - 0.34;
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
    limb: { leg: 0.42 * s, lower: 0.19 * s, upper: 0.21 * s },
    muzzle,
    root,
    shoulderHeight: 0.85 * s,
    spec,
    ...(accent === undefined ? {} : { accent }),
  };
}
