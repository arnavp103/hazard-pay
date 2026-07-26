/**
 * THROWAWAY SCAFFOLDING (#96): the unit vocabulary the whole sandbox shares.
 *
 * Tier, faction and the two faction palettes live here rather than in
 * `figure.ts` so that `archetypes.ts` — which owns the per-archetype geometry
 * and combat numbers — can be imported by the figure builder without a cycle.
 *
 * Nothing in this file is an art-direction commitment. See `README.md`.
 */

/** Two-tier hierarchy, per the bake-off (#69). Working words, not ratified. */
export type Tier = "fodder" | "hero";
export type Faction = "crew" | "opfor";

export const HERO_HEIGHT = 1.85;
export const FODDER_HEIGHT = 1.48;
/** The "slight" hero boost — 1.25x, inside the 1.2-1.3x ruling on #69. */
export const TIER_SCALE = HERO_HEIGHT / FODDER_HEIGHT;

export function heightOf(tier: Tier): number {
  return tier === "hero" ? HERO_HEIGHT : FODDER_HEIGHT;
}

/**
 * Hero border half-width in PIXELS, not world units. A marker whose job is to
 * be findable has to stay findable when the camera zooms out, so it is
 * defined in the space the eye actually judges it in.
 */
export const MARK_PIXELS = 2.2;

export interface Palette {
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
 * identity on a near-black body. The identity colour sits on the head so a
 * crowd sorts into two armies at a glance.
 */
export const PALETTES: Record<Faction, Palette> = {
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

/** Marker tint per faction, for the silhouette-border composite. */
export const SIGNAL: Record<Faction, string> = {
  crew: PALETTES.crew.signal,
  opfor: PALETTES.opfor.signal,
};

/** Side 0 is the crew, side 1 the opfor. The sim speaks sides, the rig factions. */
export type Side = 0 | 1;

export function factionOf(side: Side): Faction {
  return side === 0 ? "crew" : "opfor";
}
