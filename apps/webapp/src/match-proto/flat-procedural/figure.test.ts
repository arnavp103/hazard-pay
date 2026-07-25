import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { UnitAnimator } from "./animator.ts";
import {
  type Archetype,
  buildUnit,
  type Faction,
  FODDER_HEIGHT,
  HERO_HEIGHT,
  type Tier,
  type UnitRig,
} from "./figure.ts";
import type { SimUnit } from "./sim.ts";

const ARCHETYPES: Archetype[] = ["medic", "melee", "ranged"];
const FACTIONS: Faction[] = ["crew", "opfor"];
const TIERS: Tier[] = ["hero", "fodder"];

function standingDrive(): SimUnit {
  return {
    aimX: 0,
    aimY: 1.1,
    aimZ: 4,
    angularVelocity: 0,
    archetype: "melee",
    attackPhase: -1,
    ax: 0,
    az: 0,
    cooldown: 0,
    facing: 0,
    firedAt: -1,
    hitAt: -1,
    id: 3,
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
 */
function posed(archetype: Archetype, faction: Faction, tier: Tier): UnitRig {
  const rig = buildUnit({ archetype, faction, tier });
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

describe("figure geometry", () => {
  it("stands on the ground plane and matches its declared height", () => {
    // The declared height drives the camera, the shadow radius and the tier
    // ratio, so a rig whose crown overshoots it silently breaks all three.
    for (const tier of TIERS) {
      for (const archetype of ARCHETYPES) {
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
    for (const archetype of ARCHETYPES) {
      const hero = buildUnit({ archetype, faction: "crew", tier: "hero" });
      const fodder = buildUnit({ archetype, faction: "crew", tier: "fodder" });
      expect(hero.cost.triangles).toBeGreaterThan(fodder.cost.triangles * 1.35);
    }
  });

  it("keeps a narrow enough silhouette to read as a figure", () => {
    for (const archetype of ARCHETYPES) {
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
      for (const archetype of ARCHETYPES) {
        const rig = buildUnit({ archetype, faction, tier: "hero" });
        for (const joint of Object.values(rig.joints)) {
          expect(joint).toBeInstanceOf(THREE.Group);
        }
        expect(rig.cost.triangles).toBeGreaterThan(100);
      }
    }
  });
});
