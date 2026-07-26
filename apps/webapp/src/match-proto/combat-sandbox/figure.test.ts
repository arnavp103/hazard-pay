import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { UnitAnimator } from "./animator.ts";
import { MARK_LAYER } from "./flat.ts";
import {
  type Archetype,
  buildUnit,
  type Faction,
  FODDER_HEIGHT,
  HEAD_COUNT,
  HERO_HEIGHT,
  NECK_RISE,
  type Tier,
  type UnitRig,
} from "./figure.ts";
import type { SimUnit } from "./sim.ts";

const KINDS: Archetype[] = ["medic", "melee", "ranged"];
const FACTIONS: Faction[] = ["crew", "opfor"];
const TIERS: Tier[] = ["hero", "fodder"];

/**
 * The bake-off camera, copied from scene.ts: a 2:1 dimetric orthographic rig
 * at 30 degrees elevation. `VIEW` points from the subject towards the camera,
 * `UP` is screen-up expressed in world space.
 *
 * These two vectors are why the round-1 head was invisible. The camera looks
 * DOWN, so world +Y and world -Z both push a point UP the screen — which
 * means the front-top edge of the chest projects ABOVE a face that sits level
 * with it, while also being nearer the camera. Anything that is going to be
 * judged "visible" has to be judged in this basis, not in world Y.
 */
const VIEW = new THREE.Vector3(0.61237, 0.5, 0.61237).normalize();
const UP = new THREE.Vector3(-0.35355, 0.86603, -0.35355);

function standingDrive(): SimUnit {
  return {
    aimX: 0,
    aimY: 1.1,
    aimZ: 4,
    angularVelocity: 0,
    archetype: "melee",
    attackStep: -1,
    ax: 0,
    az: 0,
    cooldownSteps: 0,
    facing: 0,
    firedAtStep: -1,
    hitAtStep: -1,
    id: 3,
    randomState: 3,
    side: 0,
    speed: 0,
    targetId: -1,
    tier: "hero",
    vx: 0,
    vz: 0,
    x: 0,
    z: 0,
  };
}

/**
 * Builds a rig and settles it into its posed idle. Measuring the bind rig
 * would be measuring a pose that never reaches the screen — the archetype
 * posture and the IK both live in the animator.
 *
 * `mark` defaults off: the marking shell is a deliberate outward inflation of
 * every mass, so a rig wearing one has a silhouette a border-thickness larger
 * than its body in every direction. Proportion assertions want the body.
 */
function posed(archetype: Archetype, faction: Faction, tier: Tier, mark = false): UnitRig {
  const rig = buildUnit({ archetype, faction, mark, tier });
  const animator = new UnitAnimator(rig, 3, { density: "quad" });
  const drive = standingDrive();
  drive.archetype = archetype;
  drive.tier = tier;
  for (let i = 1; i <= 90; i += 1) { animator.update(drive, i / 60, 1 / 60); }
  return rig;
}

function silhouette(rig: UnitRig): THREE.Box3 {
  rig.root.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(rig.root);
}

function isUnder(object: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  for (let at: THREE.Object3D | null = object; at !== null; at = at.parent) {
    if (at === ancestor) { return true; }
  }
  return false;
}

/**
 * Highest point, in screen space, of every mesh matching `pick`. The weapon
 * subtree is always excluded — a raised blade is allowed to out-top the head,
 * and the defect under test is about the body.
 */
function topOnScreen(rig: UnitRig, pick: (mesh: THREE.Mesh) => boolean): number {
  rig.root.updateWorldMatrix(true, true);
  const vertex = new THREE.Vector3();
  let top = -Infinity;
  rig.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || isUnder(object, rig.handR) || !pick(object)) { return; }
    const position = object.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      top = Math.max(top, vertex.dot(UP));
    }
  });
  return top;
}

/**
 * Fires the camera's own ray at a point on the face and reports what it hits
 * first. This is the load-bearing assertion of the round-2 rig fix: round 1
 * failed it, because the chest was both higher on screen and nearer the
 * camera than the face, so the first thing the ray met was a torso.
 */
function firstHitFromCamera(rig: UnitRig, at: THREE.Vector3): THREE.Object3D | undefined {
  rig.root.updateWorldMatrix(true, true);
  const origin = at.clone().addScaledVector(VIEW, 12);
  const raycaster = new THREE.Raycaster(origin, VIEW.clone().negate(), 0, 40);
  return raycaster.intersectObject(rig.root, true)[0]?.object;
}

describe("figure geometry", () => {
  it("stands on the ground plane and matches its declared height", () => {
    // The declared height drives the camera, the shadow radius and the tier
    // ratio, so a rig whose crown overshoots it silently breaks all three.
    for (const tier of TIERS) {
      for (const archetype of KINDS) {
        const rig = posed(archetype, "crew", tier);
        const box = silhouette(rig);
        expect(box.min.y).toBeGreaterThan(-0.06);
        expect(box.min.y).toBeLessThan(0.06);
        expect(box.max.y).toBeGreaterThan(rig.height * 0.92);
        expect(box.max.y).toBeLessThan(rig.height * 1.1);
      }
    }
  });

  it("keeps the hero boost inside the 1.2-1.3x tier ruling", () => {
    const hero = silhouette(posed("melee", "crew", "hero"));
    const fodder = silhouette(posed("melee", "crew", "fodder"));
    const ratio = hero.max.y / fodder.max.y;
    expect(ratio).toBeGreaterThanOrEqual(1.2);
    expect(ratio).toBeLessThanOrEqual(1.3);
    expect(HERO_HEIGHT / FODDER_HEIGHT).toBeCloseTo(1.25, 2);
  });

  it("separates the tiers by detail density, not just scale", () => {
    for (const archetype of KINDS) {
      const hero = buildUnit({ archetype, faction: "crew", tier: "hero" });
      const fodder = buildUnit({ archetype, faction: "crew", tier: "fodder" });
      expect(hero.cost.triangles).toBeGreaterThan(fodder.cost.triangles * 1.35);
    }
  });

  it("keeps a narrow enough silhouette to read as a figure", () => {
    for (const archetype of KINDS) {
      const rig = posed(archetype, "opfor", "fodder");
      const box = silhouette(rig);
      expect(box.max.x - box.min.x).toBeLessThan(rig.height * 0.65);
    }
  });

  it("lands the support hand on the foregrip of a two-handed weapon", () => {
    // End-to-end proof that the IK actually closes: if the grip drifts out of
    // reach the solver blends out and the two-handed hold silently stops
    // existing, which is invisible in a still but obvious in motion.
    for (const tier of TIERS) {
      const rig = posed("ranged", "crew", tier);
      rig.root.updateWorldMatrix(true, true);
      const grip = rig.foregrip.getWorldPosition(new THREE.Vector3());
      const hand = rig.handL.getWorldPosition(new THREE.Vector3());
      expect(hand.distanceTo(grip)).toBeLessThan(rig.height * 0.05);
    }
  });

  it("leaves one-handed archetypes' off hand alone", () => {
    for (const archetype of ["medic", "melee"] as Archetype[]) {
      const rig = posed(archetype, "crew", "hero");
      rig.root.updateWorldMatrix(true, true);
      const grip = rig.foregrip.getWorldPosition(new THREE.Vector3());
      const hand = rig.handL.getWorldPosition(new THREE.Vector3());
      expect(hand.distanceTo(grip)).toBeGreaterThan(rig.height * 0.1);
    }
  });

  it("batches every bone into a handful of draw calls", () => {
    const hero = buildUnit({ archetype: "medic", faction: "crew", tier: "hero" });
    const fodder = buildUnit({ archetype: "melee", faction: "opfor", tier: "fodder" });
    expect(hero.cost.meshes).toBeLessThanOrEqual(16);
    expect(fodder.cost.meshes).toBeLessThanOrEqual(13);
    expect(fodder.cost.meshes).toBeLessThan(hero.cost.meshes);
  });

  it("gives every faction and archetype a complete rig", () => {
    for (const faction of FACTIONS) {
      for (const archetype of KINDS) {
        const rig = buildUnit({ archetype, faction, tier: "hero" });
        for (const joint of Object.values(rig.joints)) {
          expect(joint).toBeInstanceOf(THREE.Group);
        }
        expect(rig.cost.triangles).toBeGreaterThan(100);
      }
    }
  });
});

/**
 * The round-2 base-rig fix, locked down.
 *
 * Every assertion here corresponds to one bullet of the cofounder's loupe
 * diagnosis on PR #90, and each one was measurably false in round 1. They are
 * written in the camera's screen basis rather than in world Y on purpose: the
 * round-1 rig looked fine in a front elevation and was broken under the only
 * projection this game ever ships.
 */
describe("head readability under the dimetric camera", () => {
  it("gives the head a real neck above the shoulder line", () => {
    // Round 1: -0.005 of unit height, i.e. the head joint hung BELOW the
    // shoulder joint and the head sat inside the shoulder mass.
    expect(NECK_RISE).toBeGreaterThan(0.1);
  });

  it("uses the 3.2-4 head-count register readable characters need", () => {
    // Round 1 was ~4.4 heads: naturalistic, and unreadable at 28 px.
    expect(HEAD_COUNT).toBeGreaterThanOrEqual(3.2);
    expect(HEAD_COUNT).toBeLessThanOrEqual(4);
  });

  it("lets the head own the top of the silhouette on screen", () => {
    // Round 1's hero pack beat the head by 0.009 of unit height — about a
    // quarter of a pixel at a 28 px hero, i.e. a tie. The head has to win by
    // a margin that survives being 28 px tall.
    for (const tier of TIERS) {
      for (const archetype of KINDS) {
        const rig = posed(archetype, "crew", tier);
        const head = topOnScreen(rig, (mesh) => isUnder(mesh, rig.joints.head));
        const body = topOnScreen(rig, (mesh) => !isUnder(mesh, rig.joints.head));
        expect(head - body).toBeGreaterThan(rig.height * 0.08);
      }
    }
  });

  it("shows the face to the camera instead of the chest", () => {
    // The assertion round 1 failed outright: fire the camera's ray at the
    // face and require that the head is the first thing it meets.
    for (const tier of TIERS) {
      for (const archetype of KINDS) {
        for (const faction of FACTIONS) {
          const rig = posed(archetype, faction, tier);
          const at = rig.face.getWorldPosition(new THREE.Vector3());
          const hit = firstHitFromCamera(rig, at);
          expect(hit).toBeDefined();
          expect(isUnder(hit as THREE.Object3D, rig.joints.head)).toBe(true);
        }
      }
    }
  });

  it("keeps the face clear across the whole aim and attack range", () => {
    // Every procedural layer composes on the rest pose, so the rest pose is
    // not enough: the face has to survive a deep attack pitch and a full
    // head-yaw sweep too. This is the check that makes the fix a RIG fix
    // rather than a lucky still.
    const rig = buildUnit({ archetype: "melee", faction: "crew", tier: "hero" });
    const animator = new UnitAnimator(rig, 11, { density: "quad" });
    const drive = standingDrive();
    let checked = 0;
    for (let frame = 1; frame <= 240; frame += 1) {
      const t = frame / 60;
      drive.attackStep = frame % 120 < 72 ? frame % 120 : -1;
      drive.aimX = Math.sin(t * 1.7) * 4;
      drive.aimZ = 3.2;
      animator.update(drive, t, 1 / 60);
      if (frame % 6 !== 0) { continue; }
      const at = rig.face.getWorldPosition(new THREE.Vector3());
      const hit = firstHitFromCamera(rig, at);
      // A swinging weapon is allowed to cross the face; a body part is not.
      if (hit !== undefined && isUnder(hit, rig.handR)) { continue; }
      expect(isUnder(hit as THREE.Object3D, rig.joints.head)).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe("hero marking", () => {
  it("wraps a marked hero in a border and leaves fodder bare", () => {
    const hero = buildUnit({ archetype: "melee", faction: "crew", tier: "hero" });
    const fodder = buildUnit({ archetype: "melee", faction: "crew", tier: "fodder" });
    expect(hero.cost.markMeshes).toBeGreaterThan(6);
    expect(fodder.cost.markMeshes).toBe(0);
  });

  it("can be switched off so the crowd still can be shot both ways", () => {
    const bare = buildUnit({ archetype: "melee", faction: "crew", mark: false, tier: "hero" });
    expect(bare.cost.markMeshes).toBe(0);
    expect(bare.cost.meshes).toBe(
      buildUnit({ archetype: "melee", faction: "crew", tier: "hero" }).cost.meshes,
    );
  });

  it("does not thicken the weapon, which would cost the archetype tell", () => {
    const rig = buildUnit({ archetype: "ranged", faction: "opfor", tier: "hero" });
    let inWeapon = 0;
    rig.handR.traverse((object) => {
      if (object instanceof THREE.Mesh && object.layers.isEnabled(MARK_LAYER)) { inWeapon += 1; }
    });
    expect(inWeapon).toBe(0);
  });

  it("keeps the mask off the main camera layer and off the vertex budget", () => {
    // The border must not cost a second copy of the figure in either the main
    // pass or in vertex memory: mask twins share their solid geometry buffer
    // and live only on the mark layer.
    const rig = buildUnit({ archetype: "melee", faction: "crew", tier: "hero" });
    const solids = new Set<THREE.BufferGeometry>();
    let masks = 0;
    rig.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) { return; }
      if (object.layers.isEnabled(MARK_LAYER)) {
        masks += 1;
        expect(object.layers.isEnabled(0)).toBe(false);
        expect(solids.has(object.geometry)).toBe(true);
      } else {
        solids.add(object.geometry);
      }
    });
    expect(masks).toBe(rig.cost.markMeshes);
  });

  it("does not change the silhouette it marks", () => {
    // A screen-space border cannot move the body it wraps. An inverted hull
    // did - it inflated the bounding box by its own thickness, which is one
    // of the reasons that approach was abandoned.
    const marked = silhouette(posed("melee", "crew", "hero", true));
    const bare = silhouette(posed("melee", "crew", "hero", false));
    expect(marked.max.y).toBeCloseTo(bare.max.y, 6);
    expect(marked.min.y).toBeCloseTo(bare.min.y, 6);
  });
});
