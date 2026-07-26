/**
 * THROWAWAY SCAFFOLDING (#96, ported from #89): one parametric figure builder
 * for both tiers and every archetype.
 *
 * There is no per-unit authored mesh anywhere in this sandbox. `buildUnit`
 * takes a spec (tier, archetype, faction) and emits the rig, so a 40-unit
 * battle costs exactly as much authoring as a single unit does. Everything
 * that varies by archetype — headgear, torso kit, weapon, arm build — comes
 * from `archetypes.ts`; this file owns only the shared skeleton.
 *
 * ## The proportions, and why they are what they are
 *
 * The lane's first round shipped a rig whose head was invisible: measured in
 * the camera's own screen basis, the head joint sat *below* the shoulder joint
 * and the chest projected both higher and nearer than the face. Because every
 * procedural layer composes on the rest pose, one rig defect presented as six
 * animation defects. The rebuild follows four rules:
 *
 *   1. **A real neck.** The head joint sits `NECK_RISE` above the shoulder
 *      joint, with a dark neck column filling the gap.
 *   2. **Nothing above the shoulder line but the head.** Pack, canister,
 *      aerial and pauldron all cap out below the collar.
 *   3. **3.8 heads tall, not 4.4.** Readable small characters want oversized
 *      heads, hands and weapons.
 *   4. **An explicit front cue.** A dark face plate carrying one bright visor
 *      slit sits proud of the skull on +Z only.
 *
 * `figure.test.ts` locks 1-4 down by ray-casting the real camera direction at
 * the face and by comparing screen-space extents, so it cannot silently
 * regress. Keep those tests when you change the rig.
 *
 * Tier separation has three terms, per #69: **size boost + detail density +
 * marking.** Heroes are 1.25x tall, carry roughly three times the primitive
 * count, and wear a screen-space border in their faction's signal colour.
 *
 * Nothing here is an art-direction commitment. See `README.md`.
 */

import * as THREE from "three";

import { type Archetype, archetypeSpec } from "./archetypes.ts";
import { box, facet, FlatBatch, MARK_LAYER, MARK_MATERIALS, taper, wedge } from "./flat.ts";
import { type Faction, heightOf, type Palette, PALETTES, type Tier } from "./units.ts";

export type { Archetype } from "./archetypes.ts";
export {
  type Faction,
  FODDER_HEIGHT,
  HERO_HEIGHT,
  MARK_PIXELS,
  SIGNAL,
  type Tier,
  TIER_SCALE,
} from "./units.ts";

/**
 * The rig's skeleton proportions, as fractions of the unit's total height.
 * Every joint position and every mass in this file derives from these, so the
 * head-count and the neck clearance are a property of the numbers rather than
 * of scattered literals.
 */
export const PROPORTIONS = {
  /** Hip / pelvis joint height. */
  hip: 0.435,
  thigh: 0.195,
  shin: 0.175,
  /** Torso joint, above the pelvis joint. */
  torsoRise: 0.055,
  /** Chest mass height. Its top is the shoulder yoke. */
  chest: 0.155,
  /** Shoulder joint, in torso-local space. */
  shoulder: 0.125,
  /** Head joint, in torso-local space. */
  head: 0.265,
  /** Head mass height, crown to jaw. */
  headMass: 0.265,
  upperArm: 0.185,
  foreArm: 0.165,
} as const;

/** Head joint minus shoulder joint: the defect round 1 did not have. */
export const NECK_RISE = PROPORTIONS.head - PROPORTIONS.shoulder;
/** Total leg length — what the speed-matched stride is scaled against. */
export const LEG_LENGTH = PROPORTIONS.thigh + PROPORTIONS.shin;
/** Silhouette height divided by head height. Target register is 3.2-4. */
export const HEAD_COUNT = 1 / PROPORTIONS.headMass;

export interface UnitSpec {
  tier: Tier;
  archetype: Archetype;
  faction: Faction;
  /**
   * Hero marking — the border approved on #69. Defaults on for heroes.
   * The crowd capture renders both ways so the marking's contribution is
   * measured rather than assumed.
   */
  mark?: boolean;
}

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
  /**
   * Centre of the front-facing cue, sitting just proud of the face plate.
   * The regression test casts the camera ray at this point: if anything on
   * the body gets in the way, the head is invisible again.
   */
  face: THREE.Object3D;
  /** Scarce emission accent, scaled on fire/flash. Absent on plain fodder. */
  accent?: THREE.Mesh;
  height: number;
  /** Aim origin in root space — eye/shoulder line for the aim solver. */
  shoulderHeight: number;
  limb: { upper: number; lower: number; leg: number };
  cost: { meshes: number; triangles: number; markMeshes: number };
}

interface BoneBatch {
  bone: THREE.Group;
  batch: FlatBatch;
  /** Excluded from the marking shell — the border traces the body, not the kit. */
  noMark?: boolean;
}

function attach(batches: BoneBatch[], bone: THREE.Group, noMark = false): FlatBatch {
  const batch = new FlatBatch();
  batches.push({ batch, bone, noMark });
  return batch;
}

/**
 * The head is the identity mass and the largest single mass on the unit:
 * livery-coloured, sitting on a dark neck column that lifts it clear of the
 * shoulder line, with a dark face plate and one bright visor slit proud of
 * the skull on +Z. The archetype's crown is the only variable part.
 */
function buildHead(
  batch: FlatBatch,
  palette: Palette,
  spec: UnitSpec,
  s: number,
  detailed: boolean,
): void {
  // Neck column. Rides with the head so the head cannot detach from it under
  // aim yaw; at these sizes the facets swivelling is invisible, and a
  // torso-owned neck would poke out of the collar on a deep attack pitch.
  batch.add(taper(0.058 * s, 0.074 * s, 0.135 * s, 6), palette.boot, { at: [0, -0.062 * s, 0] });

  // Skull: the base mass every archetype shares, so the tiers and archetypes
  // differ by crown and kit rather than by an entirely different head.
  batch.add(box(0.235 * s, 0.175 * s, 0.195 * s), palette.livery, { at: [0, 0.0675 * s, 0] });

  archetypeSpec(spec.archetype).headgear(batch, palette, s, detailed);

  // Face plate: the darkest note on the unit, proud of the skull, +Z only.
  batch.add(box(0.185 * s, 0.115 * s, 0.032 * s), palette.boot, { at: [0, 0.055 * s, 0.099 * s] });
  // Jaw, front-only, so the head mass is biased forward and the profile is
  // not a symmetrical box that reads the same from either side.
  batch.add(box(0.15 * s, 0.04 * s, 0.072 * s), palette.coatDark, { at: [0, -0.008 * s, 0.07 * s] });

  // The one bright note inside the dark plate. Heroes burn their emission
  // budget here rather than only on the weapon tip, because the head is what
  // a player looks at when hunting for a hero in a crowd.
  if (detailed) {
    batch.addEmit(box(0.152 * s, 0.034 * s, 0.022 * s), palette.signal, {
      at: [0, 0.072 * s, 0.112 * s],
    });
    batch.add(box(0.048 * s, 0.05 * s, 0.06 * s), palette.metal, {
      at: [0.115 * s, 0.058 * s, 0.01 * s],
    });
  } else {
    batch.add(box(0.152 * s, 0.034 * s, 0.022 * s), palette.pale, {
      at: [0, 0.072 * s, 0.112 * s],
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
  const archetype = archetypeSpec(spec.archetype);

  // Chest: a tapered hex prism, shoulders wider than waist.
  batch.add(taper(0.172 * s, 0.135 * s, 0.155 * s, 6), palette.coat, { at: [0, 0.0775 * s, 0] });
  // Collar. Caps the yoke off below the neck so the top of the body silhouette
  // is a clean shoulder line rather than a lump competing with the head.
  batch.add(taper(0.098 * s, 0.118 * s, 0.055 * s, 6), palette.coatDark, { at: [0, 0.15 * s, 0] });

  archetype.torsoTell(batch, palette, s, detailed);

  if (!detailed) { return; }

  // Hero detail density: field pack, archetype iconography, webbing, pouches.
  // All of it rides at or below the chest, because detail above the collar is
  // detail that competes with the head.
  batch.add(taper(0.115 * s, 0.148 * s, 0.225 * s, 6), palette.coatDark, {
    at: [0, -0.02 * s, -0.15 * s],
  });
  batch.add(box(0.12 * s, 0.1 * s, 0.05 * s), palette.liveryDark, { at: [0, 0.01 * s, -0.265 * s] });
  archetype.heroKit(batch, palette, s, detailed);
  batch.add(box(0.34 * s, 0.038 * s, 0.03 * s), palette.boot, {
    at: [-0.03 * s, 0.128 * s, 0.132 * s],
    rot: [0, 0, 0.52],
  });
  batch.add(box(0.075 * s, 0.075 * s, 0.05 * s), palette.coatDark, {
    at: [-0.14 * s, -0.005 * s, 0.1 * s],
  });
  batch.add(box(0.065 * s, 0.065 * s, 0.05 * s), palette.liveryDark, {
    at: [0.14 * s, -0.015 * s, 0.095 * s],
  });
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
  const upper = PROPORTIONS.upperArm * s;
  const lower = PROPORTIONS.foreArm * s;

  // Shoulder joints sit well inside the chest silhouette. A wider yoke looks
  // fine standing but puts the weapon's foregrip permanently outside the
  // support arm's reach, and the IK then reads as a permanent stretch.
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.115 * s, PROPORTIONS.shoulder * s, 0);
  // ZYX so the IK's Z swing composes OUTSIDE the X bend — see solveArmIk.
  shoulder.rotation.order = "ZYX";
  const shoulderBatch = attach(batches, shoulder);
  shoulderBatch.add(taper(0.058 * s, 0.048 * s, upper, 5), palette.coat, { at: [0, -upper / 2, 0] });
  if (detailed && side === -1) {
    // A single asymmetric pauldron: hero detail density that reads as one
    // decisive shape rather than more small parts. Sized and dropped so its
    // crest stays under the collar.
    shoulderBatch.add(wedge(0.072 * s, 0.145 * s), palette.liveryDark, {
      at: [-0.048 * s, -0.052 * s, 0],
      rot: [0, 0, Math.PI / 2],
    });
  } else if (detailed) {
    shoulderBatch.add(box(0.1 * s, 0.055 * s, 0.13 * s), palette.coatDark, {
      at: [0.018 * s, -0.008 * s, 0],
    });
  }

  const elbow = new THREE.Group();
  elbow.position.y = -upper;
  shoulder.add(elbow);
  const elbowBatch = attach(batches, elbow);
  elbowBatch.add(
    taper(0.05 * s, 0.044 * s, lower, 5),
    cyber ? palette.metal : palette.coatDark,
    { at: [0, -lower / 2, 0] },
  );
  // Oversized hand, on the same logic as the oversized head and weapon.
  elbowBatch.add(facet(0.064 * s), cyber ? palette.metal : palette.skin, {
    at: [0, -lower - 0.03 * s, 0],
  });
  if (detailed && !cyber) {
    elbowBatch.add(box(0.068 * s, 0.04 * s, 0.068 * s), palette.pale, { at: [0, -0.038 * s, 0] });
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
  const thigh = PROPORTIONS.thigh * s;
  const shin = PROPORTIONS.shin * s;

  const hip = new THREE.Group();
  hip.position.set(side * 0.082 * s, PROPORTIONS.hip * s, 0);
  const hipBatch = attach(batches, hip);
  hipBatch.add(taper(0.072 * s, 0.058 * s, thigh, 5), palette.coatDark, { at: [0, -thigh / 2, 0] });

  const knee = new THREE.Group();
  knee.position.y = -thigh;
  hip.add(knee);
  const kneeBatch = attach(batches, knee);
  kneeBatch.add(taper(0.055 * s, 0.047 * s, shin, 5), palette.boot, { at: [0, -shin / 2, 0] });
  kneeBatch.add(box(0.112 * s, 0.062 * s, 0.19 * s), palette.boot, {
    at: [0, -shin - 0.026 * s, 0.036 * s],
  });
  if (detailed) {
    kneeBatch.add(box(0.088 * s, 0.05 * s, 0.05 * s), palette.liveryDark, {
      at: [0, -0.018 * s, 0.04 * s],
    });
    kneeBatch.add(box(0.112 * s, 0.036 * s, 0.05 * s), palette.metal, {
      at: [0, -shin - 0.038 * s, 0.108 * s],
    });
  }

  joints[side === -1 ? "hipL" : "hipR"] = hip;
  joints[side === -1 ? "kneeL" : "kneeR"] = knee;
}

export function buildUnit(spec: UnitSpec): UnitRig {
  const palette = PALETTES[spec.faction];
  const archetype = archetypeSpec(spec.archetype);
  const detailed = spec.tier === "hero";
  const marked = spec.mark ?? detailed;
  const height = heightOf(spec.tier);
  const s = height;

  const root = new THREE.Group();
  const batches: BoneBatch[] = [];

  const pelvis = new THREE.Group();
  pelvis.position.set(0, PROPORTIONS.hip * s, 0);
  root.add(pelvis);
  const pelvisBatch = attach(batches, pelvis);
  pelvisBatch.add(taper(0.145 * s, 0.12 * s, 0.115 * s, 6), palette.coatDark, {
    at: [0, 0.015 * s, 0],
  });
  if (detailed) {
    pelvisBatch.add(box(0.29 * s, 0.045 * s, 0.2 * s), palette.boot, { at: [0, 0.055 * s, 0] });
  }

  const torso = new THREE.Group();
  torso.position.set(0, PROPORTIONS.torsoRise * s, 0);
  pelvis.add(torso);
  const torsoBatch = attach(batches, torso);
  buildTorso(torsoBatch, palette, spec, s, detailed);

  const head = new THREE.Group();
  head.position.set(0, PROPORTIONS.head * s, 0);
  torso.add(head);
  const headBatch = attach(batches, head);
  buildHead(headBatch, palette, spec, s, detailed);

  // The camera ray the regression test fires is aimed here.
  const face = new THREE.Object3D();
  face.position.set(0, 0.062 * s, 0.122 * s);
  head.add(face);

  const joints = { head, pelvis, root, torso } as unknown as UnitJoints;
  const left = buildArm(batches, joints, palette, s, -1, detailed, archetype.cyberArm);
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
  // The border traces the figure. Tracing the weapon too thickens a thin
  // silhouette into a blob and costs the archetype tell.
  const weaponBatch = attach(batches, weapon, true);
  const build = archetype.weapon(weaponBatch, palette, s, detailed);

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
  let markMeshes = 0;
  let triangles = 0;
  for (const { batch, bone, noMark } of batches) {
    if (batch.isEmpty) { continue; }
    triangles += batch.triangles;
    for (const mesh of batch.bake()) {
      mesh.frustumCulled = false;
      bone.add(mesh);
      meshes += 1;
      // Silhouette mask twin: same geometry buffer, flat faction channel, and
      // parked on the mark layer so the main pass never sees it.
      if (marked && noMark !== true) {
        const mask = new THREE.Mesh(mesh.geometry, MARK_MATERIALS[spec.faction]);
        mask.frustumCulled = false;
        mask.layers.set(MARK_LAYER);
        bone.add(mask);
        markMeshes += 1;
      }
    }
  }

  return {
    cost: { markMeshes, meshes, triangles },
    face,
    foregrip,
    handL: left.hand,
    handR: right.hand,
    height,
    joints,
    limb: {
      leg: LEG_LENGTH * s,
      lower: PROPORTIONS.foreArm * s,
      upper: PROPORTIONS.upperArm * s,
    },
    muzzle,
    root,
    // Aim origin. Round 1 used 0.85h, well above every aim target, so the
    // solver pitched the head DOWN in every clip and buried the face further.
    shoulderHeight: 0.62 * s,
    spec,
    ...(accent === undefined ? {} : { accent }),
  };
}
