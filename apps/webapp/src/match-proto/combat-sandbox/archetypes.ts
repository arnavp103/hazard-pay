/**
 * THROWAWAY SCAFFOLDING (#96).
 *
 * # EXTENSION POINT 2 of 3 — add a new unit archetype
 *
 * Everything that differs between a medic, a melee trooper and a rifleman is
 * in this file and nowhere else. Adding an archetype is adding one entry to
 * `ARCHETYPES`; `Archetype` is derived from its keys, so TypeScript will point
 * at any switch that has not kept up (there should be none — the rest of the
 * sandbox reads the registry rather than branching on the name).
 *
 * An entry owns six things:
 *
 *   profile     combat numbers per tier — reach, cadence, speed, standoff.
 *               Read by `behaviours.ts`, never hard-coded at a call site.
 *   headgear    the crown masses drawn into the head bone's batch. This is
 *               the archetype's silhouette tell at 28 px, so make it a shape,
 *               not a colour.
 *   torsoTell   the chest/back mass every unit of the archetype carries — the
               fodder-scale silhouette tell.
 *   heroKit     extra chest iconography, heroes only. This is where the tier's
 *               ~3x detail density is spent.
 *   weapon      the held tool, plus the foregrip / muzzle / accent anchors the
 *               IK and the fire accent attach to.
 *   bind        rest posture added on top of the shared BIND pose, so the
 *               weapon forearm already points roughly where the tool aims.
 *   flags       twoHanded (support hand IK-tracks the foregrip), cyberArm,
 *               recoilKick.
 *
 * Nothing here is an art-direction commitment; see `README.md`.
 */

import type { JointName } from "./authored.ts";
import { box, cone, facet, type FlatBatch, taper, wedge } from "./flat.ts";
import type { Triple } from "./procedural.ts";
import type { Palette, Tier } from "./units.ts";

/** Combat numbers a behaviour reads. All distances are world units. */
export interface CombatProfile {
  /** Cap on |v|. */
  maxSpeed: number;
  /** Preferred distance to the current target — the standoff the drive seeks. */
  standoff: number;
  /** Distance inside which an attack may start. */
  attackRange: number;
  /** Base seconds between attacks, jittered +-25% by the sim. */
  cooldown: number;
}

/** Anchors a weapon publishes back to the rig builder. */
export interface WeaponBuild {
  foregripAt: Triple;
  muzzleAt: Triple;
  accent?: { size: number; at: Triple };
}

export type MassBuilder = (
  batch: FlatBatch,
  palette: Palette,
  s: number,
  detailed: boolean,
) => void;

export type WeaponBuilder = (
  batch: FlatBatch,
  palette: Palette,
  s: number,
  detailed: boolean,
) => WeaponBuild;

export interface ArchetypeSpec {
  profile: (tier: Tier) => CombatProfile;
  headgear: MassBuilder;
  /** Chest/back mass every unit of this archetype carries. */
  torsoTell: MassBuilder;
  /** Extra chest iconography, drawn for heroes only. */
  heroKit: MassBuilder;
  weapon: WeaponBuilder;
  /** Rest posture added to the shared BIND pose. */
  bind: Partial<Record<JointName, Triple>>;
  /** Support hand IK-tracks the foregrip; one-handed tools leave it posed. */
  twoHanded: boolean;
  /** Build the support arm as a prosthetic. */
  cyberArm: boolean;
  /** Impulse into the recoil spring on release. */
  recoilKick: number;
}

/**
 * Weapons are deliberately oversized for the head-count register — the same
 * reasoning that enlarges the head and the hands. A naturalistic weapon on a
 * 3.8-head figure disappears at 28 px.
 */
const WEAPON_SCALE = 1.14;

const buildInjector: WeaponBuilder = (batch, palette, s, detailed) => {
  const w = s * WEAPON_SCALE;
  batch.add(taper(0.042 * w, 0.052 * w, 0.3 * w, 6), palette.metal, {
    at: [0, -0.01 * w, 0.13 * w],
    rot: [Math.PI / 2, 0, 0],
  });
  batch.add(box(0.11 * w, 0.12 * w, 0.15 * w), palette.livery, { at: [0, 0.07 * w, 0.04 * w] });
  batch.add(box(0.07 * w, 0.14 * w, 0.08 * w), palette.boot, { at: [0, -0.1 * w, 0.01 * w] });
  if (detailed) {
    batch.add(box(0.13 * w, 0.03 * w, 0.05 * w), palette.pale, { at: [0, 0.14 * w, 0.04 * w] });
    batch.add(taper(0.03 * w, 0.05 * w, 0.08 * w, 6), palette.coatDark, {
      at: [0, -0.01 * w, -0.08 * w],
      rot: [Math.PI / 2, 0, 0],
    });
  }
  return {
    accent: { at: [0, -0.01 * w, 0.3 * w], size: 0.045 * w },
    foregripAt: [0, 0.005 * w, 0.06 * w],
    muzzleAt: [0, -0.01 * w, 0.3 * w],
  };
};

const buildBlade: WeaponBuilder = (batch, palette, s, detailed) => {
  const w = s * WEAPON_SCALE;
  const haft = detailed ? 0.5 : 0.34;
  batch.add(taper(0.026 * w, 0.03 * w, haft * w, 5), palette.coatDark, {
    at: [0, 0, haft * 0.3 * w],
    rot: [Math.PI / 2, 0, 0],
  });
  batch.add(wedge(0.055 * w, 0.2 * w), palette.metal, {
    at: [0, 0.01 * w, (haft * 0.3 + 0.2) * w],
    rot: [Math.PI / 2, 0.5, 0],
  });
  batch.add(box(0.15 * w, 0.05 * w, 0.05 * w), palette.livery, { at: [0, 0, haft * 0.06 * w] });
  if (detailed) {
    batch.add(facet(0.065 * w), palette.liveryDark, { at: [0, 0, -0.18 * w] });
    batch.add(box(0.05 * w, 0.04 * w, 0.16 * w), palette.pale, { at: [0, 0.02 * w, haft * 0.2 * w] });
  }
  return {
    foregripAt: [0, 0, haft * 0.16 * w],
    muzzleAt: [0, 0.01 * w, (haft * 0.3 + 0.4) * w],
  };
};

const buildCarbine: WeaponBuilder = (batch, palette, s, detailed) => {
  const w = s * WEAPON_SCALE;
  batch.add(box(0.085 * w, 0.13 * w, 0.28 * w), palette.coatDark, { at: [0, 0.01 * w, 0.06 * w] });
  batch.add(taper(0.026 * w, 0.034 * w, 0.24 * w, 6), palette.metal, {
    at: [0, 0.04 * w, 0.3 * w],
    rot: [Math.PI / 2, 0, 0],
  });
  batch.add(box(0.07 * w, 0.1 * w, 0.13 * w), palette.livery, { at: [0, -0.02 * w, -0.12 * w] });
  if (detailed) {
    batch.add(box(0.06 * w, 0.15 * w, 0.09 * w), palette.boot, { at: [0, -0.11 * w, 0.0] });
    batch.add(facet(0.07 * w), palette.liveryDark, { at: [0, 0.11 * w, -0.04 * w] });
    batch.add(box(0.04 * w, 0.04 * w, 0.12 * w), palette.pale, { at: [0, 0.11 * w, 0.16 * w] });
  }
  return {
    accent: { at: [0, 0.04 * w, 0.43 * w], size: 0.05 * w },
    foregripAt: [0, 0, -0.015 * w],
    muzzleAt: [0, 0.04 * w, 0.43 * w],
  };
};

/** Peaked hood — the medic's silhouette signature. */
const medicHood: MassBuilder = (batch, palette, s) => {
  batch.add(cone(0.148 * s, 0.135 * s, 6), palette.livery, { at: [0, 0.1875 * s, -0.004 * s] });
  batch.add(box(0.196 * s, 0.028 * s, 0.07 * s), palette.liveryDark, {
    at: [0, 0.148 * s, 0.088 * s],
  });
};

/** Kettle helm: a truncated cone crown over a full brim ring. */
const kettleHelm: MassBuilder = (batch, palette, s) => {
  batch.add(taper(0.082 * s, 0.142 * s, 0.11 * s, 6), palette.livery, { at: [0, 0.19 * s, 0] });
  batch.add(taper(0.168 * s, 0.168 * s, 0.024 * s, 6), palette.liveryDark, { at: [0, 0.14 * s, 0] });
};

/** Slab cap with a forward bill — the bill is a second front cue on its own. */
const slabCap: MassBuilder = (batch, palette, s) => {
  batch.add(box(0.212 * s, 0.098 * s, 0.186 * s), palette.livery, { at: [0, 0.19 * s, -0.004 * s] });
  batch.add(box(0.188 * s, 0.026 * s, 0.078 * s), palette.liveryDark, {
    at: [0, 0.146 * s, 0.095 * s],
  });
};

const noKit: MassBuilder = () => {};

/** Chest plate — the swordsman's tell, on fodder and heroes alike. */
const meleeTell: MassBuilder = (batch, palette, s) => {
  batch.add(box(0.2 * s, 0.075 * s, 0.05 * s), palette.pale, { at: [0, 0.105 * s, 0.13 * s] });
};

/**
 * Back canister — the rifleman's tell. Slung at the lumbar, not the shoulders:
 * kit above the shoulder line competes with the head for the top of the
 * silhouette, which is the round-1 defect PR #90 spent a round fixing.
 */
const rangedTell: MassBuilder = (batch, palette, s) => {
  batch.add(taper(0.07 * s, 0.088 * s, 0.2 * s, 6), palette.coatDark, {
    at: [0, -0.005 * s, -0.135 * s],
  });
};

/** The cross is medic iconography — only the medic hero wears it. */
const medicHeroKit: MassBuilder = (batch, palette, s) => {
  batch.add(box(0.145 * s, 0.145 * s, 0.05 * s), palette.pale, { at: [0.012 * s, 0.1 * s, 0.128 * s] });
  batch.add(box(0.04 * s, 0.112 * s, 0.03 * s), palette.livery, { at: [0.012 * s, 0.1 * s, 0.152 * s] });
  batch.add(box(0.104 * s, 0.04 * s, 0.03 * s), palette.livery, { at: [0.012 * s, 0.1 * s, 0.152 * s] });
};

const plateHeroKit: MassBuilder = (batch, palette, s) => {
  batch.add(box(0.15 * s, 0.055 * s, 0.05 * s), palette.pale, { at: [0.01 * s, 0.115 * s, 0.128 * s] });
  batch.add(box(0.095 * s, 0.07 * s, 0.045 * s), palette.liveryDark, {
    at: [0.01 * s, 0.045 * s, 0.128 * s],
  });
};

/**
 * The registry. **Add an archetype here.**
 *
 * Combat numbers are the bake-off's; they are a plausible spread, not balance.
 * HP, damage and lethality are out of scope on the combat map (#95).
 */
export const ARCHETYPES = {
  medic: {
    bind: {
      elbowL: [-0.5, 0, 0],
      elbowR: [-0.5, 0, 0],
      shoulderL: [0.02, 0, 0.12],
      shoulderR: [-0.62, 0, -0.14],
    },
    cyberArm: true,
    headgear: medicHood,
    heroKit: medicHeroKit,
    profile: () => ({ attackRange: 1.3, cooldown: 1.7, maxSpeed: 1.2, standoff: 1.05 }),
    recoilKick: 6.5,
    torsoTell: noKit,
    twoHanded: false,
    weapon: buildInjector,
  },
  melee: {
    bind: {
      elbowL: [-0.45, 0, 0],
      elbowR: [-0.5, 0, 0],
      shoulderL: [0.05, 0, 0.14],
      shoulderR: [-0.3, 0, -0.18],
    },
    cyberArm: false,
    headgear: kettleHelm,
    heroKit: plateHeroKit,
    profile: (tier: Tier) => ({
      attackRange: tier === "hero" ? 1.4 : 1.1,
      cooldown: tier === "hero" ? 1.6 : 1.9,
      maxSpeed: tier === "hero" ? 1.45 : 1.6,
      standoff: tier === "hero" ? 1.15 : 0.9,
    }),
    recoilKick: 6.5,
    torsoTell: meleeTell,
    twoHanded: false,
    weapon: buildBlade,
  },
  ranged: {
    bind: {
      elbowL: [-0.7, 0, 0],
      elbowR: [-0.66, 0, 0],
      shoulderL: [-0.22, 0, 0.4],
      shoulderR: [-0.35, 0, -0.35],
    },
    cyberArm: false,
    headgear: slabCap,
    heroKit: plateHeroKit,
    profile: (tier: Tier) => ({
      attackRange: tier === "hero" ? 6.2 : 5.4,
      cooldown: tier === "hero" ? 1.5 : 2.1,
      maxSpeed: tier === "hero" ? 1.05 : 1.15,
      standoff: tier === "hero" ? 5.6 : 4.7,
    }),
    recoilKick: 9,
    torsoTell: rangedTell,
    twoHanded: true,
    weapon: buildCarbine,
  },
} as const satisfies Record<string, ArchetypeSpec>;

export type Archetype = keyof typeof ARCHETYPES;

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES) as Archetype[];

export function archetypeSpec(archetype: Archetype): ArchetypeSpec {
  return ARCHETYPES[archetype];
}

export function profileOf(archetype: Archetype, tier: Tier): CombatProfile {
  return ARCHETYPES[archetype].profile(tier);
}
