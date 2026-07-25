/**
 * THROWAWAY PROTOTYPE (#82): the numbers that make this lane comparable to
 * the other two bake-off lanes. Imported by BOTH the offline bake spec and
 * the PixiJS runtime, so the camera that renders the sprites and the stage
 * that draws them cannot drift.
 *
 * Framing is pinned to the real-time 3D lane's pulled-back still (PR #85):
 * a 480x270 aperture at 40 world-px per unit, zoomed 0.82 — i.e. ~32.8
 * screen px per world unit, character ~60 px tall.
 *
 * This lane reaches the same screen framing through the pixel-art canon
 * instead (#68: 24x32 authored at an integer 2x). Everything is authored on
 * a 240x135 ART-PIXEL grid at 16 art px per world unit and blown up 2x with
 * nearest-neighbour, which lands the medic at 31 art px / 62 screen px. The
 * board goes through the same grid, so character and environment share one
 * pixel size — the cohesion the other two lanes have to argue for.
 */

/** Integer render scale from art pixels to screen pixels (#68 canon). */
export const ART_SCALE = 2;

export const STAGE_WIDTH = 480;
export const STAGE_HEIGHT = 270;
export const ART_WIDTH = STAGE_WIDTH / ART_SCALE;
export const ART_HEIGHT = STAGE_HEIGHT / ART_SCALE;

/** Art pixels per Blender world unit. 40 * 0.82 / ART_SCALE, rounded to an integer. */
export const PIXELS_PER_UNIT = 16;

/** Sprite cell. Sized to hold the attack lunge and the hop, not the idle bbox. */
export const CELL = { width: 64, height: 48 } as const;

/** Where world origin (the rig's ground point) lands inside the cell. */
export const ANCHOR = { x: 32, y: 40 } as const;

export const FACINGS = 8;

/**
 * The baked clip budget. Every frame here costs FACINGS atlas cells, which
 * is the whole cost question this lane exists to answer — so the acting is
 * authored INTO short loops rather than sampled out of long ones.
 */
export const CLIPS = [
  { name: "idle", frames: 8, fps: 8 },
  { name: "attack", frames: 12, fps: 12 },
  { name: "pivot", frames: 6, fps: 12 },
] as const;

export type ClipName = (typeof CLIPS)[number]["name"];

/** The #74/#79 grime-market board, 840x360 at 40 px/unit, into art pixels. */
export const BOARD_SCALE = PIXELS_PER_UNIT / 40;
export const BOARD_WIDTH = Math.round(840 * BOARD_SCALE);
export const BOARD_HEIGHT = Math.round(360 * BOARD_SCALE);
/** Board top-left in art pixels, chosen so the medic lands where PR #85 put it. */
export const BOARD_OFFSET = { x: -45, y: 2 } as const;
/** The board's authored character stand point (SVG 421,255) in art pixels. */
export const FEET = {
  x: Math.round(421 * BOARD_SCALE) + BOARD_OFFSET.x,
  y: Math.round(255 * BOARD_SCALE) + BOARD_OFFSET.y,
} as const;

export const ATLAS_BASENAME = "medic";
/** Served from apps/webapp/public; Pixi loads the sheet JSON from here. */
export const ATLAS_PUBLIC_DIR = "blender-baked";

/* ---------------------------------------------------------------------- *
 * Round 4 — the fodder tier (#69's two-tier ruling).
 *
 * Everything above is the hero PORTRAIT test this lane was originally
 * specced for. Everything below is the CROWD test: two fodder archetypes
 * plus the hero, baked at two on-screen sizes, so the open pixel-resolution
 * fork on #69 gets a measurement instead of an argument.
 * ---------------------------------------------------------------------- */

/**
 * The authored hero rig spans 1.82 world units — 29 art px of body at
 * PIXELS_PER_UNIT, plus the 1 px contour on each side, which is the 31 px the
 * first three rounds reported. Every tier size below is expressed as a target
 * SCREEN height and converted back into a rig scale through this constant, so
 * the numbers in the gallery are literally the numbers in the bake spec.
 */
export const HERO_BODY_ART_PX = 29;
/** The ink pass grows 1 px outward, so a body gains 2 px of height. */
export const CONTOUR_ART_PX = 2;

/**
 * Tier separation on #69 is now three things: a SLIGHT size boost, higher
 * detail density, and — approved 2026-07-25 — marking. The boost stays at the
 * ruled 1.2-1.3x rather than growing to compensate, because the sibling lane
 * showed the shortfall is perceptual and marking is the sanctioned answer to
 * it. `HERO_MARK_HEX` below is that third lever, and the crowd captures ship
 * with and without it so its contribution is measured, not assumed.
 */
export const TIER_SIZE_BOOST = 1.28;

export type UnitId = "brute" | "marksman" | "medic";
export type TierKey = "fodder" | "hero";

export interface ClipSpec { readonly name: string; readonly frames: number; readonly fps: number }

/**
 * Fodder acting budget: 14 frames across three short clips against the hero's
 * 26 across three long ones. `idle_b` is not padding — it is this lane's
 * answer to the crowd-motion problem. Playback phase offset decorrelates WHEN
 * units move but cannot change WHAT they do; a second baked idle is the
 * cheapest thing that adds pose vocabulary to a mass, and a nine-second bake
 * is what makes it cheap.
 */
export const FODDER_CLIPS: readonly ClipSpec[] = [
  { fps: 6, frames: 4, name: "idle" },
  { fps: 6, frames: 4, name: "idle_b" },
  { fps: 10, frames: 6, name: "attack" },
];

/** A hero inside a crowd never pivots on the spot, so the pivot clip is cut. */
export const HERO_CROWD_CLIPS: readonly ClipSpec[] = [
  { fps: 8, frames: 8, name: "idle" },
  { fps: 12, frames: 12, name: "attack" },
];

export interface UnitBake {
  readonly id: UnitId;
  readonly tier: TierKey;
  /** Uniform world scale applied to the authored rig. */
  readonly scale: number;
  /** Rendered body height in art px, contour excluded. */
  readonly bodyArtPx: number;
  /** On-screen height in device px at ART_SCALE, contour included. */
  readonly screenPx: number;
  readonly cell: { readonly width: number; readonly height: number };
  readonly anchor: { readonly x: number; readonly y: number };
  readonly clips: readonly ClipSpec[];
  readonly facings: number;
}

function evenCeil(value: number): number {
  return Math.ceil(value / 2) * 2;
}

/**
 * Extra cell margin over the hero's proportions. The hero cell was sized for
 * one rig's lunge; the brute carries a slab shield well outside its body line
 * and needs more room. Inflating the cell is free in the shipped atlas — every
 * frame is trimmed to its alpha bbox before packing — so the margin is spent
 * generously and only shows up in the untrimmed-grid comparison.
 */
const CELL_MARGIN = 1.4;

/**
 * Derive a unit's whole bake geometry from one number: how tall it should be
 * on screen. Cell and anchor scale with the rig, so a 22 px fodder unit does
 * not carry the hero cell's slack around the atlas.
 */
function unitBake(
  id: UnitId,
  tier: TierKey,
  screenPx: number,
  clips: readonly ClipSpec[],
  facings = FACINGS,
): UnitBake {
  const bodyArtPx = screenPx / ART_SCALE - CONTOUR_ART_PX;
  const scale = bodyArtPx / HERO_BODY_ART_PX;
  const cellScale = scale * CELL_MARGIN;
  return {
    anchor: { x: Math.round(ANCHOR.x * cellScale), y: Math.round(ANCHOR.y * cellScale) },
    bodyArtPx,
    cell: { height: evenCeil(CELL.height * cellScale), width: evenCeil(CELL.width * cellScale) },
    clips,
    facings,
    id,
    screenPx,
    scale,
    tier,
  };
}

/**
 * Hero marking (#69, approved 2026-07-25 after the flat-procedural lane showed
 * size + detail density alone cannot find a hero at small angular size). One
 * colour for both factions on purpose: the ring's job is "this one matters",
 * not "this one is ours", and mixing the two would make the with/without pair
 * unreadable. `pale` is the only bright neutral in the palette that neither
 * army and neither board ramp already owns.
 */
export const HERO_MARK_HEX = "#c8bda9";

export interface CrowdConfig {
  readonly key: "large" | "mid" | "small";
  readonly label: string;
  readonly note: string;
  readonly atlas: string;
  readonly units: readonly UnitBake[];
  /** Marking ring thickness in ART px — proportional, ~1/14 of hero height. */
  readonly markThickness: number;
  /** Formation spacing in art px, proportional to unit size. */
  readonly spacing: {
    readonly along: readonly [number, number];
    readonly rank: readonly [number, number];
  };
}

function crowdConfig(
  key: CrowdConfig["key"],
  label: string,
  note: string,
  fodderScreenPx: number,
): CrowdConfig {
  const heroScreenPx = Math.round(fodderScreenPx * TIER_SIZE_BOOST);
  // A rank runs up-right and ranks stack down-right: the 2:1 dimetric block.
  // Spacing tracks unit size so both configs read as the same formation
  // density — the comparison is meant to isolate resolution, not crowding.
  const step = fodderScreenPx / ART_SCALE;
  return {
    atlas: `crowd-${key}`,
    key,
    label,
    // One art pixel at BOTH registers, which is already twice the weight of the
    // sprite's own contour. A 2 px ring was captured first and rejected on the
    // evidence: at the large register it swallows the figure it is marking, so
    // you find the hero and then cannot read it. See marking-large-2px-ring.png.
    markThickness: 1,
    note,
    spacing: {
      along: [step * 1.2, -step * 0.6],
      rank: [step * 0.72, step * 0.36],
    },
    units: [
      unitBake("brute", "fodder", fodderScreenPx, FODDER_CLIPS),
      unitBake("marksman", "fodder", fodderScreenPx, FODDER_CLIPS),
      unitBake("medic", "hero", heroScreenPx, HERO_CROWD_CLIPS),
    ],
  };
}

/**
 * The three registers. `small` is the Hero's Hour register the cofounder's
 * stated likes point at; `large` is where a hand-authored pixel lane would owe
 * a second set of drawings.
 *
 * `mid` is round 5's addition and the reason this lane is worth having: the
 * cofounder asked for a slight bump off the small end after seeing the crowd,
 * and answering that question cost one line here plus about two seconds of
 * Blender. Nothing was redrawn — the same three rigs go through the same seam a
 * third time at a third world scale. 22 → 28 → 36 is very nearly geometric
 * (1.27x, 1.29x), so the ladder brackets the register question evenly instead
 * of clustering at one end, and 28 lands on an integer art-pixel body (12 px
 * plus the 2 px contour) rather than half a pixel.
 */
export const CROWD_CONFIGS: readonly CrowdConfig[] = [
  crowdConfig("small", "Small — Hero's Hour register", "fodder 22px · hero 28px on screen", 22),
  crowdConfig("mid", "Mid — the round-5 register", "fodder 28px · hero 36px on screen", 28),
  crowdConfig("large", "Large", "fodder 36px · hero 46px on screen", 36),
];

export function configByKey(key: string | null): CrowdConfig {
  const found = CROWD_CONFIGS.find((config) => config.key === key);
  return found ?? (CROWD_CONFIGS[0] as CrowdConfig);
}
