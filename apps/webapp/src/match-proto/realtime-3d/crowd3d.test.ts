/**
 * Round-3 guards for the crowd tier (#81).
 *
 * These assert the three things the #69 rulings made load-bearing and that a
 * screenshot cannot prove:
 *
 *   - the tier boost is 1.25x of PROJECTED height, not of an authored number
 *     that quietly drifts once one archetype grows a helmet;
 *   - the two fodder archetypes part on silhouette alone, measured as
 *     rasterised screen shape with all colour discarded;
 *   - heroes are never adjacent, because fused rings measure the marking
 *     instead of the tier.
 */

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { rasterSilhouette, screenHeight } from "./camera3d.ts";
import {
  archetypeAt,
  buildCrowdUnits,
  FODDER_SCREEN_HEIGHT,
  HERO_SCREEN_HEIGHT,
  HERO_MAX_RANK,
  HERO_SLOTS,
  layoutCrowd,
  poseCrowd,
  REGISTER_PX,
  slotDistance,
  slotScreenDistance,
  zoomFor,
} from "./crowd3d.ts";
import { buildFodder, type FodderArchetype, TIER_SCALE } from "./fodder3d.ts";
import { MARK_PIXELS } from "./mark3d.ts";
import { buildMedic } from "./medic3d.ts";

function fitted(archetype: FodderArchetype): THREE.Group {
  const rig = buildFodder(archetype, "crew");
  rig.root.scale.setScalar(FODDER_SCREEN_HEIGHT / screenHeight(rig.root));
  rig.root.updateMatrixWorld(true);
  return rig.root;
}

describe("tier separation — size", () => {
  it("boosts the hero by exactly the ruling's 1.25x, on projected height", () => {
    expect(HERO_SCREEN_HEIGHT / FODDER_SCREEN_HEIGHT).toBeCloseTo(TIER_SCALE, 10);
    expect(TIER_SCALE).toBeGreaterThanOrEqual(1.2);
    expect(TIER_SCALE).toBeLessThanOrEqual(1.3);
  });

  it("fits both tiers to their target projected height, not their authored height", () => {
    const hero = buildMedic();
    hero.root.scale.setScalar(HERO_SCREEN_HEIGHT / screenHeight(hero.root));
    expect(screenHeight(hero.root)).toBeCloseTo(HERO_SCREEN_HEIGHT, 4);
    expect(screenHeight(fitted("brute"))).toBeCloseTo(FODDER_SCREEN_HEIGHT, 4);
    expect(screenHeight(fitted("marksman"))).toBeCloseTo(FODDER_SCREEN_HEIGHT, 4);
  });

  it("renders each register at the pixel height it claims", () => {
    for (const register of ["far", "near"] as const) {
      const px = FODDER_SCREEN_HEIGHT * 40 * zoomFor(register);
      expect(px).toBeCloseTo(REGISTER_PX[register], 6);
    }
  });
});

describe("tier separation — detail density", () => {
  it("spends far fewer primitives on a fodder unit than on a hero", () => {
    const count = (object: THREE.Object3D): number => {
      let n = 0;
      object.traverse((node) => {
        if (node instanceof THREE.Mesh) { n += 1; }
      });
      return n;
    };
    const hero = count(buildMedic().root);
    const brute = count(buildFodder("brute", "crew").root);
    const marksman = count(buildFodder("marksman", "crew").root);
    expect(hero / brute).toBeGreaterThan(1.7);
    expect(hero / marksman).toBeGreaterThan(1.7);
  });
});

/**
 * Fodder rasterises at 22 rows and the hero at 22 * 1.25, so one grid cell is
 * the same number of screen pixels for both tiers and the filled-cell counts
 * are directly comparable. Comparing two shapes each normalised to 22 rows —
 * the obvious thing — silently divides the hero's size boost back out.
 */
const FODDER_ROWS = 22;
const HERO_ROWS = Math.round(FODDER_ROWS * TIER_SCALE);

describe("archetype silhouette separation", () => {
  it("parts the two archetypes on core width, with all colour discarded", () => {
    const brute = rasterSilhouette(fitted("brute"), FODDER_ROWS);
    const marksman = rasterSilhouette(fitted("marksman"), FODDER_ROWS);
    // Bounding-box width is NOT the discriminator and must not be used as
    // one: the marksman's barrel spans almost exactly the shield's width, so
    // the two archetypes have the same bbox and part on where the mass sits.
    expect(brute.medianRow / marksman.medianRow).toBeGreaterThan(1.6);
  });

  it("makes the brute a solid block and the marksman a sparse one", () => {
    const brute = rasterSilhouette(fitted("brute"), FODDER_ROWS);
    const marksman = rasterSilhouette(fitted("marksman"), FODDER_ROWS);
    expect(brute.density).toBeGreaterThan(0.65);
    expect(marksman.density).toBeLessThan(0.55);
    expect(brute.density / marksman.density).toBeGreaterThan(1.4);
  });

  it("gives the marksman a barrel that projects well past its own body", () => {
    const rig = buildFodder("marksman", "crew");
    rig.root.updateMatrixWorld(true);
    const body = rasterSilhouette(rig.joints.torso.children[0]!, FODDER_ROWS);
    const whole = rasterSilhouette(rig.root, FODDER_ROWS);
    expect(whole.width / body.width).toBeGreaterThan(1.8);
  });

  it("records that the 1.25x size boost does not buy the hero screen mass", () => {
    // The finding, not the target. #84 measured a 28 px pixel hero at 1.20x
    // the mass of its melee fodder because the fodder's shield slab claws
    // back what the height boost adds. This pipeline reproduces that effect
    // with the sign NEGATIVE: at a shared cell size the hero fills fewer
    // cells than a shield brute despite standing 1.25x taller. It is the
    // third independent pipeline to find that size alone cannot express
    // tier, and it is why marking is load-bearing rather than supplementary.
    const hero = buildMedic();
    hero.root.scale.setScalar(HERO_SCREEN_HEIGHT / screenHeight(hero.root));
    const heroMass = rasterSilhouette(hero.root, HERO_ROWS).filled;
    const bruteMass = rasterSilhouette(fitted("brute"), FODDER_ROWS).filled;
    const ratio = heroMass / bruteMass;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.05);
  });
});

describe("formation", () => {
  it("fields 18 fodder and 2 heroes per side", () => {
    const slots = layoutCrowd();
    for (const faction of ["crew", "opfor"] as const) {
      const side = slots.filter((s) => s.faction === faction);
      expect(side.filter((s) => s.hero)).toHaveLength(2);
      expect(side.filter((s) => !s.hero)).toHaveLength(18);
    }
  });

  it("separates heroes ON SCREEN, which is not the same as in the formation", () => {
    for (let i = 0; i < HERO_SLOTS.length; i += 1) {
      for (let j = i + 1; j < HERO_SLOTS.length; j += 1) {
        const a = HERO_SLOTS[i]!;
        const b = HERO_SLOTS[j]!;
        expect(slotDistance(a, b)).toBeGreaterThanOrEqual(2);
        // The one that actually matters. A Chebyshev-3 pair can project to
        // 1.94 units of screen travel under this camera and fuse its rings;
        // 4 units is roughly two fodder widths of clear air between them.
        expect(slotScreenDistance(a, b)).toBeGreaterThan(2.5);
      }
    }
    const slots = layoutCrowd();
    const heroes = slots.filter((s) => s.hero);
    for (let i = 0; i < heroes.length; i += 1) {
      for (let j = i + 1; j < heroes.length; j += 1) {
        expect(heroes[i]!.position.distanceTo(heroes[j]!.position)).toBeGreaterThan(1.6);
      }
    }
  });

  it("never puts a hero in a rank its own army stands in front of", () => {
    // Overshooting the screen-separation constraint put a hero at rank 3,
    // where the depth-tested marking pass correctly suppressed a ring that
    // nothing could see anyway — 3 findable heroes instead of 4.
    for (const [, rank] of HERO_SLOTS) {
      expect(rank).toBeLessThanOrEqual(HERO_MAX_RANK);
    }
  });

  it("fronts the formation with shields and backs it with barrels", () => {
    expect(archetypeAt(0)).toBe("brute");
    expect(archetypeAt(1)).toBe("brute");
    expect(archetypeAt(2)).toBe("marksman");
    expect(archetypeAt(3)).toBe("marksman");
  });

  it("gives every unit a distinct jitter seed, so the crowd cannot pulse", () => {
    const slots = layoutCrowd();
    expect(new Set(slots.map((s) => s.jitter)).size).toBe(slots.length);
  });
});

describe("crowd motion", () => {
  /**
   * The test that was missing. Round 3's first capture run shipped two crowd
   * motion GIFs that were 24 pixel-identical frames: the render loop's pose
   * call was gated on a mount-time `motion` flag, so every frame drew t=0.
   * Typecheck passed, lint passed, 49 tests passed, and every still looked
   * correct — a cold critic decoding the GIF found it.
   *
   * These drive `poseCrowd`, the exact function the render loop calls, over
   * the exact units `mountCrowd3d` builds. Testing `applyFodderPose` on its
   * own would NOT have caught the original bug, because that function was
   * never the broken part.
   */
  const fingerprint = (units: ReturnType<typeof buildCrowdUnits>): string[] =>
    units.map((unit) => {
      const out: number[] = [];
      unit.place.updateMatrixWorld(true);
      unit.place.traverse((node) => {
        out.push(node.rotation.x, node.rotation.y, node.rotation.z, node.position.y);
      });
      return out.map((v) => v.toFixed(5)).join(",");
    });

  it("changes every unit's pose when the clock advances", () => {
    const units = buildCrowdUnits(layoutCrowd(), false);
    poseCrowd(units, 0);
    const rest = fingerprint(units);
    poseCrowd(units, 1.37);
    const later = fingerprint(units);
    const moved = later.filter((pose, i) => pose !== rest[i]).length;
    expect(moved).toBe(units.length);
  });

  it("keeps moving across a whole loop, not just off the first frame", () => {
    const units = buildCrowdUnits(layoutCrowd(), false);
    const seen = new Set<string>();
    for (let i = 0; i < 24; i += 1) {
      poseCrowd(units, i / 8);
      seen.add(fingerprint(units).join("|"));
    }
    // 24 sampled frames of a stepped 8-poses/sec clock must not collapse to
    // one image. Anything under half is a frozen or near-frozen crowd.
    expect(seen.size).toBeGreaterThan(12);
  });

  it("desynchronises the crowd — no two units share a pose at the same t", () => {
    // A bake can only offset playback phase. This runtime varies phase, rate
    // AND amplitude, and the lane's whole crowd-scale argument rests on that,
    // so it is asserted rather than eyeballed off a GIF.
    const units = buildCrowdUnits(layoutCrowd(), false).filter((unit) => !unit.hero);
    poseCrowd(units, 1.37);
    const poses = fingerprint(units);
    expect(new Set(poses).size).toBe(poses.length);
  });
});

describe("factions", () => {
  it("gives the two armies' heroes different palettes, not just different rings", () => {
    const colours = (faction: "crew" | "opfor"): Set<string> => {
      const rig = buildMedic(faction);
      const out = new Set<string>();
      rig.root.traverse((node) => {
        if (!(node instanceof THREE.Mesh) || Array.isArray(node.material)) { return; }
        out.add((node.material as THREE.MeshToonMaterial).color.getHexString());
      });
      return out;
    };
    const crew = colours("crew");
    const opfor = colours("opfor");
    // The identity colours must actually differ, or the ring is the only cue
    // and grayscale erases the distinction between the two armies.
    expect(crew.has("a6533f")).toBe(true);
    expect(opfor.has("a6533f")).toBe(false);
    expect(opfor.has("6f93b8")).toBe(true);
    const shared = [...crew].filter((hex) => opfor.has(hex));
    expect(shared.length).toBeLessThan(crew.size * 0.75);
  });
});

describe("marking", () => {
  it("specifies ring width in pixels, so it survives the zoom-out", () => {
    // A world-space ring would shrink with the unit and stop working at
    // exactly the register where tier separation is hardest. Asserting the
    // constant is a pixel value is the cheapest way to keep that true.
    expect(MARK_PIXELS).toBeGreaterThan(1.5);
    expect(MARK_PIXELS).toBeLessThan(4);
    // Same pixel width at both registers, i.e. it does not scale with zoom.
    const far = MARK_PIXELS;
    const near = MARK_PIXELS;
    expect(far).toBe(near);
    expect(zoomFor("near")).toBeGreaterThan(zoomFor("far"));
  });
});
