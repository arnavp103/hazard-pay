/**
 * THROWAWAY PROTOTYPE (#91) — the shared grime-market board.
 *
 * This module is the *experiment control*. Both treatments render from this
 * one model, so "same board, same camera, same framing" is enforced by
 * construction rather than by eyeballing two drawings:
 *
 * - `groundAt` is the authored floor plan (deterministic, no RNG);
 * - `props` is the authored prop manifest in cell space;
 * - `propSpecs` is what each prop kind *claims* — footprint, height, cover
 *   class, and whether it carries a roof. This is the occupancy model, and
 *   it is what round 1 did not have;
 * - `project` is the single 2:1 dimetric projection (#68: fixed angle,
 *   panning non-rotating camera — the camera below translates and
 *   integer-scales, it never rotates);
 * - `cameras` are the framings every capture is taken through.
 *
 * Cell space: `cx` runs screen-right-and-down, `cy` screen-left-and-down.
 *
 * ROUND 2 — RESCALED. Round 1 drew a 64×32 tile because it was carrying a
 * borrowed 48×64 hero. The pixel lane has since settled the unit register at
 * fodder 22 px / hero 28 px on a 13×7 half-tile, so this board is re-authored
 * at a 28×14 tile in a 640×360 native frame. Native resolution is now the
 * "true 1×" capture and every other framing is a whole-number multiple of it.
 * Every prop height below is authored against the 22 px fodder figure, which
 * is the only way "waist-height" and "fully occluding" mean anything.
 */

export const BOARD_WIDTH = 640;
export const BOARD_HEIGHT = 360;

/** 2:1 dimetric tile, sized for a 22 px fodder figure. */
export const TILE_W = 28;
export const TILE_H = 14;

export const GRID = 20;

const ORIGIN_X = 320;
const ORIGIN_Y = 58;

/** Fodder figure height in board pixels — the yardstick for every prop. */
export const FODDER_FIGURE = 22;

export interface Point { x: number; y: number }

/** Cell centre in board pixels. Fixed angle; never rotated. */
export function project(cx: number, cy: number): Point {
  return {
    x: ORIGIN_X + (cx - cy) * (TILE_W / 2),
    y: ORIGIN_Y + (cx + cy) * (TILE_H / 2),
  };
}

/** Painter-algorithm depth. Larger draws later (nearer the camera). */
export function depth(cx: number, cy: number): number {
  return cx + cy;
}

export type Ground
  = | "asphalt"
    | "asphaltWet"
    | "concrete"
    | "dirt"
    | "grate"
    | "mat";

/**
 * The authored floor plan. A central aisle crossing a transverse lane splits
 * the plaza into four stall quadrants; the perimeter is the concrete apron of
 * the surrounding blocks. Quiet contrast throughout — canon reserves the
 * darkest contours and brightest points for units.
 */
export function groundAt(cx: number, cy: number): Ground {
  const onEdge = cx <= 1 || cy <= 1 || cx >= GRID - 2 || cy >= GRID - 2;
  if (onEdge) { return "concrete"; }

  const aisle = Math.abs(cx - cy) <= 1;
  const cross = cx + cy >= 17 && cx + cy <= 19;
  if (aisle || cross) {
    // Standing water where the aisle meets the low corner of the plaza.
    if (cx >= 4 && cx <= 7 && cy >= 11 && cy <= 14) { return "asphaltWet"; }
    return "asphalt";
  }

  // Drain cluster under the north-east stalls.
  if (cx >= 13 && cx <= 15 && cy >= 4 && cy <= 6) { return "grate"; }

  // Trodden dirt where feet leave the aisle, stall matting further in.
  const quadrantDepth = Math.min(Math.abs(cx - cy) - 2, Math.abs(cx + cy - 18) - 2);
  return quadrantDepth <= 1 ? "dirt" : "mat";
}

/**
 * How a prop reads as cover, against a 22 px fodder figure.
 *
 * - `low` — ankle rubble. Blocks the tile, hides nothing.
 * - `waist` — a unit standing behind it is cut at the hip: legs gone, torso
 *   and head clear. This is the class the cofounder was asking for.
 * - `screen` — see-through: railings and chain fence occlude in stripes.
 * - `full` — taller than a fodder figure; a unit behind it disappears.
 * - `pole` — thin and tall; occludes a narrow vertical slice.
 * - `canopy` — carries a roof overhead. The cells under the roof stay
 *   walkable and are shaded instead.
 */
export type CoverClass = "canopy" | "full" | "low" | "pole" | "screen" | "waist";

export interface Roof {
  /** Roof origin relative to the prop anchor, in cells. */
  ox: number;
  oy: number;
  sx: number;
  sy: number;
  /** Underside height above the floor, in board pixels. */
  lift: number;
}

export interface PropSpec {
  /** Cells this prop's mass claims. Units may never stand here. */
  sx: number;
  sy: number;
  /** Silhouette height in board pixels, floor to top. */
  height: number;
  cover: CoverClass;
  /** Overhead roof. Cells under it stay walkable but are shaded. */
  roof?: Roof;
  /** One-line note for the cover-variety sheet. */
  note: string;
}

export type PropKind
  = | "awningStall"
    | "barrelPair"
    | "blockWall"
    | "cableSpool"
    | "canopySpan"
    | "chainFence"
    | "container"
    | "crateStack"
    | "dumpster"
    | "hulk"
    | "jerseyBarrier"
    | "lampPost"
    | "pillar"
    | "pipeRack"
    | "railing"
    | "rubble"
    | "sandbagLine"
    | "signPylon"
    | "vent";

/**
 * The occupancy model. Every number here is in units of the 22 px fodder
 * figure: 10 px is mid-thigh, 13 px is the hip, 18 px clears the shoulder,
 * 26 px and up hides the whole unit.
 */
export const propSpecs: Record<PropKind, PropSpec> = {
  sandbagLine: { sx: 2, sy: 1, height: 10, cover: "waist", note: "sandbag line — stand behind, cut at the thigh" },
  jerseyBarrier: { sx: 2, sy: 1, height: 13, cover: "waist", note: "jersey barrier — hard waist cover with a hazard chevron" },
  railing: { sx: 3, sy: 1, height: 12, cover: "screen", note: "pipe railing — see-through, occludes in stripes" },
  chainFence: { sx: 3, sy: 1, height: 26, cover: "screen", note: "chain fence — tall but porous, unit reads through it" },
  crateStack: { sx: 1, sy: 1, height: 18, cover: "waist", note: "crate stack — chest-high hard block" },
  barrelPair: { sx: 1, sy: 1, height: 16, cover: "waist", note: "barrel pair — chest-high, rounded" },
  cableSpool: { sx: 1, sy: 1, height: 13, cover: "waist", note: "cable spool — hip-high clutter" },
  vent: { sx: 1, sy: 1, height: 12, cover: "waist", note: "extractor vent — hip-high, steams" },
  dumpster: { sx: 2, sy: 1, height: 16, cover: "waist", note: "dumpster — chest-high, wide" },
  pipeRack: { sx: 1, sy: 2, height: 20, cover: "waist", note: "pipe rack — shoulder-high, deep" },
  rubble: { sx: 1, sy: 1, height: 6, cover: "low", note: "rubble — blocks the tile, hides nothing" },
  pillar: { sx: 1, sy: 1, height: 44, cover: "pole", note: "concrete pillar — narrow full-height occluder" },
  container: { sx: 3, sy: 2, height: 30, cover: "full", note: "shipping container — total occlusion, hard edge" },
  hulk: { sx: 3, sy: 2, height: 20, cover: "full", note: "wrecked vehicle hulk — full cover with a broken top line" },
  blockWall: { sx: 4, sy: 2, height: 68, cover: "full", note: "block wall — the plaza's back wall" },
  lampPost: { sx: 1, sy: 1, height: 46, cover: "pole", note: "lamp post — thin vertical, occludes a 3 px slice" },
  signPylon: { sx: 1, sy: 1, height: 52, cover: "pole", note: "sign pylon — thin mast under a lit panel" },
  awningStall: {
    sx: 2,
    sy: 2,
    height: 38,
    cover: "canopy",
    roof: { ox: -1, oy: -1, sx: 4, sy: 4, lift: 34 },
    note: "market stall — counter blocks, canopy shades the ring around it",
  },
  canopySpan: {
    sx: 1,
    sy: 1,
    height: 36,
    cover: "canopy",
    roof: { ox: -2, oy: -2, sx: 5, sy: 5, lift: 32 },
    note: "canopy span — one column, 24 walkable cells under a ceiling",
  },
};

export interface Prop {
  id: string;
  kind: PropKind;
  /** North-west cell of the footprint. Integers: occupancy is per tile. */
  cx: number;
  cy: number;
  /** Which identity ramp this instance wears. */
  tone: "cool" | "warm";
  /** Emission channel for the props that carry one. */
  signal?: "amber" | "teal";
}

/**
 * Authored prop manifest — a market that has been lived in, and round 2's
 * answer to "experiment with different kinds of cover". Round 1 was market
 * stalls and service clutter only, which is why every cover read in it was
 * "roof overhead" and none of it was "something to stand behind".
 *
 * Hand-placed, deliberately not procedurally scattered, and every entry sits
 * on integer cells so the footprint it claims is unambiguous.
 */
export const props: readonly Prop[] = [
  // --- perimeter, deepest ------------------------------------------------
  { id: "wall-n", kind: "blockWall", cx: 2, cy: 0, tone: "warm" },
  { id: "wall-ne", kind: "blockWall", cx: 8, cy: 0, tone: "cool" },
  { id: "wall-e", kind: "blockWall", cx: 14, cy: 0, tone: "warm" },
  { id: "wall-nw", kind: "blockWall", cx: 0, cy: 4, tone: "cool" },
  { id: "wall-w", kind: "blockWall", cx: 0, cy: 10, tone: "warm" },

  // --- north-east quadrant: the hard-cover yard --------------------------
  { id: "container-ne", kind: "container", cx: 15, cy: 3, tone: "cool", signal: "teal" },
  { id: "hulk-ne", kind: "hulk", cx: 15, cy: 7, tone: "warm" },
  { id: "fence-ne", kind: "chainFence", cx: 12, cy: 3, tone: "cool" },
  { id: "crate-ne-a", kind: "crateStack", cx: 12, cy: 6, tone: "warm" },
  { id: "crate-ne-b", kind: "crateStack", cx: 13, cy: 7, tone: "warm" },
  { id: "barrel-ne", kind: "barrelPair", cx: 14, cy: 5, tone: "cool" },
  { id: "vent-ne", kind: "vent", cx: 13, cy: 5, tone: "cool", signal: "teal" },
  { id: "pillar-ne", kind: "pillar", cx: 11, cy: 8, tone: "cool" },

  // --- south-west quadrant: the barricade line ---------------------------
  { id: "sandbag-sw-a", kind: "sandbagLine", cx: 4, cy: 11, tone: "warm" },
  { id: "sandbag-sw-b", kind: "sandbagLine", cx: 4, cy: 13, tone: "warm" },
  { id: "jersey-sw", kind: "jerseyBarrier", cx: 7, cy: 12, tone: "cool", signal: "amber" },
  { id: "rail-sw", kind: "railing", cx: 3, cy: 15, tone: "cool" },
  { id: "dumpster-sw", kind: "dumpster", cx: 2, cy: 12, tone: "warm" },
  { id: "spool-sw", kind: "cableSpool", cx: 6, cy: 16, tone: "warm" },
  { id: "rubble-sw", kind: "rubble", cx: 7, cy: 15, tone: "cool" },
  { id: "pillar-sw", kind: "pillar", cx: 8, cy: 11, tone: "warm" },

  // --- north-west quadrant: stalls under canopy --------------------------
  { id: "stall-nw", kind: "awningStall", cx: 4, cy: 5, tone: "warm", signal: "amber" },
  { id: "canopy-nw", kind: "canopySpan", cx: 7, cy: 4, tone: "cool", signal: "teal" },
  { id: "crate-nw", kind: "crateStack", cx: 2, cy: 7, tone: "warm" },
  { id: "barrel-nw", kind: "barrelPair", cx: 3, cy: 3, tone: "warm" },
  { id: "pipe-nw", kind: "pipeRack", cx: 7, cy: 7, tone: "cool" },

  // --- south-east quadrant: stalls + the second canopy -------------------
  { id: "stall-se", kind: "awningStall", cx: 14, cy: 13, tone: "cool", signal: "teal" },
  { id: "canopy-se", kind: "canopySpan", cx: 12, cy: 16, tone: "warm", signal: "amber" },
  { id: "container-se", kind: "container", cx: 16, cy: 9, tone: "warm" },
  { id: "hulk-se", kind: "hulk", cx: 9, cy: 16, tone: "cool" },
  { id: "fence-se", kind: "chainFence", cx: 15, cy: 16, tone: "warm" },
  { id: "sandbag-se", kind: "sandbagLine", cx: 12, cy: 12, tone: "cool" },
  { id: "crate-se", kind: "crateStack", cx: 11, cy: 13, tone: "cool" },
  { id: "rubble-se", kind: "rubble", cx: 13, cy: 11, tone: "warm" },

  // --- aisle furniture: the only things standing in the walkable lane ----
  { id: "lamp-n", kind: "lampPost", cx: 6, cy: 6, tone: "warm", signal: "amber" },
  { id: "lamp-s", kind: "lampPost", cx: 13, cy: 14, tone: "cool", signal: "teal" },
  { id: "sign-plaza", kind: "signPylon", cx: 4, cy: 9, tone: "warm", signal: "amber" },
  { id: "sign-clinic", kind: "signPylon", cx: 18, cy: 12, tone: "cool", signal: "teal" },
];

export type Tier = "fodder" | "hero";
export type Side = "crew" | "rival";
export type Archetype = "hero" | "melee" | "ranged";

export interface UnitPlacement {
  id: string;
  tier: Tier;
  side: Side;
  archetype: Archetype;
  /** Foot anchor in cell space. Always inside a walkable cell. */
  cx: number;
  cy: number;
  /** `true` renders the sprite mirrored (the other authored facing). */
  mirrored: boolean;
}

export interface Camera {
  key: string;
  label: string;
  /** Crop origin in board pixels. */
  x: number;
  y: number;
  /** Crop size in board pixels. */
  width: number;
  height: number;
  /** Integer upscale — pixel art only ever scales by whole numbers. */
  scale: number;
}

/**
 * Every framing is a whole-number scale of the 640×360 native board, so
 * treatment B is never resampled and "true 1×" means exactly one authored
 * pixel per screen pixel.
 */
export const cameras = {
  native: {
    key: "native",
    label: "true 1× — the whole 640×360 board, one board pixel per screen pixel",
    x: 0,
    y: 0,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    scale: 1,
  },
  native3x: {
    key: "native3x",
    label: "3× — the whole board, integer-upscaled to 1920×1080",
    x: 0,
    y: 0,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    scale: 3,
  },
  combat: {
    key: "combat",
    label: "combat 3× — a 320×180 aperture on the engagement",
    x: 160,
    y: 101,
    width: 320,
    height: 180,
    scale: 3,
  },
  combat1x: {
    key: "combat1x",
    label: "combat 1× — the same aperture, unscaled",
    x: 160,
    y: 101,
    width: 320,
    height: 180,
    scale: 1,
  },
  split: {
    key: "split",
    label: "side-by-side 3× — a 288×180 aperture per panel",
    x: 176,
    y: 101,
    width: 288,
    height: 180,
    scale: 3,
  },
  cover: {
    key: "cover",
    label: "cover proof 3× — the barricade line and the canopy span",
    x: 96,
    y: 130,
    width: 256,
    height: 160,
    scale: 3,
  },
} as const satisfies Record<string, Camera>;

export type CameraKey = keyof typeof cameras;

/** Ambient loop length. Both treatments run the same schedule. */
export const AMBIENT_FRAMES = 6;

export interface Ambient {
  /** Emission level for amber signals, 0..1. */
  amber: number;
  /** Emission level for teal signals, 0..1. */
  teal: number;
  /** Vertical offset of the vent steam puffs, in board pixels. */
  steamRise: number;
  /** Which of the three steam puffs are alive this frame. */
  steamAlive: readonly boolean[];
}

/**
 * The ambient schedule: a mains flicker on the amber signals, a slower
 * breathing teal, and three vent puffs on staggered phases. Deterministic so
 * a filmstrip is reproducible.
 */
export function ambientAt(frame: number): Ambient {
  const phase = ((frame % AMBIENT_FRAMES) + AMBIENT_FRAMES) % AMBIENT_FRAMES;
  const amberSchedule = [1, 1, 0.55, 1, 0.8, 1];
  const tealSchedule = [0.75, 0.9, 1, 0.9, 0.75, 0.6];
  return {
    amber: amberSchedule[phase] ?? 1,
    teal: tealSchedule[phase] ?? 1,
    steamRise: phase * 3,
    steamAlive: [phase < 4, phase >= 1 && phase < 5, phase >= 2],
  };
}
